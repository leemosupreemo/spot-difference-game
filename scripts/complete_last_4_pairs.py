"""
COMPLETE FINAL 4 OBJECT-CHANGE PAIRS FOR PICKUP STICKS & GEMSTONE BEADS
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
from remove_target_selector import RemoveTargetSelector

OUTPUT_DIR = "public/levels"

def create_pair(img, mask, bbox, level_id, title, desc):
    h, w = img.shape[:2]
    bx1, by1, bx2, by2 = bbox
    cx = round((bx1 + bx2) / 2.0 / w * 100.0, 1)
    cy = round((by1 + by2) / 2.0 / h * 100.0, 1)
    span_x = (bx2 - bx1 + 1) / float(w) * 100.0
    span_y = (by2 - by1 + 1) / float(h) * 100.0
    radius = round(max(4.8, min(8.5, max(span_x, span_y) / 2.0 + 1.5)), 1)

    mask_u8 = (mask * 255).astype(np.uint8)
    var_img = cv2.inpaint(img, mask_u8, 5, cv2.INPAINT_TELEA)

    pad = 8
    x1, y1 = max(0, bx1 - pad), max(0, by1 - pad)
    x2, y2 = min(w, bx2 + pad), min(h, by2 + pad)
    clamped = img.copy()
    clamped[y1:y2, x1:x2] = var_img[y1:y2, x1:x2]

    base_save = os.path.join(OUTPUT_DIR, f"{level_id}_base.jpg")
    var_save = os.path.join(OUTPUT_DIR, f"{level_id}_variant.jpg")

    Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(base_save, "JPEG", quality=100, subsampling=0)
    Image.fromarray(cv2.cvtColor(clamped, cv2.COLOR_BGR2RGB)).save(var_save, "JPEG", quality=100, subsampling=0)

    entry = {
        "id": level_id,
        "title": title,
        "baseImage": f"levels/{level_id}_base.jpg",
        "variantImage": f"levels/{level_id}_variant.jpg",
        "category": "Photography",
        "packId": "find_the_sniper",
        "pack": "Find the Sniper",
        "difficulty": "Medium",
        "operation": "remove",
        "diffs": [{
            "id": 1,
            "x": cx,
            "y": cy,
            "radius": radius,
            "description": desc,
            "operation": "remove"
        }]
    }
    return entry

def main():
    print("Completing final 4 pairs...")
    from ultralytics import FastSAM
    model = FastSAM("FastSAM-s.pt")

    new_entries = []

    # 1. Pickup Sticks (Pair 1 & 2)
    img_sticks = cv2.imread("public/levels/fresh_v5_pickup_sticks_002_base.jpg")
    h, w = img_sticks.shape[:2]
    res_sticks = model("public/levels/fresh_v5_pickup_sticks_002_base.jpg", device="cpu", retina_masks=True, imgsz=1024, conf=0.25, iou=0.85)
    masks_sticks = res_sticks[0].masks.data.cpu().numpy().astype(bool)

    # Sort masks by size
    cand_sticks = []
    for m in masks_sticks:
        area_pct = np.sum(m) / (h * w) * 100.0
        if 0.16 <= area_pct <= 0.75:
            ys, xs = np.where(m)
            cand_sticks.append({
                "mask": m,
                "bbox": (int(np.min(xs)), int(np.min(ys)), int(np.max(xs)), int(np.max(ys))),
                "cx": float(np.mean(xs)),
                "cy": float(np.mean(ys)),
                "area_pct": area_pct
            })

    left_sticks = [c for c in cand_sticks if c["cx"] < w * 0.48]
    right_sticks = [c for c in cand_sticks if c["cx"] > w * 0.52]

    if left_sticks:
        c = left_sticks[0]
        p1 = create_pair(img_sticks, c["mask"], c["bbox"], "fresh_v5_pickup_sticks_pair1", "Tangled Pick Up Sticks (Pair 1)", "Stick removed from pile")
        new_entries.append(p1)
        print("✅ Created fresh_v5_pickup_sticks_pair1")
    else:
        # Construct compound mask of 2 adjacent stick tips
        c1, c2 = cand_sticks[0], cand_sticks[1]
        combo_m = c1["mask"] | c2["mask"]
        ys, xs = np.where(combo_m)
        bbox = (int(np.min(xs)), int(np.min(ys)), int(np.max(xs)), int(np.max(ys)))
        p1 = create_pair(img_sticks, combo_m, bbox, "fresh_v5_pickup_sticks_pair1", "Tangled Pick Up Sticks (Pair 1)", "Stick removed from pile")
        new_entries.append(p1)
        print("✅ Created fresh_v5_pickup_sticks_pair1 (combo)")

    if right_sticks:
        c = right_sticks[0]
        p2 = create_pair(img_sticks, c["mask"], c["bbox"], "fresh_v5_pickup_sticks_pair2", "Tangled Pick Up Sticks (Pair 2)", "Stick removed from pile")
        new_entries.append(p2)
        print("✅ Created fresh_v5_pickup_sticks_pair2")
    else:
        c1 = cand_sticks[-1]
        p2 = create_pair(img_sticks, c1["mask"], c1["bbox"], "fresh_v5_pickup_sticks_pair2", "Tangled Pick Up Sticks (Pair 2)", "Stick removed from pile")
        new_entries.append(p2)
        print("✅ Created fresh_v5_pickup_sticks_pair2 (tail)")

    # 2. Gemstone Beads (Pair 1 & 2)
    img_beads = cv2.imread("public/levels/fresh_v5_gemstone_beads_008_base.jpg")
    h, w = img_beads.shape[:2]
    res_beads = model("public/levels/fresh_v5_gemstone_beads_008_base.jpg", device="cpu", retina_masks=True, imgsz=1024, conf=0.35, iou=0.85)
    masks_beads = res_beads[0].masks.data.cpu().numpy().astype(bool)

    cand_beads = []
    for m in masks_beads:
        area_pct = np.sum(m) / (h * w) * 100.0
        if 0.15 <= area_pct <= 0.65:
            ys, xs = np.where(m)
            cand_beads.append({
                "mask": m,
                "bbox": (int(np.min(xs)), int(np.min(ys)), int(np.max(xs)), int(np.max(ys))),
                "cx": float(np.mean(xs)),
                "cy": float(np.mean(ys)),
                "area_pct": area_pct
            })

    left_beads = [c for c in cand_beads if c["cx"] < w * 0.48]
    right_beads = [c for c in cand_beads if c["cx"] > w * 0.52]

    if left_beads:
        c = left_beads[0]
        p3 = create_pair(img_beads, c["mask"], c["bbox"], "fresh_v5_gemstone_beads_pair1", "Jewelry Gemstone Beads (Pair 1)", "Bead removed from tray")
        new_entries.append(p3)
        print("✅ Created fresh_v5_gemstone_beads_pair1")

    if right_beads:
        c = right_beads[0]
        p4 = create_pair(img_beads, c["mask"], c["bbox"], "fresh_v5_gemstone_beads_pair2", "Jewelry Gemstone Beads (Pair 2)", "Bead removed from tray")
        new_entries.append(p4)
        print("✅ Created fresh_v5_gemstone_beads_pair2")

    if new_entries:
        manifest_path = "public/levels/photo_pair_manifest.json"
        with open(manifest_path, "r") as f:
            manifest = json.load(f)

        new_ids = {a["id"] for a in new_entries}
        manifest = [m for m in manifest if m["id"] not in new_ids]
        manifest = new_entries + manifest

        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        print(f"🎉 Successfully added final {len(new_entries)} pairs! Manifest total: {len(manifest)}")

if __name__ == "__main__":
    main()
