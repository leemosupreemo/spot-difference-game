"""
GENERATE 20 PRISTINE NEW IMAGE PAIRS WITH UPGRADED PIPELINE
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from unified_operation_pipeline import generate_single_scene_difference, OperationScheduler

HIGH_QUALITY_CANVASES = [
    {"id": "v6_buttons", "title": "Antique Mother of Pearl & Bakelite Buttons", "path": "public/levels/fresh_v5_vintage_buttons_003_base.jpg"},
    {"id": "v6_meeples", "title": "Wooden Meeples & Polyhedral RPG Dice", "path": "public/levels/fresh_v5_boardgame_meeples_006_base.jpg"},
    {"id": "v6_pasta", "title": "Italian Tricolor Dry Pasta on Slate", "path": "public/levels/fresh_v5_dry_pasta_007_base.jpg"},
    {"id": "v6_keys", "title": "Intricate Antique Skeleton Keys on Leather", "path": "public/levels/fresh_v5_antique_keys_009_base.jpg"},
    {"id": "v6_gummies", "title": "Sugar Dusted Fruit Gummy Drops on Slate", "path": "public/levels/fresh_v5_gummy_candies_010_base.jpg"},
    {"id": "v6_beads", "title": "Jewelry Maker Gemstone Beads & Findings", "path": "public/levels/fresh_v5_gemstone_beads_008_base.jpg"},
    {"id": "v6_pencils", "title": "Rainbow Colored Pencils & Wood Shavings", "path": "public/levels/fresh_v5_colored_pencils_005_base.jpg"},
    {"id": "v6_sewing", "title": "Silk Thread Spools & Safety Pins", "path": "public/levels/fresh_v5_sewing_notions_004_base.jpg"},
    {"id": "v6_paperclips", "title": "Spilled Paperclips on Concrete", "path": "public/levels/fresh_v5_paper_clips_001_base.jpg"},
    {"id": "v6_sticks", "title": "Tangled Pick Up Sticks on Green Felt", "path": "public/levels/fresh_v5_pickup_sticks_002_base.jpg"},
    {"id": "v6_mosaic", "title": "Ceramic Mosaic Tiles Array", "path": "public/levels/fresh_v2_ai_ceramic_mosaic_tiles_002_base.jpg"},
    {"id": "v6_espresso", "title": "Espresso Portafilter & Coffee Gear", "path": "public/levels/master_espresso_portafilter_basket_001_base.jpg"},
    {"id": "v6_leather", "title": "Handcrafted Leathercraft Workshop", "path": "public/levels/method1_photo_leathercraft_001_base.jpg"},
    {"id": "v6_spices", "title": "Heirloom Spice Bazaar Botanical Seeds", "path": "public/levels/fresh_ai_heirloom_spices_botanical_base.jpg"},
    {"id": "v6_succulents", "title": "Botanical Succulents Greenhouse Grid", "path": "public/levels/fresh_ai_succulents_greenhouse_grid_005_base.jpg"},
    {"id": "v6_marine", "title": "Marine Seashells & Coral Specimen", "path": "public/levels/fresh_ai_marine_seashells_specimens_base.jpg"},
    {"id": "v6_truffles", "title": "Gourmet Confectionery Truffles", "path": "public/levels/fresh_ai_confectionery_truffles_001_base.jpg"},
    {"id": "v6_pins", "title": "Collector Enamel Pins Display", "path": "public/levels/photo_enamel_pins_calibrated_008_base.jpg"},
]

def main():
    print("================================================================================")
    print("🚀 GENERATING 20 NEW VERIFIED IMAGE PAIRS (MULTI-OP ENGINE)")
    print("================================================================================")

    scheduler = OperationScheduler()
    accepted = []
    used_targets_by_canvas = {}

    for sc in HIGH_QUALITY_CANVASES:
        if len(accepted) >= 20:
            break

        if not os.path.exists(sc["path"]):
            continue

        used_targets_by_canvas[sc["path"]] = []
        print(f"\n--- Processing Canvas [{sc['id']}] ({sc['title']}) ---")

        # Try up to 2 operations per canvas
        for op in ["remove", "add", "reorder", "recolor"]:
            if len(accepted) >= 20:
                break

            pair_id = f"fresh_v6_pair_{len(accepted)+1:03d}"
            spec = {
                "id": pair_id,
                "title": f"{sc['title']} (Pair {len(accepted)+1})",
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
                    print(f"  ✅ ACCEPTED: {pair_id} | Op={result['operation']} | GT=({cx}%, {cy}%, r={gt['radius']}%)")
                    accepted.append(result)
                    used_targets_by_canvas[sc["path"]].append((cx, cy))
                    if len(used_targets_by_canvas[sc["path"]]) >= 2:
                        break
            else:
                print(f"  ❌ Op {op} rejected: {log_entry.get('rejection_reason')}")

    print("\n================================================================================")
    print(f"Total Accepted Pairs Generated: {len(accepted)}/20")
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

        print(f"🎉 Prepend-saved {len(accepted)} pairs to top of manifest. Total levels: {len(manifest)}")

if __name__ == "__main__":
    main()
