"""
UNIFIED MULTI-OPERATION DIFFERENCE ENGINE (RECOLOR / REMOVE / ADD / REORDER)
================================================================================
Central Authoritative Production Pipeline for Spot-the-Difference Generation:
1. BaseImageQA & SceneAffordanceRouter: Evaluates base scene for 4 operations.
2. OperationScheduler: Enforces balanced accepted output mix (25% each) with quota deficit boost.
   - NO SILENT FALLBACK TO RECOLOR on failed operations.
   - Iterates through top candidate targets for the chosen operation before rejecting.
3. Operation-Specific Target Selectors:
   - Recolor: GoldilocksTargetSelector + PeerPaletteColorEngine (peer-relative palette)
   - Remove:  RemoveTargetSelector (peer family + gap-anomaly grid penalty)
   - Add:     AddTargetSelector (peer family + peer-spacing plausibility)
   - Reorder: ReorderTargetSelector (loose movable objects + compact local pose shift)
4. Two-Sided PerceptualVerificationEngine: Display resolution (700x440) + direct-look Goldilocks band.
5. Structured JSON Attempt Logging & Ground-Truth Manifest Registration.
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
from reorder_target_selector import ReorderTargetSelector
from perceptual_verification_engine import PerceptualVerificationEngine
from sam_segment_recolor import PeerPaletteColorEngine, AdaptiveSpotabilityLoop

DEFAULT_TARGET_MIX = {
    "recolor": 0.25,
    "remove": 0.25,
    "add": 0.25,
    "reorder": 0.25,
}

class OperationScheduler:
    """
    Tracks accepted output counts and dynamically balances the operation queue
    using quota deficit multipliers so no single operation dominates.
    """
    def __init__(self, target_mix=None):
        self.target_mix = target_mix or DEFAULT_TARGET_MIX
        self.accepted_counts = {op: 0 for op in self.target_mix}
        self.attempted_counts = {op: 0 for op in self.target_mix}
        self.success_history = {op: [] for op in self.target_mix}

    def record_attempt(self, op, success):
        self.attempted_counts[op] += 1
        self.success_history[op].append(1 if success else 0)
        if success:
            self.accepted_counts[op] += 1

    def select_operation_for_scene(self, affordances, preferred_op=None):
        """
        Calculates priority = affordance * deficit_multiplier * success_prior.
        Never forces an operation with affordance < 0.25.
        """
        total_accepted = max(1, sum(self.accepted_counts.values()))
        
        if preferred_op and preferred_op in affordances and affordances[preferred_op] >= 0.35:
            return preferred_op

        priorities = {}
        for op, target_ratio in self.target_mix.items():
            affordance = affordances.get(op, 0.0)
            if affordance < 0.25:
                priorities[op] = 0.0
                continue

            current_ratio = self.accepted_counts[op] / float(total_accepted)
            deficit = target_ratio - current_ratio
            deficit_mult = max(0.2, 1.0 + (deficit * 6.0))

            history = self.success_history[op][-10:]
            success_prior = (sum(history) + 2.0) / (len(history) + 3.0)

            priority = affordance * deficit_mult * success_prior
            priorities[op] = priority

        best_op = max(priorities, key=priorities.get)
        return best_op

def generate_single_scene_difference(scene_spec, scheduler=None, output_dir="public/levels", difficulty="Medium"):
    """
    Authoritative single-scene generator with candidate iteration.
    Enforces strict operation routing without silent fallback.
    Returns: (success: bool, result_entry: dict or None, log_entry: dict)
    """
    image_path = scene_spec["image_path"]
    scene_id = scene_spec["id"]
    title = scene_spec.get("title", f"Level {scene_id}")

    log_entry = {
        "scene_id": scene_id,
        "image_path": image_path,
        "difficulty": difficulty,
        "accepted": False,
        "rejection_reason": None
    }

    if not os.path.exists(image_path):
        log_entry["rejection_reason"] = f"Base image not found: {image_path}"
        return False, None, log_entry

    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        log_entry["rejection_reason"] = f"Failed to decode image: {image_path}"
        return False, None, log_entry

    h, w = img_bgr.shape[:2]

    # 1. Base Image QA & Affordance Routing
    qa_res = SceneAffordanceRouter.evaluate_and_route_canvas(image_path)
    if not qa_res["approved"]:
        log_entry["rejection_reason"] = qa_res["reason"]
        return False, None, log_entry

    affordances = qa_res["affordances"]
    candidate_masks = qa_res["candidate_masks"]
    peer_groups = qa_res["peer_groups"]
    raw_masks = qa_res.get("raw_masks", [])

    log_entry["affordances"] = affordances
    log_entry["candidate_count"] = len(candidate_masks)
    log_entry["peer_group_count"] = len(peer_groups)

    # 2. Select Operation
    preferred_op = scene_spec.get("preferred_op")
    if scheduler:
        chosen_op = scheduler.select_operation_for_scene(affordances, preferred_op)
    else:
        chosen_op = preferred_op if preferred_op in affordances else qa_res["recommended_operation"]

    log_entry["operation_selected"] = chosen_op

    variant_bgr = None
    ground_truth = None
    op_success = False
    op_reason = ""

    # 3. Execute Selected Operation with Candidate Iteration
    if chosen_op == "recolor":
        descriptors = [GoldilocksTargetSelector.extract_shape_descriptor(c["mask"]) for c in candidate_masks]
        peer_counts = GoldilocksTargetSelector.find_visual_peers(descriptors)
        for i, c in enumerate(candidate_masks):
            c["peer_count"] = peer_counts[i]
            frac, _, _ = GoldilocksTargetSelector.compute_recolorable_fraction(img_bgr, c["mask"])
            c["recolorable_fraction"] = frac
            c["baseline_salience"] = GoldilocksTargetSelector.compute_baseline_salience(img_bgr, c["mask"])

        disp_scale_x = 700.0 / float(w)
        disp_scale_y = 440.0 / float(h)
        valid_recolor_cands = []
        for c in candidate_masks:
            if c["recolorable_fraction"] < 0.40 or c["peer_count"] < 1 or c["area_pct"] < 0.15 or c["area_pct"] > 0.75:
                continue
            bw = c["bbox"][2] - c["bbox"][0] + 1
            bh = c["bbox"][3] - c["bbox"][1] + 1
            d_short = min(bw * disp_scale_x, bh * disp_scale_y)
            if 18.0 <= d_short <= 42.0:
                valid_recolor_cands.append(c)

        if not valid_recolor_cands:
            log_entry["rejection_reason"] = "Recolor: No suitable Goldilocks recolor candidates with peers and valid chroma."
            if scheduler: scheduler.record_attempt(chosen_op, False)
            return False, None, log_entry

        valid_recolor_cands.sort(key=lambda x: x["peer_count"] * 10.0 + x["recolorable_fraction"] * 5.0, reverse=True)

        for cand in valid_recolor_cands[:5]:
            target_mask = cand["mask"]
            target_bbox = cand["bbox"]
            peer_masks = [c["mask"] for c in candidate_masks if c["idx"] != cand["idx"] and c["peer_count"] >= 1]

            target_delta_e = 24.0 if difficulty == "Medium" else (18.0 if difficulty == "Hard" else 30.0)
            default_hue = scene_spec.get("hue_direction_deg", 50.0)

            var_candidate, actual_de, color_metrics = PeerPaletteColorEngine.shift_color_peer_relative(
                img_bgr, target_mask, peer_masks=peer_masks, target_delta_e=target_delta_e, default_hue_deg=default_hue
            )

            bx1, by1, bx2, by2 = target_bbox
            pad = int(max(bx2 - bx1, by2 - by1) * 0.25)
            rx1, ry1 = max(0, bx1 - pad), max(0, by1 - pad)
            rx2, ry2 = min(w, bx2 + pad), min(h, by2 + pad)
            clamped_var = img_bgr.copy()
            clamped_var[ry1:ry2, rx1:rx2] = var_candidate[ry1:ry2, rx1:rx2]

            v_passed, v_metrics, v_reason, v_code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                img_bgr, clamped_var, target_bbox, operation="recolor", difficulty=difficulty
            )
            if v_passed:
                variant_bgr = clamped_var
                cx_pct = round(float(bx1 + bx2) / 2.0 / float(w) * 100.0, 1)
                cy_pct = round(float(by1 + by2) / 2.0 / float(h) * 100.0, 1)
                span_x = (bx2 - bx1 + 1) / float(w) * 100.0
                span_y = (by2 - by1 + 1) / float(h) * 100.0
                radius = round(max(4.5, min(7.5, max(span_x, span_y) / 2.0 + 1.2)), 1)
                ground_truth = {
                    "x": cx_pct,
                    "y": cy_pct,
                    "radius": radius,
                    "bbox": target_bbox,
                    "metrics": {**v_metrics, **color_metrics}
                }
                op_success = True
                op_reason = v_reason
                break
            else:
                op_reason = f"Recolor QA Reject ({v_code}): {v_reason}"

    elif chosen_op == "remove":
        best_cand, select_reason, all_cands = RemoveTargetSelector.select_best_remove_target(
            img_bgr, candidate_masks, peer_groups, target_difficulty=difficulty
        )
        if not all_cands:
            log_entry["rejection_reason"] = f"Remove: {select_reason}"
            if scheduler: scheduler.record_attempt(chosen_op, False)
            return False, None, log_entry

        for cand_item in all_cands[:5]:
            target_c = cand_item["candidate"]
            passed, var_img, gt, reason = RemoveTargetSelector.execute_removal_and_qa(
                img_bgr, target_c["mask"], target_c["bbox"], difficulty=difficulty
            )
            if passed:
                variant_bgr = var_img
                ground_truth = gt
                op_success = True
                op_reason = reason
                break
            else:
                op_reason = reason

    elif chosen_op == "add":
        best_pair, select_reason, all_pairs = AddTargetSelector.find_best_add_pair(
            img_bgr, candidate_masks, peer_groups, raw_masks, target_difficulty=difficulty
        )
        if not all_pairs:
            log_entry["rejection_reason"] = f"Add: {select_reason}"
            if scheduler: scheduler.record_attempt(chosen_op, False)
            return False, None, log_entry

        for pair in all_pairs[:6]:
            passed, var_img, gt, reason = AddTargetSelector.execute_add_and_qa(
                img_bgr, pair["donor_bbox"], pair["slot_bbox"], pair["donor"]["mask"], difficulty=difficulty
            )
            if passed:
                variant_bgr = var_img
                ground_truth = gt
                op_success = True
                op_reason = reason
                break
            else:
                op_reason = reason

    elif chosen_op == "reorder":
        best_target, select_reason, all_targets = ReorderTargetSelector.find_best_reorder_target(
            img_bgr, candidate_masks, peer_groups, raw_masks, target_difficulty=difficulty
        )
        if not all_targets:
            log_entry["rejection_reason"] = f"Reorder: {select_reason}"
            if scheduler: scheduler.record_attempt(chosen_op, False)
            return False, None, log_entry

        for target_item in all_targets[:6]:
            cand = target_item["candidate"]
            passed, var_img, gt, reason = ReorderTargetSelector.execute_reorder_and_qa(
                img_bgr, cand["mask"], cand["bbox"], target_item["best_mutation"], target_item["union_bbox"], difficulty=difficulty
            )
            if passed:
                variant_bgr = var_img
                ground_truth = gt
                op_success = True
                op_reason = reason
                break
            else:
                op_reason = reason

    else:
        log_entry["rejection_reason"] = f"Unknown operation: {chosen_op}"
        return False, None, log_entry

    if not op_success:
        log_entry["rejection_reason"] = op_reason
        if scheduler: scheduler.record_attempt(chosen_op, False)
        return False, None, log_entry

    # 4. Save Image Files & Build Manifest Entry
    base_filename = f"{scene_id}_base.jpg"
    variant_filename = f"{scene_id}_variant.jpg"
    base_save_path = os.path.join(output_dir, base_filename)
    variant_save_path = os.path.join(output_dir, variant_filename)

    cv2.imwrite(base_save_path, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    cv2.imwrite(variant_save_path, variant_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])

    desc = scene_spec.get("desc", f"Single {chosen_op} difference")
    hint = scene_spec.get("hint", f"Look closely for a {chosen_op} difference")

    manifest_entry = {
        "id": scene_id,
        "title": title,
        "category": "Photography",
        "pack": "Photography",
        "packId": "find_the_sniper",
        "difficulty": difficulty,
        "baseImage": f"/levels/{base_filename}",
        "variantImage": f"/levels/{variant_filename}",
        "operation": chosen_op,
        "diffs": [{
            "id": 1,
            "x": ground_truth["x"],
            "y": ground_truth["y"],
            "radius": ground_truth["radius"],
            "description": desc,
            "hint": hint,
            "operation": chosen_op
        }]
    }

    if scheduler:
        scheduler.record_attempt(chosen_op, True)

    log_entry["accepted"] = True
    log_entry["operation_executed"] = chosen_op
    log_entry["ground_truth"] = ground_truth
    log_entry["qa_summary"] = op_reason

    return True, manifest_entry, log_entry

def generate_batch(scenes, target_mix=None, output_dir="public/levels", manifest_path="public/levels/photo_pair_manifest.json"):
    """
    Central Authoritative Batch Generation Function.
    Iterates across candidate scenes, balances the 4 operations, and writes the manifest.
    """
    print("=" * 80)
    print("AUTHORITATIVE MULTI-OPERATION GENERATION PIPELINE")
    print("Target Mix:", target_mix or DEFAULT_TARGET_MIX)
    print("=" * 80)

    scheduler = OperationScheduler(target_mix=target_mix)
    accepted_entries = []
    attempt_logs = []

    for idx, scene_spec in enumerate(scenes):
        print(f"\n[{idx+1}/{len(scenes)}] Processing scene: {scene_spec['id']}...")
        success, entry, log_info = generate_single_scene_difference(
            scene_spec, scheduler=scheduler, output_dir=output_dir, difficulty=scene_spec.get("difficulty", "Medium")
        )
        attempt_logs.append(log_info)

        if success:
            accepted_entries.append(entry)
            print(f"  ✓ ACCEPTED [{entry['operation'].upper()}]: {entry['title']}")
            print(f"    Centroid: ({entry['diffs'][0]['x']}%, {entry['diffs'][0]['y']}%), Radius: {entry['diffs'][0]['radius']}%")
            print(f"    Current Accepted Mix: {scheduler.accepted_counts}")
        else:
            print(f"  ✗ REJECTED: {log_info['rejection_reason']}")

    # Prepend accepted entries to manifest
    if accepted_entries and os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            existing_manifest = json.load(f)

        new_ids = set(e["id"] for e in accepted_entries)
        updated_manifest = accepted_entries + [e for e in existing_manifest if e["id"] not in new_ids]

        with open(manifest_path, "w") as f:
            json.dump(updated_manifest, f, indent=2)

        print(f"\n🎉 Successfully updated manifest with {len(accepted_entries)} accepted levels! Total entries: {len(updated_manifest)}")

    print("\nFINAL BATCH ACCEPTANCE REPORT:")
    print(f"Total Attempted: {len(scenes)}")
    print(f"Total Accepted:  {len(accepted_entries)}")
    print(f"Operation Mix:   {scheduler.accepted_counts}")

    return accepted_entries, attempt_logs, scheduler.accepted_counts

if __name__ == "__main__":
    test_scenes = [
        {"id": "pipe_v3_sewing_remove_001", "title": "[AI Remove] Tailor Notions Box Missing Spool", "image_path": "public/levels/ai_sewing_notions_base.jpg", "preferred_op": "remove", "difficulty": "Medium", "desc": "Single wooden thread spool missing from compartment", "hint": "Inspect the wooden thread spools in the compartmentalized tray"},
        {"id": "pipe_v3_watchmaker_recolor_002", "title": "[AI Recolor] Horologist Tray Screwdriver Collar", "image_path": "public/levels/ai_watchmaker_parts_base.jpg", "preferred_op": "recolor", "difficulty": "Medium", "desc": "Single precision screwdriver collar tone shifted in CIELAB", "hint": "Examine the color-coded precision screwdrivers"},
        {"id": "pipe_v3_electronics_add_003", "title": "[AI Add] Electronics Antistatic Bench Extra Capacitor", "image_path": "public/levels/ai_electronics_pcb_base.jpg", "preferred_op": "add", "difficulty": "Medium", "desc": "Single additional electrolytic capacitor in component row", "hint": "Scan the electrolytic capacitors in the component tray"},
        {"id": "pipe_v3_woodworking_reorder_004", "title": "[AI Reorder] Woodworking Joinery Bench Rotated Chisel", "image_path": "public/levels/ai_woodworking_bench_base.jpg", "preferred_op": "reorder", "difficulty": "Medium", "desc": "Single wood chisel rotated on the workbench", "hint": "Check the hand tools and chisels on the wooden bench"},
        {"id": "pipe_v3_gardener_remove_005", "title": "[AI Remove] Greenhouse Potting Bench Missing Plant Tag", "image_path": "public/levels/ai_gardener_potting_base.jpg", "preferred_op": "remove", "difficulty": "Medium", "desc": "Single colorful garden plant marker tag missing", "hint": "Check the plant marker tags on the potting bench"},
        {"id": "pipe_v3_artist_recolor_006", "title": "[AI Recolor] Fine Art Studio Oil Paint Tube Cap", "image_path": "public/levels/ai_artist_palette_base.jpg", "preferred_op": "recolor", "difficulty": "Medium", "desc": "Single artist oil paint tube cap tone shifted in CIELAB", "hint": "Inspect the row of oil paint tubes on the palette"},
        {"id": "pipe_v3_retro_reorder_007", "title": "[AI Reorder] Retro Gaming Desk Shifted Memory Card", "image_path": "public/levels/ai_retro_gaming_base.jpg", "preferred_op": "reorder", "difficulty": "Medium", "desc": "Single memory card shifted on the desk surface", "hint": "Look closely at the cartridges and memory cards"},
        {"id": "pipe_v3_expedition_remove_008", "title": "[AI Remove] Expedition Prep Table Missing Carabiner", "image_path": "public/levels/ai_expedition_bushcraft_base.jpg", "preferred_op": "remove", "difficulty": "Medium", "desc": "Single locking carabiner missing from the gear array", "hint": "Check the carabiners and outdoor gear on the table"},
        {"id": "pipe_v3_leathercraft_recolor_009", "title": "[AI Recolor] Leather Artisan Bench Waxed Thread Spool", "image_path": "public/levels/ai_leathercraft_base.jpg", "preferred_op": "recolor", "difficulty": "Medium", "desc": "Single waxed linen thread spool shifted in CIELAB", "hint": "Inspect the collection of colored waxed thread spools"},
        {"id": "pipe_v3_miniature_add_010", "title": "[AI Add] Miniature Painter Desk Extra Dropper Bottle", "image_path": "public/levels/ai_miniature_painter_base.jpg", "preferred_op": "add", "difficulty": "Medium", "desc": "Single hobby paint dropper bottle added to rack", "hint": "Examine the rows of acrylic paint dropper bottles"}
    ]

    generate_batch(test_scenes)
