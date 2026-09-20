"""Masked local recoloring, preservation checks, and review candidate delivery.

The generation/context mask is never used as permission to alter output pixels.
Only the final mask enters the compositor; the feather stays inside that mask.
"""
from pathlib import Path

import cv2
import numpy as np

from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from image_pair_finalizer import finalize_pair
from perceptual_verification_engine import PerceptualVerificationEngine
from structural_quality import StructuralNaturalnessCritic


def _binary_mask(mask, shape=None):
    mask = np.asarray(mask)
    if mask.ndim != 2 or (shape is not None and mask.shape != shape) or not np.isfinite(mask).all():
        raise ValueError("Expected a finite mask matching the image dimensions")
    return (mask > 0).astype(np.uint8)


def expand_generation_mask(final_mask, padding=12):
    """Give an editor context without expanding the final composite region."""
    binary = _binary_mask(final_mask)
    if not isinstance(padding, int) or padding < 0:
        raise ValueError("Mask padding must be a nonnegative integer")
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*padding+1, 2*padding+1))
    return cv2.dilate(binary, kernel) * 255


def hard_composite(original, generated, final_mask, feather_pixels=5):
    """Copy original bytes outside final_mask; feather only inward."""
    if (original.dtype != np.uint8 or generated.dtype != np.uint8
            or original.ndim != 3 or original.shape[2] != 3 or original.shape != generated.shape):
        raise ValueError("Expected matching 8-bit three-channel images")
    if not np.isfinite(feather_pixels) or feather_pixels < 0:
        raise ValueError("Feather width must be finite and nonnegative")
    binary = _binary_mask(final_mask, original.shape[:2])
    if feather_pixels:
        weight = np.clip(cv2.distanceTransform(binary, cv2.DIST_L2, 3) / feather_pixels, 0, 1)
    else:
        weight = binary.astype(np.float32)
    weight = weight[:, :, None]
    blended = np.rint(original*(1-weight) + generated*weight)
    result = original.copy()
    result[binary > 0] = np.clip(blended[binary > 0], 0, 255).astype(np.uint8)
    return result


def recolor_target(base, mask, degrees):
    """Rotate Lab chroma inside the mask, preserving luminance and texture.

    The feather lies entirely inside the allowed mask. Recomposition uses
    the original bytes elsewhere, avoiding color-conversion rounding drift.
    """
    lab = cv2.cvtColor(base.astype(np.float32) / 255, cv2.COLOR_BGR2LAB)
    theta = np.deg2rad(degrees)
    a, b = lab[:, :, 1].copy(), lab[:, :, 2].copy()
    lab[:, :, 1] = a*np.cos(theta) - b*np.sin(theta)
    lab[:, :, 2] = a*np.sin(theta) + b*np.cos(theta)
    converted = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR) * 255
    return hard_composite(base, np.clip(np.rint(converted), 0, 255).astype(np.uint8), mask)



def validate_local_edit(base, variant, target, operation, difficulty):
    allowed = target["mask"] > 0
    if not np.array_equal(base[~allowed], variant[~allowed]):
        return False, {}, "OutsideMaskDrift"
    delta = np.max(np.abs(base.astype(np.int16) - variant.astype(np.int16)), axis=2)
    changed = (delta > 14).astype(np.uint8)
    n, _, stats, _ = cv2.connectedComponentsWithStats(changed)
    areas = sorted((int(stats[i, cv2.CC_STAT_AREA]) for i in range(1, n)), reverse=True)
    if not areas or sum(areas[1:]) > 0.08 * sum(areas):
        return False, {}, "ScatteredDifference"
    passed, metrics, reason, code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
        base, variant, target["bbox"], operation, difficulty)
    if not passed:
        return False, metrics, code or reason
    naturalness = StructuralNaturalnessCritic.evaluate(
        base, variant, target["bbox"], operation, object_mask=target["mask"])
    if not naturalness.passed:
        return False, metrics, naturalness.rejection_code
    metrics = dict(metrics, naturalness_score=naturalness.score)
    return True, metrics, None


def _ground_truth(target, shape):
    h, w = shape[:2]
    x1, y1, x2, y2 = target["bbox"]
    return {"bbox": list(target["bbox"]), "x": (x1+x2)/2/w*100,
            "y": (y1+y2)/2/h*100,
            "radius": float(np.hypot((x2-x1)/w, (y2-y1)/h)*50)}


def _verify_encoded(finalized, target, difficulty):
    base = cv2.imread(finalized.base_path)
    variant = cv2.imread(finalized.variant_path)
    h, w = base.shape[:2]
    sh, sw = target["mask"].shape
    bbox = tuple(int(v * (w/sw if i % 2 == 0 else h/sh)) for i, v in enumerate(target["bbox"]))
    passed, metrics, reason, code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
        base, variant, bbox, "recolor", difficulty)
    # Lossless encoding must preserve exact equality. LANCZOS resizing has a
    # three-output-pixel support radius when downsampling; allow four for
    # support plus coordinate rounding, following the mask rather than bbox.
    resized_mask = cv2.resize((target["mask"] > 0).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
    radius = int(np.ceil(3 * max(1, w/sw, h/sh))) + 1
    support = cv2.dilate(resized_mask, np.ones((2*radius+1, 2*radius+1), np.uint8)) > 0
    if not np.array_equal(base[~support], variant[~support]):
        return False, metrics, "EncodedOutsideRegionDrift"
    return passed, metrics, code or (None if passed else reason)


def _boxes_overlap(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def accepted_boxes(log):
    """Boxes this engine actually published, for a later engine to skip."""
    targets = log.get("targets", [])
    return [tuple(targets[attempt["target"]]["bbox"])
            for attempt in log.get("attempts", [])
            if attempt.get("passed") and attempt["target"] < len(targets)]


def generate_recolor_variants(candidate, scene_spec, staging_dir, count, targets,
                              policy=DEFAULT_BASE_GENERATION_POLICY, difficulty="Medium",
                              method="local_star", start_index=1, exclude_boxes=()):
    """`start_index` continues an earlier engine's variant numbering so two
    engines topping up one image never publish colliding scene ids.
    `exclude_boxes` drops targets an earlier engine already edited, so the two
    detectors cannot publish the same object twice in different colors."""
    if count < 1 or difficulty not in ("Easy", "Medium", "Hard"):
        raise ValueError("Invalid count or difficulty")
    if start_index < 1:
        raise ValueError("start_index must be positive")
    base = cv2.imread(candidate.master_path)
    kept = [t for t in targets
            if not any(_boxes_overlap(tuple(t["bbox"]), tuple(b)) for b in exclude_boxes)]
    log = {"method": method, "target_count": len(kept),
           "excluded_target_count": len(targets) - len(kept), "attempts": [],
           "targets": [{"bbox": list(t["bbox"]), "center": list(t["center"]),
                        "area": t["area"]} for t in kept]}
    targets = kept
    variants = []
    raw = Path(staging_dir) / method
    base_id = scene_spec["id"]
    for target_index, target in enumerate(targets):
        if len(variants) >= count:
            break
        # Try modest-to-strong hue changes at each distinct target. Keep at
        # most one edit per target, avoiding five colors of the same star.
        for angle in (25, -25, 45, -45, 65, -65, 90):
            variant = recolor_target(base, target["mask"], angle)
            passed, metrics, code = validate_local_edit(base, variant, target, "recolor", difficulty)
            attempt = {"target": target_index, "angle": angle, "passed": passed,
                       "rejection_code": code, "metrics": metrics}
            log["attempts"].append(attempt)
            if not passed:
                continue
            raw.mkdir(parents=True, exist_ok=True)
            scene_id = f"{base_id}_v{start_index + len(variants)}"
            path = raw / f"{scene_id}_variant.png"
            if not cv2.imwrite(str(path), variant):
                raise OSError(f"Unable to write {path}")
            ground_truth = _ground_truth(target, base.shape)
            try:
                finalized = finalize_pair(candidate.master_path, str(path), ground_truth,
                                          str(Path(staging_dir) / "finalized"), scene_id, policy, lossless=True)
                valid_encoded, encoded_metrics, encoded_code = _verify_encoded(finalized, target, difficulty)
                attempt["encoded_metrics"] = encoded_metrics
                if not valid_encoded:
                    raise ValueError(encoded_code)
            except ValueError as exc:
                attempt.update(passed=False, rejection_code=str(exc))
                continue
            entry = {"id": scene_id, "title": scene_spec.get("title", base_id),
                     "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper",
                     "difficulty": difficulty, "operation": "recolor", "generationMethod": method,
                     "curationStatus": "pending",
                     "diffs": [{"id": 1, "x": ground_truth["x"], "y": ground_truth["y"],
                                "radius": ground_truth["radius"], "operation": "recolor",
                                "description": "One luminous feature changes color" if method == "local_star" else "One bounded object changes color",
                                "hint": "Look for a small change in color"}]}
            variants.append((finalized, entry))
            break
    log["accepted_count"] = len(variants)
    if not variants:
        log["rejection_code"] = "NoLocalStarCandidate" if method == "local_star" else "NoLocalSegmentedCandidate"
        log["rejection_reason"] = "No distinct local edit passed visibility, locality, and encoded-image checks"
    return variants, log
