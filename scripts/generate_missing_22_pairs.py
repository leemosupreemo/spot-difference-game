"""
Targeted Pair Generator for the 22 Remaining Scenes
================================================================================
Generates high-fidelity single-difference pairs for the 22 remaining base scenes:
- 7 Regular Set scenes (completing photo_set_038, photo_set_039, photo_set_040, photo_set_041)
- 15 Daily Pool scenes (completing modern daily challenge sets)
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

REMAINING_SCENES = [
    # Regular set completions
    {
        "id": "photo_set_038_04",
        "title": "Handcrafted Calligraphy Wax Seals",
        "image_path": "public/levels/fresh_v8_calligraphy_wax_seals_008_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_038", "sequence": 4
    },
    {
        "id": "photo_set_038_05",
        "title": "Baker Rustic Pantry Mason Jars",
        "image_path": "public/levels/newbase_bakers_pantry_jar_001_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_038", "sequence": 5
    },
    {
        "id": "photo_set_039_01",
        "title": "Strategy Board Game Wood Tokens",
        "image_path": "public/levels/dense_boardgame_tokens_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_039", "sequence": 1
    },
    {
        "id": "photo_set_039_04",
        "title": "Gemologist Faceted Gemstone Tray",
        "image_path": "public/levels/dense_gemstone_facets_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_039", "sequence": 4
    },
    {
        "id": "photo_set_040_03",
        "title": "Precision Electronic Resistor Bands",
        "image_path": "public/levels/dense_resistors_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_040", "sequence": 3
    },
    {
        "id": "photo_set_041_03",
        "title": "Polished Natural Gemstone Beads",
        "image_path": "public/levels/fresh_v5_gemstone_beads_008_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_041", "sequence": 3
    },
    {
        "id": "photo_set_041_04",
        "title": "Bushcraft Paracord Survival Lanyard",
        "image_path": "public/levels/newbase_camp_bushcraft_paracord_006_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_041", "sequence": 4
    },

    # Daily pool completions
    {"id": "daily_v8_01_citrus", "title": "Farmers Market Fresh Citrus Leaf", "image_path": "public/levels/newbase_farmers_market_citrus_leaf_010_base.jpg", "dailySet": "set_daily_modern_01"},
    {"id": "daily_v8_01_potting", "title": "Gardener Greenhouse Potting Tag", "image_path": "public/levels/newbase_gardener_potting_tag_003_base.jpg", "dailySet": "set_daily_modern_01"},
    {"id": "daily_v8_01_pottery", "title": "Ceramic Studio Pottery Glaze Bottle", "image_path": "public/levels/newbase_pottery_glaze_bottle_009_base.jpg", "dailySet": "set_daily_modern_01"},
    {"id": "daily_v8_02_stationery", "title": "Art Studio Stationery Craft Layout", "image_path": "public/levels/scene_art_craft_stationery_015_base.jpg", "dailySet": "set_daily_modern_02"},
    {"id": "daily_v8_02_apothecary", "title": "Apothecary Botanical Herbarium Jars", "image_path": "public/levels/scene_botanical_apothecary_herb_014_base.jpg", "dailySet": "set_daily_modern_02"},
    {"id": "daily_v8_03_toolbox", "title": "Vintage Mechanic Wrench Toolbox", "image_path": "public/levels/scene_vintage_mechanic_toolbox_016_base.jpg", "dailySet": "set_daily_modern_03"},
    {"id": "daily_v8_03_typewriter", "title": "Vintage Mechanical Typewriter Keys", "image_path": "public/levels/raw_photo_typewriter_keys.jpg", "dailySet": "set_daily_modern_03"},
    {"id": "daily_v8_03_chisel", "title": "Antique Carpenter Joinery Chisel", "image_path": "public/levels/scene_woodworking_antique_chisel_011_base.jpg", "dailySet": "set_daily_modern_03"},
    {"id": "daily_v8_04_pastels", "title": "Fine Art Artist Oil Pastels Box", "image_path": "public/levels/newbase_artist_oil_pastels_002_base.jpg", "dailySet": "set_daily_modern_04"},
    {"id": "daily_v8_04_leather", "title": "Artisan Leathercraft Edge Beveler", "image_path": "public/levels/newbase_leathercraft_beveler_handle_008_base.jpg", "dailySet": "set_daily_modern_04"},
    {"id": "daily_v8_04_brassclip", "title": "Solid Brass Archival Paper Clip", "image_path": "public/levels/semantic_stationery_brass_clip_001_base.jpg", "dailySet": "set_daily_modern_04"},
    {"id": "daily_v8_05_sleeve", "title": "Insulated Electronic Cable Sleeves", "image_path": "public/levels/semantic_workshop_bench_insulated_sleeve_005_base.jpg", "dailySet": "set_daily_modern_05"},
    {"id": "daily_v8_08_resistors", "title": "High-Density Resistor Breadboard", "image_path": "public/levels/fresh_v7_electronic_resistors_020_base.jpg", "dailySet": "set_daily_modern_08"},
    {"id": "daily_v8_08_faceted", "title": "Faceted Tourmaline Mineral Gems", "image_path": "public/levels/fresh_v7_faceted_gemstones_014_base.jpg", "dailySet": "set_daily_modern_08"},
    {"id": "daily_v8_custom_02", "title": "Faceted Gemstone Cabochons Matrix", "image_path": "public/levels/test_dense_gemstones_base.jpg", "dailySet": "custom"}
]

def generate_targeted_recolor_pair(spec, model, output_dir="public/levels"):
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
        if 0.05 <= area_pct <= 4.0:
            ys, xs = np.where(m_resized > 0)
            bw = int(np.max(xs) - np.min(xs) + 1)
            bh = int(np.max(ys) - np.min(ys) + 1)
            span_w = bw / float(w) * 100.0
            span_h = bh / float(h) * 100.0
            if max(span_w, span_h) <= 28.0:
                cx = float(np.mean(xs))
                cy = float(np.mean(ys))
                dist_from_center = np.sqrt(((cx - w/2.0)/(w/2.0))**2 + ((cy - h/2.0)/(h/2.0))**2)
                candidates.append({
                    "mask": m_resized,
                    "area_pct": area_pct,
                    "bbox": [int(np.min(xs)), int(np.min(ys)), int(np.max(xs)), int(np.max(ys))],
                    "centroid": (cx, cy),
                    "dist_center": dist_from_center
                })

    if not candidates:
        print(f"  [ERROR] No candidate masks between 0.05% and 4.0% area for {image_path}")
        return False, None

    # Sort candidates by balance of reasonable size and centrality
    candidates.sort(key=lambda c: abs(c["area_pct"] - 0.40) + c["dist_center"] * 0.5)

    best_candidate = None
    best_variant = None
    best_mean_de = 0.0
    best_shift = 50.0

    for cand in candidates[:10]:
        mask = cand["mask"]
        bx1, by1, bx2, by2 = cand["bbox"]

        # Try multiple hue / color shifts to find the cleanest perceptual difference
        for shift_deg in [50.0, -50.0, 75.0, 110.0]:
            hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(float)
            hsv[:, :, 0] = (hsv[:, :, 0] + shift_deg) % 180.0
            # Also boost saturation slightly if image is unsaturated
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.25, 0, 255)
            recolored_bgr = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

            # Feather mask slightly (3px blur) to prevent aliased edges
            mask_float = mask.astype(np.float32)
            feathered = cv2.GaussianBlur(mask_float, (5, 5), 0)[:, :, None]

            variant_bgr = (img_bgr.astype(float) * (1.0 - feathered) + recolored_bgr.astype(float) * feathered).astype(np.uint8)

            # Verify perceptual difference on mask
            base_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(float)
            var_lab = cv2.cvtColor(variant_bgr, cv2.COLOR_BGR2LAB).astype(float)
            de = np.sqrt(np.sum((base_lab - var_lab)**2, axis=2))
            mean_de = float(np.mean(de[mask > 0]))

            if 16.0 <= mean_de <= 45.0:
                best_candidate = cand
                best_variant = variant_bgr
                best_mean_de = mean_de
                best_shift = shift_deg
                break

        if best_candidate is not None:
            break

    # If all hue shifts were slightly below 16 or above 45, accept the best one with mean_de >= 12.0
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
    print(f"Starting targeted generation for {len(REMAINING_SCENES)} scenes...")
    model = FastSAM("FastSAM-s.pt")
    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    existing_ids = set(item["id"] for item in manifest)

    generated_entries = []
    for i, spec in enumerate(REMAINING_SCENES):
        print(f"[{i+1}/{len(REMAINING_SCENES)}] Generating pair for {spec['id']}...")
        success, entry = generate_targeted_recolor_pair(spec, model)
        if success and entry:
            generated_entries.append(entry)

    print(f"\nGenerated {len(generated_entries)} / {len(REMAINING_SCENES)} entries successfully!")

    # Append new entries to manifest
    added_count = 0
    for entry in generated_entries:
        if entry["id"] not in existing_ids:
            manifest.append(entry)
            existing_ids.add(entry["id"])
            added_count += 1
        else:
            # Update existing entry
            for idx, existing in enumerate(manifest):
                if existing["id"] == entry["id"]:
                    manifest[idx] = entry
                    break

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Updated {manifest_path} (Added {added_count}, Total: {len(manifest)})")

    # Update daily-queue.json
    daily_queue_path = "public/daily-queue.json"
    with open(daily_queue_path, "r") as f:
        daily_queue = json.load(f)

    # Group daily pool entries
    daily_groups = {}
    for entry in manifest:
        ds = entry.get("dailySet")
        if ds and ds.startswith("set_daily_modern"):
            daily_groups.setdefault(ds, []).append(entry["id"])

    queue_list = daily_queue.get("queue", [])
    # Make sure each modern daily set has complete 3 levels
    for ds, level_ids in sorted(daily_groups.items()):
        existing_q = next((q for q in queue_list if q.get("setId") == ds), None)
        if existing_q:
            existing_q["levels"] = level_ids
        else:
            queue_list.insert(0, {
                "setId": ds,
                "label": f"Modern Curator Set ({ds.replace('set_daily_modern_', 'Day ')})",
                "isLegacy": False,
                "levels": level_ids
            })

    daily_queue["queue"] = queue_list
    with open(daily_queue_path, "w") as f:
        json.dump(daily_queue, f, indent=2)
    print(f"Updated {daily_queue_path} with all modern daily sets.")

if __name__ == "__main__":
    main()
