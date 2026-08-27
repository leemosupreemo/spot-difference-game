"""
AUDIT AND CALIBRATE ALL PHOTOREALISTIC IMAGE PAIRS
================================================================================
1. Checks selector / hit area alignment with actual ground-truth pixel difference.
   - Computes exact difference centroid (cx, cy) and enclosing radius.
   - Measures alignment distance and flags/corrects misaligned coordinates.
2. Detects exact duplicate image pairs:
   - Compares base image hash + difference hash / difference bounding box.
   - Flags identical pairs (same base image and identical modification).
================================================================================
"""

import os
import json
import hashlib
import cv2
import numpy as np

def compute_image_hash(img_path):
    if not os.path.exists(img_path):
        return None
    with open(img_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def audit_and_correct_manifest():
    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    print(f"Loaded {len(manifest)} manifest entries for audit.\n")

    misaligned_count = 0
    missing_files_count = 0
    duplicate_groups = {}
    pair_signatures = {}
    corrections_applied = 0

    audited_manifest = []

    for i, entry in enumerate(manifest):
        level_id = entry.get("id", f"entry_{i}")
        title = entry.get("title", "")
        base_rel = entry.get("baseImage", "").lstrip("/")
        var_rel = entry.get("variantImage", "").lstrip("/")

        base_path = os.path.join(os.getcwd(), "public", base_rel) if not base_rel.startswith("public/") else base_rel
        var_path = os.path.join(os.getcwd(), "public", var_rel) if not var_rel.startswith("public/") else var_rel

        if not os.path.exists(base_path) or not os.path.exists(var_path):
            print(f"[MISSING FILES] Entry {i+1}: {level_id} -> {base_path} or {var_path} does not exist.")
            missing_files_count += 1
            audited_manifest.append(entry)
            continue

        base_bgr = cv2.imread(base_path)
        var_bgr = cv2.imread(var_path)

        if base_bgr is None or var_bgr is None:
            print(f"[UNREADABLE IMAGE] Entry {i+1}: {level_id}")
            audited_manifest.append(entry)
            continue

        h, w = base_bgr.shape[:2]
        vh, vw = var_bgr.shape[:2]

        if (h, w) != (vh, vw):
            var_bgr = cv2.resize(var_bgr, (w, h))

        # 1. Compute Ground-Truth Pixel Difference Map
        diff_rgb = np.max(np.abs(base_bgr.astype(np.int16) - var_bgr.astype(np.int16)), axis=2)
        diff_pts = np.where(diff_rgb > 12)

        if len(diff_pts[0]) == 0:
            print(f"[ZERO DIFFERENCE WARNING] Entry {i+1}: {level_id} ({title}) has no visible pixel delta (>12).")
            audited_manifest.append(entry)
            continue

        # Ground truth centroid & span
        true_cy = float(np.mean(diff_pts[0]))
        true_cx = float(np.mean(diff_pts[1]))
        true_cx_pct = round((true_cx / float(w)) * 100.0, 1)
        true_cy_pct = round((true_cy / float(h)) * 100.0, 1)

        span_x_pct = ((np.max(diff_pts[1]) - np.min(diff_pts[1])) / float(w)) * 100.0
        span_y_pct = ((np.max(diff_pts[0]) - np.min(diff_pts[0])) / float(h)) * 100.0
        true_radius = round(max(4.5, min(8.5, max(span_x_pct, span_y_pct) / 2.0 + 1.2)), 1)

        # Recorded hotspot in manifest
        recorded_diffs = entry.get("diffs", [])
        if recorded_diffs and len(recorded_diffs) > 0:
            rec_x = recorded_diffs[0].get("x", 50.0)
            rec_y = recorded_diffs[0].get("y", 50.0)
            rec_rad = recorded_diffs[0].get("radius", 25.0)

            # Alignment distance in percentage coordinates
            dist_pct = np.sqrt((rec_x - true_cx_pct)**2 + (rec_y - true_cy_pct)**2)

            if dist_pct > 3.0 or abs(rec_rad - true_radius) > 3.0:
                misaligned_count += 1
                print(f"[MISALIGNED] Entry {i+1}: {level_id}")
                print(f"   Recorded: ({rec_x}%, {rec_y}%, r={rec_rad}) -> True: ({true_cx_pct}%, {true_cy_pct}%, r={true_radius}) [Dist: {dist_pct:.2f}%]")
                
                # Correct the diff hotspot
                entry["diffs"] = [{
                    "id": 1,
                    "x": true_cx_pct,
                    "y": true_cy_pct,
                    "radius": true_radius
                }]
                corrections_applied += 1
        else:
            entry["diffs"] = [{
                "id": 1,
                "x": true_cx_pct,
                "y": true_cy_pct,
                "radius": true_radius
            }]
            corrections_applied += 1

        # 2. Check for Duplicate Image Pairs
        # Signature is based on base image content hash + difference centroid & diff pixel hash
        base_hash = compute_image_hash(base_path)
        
        # Sub-region difference fingerprint
        min_y, max_y = np.min(diff_pts[0]), np.max(diff_pts[0])
        min_x, max_x = np.min(diff_pts[1]), np.max(diff_pts[1])
        diff_patch = var_bgr[min_y:max_y+1, min_x:max_x+1]
        diff_hash = hashlib.md5(diff_patch.tobytes()).hexdigest()

        pair_sig = f"{base_hash}_{round(true_cx_pct)}_{round(true_cy_pct)}_{diff_hash[:8]}"

        if pair_sig in pair_signatures:
            original_entry = pair_signatures[pair_sig]
            if pair_sig not in duplicate_groups:
                duplicate_groups[pair_sig] = [original_entry]
            duplicate_groups[pair_sig].append({"id": level_id, "title": title, "index": i + 1})
        else:
            pair_signatures[pair_sig] = {"id": level_id, "title": title, "index": i + 1}

        audited_manifest.append(entry)

    # Save corrected manifest
    if corrections_applied > 0:
        with open(manifest_path, "w") as f:
            json.dump(audited_manifest, f, indent=2)
        print(f"\nSaved {corrections_applied} selector / hit-area coordinate corrections to {manifest_path}!")

    print("\n" + "="*60)
    print("AUDIT SUMMARY:")
    print(f"Total entries analyzed:      {len(manifest)}")
    print(f"Misaligned selectors fixed:  {misaligned_count}")
    print(f"Total Duplicate groups:      {len(duplicate_groups)}")
    print("="*60)

    if len(duplicate_groups) > 0:
        print("\n=== EXACT DUPLICATE PAIRS FOUND ===")
        for sig, group in duplicate_groups.items():
            print(f"\nGroup (Sig: {sig[:16]}):")
            for item in group:
                print(f"  - [Index {item['index']}] ID: {item['id']} | Title: {item['title']}")

if __name__ == "__main__":
    audit_and_correct_manifest()
