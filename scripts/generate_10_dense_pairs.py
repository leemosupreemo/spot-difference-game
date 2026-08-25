"""
GENERATE 10 DENSE MULTI-OPERATION PUZZLE PAIRS
================================================================================
Generates 10 new distinct difference pairs on our 10 ultra-dense AI canvases (100–300 objects each),
covering:
- 4 RECOLOR (fine CIELAB tone shifts on dense repeated parts)
- 3 REMOVE (seamless inpainting of 1 item from repeated families of 5+ items)
- 3 ADD (seamless cloning of donor items into unoccupied nearby slots with contact shadows)
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

def run_dense_generation():
    print("=" * 80)
    print("GENERATING 10 NEW ULTRA-DENSE MULTI-OPERATION PUZZLE PAIRS")
    print("=" * 80)

    model = FastSAM("FastSAM-s.pt")

    dense_scenes = [
        # 1. Electronics PCB Bench -> REMOVE (1 resistor from ladder array of 12 resistors)
        {
            "id": "dense_ai_electronics_resistor_remove_001",
            "title": "[AI Dense Remove] Antistatic PCB Bench Missing Resistor",
            "image_path": "public/levels/ai_electronics_pcb_base.jpg",
            "operation": "remove",
            "difficulty": "Hard",
            "desc": "Single through-hole carbon film resistor missing from the circuit board component array",
            "hint": "Check the cluster of small through-hole resistors on the circuit board"
        },
        # 2. Watchmaker Horology Tray -> ADD (1 extra brass cog gear in gear array)
        {
            "id": "dense_ai_watchmaker_gear_add_002",
            "title": "[AI Dense Add] Watchmaker Parts Tray Extra Brass Gear",
            "image_path": "public/levels/ai_watchmaker_parts_base.jpg",
            "operation": "add",
            "difficulty": "Hard",
            "desc": "Single additional toothed brass watch gear added to the parts tray",
            "hint": "Inspect the loose watch gears and movement wheels in the center tray"
        },
        # 3. Mechanic Master Workbench -> RECOLOR (pliers grip sleeve)
        {
            "id": "dense_ai_mechanic_tool_recolor_003",
            "title": "[AI Dense Recolor] Master Mechanic Workbench Pliers Grip",
            "image_path": "public/levels/ai_mechanic_workbench_base.jpg",
            "operation": "recolor",
            "difficulty": "Hard",
            "hue_direction_deg": 55.0,
            "desc": "Single pliers insulated rubber grip sleeve tone shifted in CIELAB",
            "hint": "Examine the insulated tool grips across the master workbench"
        },
        # 4. Tailor Notions Box -> RECOLOR (wooden thread spool fiber wrap)
        {
            "id": "dense_ai_sewing_spool_recolor_004",
            "title": "[AI Dense Recolor] Tailor Notions Box Cotton Thread Spool",
            "image_path": "public/levels/ai_sewing_notions_base.jpg",
            "operation": "recolor",
            "difficulty": "Hard",
            "hue_direction_deg": 50.0,
            "desc": "Single wooden thread spool cotton fibers tone shifted in CIELAB",
            "hint": "Check the rows of colorful thread spools in the compartmentalized tray"
        },
        # 5. Miniature Painter Desk -> REMOVE (1 dropper bottle from paint rack)
        {
            "id": "dense_ai_miniature_bottle_remove_005",
            "title": "[AI Dense Remove] Miniature Painter Desk Missing Paint Dropper",
            "image_path": "public/levels/ai_miniature_painter_base.jpg",
            "operation": "remove",
            "difficulty": "Hard",
            "desc": "Single acrylic hobby paint dropper bottle missing from the paint rack array",
            "hint": "Look closely at the rows of acrylic paint dropper bottles"
        },
        # 6. Retro Gaming Desk -> ADD (1 extra retro cartridge in game stack)
        {
            "id": "dense_ai_retro_cart_add_006",
            "title": "[AI Dense Add] Retro Gaming Desk Extra Game Cartridge",
            "image_path": "public/levels/ai_retro_gaming_base.jpg",
            "operation": "add",
            "difficulty": "Hard",
            "desc": "Single additional vintage game cartridge added alongside the cartridge array",
            "hint": "Scan the retro game cartridges and memory cards on the desk"
        },
        # 7. Fine Art Studio Taboret -> REMOVE (1 pastel stick from 12-stick set)
        {
            "id": "dense_ai_artist_pastel_remove_007",
            "title": "[AI Dense Remove] Fine Art Studio Missing Pastel Stick",
            "image_path": "public/levels/ai_artist_palette_base.jpg",
            "operation": "remove",
            "difficulty": "Hard",
            "desc": "Single soft pastel stick missing from the wooden easel tray",
            "hint": "Inspect the pastel sticks and paint supplies in the easel tray"
        },
        # 8. Woodworking Joinery Bench -> RECOLOR (chisel brass ferrule)
        {
            "id": "dense_ai_woodworking_chisel_recolor_008",
            "title": "[AI Dense Recolor] Woodworking Bench Chisel Brass Ferrule",
            "image_path": "public/levels/ai_woodworking_bench_base.jpg",
            "operation": "recolor",
            "difficulty": "Hard",
            "hue_direction_deg": 50.0,
            "desc": "Single carving gouge brass ferrule ring tone shifted in CIELAB",
            "hint": "Look closely at the brass ferrules on the woodworking chisels and gouges"
        },
        # 9. Leathercraft Artisan Bench -> ADD (1 extra steel hole punch die)
        {
            "id": "dense_ai_leather_punch_add_009",
            "title": "[AI Dense Add] Leather Artisan Bench Extra Punch Die",
            "image_path": "public/levels/ai_leathercraft_base.jpg",
            "operation": "add",
            "difficulty": "Hard",
            "desc": "Single additional steel round hole punch tool added to the workbench array",
            "hint": "Check the collection of steel hole punch dies and bevelers"
        },
        # 10. Greenhouse Potting Bench -> RECOLOR (seedling tag label)
        {
            "id": "dense_ai_gardener_tag_recolor_010",
            "title": "[AI Dense Recolor] Greenhouse Potting Bench Plant Tag",
            "image_path": "public/levels/ai_gardener_potting_base.jpg",
            "operation": "recolor",
            "difficulty": "Hard",
            "hue_direction_deg": 55.0,
            "desc": "Single colorful garden plant marker tag tone shifted in CIELAB",
            "hint": "Examine the plant marker tags on the seedling pots"
        }
    ]

    manifest_path = "public/levels/photo_pair_manifest.json"
    manifest = []
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            manifest = json.load(f)

    approved_entries = []

    for scene in dense_scenes:
        print(f"\n{'='*20} Generating: {scene['id']} ({scene['title']}) {'='*20}")
        img_path = scene["image_path"]
        if not os.path.exists(img_path):
            print(f"❌ Missing base image: {img_path}")
            continue

        img_bgr = cv2.imread(img_path)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        h, w = img_bgr.shape[:2]

        # Scene QA & Affordance
        router_res = SceneAffordanceRouter.evaluate_and_route_canvas(
            img_path, target_mix_preference=scene["operation"]
        )
        if not router_res["approved"]:
            print(f"❌ Scene QA Rejection: {router_res['reason']}")
            continue

        op = scene["operation"]
        candidate_masks = router_res["candidate_masks"]
        peer_groups = router_res["peer_groups"]
        print(f"✓ Scene QA Approved! (Objects: {router_res['object_count']}, Peers: {len(peer_groups)} groups)")

        sam_results = model(img_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.20, iou=0.65, verbose=False)
        raw_sam_masks = sam_results[0].masks.data.cpu().numpy()

        passed = False
        variant_bgr = None
        final_info = None

        if op == "recolor":
            target_info, sel_reason, feasible_candidates = GoldilocksTargetSelector.select_best_goldilocks_target(
                img_bgr, raw_sam_masks, target_difficulty="Hard"
            )
            if not feasible_candidates:
                print(f"❌ Goldilocks Selection Rejection: {sel_reason}")
                continue

            for cand in feasible_candidates[:5]:
                p, v_rgb, f_info, q_msg = AdaptiveSpotabilityLoop.generate_and_calibrate(
                    image_rgb=img_rgb,
                    mask=cand["mask"],
                    target_bbox=cand["bbox"],
                    difficulty="Hard",
                    hue_direction_deg=scene.get("hue_direction_deg", 50.0),
                    clutter_multiplier=cand["local_clutter_mult"]
                )
                if p:
                    passed = True
                    variant_bgr = cv2.cvtColor(v_rgb, cv2.COLOR_RGB2BGR)
                    final_info = f_info
                    print(f"✓ {q_msg} (Spotability: {f_info['spotability']}, Area: {f_info['area_pct']}%)")
                    break

        elif op == "remove":
            best_target, sel_msg, feasible_cands = RemoveTargetSelector.select_best_remove_target(
                img_bgr, candidate_masks, peer_groups, target_difficulty="Hard"
            )
            if not feasible_cands:
                print(f"❌ Remove Selection Rejection: {sel_msg}")
                continue

            for cand in feasible_cands[:5]:
                c_data = cand["candidate"]
                p, v_bgr, f_info, q_msg = RemoveTargetSelector.execute_removal_and_qa(
                    img_bgr, c_data["mask"], c_data["bbox"]
                )
                if p:
                    passed = True
                    variant_bgr = v_bgr
                    final_info = f_info
                    print(f"✓ {q_msg}")
                    break

        elif op == "add":
            best_pair, sel_msg, feasible_pairs = AddTargetSelector.find_best_add_pair(
                img_bgr, candidate_masks, peer_groups, raw_sam_masks, target_difficulty="Hard"
            )
            if not feasible_pairs:
                print(f"❌ Add Selection Rejection: {sel_msg}")
                continue

            for pair in feasible_pairs[:5]:
                donor = pair["donor"]
                p, v_bgr, f_info, q_msg = AddTargetSelector.execute_add_and_qa(
                    img_bgr, pair["donor_bbox"], pair["slot_bbox"], donor["mask"]
                )
                if p:
                    passed = True
                    variant_bgr = v_bgr
                    final_info = f_info
                    print(f"✓ {q_msg}")
                    break

        if not passed:
            print("❌ QA rejected all candidate attempts.")
            continue

        # Save Level Images & Register
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
        print(f"\n🎉 Successfully calibrated and registered {len(approved_entries)} dense multi-operation AI pairs!")

    print(f"🎉 Pipeline Finished! {len(approved_entries)} / {len(dense_scenes)} passed all QA gates.")

if __name__ == "__main__":
    run_dense_generation()
