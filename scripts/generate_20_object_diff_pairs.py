"""
GENERATE 20 OBJECT-CHANGE-ONLY DIFFERENCE PAIRS (2 PER BASE SCENE)
================================================================================
Strictly NO recoloring. Only object changes (remove, add, reorder, swap).
Generates 2 completely distinct, verified difference pairs for each of the 10
new ultra-dense base canvases.
================================================================================
"""

import os
import sys
import json
import shutil
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from unified_operation_pipeline import generate_single_scene_difference

ARTIFACT_DIR = "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49"

SCENES = [
    {
        "art_file": "paper_clips_spilt_floor_1787877795005.jpg",
        "scene_name": "paper_clips",
        "title": "Spilled Paperclips on Concrete",
        "base_file": "fresh_v5_paper_clips_001_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "pickup_sticks_game_1787877807622.jpg",
        "scene_name": "pickup_sticks",
        "title": "Tangled Pick Up Sticks on Green Felt",
        "base_file": "fresh_v5_pickup_sticks_002_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "vintage_buttons_tin_1787877820735.jpg",
        "scene_name": "vintage_buttons",
        "title": "Antique Mother of Pearl & Bakelite Buttons",
        "base_file": "fresh_v5_vintage_buttons_003_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "assorted_sewing_threads_pins_1787877834306.jpg",
        "scene_name": "sewing_notions",
        "title": "Silk Thread Spools & Safety Pins",
        "base_file": "fresh_v5_sewing_notions_004_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "colored_pencils_shavings_1787877850658.jpg",
        "scene_name": "colored_pencils",
        "title": "Rainbow Colored Pencils & Wood Shavings",
        "base_file": "fresh_v5_colored_pencils_005_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "boardgame_dice_meeples_1787877873320.jpg",
        "scene_name": "boardgame_meeples",
        "title": "Wooden Meeples & Polyhedral RPG Dice",
        "base_file": "fresh_v5_boardgame_meeples_006_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "dry_pasta_varieties_1787877887709.jpg",
        "scene_name": "dry_pasta",
        "title": "Italian Tricolor Dry Pasta on Slate",
        "base_file": "fresh_v5_dry_pasta_007_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "gemstone_beads_wire_1787877903078.jpg",
        "scene_name": "gemstone_beads",
        "title": "Jewelry Maker Gemstone Beads & Findings",
        "base_file": "fresh_v5_gemstone_beads_008_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "antique_keys_tags_1787877919132.jpg",
        "scene_name": "antique_keys",
        "title": "Intricate Antique Skeleton Keys on Leather",
        "base_file": "fresh_v5_antique_keys_009_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    },
    {
        "art_file": "confectionery_gummy_drops_1787877935174.jpg",
        "scene_name": "gummy_candies",
        "title": "Sugar Dusted Fruit Gummy Drops on Slate",
        "base_file": "fresh_v5_gummy_candies_010_base.jpg",
        "allowed_ops": ["remove", "reorder", "add"]
    }
]

def main():
    print("================================================================================")
    print("🚀 GENERATING 20 OBJECT-CHANGE DIFFERENCE PAIRS (2 PER BASE SCENE)")
    print("   Allowed Operations: REMOVE, REORDER, ADD (Zero Recoloring)")
    print("================================================================================")

    output_dir = "public/levels"
    all_accepted = []

    # 1. Copy base images from artifact directory
    for sc in SCENES:
        src = os.path.join(ARTIFACT_DIR, sc["art_file"])
        dest = os.path.join(output_dir, sc["base_file"])
        if os.path.exists(src):
            shutil.copyfile(src, dest)
            print(f"Copied {sc['art_file']} -> {sc['base_file']}")

    # 2. For each scene, generate 2 distinct object-change pairs
    for sc in SCENES:
        print(f"\n--- Processing Scene [{sc['scene_name']}] ({sc['title']}) ---")
        scene_pairs = []
        base_path = os.path.join(output_dir, sc["base_file"])

        # Try operations across allowed_ops
        for op in sc["allowed_ops"]:
            if len(scene_pairs) >= 2:
                break
            pair_num = len(scene_pairs) + 1
            pair_id = f"fresh_v5_{sc['scene_name']}_pair{pair_num}"

            spec = {
                "id": pair_id,
                "title": f"{sc['title']} (Difference {pair_num})",
                "image_path": base_path,
                "category": "Photography",
                "packId": "find_the_sniper",
                "preferred_op": op
            }

            success, result, log_entry = generate_single_scene_difference(spec, difficulty="Medium")
            if success and result:
                gt = result["diffs"][0]
                # Check that it is an object change (not recolor)
                if result.get("operation") != "recolor":
                    scene_pairs.append(result)
                    print(f"  ✅ Pair {pair_num} ACCEPTED: Op={result['operation']} | GT=({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
                else:
                    print(f"  ⚠️ Pair skipped because operation was recolor.")
            else:
                print(f"  ❌ Op {op} failed: {log_entry.get('rejection_reason')}")

        # If we need another pair, try different op
        if len(scene_pairs) < 2:
            for op in reversed(sc["allowed_ops"]):
                if len(scene_pairs) >= 2:
                    break
                # Try with different operation
                pair_num = len(scene_pairs) + 1
                pair_id = f"fresh_v5_{sc['scene_name']}_pair{pair_num}"
                spec = {
                    "id": pair_id,
                    "title": f"{sc['title']} (Difference {pair_num})",
                    "image_path": base_path,
                    "category": "Photography",
                    "packId": "find_the_sniper",
                    "preferred_op": op
                }
                success, result, log_entry = generate_single_scene_difference(spec, difficulty="Medium")
                if success and result and result.get("operation") != "recolor":
                    scene_pairs.append(result)
                    gt = result["diffs"][0]
                    print(f"  ✅ Pair {pair_num} (retry) ACCEPTED: Op={result['operation']} | GT=({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")

        all_accepted.extend(scene_pairs)
        print(f"Scene [{sc['scene_name']}] complete: {len(scene_pairs)}/2 pairs generated.")

    print("\n================================================================================")
    print(f"Total object-change pairs generated: {len(all_accepted)}/20")
    print("================================================================================")

    if all_accepted:
        manifest_path = "public/levels/photo_pair_manifest.json"
        with open(manifest_path, "r") as f:
            manifest = json.load(f)

        new_ids = {a["id"] for a in all_accepted}
        manifest = [m for m in manifest if m["id"] not in new_ids]
        manifest = all_accepted + manifest

        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        print(f"🎉 Prepend-saved {len(all_accepted)} pairs to top of manifest. Total manifest levels: {len(manifest)}")

if __name__ == "__main__":
    main()
