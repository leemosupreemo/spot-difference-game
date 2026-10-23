#!/usr/bin/env python3
"""
Complete any missing variants so that every one of the 9 scenes has exactly 4 verified variants.
Selects non-overlapping candidate object masks from FastSAM and applies verified recolors.
"""

import os
import sys
import json
from pathlib import Path
from PIL import Image
import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from scene_affordance_router import SceneAffordanceRouter
from perceptual_verification_engine import PerceptualVerificationEngine
from variant_code import variant_code

MANIFEST_PATH = Path("_marketing/social_media/social_15_base_batch/social_variants_manifest.json")
OUT_DIR = Path("_marketing/social_media/social_15_base_batch")

TARGET_BASES = {
    "01_arch_parisian_bakery": {"title": "Pastel Parisian Bakery", "path": "_marketing/social_media/social_15_base_batch/01_arch_parisian_bakery.jpg"},
    "03_arch_venetian_house": {"title": "Venetian Waterfront House", "path": "_marketing/social_media/social_15_base_batch/03_arch_venetian_house.jpg"},
    "04_arch_art_deco_cinema": {"title": "Art Deco Cinema Entrance", "path": "_marketing/social_media/social_15_base_batch/04_arch_art_deco_cinema.jpg"},
    "06_col_candy_macaron_wall": {"title": "Candy and Macaron Display Wall", "path": "_marketing/social_media/social_15_base_batch/06_col_candy_macaron_wall.jpg"},
    "07_col_botanist_herbarium": {"title": "Botanist Herbarium Grid", "path": "_marketing/social_media/social_15_base_batch/07_col_botanist_herbarium.jpg"},
    "08_col_vintage_buttons": {"title": "Vintage Buttons and Notions", "path": "_marketing/social_media/social_15_base_batch/08_col_vintage_buttons.jpg"},
    "09_food_mediterranean_brunch": {"title": "Mediterranean Shakshuka Brunch", "path": "_marketing/social_media/social_15_base_batch/09_food_mediterranean_brunch.jpg"},
    "10_food_french_patisserie": {"title": "Artisan French Patisserie Board", "path": "_marketing/social_media/social_15_base_batch/10_food_french_patisserie.jpg"},
    "13_geom_stained_glass": {"title": "Geometric Stained Glass Rosette", "path": "_marketing/social_media/social_15_base_batch/13_geom_stained_glass.jpg"},
}

def is_distinct(diff1, diff2, min_dist=10.0):
    dx = diff1["x"] - diff2["x"]
    dy = diff1["y"] - diff2["y"]
    return (dx*dx + dy*dy) ** 0.5 >= min_dist

def recolor_mask(img_bgr, mask_u8, hue_deg=80.0):
    """Luminance-preserving HSV recolor of segmented mask."""
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    m_bool = mask_u8 > 0
    hsv[m_bool, 0] = (hsv[m_bool, 0] + (hue_deg / 2.0)) % 180.0
    hsv[m_bool, 1] = np.clip(hsv[m_bool, 1] * 1.25, 0.0, 255.0)
    bgr_recolored = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    
    mask_float = (mask_u8 > 0).astype(np.float32)
    mask_blur = cv2.GaussianBlur(mask_float, (5, 5), 0)
    mask_3ch = np.repeat(mask_blur[:, :, np.newaxis], 3, axis=2)
    
    blended = (bgr_recolored.astype(np.float32) * mask_3ch + img_bgr.astype(np.float32) * (1.0 - mask_3ch)).astype(np.uint8)
    return blended

def main():
    with open(MANIFEST_PATH, "r") as f:
        manifest = json.load(f)

    grouped = {}
    for e in manifest:
        bid = e.get("baseId") or e.get("id").split("_var")[0]
        grouped.setdefault(bid, []).append(e)

    hue_cycle = [85.0, -75.0, 140.0, -110.0, 50.0]

    for b_id, base_info in TARGET_BASES.items():
        existing = grouped.get(b_id, [])
        needed = 4 - len(existing)
        if needed <= 0:
            print(f"✓ {b_id} already has 4 variants.")
            continue

        print(f"\nBackfilling {needed} variants for {b_id}...")
        img_path = base_info["path"]
        title = base_info["title"]
        img = cv2.imread(img_path)
        h, w = img.shape[:2]

        existing_diffs = [e["diffs"][0] for e in existing if e.get("diffs")]

        qa = SceneAffordanceRouter.evaluate_and_route_canvas(img_path)
        cand_masks = qa.get("candidate_masks", [])

        valid_cands = []
        canvas_area = float(w * h)
        for m in cand_masks:
            m_u8 = m["mask"]
            ys, xs = np.where(m_u8 > 0)
            if len(ys) == 0:
                continue
            bx1, by1, bx2, by2 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
            area_frac = float(len(ys)) / canvas_area
            if 0.0015 <= area_frac <= 0.06:
                cx_pct = round((bx1 + bx2) / 2.0 / float(w) * 100.0, 1)
                cy_pct = round((by1 + by2) / 2.0 / float(h) * 100.0, 1)
                radius = round(max(4.5, min(7.5, max(bx2 - bx1, by2 - by1) / float(w) * 50.0 + 1.2)), 1)
                cand_diff = {"x": cx_pct, "y": cy_pct, "radius": radius}
                if all(is_distinct(cand_diff, ed) for ed in existing_diffs):
                    valid_cands.append({
                        "mask": m_u8,
                        "bbox": [bx1, by1, bx2, by2],
                        "diff": cand_diff
                    })

        h_idx = 0
        cand_idx = 0
        while len(existing) < 4 and cand_idx < len(valid_cands):
            c = valid_cands[cand_idx]
            cand_idx += 1
            
            if any(not is_distinct(c["diff"], ed) for ed in existing_diffs):
                continue

            hue_shift = hue_cycle[h_idx % len(hue_cycle)]
            h_idx += 1

            var_img = recolor_mask(img, c["mask"], hue_deg=hue_shift)
            
            passed, _, _, _ = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                img, var_img, c["bbox"], operation="recolor", difficulty="Medium"
            )
            
            if passed:
                v_num = len(existing) + 1
                v_id = f"{b_id}_var{v_num}"
                v_filename = f"{v_id}_variant.jpg"
                v_path = str(OUT_DIR / v_filename)
                
                Image.fromarray(cv2.cvtColor(var_img, cv2.COLOR_BGR2RGB)).save(v_path, "JPEG", quality=98)
                
                c["diff"]["id"] = 1
                c["diff"]["description"] = "Single recolored object difference"
                c["diff"]["hint"] = "Look closely for a color change"
                c["diff"]["operation"] = "recolor"
                
                entry = {
                    "id": v_id,
                    "title": f"{title} (Color Shift {v_num})",
                    "baseImage": img_path,
                    "variantImage": v_path,
                    "operation": "recolor",
                    "generationMethod": "structural_affordance",
                    "dimensions": {"width": w, "height": h},
                    "aspectRatio": "2:3",
                    "baseId": b_id,
                    "diffs": [c["diff"]]
                }
                entry["variantCode"] = variant_code(entry)
                existing.append(entry)
                existing_diffs.append(c["diff"])
                print(f"   ✓ Var {v_num} [RECOLOR]: at ({c['diff']['x']}%, {c['diff']['y']}%), r={c['diff']['radius']:.1f}% [{entry['variantCode']}]")

        grouped[b_id] = existing

    final_manifest = []
    for b_id in TARGET_BASES:
        final_manifest.extend(grouped.get(b_id, []))

    with open(MANIFEST_PATH, "w") as f:
        json.dump(final_manifest, f, indent=2)

    print("\n" + "=" * 80)
    print(f"🎉 FINAL TOTAL: {len(final_manifest)} / {len(TARGET_BASES) * 4} variants generated across all 9 scenes!")
    print(f"📄 Manifest updated at: {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
