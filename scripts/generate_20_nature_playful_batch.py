"""
GENERATE 20 OUTDOOR, NATURE & PLAYFUL IMAGE PAIRS
================================================================================
Uses the upgraded BackgroundReconstructionRouter, tightened RemovalNaturalnessCritic,
and multi-operation pipeline across nature, outdoor, and playful scenes.
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))

from unified_operation_pipeline import generate_single_scene_difference, OperationScheduler

NATURE_PLAYFUL_CANVASES = [
    {"id": "nat_beachcomber", "title": "Beachcomber Tidepool Finds", "path": "public/levels/fresh_v6_beachcomber_base.jpg"},
    {"id": "nat_gemstones", "title": "Polished Gemstone Cabochons on Basalt", "path": "public/levels/fresh_v6_gemstones_basalt_base.jpg"},
    {"id": "nat_mushrooms", "title": "Wild Forest Mushrooms & Acorns", "path": "public/levels/fresh_v3_ai_wild_mushrooms_009_base.jpg"},
    {"id": "nat_seashells", "title": "Marine Seashells & Coral Specimen", "path": "public/levels/fresh_ai_marine_seashells_specimens_base.jpg"},
    {"id": "nat_succulents", "title": "Botanical Succulents Greenhouse Grid", "path": "public/levels/fresh_ai_succulents_greenhouse_grid_005_base.jpg"},
    {"id": "nat_spices", "title": "Heirloom Spice Bazaar Botanical Seeds", "path": "public/levels/fresh_ai_heirloom_spices_botanical_base.jpg"},
    {"id": "nat_geodes", "title": "Nature Geodes & Agate Slices", "path": "public/levels/fresh_v3_ai_minerals_geodes_agate_base.jpg"},
    {"id": "nat_wood_toys", "title": "Playful Hand-Carved Wooden Animal Toys", "path": "public/levels/fresh_ai_wooden_toy_figurines_base.jpg"},
    {"id": "nat_camp_craft", "title": "Camp Bushcraft Paracord Tools", "path": "public/levels/newbase_camp_bushcraft_paracord_006_base.jpg"},
    {"id": "nat_gardening", "title": "Outdoor Garden Seedlings & Plant Tags", "path": "public/levels/photo_unique_gardening_004_base.jpg"},
    {"id": "nat_gummies", "title": "Playful Sugar Dusted Fruit Gummy Candies", "path": "public/levels/fresh_v5_gummy_candies_010_base.jpg"},
    {"id": "nat_pasta", "title": "Playful Italian Tricolor Dry Pasta", "path": "public/levels/fresh_v5_dry_pasta_007_base.jpg"},
    {"id": "nat_pencils", "title": "Outdoor Sketch Colored Pencils & Shavings", "path": "public/levels/fresh_v5_colored_pencils_005_base.jpg"},
    {"id": "nat_paperclips", "title": "Playful Spilled Paperclips on Concrete", "path": "public/levels/fresh_v5_paper_clips_001_base.jpg"},
    {"id": "nat_sticks", "title": "Playful Tangled Pick Up Sticks on Felt", "path": "public/levels/fresh_v5_pickup_sticks_002_base.jpg"},
    {"id": "nat_marbles", "title": "Playful Millefiori Glass Marbles", "path": "public/levels/fresh_v2_ai_glass_marbles_millefiori_004_base.jpg"},
    {"id": "nat_stained_glass", "title": "Playful Stained Glass Jewel Array", "path": "public/levels/fresh_v2_ai_stained_glass_jewels_008_base.jpg"},
    {"id": "nat_beads", "title": "Jewelry Maker Gemstone Beads & Findings", "path": "public/levels/fresh_v5_gemstone_beads_008_base.jpg"},
    {"id": "nat_truffles", "title": "Artisanal Confectionery Truffles", "path": "public/levels/fresh_ai_confectionery_truffles_001_base.jpg"}
]

def clamp_variant_strictly(base_path, var_path, cx_pct, cy_pct, radius_pct):
    base_img = Image.open(base_path).convert("RGB")
    var_img = Image.open(var_path).convert("RGB")
    base_arr = np.array(base_img)
    var_arr = np.array(var_img)
    h, w = base_arr.shape[:2]
    cx = int((cx_pct / 100.0) * w)
    cy = int((cy_pct / 100.0) * h)
    r_px = int(max(w, h) * (radius_pct / 100.0) * 1.15)
    Y, X = np.ogrid[:h, :w]
    keep = ((X - cx)**2 + (Y - cy)**2) <= (r_px**2)
    clamped = np.where(np.expand_dims(keep, 2), var_arr, base_arr)
    Image.fromarray(clamped).save(var_path, quality=100, subsampling=0)

def main():
    print("================================================================================")
    print("🌿 GENERATING 20 NATURE, OUTDOOR & PLAYFUL IMAGE PAIRS")
    print("================================================================================")

    scheduler = OperationScheduler()
    accepted = []
    used_targets_by_canvas = {}

    for sc in NATURE_PLAYFUL_CANVASES:
        if len(accepted) >= 20:
            break

        if not os.path.exists(sc["path"]):
            continue

        used_targets_by_canvas[sc["path"]] = []
        print(f"\n--- Processing Nature Canvas [{sc['id']}] ({sc['title']}) ---")

        # Try multiple operations per canvas
        for op in ["remove", "add", "reorder", "recolor"]:
            if len(accepted) >= 20:
                break

            pair_id = f"fresh_nature_pair_{len(accepted)+1:03d}"
            spec = {
                "id": pair_id,
                "title": f"{sc['title']} (Nature {len(accepted)+1})",
                "image_path": sc["path"],
                "category": "Photography",
                "packId": "find_the_sniper",
                "preferred_op": op
            }

            success, result, log_entry = generate_single_scene_difference(spec, scheduler=scheduler, difficulty="Medium")

            if success and result:
                gt = result["diffs"][0]
                cx, cy = gt["x"], gt["y"]

                # Ensure spatial uniqueness if multiple diffs on same canvas
                too_close = False
                for ux, uy in used_targets_by_canvas[sc["path"]]:
                    if ((cx - ux)**2 + (cy - uy)**2)**0.5 < 12.0:
                        too_close = True
                        break

                if not too_close:
                    # Enforce strict lossless zero-drift clamp
                    base_p = os.path.join("public/levels", f"{pair_id}_base.jpg")
                    var_p = os.path.join("public/levels", f"{pair_id}_variant.jpg")
                    clamp_variant_strictly(base_p, var_p, cx, cy, gt["radius"])

                    print(f"  ✅ ACCEPTED: {pair_id} | Op={result['operation']} | GT=({cx}%, {cy}%, r={gt['radius']}%)")
                    accepted.append(result)
                    used_targets_by_canvas[sc["path"]].append((cx, cy))
                    if len(used_targets_by_canvas[sc["path"]]) >= 2:
                        break
            else:
                print(f"  ❌ Op {op} rejected: {log_entry.get('rejection_reason')}")

    print("\n================================================================================")
    print(f"Total Accepted Nature Pairs: {len(accepted)}/20")
    print(f"Operation Mix Breakdown: {dict(scheduler.accepted_counts)}")
    print("================================================================================")

    if accepted:
        manifest_path = "public/levels/photo_pair_manifest.json"
        with open(manifest_path, "r") as f:
            manifest = json.load(f)

        new_ids = {a["id"] for a in accepted}
        manifest = [m for m in manifest if m["id"] not in new_ids]
        manifest = accepted + manifest

        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        print(f"🎉 Prepend-saved {len(accepted)} nature pairs to top of manifest. Total levels: {len(manifest)}")

if __name__ == "__main__":
    main()
