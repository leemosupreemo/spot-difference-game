"""Bounded-object fallback using installed FastSAM weights or first-pass masks.

Segmentation proposes geometry, not semantic object labels. Fragmented masks,
edge objects, large regions, and overlapping proposals are excluded. No model
download is attempted; missing or unusable local engines produce a report.
"""
from pathlib import Path

import cv2
import numpy as np

from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from local_masked_edits import generate_recolor_variants

DEFAULT_WEIGHTS = Path(__file__).resolve().parent.parent / "FastSAM-s.pt"


def select_segmented_targets(masks, image_shape, max_targets=24):
    h, w = image_shape[:2]
    candidates = []
    for index, raw in enumerate(masks):
        raw = np.asarray(raw)
        if raw.ndim != 2 or not raw.size or not np.isfinite(raw).all():
            continue
        binary = cv2.resize((raw > 0.5).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
        components, _, stats, centers = cv2.connectedComponentsWithStats(binary)
        # Never turn a disconnected proposal into permission for several edits.
        if components != 2:
            continue
        x, y, bw, bh, area = (int(v) for v in stats[1])
        if not 0.001 <= area / (h*w) <= 0.012:
            continue
        if min(x, y, w-x-bw, h-y-bh) < 8 or max(bw, bh) / min(bw, bh) > 3:
            continue
        if area / (bw*bh) < 0.45:
            continue
        candidates.append({"mask": binary * 255, "bbox": (x, y, x+bw, y+bh),
                           "center": tuple(float(v) for v in centers[1]), "area": area,
                           "source_index": index})
    candidates.sort(key=lambda item: (-item["area"], item["source_index"]))
    selected = []
    for target in candidates:
        if len(selected) >= max_targets:
            break
        if any(np.any((target["mask"] > 0) & (other["mask"] > 0)) for other in selected):
            continue
        selected.append(target)
    return selected


def filter_foreground_targets(image, targets, min_lightness_contrast=12):
    """Reject dark background gaps segmented between brighter objects.

    This conservative local test favors objects lighter than their immediate
    surroundings. It is an object proposal check, not semantic recognition.
    """
    lightness = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)[:, :, 0]
    kernel = np.ones((41, 41), np.uint8)
    kept, rejected = [], []
    for target in targets:
        inside = target["mask"] > 0
        ring = (cv2.dilate(inside.astype(np.uint8), kernel) > 0) & ~inside
        if not inside.any() or not ring.any():
            rejected.append({"bbox": list(target["bbox"]), "reason": "InvalidForegroundRing"})
            continue
        contrast = float(np.median(lightness[inside])) - float(np.median(lightness[ring]))
        if contrast < min_lightness_contrast:
            rejected.append({"bbox": list(target["bbox"]), "reason": "BackgroundLikeMask",
                             "lightness_contrast": round(contrast, 1)})
            continue
        kept.append(dict(target, lightness_contrast=round(contrast, 1)))
    return kept, rejected


def load_local_masks(image_path, weights=DEFAULT_WEIGHTS):
    # Guard before importing/constructing FastSAM: its constructor can download
    # a named checkpoint if the file is absent.
    path = Path(weights).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Local FastSAM weights unavailable: {path}")
    from ultralytics import FastSAM

    model = FastSAM(str(path))
    results = model(str(image_path), device="cpu", retina_masks=True,
                    imgsz=1024, conf=0.20, iou=0.65, verbose=False)
    if not results or results[0].masks is None:
        return []
    return results[0].masks.data.cpu().numpy()


def generate_segmented_variants(candidate, scene_spec, staging_dir, count,
                                policy=DEFAULT_BASE_GENERATION_POLICY, difficulty="Medium",
                                raw_masks=None, weights=DEFAULT_WEIGHTS, start_index=1,
                                exclude_boxes=(), operation="recolor"):
    if count < 1 or difficulty not in ("Easy", "Medium", "Hard"):
        raise ValueError("Invalid count or difficulty")
    base = cv2.imread(candidate.master_path)
    if base is None:
        raise ValueError(f"Failed to decode image: {candidate.master_path}")
    mask_source = "first_pass" if raw_masks is not None else "local_fastsam"
    if raw_masks is None:
        try:
            raw_masks = load_local_masks(candidate.master_path, weights)
        except (ImportError, OSError, RuntimeError, ValueError) as exc:
            return [], {"method": "local_segmented", "mask_source": mask_source,
                        "target_count": 0, "accepted_count": 0, "attempts": [], "targets": [],
                        "rejection_code": "LocalSegmentationUnavailable", "rejection_reason": str(exc)}
    proposed = select_segmented_targets(raw_masks, base.shape)
    targets, rejected = filter_foreground_targets(base, proposed)
    pairs, log = generate_recolor_variants(candidate, scene_spec, staging_dir, count, targets,
                                         policy=policy, difficulty=difficulty, method="local_segmented",
                                         start_index=start_index, exclude_boxes=exclude_boxes,
                                         operation=operation)
    log["mask_source"] = mask_source
    log["proposed_target_count"] = len(proposed)
    log["mask_rejections"] = rejected
    return pairs, log
