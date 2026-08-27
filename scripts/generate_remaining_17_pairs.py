"""
BATCH RUNNER: GENERATE REMAINING 17 IMAGE PAIRS TO HIT 40 NEW PAIRS
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from unified_operation_pipeline import generate_single_scene_difference, OperationScheduler

REMAINING_SPECS = [
    # Secondary independent differences on rich collector arrays
    ("fresh_v4_ai_pocket_watches_001_base.jpg", "Victorian Pocket Watches (Jewel Escapement)", "fresh_v4_pair_041", "reorder"),
    ("fresh_v4_ai_artisanal_cheeses_002_base.jpg", "Gourmet Cheese Board (Ramekin Recolor)", "fresh_v4_pair_042", "recolor"),
    ("fresh_v4_ai_gemstone_cabochons_003_base.jpg", "Gemstone Cabochons (Lapis Cabochon Shift)", "fresh_v4_pair_043", "recolor"),
    ("fresh_v3_ai_pasta_shapes_001_base.jpg", "Artisan Campanelle & Farfalle", "fresh_v4_pair_044", "reorder"),
    ("fresh_v3_ai_minerals_geodes_002_base.jpg", "Pyrite Crystal Cube on Slate", "fresh_v4_pair_045", "recolor"),
    ("fresh_v3_ai_vintage_keys_003_base.jpg", "Antique Ornate Key Escutcheon", "fresh_v4_pair_046", "reorder"),
    ("fresh_v3_ai_silk_spools_004_base.jpg", "Twisted Silk Skein (Vibrant Hue)", "fresh_v4_pair_047", "recolor"),
    ("fresh_v3_ai_japanese_teacups_005_base.jpg", "Glazed Bizen Sake Cup", "fresh_v4_pair_048", "reorder"),
    ("fresh_v3_ai_glass_paperweights_008_base.jpg", "Millefiori Swirl Paperweight (Chroma)", "fresh_v4_pair_049", "recolor"),
    ("fresh_v3_ai_wild_mushrooms_009_base.jpg", "Forest Morel Cap in Ceramic Dish", "fresh_v4_pair_050", "recolor"),
    ("fresh_v3_ai_drafting_dividers_010_base.jpg", "Brass Bow Compass & Divider", "fresh_v4_pair_051", "reorder"),
    
    # Additional Curated High-Clutter Base Images
    ("ai_dense_candies_base.jpg", "Fruit Hard Candies & Lozenges", "fresh_v4_pair_052", "reorder"),
    ("ai_dense_gemstones_base.jpg", "Natural Mineral Prisms & Agate", "fresh_v4_pair_053", "reorder"),
    ("ai_dense_marbles_base.jpg", "Vintage Sulphide & Swirl Marbles", "fresh_v4_pair_054", "recolor"),
    ("ai_dense_spices_base.jpg", "Whole Nutmegs & Star Anise Seeds", "fresh_v4_pair_055", "reorder"),
    ("ai_dense_boardgame_base.jpg", "Carved Wooden Chess & Checkers", "fresh_v4_pair_056", "reorder"),
    ("ai_dense_buttons_base.jpg", "Handcrafted Filigree Metal Buttons", "fresh_v4_pair_057", "recolor"),
    ("ai_dense_enamel_pins_base.jpg", "Retro Lapel Enamel Badges", "fresh_v4_pair_058", "recolor"),
    ("ai_dense_hardware_base.jpg", "Brass Screws & Industrial Washers", "fresh_v4_pair_059", "recolor"),
    ("ai_dense_watch_parts_base.jpg", "Watchmaker Balance Wheels & Screws", "fresh_v4_pair_060", "recolor"),
    ("ai_unique_seashells_base.jpg", "Polished Cowries & Spiral Shells", "fresh_v4_pair_061", "recolor"),
    ("ai_unique_bakery_base.jpg", "Patisserie Glazed Fruit Tartlets", "fresh_v4_pair_062", "recolor"),
    ("ai_unique_pencils_base.jpg", "Colored Artist Pencils & Pigments", "fresh_v4_pair_063", "recolor"),
    ("ai_unique_retrogaming_base.jpg", "Retro Gaming Cartridges & Dice", "fresh_v4_pair_064", "recolor")
]

def main():
    print("================================================================================")
    print("🚀 GENERATING REMAINING IMAGE PAIRS TO COMPLETE 40 NEW PAIRS")
    print("================================================================================")

    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    scheduler = OperationScheduler()
    accepted_entries = []

    for base_filename, title, new_id, preferred_op in REMAINING_SPECS:
        if len(accepted_entries) >= 17:
            break

        base_path = os.path.join("public/levels", base_filename)
        if not os.path.exists(base_path):
            continue

        spec = {
            "id": new_id,
            "title": title,
            "image_path": base_path,
            "category": "Photography",
            "packId": "find_the_sniper",
            "preferred_op": preferred_op
        }

        print(f"\n--- Processing [{new_id}] ({title}) [Preferred: {preferred_op}] ---")
        success, result, log_entry = generate_single_scene_difference(spec, scheduler=scheduler, difficulty="Medium")

        if success and result:
            accepted_entries.append(result)
            gt = result["diffs"][0]
            print(f"✅ ACCEPTED ({len(accepted_entries)}/17): Op={result['operation']} | GT=({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
        else:
            print(f"❌ REJECTED: {log_entry.get('rejection_reason')}")

    if accepted_entries:
        new_ids = {e["id"] for e in accepted_entries}
        manifest = [m for m in manifest if m["id"] not in new_ids]
        manifest = accepted_entries + manifest
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
        print(f"\n🎉 Successfully added {len(accepted_entries)} more image pairs! Total levels in manifest: {len(manifest)}")

if __name__ == "__main__":
    main()
