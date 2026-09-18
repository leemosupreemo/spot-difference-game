from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class StructuralMaskResult:
    object_mask: np.ndarray
    cleanup_mask: np.ndarray
    bbox: list[int]
    metrics: dict


class StructuralMaskRefiner:
    @staticmethod
    def _source_sized_binary(mask, width, height):
        normalized = (mask > 0).astype(np.uint8) * 255
        if normalized.shape != (height, width):
            normalized = cv2.resize(
                normalized,
                (width, height),
                interpolation=cv2.INTER_NEAREST,
            )
        return normalized

    @staticmethod
    def _keep_primary_component(mask, bbox):
        count, labels, stats, centroids = cv2.connectedComponentsWithStats(
            (mask > 0).astype(np.uint8),
            connectivity=8,
        )
        if count <= 1:
            return mask.copy(), 0

        source_cx = (bbox[0] + bbox[2]) / 2.0
        source_cy = (bbox[1] + bbox[3]) / 2.0
        source_x = int(np.clip(round(source_cx), 0, mask.shape[1] - 1))
        source_y = int(np.clip(round(source_cy), 0, mask.shape[0] - 1))
        selected = int(labels[source_y, source_x])
        if selected == 0:
            candidates = range(1, count)
            selected = min(
                candidates,
                key=lambda label: (
                    (centroids[label][0] - source_cx) ** 2
                    + (centroids[label][1] - source_cy) ** 2,
                    -stats[label, cv2.CC_STAT_AREA],
                ),
            )
        return (labels == selected).astype(np.uint8) * 255, count - 1

    @staticmethod
    def _local_roi(bbox, width, height):
        bw = max(1, bbox[2] - bbox[0] + 1)
        bh = max(1, bbox[3] - bbox[1] + 1)
        pad_x = int(round(bw * 0.20)) + 8
        pad_y = int(round(bh * 0.20)) + 8
        return [
            max(0, bbox[0] - pad_x),
            max(0, bbox[1] - pad_y),
            min(width - 1, bbox[2] + pad_x),
            min(height - 1, bbox[3] + pad_y),
        ]

    @staticmethod
    def _run_grabcut(image_bgr, cleaned_mask, roi):
        height, width = cleaned_mask.shape
        x1, y1, x2, y2 = roi
        init = np.full((height, width), cv2.GC_BGD, dtype=np.uint8)
        init[y1:y2 + 1, x1:x2 + 1] = cv2.GC_PR_BGD
        init[cleaned_mask > 0] = cv2.GC_PR_FGD
        sure_fg = cv2.erode(cleaned_mask, np.ones((3, 3), np.uint8), iterations=1)
        init[sure_fg > 0] = cv2.GC_FGD
        background_model = np.zeros((1, 65), np.float64)
        foreground_model = np.zeros((1, 65), np.float64)
        cv2.grabCut(
            image_bgr,
            init,
            None,
            background_model,
            foreground_model,
            2,
            cv2.GC_INIT_WITH_MASK,
        )
        return np.where(
            (init == cv2.GC_FGD) | (init == cv2.GC_PR_FGD),
            255,
            0,
        ).astype(np.uint8)

    @staticmethod
    def _centroid(mask):
        ys, xs = np.where(mask > 0)
        if len(xs) == 0:
            return None
        return float(np.mean(xs)), float(np.mean(ys))

    @classmethod
    def refine(cls, image_bgr, candidate_mask, bbox, _grabcut=None):
        height, width = image_bgr.shape[:2]
        normalized = cls._source_sized_binary(candidate_mask, width, height)
        original_area = int(np.sum(normalized > 0))
        primary, original_component_count = cls._keep_primary_component(normalized, bbox)
        kernel = np.ones((3, 3), np.uint8)
        cleaned = cv2.morphologyEx(primary, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
        cleaned_area = int(np.sum(cleaned > 0))
        if cleaned_area == 0:
            cleaned = primary
            cleaned_area = int(np.sum(cleaned > 0))

        roi = cls._local_roi(bbox, width, height)
        grabcut = _grabcut or cls._run_grabcut
        refinement_status = "grabcut_accepted"
        try:
            proposed = cls._source_sized_binary(grabcut(image_bgr, cleaned, roi), width, height)
        except cv2.error:
            proposed = cleaned
            refinement_status = "grabcut_error_fallback"

        proposed_area = int(np.sum(proposed > 0))
        area_change = abs(proposed_area - cleaned_area) / float(max(1, cleaned_area))
        proposed_centroid = cls._centroid(proposed)
        bw = max(1, bbox[2] - bbox[0] + 1)
        bh = max(1, bbox[3] - bbox[1] + 1)
        margin_x = bw * 0.10
        margin_y = bh * 0.10
        centroid_valid = proposed_centroid is not None and (
            bbox[0] - margin_x <= proposed_centroid[0] <= bbox[2] + margin_x
            and bbox[1] - margin_y <= proposed_centroid[1] <= bbox[3] + margin_y
        )
        if proposed_area == 0 or area_change > 0.35 or not centroid_valid:
            object_mask = cleaned
            if refinement_status == "grabcut_accepted":
                refinement_status = "grabcut_drift_fallback"
        else:
            object_mask, _ = cls._keep_primary_component(proposed, bbox)

        ys, xs = np.where(object_mask > 0)
        refined_bbox = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
        cleanup = cv2.dilate(object_mask, kernel, iterations=1)
        shifted_shadow = np.zeros_like(cleanup)
        shifted_shadow[2:, 2:] = cleanup[:-2, :-2]
        cleanup = cv2.bitwise_or(cleanup, shifted_shadow)
        local_roi = cls._local_roi(refined_bbox, width, height)
        local_limit = np.zeros_like(cleanup)
        lx1, ly1, lx2, ly2 = local_roi
        local_limit[ly1:ly2 + 1, lx1:lx2 + 1] = 255
        cleanup = cv2.bitwise_and(cleanup, local_limit)

        contours, _ = cv2.findContours(object_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contour_area = float(sum(cv2.contourArea(contour) for contour in contours))
        hull_area = 0.0
        if contours:
            points = np.vstack(contours)
            hull_area = float(cv2.contourArea(cv2.convexHull(points)))
        solidity = contour_area / hull_area if hull_area > 0 else 0.0
        final_components, _, _, _ = cv2.connectedComponentsWithStats(
            (object_mask > 0).astype(np.uint8),
            connectivity=8,
        )
        refined_area = int(np.sum(object_mask > 0))
        cleanup_area = int(np.sum(cleanup > 0))
        boundary_union = np.sum((cleaned > 0) | (object_mask > 0))
        boundary_change_ratio = float(
            np.sum((cleaned > 0) ^ (object_mask > 0))
        ) / float(max(1, boundary_union))

        return StructuralMaskResult(
            object_mask=object_mask,
            cleanup_mask=cleanup,
            bbox=refined_bbox,
            metrics={
                "original_area": original_area,
                "cleaned_area": cleaned_area,
                "refined_area": refined_area,
                "cleanup_area": cleanup_area,
                "cleanup_area_pct": round(cleanup_area / float(width * height) * 100.0, 4),
                "source_component_count": original_component_count,
                "component_count": max(0, final_components - 1),
                "solidity": round(solidity, 3),
                "area_change_ratio": round(area_change, 3),
                "boundary_change_ratio": round(boundary_change_ratio, 4),
                "refinement_status": refinement_status,
            },
        )
