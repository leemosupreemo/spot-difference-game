"""
TARGETED GENERATOR: COMPLETE 20 UNIQUE OBJECT-ONLY DIFFERENCE PAIRS (2 PER BASE SCENE)
================================================================================
Generates the remaining 6 unique object-change pairs for:
- paper_clips (pair 2: remove or swap an isolated clip on concrete)
- pickup_sticks (pair 1 & 2: top stick removal / addition on felt)
- colored_pencils (pair 1 & 2: wood shaving removal / swapping pencils)
- gemstone_beads (pair 1 & 2: bead swap / jump ring removal)
- sewing_notions (pair 2: thimble / safety pin removal or swap)
================================================================================
"""

import os
import sys
import json
import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))

from perceptual_verification_engine import PerceptualVerificationEngine
from remove_target_selector import RemoveTargetSelector, SubstrateCoherenceAnalyzer
from reorder_target_selector import ReorderTargetSelector
from add_target_selector import AddTargetSelector

ARTIFACT_DIR = "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49"

def process_paper_clips_pair2():
    # Remove one isolated yellow or green paperclip near the bottom/top corner
    base_path = "public/levels/fresh_v5_paper_clips_001_base.jpg"
    img = cv2.imread(base_path)
    h, w = img.shape[:2]

    # Find an isolated clip (e.g. at bottom left around x=58, y=940)
    # Let us sample a clean candidate
    from ultralytics import FastSAM
    model = FastSAM("FastSAM-s.pt")
    results = model(base_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.35, iou=0.85)
    masks = results[0].masks.data.cpu().numpy().astype(bool)

    # Filter masks in bottom-left or top-left
    for m in masks:
        area_pct = np.sum(m) / (h * w) * 100.0
        if 0.18 <= area_pct <= 0.95:
            ys, xs = np.where(m)
            cx, cy = np.mean(xs) / w * 100.0, np.mean(ys) / h * 100.0
            # Ensure not near Pair 1 (6.7%, 12.9%)
            if cx > 25 and cy > 60:
                bx1, bx2 = np.min(xs), np.max(xs)
                by1, by2 = np.min(ys), np.max(ys)
                passed, var_img, gt, reason = RemoveTargetSelector.execute_removal_and_qa(
                    img, m, (bx1, by1, bx2, by2), masks, difficulty="Medium"
                )
                if passed:
                    pair_id = "fresh_v5_paper_clips_pair2"
                    var_path = f"public/levels/{pair_id}_variant.jpg"
                    base_dest = f"public/levels/{pair_id}_base.jpg"
                    Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(base_dest, "JPEG", quality=100, subsampling=0)
                    Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(var_path, "JPEG", quality=100, subsampling=0)
                    print(f"✅ Created {pair_id} via remove @ ({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
                    return {
                        "id": pair_id,
                        "title": "Spilled Paperclips on Concrete (Clip Removal)",
                        "baseImage": f"levels/{pair_id}_base.jpg",
                        "variantImage": f"levels/{pair_id}_variant.jpg",
                        "category": "Photography",
                        "packId": "find_the_sniper",
                        "pack": "Find the Sniper",
                        "difficulty": "Medium",
                        "operation": "remove",
                        "diffs": [{"id": 1, "x": gt["x"], "y": gt["y"], "radius": gt["radius"], "description": "Single paperclip removed from concrete", "operation": "remove"}]
                    }
    return None

def process_pickup_sticks_pairs():
    # Pick up sticks: Remove or swap top crossed sticks on green felt
    base_path = "public/levels/fresh_v5_pickup_sticks_002_base.jpg"
    img = cv2.imread(base_path)
    h, w = img.shape[:2]

    from ultralytics import FastSAM
    model = FastSAM("FastSAM-s.pt")
    results = model(base_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.3, iou=0.85)
    masks = results[0].masks.data.cpu().numpy().astype(bool)

    accepted = []
    used_cx = []

    # Try swapping / moving stick segments or removing a single stick tip on felt
    for m in masks:
        if len(accepted) >= 2:
            break
        area_pct = np.sum(m) / (h * w) * 100.0
        if 0.12 <= area_pct <= 0.95:
            ys, xs = np.where(m)
            cx, cy = np.mean(xs) / w * 100.0, np.mean(ys) / h * 100.0
            if any(abs(cx - ux) < 15 for ux in used_cx):
                continue
            bx1, bx2 = np.min(xs), np.max(xs)
            by1, by2 = np.min(ys), np.max(ys)
            passed, var_img, gt, reason = RemoveTargetSelector.execute_removal_and_qa(
                img, m, (bx1, by1, bx2, by2), masks, difficulty="Medium"
            )
            if passed:
                pair_num = len(accepted) + 1
                pair_id = f"fresh_v5_pickup_sticks_pair{pair_num}"
                var_path = f"public/levels/{pair_id}_variant.jpg"
                base_dest = f"public/levels/{pair_id}_base.jpg"
                Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(base_dest, "JPEG", quality=100, subsampling=0)
                Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(var_path, "JPEG", quality=100, subsampling=0)
                used_cx.append(gt["x"])
                accepted.append({
                    "id": pair_id,
                    "title": f"Tangled Pick Up Sticks (Stick Removal {pair_num})",
                    "baseImage": f"levels/{pair_id}_base.jpg",
                    "variantImage": f"levels/{pair_id}_variant.jpg",
                    "category": "Photography",
                    "packId": "find_the_sniper",
                    "pack": "Find the Sniper",
                    "difficulty": "Medium",
                    "operation": "remove",
                    "diffs": [{"id": 1, "x": gt["x"], "y": gt["y"], "radius": gt["radius"], "description": "Single pick-up stick removed from pile", "operation": "remove"}]
                })
                print(f"✅ Created {pair_id} via remove @ ({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
    return accepted

def process_colored_pencils_pairs():
    # Remove one of the curly pencil wood shavings
    base_path = "public/levels/fresh_v5_colored_pencils_005_base.jpg"
    img = cv2.imread(base_path)
    h, w = img.shape[:2]

    from ultralytics import FastSAM
    model = FastSAM("FastSAM-s.pt")
    results = model(base_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.3, iou=0.85)
    masks = results[0].masks.data.cpu().numpy().astype(bool)

    accepted = []
    used_cx = []

    for m in masks:
        if len(accepted) >= 2:
            break
        area_pct = np.sum(m) / (h * w) * 100.0
        # Wood shavings are compact (0.10% to 0.65%)
        if 0.08 <= area_pct <= 0.65:
            ys, xs = np.where(m)
            cx, cy = np.mean(xs) / w * 100.0, np.mean(ys) / h * 100.0
            if any(abs(cx - ux) < 15 for ux in used_cx):
                continue
            bx1, bx2 = np.min(xs), np.max(xs)
            by1, by2 = np.min(ys), np.max(ys)
            passed, var_img, gt, reason = RemoveTargetSelector.execute_removal_and_qa(
                img, m, (bx1, by1, bx2, by2), masks, difficulty="Medium"
            )
            if passed:
                pair_num = len(accepted) + 1
                pair_id = f"fresh_v5_colored_pencils_pair{pair_num}"
                var_path = f"public/levels/{pair_id}_variant.jpg"
                base_dest = f"public/levels/{pair_id}_base.jpg"
                Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(base_dest, "JPEG", quality=100, subsampling=0)
                Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(var_path, "JPEG", quality=100, subsampling=0)
                used_cx.append(gt["x"])
                accepted.append({
                    "id": pair_id,
                    "title": f"Rainbow Colored Pencils (Wood Shaving {pair_num})",
                    "baseImage": f"levels/{pair_id}_base.jpg",
                    "variantImage": f"levels/{pair_id}_variant.jpg",
                    "category": "Photography",
                    "packId": "find_the_sniper",
                    "pack": "Find the Sniper",
                    "difficulty": "Medium",
                    "operation": "remove",
                    "diffs": [{"id": 1, "x": gt["x"], "y": gt["y"], "radius": gt["radius"], "description": "Pencil wood shaving removed", "operation": "remove"}]
                })
                print(f"✅ Created {pair_id} via remove @ ({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
    return accepted

def process_gemstone_beads_pairs():
    # Remove one bead or jump ring in the jewelry flat lay
    base_path = "public/levels/fresh_v5_gemstone_beads_008_base.jpg"
    img = cv2.imread(base_path)
    h, w = img.shape[:2]

    from ultralytics import FastSAM
    model = FastSAM("FastSAM-s.pt")
    results = model(base_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.35, iou=0.85)
    masks = results[0].masks.data.cpu().numpy().astype(bool)

    accepted = []
    used_cx = []

    for m in masks:
        if len(accepted) >= 2:
            break
        area_pct = np.sum(m) / (h * w) * 100.0
        if 0.08 <= area_pct <= 0.55:
            ys, xs = np.where(m)
            cx, cy = np.mean(xs) / w * 100.0, np.mean(ys) / h * 100.0
            if any(abs(cx - ux) < 15 for ux in used_cx):
                continue
            bx1, bx2 = np.min(xs), np.max(xs)
            by1, by2 = np.min(ys), np.max(ys)
            passed, var_img, gt, reason = RemoveTargetSelector.execute_removal_and_qa(
                img, m, (bx1, by1, bx2, by2), masks, difficulty="Medium"
            )
            if passed:
                pair_num = len(accepted) + 1
                pair_id = f"fresh_v5_gemstone_beads_pair{pair_num}"
                var_path = f"public/levels/{pair_id}_variant.jpg"
                base_dest = f"public/levels/{pair_id}_base.jpg"
                Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(base_dest, "JPEG", quality=100, subsampling=0)
                Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(var_path, "JPEG", quality=100, subsampling=0)
                used_cx.append(gt["x"])
                accepted.append({
                    "id": pair_id,
                    "title": f"Jewelry Gemstone Beads (Bead Removal {pair_num})",
                    "baseImage": f"levels/{pair_id}_base.jpg",
                    "variantImage": f"levels/{pair_id}_variant.jpg",
                    "category": "Photography",
                    "packId": "find_the_sniper",
                    "pack": "Find the Sniper",
                    "difficulty": "Medium",
                    "operation": "remove",
                    "diffs": [{"id": 1, "x": gt["x"], "y": gt["y"], "radius": gt["radius"], "description": "Single polished gemstone bead removed", "operation": "remove"}]
                })
                print(f"✅ Created {pair_id} via remove @ ({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
    return accepted

def process_sewing_notions_pair2():
    # Remove one safety pin or pearl sewing pin
    base_path = "public/levels/fresh_v5_sewing_notions_004_base.jpg"
    img = cv2.imread(base_path)
    h, w = img.shape[:2]

    from ultralytics import FastSAM
    model = FastSAM("FastSAM-s.pt")
    results = model(base_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.35, iou=0.85)
    masks = results[0].masks.data.cpu().numpy().astype(bool)

    for m in masks:
        area_pct = np.sum(m) / (h * w) * 100.0
        if 0.10 <= area_pct <= 0.65:
            ys, xs = np.where(m)
            cx, cy = np.mean(xs) / w * 100.0, np.mean(ys) / h * 100.0
            # Pair 1 is around (10.3%, 46.5%), so choose something on the right side
            if cx > 40:
                bx1, bx2 = np.min(xs), np.max(xs)
                by1, by2 = np.min(ys), np.max(ys)
                passed, var_img, gt, reason = RemoveTargetSelector.execute_removal_and_qa(
                    img, m, (bx1, by1, bx2, by2), masks, difficulty="Medium"
                )
                if passed:
                    pair_id = "fresh_v5_sewing_notions_pair2"
                    var_path = f"public/levels/{pair_id}_variant.jpg"
                    base_dest = f"public/levels/{pair_id}_base.jpg"
                    Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(base_dest, "JPEG", quality=100, subsampling=0)
                    Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(var_path, "JPEG", quality=100, subsampling=0)
                    print(f"✅ Created {pair_id} via remove @ ({gt['x']}%, {gt['y']}%, r={gt['radius']}%)")
                    return {
                        "id": pair_id,
                        "title": "Silk Thread Spools & Safety Pins (Pin Removal)",
                        "baseImage": f"levels/{pair_id}_base.jpg",
                        "variantImage": f"levels/{pair_id}_variant.jpg",
                        "category": "Photography",
                        "packId": "find_the_sniper",
                        "pack": "Find the Sniper",
                        "difficulty": "Medium",
                        "operation": "remove",
                        "diffs": [{"id": 1, "x": gt["x"], "y": gt["y"], "radius": gt["radius"], "description": "Single tailoring pin removed", "operation": "remove"}]
                    }
    return None

def main():
    print("================================================================================")
    print("🚀 GENERATING TARGETED REMAINING OBJECT-CHANGE PAIRS")
    print("================================================================================")

    all_new = []

    p1 = process_paper_clips_pair2()
    if p1: all_new.append(p1)

    p2 = process_pickup_sticks_pairs()
    all_new.extend(p2)

    p3 = process_colored_pencils_pairs()
    all_new.extend(p3)

    p4 = process_gemstone_beads_pairs()
    all_new.extend(p4)

    p5 = process_sewing_notions_pair2()
    if p5: all_new.append(p5)

    print(f"\nGenerated {len(all_new)} additional object-change pairs.")

    if all_new:
        manifest_path = "public/levels/photo_pair_manifest.json"
        with open(manifest_path, "r") as f:
            manifest = json.load(f)

        new_ids = {a["id"] for a in all_new}
        manifest = [m for m in manifest if m["id"] not in new_ids]
        manifest = all_new + manifest

        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        print(f"🎉 Prepend-saved {len(all_new)} pairs to manifest. Total levels: {len(manifest)}")

if __name__ == "__main__":
    main()
