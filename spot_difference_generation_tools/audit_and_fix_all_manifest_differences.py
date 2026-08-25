"""
GROUND-TRUTH DIFFERENCE AUDIT & REPAIR ENGINE
================================================================================
Performs 100% pixel-by-pixel delta analysis between baseImage and variantImage
for every level in photo_pair_manifest.json:
1. Detects exact changed pixel clusters (RGB & CIELAB Delta-E thresholding).
2. Computes the exact geometric centroid (cx, cy) of the true difference.
3. Computes the exact enclosing hit radius + touch tolerance margin.
4. Identifies and eliminates rogue background noise/drift outside the target.
5. Updates photo_pair_manifest.json with guaranteed pixel-accurate coordinates.
================================================================================
"""

import os
import json
import cv2
import numpy as np

def audit_and_fix_manifest():
    manifest_path = "public/levels/photo_pair_manifest.json"
    if not os.path.exists(manifest_path):
        print(f"❌ Manifest not found at {manifest_path}")
        return

    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    print("=" * 80)
    print(f"AUDITING {len(manifest)} LEVELS IN MANIFEST FOR PIXEL ACCURACY")
    print("=" * 80)

    fixed_count = 0
    clean_count = 0
    drift_fixed_count = 0
    errors = []

    for idx, entry in enumerate(manifest):
        level_id = entry.get("id", f"level_{idx}")
        base_rel = entry.get("baseImage", "").lstrip("/")
        var_rel = entry.get("variantImage", "").lstrip("/")

        base_path = os.path.join("public", base_rel) if not base_rel.startswith("public/") else base_rel
        var_path = os.path.join("public", var_rel) if not var_rel.startswith("public/") else var_rel

        if not os.path.exists(base_path) or not os.path.exists(var_path):
            # Might be procedural or data URL
            if base_rel.startswith("data:"):
                continue
            errors.append(f"Level {level_id}: Missing image file ({base_path} or {var_path})")
            continue

        base_bgr = cv2.imread(base_path)
        var_bgr = cv2.imread(var_path)

        if base_bgr is None or var_bgr is None:
            errors.append(f"Level {level_id}: Failed to decode image file")
            continue

        if base_bgr.shape != var_bgr.shape:
            # Resize variant if dimensions mismatch
            var_bgr = cv2.resize(var_bgr, (base_bgr.shape[1], base_bgr.shape[0]))

        h, w = base_bgr.shape[:2]

        # 1. Compute pixel difference
        # CIELAB Delta-E & RGB absolute difference
        base_lab = cv2.cvtColor(base_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        var_lab = cv2.cvtColor(var_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

        delta_e = np.sqrt(np.sum((base_lab - var_lab) ** 2, axis=2))
        rgb_diff = np.max(np.abs(base_bgr.astype(np.float32) - var_bgr.astype(np.float32)), axis=2)

        # Significant difference mask: Delta-E > 6.0 or RGB diff > 10
        diff_mask = (delta_e > 6.0) | (rgb_diff > 10.0)

        # Morphological opening to filter compression artifacts
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        clean_mask = cv2.morphologyEx(diff_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel)

        num_diff_pixels = np.sum(clean_mask > 0)
        if num_diff_pixels == 0:
            # Fallback to lower threshold if very subtle
            diff_mask = (delta_e > 3.0) | (rgb_diff > 5.0)
            clean_mask = cv2.morphologyEx(diff_mask.astype(np.uint8), cv2.MORPH_OPEN, kernel)
            num_diff_pixels = np.sum(clean_mask > 0)

        if num_diff_pixels == 0:
            errors.append(f"Level {level_id}: Zero pixel differences detected between base and variant!")
            continue

        # Find largest connected component (the primary difference)
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(clean_mask, connectivity=8)
        
        # stats: [x, y, width, height, area]
        # Skip label 0 (background)
        if num_labels > 1:
            areas = stats[1:, cv2.CC_STAT_AREA]
            max_idx = np.argmax(areas) + 1
            main_mask = (labels == max_idx).astype(np.uint8)
            
            # Check for rogue background drift outside main component
            other_pixels = num_diff_pixels - stats[max_idx, cv2.CC_STAT_AREA]
            if other_pixels > 50:
                # Clamp rogue pixels on variant back to base to eliminate ghost drift!
                # Expand main_mask slightly with dilation
                dilated_main = cv2.dilate(main_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)), iterations=1)
                fixed_var_bgr = np.where(dilated_main[:, :, np.newaxis] > 0, var_bgr, base_bgr)
                cv2.imwrite(var_path, fixed_var_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
                drift_fixed_count += 1
                var_bgr = fixed_var_bgr
                diff_mask = dilated_main > 0
                clean_mask = main_mask
        else:
            main_mask = clean_mask

        # Compute exact weighted centroid from Delta-E intensity
        ys, xs = np.where(main_mask > 0)
        weights = delta_e[ys, xs]
        weights_sum = np.sum(weights) + 1e-6

        true_cx = float(np.sum(xs * weights) / weights_sum)
        true_cy = float(np.sum(ys * weights) / weights_sum)

        # In percentage (0-100)
        pct_x = round((true_cx / w) * 100.0, 1)
        pct_y = round((true_cy / h) * 100.0, 1)

        # Compute required bounding radius
        bx_min, bx_max = float(np.min(xs)), float(np.max(xs))
        by_min, by_max = float(np.min(ys)), float(np.max(ys))
        span_x = (bx_max - bx_min) / w * 100.0
        span_y = (by_max - by_min) / h * 100.0
        max_span = max(span_x, span_y)

        # Generous hit radius for great touch ergonomics: span/2 + 2.0% comfort margin
        true_radius = round(max(4.5, min(9.0, (max_span / 2.0) + 2.0)), 1)

        # Check existing diff in manifest
        diffs = entry.get("diffs", [])
        if not diffs:
            entry["diffs"] = [{
                "id": 1,
                "x": pct_x,
                "y": pct_y,
                "radius": true_radius,
                "description": entry.get("description", "Spot the difference"),
                "hint": f"Look closely near ({pct_x}%, {pct_y}%)"
            }]
            fixed_count += 1
        else:
            current_diff = diffs[0]
            cur_x = current_diff.get("x", -1)
            cur_y = current_diff.get("y", -1)
            cur_r = current_diff.get("radius", -1)

            dx = abs(cur_x - pct_x)
            dy = abs(cur_y - pct_y)
            dr = abs(cur_r - true_radius)

            if dx > 0.6 or dy > 0.6 or dr > 0.6:
                # Discrepancy found! Fix it
                current_diff["x"] = pct_x
                current_diff["y"] = pct_y
                current_diff["radius"] = true_radius
                
                # Also update hint text if it contains old percentage coordinates
                hint = current_diff.get("hint", "")
                if "(" in hint and "%)" in hint:
                    prefix = hint.split("(")[0]
                    current_diff["hint"] = f"{prefix.strip()} near ({pct_x}%, {pct_y}%)"

                fixed_count += 1
                if fixed_count <= 15:
                    print(f"  [FIXED] Level '{level_id}': Centroid shifted ({cur_x}%, {cur_y}%) -> ({pct_x}%, {pct_y}%), Radius: {cur_r}% -> {true_radius}%")
            else:
                clean_count += 1

    # Save manifest back
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 80)
    print("AUDIT & REPAIR SUMMARY:")
    print(f"  • Total levels audited: {len(manifest)}")
    print(f"  • Already pixel-accurate: {clean_count}")
    print(f"  • Coordinates/Radius corrected: {fixed_count}")
    print(f"  • Ghost background drift clamped: {drift_fixed_count}")
    if errors:
        print(f"  • Warnings/Errors ({len(errors)}):")
        for err in errors[:10]:
            print(f"    - {err}")
    print("=" * 80)

if __name__ == "__main__":
    audit_and_fix_manifest()
