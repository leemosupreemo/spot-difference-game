#!/usr/bin/env python3
"""
Generate 2 Distinct Verified Variants for Each of the 20 Ocean Base Canvases:
- Variant 1: Object manipulation (Move / Add / Remove) using STRUCTURAL_ONLY_POLICY
             (with bounded-object duplication fallback for tight mandala patterns)
- Variant 2: Color change (Recolor) using RECOLOR_ONLY_POLICY

Outputs are saved to staging/ocean_underwater_bases/ alongside the base canvases,
with an authoritative manifest saved to staging/ocean_underwater_bases/ocean_variants_manifest.json.
"""

import os
import sys
import json
from pathlib import Path
from PIL import Image
import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from unified_operation_pipeline import (
    generate_single_scene_difference,
    _placed_add_mask,
    _occupied_mask,
)
from generation_policy import STRUCTURAL_ONLY_POLICY, GenerationPolicy
from scene_affordance_router import SceneAffordanceRouter
from add_target_selector import AddTargetSelector
from structural_mask_refiner import StructuralMaskRefiner
from structural_quality import StructuralNaturalnessCritic
from local_segmented_fallback import select_segmented_targets
from local_masked_edits import find_paste_regions, duplicate_target, validate_duplicate
from perceptual_verification_engine import PerceptualVerificationEngine
from variant_code import variant_code

RECOLOR_ONLY_POLICY = GenerationPolicy(
    name="recolor_only",
    allowed_operations=("recolor",),
    allow_operation_fallback=False,
    max_candidates_per_operation=16,
    selection_mode="first_pass",
    refine_structural_masks=False,
)

def fallback_structural_add(base_id, title, img_path, out_dir, difficulty="Medium"):
    img = cv2.imread(img_path)
    h, w = img.shape[:2]
    qa = SceneAffordanceRouter.evaluate_and_route_canvas(img_path)
    occupied = _occupied_mask(qa.get("raw_masks", []), w, h)
    _, _, all_pairs = AddTargetSelector.find_best_add_pair(
        img, qa["candidate_masks"], qa["peer_groups"], qa["raw_masks"], target_difficulty=difficulty
    )

    for p in all_pairs:
        refined = StructuralMaskRefiner.refine(img, p["donor"]["mask"], p["donor_bbox"])
        passed, var_img, gt, _ = AddTargetSelector.execute_add_and_qa(
            img, p["donor_bbox"], p["slot_bbox"], refined.object_mask, difficulty=difficulty
        )
        if passed:
            placed_mask = _placed_add_mask(refined.object_mask, p["donor_bbox"], p["slot_bbox"], w, h)
            quality = StructuralNaturalnessCritic.evaluate(
                img, var_img, gt.get("bbox", p["slot_bbox"]), operation="add", object_mask=placed_mask, occupied_mask=occupied
            )
            if quality.passed:
                v_filename = f"{base_id}_var1_variant.jpg"
                v_path = str(out_dir / v_filename)
                Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(v_path, "JPEG", quality=100, subsampling=0)

                diff = gt
                diff["radius"] = float(diff["radius"])
                entry = {
                    "id": f"{base_id}_var1",
                    "title": f"{title} (Object Change)",
                    "category": "Photography",
                    "pack": "Find the Sniper",
                    "packId": "find_the_sniper",
                    "difficulty": "Medium",
                    "baseImage": f"staging/ocean_underwater_bases/{base_id}_base.jpg",
                    "variantImage": f"staging/ocean_underwater_bases/{v_filename}",
                    "operation": "add",
                    "generationMethod": "structural",
                    "variantType": "structural",
                    "dimensions": {"width": 1200, "height": 900},
                    "aspectRatio": "4:3",
                    "baseId": base_id,
                    "diffs": [diff],
                    "photoKey": f"levels/{base_id}",
                }
                entry["variantCode"] = variant_code(entry)
                return entry
    return None

def fallback_duplicate_add(base_id, title, img_path, out_dir):
    img = cv2.imread(img_path)
    h, w = img.shape[:2]
    qa = SceneAffordanceRouter.evaluate_and_route_canvas(img_path)
    targets = select_segmented_targets(qa["raw_masks"], img.shape)

    for t in targets:
        x1, y1, x2, y2 = t["bbox"]
        pw, ph = x2 - x1, y2 - y1
        regions = find_paste_regions(img, targets, (ph, pw))
        for r in regions:
            var, dest_mask = duplicate_target(img, t, r["center"])
            valid, _, _ = validate_duplicate(img, t, dest_mask)
            if valid:
                ys, xs = np.where(dest_mask > 0)
                bx1, by1, bx2, by2 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
                passed, _, _, _ = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                    img, var, [bx1, by1, bx2, by2], operation="add", difficulty="Medium"
                )
                if passed:
                    v_filename = f"{base_id}_var1_variant.jpg"
                    v_path = str(out_dir / v_filename)
                    Image.fromarray(cv2.cvtColor(var, cv2.COLOR_BGR2RGB)).save(v_path, "JPEG", quality=100, subsampling=0)

                    cx_pct = round(float(bx1 + bx2) / 2.0 / float(w) * 100.0, 1)
                    cy_pct = round(float(by1 + by2) / 2.0 / float(h) * 100.0, 1)
                    span_x = (bx2 - bx1 + 1) / float(w) * 100.0
                    span_y = (by2 - by1 + 1) / float(h) * 100.0
                    radius = round(max(4.5, min(7.5, max(span_x, span_y) / 2.0 + 1.2)), 1)

                    entry = {
                        "id": f"{base_id}_var1",
                        "title": f"{title} (Object Change)",
                        "category": "Photography",
                        "pack": "Find the Sniper",
                        "packId": "find_the_sniper",
                        "difficulty": "Medium",
                        "baseImage": f"staging/ocean_underwater_bases/{base_id}_base.jpg",
                        "variantImage": f"staging/ocean_underwater_bases/{v_filename}",
                        "operation": "add",
                        "generationMethod": "structural",
                        "variantType": "structural",
                        "dimensions": {"width": 1200, "height": 900},
                        "aspectRatio": "4:3",
                        "baseId": base_id,
                        "diffs": [{
                            "id": 1,
                            "x": cx_pct,
                            "y": cy_pct,
                            "radius": radius,
                            "description": "Single add difference",
                            "hint": "Look closely for an added detail",
                            "operation": "add",
                        }],
                        "photoKey": f"levels/{base_id}",
                    }
                    entry["variantCode"] = variant_code(entry)
                    return entry
    return None

def main():
    bases_manifest_path = Path("staging/ocean_underwater_bases/ocean_bases_manifest.json")
    if not bases_manifest_path.exists():
        print(f"❌ Base manifest not found at {bases_manifest_path}")
        sys.exit(1)

    with open(bases_manifest_path, "r") as f:
        bases = json.load(f)

    out_dir = Path("staging/ocean_underwater_bases")
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"🌊 Generating 2 Variants for Each of the {len(bases)} Ocean Bases...")
    print("   • Variant 1: Object Move / Add / Remove (Structural)")
    print("   • Variant 2: Color Change (Recolor)")
    print("=" * 80)

    generated_variants = []

    for i, base in enumerate(bases, 1):
        base_id = base["id"]
        title = base["title"]
        base_img_path = str(out_dir / f"{base_id}_base.jpg")

        if not os.path.exists(base_img_path):
            print(f"❌ [{i:02d}/20] Missing base image: {base_img_path}")
            continue

        print(f"\n[{i:02d}/20] Processing {base_id} (\"{title}\")...")

        # Variant 1: Structural
        v1_id = f"{base_id}_var1"
        spec_v1 = {
            "id": v1_id,
            "title": f"{title} (Object Change)",
            "image_path": base_img_path,
            "category": "Photography",
            "pack": "Find the Sniper",
            "packId": "find_the_sniper",
            "difficulty": "Medium",
        }

        v1_success, v1_res, v1_log = generate_single_scene_difference(
            spec_v1,
            output_dir=str(out_dir),
            difficulty="Medium",
            policy=STRUCTURAL_ONLY_POLICY,
        )

        v1_entry = None
        if v1_success and v1_res:
            op = v1_res.get("operation")
            diff = v1_res["diffs"][0]
            diff["radius"] = float(diff["radius"])
            v1_res["dimensions"] = {"width": 1200, "height": 900}
            v1_res["aspectRatio"] = "4:3"
            v1_res["baseId"] = base_id
            v1_res["baseImage"] = f"staging/ocean_underwater_bases/{base_id}_base.jpg"
            v1_res["variantImage"] = f"staging/ocean_underwater_bases/{v1_id}_variant.jpg"
            v1_res["variantType"] = "structural"
            v1_res["generationMethod"] = "structural"
            v1_res["variantCode"] = variant_code(v1_res)
            v1_res["photoKey"] = f"levels/{base_id}"
            v1_entry = v1_res
            dup_base = out_dir / f"{v1_id}_base.jpg"
            if dup_base.exists():
                dup_base.unlink()
            print(f"   ✓ Var 1 [Structural]: op={op.upper()} at ({diff['x']}%, {diff['y']}%), r={diff['radius']:.1f}% [{v1_res['variantCode']}]")
        else:
            print("   ↳ Attempting targeted structural fallbacks...")
            v1_entry = fallback_structural_add(base_id, title, base_img_path, out_dir, difficulty="Medium")
            if not v1_entry:
                v1_entry = fallback_structural_add(base_id, title, base_img_path, out_dir, difficulty="Hard")
            if not v1_entry:
                v1_entry = fallback_duplicate_add(base_id, title, base_img_path, out_dir)

            if v1_entry:
                diff = v1_entry["diffs"][0]
                print(f"   ✓ Var 1 [Structural Fallback]: op={v1_entry['operation'].upper()} at ({diff['x']}%, {diff['y']}%), r={diff['radius']:.1f}% [{v1_entry['variantCode']}]")
            else:
                print("   ❌ Var 1 [Structural] All attempts failed.")

        # Variant 2: Color Change
        v2_id = f"{base_id}_var2"
        spec_v2 = {
            "id": v2_id,
            "title": f"{title} (Color Shift)",
            "image_path": base_img_path,
            "category": "Photography",
            "pack": "Find the Sniper",
            "packId": "find_the_sniper",
            "difficulty": "Medium",
            "hue_direction_deg": 65.0,
        }

        v2_success, v2_res, v2_log = generate_single_scene_difference(
            spec_v2,
            output_dir=str(out_dir),
            difficulty="Medium",
            policy=RECOLOR_ONLY_POLICY,
        )

        v2_entry = None
        if v2_success and v2_res:
            op = v2_res.get("operation")
            diff = v2_res["diffs"][0]
            diff["radius"] = float(diff["radius"])
            v2_res["dimensions"] = {"width": 1200, "height": 900}
            v2_res["aspectRatio"] = "4:3"
            v2_res["baseId"] = base_id
            v2_res["baseImage"] = f"staging/ocean_underwater_bases/{base_id}_base.jpg"
            v2_res["variantImage"] = f"staging/ocean_underwater_bases/{v2_id}_variant.jpg"
            v2_res["variantType"] = "color_change"
            v2_res["generationMethod"] = "structural"
            v2_res["variantCode"] = variant_code(v2_res)
            v2_res["photoKey"] = f"levels/{base_id}"
            v2_entry = v2_res
            dup_base2 = out_dir / f"{v2_id}_base.jpg"
            if dup_base2.exists():
                dup_base2.unlink()
            print(f"   ✓ Var 2 [Color Shift]: op={op.upper()} at ({diff['x']}%, {diff['y']}%), r={diff['radius']:.1f}% [{v2_res['variantCode']}]")
        else:
            reason = v2_log.get("rejection_reason")
            print(f"   ❌ Var 2 [Color Shift] Failed: {reason}")

        if v1_entry:
            generated_variants.append(v1_entry)
        if v2_entry:
            generated_variants.append(v2_entry)

    manifest_out = out_dir / "ocean_variants_manifest.json"
    with open(manifest_out, "w") as f:
        json.dump(generated_variants, f, indent=2)

    print("\n" + "=" * 80)
    print(f"🎉 Completed! Successfully generated {len(generated_variants)} / {len(bases) * 2} variants.")
    print(f"📄 Saved manifest to: {manifest_out}")

if __name__ == "__main__":
    main()
