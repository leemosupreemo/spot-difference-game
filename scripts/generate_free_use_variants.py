#!/usr/bin/env python3
"""
Robust Multi-Variant Generator for Free-Use Base Images:
- Uses FastSAM (FastSAM-s.pt) instance segmentation
- Generates 2 verified, non-overlapping difference variants per image
- Verifies differences with PerceptualVerificationEngine
- Saves variants and writes free_use_variants_manifest.json
"""

import os
import sys
import json
from pathlib import Path
from PIL import Image
import cv2
import numpy as np
from ultralytics import FastSAM

sys.path.insert(0, str(Path(__file__).parent))

from perceptual_verification_engine import PerceptualVerificationEngine
from variant_code import variant_code

BASE_DIR = Path("_marketing/social_media/free_use_15_base_batch")

FREE_BASES = [
    {"id": "free_01_arch_bakery", "title": "Artisan Bakery Display", "file": "free_01_arch_bakery_base.jpg"},
    {"id": "free_02_arch_bookshop", "title": "Vintage Bookshop Exterior", "file": "free_02_arch_bookshop_base.jpg"},
    {"id": "free_03_arch_venetian", "title": "Venetian Canal House", "file": "free_03_arch_venetian_base.jpg"},
    {"id": "free_04_arch_cinema", "title": "Classic Cinema Marquee", "file": "free_04_arch_cinema_base.jpg"},
    {"id": "free_05_col_macarons", "title": "Rainbow Macaron Collection", "file": "free_05_col_macarons_base.jpg"},
    {"id": "free_06_col_apothecary", "title": "Vintage Apothecary Bottles", "file": "free_06_col_apothecary_base.jpg"},
    {"id": "free_07_col_spices", "title": "Organized Heirloom Spice Bowls", "file": "free_07_col_spices_base.jpg"},
    {"id": "free_08_col_craft_buttons", "title": "Craft Notions and Spools", "file": "free_08_col_craft_buttons_base.jpg"},
    {"id": "free_09_food_brunch", "title": "Gourmet Table Breakfast Spread", "file": "free_09_food_brunch_base.jpg"},
    {"id": "free_10_food_patisserie", "title": "French Croissants and Tarts", "file": "free_10_food_patisserie_base.jpg"},
    {"id": "free_11_food_pizza", "title": "Artisan Wood-Fired Pizza", "file": "free_11_food_pizza_base.jpg"},
    {"id": "free_12_animal_dog", "title": "Golden Retriever Portrait", "file": "free_12_animal_dog_base.jpg"},
    {"id": "free_13_street_kyoto", "title": "Historic Kyoto Gion Street", "file": "free_13_street_kyoto_base.jpg"},
    {"id": "free_14_street_santorini", "title": "Santorini Stepped Alleyway", "file": "free_14_street_santorini_base.jpg"},
    {"id": "free_15_geom_mosaic", "title": "Ceramic Mosaic Tile Rosette", "file": "free_15_geom_mosaic_base.jpg"},
]

def is_distinct(diff1, diff2, min_dist=12.0):
    dx = diff1["x"] - diff2["x"]
    dy = diff1["y"] - diff2["y"]
    return (dx*dx + dy*dy) ** 0.5 >= min_dist

def recolor_mask(img_bgr, mask_u8, hue_deg=80.0):
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    m_bool = mask_u8 > 0
    hsv[m_bool, 0] = (hsv[m_bool, 0] + (hue_deg / 2.0)) % 180.0
    hsv[m_bool, 1] = np.clip(hsv[m_bool, 1] * 1.25, 0.0, 255.0)
    bgr_recolored = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    
    mask_float = (mask_u8 > 0).astype(np.float32)
    mask_blur = cv2.GaussianBlur(mask_float, (5, 5), 0)
    mask_3ch = np.repeat(mask_blur[:, :, np.newaxis], 3, axis=2)
    return (bgr_recolored.astype(np.float32) * mask_3ch + img_bgr.astype(np.float32) * (1.0 - mask_3ch)).astype(np.uint8)

def main():
    print("=" * 80)
    print("INITIALIZING FASTSAM MODEL WEIGHTS (FastSAM-s.pt)")
    print("=" * 80)
    model = FastSAM("FastSAM-s.pt")

    manifest = []
    hue_angles = [75.0, -85.0, 140.0, -110.0]

    for idx, base in enumerate(FREE_BASES, 1):
        b_id = base["id"]
        title = base["title"]
        b_path = str(BASE_DIR / base["file"])
        print(f"\n[{idx:02d}/15] Segmenting & Processing: {b_id} (\"{title}\")")

        img = cv2.imread(b_path)
        if img is None:
            print(f"   ✗ Image not found: {b_path}")
            continue
        h, w = img.shape[:2]

        # FastSAM segmentation inference
        res = model(b_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.35, verbose=False)
        if not res or res[0].masks is None:
            print("   ✗ No masks detected.")
            continue

        raw_masks = res[0].masks.data.cpu().numpy()
        print(f"   -> FastSAM detected {len(raw_masks)} object instance masks.")

        # Filter candidate masks by scale (area between 0.15% and 6% of canvas)
        cands = []
        canvas_area = float(w * h)
        for m in raw_masks:
            # Resize mask to original image dimensions if needed
            if m.shape[:2] != (h, w):
                m_resized = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            else:
                m_resized = m.astype(np.uint8)

            ys, xs = np.where(m_resized > 0)
            if len(ys) == 0:
                continue
            bx1, by1, bx2, by2 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
            area_frac = float(len(ys)) / canvas_area
            if 0.0015 <= area_frac <= 0.08:
                cx_pct = round((bx1 + bx2) / 2.0 / float(w) * 100.0, 1)
                cy_pct = round((by1 + by2) / 2.0 / float(h) * 100.0, 1)
                radius = round(max(4.5, min(7.5, max(bx2 - bx1, by2 - by1) / float(w) * 50.0 + 1.2)), 1)
                cands.append({
                    "mask": m_resized,
                    "bbox": [bx1, by1, bx2, by2],
                    "diff": {"x": cx_pct, "y": cy_pct, "radius": radius}
                })

        # Sort candidate masks by compactness
        cands.sort(key=lambda c: (c["bbox"][2] - c["bbox"][0]) * (c["bbox"][3] - c["bbox"][1]))

        existing_diffs = []
        variants_for_scene = []
        cand_idx = 0
        h_idx = 0

        while len(variants_for_scene) < 2 and cand_idx < len(cands):
            c = cands[cand_idx]
            cand_idx += 1

            if any(not is_distinct(c["diff"], ed) for ed in existing_diffs):
                continue

            hue_shift = hue_angles[h_idx % len(hue_angles)]
            h_idx += 1

            var_img = recolor_mask(img, c["mask"], hue_deg=hue_shift)

            passed, metrics, note, _ = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                img, var_img, c["bbox"], operation="recolor", difficulty="Medium"
            )

            if passed:
                v_num = len(variants_for_scene) + 1
                v_id = f"{b_id}_var{v_num}"
                v_filename = f"{v_id}_variant.jpg"
                v_path = str(BASE_DIR / v_filename)

                Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(v_path, "JPEG", quality=95)

                c["diff"]["id"] = 1
                c["diff"]["description"] = "Single recolored object difference"
                c["diff"]["hint"] = "Look closely for a color change"
                c["diff"]["operation"] = "recolor"

                entry = {
                    "id": v_id,
                    "title": f"{title} (Color Shift {v_num})",
                    "baseImage": b_path,
                    "variantImage": v_path,
                    "operation": "recolor",
                    "generationMethod": "fastsam_affordance",
                    "dimensions": {"width": w, "height": h},
                    "aspectRatio": "2:3",
                    "baseId": b_id,
                    "diffs": [c["diff"]]
                }
                entry["variantCode"] = variant_code(entry)
                variants_for_scene.append(entry)
                existing_diffs.append(c["diff"])
                print(f"   ✓ Var {v_num} [RECOLOR {hue_shift}°]: at ({c['diff']['x']}%, {c['diff']['y']}%), r={c['diff']['radius']:.1f}% [{entry['variantCode']}]")

        manifest.extend(variants_for_scene)
        print(f"   --> Generated {len(variants_for_scene)} verified variants for {b_id}")

    manifest_path = BASE_DIR / "free_use_variants_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 80)
    print(f"🎉 COMPLETED: Generated {len(manifest)} verified variants for all 15 free-use base scenes.")
    print(f"📄 Manifest saved to: {manifest_path}")

if __name__ == "__main__":
    main()
