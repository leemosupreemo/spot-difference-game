"""
BATCH RUNNER: 20 FRESH V4 AI PHOTOREALISTIC DENSE SCENES
================================================================================
Runs the upgraded boundary-matched multi-operation pipeline across 20 high-clutter,
textless, diverse base scenes.
================================================================================
"""

import os
import sys
import json
import shutil
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from unified_operation_pipeline import generate_single_scene_difference, OperationScheduler
from remove_target_selector import SubstrateCoherenceAnalyzer, LocalBackgroundSynthesizer, RemoveTargetSelector

SCENE_SPECS = [
    {
        "id": "fresh_v4_ai_pocket_watches_001",
        "title": "Victorian Pocket Watches on Blue Velvet",
        "image_path": "public/levels/fresh_v4_ai_pocket_watches_001_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v4_ai_artisanal_cheeses_002",
        "title": "Gourmet Cheese Board on Slate",
        "image_path": "public/levels/fresh_v4_ai_artisanal_cheeses_002_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v4_ai_gemstone_cabochons_003",
        "title": "Polished Gemstone Cabochons in Wood Tray",
        "image_path": "public/levels/fresh_v4_ai_gemstone_cabochons_003_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v4_ai_dried_citrus_botanicals_004",
        "title": "Dried Citrus & Star Anise on Linen",
        "image_path": "public/levels/fresh_v4_ai_dried_citrus_botanicals_004_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "add"
    },
    {
        "id": "fresh_v4_ai_ceramic_bonsai_pots_005",
        "title": "Glazed Bonsai Pots Array",
        "image_path": "public/levels/fresh_v4_ai_ceramic_bonsai_pots_005_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v4_ai_fountain_pen_nibs_006",
        "title": "Calligraphy Pen Nibs on Walnut",
        "image_path": "public/levels/fresh_v4_ai_fountain_pen_nibs_006_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v4_ai_pressed_autumn_leaves_007",
        "title": "Pressed Autumn Flora on Parchment",
        "image_path": "public/levels/fresh_v4_ai_pressed_autumn_leaves_007_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v4_ai_vintage_padlocks_008",
        "title": "Antique Brass & Iron Padlocks",
        "image_path": "public/levels/fresh_v4_ai_vintage_padlocks_008_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "add"
    },
    {
        "id": "fresh_v4_ai_colorful_origami_cranes_009",
        "title": "Miniature Origami Cranes on Washi",
        "image_path": "public/levels/fresh_v4_ai_colorful_origami_cranes_009_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v4_ai_artisan_soap_bars_010",
        "title": "Handcrafted Botanical Soap Cubes",
        "image_path": "public/levels/fresh_v4_ai_artisan_soap_bars_010_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v4_ai_miniature_succulent_pots_011",
        "title": "Terra Cotta Succulent Rosettes",
        "image_path": "public/levels/fresh_v4_ai_miniature_succulent_pots_011_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v4_ai_glass_prism_crystals_012",
        "title": "Faceted Crystal Prisms on Slate",
        "image_path": "public/levels/fresh_v4_ai_glass_prism_crystals_012_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v4_ai_antique_thimbles_buttons_013",
        "title": "Victorian Thimbles & Carved Buttons",
        "image_path": "public/levels/fresh_v4_ai_antique_thimbles_buttons_013_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "add"
    },
    {
        "id": "fresh_v4_ai_exotic_seashells_corals_014",
        "title": "Specimen Seashells on White Sand",
        "image_path": "public/levels/fresh_v4_ai_exotic_seashells_corals_014_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v4_ai_gourmet_chocolates_truffles_015",
        "title": "Artisan Chocolate Bonbons Array",
        "image_path": "public/levels/fresh_v4_ai_gourmet_chocolates_truffles_015_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v4_ai_vintage_camera_lenses_016",
        "title": "Rangefinder Lens Elements & Filters",
        "image_path": "public/levels/fresh_v4_ai_vintage_camera_lenses_016_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v4_ai_carved_wooden_chess_017",
        "title": "Carved Ebony & Boxwood Chessmen",
        "image_path": "public/levels/fresh_v4_ai_carved_wooden_chess_017_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "add"
    },
    {
        "id": "fresh_v4_ai_handblown_glass_marbles_018",
        "title": "Cat's Eye Glass Marbles Array",
        "image_path": "public/levels/fresh_v4_ai_handblown_glass_marbles_018_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v4_ai_dried_botanical_herbs_019",
        "title": "Culinary Spice Pods in Ceramic Dishes",
        "image_path": "public/levels/fresh_v4_ai_dried_botanical_herbs_019_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v4_ai_wax_seal_stamps_020",
        "title": "Brass Wax Seals & Sealing Beads",
        "image_path": "public/levels/fresh_v4_ai_wax_seal_stamps_020_base.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "preferred_op": "reorder"
    }
]

def main():
    print("================================================================================")
    print("🚀 RUNNING 20 FRESH V4 AI BATCH GENERATION WITH BOUNDARY-MATCHED SYNTHESIS")
    print("================================================================================")

    # 1. Copy available base images into public/levels
    artifact_dir = "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49"
    
    mapping = {
        "pocket_watches_velvet_1787866949970.jpg": "public/levels/fresh_v4_ai_pocket_watches_001_base.jpg",
        "artisanal_cheeses_slate_1787866962269.jpg": "public/levels/fresh_v4_ai_artisanal_cheeses_002_base.jpg",
        "gemstone_cabochons_basalt_1787866981577.jpg": "public/levels/fresh_v4_ai_gemstone_cabochons_003_base.jpg"
    }

    for art_file, dest in mapping.items():
        src = os.path.join(artifact_dir, art_file)
        if os.path.exists(src):
            shutil.copyfile(src, dest)
            print(f"Copied {art_file} -> {dest}")

    scheduler = OperationScheduler()
    accepted = []
    rejected = []

    for spec in SCENE_SPECS:
        if not os.path.exists(spec["image_path"]):
            continue

        print(f"\n--- Processing [{spec['id']}] ({spec['title']}) ---")
        success, result, log_entry = generate_single_scene_difference(spec, scheduler=scheduler, difficulty="Medium")

        if success and result:
            print(f"✅ PASSED: Operation={result['operation']} | GT=({result['diffs'][0]['x']}%, {result['diffs'][0]['y']}%, r={result['diffs'][0]['radius']}%)")
            accepted.append(result)
        else:
            print(f"❌ REJECTED: {log_entry.get('rejection_reason')}")
            rejected.append((spec['id'], log_entry.get('rejection_reason')))

    print(f"\n================================================================================")
    print(f"Batch generation completed: {len(accepted)} accepted, {len(rejected)} rejected.")
    print("================================================================================")

if __name__ == "__main__":
    main()
