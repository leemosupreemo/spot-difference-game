import json
import cv2
import numpy as np
import os

with open("public/levels/photo_pair_manifest.json") as f:
    manifest = json.load(f)

tight_or_offset_levels = []
updated_manifest = []

for idx, entry in enumerate(manifest):
    level_id = entry.get("id", "")
    base_rel = entry.get("baseImage", "").lstrip("/")
    var_rel = entry.get("variantImage", "").lstrip("/")

    base_path = os.path.join(os.getcwd(), "public", base_rel) if not base_rel.startswith("public/") else base_rel
    var_path = os.path.join(os.getcwd(), "public", var_rel) if not var_rel.startswith("public/") else var_rel

    if not os.path.exists(base_path) or not os.path.exists(var_path):
        updated_manifest.append(entry)
        continue

    base = cv2.imread(base_path)
    var = cv2.imread(var_path)
    if base is None or var is None:
        updated_manifest.append(entry)
        continue

    h, w = base.shape[:2]
    vh, vw = var.shape[:2]
    if (h, w) != (vh, vw):
        var = cv2.resize(var, (w, h))

    diff = np.max(np.abs(base.astype(int) - var.astype(int)), axis=2)
    pts = np.where(diff > 12)
    if len(pts[0]) == 0:
        updated_manifest.append(entry)
        continue

    min_y, max_y = np.min(pts[0]), np.max(pts[0])
    min_x, max_x = np.min(pts[1]), np.max(pts[1])
    true_cx = float(np.mean(pts[1])) / w * 100.0
    true_cy = float(np.mean(pts[0])) / h * 100.0
    
    span_x = float(max_x - min_x) / w * 100.0
    span_y = float(max_y - min_y) / h * 100.0
    required_radius = max(span_x, span_y) / 2.0 + 2.0
    generous_radius = round(max(5.0, min(16.0, required_radius)), 1)
    true_cx_pct = round(true_cx, 1)
    true_cy_pct = round(true_cy, 1)

    rec_diff = entry.get("diffs", [{}])[0]
    rec_x = rec_diff.get("x", 50.0)
    rec_y = rec_diff.get("y", 50.0)
    rec_r = rec_diff.get("radius", 6.0)

    dist = np.sqrt((rec_x - true_cx_pct)**2 + (rec_y - true_cy_pct)**2)

    if rec_r < generous_radius or dist > 1.0:
        tight_or_offset_levels.append({
            "id": level_id,
            "title": entry.get("title", ""),
            "old_x": rec_x,
            "old_y": rec_y,
            "old_r": rec_r,
            "new_x": true_cx_pct,
            "new_y": true_cy_pct,
            "new_r": generous_radius,
            "dist": round(dist, 2)
        })
        entry["diffs"] = [{
            "id": 1,
            "x": true_cx_pct,
            "y": true_cy_pct,
            "radius": generous_radius
        }]

    updated_manifest.append(entry)

with open("public/levels/photo_pair_manifest.json", "w") as f:
    json.dump(updated_manifest, f, indent=2)

print(f"Calibrated {len(tight_or_offset_levels)} levels with generous bounding radii and exact centroids:")
for item in tight_or_offset_levels:
    print(f"- [{item['id']}] ({item['title']}): ({item['old_x']}%, {item['old_y']}%, r={item['old_r']}) -> ({item['new_x']}%, {item['new_y']}%, r={item['new_r']}) [Dist: {item['dist']}%]")
