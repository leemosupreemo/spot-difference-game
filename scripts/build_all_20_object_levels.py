"""
BUILD ALL 20 UNIQUE OBJECT-ONLY DIFFERENCE PAIRS (EXACTLY 2 PER BASE SCENE)
================================================================================
Strictly NO recoloring. Only object changes (remove, add, reorder, swap).
Produces 2 verified, non-overlapping difference pairs for each of the 10 scenes.
================================================================================
"""

import os
import sys
import json
import shutil
import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))

from perceptual_verification_engine import PerceptualVerificationEngine

ARTIFACT_DIR = "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49"
OUTPUT_DIR = "public/levels"

SCENE_SPECS = [
    {
        "art_file": "paper_clips_spilt_floor_1787877795005.jpg",
        "scene_name": "paper_clips",
        "title": "Spilled Paperclips on Concrete",
        "base_file": "fresh_v5_paper_clips_001_base.jpg"
    },
    {
        "art_file": "pickup_sticks_game_1787877807622.jpg",
        "scene_name": "pickup_sticks",
        "title": "Tangled Pick Up Sticks on Green Felt",
        "base_file": "fresh_v5_pickup_sticks_002_base.jpg"
    },
    {
        "art_file": "vintage_buttons_tin_1787877820735.jpg",
        "scene_name": "vintage_buttons",
        "title": "Antique Mother of Pearl & Bakelite Buttons",
        "base_file": "fresh_v5_vintage_buttons_003_base.jpg"
    },
    {
        "art_file": "assorted_sewing_threads_pins_1787877834306.jpg",
        "scene_name": "sewing_notions",
        "title": "Silk Thread Spools & Safety Pins",
        "base_file": "fresh_v5_sewing_notions_004_base.jpg"
    },
    {
        "art_file": "colored_pencils_shavings_1787877850658.jpg",
        "scene_name": "colored_pencils",
        "title": "Rainbow Colored Pencils & Wood Shavings",
        "base_file": "fresh_v5_colored_pencils_005_base.jpg"
    },
    {
        "art_file": "boardgame_dice_meeples_1787877873320.jpg",
        "scene_name": "boardgame_meeples",
        "title": "Wooden Meeples & Polyhedral RPG Dice",
        "base_file": "fresh_v5_boardgame_meeples_006_base.jpg"
    },
    {
        "art_file": "dry_pasta_varieties_1787877887709.jpg",
        "scene_name": "dry_pasta",
        "title": "Italian Tricolor Dry Pasta on Slate",
        "base_file": "fresh_v5_dry_pasta_007_base.jpg"
    },
    {
        "art_file": "gemstone_beads_wire_1787877903078.jpg",
        "scene_name": "gemstone_beads",
        "title": "Jewelry Maker Gemstone Beads & Findings",
        "base_file": "fresh_v5_gemstone_beads_008_base.jpg"
    },
    {
        "art_file": "antique_keys_tags_1787877919132.jpg",
        "scene_name": "antique_keys",
        "title": "Intricate Antique Skeleton Keys on Leather",
        "base_file": "fresh_v5_antique_keys_009_base.jpg"
    },
    {
        "art_file": "confectionery_gummy_drops_1787877935174.jpg",
        "scene_name": "gummy_candies",
        "title": "Sugar Dusted Fruit Gummy Drops on Slate",
        "base_file": "fresh_v5_gummy_candies_010_base.jpg"
    }
]

def create_object_level(base_img, mutate_fn, level_id, title, desc, operation):
    h, w = base_img.shape[:2]
    var_img, bbox = mutate_fn(base_img.copy())
    if var_img is None or bbox is None:
        return None

    # Calculate centroid & generous hit radius
    bx1, by1, bx2, by2 = bbox
    cx = round((bx1 + bx2) / 2.0 / w * 100.0, 1)
    cy = round((by1 + by2) / 2.0 / h * 100.0, 1)
    span_x = (bx2 - bx1 + 1) / float(w) * 100.0
    span_y = (by2 - by1 + 1) / float(h) * 100.0
    radius = round(max(4.8, min(8.5, max(span_x, span_y) / 2.0 + 1.5)), 1)

    # QA Verification
    passed, metrics, reason, code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
        base_img, var_img, bbox, operation=operation, difficulty="Medium"
    )
    if not passed:
        print(f"  ❌ QA Reject {level_id}: {reason}")
        return None

    # Save images with Q100
    base_save = os.path.join(OUTPUT_DIR, f"{level_id}_base.jpg")
    var_save = os.path.join(OUTPUT_DIR, f"{level_id}_variant.jpg")

    Image.fromarray(cv2.cvtColor(base_img, cv2.COLOR_BGR2RGB)).save(base_save, "JPEG", quality=100, subsampling=0)
    Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(var_save, "JPEG", quality=100, subsampling=0)

    manifest_entry = {
        "id": level_id,
        "title": title,
        "baseImage": f"levels/{level_id}_base.jpg",
        "variantImage": f"levels/{level_id}_variant.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "pack": "Find the Sniper",
        "difficulty": "Medium",
        "operation": operation,
        "diffs": [{
            "id": 1,
            "x": cx,
            "y": cy,
            "radius": radius,
            "description": desc,
            "operation": operation
        }]
    }
    print(f"  ✅ ACCEPTED {level_id}: Op={operation} | GT=({cx}%, {cy}%, r={radius}%)")
    return manifest_entry

def main():
    print("================================================================================")
    print("🚀 GENERATING EXACTLY 20 OBJECT-CHANGE-ONLY DIFFERENCE PAIRS (2 PER SCENE)")
    print("================================================================================")

    from ultralytics import FastSAM
    model = FastSAM("FastSAM-s.pt")

    all_levels = []

    for sc in SCENE_SPECS:
        src = os.path.join(ARTIFACT_DIR, sc["art_file"])
        dest = os.path.join(OUTPUT_DIR, sc["base_file"])
        if os.path.exists(src):
            shutil.copyfile(src, dest)

        img = cv2.imread(dest)
        h, w = img.shape[:2]

        print(f"\n--- Processing [{sc['scene_name']}] ({sc['title']}) ---")

        # FastSAM masks
        res = model(dest, device="cpu", retina_masks=True, imgsz=1024, conf=0.3, iou=0.85)
        raw_masks = res[0].masks.data.cpu().numpy().astype(bool)

        # Sort masks by size
        valid_masks = []
        for m in raw_masks:
            area_pct = np.sum(m) / (h * w) * 100.0
            if 0.10 <= area_pct <= 2.2:
                ys, xs = np.where(m)
                valid_masks.append({
                    "mask": m,
                    "bbox": (int(np.min(xs)), int(np.min(ys)), int(np.max(xs)), int(np.max(ys))),
                    "cx": float(np.mean(xs)),
                    "cy": float(np.mean(ys)),
                    "area_pct": area_pct
                })

        # Pair 1: Top-Left / Left Region Object Change
        left_cands = [c for c in valid_masks if c["cx"] < w * 0.48]
        right_cands = [c for c in valid_masks if c["cx"] > w * 0.52]

        # 1. Generate Pair 1
        pair1 = None
        for cand in left_cands:
            bx1, by1, bx2, by2 = cand["bbox"]
            bw, bh = bx2 - bx1 + 1, by2 - by1 + 1
            if bw > 150 or bh > 150: continue

            # Inpaint / removal with clean background synthesis
            mask_u8 = (cand["mask"] * 255).astype(np.uint8)
            var_img = cv2.inpaint(img, mask_u8, 5, cv2.INPAINT_TELEA)

            # Check zero drift outside bounding box
            pad = 10
            x1, y1 = max(0, bx1 - pad), max(0, by1 - pad)
            x2, y2 = min(w, bx2 + pad), min(h, by2 + pad)
            clamped = img.copy()
            clamped[y1:y2, x1:x2] = var_img[y1:y2, x1:x2]

            level_id = f"fresh_v5_{sc['scene_name']}_pair1"
            pair1 = create_object_level(
                img,
                lambda b: (clamped, (bx1, by1, bx2, by2)),
                level_id,
                f"{sc['title']} (Pair 1)",
                "Object removed from scene",
                "remove"
            )
            if pair1:
                all_levels.append(pair1)
                break

        # 2. Generate Pair 2 (Right region)
        pair2 = None
        for cand in right_cands:
            bx1, by1, bx2, by2 = cand["bbox"]
            bw, bh = bx2 - bx1 + 1, by2 - by1 + 1
            if bw > 150 or bh > 150: continue

            mask_u8 = (cand["mask"] * 255).astype(np.uint8)
            var_img = cv2.inpaint(img, mask_u8, 5, cv2.INPAINT_TELEA)

            pad = 10
            x1, y1 = max(0, bx1 - pad), max(0, by1 - pad)
            x2, y2 = min(w, bx2 + pad), min(h, by2 + pad)
            clamped = img.copy()
            clamped[y1:y2, x1:x2] = var_img[y1:y2, x1:x2]

            level_id = f"fresh_v5_{sc['scene_name']}_pair2"
            pair2 = create_object_level(
                img,
                lambda b: (clamped, (bx1, by1, bx2, by2)),
                level_id,
                f"{sc['title']} (Pair 2)",
                "Object removed from scene",
                "remove"
            )
            if pair2:
                all_levels.append(pair2)
                break

    print(f"\n================================================================================")
    print(f"Total verified object-change pairs generated: {len(all_levels)}/20")
    print("================================================================================")

    if all_levels:
        manifest_path = "public/levels/photo_pair_manifest.json"
        with open(manifest_path, "r") as f:
            manifest = json.load(f)

        new_ids = {a["id"] for a in all_levels}
        manifest = [m for m in manifest if m["id"] not in new_ids]
        manifest = all_levels + manifest

        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        print(f"🎉 Saved {len(all_levels)} verified object pairs to top of manifest. Total manifest levels: {len(manifest)}")

if __name__ == "__main__":
    main()
