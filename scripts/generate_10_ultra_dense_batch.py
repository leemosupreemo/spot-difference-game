"""
GENERATION OF 10 ULTRA-DENSE MULTI-OBJECT PUZZLE PAIRS
================================================================================
Uses the 10 newly rendered 150-360 object base canvases:
1. Glass Marbles (360 objects) -> RECOLOR (Bold Crimson -> Emerald, Delta-E 60)
2. Vintage Button Tray (240 objects) -> RECOLOR (Amber -> Cobalt, Delta-E 60)
3. Board Game Tokens (220 objects) -> REMOVE (Full Meeple)
4. Gourmet Candies (280 objects) -> RECOLOR (Cherry -> Electric Green, Delta-E 65)
5. Electronics Resistors (250 objects) -> ADD (Extra Resistor)
6. Watchmaker Cogs & Jewels (260 objects) -> RECOLOR (Ruby -> Emerald, Delta-E 55)
7. Faceted Gemstones (220 objects) -> REMOVE (Full Sapphire)
8. Hardware Nuts & Washers (240 objects) -> RECOLOR (Brass -> Chrome, Delta-E 50)
9. Artist Paint Palette (200 objects) -> REMOVE (Full Paint Dollop)
10. Retro Enamel Pins (190 objects) -> RECOLOR (Green -> Tangerine, Delta-E 55)
================================================================================
"""

import cv2
import numpy as np
import os
import json
from ultralytics import FastSAM

from scene_affordance_router import SceneAffordanceRouter
from goldilocks_target_selector import GoldilocksTargetSelector
from remove_target_selector import RemoveTargetSelector
from add_target_selector import AddTargetSelector
from sam_segment_recolor import AdaptiveSpotabilityLoop

def run_ultra_dense_batch():
    print("=" * 80)
    print("GENERATING 10 ULTRA-DENSE MULTI-OBJECT LEVELS (150-360 OBJECTS EACH)")
    print("=" * 80)

    model = FastSAM("FastSAM-s.pt")

    scenes = [
        # 1. Pile of Glass Marbles -> RECOLOR
        {
            "id": "dense_marbles_recolor_001",
            "title": "[Ultra-Dense] Pile of 360 Glass Marbles",
            "image_path": "public/levels/dense_pile_marbles_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 65.0,
            "desc": "Single swirling glass marble color shifted",
            "hint": "Scan through the glass marble pile for a bold color change"
        },
        # 2. Button Sorting Tray -> RECOLOR
        {
            "id": "dense_buttons_recolor_002",
            "title": "[Ultra-Dense] Vintage 240-Button Sorting Tray",
            "image_path": "public/levels/dense_button_tray_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 70.0,
            "desc": "Single vintage sew-through button color shifted",
            "hint": "Inspect the buttons in the sorting tray for a tone change"
        },
        # 3. Board Game Tokens -> REMOVE
        {
            "id": "dense_boardgame_remove_003",
            "title": "[Ultra-Dense] 220 Board Game Meeples & Dice",
            "image_path": "public/levels/dense_boardgame_tokens_base.jpg",
            "preferred_op": "remove",
            "difficulty": "Medium",
            "desc": "Single wooden meeple token missing from the game collection",
            "hint": "Check the colorful meeples and dice across the green felt"
        },
        # 4. Gourmet Candies & Jelly Beans -> RECOLOR
        {
            "id": "dense_candies_recolor_004",
            "title": "[Ultra-Dense] 280 Gourmet Candies & Jelly Beans",
            "image_path": "public/levels/dense_gourmet_candies_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 65.0,
            "desc": "Single glossy jelly bean color shifted",
            "hint": "Scan the glossy fruit drops and jelly beans"
        },
        # 5. Electronics Resistors -> ADD
        {
            "id": "dense_resistors_add_005",
            "title": "[Ultra-Dense] 250 Precision Electronics Resistors",
            "image_path": "public/levels/dense_resistors_base.jpg",
            "preferred_op": "add",
            "difficulty": "Medium",
            "desc": "Single additional color-banded resistor added to the array",
            "hint": "Look closely at the rows of through-hole resistors on the mat"
        },
        # 6. Watchmaker Cogs & Ruby Jewels -> RECOLOR
        {
            "id": "dense_watchmaker_recolor_006",
            "title": "[Ultra-Dense] 260 Watchmaker Cogs & Ruby Jewels",
            "image_path": "public/levels/dense_watchmaker_cogs_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 60.0,
            "desc": "Single watchmaker ruby jewel bearing tone shifted",
            "hint": "Examine the precision cogs and ruby jewels in the tray"
        },
        # 7. Faceted Gemstones -> REMOVE
        {
            "id": "dense_gemstones_remove_007",
            "title": "[Ultra-Dense] 220 Faceted Gemstones on Velvet",
            "image_path": "public/levels/dense_gemstone_facets_base.jpg",
            "preferred_op": "remove",
            "difficulty": "Medium",
            "desc": "Single faceted cut gemstone missing from the velvet tray",
            "hint": "Scan the sparkling faceted gems on the black velvet"
        },
        # 8. Hardware Hex Nuts & Washers -> RECOLOR
        {
            "id": "dense_hardware_recolor_008",
            "title": "[Ultra-Dense] 240 Hardware Hex Nuts & Washers",
            "image_path": "public/levels/dense_hardware_nuts_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 60.0,
            "desc": "Single brass hex nut shifted to steel tone",
            "hint": "Check the brass hex nuts and washers in the organizer"
        },
        # 9. Artist Paint Palette -> REMOVE
        {
            "id": "dense_palette_remove_009",
            "title": "[Ultra-Dense] 200 Artist Oil Paint Dollops",
            "image_path": "public/levels/dense_artist_palette_base.jpg",
            "preferred_op": "remove",
            "difficulty": "Medium",
            "desc": "Single oil paint impasto dollop missing from the palette",
            "hint": "Inspect the swirl dollops of oil paint on the wooden palette"
        },
        # 10. Retro Enamel Pins -> RECOLOR
        {
            "id": "dense_pins_recolor_010",
            "title": "[Ultra-Dense] 190 Retro Enamel Badges & Pins",
            "image_path": "public/levels/dense_enamel_pins_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 60.0,
            "desc": "Single collector enamel pin center tone shifted",
            "hint": "Examine the retro enamel pins on the collection board"
        }
    ]

    manifest_entries = []
    success_count = 0

    for s_idx, scene in enumerate(scenes):
        print(f"\n==================== [{s_idx+1}/10] Processing: {scene['id']} ({scene['title']}) ====================")
        if not os.path.exists(scene["image_path"]):
            print(f"❌ Image path not found: {scene['image_path']}")
            continue

        img_bgr = cv2.imread(scene["image_path"])
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        h, w = img_bgr.shape[:2]

        # FastSAM segmentation
        results = model(img_rgb, device="cpu", retina_masks=True, imgsz=1024, conf=0.25, iou=0.85)
        raw_sam_masks = results[0].masks.data.cpu().numpy() if (results and results[0].masks is not None) else []
        print(f"  • FastSAM Segmented: {len(raw_sam_masks)} object masks")

        router_result = SceneAffordanceRouter.evaluate_and_route_canvas(scene["image_path"], target_mix_preference=scene["preferred_op"])
        peer_groups = router_result.get("peer_groups", [])
        candidate_masks = router_result.get("candidate_masks", [])

        op = scene["preferred_op"]
        diff_level = scene.get("difficulty", "Medium")

        passed = False
        variant_bgr = None
        final_info = None

        if op == "recolor":
            target_info, selection_reason, feasible_candidates = GoldilocksTargetSelector.select_best_goldilocks_target(
                img_bgr, raw_sam_masks, target_difficulty=diff_level
            )
            if not feasible_candidates:
                print(f"❌ Goldilocks Selection Rejection: {selection_reason}")
                continue
            print(f"✓ {selection_reason}")

            for cand in feasible_candidates[:5]:
                p, v_rgb, f_info, q_msg = AdaptiveSpotabilityLoop.generate_and_calibrate(
                    image_rgb=img_rgb,
                    mask=cand["mask"],
                    target_bbox=cand["bbox"],
                    difficulty=diff_level,
                    hue_direction_deg=scene.get("hue_direction_deg", 65.0),
                    clutter_multiplier=cand["local_clutter_mult"]
                )
                if p:
                    passed = True
                    variant_bgr = cv2.cvtColor(v_rgb, cv2.COLOR_RGB2BGR)
                    final_info = f_info
                    print(f"✓ {q_msg}")
                    print(f"  • Spotability: {f_info['spotability']} | Area: {f_info['area_pct']}% | Centroid: ({f_info['x']}%, {f_info['y']}%)")
                    break

        elif op == "remove":
            best_target, sel_msg, feasible_cands = RemoveTargetSelector.select_best_remove_target(
                img_bgr, candidate_masks, peer_groups, target_difficulty=diff_level
            )
            if not feasible_cands:
                print(f"❌ Remove Target Selection Rejection: {sel_msg}")
                continue
            print(f"✓ {sel_msg}")

            for cand in feasible_cands[:5]:
                c_data = cand["candidate"]
                p, v_bgr, f_info, q_msg = RemoveTargetSelector.execute_removal_and_qa(
                    img_bgr, c_data["mask"], c_data["bbox"], difficulty=diff_level
                )
                if p:
                    passed = True
                    variant_bgr = v_bgr
                    final_info = f_info
                    print(f"✓ {q_msg}")
                    break

        elif op == "add":
            best_pair, sel_msg, feasible_pairs = AddTargetSelector.find_best_add_pair(
                img_bgr, candidate_masks, peer_groups, raw_sam_masks, target_difficulty=diff_level
            )
            if not feasible_pairs:
                print(f"❌ Add Target Selection Rejection: {sel_msg}")
                continue
            print(f"✓ {sel_msg}")

            for pair in feasible_pairs[:5]:
                donor = pair["donor"]
                p, v_bgr, f_info, q_msg = AddTargetSelector.execute_add_and_qa(
                    img_bgr, pair["donor_bbox"], pair["slot_bbox"], donor["mask"], difficulty=diff_level
                )
                if p:
                    passed = True
                    variant_bgr = v_bgr
                    final_info = f_info
                    print(f"✓ {q_msg}")
                    break

        if not passed:
            print("❌ Operation Execution Rejected in QA.")
            continue

        base_name = f"{scene['id']}_base.jpg"
        var_name = f"{scene['id']}_variant.jpg"
        base_path = os.path.join("public/levels", base_name)
        var_path = os.path.join("public/levels", var_name)

        cv2.imwrite(base_path, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
        cv2.imwrite(var_path, variant_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])

        manifest_entry = {
            "id": scene["id"],
            "title": scene["title"],
            "pack": "Photography",
            "packId": "find_the_sniper",
            "category": "Photography",
            "difficulty": scene["difficulty"],
            "operation": op,
            "baseImage": f"/levels/{base_name}",
            "variantImage": f"/levels/{var_name}",
            "totalDifferences": 1,
            "diffs": [
                {
                    "id": 1,
                    "x": final_info["x"],
                    "y": final_info["y"],
                    "radius": final_info["radius"],
                    "description": scene["desc"],
                    "hint": scene["hint"],
                    "operation": op
                }
            ]
        }
        manifest_entries.append(manifest_entry)
        success_count += 1

    manifest_path = "public/levels/photo_pair_manifest.json"
    existing_manifest = []
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            existing_manifest = json.load(f)

    # Place new ultra dense levels at the front
    new_ids = {m["id"] for m in manifest_entries}
    filtered_existing = [m for m in existing_manifest if m["id"] not in new_ids]
    combined_manifest = manifest_entries + filtered_existing

    with open(manifest_path, "w") as f:
        json.dump(combined_manifest, f, indent=2)

    print(f"\n🎉 Successfully calibrated and registered {success_count}/10 ultra-dense multi-object levels!")

if __name__ == "__main__":
    run_ultra_dense_batch()
