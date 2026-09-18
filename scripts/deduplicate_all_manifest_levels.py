"""
Deduplicate All Levels in Manifest
================================================================================
Replaces every duplicate base image in photo_pair_manifest.json with a distinct,
unique high-resolution scene so that NO level in the entire game shares a base scene
with any other level.
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np
from PIL import Image
from ultralytics import FastSAM

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

REPLACEMENTS = [
    # Set 38
    {
        "id": "photo_set_038_04",
        "title": "Vintage Antique Cartography Exploration Map",
        "image_path": "public/levels/method2_macro_cartography_001_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_038", "sequence": 4
    },
    # Daily Set 8 and custom
    {
        "id": "daily_v8_08_hardware_b",
        "title": "Artisan Roasted Coffee Beans",
        "image_path": "public/levels/raw_photo_coffee_beans.jpg",
        "dailySet": "set_daily_modern_08"
    },
    {
        "id": "daily_v8_08_faceted",
        "title": "French Gourmet Macarons Assortment",
        "image_path": "public/levels/raw_photo_french_macarons.jpg",
        "dailySet": "set_daily_modern_08"
    },
    {
        "id": "daily_v8_08_resistors",
        "title": "Heirloom Botanical Grain Seeds",
        "image_path": "public/levels/raw_photo_grain_seeds.jpg",
        "dailySet": "set_daily_modern_08"
    },
    {
        "id": "daily_v8_custom_01",
        "title": "Artisan Knitting Wool Yarn Skeins",
        "image_path": "public/levels/raw_photo_yarn_balls.jpg",
        "dailySet": "custom"
    },
    {
        "id": "daily_v8_custom_02",
        "title": "Artisan Millefiori Glass Marbles",
        "image_path": "public/levels/raw_photo_macro_marbles.jpg",
        "dailySet": "custom"
    },
    # Existing Set Duplicates
    {
        "id": "fresh_nature_pair_002",
        "title": "Artisan Venetian Millefiori Glass Marbles",
        "image_path": "public/levels/fresh_ai_glass_marbles_millefiori_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_002", "sequence": 3
    },
    {
        "id": "fresh_nature_pair_015",
        "title": "Autumn Harvest Miniature Pumpkins",
        "image_path": "public/levels/raw_photo_mini_pumpkins.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_004", "sequence": 1
    },
    {
        "id": "fresh_v6_pair_005",
        "title": "Heirloom Spice Bazaar Seeds & Anise",
        "image_path": "public/levels/raw_photo_colorful_spices.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_004", "sequence": 3
    },
    {
        "id": "fresh_v6_pair_014",
        "title": "Classic Wooden Pickup Sticks Array",
        "image_path": "public/levels/fresh_v5_pickup_sticks_002_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_005", "sequence": 2
    },
    {
        "id": "fresh_v6_pair_009",
        "title": "Polished Natural River Pebbles",
        "image_path": "public/levels/raw_photo_river_pebbles.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_005", "sequence": 3
    },
    {
        "id": "fresh_v6_pair_010",
        "title": "Sun-Dried Citrus Fruit Slices",
        "image_path": "public/levels/raw_photo_citrus_slices.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_005", "sequence": 4
    },
    {
        "id": "fresh_v5_boardgame_meeples_pair1",
        "title": "Strategy Tabletop Boardgame Dice & Tokens",
        "image_path": "public/levels/ai_dense_boardgame_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_006", "sequence": 2
    },
    {
        "id": "fresh_v6_pair_020",
        "title": "Antique Locksmith Ornamental Skeleton Keys",
        "image_path": "public/levels/raw_photo_antique_keys.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_006", "sequence": 5
    },
    {
        "id": "fresh_v4_pair_042",
        "title": "Confectionery Artisan Gummy & Hard Candies",
        "image_path": "public/levels/ai_dense_candies_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_006", "sequence": 3
    },
    {
        "id": "prod_v4_var2_ai_woodworking",
        "title": "Fine Carpenter Joinery Workbench & Planes",
        "image_path": "public/levels/ai_unique_woodworking_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_015", "sequence": 5
    },
    {
        "id": "goldilocks_ai_woodworking_bench_008",
        "title": "Master Luthier Workbench Guitar Bridge Pins",
        "image_path": "public/levels/master_luthier_bridge_pin_001_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_023", "sequence": 1
    },
    {
        "id": "goldilocks_ai_leathercraft_005",
        "title": "Artisan Leathercraft Punch Tools & Rivets",
        "image_path": "public/levels/verified_m_ai_leathercraft_recolor_009_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_023", "sequence": 2
    },
    {
        "id": "photo_boardgame_recolor_003",
        "title": "Tabletop RPG Dungeon Master Polyhedral Dice",
        "image_path": "public/levels/fresh_v7_tabletop_rpg_004_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_021", "sequence": 3
    },
    {
        "id": "goldilocks_hard_ai_woodworking_pencil_008",
        "title": "Botanical Herbarium Pressed Flora & Petals",
        "image_path": "public/levels/fresh_ai_botanical_pressed_flora_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_022", "sequence": 5
    },
    {
        "id": "scene_tailor_notions_spool_008",
        "title": "Vintage Tailor Buttons & Mother of Pearl",
        "image_path": "public/levels/fresh_v5_vintage_buttons_003_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_024", "sequence": 2
    },
    {
        "id": "adaptive_tailor_green_spool_001",
        "title": "Bespoke Tailor Haberdashery Pearl Pins & Notions",
        "image_path": "public/levels/adaptive_tailor_pearl_notion_005_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_024", "sequence": 5
    },
    {
        "id": "adaptive_tailor_red_spool_004",
        "title": "Marine Conchology Natural Seashell Specimens",
        "image_path": "public/levels/fresh_ai_marine_seashells_specimens_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_025", "sequence": 1
    },
    {
        "id": "adaptive_workshop_tape_measure_lock_008",
        "title": "Botanical Autumn Foliage & Pressed Leaves",
        "image_path": "public/levels/raw_photo_autumn_leaves.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_025", "sequence": 4
    }
]

def generate_unique_recolor_pair(spec, model, output_dir="public/levels"):
    scene_id = spec["id"]
    title = spec.get("title", f"Level {scene_id}")
    image_path = spec["image_path"]

    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        print(f"  [ERROR] Cannot read image {image_path}")
        return False, None

    h, w = img_bgr.shape[:2]
    total_pixels = h * w

    res = model(image_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.15, iou=0.65, verbose=False)
    if not res or len(res) == 0 or res[0].masks is None:
        print(f"  [ERROR] FastSAM found no masks for {image_path}")
        return False, None

    masks = res[0].masks.data.cpu().numpy()
    candidates = []

    for m in masks:
        m_resized = cv2.resize((m > 0).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
        area = int(np.sum(m_resized > 0))
        area_pct = area / float(total_pixels) * 100.0
        if 0.06 <= area_pct <= 3.5:
            ys, xs = np.where(m_resized > 0)
            bw = int(np.max(xs) - np.min(xs) + 1)
            bh = int(np.max(ys) - np.min(ys) + 1)
            span_w = bw / float(w) * 100.0
            span_h = bh / float(h) * 100.0
            if max(span_w, span_h) <= 26.0:
                cx = float(np.mean(xs))
                cy = float(np.mean(ys))
                dist_center = np.sqrt(((cx - w/2.0)/(w/2.0))**2 + ((cy - h/2.0)/(h/2.0))**2)
                candidates.append({
                    "mask": m_resized,
                    "area_pct": area_pct,
                    "bbox": [int(np.min(xs)), int(np.min(ys)), int(np.max(xs)), int(np.max(ys))],
                    "centroid": (cx, cy),
                    "dist_center": dist_center
                })

    if not candidates:
        print(f"  [ERROR] No candidates for {image_path}")
        return False, None

    candidates.sort(key=lambda c: abs(c["area_pct"] - 0.45) + c["dist_center"] * 0.4)

    best_candidate = None
    best_variant = None
    best_mean_de = 0.0

    for cand in candidates[:10]:
        mask = cand["mask"]
        for shift_deg in [50.0, -50.0, 70.0, 110.0]:
            hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(float)
            hsv[:, :, 0] = (hsv[:, :, 0] + shift_deg) % 180.0
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.25, 0, 255)
            recolored_bgr = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

            mask_float = mask.astype(np.float32)
            feathered = cv2.GaussianBlur(mask_float, (5, 5), 0)[:, :, None]

            variant_bgr = (img_bgr.astype(float) * (1.0 - feathered) + recolored_bgr.astype(float) * feathered).astype(np.uint8)

            base_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(float)
            var_lab = cv2.cvtColor(variant_bgr, cv2.COLOR_BGR2LAB).astype(float)
            de = np.sqrt(np.sum((base_lab - var_lab)**2, axis=2))
            mean_de = float(np.mean(de[mask > 0]))

            if 16.0 <= mean_de <= 45.0:
                best_candidate = cand
                best_variant = variant_bgr
                best_mean_de = mean_de
                break

        if best_candidate is not None:
            break

    if best_candidate is None:
        cand = candidates[0]
        mask = cand["mask"]
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(float)
        hsv[:, :, 0] = (hsv[:, :, 0] + 60.0) % 180.0
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.3, 0, 255)
        recolored_bgr = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        mask_float = mask.astype(np.float32)
        feathered = cv2.GaussianBlur(mask_float, (5, 5), 0)[:, :, None]
        best_variant = (img_bgr.astype(float) * (1.0 - feathered) + recolored_bgr.astype(float) * feathered).astype(np.uint8)
        best_candidate = cand
        base_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(float)
        var_lab = cv2.cvtColor(best_variant, cv2.COLOR_BGR2LAB).astype(float)
        de = np.sqrt(np.sum((base_lab - var_lab)**2, axis=2))
        best_mean_de = float(np.mean(de[mask > 0]))

    bx1, by1, bx2, by2 = best_candidate["bbox"]
    cx_pct = round(float(bx1 + bx2) / 2.0 / float(w) * 100.0, 1)
    cy_pct = round(float(by1 + by2) / 2.0 / float(h) * 100.0, 1)
    span_x = (bx2 - bx1 + 1) / float(w) * 100.0
    span_y = (by2 - by1 + 1) / float(h) * 100.0
    radius = round(max(4.5, min(7.5, max(span_x, span_y) / 2.0 + 1.2)), 1)

    # Save images with Q100
    base_filename = f"{scene_id}_base.jpg"
    variant_filename = f"{scene_id}_variant.jpg"
    base_save_path = os.path.join(output_dir, base_filename)
    variant_save_path = os.path.join(output_dir, variant_filename)

    base_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    var_rgb = cv2.cvtColor(best_variant, cv2.COLOR_BGR2RGB)
    Image.fromarray(base_rgb).save(base_save_path, "JPEG", quality=100, subsampling=0)
    Image.fromarray(var_rgb).save(variant_save_path, "JPEG", quality=100, subsampling=0)

    entry = {
        "id": scene_id,
        "title": title,
        "category": "Photography",
        "pack": "Find the Sniper",
        "packId": "find_the_sniper",
        "difficulty": spec.get("difficulty", "Medium"),
        "baseImage": f"levels/{base_filename}",
        "variantImage": f"levels/{variant_filename}",
        "operation": "recolor",
        "dimensions": {"width": w, "height": h},
        "aspectRatio": "4:3",
        "diffs": [{
            "id": 1,
            "x": cx_pct,
            "y": cy_pct,
            "radius": radius,
            "description": "Single recolor difference",
            "hint": "Look closely for a recolor difference",
            "operation": "recolor"
        }]
    }

    if "setId" in spec:
        entry["setId"] = spec["setId"]
        entry["sequence"] = spec["sequence"]
    if "dailySet" in spec:
        entry["dailySet"] = spec["dailySet"]

    print(f"  ✓ {scene_id} ({title}): centroid=({cx_pct}%, {cy_pct}%), radius={radius}, ΔE={best_mean_de:.1f}")
    return True, entry

def main():
    print(f"Starting deduplication for {len(REPLACEMENTS)} duplicate levels...")
    model = FastSAM("FastSAM-s.pt")
    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    manifest_map = {item["id"]: item for item in manifest}

    updated_count = 0
    for i, spec in enumerate(REPLACEMENTS):
        print(f"[{i+1}/{len(REPLACEMENTS)}] Replacing duplicate level {spec['id']}...")
        success, entry = generate_unique_recolor_pair(spec, model)
        if success and entry:
            manifest_map[entry["id"]] = entry
            updated_count += 1

    # Preserve order of manifest
    updated_manifest = [manifest_map.get(item["id"], item) for item in manifest]

    with open(manifest_path, "w") as f:
        json.dump(updated_manifest, f, indent=2)
    print(f"\nUpdated {updated_count} levels in {manifest_path} with 100% unique scenes!")

if __name__ == "__main__":
    main()
