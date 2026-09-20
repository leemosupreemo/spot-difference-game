"""Local inpainting via a provisioned LaMa checkpoint.

Why this exists
---------------
Instrumenting three workbench images showed `remove` and `reorder` failing for
one shared reason: background reconstruction. Every one of 34 reorder attempts
was rejected with "Background reconstruction failed on vacate", and remove
candidates were rejected for boundary discontinuity, texture mismatch and local
blur. Reorder has to vacate the object's original position, which *is* a
removal, so both operations are gated on the same step. `add`, which needs no
reconstruction, passed 30 of 31 attempts.

So this is aimed at a measured bottleneck rather than a hoped-for improvement.

Provisioning, not downloading
-----------------------------
The checkpoint is loaded from an explicit path and never fetched. An absent
checkpoint is reported, not repaired: silently pulling 200MB during a
generation run is exactly what the design record rules out, and it would also
make a run's behaviour depend on whether someone happened to have the file.

What this does not change
-------------------------
Better filling is necessary for removal, not sufficient. The design record's
conclusion still holds -- a region good enough to recolour is not necessarily a
whole, removable object -- so the existing boundary, texture and naturalness
checks still judge the result, and a curator still reviews it.
"""
import os
from pathlib import Path

import cv2
import numpy as np

# Default location for the provisioned checkpoint. Overridable so a machine can
# keep models elsewhere without editing code.
DEFAULT_WEIGHTS = Path(os.environ.get(
    "DIFF_HUNTER_LAMA_WEIGHTS",
    Path(__file__).resolve().parent.parent / "models" / "big-lama.pt"
))

# LaMa is a fully convolutional model trained at a fixed stride; feeding it
# dimensions that are not a multiple of this produces edge artefacts.
SIZE_MULTIPLE = 8

_model_cache = {}


class LocalInpaintingUnavailable(RuntimeError):
    """The checkpoint is absent or unusable. Reported, never worked around."""


def is_available(weights=DEFAULT_WEIGHTS):
    return Path(weights).is_file()


def _load(weights):
    key = str(weights)
    if key in _model_cache:
        return _model_cache[key]
    path = Path(weights)
    if not path.is_file():
        raise LocalInpaintingUnavailable(
            f"LaMa checkpoint not provisioned at {path}. "
            "Download it explicitly; generation never fetches it."
        )
    try:
        import torch
    except ImportError as exc:
        raise LocalInpaintingUnavailable(f"torch unavailable: {exc}") from exc
    try:
        model = torch.jit.load(str(path), map_location="cpu")
        model.eval()
    except Exception as exc:
        raise LocalInpaintingUnavailable(f"Could not load {path}: {exc}") from exc
    _model_cache[key] = (model, torch)
    return _model_cache[key]


def _pad_to_multiple(array, multiple=SIZE_MULTIPLE):
    height, width = array.shape[:2]
    pad_h = (multiple - height % multiple) % multiple
    pad_w = (multiple - width % multiple) % multiple
    if pad_h == 0 and pad_w == 0:
        return array, (height, width)
    padded = cv2.copyMakeBorder(array, 0, pad_h, 0, pad_w, cv2.BORDER_REFLECT)
    return padded, (height, width)


def _work_window(shape, binary, context_px):
    """A crop around the masked region, with context for the model to match."""
    ys, xs = np.nonzero(binary)
    height, width = shape[:2]
    y0 = max(0, int(ys.min()) - context_px)
    y1 = min(height, int(ys.max()) + context_px + 1)
    x0 = max(0, int(xs.min()) - context_px)
    x1 = min(width, int(xs.max()) + context_px + 1)
    return y0, y1, x0, x1


def inpaint(image_bgr, mask, weights=DEFAULT_WEIGHTS, dilate_px=8, context_px=128):
    """Fill `mask` in `image_bgr`, returning a full-size BGR image.

    The mask is dilated slightly: LaMa reconstructs the masked region only, and
    an object's own soft edge and shadow usually sit just outside a segmentation
    mask. Leaving them behind is what reads as a halo where something used to be.
    """
    if image_bgr is None or image_bgr.ndim != 3 or image_bgr.shape[2] != 3:
        raise ValueError("Expected an 8-bit BGR image")
    mask = np.asarray(mask)
    if mask.ndim != 2 or mask.shape != image_bgr.shape[:2]:
        raise ValueError("Mask must be 2-D and match the image dimensions")

    model, torch = _load(weights)

    binary = (mask > 0).astype(np.uint8)
    if dilate_px > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dilate_px + 1,) * 2)
        binary = cv2.dilate(binary, kernel)
    if not binary.any():
        return image_bgr.copy()

    # Run the model on a window around the fill rather than the whole frame.
    # The result is identical where it matters -- LaMa only reconstructs masked
    # pixels, and the surrounding context is what it matches against -- but a
    # full 1536x1152 pass takes over a minute on CPU, which at a dozen
    # candidates per operation would put an image beyond half an hour.
    y0, y1, x0, x1 = _work_window(image_bgr.shape, binary, context_px)
    window_bgr = image_bgr[y0:y1, x0:x1]
    window_mask = binary[y0:y1, x0:x1]

    rgb = cv2.cvtColor(window_bgr, cv2.COLOR_BGR2RGB)
    padded_rgb, (height, width) = _pad_to_multiple(rgb)
    padded_mask, _ = _pad_to_multiple(window_mask)

    image_tensor = torch.from_numpy(padded_rgb).permute(2, 0, 1).float().div(255.0).unsqueeze(0)
    mask_tensor = torch.from_numpy(padded_mask).float().unsqueeze(0).unsqueeze(0)

    with torch.no_grad():
        result = model(image_tensor, mask_tensor)

    out = result[0].permute(1, 2, 0).detach().cpu().numpy()
    # The model returns 0-255 floats in some builds and 0-1 in others.
    if out.max() <= 1.5:
        out = out * 255.0
    out = np.clip(out, 0, 255).astype(np.uint8)[:height, :width]
    filled_window = cv2.cvtColor(out, cv2.COLOR_RGB2BGR)

    # Only the masked region may change. Everything else is copied byte for
    # byte, so a model artefact can never leak into untouched pixels.
    result_bgr = image_bgr.copy()
    region = result_bgr[y0:y1, x0:x1]
    region[window_mask > 0] = filled_window[window_mask > 0]
    result_bgr[y0:y1, x0:x1] = region
    return result_bgr
