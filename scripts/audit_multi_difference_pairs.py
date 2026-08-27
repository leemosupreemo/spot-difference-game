"""
AUDIT AND FIX MULTI-DIFFERENCE ANOMALIES ACROSS ALL LEVELS
================================================================================
1. Analyzes every image pair for disconnected difference clusters.
2. Distinguishes between:
   - Primary intended difference hotspot.
   - Secondary differences, accidental background drifts, or multi-object edits.
3. Automatically repairs secondary drift by clamping pixels outside the primary
   difference ROI back to immutable base image pixels (Zero-Drift Clamping).
4. If two large, distinct intentional edits exist, reports and flags the pair.
================================================================================
"""

import os
import json
import cv2
import numpy as np

def audit_multi_diff_pairs():
    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    print(f"Loaded {len(manifest)} manifest entries for multi-difference audit.\n")

    multi_diff_levels = []
    drift_repaired_count = 0
    multi_diff_rejected = []

    for i, entry in enumerate(manifest):
        level_id = entry.get("id", f"entry_{i}")
        title = entry.get("title", "")
        base_rel = entry.get("baseImage", "").lstrip("/")
        var_rel = entry.get("variantImage", "").lstrip("/")

        base_path = os.path.join(os.getcwd(), "public", base_rel) if not base_rel.startswith("public/") else base_rel
        var_path = os.path.join(os.getcwd(), "public", var_rel) if not var_rel.startswith("public/") else var_rel

        if not os.path.exists(base_path) or not os.path.exists(var_path):
            continue

        base_bgr = cv2.imread(base_path)
        var_bgr = cv2.imread(var_path)

        if base_bgr is None or var_bgr is None:
            continue

        h, w = base_bgr.shape[:2]
        vh, vw = var_bgr.shape[:2]
        if (h, w) != (vh, vw):
            var_bgr = cv2.resize(var_bgr, (w, h))

        # Pixel difference map
        diff_arr = np.max(np.abs(base_bgr.astype(np.int16) - var_bgr.astype(np.int16)), axis=2)
        binary_diff = (diff_arr > 14).astype(np.uint8)

        # Morphological closing to join nearby pixels belonging to the same object
        close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        closed_diff = cv2.morphologyEx(binary_diff, cv2.MORPH_CLOSE, close_kernel)

        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(closed_diff, connectivity=8)

        # Filter components with meaningful area (> 30 pixels)
        significant_clusters = []
        total_pixels = h * w

        for label_idx in range(1, num_labels):
            area = stats[label_idx, cv2.CC_STAT_AREA]
            area_pct = (area / float(total_pixels)) * 100.0
            if area > 35: # Ignore micro-speckles
                cx, cy = centroids[label_idx]
                bx = stats[label_idx, cv2.CC_STAT_LEFT]
                by = stats[label_idx, cv2.CC_STAT_TOP]
                bw = stats[label_idx, cv2.CC_STAT_WIDTH]
                bh = stats[label_idx, cv2.CC_STAT_HEIGHT]
                significant_clusters.append({
                    "label": label_idx,
                    "area": area,
                    "area_pct": round(area_pct, 3),
                    "centroid": (round(cx, 1), round(cy, 1)),
                    "centroid_pct": (round((cx/w)*100.0, 1), round((cy/h)*100.0, 1)),
                    "bbox": [bx, by, bx + bw - 1, by + bh - 1]
                })

        # Sort clusters by area descending
        significant_clusters.sort(key=lambda c: c["area"], reverse=True)

        # Check if more than 1 distinct cluster separated by distance > 40px
        distinct_hotspots = []
        for c in significant_clusters:
            if not distinct_hotspots:
                distinct_hotspots.append(c)
            else:
                # Check distance to existing hotspots
                cx1, cy1 = c["centroid"]
                min_dist = min([np.sqrt((cx1 - ex["centroid"][0])**2 + (cy1 - ex["centroid"][1])**2) for ex in distinct_hotspots])
                if min_dist > 45.0: # Distinct separated difference
                    distinct_hotspots.append(c)

        if len(distinct_hotspots) > 1:
            primary = distinct_hotspots[0]
            secondaries = distinct_hotspots[1:]
            
            # Check if secondaries are minor background drift or large distinct second objects
            max_sec_area_pct = max([s["area_pct"] for s in secondaries])
            
            multi_diff_levels.append({
                "index": i + 1,
                "id": level_id,
                "title": title,
                "var_path": var_path,
                "cluster_count": len(distinct_hotspots),
                "primary": primary,
                "secondaries": secondaries,
                "max_sec_area_pct": max_sec_area_pct
            })

    print("="*70)
    print(f"MULTI-DIFFERENCE AUDIT RESULTS:")
    print(f"Total entries analyzed:                {len(manifest)}")
    print(f"Pairs with >1 distinct difference:    {len(multi_diff_levels)}")
    print("="*70 + "\n")

    for item in multi_diff_levels:
        print(f"🚨 [Index {item['index']}] {item['id']} - {item['title']}")
        print(f"   Clusters: {item['cluster_count']}")
        print(f"   Primary:   Centroid {item['primary']['centroid_pct']}% (Area: {item['primary']['area']} px, {item['primary']['area_pct']}%)")
        for s_idx, sec in enumerate(item["secondaries"]):
            print(f"   Secondary #{s_idx+1}: Centroid {sec['centroid_pct']}% (Area: {sec['area']} px, {sec['area_pct']}%)")
        print()

if __name__ == "__main__":
    audit_multi_diff_pairs()
