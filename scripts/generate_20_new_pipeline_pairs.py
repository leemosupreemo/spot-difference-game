"""
GENERATE 20 NEW IMAGE PAIRS WITH UPGRADED RECONSTRUCTION ROUTER & QA CRITIC
================================================================================
Uses the newly implemented BackgroundReconstructionRouter, tightened
RemovalNaturalnessCritic, updated ReorderTargetSelector, and balanced multi-op
scheduler to generate 20 pristine, single-difference pairs.
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from unified_operation_pipeline import generate_single_scene_difference, OperationScheduler

CANDIDATE_BASE_SCENES = [
    {"id": "v6_pair_001", "title": "Watchmaker Precision Escapements", "path": "public/levels/method2_macro_watch_escapement_001_base.jpg"},
    {"id": "v6_pair_002", "title": "Handcrafted Leathercraft Workshop", "path": "public/levels/method1_photo_leathercraft_001_base.jpg"},
    {"id": "v6_pair_003", "title": "Ceramic Mosaic Tiles Array", "path": "public/levels/fresh_v2_ai_ceramic_mosaic_tiles_002_base.jpg"},
    {"id": "v6_pair_004", "title": "Espresso Portafilter & Coffee Gear", "path": "public/levels/master_espresso_portafilter_basket_001_base.jpg"},
    {"id": "v6_pair_005", "title": "Heirloom Spice Bazaar Seeds", "path": "public/levels/fresh_ai_heirloom_spices_botanical_base.jpg"},
    {"id": "v6_pair_006", "title": "Stained Glass Jewels Flatlay", "path": "public/levels/fresh_v2_ai_stained_glass_jewels_008_base.jpg"},
    {"id": "v6_pair_007", "title": "Collector Enamel Pins Display", "path": "public/levels/photo_enamel_pins_calibrated_008_base.jpg"},
    {"id": "v6_pair_008", "title": "Artist Studio Oil Pastels", "path": "public/levels/newbase_artist_oil_pastels_002_base.jpg"},
    {"id": "v6_pair_009", "title": "Machinist Metal Components", "path": "public/levels/hyper_dense_machinist_parts_004_base.jpg"},
    {"id": "v6_pair_010", "title": "Botanical Succulents Greenhouse Grid", "path": "public/levels/fresh_ai_succulents_greenhouse_grid_005_base.jpg"},
    {"id": "v6_pair_011", "title": "Camp Bushcraft Paracord Tools", "path": "public/levels/newbase_camp_bushcraft_paracord_006_base.jpg"},
    {"id": "v6_pair_012", "title": "Woodworking Antique Chisels", "path": "public/levels/scene_woodworking_antique_chisel_011_base.jpg"},
    {"id": "v6_pair_013", "title": "Calligraphy Wax Seal Beads", "path": "public/levels/newbase_calligraphy_wax_bead_007_base.jpg"},
    {"id": "v6_pair_014", "title": "Pottery Ceramic Glaze Jars", "path": "public/levels/newbase_pottery_glaze_bottle_009_base.jpg"},
    {"id": "v6_pair_015", "title": "Marine Seashells & Coral Specimen", "path": "public/levels/fresh_ai_marine_seashells_specimens_base.jpg"},
    {"id": "v6_pair_016", "title": "Artisanal Baker Pantry Jars", "path": "public/levels/newbase_bakers_pantry_jar_001_base.jpg"},
    {"id": "v6_pair_017", "title": "Luthier Instrument Bridge Pins", "path": "public/levels/master_luthier_bridge_pin_001_base.jpg"},
    {"id": "v6_pair_018", "title": "Vintage Mechanic Wrench Set", "path": "public/levels/scene_vintage_mechanic_toolbox_016_base.jpg"},
    {"id": "v6_pair_019", "title": "Gourmet Confectionery Truffles", "path": "public/levels/fresh_ai_confectionery_truffles_001_base.jpg"},
    {"id": "v6_pair_020", "title": "Antique Skeleton Keys & Desk", "path": "public/levels/fresh_v5_antique_keys_009_base.jpg"},
    {"id": "v6_pair_021", "title": "Vintage Buttons Collection", "path": "public/levels/fresh_v5_vintage_buttons_003_base.jpg"},
    {"id": "v6_pair_022", "title": "Boardgame Dice & Meeples", "path": "public/levels/fresh_v5_boardgame_meeples_006_base.jpg"},
    {"id": "v6_pair_023", "title": "Italian Tricolor Pasta Array", "path": "public/levels/fresh_v5_dry_pasta_007_base.jpg"},
    {"id": "v6_pair_024", "title": "Jewelry Maker Gemstones", "path": "public/levels/fresh_v5_gemstone_beads_008_base.jpg"},
]

def main():
    print("================================================================================")
    print("🚀 GENERATING 20 NEW VERIFIED IMAGE PAIRS WITH UPGRADED PIPELINE")
    print("================================================================================")

    scheduler = OperationScheduler()
    accepted = []

    for sc in CANDIDATE_BASE_SCENES:
        if len(accepted) >= 20:
            break

        if not os.path.exists(sc["path"]):
            print(f"Skipping {sc['id']}: Base image not found ({sc['path']})")
            continue

        spec = {
            "id": f"fresh_v6_pair_{len(accepted)+1:03d}",
            "title": sc["title"],
            "image_path": sc["path"],
            "category": "Photography",
            "packId": "find_the_sniper"
        }

        print(f"\n--- Processing [{spec['id']}] ({sc['title']}) ---")
        success, result, log_entry = generate_single_scene_difference(spec, scheduler=scheduler, difficulty="Medium")

        if success and result:
            gt = result["diffs"][0]
            op = result.get("operation")
            print(f"  ✅ ACCEPTED: Op={op} | GT=({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
            accepted.append(result)
        else:
            print(f"  ❌ REJECTED: {log_entry.get('rejection_reason')}")

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
