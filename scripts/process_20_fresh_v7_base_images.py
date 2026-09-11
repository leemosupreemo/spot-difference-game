"""
PROCESS 20 NEW FRESH V7 BASE IMAGES INTO VERIFIED GAME LEVELS
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from unified_operation_pipeline import generate_single_scene_difference, OperationScheduler

SCENES = [
    {
        "id": "fresh_v7_fountain_pens_001",
        "title": "Vintage Fountain Pens & Nibs",
        "base_dest": "public/levels/fresh_v7_fountain_pens_001_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_marine_shells_002",
        "title": "Marine Biologist Seashells & Sea Glass",
        "base_dest": "public/levels/fresh_v7_marine_shells_002_base.jpg",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v7_apothecary_herbs_003",
        "title": "Herbalist Apothecary Jars & Spices",
        "base_dest": "public/levels/fresh_v7_apothecary_herbs_003_base.jpg",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v7_tabletop_rpg_004",
        "title": "Tabletop RPG Miniatures & Polyhedral Dice",
        "base_dest": "public/levels/fresh_v7_tabletop_rpg_004_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_postage_stamps_005",
        "title": "Philatelist Vintage Postage Stamps",
        "base_dest": "public/levels/fresh_v7_postage_stamps_005_base.jpg",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v7_tea_ceremony_006",
        "title": "Traditional Japanese Matcha Tea Ceremony",
        "base_dest": "public/levels/fresh_v7_tea_ceremony_006_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_cobbler_leather_007",
        "title": "Bespoke Cobbler Workshop & Brass Eyelets",
        "base_dest": "public/levels/fresh_v7_cobbler_leather_007_base.jpg",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v7_chocolate_truffles_008",
        "title": "Artisan Chocolatier Gourmet Truffles",
        "base_dest": "public/levels/fresh_v7_chocolate_truffles_008_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_entomology_beetles_009",
        "title": "Entomologist Specimen Drawer & Beetles",
        "base_dest": "public/levels/fresh_v7_entomology_beetles_009_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_building_bricks_010",
        "title": "Colorful Building Bricks & Toy Gears",
        "base_dest": "public/levels/fresh_v7_building_bricks_010_base.jpg",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v7_pottery_tools_011",
        "title": "Ceramic Studio Apron & Glaze Tiles",
        "base_dest": "public/levels/fresh_v7_pottery_tools_011_base.jpg",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v7_bonsai_tools_012",
        "title": "Bonsai Master Tool Roll & Copper Wire",
        "base_dest": "public/levels/fresh_v7_bonsai_tools_012_base.jpg",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v7_cassette_tapes_013",
        "title": "1980s Retro Audio Cassettes & Mixtapes",
        "base_dest": "public/levels/fresh_v7_cassette_tapes_013_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_faceted_gemstones_014",
        "title": "Faceted Gemstones & Minerals on Velvet",
        "base_dest": "public/levels/fresh_v7_faceted_gemstones_014_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_watchmaker_cogs_015",
        "title": "Precision Watchmaker Escapements & Jewels",
        "base_dest": "public/levels/fresh_v7_watchmaker_cogs_015_base.jpg",
        "preferred_op": "remove"
    },
    {
        "id": "fresh_v7_hardware_nuts_016",
        "title": "Mechanical Brass Hex Nuts & Washers",
        "base_dest": "public/levels/fresh_v7_hardware_nuts_016_base.jpg",
        "preferred_op": "reorder"
    },
    {
        "id": "fresh_v7_artist_palette_017",
        "title": "Oil Artist Palette Dollops & Swirls",
        "base_dest": "public/levels/fresh_v7_artist_palette_017_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_enamel_pins_018",
        "title": "Collector Retro Enamel Pins & Badges",
        "base_dest": "public/levels/fresh_v7_enamel_pins_018_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_glass_marbles_019",
        "title": "3D Specular Glass Marbles & Swirls",
        "base_dest": "public/levels/fresh_v7_glass_marbles_019_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "id": "fresh_v7_electronic_resistors_020",
        "title": "Precision Resistors & Capacitors on ESD Mat",
        "base_dest": "public/levels/fresh_v7_electronic_resistors_020_base.jpg",
        "preferred_op": "recolor"
    }
]

def main():
    print("================================================================================")
    print("🚀 PROCESSING 20 NEW FRESH V7 BASE SCENES WITH UPGRADED PIPELINE")
    print("================================================================================")

    scheduler = OperationScheduler()
    accepted = []

    for sc in SCENES:
        if not os.path.exists(sc["base_dest"]):
            print(f"⚠️ Missing base image: {sc['base_dest']}")
            continue

        spec = {
            "id": sc["id"],
            "title": sc["title"],
            "image_path": sc["base_dest"],
            "category": "Photography",
            "packId": "find_the_sniper",
            "preferred_op": sc.get("preferred_op")
        }

        print(f"\n--- Processing [{sc['id']}] ({sc['title']}) ---")
        success, result, log_entry = generate_single_scene_difference(spec, scheduler=scheduler, difficulty="Medium")

        if success and result:
            gt = result["diffs"][0]
            print(f"✅ ACCEPTED: Op={result['operation']} | GT=({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
            accepted.append(result)
        else:
            print(f"❌ REJECTED: {log_entry.get('rejection_reason')}")

    if accepted:
        manifest_path = "public/levels/photo_pair_manifest.json"
        with open(manifest_path, "r") as f:
            manifest = json.load(f)

        new_ids = {a["id"] for a in accepted}
        manifest = [m for m in manifest if m["id"] not in new_ids]
        manifest = accepted + manifest

        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        print(f"\n🎉 Successfully added {len(accepted)} new levels to manifest! (Total levels: {len(manifest)})")

if __name__ == "__main__":
    main()
