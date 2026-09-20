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
        # distanceTransform over a full frame costs the same whether the edit
        # covers 100 pixels or a million. Run it on the mask's own neighbourhood
        # instead: padding beyond the feather width cannot change the result,
        # because every pixel deeper than that is already clamped to 1.
        weight = np.zeros(binary.shape, np.float32)
        ys, xs = np.nonzero(binary)
        if len(xs):
            pad = int(np.ceil(feather_pixels)) + 2
            y0, y1 = max(0, ys.min() - pad), min(binary.shape[0], ys.max() + pad + 1)
            x0, x1 = max(0, xs.min() - pad), min(binary.shape[1], xs.max() + pad + 1)
            window = binary[y0:y1, x0:x1]
            weight[y0:y1, x0:x1] = np.clip(
                cv2.distanceTransform(window, cv2.DIST_L2, 3) / feather_pixels, 0, 1)
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



def _local_background(image, mask, ring_px=21):
    """Median colour of a ring just outside the mask -- the substrate an edit
    must sit against."""
    inside = mask > 0
    kernel = np.ones((ring_px, ring_px), np.uint8)
    ring = (cv2.dilate(inside.astype(np.uint8), kernel) > 0) & ~inside
    if not ring.any():
        return None
    return np.median(image[ring].reshape(-1, 3), axis=0)


def find_paste_regions(image, targets, patch_shape, max_regions=12, margin=12,
                       donor_background=None):
    """Empty places a donor patch could plausibly sit.

    Windows must be quiet (low variance), clear of every existing target, and
    inside the frame by a margin. Given the donor's own surroundings, they are
    then ranked by how closely their substrate matches it.

    That ranking is the point. Sorting by darkness alone offers the emptiest
    sky, which for a star sitting in bright nebula is the worst possible
    destination -- the copy lands in a square of foreign background and is
    rejected downstream. Similarity has to drive the search, not just judge it.
    """
    if image is None or image.ndim != 3:
        raise ValueError("Expected an 8-bit BGR image")
    h, w = image.shape[:2]
    ph, pw = int(patch_shape[0]), int(patch_shape[1])
    if ph < 1 or pw < 1 or ph >= h or pw >= w:
        return []

    occupied = np.zeros((h, w), np.uint8)
    for target in targets:
        occupied |= (target["mask"] > 0).astype(np.uint8)
    # Keep clear of existing objects by the patch size, so a duplicate never
    # lands touching the thing it was copied from.
    occupied = cv2.dilate(occupied, np.ones((ph, pw), np.uint8))

    # Windowed statistics via box filters: one pass each, independent of patch
    # size. Slicing per window instead made this the slowest step in the whole
    # fallback, since it re-reads every patch for every target.
    grey = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    ksize = (pw, ph)
    mean = cv2.boxFilter(grey, -1, ksize, normalize=True, borderType=cv2.BORDER_REFLECT)
    mean_sq = cv2.boxFilter(grey * grey, -1, ksize, normalize=True, borderType=cv2.BORDER_REFLECT)
    variance = np.maximum(mean_sq - mean * mean, 0.0)
    colour_mean = cv2.boxFilter(image.astype(np.float32), -1, ksize, normalize=True,
                                borderType=cv2.BORDER_REFLECT)
    # A window is free only if nothing occupied falls inside it.
    occupied_in_window = cv2.boxFilter(occupied.astype(np.float32), -1, ksize,
                                       normalize=False, borderType=cv2.BORDER_REFLECT)

    candidates = []
    step = max(8, min(ph, pw) // 2)
    for y in range(margin, h - ph - margin, step):
        for x in range(margin, w - pw - margin, step):
            cy, cx = y + ph // 2, x + pw // 2
            if occupied_in_window[cy, cx] > 0:
                continue
            entry = {
                "center": (x + pw / 2.0, y + ph / 2.0),
                "variance": float(variance[cy, cx]),
                "mean": float(mean[cy, cx]),
            }
            if donor_background is not None:
                entry["background_delta"] = float(
                    np.max(np.abs(colour_mean[cy, cx] - donor_background)))
            candidates.append(entry)

    if donor_background is not None:
        # Closest substrate first; quietness only breaks ties.
        candidates.sort(key=lambda c: (round(c["background_delta"], 1), c["variance"]))
    else:
        candidates.sort(key=lambda c: (c["variance"], c["mean"]))
    return candidates[:max_regions]


def duplicate_target(base, target, destination_center):
    """Copy one target's own pixels to an empty place in the same image.

    Nothing is synthesised: the donor pixels come from this image, so the edit
    cannot invent texture that was never photographed. Only pixels inside the
    translated mask change.
    """
    h, w = base.shape[:2]
    x1, y1, x2, y2 = (int(v) for v in target["bbox"])
    ph, pw = y2 - y1, x2 - x1
    cx, cy = destination_center
    dx, dy = int(round(cx - pw / 2.0)), int(round(cy - ph / 2.0))
    if dx < 0 or dy < 0 or dx + pw > w or dy + ph > h:
        raise ValueError("Destination patch falls outside the image")

    donor_mask = (target["mask"][y1:y2, x1:x2] > 0)
    generated = base.copy()
    region = generated[dy:dy+ph, dx:dx+pw]
    region[donor_mask] = base[y1:y2, x1:x2][donor_mask]
    generated[dy:dy+ph, dx:dx+pw] = region

    final_mask = np.zeros((h, w), np.uint8)
    final_mask[dy:dy+ph, dx:dx+pw][donor_mask] = 255
    return hard_composite(base, generated, final_mask), final_mask


MAX_DUPLICATE_BACKGROUND_DELTA = 26


def validate_duplicate(base, target, final_mask, max_background_delta=MAX_DUPLICATE_BACKGROUND_DELTA):
    """A duplicate is only believable where the substrate matches.

    If the donor's surroundings are much brighter or darker than the
    destination's, the pasted halo reads as a rectangle of foreign sky.
    """
    donor_bg = _local_background(base, target["mask"])
    dest_bg = _local_background(base, final_mask)
    if donor_bg is None or dest_bg is None:
        return False, {}, "DuplicateBackgroundUnavailable"
    delta = float(np.max(np.abs(donor_bg - dest_bg)))
    if delta > max_background_delta:
        return False, {"background_delta": round(delta, 1)}, "DuplicateBackgroundMismatch"
    return True, {"background_delta": round(delta, 1)}, None


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


def _mask_bbox(mask):
    ys, xs = np.nonzero(mask > 0)
    if not len(xs):
        return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def _describe(operation, method):
    if operation == "duplicate":
        return "One extra copy appears" if method == "local_star" else "One extra object appears"
    return "One luminous feature changes color" if method == "local_star" else "One bounded object changes color"


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


def _plan_recolor(base, target, _targets):
    """Each hue step is one attempt at this target."""
    for angle in (25, -25, 45, -45, 65, -65, 90):
        yield {"angle": angle}, lambda t=target, a=angle: (recolor_target(base, t["mask"], a), t["mask"])


def _plan_duplicate(base, target, targets):
    """Each empty destination is one attempt at this target."""
    patch = (target["bbox"][3] - target["bbox"][1], target["bbox"][2] - target["bbox"][0])
    donor_background = _local_background(base, target["mask"])
    for region in find_paste_regions(base, targets, patch, donor_background=donor_background):
        # The search already measured this destination's substrate. A window
        # that cannot pass validate_duplicate is dropped here rather than after
        # a composite and a full perceptual pass -- that check costs 18ms, the
        # pass it precedes costs 180ms.
        if region.get("background_delta", 0) > MAX_DUPLICATE_BACKGROUND_DELTA:
            continue
        yield ({"destination": [round(v, 1) for v in region["center"]],
                "region_variance": round(region["variance"], 1),
                "background_delta": round(region.get("background_delta", 0), 1)},
               lambda t=target, c=region["center"]: duplicate_target(base, t, c))


OPERATION_PLANS = {"recolor": _plan_recolor, "duplicate": _plan_duplicate}


def generate_recolor_variants(candidate, scene_spec, staging_dir, count, targets,
                              policy=DEFAULT_BASE_GENERATION_POLICY, difficulty="Medium",
                              method="local_star", start_index=1, exclude_boxes=(),
                              operation="recolor"):
    """`start_index` continues an earlier engine's variant numbering so two
    engines topping up one image never publish colliding scene ids.
    `exclude_boxes` drops targets an earlier engine already edited, so the two
    detectors cannot publish the same object twice in different colors."""
    if count < 1 or difficulty not in ("Easy", "Medium", "Hard"):
        raise ValueError("Invalid count or difficulty")
    if operation not in OPERATION_PLANS:
        raise ValueError(f"operation must be one of {sorted(OPERATION_PLANS)}")
    if start_index < 1:
        raise ValueError("start_index must be positive")
    base = cv2.imread(candidate.master_path)
    kept = [t for t in targets
            if not any(_boxes_overlap(tuple(t["bbox"]), tuple(b)) for b in exclude_boxes)]
    log = {"method": method, "operation": operation, "target_count": len(kept),
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
        # Keep at most one edit per target, avoiding five colours of the same
        # star or five copies of it scattered across the frame.
        for descriptor, make_edit in OPERATION_PLANS[operation](base, target, targets):
            try:
                variant, edit_mask = make_edit()
            except ValueError as exc:
                # e.g. a destination that cannot fit the patch: skip this
                # attempt rather than abandoning the whole image.
                log["attempts"].append({"target": target_index, **descriptor,
                                        "passed": False, "rejection_code": str(exc),
                                        "metrics": {}})
                continue
            # The region the player must spot is where the change landed, which
            # for a duplicate is the destination, not the donor.
            scored = dict(target, mask=edit_mask, bbox=_mask_bbox(edit_mask) or target["bbox"])
            if operation == "duplicate":
                ok, dup_metrics, dup_code = validate_duplicate(base, target, edit_mask)
                if not ok:
                    log["attempts"].append({"target": target_index, **descriptor,
                                            "passed": False, "rejection_code": dup_code,
                                            "metrics": dup_metrics})
                    continue
            passed, metrics, code = validate_local_edit(base, variant, scored, operation, difficulty)
            attempt = {"target": target_index, **descriptor, "passed": passed,
                       "rejection_code": code, "metrics": metrics}
            log["attempts"].append(attempt)
            if not passed:
                continue
            raw.mkdir(parents=True, exist_ok=True)
            scene_id = f"{base_id}_v{start_index + len(variants)}"
            path = raw / f"{scene_id}_variant.png"
            if not cv2.imwrite(str(path), variant):
                raise OSError(f"Unable to write {path}")
            ground_truth = _ground_truth(scored, base.shape)
            try:
                finalized = finalize_pair(candidate.master_path, str(path), ground_truth,
                                          str(Path(staging_dir) / "finalized"), scene_id, policy, lossless=True)
                valid_encoded, encoded_metrics, encoded_code = _verify_encoded(finalized, scored, difficulty)
                attempt["encoded_metrics"] = encoded_metrics
                if not valid_encoded:
                    raise ValueError(encoded_code)
            except ValueError as exc:
                attempt.update(passed=False, rejection_code=str(exc))
                continue
            entry = {"id": scene_id, "title": scene_spec.get("title", base_id),
                     "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper",
                     "difficulty": difficulty, "operation": operation, "generationMethod": method,
                     "curationStatus": "pending",
                     "diffs": [{"id": 1, "x": ground_truth["x"], "y": ground_truth["y"],
                                "radius": ground_truth["radius"], "operation": operation,
                                "description": _describe(operation, method),
                                "hint": "Look for a small change in color" if operation == "recolor"
                                        else "Something appears that is not in the other image"}]}
            variants.append((finalized, entry))
            break
    log["accepted_count"] = len(variants)
    if not variants:
        log["rejection_code"] = "NoLocalStarCandidate" if method == "local_star" else "NoLocalSegmentedCandidate"
        log["rejection_reason"] = "No distinct local edit passed visibility, locality, and encoded-image checks"
    return variants, log
