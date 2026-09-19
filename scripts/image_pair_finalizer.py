"""Paired resizing, encoding, and display-resolution validation for a
structurally-generated base/variant pair.

Both images always receive the identical resize transform. The declared
difference region must survive downsampling to both the production size and
a simulated smaller display size, and every pixel outside that region must
stay aligned between base and variant -- otherwise the resize itself would
be introducing or destroying differences the structural QA never approved.
"""

from pathlib import Path

import numpy as np
from PIL import Image

from base_generation_types import FinalizedPair

DISPLAY_SIZE = (800, 600)

# Mean per-channel intensity delta (0-255 scale) inside the difference region,
# required to still count as a genuinely visible edit after downsampling.
MIN_DETECTABLE_REGION_DELTA = 4.0

# Mean per-channel intensity delta (0-255 scale) tolerated everywhere outside
# the declared difference region. Resizing both images with the identical
# transform should leave this at essentially zero; a small allowance covers
# lossy re-encoding and resampling rounding.
MAX_OUTSIDE_REGION_DELTA = 1.5

# Padding (in native-resolution pixels) added around the declared bbox before
# treating everything else as "outside" -- avoids flagging the edit's own
# antialiased edge as drift.
BBOX_PADDING = 6


def _load_master(path) -> Image.Image:
    with Image.open(path) as img:
        return img.convert("RGB").copy()


def _scale_bbox(bbox, native_size, target_size):
    native_w, native_h = native_size
    target_w, target_h = target_size
    scale_x = target_w / native_w
    scale_y = target_h / native_h
    x1, y1, x2, y2 = bbox
    return (
        max(0, int(x1 * scale_x) - BBOX_PADDING),
        max(0, int(y1 * scale_y) - BBOX_PADDING),
        min(target_w, int(x2 * scale_x) + BBOX_PADDING),
        min(target_h, int(y2 * scale_y) + BBOX_PADDING),
    )


def _region_mask(size, bbox):
    width, height = size
    mask = np.zeros((height, width), dtype=bool)
    x1, y1, x2, y2 = bbox
    mask[y1:y2, x1:x2] = True
    return mask


def _mean_channel_delta(base_img, variant_img, mask) -> float:
    base_arr = np.asarray(base_img, dtype=np.float32)
    variant_arr = np.asarray(variant_img, dtype=np.float32)
    diff = np.abs(base_arr - variant_arr).mean(axis=2)
    if not mask.any():
        return 0.0
    return float(diff[mask].mean())


def _assert_difference_detectable(base_img, variant_img, bbox, label: str) -> None:
    mask = _region_mask(base_img.size, bbox)
    delta = _mean_channel_delta(base_img, variant_img, mask)
    if delta < MIN_DETECTABLE_REGION_DELTA:
        raise ValueError(
            f"DifferenceLostAfterDownsample: mean region delta {delta:.2f} below "
            f"{MIN_DETECTABLE_REGION_DELTA} at {label} ({base_img.size[0]}x{base_img.size[1]})"
        )


def _assert_outside_region_matches(base_img, variant_img, bbox) -> None:
    inside_mask = _region_mask(base_img.size, bbox)
    outside_mask = ~inside_mask
    delta = _mean_channel_delta(base_img, variant_img, outside_mask)
    if delta > MAX_OUTSIDE_REGION_DELTA:
        raise ValueError(
            f"OutsideRegionDrift: mean delta outside the declared region {delta:.2f} "
            f"exceeds tolerance {MAX_OUTSIDE_REGION_DELTA}"
        )


def _extract_bbox(ground_truth: dict):
    bbox = ground_truth.get("bbox") or ground_truth.get("union_bbox")
    if bbox is None:
        raise ValueError("finalize_pair requires ground_truth to include a bbox or union_bbox")
    return tuple(bbox)


def finalize_pair(base_path, variant_path, ground_truth, output_dir, scene_id, policy) -> FinalizedPair:
    base_master = _load_master(base_path)
    variant_master = _load_master(variant_path)

    if base_master.size != variant_master.size:
        raise ValueError(
            f"PairDimensionMismatch: base {base_master.size} != variant {variant_master.size}"
        )
    if base_master.size != tuple(policy.master_size):
        raise ValueError(
            f"PairDimensionMismatch: expected master size {tuple(policy.master_size)}, "
            f"got {base_master.size}"
        )

    native_bbox = _extract_bbox(ground_truth)
    production_size = tuple(policy.production_size)

    base_production = base_master.resize(production_size, Image.Resampling.LANCZOS)
    variant_production = variant_master.resize(production_size, Image.Resampling.LANCZOS)

    production_bbox = _scale_bbox(native_bbox, base_master.size, production_size)
    _assert_difference_detectable(base_production, variant_production, production_bbox, "production size")
    _assert_outside_region_matches(base_production, variant_production, production_bbox)

    base_display = base_production.resize(DISPLAY_SIZE, Image.Resampling.LANCZOS)
    variant_display = variant_production.resize(DISPLAY_SIZE, Image.Resampling.LANCZOS)
    display_bbox = _scale_bbox(native_bbox, base_master.size, DISPLAY_SIZE)
    _assert_difference_detectable(base_display, variant_display, display_bbox, "simulated display size")

    output_dir_path = Path(output_dir)
    output_dir_path.mkdir(parents=True, exist_ok=True)
    base_out = output_dir_path / f"{scene_id}_base.webp"
    variant_out = output_dir_path / f"{scene_id}_variant.webp"
    # WebP at quality 85 is comfortably smaller than the prior JPEG 95 output
    # at equivalent-or-better visual quality, and has been supported in
    # WKWebView (and therefore this app's minimum iOS 15 target) for years --
    # unlike AVIF, which only decodes starting iOS 16. method=6 spends more
    # encode time for better compression, fine for an infrequent manual publish.
    base_production.save(base_out, format="WEBP", quality=85, method=6)
    variant_production.save(variant_out, format="WEBP", quality=85, method=6)

    return FinalizedPair(
        scene_brief_id=scene_id,
        base_path=str(base_out),
        variant_path=str(variant_out),
        dimensions=production_size,
        aspect_ratio="4:3",
        manifest_id=scene_id,
    )
