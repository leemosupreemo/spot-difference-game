"""
GENERATE 40 NEW IMAGE PAIRS WITH UPGRADED MULTI-OP PIPELINE
================================================================================
Generates 40 unique, verified single-difference image pairs from top-tier,
high-density, textless base scenes using the upgraded boundary-matched synthesis,
recolor, add, and reorder engines.
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from unified_operation_pipeline import generate_single_scene_difference, OperationScheduler
from perceptual_verification_engine import PerceptualVerificationEngine

BASE_SCENES = [
    # Fresh V4 & V3 Non-Workbench Collector & Artisan Scenes
    ("fresh_v4_ai_pocket_watches_001_base.jpg", "Victorian Pocket Watches (Dial Focus)", "fresh_v4_pair_001", "recolor"),
    ("fresh_v4_ai_artisanal_cheeses_002_base.jpg", "Gourmet Cheese Board (Slate Substrate)", "fresh_v4_pair_002", "remove"),
    ("fresh_v4_ai_gemstone_cabochons_003_base.jpg", "Polished Gemstone Cabochons (Wood Grid)", "fresh_v4_pair_003", "recolor"),
    ("fresh_v3_ai_pasta_shapes_001_base.jpg", "Artisanal Pasta Shapes Array", "fresh_v4_pair_004", "recolor"),
    ("fresh_v3_ai_minerals_geodes_002_base.jpg", "Amethyst & Pyrite Mineral Grid", "fresh_v4_pair_005", "remove"),
    ("fresh_v3_ai_vintage_keys_003_base.jpg", "Antique Brass Skeleton Keys", "fresh_v4_pair_006", "add"),
    ("fresh_v3_ai_silk_spools_004_base.jpg", "Twisted Silk Skeins & Pearl Buttons", "fresh_v4_pair_007", "reorder"),
    ("fresh_v3_ai_japanese_teacups_005_base.jpg", "Porcelain Sometsuke Teacups", "fresh_v4_pair_008", "recolor"),
    ("fresh_v3_ai_butterfly_specimens_006_base.jpg", "Entomology Swallowtail Specimens", "fresh_v4_pair_009", "remove"),
    ("fresh_v3_ai_ancient_coins_007_base.jpg", "Ancient Bronze Drachmas & Seals", "fresh_v4_pair_010", "remove"),
    ("fresh_v3_ai_glass_paperweights_008_base.jpg", "Millefiori Glass Paperweights", "fresh_v4_pair_011", "reorder"),
    ("fresh_v3_ai_wild_mushrooms_009_base.jpg", "Foraged Forest Wild Mushrooms", "fresh_v4_pair_012", "add"),
    ("fresh_v3_ai_drafting_dividers_010_base.jpg", "Victorian Brass Drafting Dividers", "fresh_v4_pair_013", "recolor"),
    
    # Fresh V2 High-Clutter Collector Displays
    ("fresh_v2_ai_glass_marbles_millefiori_001_base.jpg", "Handblown Glass Marbles Array", "fresh_v4_pair_014", "recolor"),
    ("fresh_v2_ai_ceramic_mosaic_tiles_002_base.jpg", "Glazed Ceramic Mosaic Tiles", "fresh_v4_pair_015", "remove"),
    ("fresh_v2_ai_enamel_pins_collector_003_base.jpg", "Collector Enamel Pins on Denim", "fresh_v4_pair_016", "recolor"),
    ("fresh_v2_ai_marine_seashells_specimens_004_base.jpg", "Marine Seashells & Starfish", "fresh_v4_pair_017", "add"),
    ("fresh_v2_ai_stained_glass_jewels_005_base.jpg", "Faceted Stained Glass Jewels", "fresh_v4_pair_018", "reorder"),
    ("fresh_v2_ai_succulents_greenhouse_grid_006_base.jpg", "Greenhouse Miniature Succulents", "fresh_v4_pair_019", "recolor"),
    ("fresh_v2_ai_botanical_pressed_flora_007_base.jpg", "Pressed Herbarium Botanical Flora", "fresh_v4_pair_020", "remove"),
    ("fresh_v2_ai_confectionery_truffles_008_base.jpg", "Artisan Confectionery Truffles", "fresh_v4_pair_021", "reorder"),
    ("fresh_v2_ai_heirloom_spices_botanical_009_base.jpg", "Heirloom Spices & Seeds Array", "fresh_v4_pair_022", "recolor"),
    ("fresh_v2_ai_wooden_toy_figurines_010_base.jpg", "Carved Wooden Toy Figurines", "fresh_v4_pair_023", "add"),
    
    # Dense Curated Visual Collector Grids
    ("ai_dense_boardgame_base.jpg", "Vintage Wooden Board Game Tokens", "fresh_v4_pair_024", "recolor"),
    ("ai_dense_buttons_base.jpg", "Antique Mother-of-Pearl Buttons", "fresh_v4_pair_025", "remove"),
    ("ai_dense_candies_base.jpg", "Artisanal Glazed Confectionery Drops", "fresh_v4_pair_026", "recolor"),
    ("ai_dense_enamel_pins_base.jpg", "Vintage Cloisonne Enamel Badges", "fresh_v4_pair_027", "reorder"),
    ("ai_dense_gemstones_base.jpg", "Faceted Gemstones on Black Basalt", "fresh_v4_pair_028", "recolor"),
    ("ai_dense_marbles_base.jpg", "Swirled Glass Agate Marbles", "fresh_v4_pair_029", "add"),
    ("ai_dense_spices_base.jpg", "Whole Culinary Spice Collection", "fresh_v4_pair_030", "recolor"),
    ("ai_dense_succulents_base.jpg", "Miniature Potted Succulent Garden", "fresh_v4_pair_031", "remove"),
    ("ai_dense_watch_parts_base.jpg", "Horologist Escapement Wheels & Gears", "fresh_v4_pair_032", "reorder"),
    ("ai_macro_stained_glass_001_base.jpg", "Cathedral Stained Glass Mosaic", "fresh_v4_pair_033", "recolor"),
    ("ai_macro_watch_escapement_001_base.jpg", "Precision Brass Escapement Mechanism", "fresh_v4_pair_034", "recolor"),
    ("ai_macro_woodcarver_001_base.jpg", "Carved Wooden Relief Florets", "fresh_v4_pair_035", "add"),
    ("ai_electronics_pcb_base.jpg", "Dense Circuit Board Inductors & Chips", "fresh_v4_pair_036", "recolor"),
    ("ai_gardener_potting_base.jpg", "Botanical Herbarium Seedlings", "fresh_v4_pair_037", "remove"),
    ("ai_sewing_notions_base.jpg", "Tailor Silk Threads & Brass Thimbles", "fresh_v4_pair_038", "reorder"),
    ("ai_artist_palette_base.jpg", "Artist Oil Pigments & Fine Brushes", "fresh_v4_pair_039", "recolor"),
    ("ai_baker_pastry_base.jpg", "Patisserie French Macarons & Truffles", "fresh_v4_pair_040", "recolor")
]

def main():
    print("================================================================================")
    print(f"🚀 GENERATING 40 VERIFIED HIGH-DENSITY IMAGE PAIRS WITH UPGRADED MULTI-OP PIPELINE")
    print("================================================================================")

    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    existing_ids = {m["id"] for m in manifest}
    scheduler = OperationScheduler()
    
    accepted_entries = []
    rejected_log = []

    for base_filename, title, new_id, preferred_op in BASE_SCENES:
        base_path = os.path.join("public/levels", base_filename)
        if not os.path.exists(base_path):
            print(f"⚠️ Base image not found: {base_path}, skipping...")
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
            print(f"✅ ACCEPTED: Op={result['operation']} | GT=({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
        else:
            print(f"❌ REJECTED: {log_entry.get('rejection_reason')}")
            rejected_log.append((new_id, log_entry.get("rejection_reason")))

    # Prepend new accepted entries to manifest
    if accepted_entries:
        # Filter out existing with same IDs
        new_ids = {e["id"] for e in accepted_entries}
        manifest = [m for m in manifest if m["id"] not in new_ids]
        manifest = accepted_entries + manifest
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
        print(f"\n🎉 Successfully saved {len(accepted_entries)} new verified image pairs to manifest (Total: {len(manifest)})")

    print("\n================================================================================")
    print(f"SUMMARY: {len(accepted_entries)} Accepted / {len(BASE_SCENES)} Total Attempted")
    print(f"Operation Distribution:")
    op_counts = {}
    for e in accepted_entries:
        op = e.get("operation", "unknown")
        op_counts[op] = op_counts.get(op, 0) + 1
    for op, cnt in op_counts.items():
        print(f" - {op.upper()}: {cnt} ({cnt/len(accepted_entries)*100:.1f}%)")
    print("================================================================================")

if __name__ == "__main__":
    import shutil
    main()
