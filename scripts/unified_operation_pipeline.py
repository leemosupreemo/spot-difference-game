"""
UNIFIED MULTI-OPERATION DIFFERENCE ENGINE (RECOLOR / REMOVE / ADD)
================================================================================
Orchestrates the entire next-generation pipeline across 10 AI base canvases:
1. Stage 1: Base Canvas QA & Affordance Scorecard (Recolor, Remove, Add).
2. Stage 2: Operation Router (Balances 40% Recolor, 30% Remove, 30% Add).
3. Stage 3: Operation-Specific Target Selector:
   - Recolor: GoldilocksTargetSelector (chroma, salience, Goldilocks ΔE width)
   - Remove:  RemoveTargetSelector (peer family, background recoverability, inpaint)
   - Add:     AddTargetSelector (peer family donor, empty slot search, contact shadow)
4. Stage 4: Operation-Specific QA Critic & Zero-Drift Clamping.
5. Stage 5: Manifest Registration & Web Sync.
================================================================================
"""

import os
import json
import cv2
import numpy as np
from ultralytics import FastSAM

from scene_affordance_router import SceneAffordanceRouter
from goldilocks_target_selector import GoldilocksTargetSelector
from remove_target_selector import RemoveTargetSelector
from add_target_selector import AddTargetSelector
from sam_segment_recolor import AdaptiveSpotabilityLoop

def execute_unified_pipeline():
    print("=" * 80)
    print("UNIFIED MULTI-OPERATION DIFFERENCE PIPELINE (RECOLOR / REMOVE / ADD)")
    print("=" * 80)

    model = FastSAM("FastSAM-s.pt")

    scenes = [
        # 1. Tailor Notions Box -> REMOVE (1 missing wooden thread spool from peer cluster)
        {
            "id": "verified_m_ai_sewing_remove_001",
            "title": "[AI Remove - Medium] Tailor Notions Box Missing Thread Spool",
            "image_path": "public/levels/ai_sewing_notions_base.jpg",
            "preferred_op": "remove",
            "difficulty": "Medium",
            "desc": "Single wooden cotton thread spool missing from the compartmentalized notions tray",
            "hint": "Inspect the wooden thread spools in the sorting compartments of the notions box"
        },
        # 2. Watchmaker Parts Tray -> RECOLOR (precision screwdriver collar)
        {
            "id": "verified_m_ai_watchmaker_recolor_002",
            "title": "[AI Recolor - Medium] Horologist Parts Tray Screwdriver Collar",
            "image_path": "public/levels/ai_watchmaker_parts_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 60.0,
            "desc": "Single precision screwdriver color collar shifted in CIELAB",
            "hint": "Examine the color-coded precision screwdrivers on the work pad"
        },
        # 3. Electronics Antistatic Bench -> ADD (1 extra through-hole capacitor in component row)
        {
            "id": "verified_m_ai_electronics_add_003",
            "title": "[AI Add - Medium] Electronics Antistatic Bench Extra Capacitor",
            "image_path": "public/levels/ai_electronics_pcb_base.jpg",
            "preferred_op": "add",
            "difficulty": "Medium",
            "desc": "Single additional electrolytic capacitor added to the component array",
            "hint": "Scan the electrolytic capacitors in the upper component tray"
        },
        # 4. Greenhouse Potting Bench -> REMOVE (1 missing plant marker tag)
        {
            "id": "verified_m_ai_gardener_remove_004",
            "title": "[AI Remove - Medium] Greenhouse Potting Bench Missing Plant Tag",
            "image_path": "public/levels/ai_gardener_potting_base.jpg",
            "preferred_op": "remove",
            "difficulty": "Medium",
            "desc": "Single colorful garden plant marker tag missing from the bench",
            "hint": "Check the plant marker tags on the potting bench"
        },
        # 5. Fine Art Studio Taboret -> RECOLOR (oil paint tube cap)
        {
            "id": "verified_m_ai_artist_recolor_005",
            "title": "[AI Recolor - Medium] Fine Art Studio Oil Paint Tube Cap",
            "image_path": "public/levels/ai_artist_palette_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 60.0,
            "desc": "Single artist oil paint tube cap tone shifted in CIELAB",
            "hint": "Inspect the row of oil paint tubes on the palette"
        },
        # 6. Woodworking Joinery Bench -> RECOLOR (carpenter marking pencil body)
        {
            "id": "verified_m_ai_woodworking_recolor_006",
            "title": "[AI Recolor - Medium] Woodworking Joinery Bench Carpenter Pencil",
            "image_path": "public/levels/ai_woodworking_bench_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 60.0,
            "desc": "Single wooden carpenter marking pencil tone shifted in CIELAB",
            "hint": "Look closely at the colored carpenter marking pencils"
        },
        # 7. Retro Gaming Desk -> RECOLOR (game cartridge shell)
        {
            "id": "verified_m_ai_retro_recolor_007",
            "title": "[AI Recolor - Medium] Retro Gaming Desk Cartridge Shell",
            "image_path": "public/levels/ai_retro_gaming_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 55.0,
            "desc": "Single vintage game cartridge shell tone shifted in CIELAB",
            "hint": "Scan the retro game cartridges and memory cards on the desk"
        },
        # 8. Wilderness Expedition Prep -> REMOVE (1 missing carabiner)
        {
            "id": "verified_m_ai_expedition_remove_008",
            "title": "[AI Remove - Medium] Expedition Prep Table Missing Carabiner",
            "image_path": "public/levels/ai_expedition_bushcraft_base.jpg",
            "preferred_op": "remove",
            "difficulty": "Medium",
            "desc": "Single locking carabiner missing from the gear array",
            "hint": "Check the carabiners and outdoor gear on the table"
        },
        # 9. Leathercraft Artisan Bench -> RECOLOR (waxed thread spool)
        {
            "id": "verified_m_ai_leathercraft_recolor_009",
            "title": "[AI Recolor - Medium] Leather Artisan Bench Waxed Thread Spool",
            "image_path": "public/levels/ai_leathercraft_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 50.0,
            "desc": "Single waxed linen thread spool shifted in CIELAB",
            "hint": "Inspect the collection of colored waxed thread spools"
        },
        # 10. Miniature Painter Desk -> RECOLOR (paint dropper bottle cap)
        {
            "id": "verified_m_ai_miniature_recolor_010",
            "title": "[AI Recolor - Medium] Miniature Painter Desk Paint Dropper Cap",
            "image_path": "public/levels/ai_miniature_painter_base.jpg",
            "preferred_op": "recolor",
            "difficulty": "Medium",
            "hue_direction_deg": 60.0,
            "desc": "Single acrylic hobby paint dropper bottle cap shifted in CIELAB",
            "hint": "Examine the rows of acrylic paint dropper bottles"
        }
    ]

    manifest_path = "public/levels/photo_pair_manifest.json"
    manifest = []
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            manifest = json.load(f)

    approved_entries = []

    for scene in scenes:
        print(f"\n{'='*20} Processing: {scene['id']} ({scene['title']}) {'='*20}")
        img_path = scene["image_path"]
        if not os.path.exists(img_path):
            print(f"❌ Missing base image: {img_path}")
            continue

        img_bgr = cv2.imread(img_path)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        h, w = img_bgr.shape[:2]

        # STAGE 1 & 2: Scene QA Scorecard & Affordance Routing
        router_res = SceneAffordanceRouter.evaluate_and_route_canvas(
            img_path, target_mix_preference=scene.get("preferred_op")
        )
        if not router_res["approved"]:
            print(f"❌ Scene QA Rejection: {router_res['reason']}")
            continue

        op = router_res["recommended_operation"]
        print(f"✓ Scene QA Approved! Affordances: Recolor={router_res['affordances']['recolor']}, Remove={router_res['affordances']['remove']}, Add={router_res['affordances']['add']}")
        print(f"✓ Routed Operation: [{op.upper()}] (Peers: {router_res['peer_group_count']} groups, Candidates: {router_res['candidate_count']})")

        candidate_masks = router_res["candidate_masks"]
        peer_groups = router_res["peer_groups"]

        # FastSAM raw masks for Add Target Selector
        sam_results = model(img_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.20, iou=0.65, verbose=False)
        raw_sam_masks = sam_results[0].masks.data.cpu().numpy()

        passed = False
        variant_bgr = None
        final_info = None

        diff_level = scene.get("difficulty", "Medium")

        # STAGE 3: Operation-Specific Target Selection & Execution
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
                    hue_direction_deg=scene.get("hue_direction_deg", 50.0),
                    clutter_multiplier=cand["local_clutter_mult"]
                )
                if p:
                    passed = True
                    variant_bgr = cv2.cvtColor(v_rgb, cv2.COLOR_RGB2BGR)
                    final_info = f_info
                    print(f"✓ {q_msg}")
                    print(f"  • Spotability: {f_info['spotability']} | Changed Area: {f_info['area_pct']}% | Centroid: ({f_info['x']}%, {f_info['y']}%)")
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

        # STAGE 4: Save Level Images & Register into Manifest
        base_name = f"{scene['id']}_base.jpg"
        var_name = f"{scene['id']}_variant.jpg"
        base_path = os.path.join("public/levels", base_name)
        var_path = os.path.join("public/levels", var_name)

        cv2.imwrite(base_path, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 94])
        cv2.imwrite(var_path, variant_bgr, [cv2.IMWRITE_JPEG_QUALITY, 94])

        entry = {
            "id": scene["id"],
            "title": scene["title"],
            "category": "Photography",
            "pack": "Photography",
            "packId": "find_the_sniper",
            "difficulty": scene["difficulty"],
            "operation": op,
            "baseImage": f"/levels/{base_name}",
            "variantImage": f"/levels/{var_name}",
            "diffs": [{
                "id": 1,
                "x": final_info["x"],
                "y": final_info["y"],
                "radius": final_info["radius"],
                "description": scene["desc"],
                "hint": scene["hint"]
            }]
        }
        approved_entries.append(entry)

    if approved_entries:
        new_id_set = {e["id"] for e in approved_entries}
        updated_manifest = approved_entries + [m for m in manifest if m["id"] not in new_id_set]
        with open(manifest_path, "w") as f:
            json.dump(updated_manifest, f, indent=2)
        print(f"\n🎉 Successfully calibrated and registered {len(approved_entries)} multi-operation AI pairs!")

    print(f"🎉 Pipeline Finished! {len(approved_entries)} / {len(scenes)} passed all multi-operation QA gates.")

if __name__ == "__main__":
    execute_unified_pipeline()
