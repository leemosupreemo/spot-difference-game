"""
Generate Pairs for All 56 Unpaired Base Scenes
================================================================================
Generates verified single-difference pairs from all 56 high-resolution base scenes:
- 30 levels partitioned into 6 new standard 5-image sets (photo_set_036 to photo_set_041)
- 26 levels partitioned into the Daily Challenge pool (8 sets of 3 + 2 custom levels)
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

from unified_operation_pipeline import generate_single_scene_difference, OperationScheduler
from perceptual_verification_engine import PerceptualVerificationEngine

REGULAR_SETS_SCENES = [
    # photo_set_036: Naturalist & Collector Specimens
    {
        "id": "photo_set_036_01",
        "title": "Botanist Herbarium Specimens",
        "image_path": "public/levels/fresh_v8_botanist_specimens_010_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_036", "sequence": 1
    },
    {
        "id": "photo_set_036_02",
        "title": "Entomology Butterfly Specimens",
        "image_path": "public/levels/fresh_v8_entomology_butterflies_003_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_036", "sequence": 2
    },
    {
        "id": "photo_set_036_03",
        "title": "Geologist Minerals & Geodes",
        "image_path": "public/levels/fresh_v8_geologist_minerals_005_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_036", "sequence": 3
    },
    {
        "id": "photo_set_036_04",
        "title": "Antique Locksmith Skeleton Keys",
        "image_path": "public/levels/fresh_v8_locksmith_keys_001_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_036", "sequence": 4
    },
    {
        "id": "photo_set_036_05",
        "title": "Numismatist Ancient Drachmas & Coins",
        "image_path": "public/levels/fresh_v8_numismatist_coins_002_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_036", "sequence": 5
    },

    # photo_set_037: Crafts & Culinary Workshops
    {
        "id": "photo_set_037_01",
        "title": "French Pastry Chef Confectionery",
        "image_path": "public/levels/fresh_v8_pastry_chef_004_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_037", "sequence": 1
    },
    {
        "id": "photo_set_037_02",
        "title": "Artisan Chocolatier Truffles",
        "image_path": "public/levels/fresh_v8_chocolatier_truffles_012_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_037", "sequence": 2
    },
    {
        "id": "photo_set_037_03",
        "title": "Specialty Coffee Roastery Tasting",
        "image_path": "public/levels/fresh_v8_coffee_roastery_011_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_037", "sequence": 3
    },
    {
        "id": "photo_set_037_04",
        "title": "Tailor Haberdashery Wooden Spools",
        "image_path": "public/levels/fresh_v8_sewing_haberdashery_006_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_037", "sequence": 4
    },
    {
        "id": "photo_set_037_05",
        "title": "Woodcarver Chisel & Gouge Tools",
        "image_path": "public/levels/fresh_v8_woodcarver_tools_009_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_037", "sequence": 5
    },

    # photo_set_038: Atelier, Electronics & Fly Fishing
    {
        "id": "photo_set_038_01",
        "title": "Calligraphy Wax Seal Impression Desk",
        "image_path": "public/levels/fresh_v8_calligraphy_wax_seals_008_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_038", "sequence": 1
    },
    {
        "id": "photo_set_038_02",
        "title": "Fly Fishing Hand-Tied Tackle Box",
        "image_path": "public/levels/fresh_v8_fly_fishing_tackle_013_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_038", "sequence": 2
    },
    {
        "id": "photo_set_038_03",
        "title": "Hardware Electronics Soldering Bench",
        "image_path": "public/levels/fresh_v8_electronics_workbench_007_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_038", "sequence": 3
    },
    {
        "id": "photo_set_038_04",
        "title": "Octagonal Calligraphy Wax Beads",
        "image_path": "public/levels/newbase_calligraphy_wax_bead_007_base.jpg",
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

    # photo_set_039: Collector Grids & Dense Clutter
    {
        "id": "photo_set_039_01",
        "title": "Strategy Board Game Wood Tokens",
        "image_path": "public/levels/dense_boardgame_tokens_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_039", "sequence": 1
    },
    {
        "id": "photo_set_039_02",
        "title": "Mother-of-Pearl Tailor Buttons Tray",
        "image_path": "public/levels/dense_button_tray_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_039", "sequence": 2
    },
    {
        "id": "photo_set_039_03",
        "title": "Cloisonne Enamel Badges Showcase",
        "image_path": "public/levels/dense_enamel_pins_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_039", "sequence": 3
    },
    {
        "id": "photo_set_039_04",
        "title": "Gemologist Faceted Gemstone Tray",
        "image_path": "public/levels/dense_gemstone_facets_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_039", "sequence": 4
    },
    {
        "id": "photo_set_039_05",
        "title": "Artisanal Glazed Confectionery Drops",
        "image_path": "public/levels/dense_gourmet_candies_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_039", "sequence": 5
    },

    # photo_set_040: Hardware, Horology & Minerals
    {
        "id": "photo_set_040_01",
        "title": "Machinist Hardware Fasteners Tray",
        "image_path": "public/levels/dense_hardware_nuts_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_040", "sequence": 1
    },
    {
        "id": "photo_set_040_02",
        "title": "Collector Swirled Glass Marbles Pile",
        "image_path": "public/levels/dense_pile_marbles_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_040", "sequence": 2
    },
    {
        "id": "photo_set_040_03",
        "title": "Precision Electronic Resistor Bands",
        "image_path": "public/levels/dense_resistors_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_040", "sequence": 3
    },
    {
        "id": "photo_set_040_04",
        "title": "Horologist Brass Escapement Wheels",
        "image_path": "public/levels/dense_watchmaker_cogs_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_040", "sequence": 4
    },
    {
        "id": "photo_set_040_05",
        "title": "Ancient Mediterranean Bronze Coinage",
        "image_path": "public/levels/fresh_v3_ai_ancient_coins_tokens_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_040", "sequence": 5
    },

    # photo_set_041: Botanical & Nature Treasures
    {
        "id": "photo_set_041_01",
        "title": "Embroidery Silk Floss Spools Grid",
        "image_path": "public/levels/fresh_v3_ai_silk_floss_spools_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_041", "sequence": 1
    },
    {
        "id": "photo_set_041_02",
        "title": "Artist Wood Colored Pencil Tips",
        "image_path": "public/levels/fresh_v5_colored_pencils_005_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_041", "sequence": 2
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
    {
        "id": "photo_set_041_05",
        "title": "Barista Precision Coffee Tamper Collar",
        "image_path": "public/levels/newbase_coffee_tamper_collar_005_base.jpg",
        "category": "Photography", "pack": "Find the Sniper", "packId": "find_the_sniper", "difficulty": "Medium",
        "setId": "photo_set_041", "sequence": 5
    }
]

DAILY_POOL_SCENES = [
    # Daily Set 1
    {"id": "daily_v8_01_citrus", "title": "Farmers Market Fresh Citrus Leaf", "image_path": "public/levels/newbase_farmers_market_citrus_leaf_010_base.jpg", "dailySet": "set_daily_modern_01"},
    {"id": "daily_v8_01_potting", "title": "Gardener Greenhouse Potting Tag", "image_path": "public/levels/newbase_gardener_potting_tag_003_base.jpg", "dailySet": "set_daily_modern_01"},
    {"id": "daily_v8_01_pottery", "title": "Ceramic Studio Pottery Glaze Bottle", "image_path": "public/levels/newbase_pottery_glaze_bottle_009_base.jpg", "dailySet": "set_daily_modern_01"},

    # Daily Set 2
    {"id": "daily_v8_02_stationery", "title": "Art Studio Stationery Craft Layout", "image_path": "public/levels/scene_art_craft_stationery_015_base.jpg", "dailySet": "set_daily_modern_02"},
    {"id": "daily_v8_02_apothecary", "title": "Apothecary Botanical Herbarium Jars", "image_path": "public/levels/scene_botanical_apothecary_herb_014_base.jpg", "dailySet": "set_daily_modern_02"},
    {"id": "daily_v8_02_machinist", "title": "Machinist Precision Hardware Drawer", "image_path": "public/levels/scene_machinist_hardware_tray_010_base.jpg", "dailySet": "set_daily_modern_02"},

    # Daily Set 3
    {"id": "daily_v8_03_toolbox", "title": "Vintage Mechanic Wrench Toolbox", "image_path": "public/levels/scene_vintage_mechanic_toolbox_016_base.jpg", "dailySet": "set_daily_modern_03"},
    {"id": "daily_v8_03_typewriter", "title": "Vintage Mechanical Typewriter Ribbon", "image_path": "public/levels/scene_vintage_typewriter_ribbon_012_base.jpg", "dailySet": "set_daily_modern_03"},
    {"id": "daily_v8_03_chisel", "title": "Antique Carpenter Joinery Chisel", "image_path": "public/levels/scene_woodworking_antique_chisel_011_base.jpg", "dailySet": "set_daily_modern_03"},

    # Daily Set 4
    {"id": "daily_v8_04_pastels", "title": "Fine Art Artist Oil Pastels Box", "image_path": "public/levels/newbase_artist_oil_pastels_002_base.jpg", "dailySet": "set_daily_modern_04"},
    {"id": "daily_v8_04_leather", "title": "Artisan Leathercraft Edge Beveler", "image_path": "public/levels/newbase_leathercraft_beveler_handle_008_base.jpg", "dailySet": "set_daily_modern_04"},
    {"id": "daily_v8_04_brassclip", "title": "Solid Brass Archival Paper Clip", "image_path": "public/levels/semantic_stationery_brass_clip_001_base.jpg", "dailySet": "set_daily_modern_04"},

    # Daily Set 5
    {"id": "daily_v8_05_sleeve", "title": "Insulated Electronic Cable Sleeves", "image_path": "public/levels/semantic_workshop_bench_insulated_sleeve_005_base.jpg", "dailySet": "set_daily_modern_05"},
    {"id": "daily_v8_05_watchparts", "title": "Horology Escapement Pivot Tray", "image_path": "public/levels/ai_dense_watch_parts_base.jpg", "dailySet": "set_daily_modern_05"},
    {"id": "daily_v8_05_hardware", "title": "Machinist Fasteners Sorting Grid", "image_path": "public/levels/ai_dense_hardware_base.jpg", "dailySet": "set_daily_modern_05"},

    # Daily Set 6
    {"id": "daily_v8_06_gemstones", "title": "Gemologist Faceted Basalt Display", "image_path": "public/levels/ai_dense_gemstones_base.jpg", "dailySet": "set_daily_modern_06"},
    {"id": "daily_v8_06_bakery", "title": "Patisserie Gourmet Brioche Array", "image_path": "public/levels/ai_baker_pastry_base.jpg", "dailySet": "set_daily_modern_06"},
    {"id": "daily_v8_06_mechanic", "title": "Automotive Hardware Bench Array", "image_path": "public/levels/ai_mechanic_workbench_base.jpg", "dailySet": "set_daily_modern_06"},

    # Daily Set 7
    {"id": "daily_v8_07_pencils", "title": "Fine Artist Prismacolor Pencils", "image_path": "public/levels/ai_unique_pencils_base.jpg", "dailySet": "set_daily_modern_07"},
    {"id": "daily_v8_07_seashells", "title": "Marine Biologist Seashell Specimen Tray", "image_path": "public/levels/ai_unique_seashells_base.jpg", "dailySet": "set_daily_modern_07"},
    {"id": "daily_v8_07_palette", "title": "Oil Painter Wet Palette Taboret", "image_path": "public/levels/dense_artist_palette_base.jpg", "dailySet": "set_daily_modern_07"},

    # Daily Set 8
    {"id": "daily_v8_08_resistors", "title": "High-Density Resistor Breadboard", "image_path": "public/levels/fresh_v7_electronic_resistors_020_base.jpg", "dailySet": "set_daily_modern_08"},
    {"id": "daily_v8_08_faceted", "title": "Faceted Tourmaline Mineral Gems", "image_path": "public/levels/fresh_v7_faceted_gemstones_014_base.jpg", "dailySet": "set_daily_modern_08"},
    {"id": "daily_v8_08_hardware_b", "title": "Machinist Socket Hex Nuts Array", "image_path": "public/levels/test_dense_hardware_base.jpg", "dailySet": "set_daily_modern_08"},

    # Custom Daily Bonus Levels
    {"id": "daily_v8_custom_01", "title": "Dense Horology Balance Wheels", "image_path": "public/levels/test_dense_watchmaker_base.jpg", "dailySet": "custom"},
    {"id": "daily_v8_custom_02", "title": "Faceted Gemstone Cabochons Matrix", "image_path": "public/levels/test_dense_gemstones_base.jpg", "dailySet": "custom"}
]

def main():
    print(f"Starting generation for {len(REGULAR_SETS_SCENES)} regular set scenes and {len(DAILY_POOL_SCENES)} daily pool scenes...")
    scheduler = OperationScheduler()
    output_dir = "public/levels"

    # 1. Process Regular Set Scenes
    successful_regular_entries = []
    for i, spec in enumerate(REGULAR_SETS_SCENES):
        print(f"\n[{i+1}/{len(REGULAR_SETS_SCENES)}] Processing regular level: {spec['id']} ({spec['title']})")
        success, entry, log = generate_single_scene_difference(spec, scheduler=scheduler, output_dir=output_dir)
        if success and entry:
            # Ensure proper 4:3 dimensions
            img = cv2.imread(os.path.join(output_dir, f"{spec['id']}_base.jpg"))
            h, w = img.shape[:2]
            entry["dimensions"] = {"width": w, "height": h}
            entry["aspectRatio"] = "4:3"
            entry["setId"] = spec["setId"]
            entry["sequence"] = spec["sequence"]
            successful_regular_entries.append(entry)
            print(f"  -> SUCCESS! Operation: {entry.get('operation')}, Diff: {entry.get('diffs')}")
        else:
            print(f"  -> FAILED: {log.get('rejection_reason')}")

    print(f"\nRegular set entries successfully generated: {len(successful_regular_entries)} / {len(REGULAR_SETS_SCENES)}")

    # 2. Process Daily Pool Scenes
    successful_daily_entries = []
    for i, spec in enumerate(DAILY_POOL_SCENES):
        print(f"\n[{i+1}/{len(DAILY_POOL_SCENES)}] Processing daily pool level: {spec['id']} ({spec['title']})")
        success, entry, log = generate_single_scene_difference(spec, scheduler=scheduler, output_dir=output_dir)
        if success and entry:
            img = cv2.imread(os.path.join(output_dir, f"{spec['id']}_base.jpg"))
            h, w = img.shape[:2]
            entry["dimensions"] = {"width": w, "height": h}
            entry["aspectRatio"] = "4:3"
            entry["dailySet"] = spec["dailySet"]
            successful_daily_entries.append(entry)
            print(f"  -> SUCCESS! Operation: {entry.get('operation')}, Diff: {entry.get('diffs')}")
        else:
            print(f"  -> FAILED: {log.get('rejection_reason')}")

    print(f"\nDaily pool entries successfully generated: {len(successful_daily_entries)} / {len(DAILY_POOL_SCENES)}")

    # Save manifest updates
    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    existing_ids = set(item["id"] for item in manifest)
    added_regular = 0
    for entry in successful_regular_entries:
        if entry["id"] not in existing_ids:
            manifest.append(entry)
            existing_ids.add(entry["id"])
            added_regular += 1

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nAdded {added_regular} entries to {manifest_path} (Total manifest: {len(manifest)})")

    # Update Daily Queue
    daily_queue_path = "public/daily-queue.json"
    with open(daily_queue_path, "r") as f:
        daily_queue = json.load(f)

    # Group daily entries by dailySet
    daily_groups = {}
    for entry in successful_daily_entries:
        ds = entry.get("dailySet", "custom")
        daily_groups.setdefault(ds, []).append(entry)

    queue_list = daily_queue.get("queue", [])
    # Add new modern sets at the top of the queue
    for ds, entries in sorted(daily_groups.items()):
        if ds.startswith("set_daily_modern"):
            new_queue_item = {
                "setId": ds,
                "label": f"Modern Curator Set ({entries[0]['title'].split()[0]})",
                "isLegacy": False,
                "levels": [e["id"] for e in entries]
            }
            # Avoid duplicate setIds
            if not any(q.get("setId") == ds for q in queue_list):
                queue_list.insert(0, new_queue_item)

    daily_queue["queue"] = queue_list

    # Also register daily pool entries into manifest so createPhotoPairLevel can resolve them
    for entry in successful_daily_entries:
        if entry["id"] not in existing_ids:
            manifest.append(entry)
            existing_ids.add(entry["id"])

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    with open(daily_queue_path, "w") as f:
        json.dump(daily_queue, f, indent=2)

    print(f"Updated {daily_queue_path} with {len(daily_groups)} modern daily sets.")

if __name__ == "__main__":
    main()
