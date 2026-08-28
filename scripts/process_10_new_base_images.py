"""
PROCESS 10 NEW ULTRA-DENSE BASE IMAGES INTO VERIFIED GAME LEVELS
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

ARTIFACT_DIR = "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49"

SCENES = [
    {
        "art_file": "paper_clips_spilt_floor_1787877795005.jpg",
        "id": "fresh_v5_paper_clips_001",
        "title": "Spilled Colorful Paperclips on Concrete",
        "base_dest": "public/levels/fresh_v5_paper_clips_001_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "art_file": "pickup_sticks_game_1787877807622.jpg",
        "id": "fresh_v5_pickup_sticks_002",
        "title": "Tangled Pick Up Sticks on Green Felt",
        "base_dest": "public/levels/fresh_v5_pickup_sticks_002_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "art_file": "vintage_buttons_tin_1787877820735.jpg",
        "id": "fresh_v5_vintage_buttons_003",
        "title": "Antique Mother of Pearl & Bakelite Buttons",
        "base_dest": "public/levels/fresh_v5_vintage_buttons_003_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "art_file": "assorted_sewing_threads_pins_1787877834306.jpg",
        "id": "fresh_v5_sewing_notions_004",
        "title": "Silk Thread Spools & Safety Pins",
        "base_dest": "public/levels/fresh_v5_sewing_notions_004_base.jpg",
        "preferred_op": "reorder"
    },
    {
        "art_file": "colored_pencils_shavings_1787877850658.jpg",
        "id": "fresh_v5_colored_pencils_005",
        "title": "Rainbow Colored Pencils & Wood Shavings",
        "base_dest": "public/levels/fresh_v5_colored_pencils_005_base.jpg",
        "preferred_op": "reorder"
    },
    {
        "art_file": "boardgame_dice_meeples_1787877873320.jpg",
        "id": "fresh_v5_boardgame_meeples_006",
        "title": "Wooden Meeples & Polyhedral RPG Dice",
        "base_dest": "public/levels/fresh_v5_boardgame_meeples_006_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "art_file": "dry_pasta_varieties_1787877887709.jpg",
        "id": "fresh_v5_dry_pasta_007",
        "title": "Italian Tricolor Dry Pasta on Slate",
        "base_dest": "public/levels/fresh_v5_dry_pasta_007_base.jpg",
        "preferred_op": "remove"
    },
    {
        "art_file": "gemstone_beads_wire_1787877903078.jpg",
        "id": "fresh_v5_gemstone_beads_008",
        "title": "Jewelry Maker Gemstone Beads & Findings",
        "base_dest": "public/levels/fresh_v5_gemstone_beads_008_base.jpg",
        "preferred_op": "recolor"
    },
    {
        "art_file": "antique_keys_tags_1787877919132.jpg",
        "id": "fresh_v5_antique_keys_009",
        "title": "Intricate Antique Skeleton Keys on Leather",
        "base_dest": "public/levels/fresh_v5_antique_keys_009_base.jpg",
        "preferred_op": "reorder"
    },
    {
        "art_file": "confectionery_gummy_drops_1787877935174.jpg",
        "id": "fresh_v5_gummy_candies_010",
        "title": "Sugar Dusted Fruit Gummy Drops on Slate",
        "base_dest": "public/levels/fresh_v5_gummy_candies_010_base.jpg",
        "preferred_op": "remove"
    }
]

def main():
    print("================================================================================")
    print("🚀 PROCESSING 10 NEW ULTRA-DENSE BASE SCENES WITH UPGRADED PIPELINE")
    print("================================================================================")

    # 1. Copy files
    for sc in SCENES:
        src = os.path.join(ARTIFACT_DIR, sc["art_file"])
        if os.path.exists(src):
            shutil.copyfile(src, sc["base_dest"])
            print(f"Copied {sc['art_file']} -> {sc['base_dest']}")

    scheduler = OperationScheduler()
    accepted = []

    for sc in SCENES:
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
