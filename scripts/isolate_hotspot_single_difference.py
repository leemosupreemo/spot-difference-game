"""
CIRCULAR HOTSPOT ZERO-DRIFT ISOLATION FOR MULTI-DIFF LEGACY LEVELS
================================================================================
For each level:
1. Reads the recorded ground-truth hotspot (x%, y%, radius%).
2. Generates a smooth circular alpha mask centered strictly on (cx, cy) with radius R.
3. Completely restores 100% of the canvas outside this circle to immutable base_bgr.
4. Saves with PIL JPEG quality=100 and subsampling=0.
================================================================================
"""

import os
import json
import cv2
import numpy as np
from PIL import Image

def isolate_hotspot_single_diff():
    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    target_ids = [
        "hyper_synth_logic_board_002",
        "method1_photo_electronics_001",
        "photo_board_game_001",
        "photo_fishing_tackle_001",
        "photo_bicycle_repair_001",
        "photo_camping_gear_001",
        "photo_sewing_table_001",
        "photo_garden_potting_001",
        "abstract_token_field_001",
        "abstract_mechanical_maze_001"
    ]

    for entry in manifest:
        level_id = entry.get("id", "")
        if level_id not in target_ids:
            continue

        base_rel = entry.get("baseImage", "").lstrip("/")
        var_rel = entry.get("variantImage", "").lstrip("/")

        base_path = os.path.join(os.getcwd(), "public", base_rel) if not base_rel.startswith("public/") else base_rel
        var_path = os.path.join(os.getcwd(), "public", var_rel) if not var_rel.startswith("public/") else var_rel

        if not os.path.exists(base_path) or not os.path.exists(var_path):
            continue

        base_bgr = cv2.imread(base_path)
        var_bgr = cv2.imread(var_path)

        h, w = base_bgr.shape[:2]
        vh, vw = var_bgr.shape[:2]
        if (h, w) != (vh, vw):
            var_bgr = cv2.resize(var_bgr, (w, h))

        rec_diff = entry.get("diffs", [{}])[0]
        rec_cx = int((rec_diff.get("x", 50.0) / 100.0) * w)
        rec_cy = int((rec_diff.get("y", 50.0) / 100.0) * h)
        rec_r = int((rec_diff.get("radius", 6.0) / 100.0) * max(w, h) * 1.15)

        # Create circular blend mask
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.circle(mask, (rec_cx, rec_cy), rec_r, 255, -1)
        feathered = cv2.GaussianBlur(mask.astype(np.float32), (15, 15), 4.0)
        alpha = np.expand_dims(feathered / 255.0, axis=2)

        # Blend strictly inside circle
        isolated_bgr = (var_bgr.astype(np.float32) * alpha + base_bgr.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)

        # Save with PIL Q100
        isolated_rgb = cv2.cvtColor(isolated_bgr, cv2.COLOR_BGR2RGB)
        Image.fromarray(isolated_rgb).save(var_path, "JPEG", quality=100, subsampling=0)
        print(f"Isolated single hotspot on {level_id} at ({rec_cx}, {rec_cy}, r={rec_r})")

    print("\nHotspot isolation completed successfully!")

if __name__ == "__main__":
    isolate_hotspot_single_diff()
