from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class StructuralQualityResult:
    passed: bool
    score: float
    metrics: dict
    rejection_code: str | None
    reason: str | None


def score_structural_candidate(
    selector_score=None,
    naturalness_score=None,
    compactness_score=None,
    difficulty_fit_score=None,
):
    components = {
        "selector": 0.5 if selector_score is None else float(np.clip(selector_score / 100.0, 0.0, 1.0)),
        "naturalness": 0.5 if naturalness_score is None else float(np.clip(naturalness_score, 0.0, 1.0)),
        "compactness": 0.5 if compactness_score is None else float(np.clip(compactness_score, 0.0, 1.0)),
        "difficulty_fit": 0.5 if difficulty_fit_score is None else float(np.clip(difficulty_fit_score, 0.0, 1.0)),
    }
    final_score = (
        0.30 * components["selector"]
        + 0.30 * components["naturalness"]
        + 0.20 * components["compactness"]
        + 0.20 * components["difficulty_fit"]
    )
    return round(final_score, 4), {key: round(value, 4) for key, value in components.items()}


def select_candidate(candidates, selection_mode):
    if not candidates:
        return None
    if selection_mode == "first_pass":
        return candidates[0]
    if selection_mode != "best_score":
        raise ValueError(f"Unknown selection mode: {selection_mode}")

    scored = []
    for candidate in candidates:
        item = dict(candidate)
        final_score, components = score_structural_candidate(
            selector_score=item.get("selector_score"),
            naturalness_score=item.get("naturalness_score"),
            compactness_score=item.get("compactness_score"),
            difficulty_fit_score=item.get("difficulty_fit_score"),
        )
        item["final_score"] = final_score
        item["score_components"] = components
        scored.append(item)
    scored.sort(key=lambda item: (-item["final_score"], item.get("attempt_index", 0)))
    return scored[0]


class StructuralNaturalnessCritic:
    @staticmethod
    def _reject(code, reason, metrics):
        return StructuralQualityResult(False, 0.0, metrics, code, reason)

    @staticmethod
    def _mask_centroid_and_short_side(mask):
        ys, xs = np.where(mask > 0)
        if len(xs) == 0:
            return None, 0.0
        bbox_width = float(xs.max() - xs.min() + 1)
        bbox_height = float(ys.max() - ys.min() + 1)
        return (float(np.mean(xs)), float(np.mean(ys))), min(bbox_width, bbox_height)

    @classmethod
    def evaluate(
        cls,
        base_bgr,
        variant_bgr,
        edit_bbox,
        operation,
        object_mask=None,
        occupied_mask=None,
        old_mask=None,
        new_mask=None,
    ):
        height, width = base_bgr.shape[:2]
        diff = np.max(
            np.abs(base_bgr.astype(np.int16) - variant_bgr.astype(np.int16)),
            axis=2,
        )
        diff_mask = (diff > 14).astype(np.uint8)
        changed_pixels = int(np.sum(diff_mask))
        if changed_pixels == 0:
            return cls._reject(
                "NoStructuralDifference",
                "No structural pixels changed.",
                {"changed_pixels": 0},
            )

        ys, xs = np.where(diff_mask > 0)
        diff_bbox_area = int((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1))
        compactness = changed_pixels / float(max(1, diff_bbox_area))
        component_count, _, component_stats, _ = cv2.connectedComponentsWithStats(
            diff_mask,
            connectivity=8,
        )
        significant_components = sum(
            1
            for index in range(1, component_count)
            if component_stats[index, cv2.CC_STAT_AREA] >= 8
        )

        x1, y1, x2, y2 = [int(value) for value in edit_bbox]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(width - 1, x2), min(height - 1, y2)
        base_gray = cv2.cvtColor(base_bgr, cv2.COLOR_BGR2GRAY)
        variant_gray = cv2.cvtColor(variant_bgr, cv2.COLOR_BGR2GRAY)
        base_roi = base_gray[y1:y2 + 1, x1:x2 + 1]
        variant_roi = variant_gray[y1:y2 + 1, x1:x2 + 1]
        base_sharpness = float(cv2.Laplacian(base_roi, cv2.CV_64F).var()) if base_roi.size else 0.0
        variant_sharpness = float(cv2.Laplacian(variant_roi, cv2.CV_64F).var()) if variant_roi.size else 0.0
        sharpness_ratio = variant_sharpness / float(base_sharpness + 1e-5)

        expected_mask = None
        if operation == "reorder" and old_mask is not None and new_mask is not None:
            old_centroid, old_short_side = cls._mask_centroid_and_short_side(old_mask)
            new_centroid, _ = cls._mask_centroid_and_short_side(new_mask)
            if old_centroid is not None and new_centroid is not None:
                centroid_distance = float(np.hypot(
                    new_centroid[0] - old_centroid[0],
                    new_centroid[1] - old_centroid[1],
                ))
                if centroid_distance > old_short_side:
                    return cls._reject(
                        "SplitDifferenceRegion",
                        "Old and new reorder footprints do not form one compact answer region.",
                        {
                            "centroid_distance": round(centroid_distance, 2),
                            "object_short_side": round(old_short_side, 2),
                        },
                    )
            expected_mask = cv2.bitwise_or(
                (old_mask > 0).astype(np.uint8) * 255,
                (new_mask > 0).astype(np.uint8) * 255,
            )
        elif object_mask is not None:
            expected_mask = (object_mask > 0).astype(np.uint8) * 255

        collision_fraction = 0.0
        collision_mask = new_mask if operation == "reorder" and new_mask is not None else object_mask
        if collision_mask is not None and occupied_mask is not None:
            placed = collision_mask > 0
            occupied = occupied_mask > 0
            if operation == "reorder" and old_mask is not None:
                occupied = occupied & ~(old_mask > 0)
            placed_area = int(np.sum(placed))
            collision_fraction = float(np.sum(placed & occupied)) / float(max(1, placed_area))
            if collision_fraction > 0.08:
                return cls._reject(
                    "StructuralCollision",
                    "Placed object collides with unrelated foreground.",
                    {"collision_fraction": round(collision_fraction, 4)},
                )

        spill_fraction = 0.0
        if expected_mask is not None:
            allowed = cv2.dilate(expected_mask, np.ones((7, 7), np.uint8), iterations=1) > 0
            spill_fraction = float(np.sum((diff_mask > 0) & ~allowed)) / float(changed_pixels)
            if spill_fraction > 0.25:
                return cls._reject(
                    "StructuralBoundaryArtifact",
                    "Changed pixels extend well beyond the intended structural mask.",
                    {"spill_fraction": round(spill_fraction, 4)},
                )

        boundary_mask = expected_mask if expected_mask is not None else diff_mask * 255
        boundary_binary = (boundary_mask > 0).astype(np.uint8) * 255
        boundary_kernel = np.ones((3, 3), np.uint8)
        inner_rim = (boundary_binary > 0) & (
            cv2.erode(boundary_binary, boundary_kernel, iterations=1) == 0
        )
        outer_rim = (cv2.dilate(boundary_binary, boundary_kernel, iterations=1) > 0) & (
            boundary_binary == 0
        )
        boundary_delta_e = 0.0
        if np.any(inner_rim) and np.any(outer_rim):
            variant_lab = cv2.cvtColor(variant_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
            inner_mean = np.mean(variant_lab[inner_rim], axis=0)
            outer_mean = np.mean(variant_lab[outer_rim], axis=0)
            boundary_delta_e = float(np.linalg.norm(inner_mean - outer_mean))

        if operation == "remove" and base_sharpness > 1.0 and sharpness_ratio < 0.35:
            return cls._reject(
                "StructuralBlurArtifact",
                "Reconstructed background is substantially blurrier than the base region.",
                {"sharpness_ratio": round(sharpness_ratio, 4)},
            )

        topology_score = 1.0 / float(max(1, significant_components))
        boundary_color_score = float(np.clip(1.0 - max(0.0, boundary_delta_e - 50.0) / 70.0, 0.0, 1.0))
        boundary_score = min(
            float(np.clip(1.0 - spill_fraction, 0.0, 1.0)),
            boundary_color_score,
        )
        sharpness_score = float(np.clip(sharpness_ratio, 0.0, 1.0))
        collision_score = float(np.clip(1.0 - collision_fraction, 0.0, 1.0))
        naturalness_score = float(np.clip(
            0.30 * boundary_score
            + 0.25 * sharpness_score
            + 0.25 * compactness
            + 0.10 * topology_score
            + 0.10 * collision_score,
            0.0,
            1.0,
        ))
        metrics = {
            "changed_pixels": changed_pixels,
            "component_count": significant_components,
            "compactness_score": round(compactness, 4),
            "spill_fraction": round(spill_fraction, 4),
            "boundary_delta_e": round(boundary_delta_e, 4),
            "sharpness_ratio": round(sharpness_ratio, 4),
            "collision_fraction": round(collision_fraction, 4),
            "naturalness_score": round(naturalness_score, 4),
        }
        return StructuralQualityResult(
            True,
            round(naturalness_score, 4),
            metrics,
            None,
            None,
        )
