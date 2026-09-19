"""Canonical normalization for a manually-supplied base image.

Applies at most the smallest centered crop needed to reach exact 4:3,
rejecting an image that would need more than
`policy.max_normalization_crop_fraction`, then resizes to
`policy.master_size` and re-encodes as an opaque sRGB PNG.
"""

import io

from PIL import Image

from base_generation_types import NormalizedCandidate


def normalize_local_image(
    image_bytes: bytes, scene_id: str, output_path: str, policy
) -> NormalizedCandidate:
    target_width, target_height = policy.master_size
    target_aspect = target_width / target_height

    with Image.open(io.BytesIO(image_bytes)) as decoded:
        decoded = decoded.convert("RGB")
        native_width, native_height = decoded.size
        native_aspect = native_width / native_height

        if abs(native_aspect - target_aspect) < 1e-9:
            crop_fraction = 0.0
            cropped = decoded
        elif native_aspect > target_aspect:
            ideal_width = native_height * target_aspect
            crop_amount = native_width - ideal_width
            crop_fraction = crop_amount / native_width
            _reject_if_over_ceiling(crop_fraction, policy)
            left = crop_amount / 2
            cropped = decoded.crop((round(left), 0, round(left + ideal_width), native_height))
        else:
            ideal_height = native_width / target_aspect
            crop_amount = native_height - ideal_height
            crop_fraction = crop_amount / native_height
            _reject_if_over_ceiling(crop_fraction, policy)
            top = crop_amount / 2
            cropped = decoded.crop((0, round(top), native_width, round(top + ideal_height)))

        resized = cropped.resize(policy.master_size, Image.Resampling.LANCZOS)
        resized.save(output_path, format="PNG")

    return NormalizedCandidate(
        scene_brief_id=scene_id,
        provider="manual",
        model="manual-ingest",
        request_id=scene_id,
        master_path=output_path,
        size=policy.master_size,
        normalization_crop_fraction=crop_fraction,
    )


def _reject_if_over_ceiling(crop_fraction: float, policy) -> None:
    if crop_fraction > policy.max_normalization_crop_fraction:
        raise ValueError(
            f"NormalizationCropExceeded: required crop fraction {crop_fraction:.4f} "
            f"exceeds policy ceiling {policy.max_normalization_crop_fraction:.4f}"
        )
