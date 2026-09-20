"""Local second pass for compact luminous features; no model or network calls.

All edits start from the same master. Detection uses multiscale contrast,
not filenames. It proposes masks, never guarantees that a feature is a star.
Conservative post-edit checks and curator review remain necessary.
"""
import cv2
import numpy as np

from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from local_masked_edits import recolor_target, validate_local_edit, generate_recolor_variants


def detect_star_targets(image, max_targets=24):
    if image is None or image.ndim != 3 or image.shape[2] != 3 or image.dtype != np.uint8:
        raise ValueError("Expected an 8-bit BGR image")
    h, w = image.shape[:2]
    brightness = image.max(axis=2).astype(np.float32)
    candidates = []
    scale = w / 1536.0
    for sigma in (4, 8, 14, 22):
        smooth = cv2.GaussianBlur(brightness, (0, 0), max(1, sigma * scale))
        background = cv2.GaussianBlur(brightness, (0, 0), max(2, sigma * scale * 3))
        response = smooth - background
        binary = (response > 8).astype(np.uint8)
        n, labels, stats, centers = cv2.connectedComponentsWithStats(binary)
        for index in range(1, n):
            x, y, bw, bh, area = (int(v) for v in stats[index])
            fraction = area / (h*w)
            if not 0.001 <= fraction <= 0.012 or max(bw, bh) / max(1, min(bw, bh)) > 2:
                continue
            if area / (bw*bh) < 0.45 or min(x, y, w-x-bw, h-y-bh) < 8:
                continue
            local = (labels[y:y+bh, x:x+bw] == index).astype(np.uint8)
            # Include a short transition band, clipped to this component.
            mask = np.zeros((h, w), np.uint8)
            mask[y:y+bh, x:x+bw] = local * 255
            cx, cy = centers[index]
            peak = float(response[y:y+bh, x:x+bw][local > 0].max())
            if peak < 14:
                continue
            candidates.append({"mask": mask, "bbox": (x, y, x+bw, y+bh),
                               "center": (float(cx), float(cy)), "score": peak,
                               "area": area})
    # Prefer broad, visible halos; suppress alternative scales of the same
    # object and overlapping target masks before expensive edit evaluation.
    candidates.sort(key=lambda t: (-t["area"], -t["score"], t["center"]))
    selected = []
    for item in candidates:
        if any(np.any((item["mask"] > 0) & (other["mask"] > 0)) for other in selected):
            continue
        selected.append(item)
        if len(selected) >= max_targets:
            break
    return selected


def generate_star_variants(candidate, scene_spec, staging_dir, count,
                           policy=DEFAULT_BASE_GENERATION_POLICY, difficulty="Medium",
                           start_index=1, exclude_boxes=(), operation="recolor"):
    base = cv2.imread(candidate.master_path)
    targets = detect_star_targets(base)
    return generate_recolor_variants(candidate, scene_spec, staging_dir, count, targets,
                                     policy=policy, difficulty=difficulty, method="local_star",
                                     start_index=start_index, exclude_boxes=exclude_boxes,
                                         operation=operation)
