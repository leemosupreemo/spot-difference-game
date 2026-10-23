#!/usr/bin/env python3
"""Photoreal small-object removal and local moves.

Why this exists
---------------
The first small-object pass filled removed objects with OpenCV's Telea
inpainting and a square dilation kernel. Telea propagates edge colours inward,
so every fill read as a blurry, angular smear. This module replaces that with:

1. LaMa (via `local_inpaint`) for texture-aware reconstruction.
2. Shadow capture: the darker contact shadow next to an object is added to the
   fill mask, otherwise a "ghost" blob remains where the object stood.
3. Isolation scoring: objects buried in a pile cannot be removed cleanly (there
   is no real background behind them), so candidates whose surroundings are
   occupied by other objects are skipped.
4. Grain matching and a feathered composite so the fill carries the same
   sensor noise as the photo and has no hard seam.
5. A naturalness gate that rejects fills whose texture, tone or seam differ
   measurably from the surrounding ring.
"""
import cv2
import numpy as np

import local_inpaint


def _ellipse(radius):
    radius = max(1, int(radius))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radius + 1,) * 2)


def ring(mask, px):
    """Band of `px` pixels around a mask (excluding the mask itself)."""
    grown = cv2.dilate(mask, _ellipse(px))
    return ((grown > 0) & (mask == 0)).astype(np.uint8)


def object_scale(mask):
    return float(np.sqrt(max(1, int(mask.sum()))))


def occupancy_of_others(candidate, all_masks, canvas_area, max_other_frac=0.05):
    """Union of nearby *object* masks other than the candidate.

    FastSAM returns overlapping part/whole masks, and big masks (table, wall)
    are background, not neighbours. Both are excluded.
    """
    occ = np.zeros_like(candidate)
    cand_area = max(1, int(candidate.sum()))
    for m in all_masks:
        area = int(m.sum())
        if area == 0 or area / canvas_area > max_other_frac:
            continue
        overlap = int((m & candidate).sum())
        if overlap > 0.3 * min(area, cand_area):
            continue  # same object, part of it, or a container of it
        occ |= m
    return occ


def isolation_score(candidate, occupancy, ring_px):
    """Fraction of the surrounding ring that is free of other objects (1 = isolated)."""
    band = ring(candidate, ring_px)
    total = int(band.sum())
    if total == 0:
        return 0.0
    return 1.0 - float((band & occupancy).sum()) / total


def extend_with_shadow(img_bgr, mask):
    """Add the connected, darker-than-background contact shadow to `mask`."""
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0].astype(np.float32)
    scale = object_scale(mask)
    near = ring(mask, max(4, int(0.45 * scale)))
    far = ring(cv2.dilate(mask, _ellipse(max(4, int(0.45 * scale)))), max(6, int(0.4 * scale)))
    if far.sum() < 20 or near.sum() < 20:
        return mask
    bg_L = float(np.median(L[far > 0]))
    bg_spread = float(np.percentile(L[far > 0], 75) - np.percentile(L[far > 0], 25))
    threshold = bg_L - max(8.0, 1.2 * bg_spread)
    dark = ((L < threshold) & (near > 0)).astype(np.uint8)
    if dark.sum() == 0:
        return mask
    # Keep only shadow pixels connected to the object.
    merged = (mask | dark).astype(np.uint8)
    n, labels = cv2.connectedComponents(merged)
    keep = np.zeros_like(mask)
    for lbl in np.unique(labels[mask > 0]):
        if lbl:
            keep |= (labels == lbl).astype(np.uint8)
    return keep


def _highpass(img_f, sigma=1.2):
    return img_f - cv2.GaussianBlur(img_f, (0, 0), sigma)


def match_grain(result_bgr, base_bgr, fill_mask, ring_mask, rng):
    """Add luminance-correlated noise so the fill matches the photo's grain."""
    base_f = base_bgr.astype(np.float32)
    res_f = result_bgr.astype(np.float32)

    def robust_sigma(values):
        # MAD ignores edges/sparkles, which a plain std would mistake for grain.
        med = np.median(values, axis=0)
        return 1.4826 * np.median(np.abs(values - med), axis=0)

    ring_std = robust_sigma(_highpass(base_f)[ring_mask > 0])
    fill_std = robust_sigma(_highpass(res_f)[fill_mask > 0])
    deficit = np.sqrt(np.clip(ring_std ** 2 - fill_std ** 2, 0, None))
    deficit = np.minimum(deficit, 3.0)
    if float(deficit.max()) < 0.5:
        return result_bgr
    noise = rng.normal(0.0, 1.0, base_bgr.shape[:2]).astype(np.float32)
    noise = cv2.GaussianBlur(noise, (0, 0), 0.6)
    noise /= max(1e-6, float(noise.std()))
    sel = fill_mask > 0
    for c in range(3):
        res_f[:, :, c][sel] += noise[sel] * deficit[c]
    return np.clip(res_f, 0, 255).astype(np.uint8)


def remove_object(img_bgr, mask, rng, grow_px=None):
    """Return (variant, fill_mask). `mask` is the object's uint8 0/1 mask."""
    scale = object_scale(mask)
    target = extend_with_shadow(img_bgr, mask)
    grow = grow_px if grow_px is not None else max(4, int(0.12 * scale))
    core = cv2.dilate(target, _ellipse(grow))          # must be fully replaced
    feather = max(2, int(0.06 * scale))
    lama_mask = cv2.dilate(core, _ellipse(feather))    # LaMa also fills the feather band
    filled = local_inpaint.inpaint(img_bgr, lama_mask, dilate_px=0, context_px=160)

    alpha = cv2.GaussianBlur(lama_mask.astype(np.float32), (0, 0), feather / 1.5)
    alpha = np.maximum(alpha, core.astype(np.float32))
    alpha = alpha[:, :, None]
    blended = (filled.astype(np.float32) * alpha + img_bgr.astype(np.float32) * (1 - alpha))
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    band = ring(lama_mask, max(6, int(0.5 * scale)))
    blended = match_grain(blended, img_bgr, lama_mask, band, rng)
    return blended, lama_mask


def naturalness(img_bgr, var_bgr, fill_mask, occupancy=None):
    """Measure whether the fill blends with the *background* around it.

    Other objects in the ring are excluded; otherwise a dark blob next to a
    bright pastry looks "within range" simply because the ring is varied.
    Returns (ok, metrics).
    """
    scale = object_scale(fill_mask)
    band = ring(fill_mask, max(6, int(0.6 * scale)))
    if occupancy is not None:
        bg_band = (band & (1 - cv2.dilate(occupancy, _ellipse(2)))).astype(np.uint8)
        if bg_band.sum() >= 0.35 * band.sum():
            band = bg_band
    if band.sum() < 30:
        return False, {"reason": "ring too small"}
    lab_v = cv2.cvtColor(var_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_b = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    gray_v = lab_v[:, :, 0]

    lap = cv2.Laplacian(gray_v, cv2.CV_32F)
    tex_fill = float(lap[fill_mask > 0].std())
    tex_ring = float(cv2.Laplacian(lab_b[:, :, 0], cv2.CV_32F)[band > 0].std())
    tex_ratio = tex_fill / max(1e-3, tex_ring)

    fill_lab = np.median(lab_v[fill_mask > 0], axis=0)
    ring_lab = np.median(lab_b[band > 0], axis=0)
    ringL = lab_b[band > 0][:, 0]
    ring_spread = float(np.percentile(ringL, 75) - np.percentile(ringL, 25))
    delta_e = float(np.linalg.norm(fill_lab - ring_lab))
    # A fill noticeably darker/brighter than its background is the "ghost blob".
    dL = abs(float(fill_lab[0] - ring_lab[0]))

    # Seam: gradient energy on the fill boundary vs. inside the ring.
    gx = cv2.Sobel(gray_v, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(gray_v, cv2.CV_32F, 0, 1)
    grad = np.sqrt(gx ** 2 + gy ** 2)
    edge = cv2.morphologyEx(fill_mask, cv2.MORPH_GRADIENT, _ellipse(1)) > 0
    seam_ratio = float(grad[edge].mean()) / max(1e-3, float(grad[band > 0].mean()))

    metrics = {
        "tex_ratio": round(tex_ratio, 2),
        "delta_e": round(delta_e, 1),
        "dL": round(dL, 1),
        "ring_iqr": round(ring_spread, 1),
        "seam_ratio": round(seam_ratio, 2),
    }
    ok = (
        0.6 <= tex_ratio <= 1.6
        and delta_e <= 8.0 + 0.35 * ring_spread
        and dL <= 6.0 + 0.3 * ring_spread
        and seam_ratio <= 1.4
    )
    return ok, metrics


def move_object(img_bgr, mask, occupancy, rng):
    """Shift a small object ~1-1.6 object-widths onto matching free background.

    Returns (variant, union_mask, (dx, dy)) or None.
    """
    h, w = mask.shape
    target = extend_with_shadow(img_bgr, mask)
    ys, xs = np.nonzero(target)
    if len(ys) == 0:
        return None
    bw, bh = int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)

    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    src_ring = ring(target, max(6, int(0.5 * object_scale(mask))))
    if (src_ring > 0).sum() == 0:
        return None
    src_lab = lab[src_ring > 0].mean(axis=0)

    margin = int(0.03 * min(h, w))
    dirs = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)]
    order = rng.permutation(len(dirs))
    valid_disp = None
    for k in order:
        for dist in (1.2, 1.5):
            dx = int(dirs[k][0] * dist * bw)
            dy = int(dirs[k][1] * dist * bh)
            if xs.min() + dx < margin or xs.max() + dx >= w - margin:
                continue
            if ys.min() + dy < margin or ys.max() + dy >= h - margin:
                continue
            M = np.float32([[1, 0, dx], [0, 1, dy]])
            dest = cv2.warpAffine(target, M, (w, h), flags=cv2.INTER_NEAREST)
            dest_zone = cv2.dilate(dest, _ellipse(max(3, int(0.15 * object_scale(mask)))))
            if (dest_zone & occupancy).sum() > 0.03 * dest_zone.sum():
                continue
            if (dest_zone & target).sum() > 0:
                continue  # keep source and destination visually separate
            dest_lab = lab[dest_zone > 0].mean(axis=0)
            if float(np.linalg.norm(dest_lab - src_lab)) > 11.0:
                continue
            valid_disp = (dx, dy, dest, dest_zone)
            break
        if valid_disp is not None:
            break

    if valid_disp is None:
        return None

    dx, dy, dest, dest_zone = valid_disp
    removed, fill_mask = remove_object(img_bgr, mask, rng)

    feather = max(1.0, 0.04 * object_scale(mask))
    alpha_obj = cv2.GaussianBlur(target.astype(np.float32), (0, 0), feather)
    alpha_obj = np.maximum(alpha_obj, cv2.erode(target, _ellipse(1)).astype(np.float32))

    M = np.float32([[1, 0, dx], [0, 1, dy]])
    obj = cv2.warpAffine(img_bgr, M, (w, h), flags=cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_REFLECT)
    a = cv2.warpAffine(alpha_obj, M, (w, h), flags=cv2.INTER_LINEAR)[:, :, None]
    out = removed.astype(np.float32) * (1 - a) + obj.astype(np.float32) * a
    out = np.clip(out, 0, 255).astype(np.uint8)
    union = ((fill_mask > 0) | (dest_zone > 0)).astype(np.uint8)
    return out, fill_mask, union, (dx, dy)
