#!/usr/bin/env python3
"""
Standardize all Photography category image pairs to 4:3 aspect ratio.
- Non-4:3 images (16:9, 3:2, portrait) are cropped (never squished/distorted).
- The 4:3 crop window is centered around the difference hotspot with safe margins.
- Verifies that 100% of diff pixels remain visible within the crop.
- Recalculates hotspot percentage coordinates (diff.x, diff.y, diff.radius).
- Updates dimensions and sets aspectRatio to "4:3" in photo_pair_manifest.json.
"""

import sys
import os
import json
import numpy as np
from PIL import Image

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MANIFEST_PATH = os.path.join(PROJECT_ROOT, 'public/levels/photo_pair_manifest.json')
DIST_MANIFEST_PATH = os.path.join(PROJECT_ROOT, 'dist/levels/photo_pair_manifest.json')

def compute_exact_4_3_box(w, h):
    """
    Computes (target_w, target_h) such that target_w / target_h == 4 / 3 exactly.
    """
    current_ratio = w / float(h)
    target_ratio = 4.0 / 3.0

    if current_ratio >= target_ratio:
        # Wider than 4:3 -> keep height, compute width
        k = h // 3
        target_h = k * 3
        target_w = k * 4
        if target_w > w:
            k = w // 4
            target_h = k * 3
            target_w = k * 4
    else:
        # Taller than 4:3 (portrait or taller) -> keep width, compute height
        k = w // 4
        target_w = k * 4
        target_h = k * 3
        if target_h > h:
            k = h // 3
            target_h = k * 3
            target_w = k * 4

    return target_w, target_h

def find_diff_pixels_and_centroid(base_img, var_img):
    """
    Returns (centroid_x, centroid_y, bbox_min_x, bbox_max_x, bbox_min_y, bbox_max_y)
    or None if no differences over threshold.
    """
    arr1 = np.array(base_img.convert('RGB'), dtype=np.int16)
    arr2 = np.array(var_img.convert('RGB'), dtype=np.int16)
    diff_map = np.abs(arr1 - arr2).max(axis=2)
    diff_y, diff_x = np.where(diff_map > 15)

    if len(diff_x) == 0:
        # Lower threshold fallback
        diff_y, diff_x = np.where(diff_map > 8)

    if len(diff_x) == 0:
        return None

    return (
        float(diff_x.mean()),
        float(diff_y.mean()),
        int(diff_x.min()),
        int(diff_x.max()),
        int(diff_y.min()),
        int(diff_y.max())
    )

def main():
    apply_changes = '--apply' in sys.argv
    print(f"=== STANDARDIZE PHOTO PAIRS TO 4:3 [{'APPLY' if apply_changes else 'DRY RUN'}] ===")

    with open(MANIFEST_PATH, 'r') as f:
        manifest = json.load(f)

    total_levels = len(manifest)
    already_43_count = 0
    cropped_count = 0
    errors = []

    updated_manifest = []

    for idx, entry in enumerate(manifest):
        level_id = entry['id']
        base_rel = entry['baseImage'].lstrip('/')
        var_rel = entry['variantImage'].lstrip('/')
        base_path = os.path.join(PROJECT_ROOT, 'public', base_rel)
        var_path = os.path.join(PROJECT_ROOT, 'public', var_rel)

        if not os.path.exists(base_path) or not os.path.exists(var_path):
            errors.append(f"Missing files for {level_id}: {base_path} or {var_path}")
            updated_manifest.append(entry)
            continue

        base_img = Image.open(base_path)
        var_img = Image.open(var_path)
        w, h = base_img.size

        current_ratio = w / float(h)
        # Check if already 4:3 (within 1% e.g. 1200x896, 640x480, 1200x900)
        if abs(current_ratio - 4.0 / 3.0) < 0.01:
            already_43_count += 1
            # Ensure aspectRatio field is explicitly "4:3"
            entry_copy = dict(entry)
            entry_copy['aspectRatio'] = '4:3'
            updated_manifest.append(entry_copy)
            continue

        # Needs cropping to 4:3
        target_w, target_h = compute_exact_4_3_box(w, h)
        assert target_w <= w and target_h <= h, f"Target larger than source for {level_id}"
        assert target_w * 3 == target_h * 4, f"Target {target_w}x{target_h} is not 4:3 for {level_id}"

        diff_info = entry['diffs'][0]
        manifest_diff_x_px = (diff_info['x'] / 100.0) * w
        manifest_diff_y_px = (diff_info['y'] / 100.0) * h
        manifest_diff_r_px = (diff_info['radius'] / 100.0) * w

        pixel_diff = find_diff_pixels_and_centroid(base_img, var_img)
        if pixel_diff is not None:
            c_x, c_y, min_x, max_x, min_y, max_y = pixel_diff
            focus_x = c_x
            focus_y = c_y
        else:
            focus_x = manifest_diff_x_px
            focus_y = manifest_diff_y_px
            min_x = max_x = int(manifest_diff_x_px)
            min_y = max_y = int(manifest_diff_y_px)

        # Center crop window on diff focus point
        ideal_x0 = focus_x - target_w / 2.0
        crop_x0 = int(round(max(0, min(ideal_x0, w - target_w))))
        crop_x1 = crop_x0 + target_w

        ideal_y0 = focus_y - target_h / 2.0
        crop_y0 = int(round(max(0, min(ideal_y0, h - target_h))))
        crop_y1 = crop_y0 + target_h

        # Verification: ensure actual diff pixel bbox is within crop window
        if min_x < crop_x0 or max_x > crop_x1 or min_y < crop_y0 or max_y > crop_y1:
            errors.append(
                f"Diff pixels clipped for {level_id}: x=[{min_x}, {max_x}] vs crop_x=[{crop_x0}, {crop_x1}], "
                f"y=[{min_y}, {max_y}] vs crop_y=[{crop_y0}, {crop_y1}]"
            )

        # Recalculate diff coordinates in cropped space
        new_x_percent = round(((focus_x - crop_x0) / float(target_w)) * 100.0, 1)
        new_y_percent = round(((focus_y - crop_y0) / float(target_h)) * 100.0, 1)

        # Preserve touch radius in pixels, scaled to target_w, clamped to [5.0%, 10.0%]
        new_r_percent = round(max(5.0, min((manifest_diff_r_px / float(target_w)) * 100.0, 10.0)), 1)

        cropped_count += 1

        if apply_changes:
            # Crop images
            base_cropped = base_img.crop((crop_x0, crop_y0, crop_x1, crop_y1))
            var_cropped = var_img.crop((crop_x0, crop_y0, crop_x1, crop_y1))

            # Save base
            ext = os.path.splitext(base_path)[1].lower()
            if ext in ['.jpg', '.jpeg']:
                base_cropped.save(base_path, 'JPEG', quality=96, subsampling=0)
            elif ext == '.png':
                base_cropped.save(base_path, 'PNG')
            elif ext == '.webp':
                base_cropped.save(base_path, 'WEBP', quality=96)
            else:
                base_cropped.save(base_path)

            # Save variant
            ext_v = os.path.splitext(var_path)[1].lower()
            if ext_v in ['.jpg', '.jpeg']:
                var_cropped.save(var_path, 'JPEG', quality=96, subsampling=0)
            elif ext_v == '.png':
                var_cropped.save(var_path, 'PNG')
            elif ext_v == '.webp':
                var_cropped.save(var_path, 'WEBP', quality=96)
            else:
                var_cropped.save(var_path)

        # Update entry
        new_entry = dict(entry)
        new_entry['dimensions'] = {'width': target_w, 'height': target_h}
        new_entry['aspectRatio'] = '4:3'
        new_entry['diffs'] = [
            {
                **diff_info,
                'x': new_x_percent,
                'y': new_y_percent,
                'radius': new_r_percent
            }
        ]
        updated_manifest.append(new_entry)

    print(f"Total levels processed: {total_levels}")
    print(f"Already 4:3: {already_43_count}")
    print(f"Cropped to 4:3: {cropped_count}")
    print(f"Errors / Clippings: {len(errors)}")

    if errors:
        for err in errors:
            print(f"  ERROR: {err}")
        print("Aborting due to errors!")
        sys.exit(1)

    if apply_changes:
        with open(MANIFEST_PATH, 'w') as f:
            json.dump(updated_manifest, f, indent=2)
            f.write('\n')
        print(f"Successfully saved updated manifest to {MANIFEST_PATH}")

        if os.path.exists(DIST_MANIFEST_PATH):
            with open(DIST_MANIFEST_PATH, 'w') as f:
                json.dump(updated_manifest, f, indent=2)
                f.write('\n')
            print(f"Successfully saved updated manifest to {DIST_MANIFEST_PATH}")

    print("Done!")

if __name__ == '__main__':
    main()
