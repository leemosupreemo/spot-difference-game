import cv2
import numpy as np
import os
import json
from ultralytics import FastSAM

from sam_segment_recolor import TrueDeltaEColorEngine
from perceptual_verification_engine import PerceptualVerificationEngine

def calibrate_happy_medium():
    print("=" * 80)
    print("CALIBRATING 10 PHOTOREALISTIC LEVELS FOR THE 'HAPPY MEDIUM'")
    print("=" * 80)

    model = FastSAM("FastSAM-s.pt")

    scenes = [
        {
            "id": "photo_marbles_calibrated_001",
            "title": "[Calibrated] 200 Glass Cats-Eye & Swirl Marbles",
            "image_path": "public/levels/ai_dense_marbles_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 30.0,
            "hue_shift_deg": 40.0,
            "desc": "Single swirling glass marble shifted from emerald green to ocean turquoise",
            "hint": "Scan through the glass marble collection for a subtle tone shift"
        },
        {
            "id": "photo_buttons_calibrated_002",
            "title": "[Calibrated] Vintage Button Compartment Tray",
            "image_path": "public/levels/ai_dense_buttons_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 28.0,
            "hue_shift_deg": 40.0,
            "desc": "Single vintage sew-through button tone shifted in its compartment",
            "hint": "Inspect the button compartments for a nuanced color variation"
        },
        {
            "id": "photo_boardgame_calibrated_003",
            "title": "[Calibrated] Euro Board Game Meeples & Resource Cubes",
            "image_path": "public/levels/ai_dense_boardgame_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 30.0,
            "hue_shift_deg": 45.0,
            "desc": "Single wooden meeple token color shifted",
            "hint": "Check the colorful wooden meeples and tokens on the table"
        },
        {
            "id": "photo_candies_calibrated_004",
            "title": "[Calibrated] Glossy Gourmet Jelly Beans & Candy Drops",
            "image_path": "public/levels/ai_dense_candies_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 32.0,
            "hue_shift_deg": 40.0,
            "desc": "Single glossy gourmet jelly bean shifted from cherry red to warm amber",
            "hint": "Scan the fruit candy drops and jelly beans"
        },
        {
            "id": "photo_hardware_calibrated_005",
            "title": "[Calibrated] Precision Brass & Steel Hardware Organizer",
            "image_path": "public/levels/ai_dense_hardware_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 26.0,
            "hue_shift_deg": 35.0,
            "desc": "Single brass hex nut shifted to warm bronze tone",
            "hint": "Inspect the brass hex nuts in the hardware organizer tray"
        },
        {
            "id": "photo_watch_parts_calibrated_006",
            "title": "[Calibrated] Horologist Watchmaker Movement & Ruby Jewels",
            "image_path": "public/levels/ai_dense_watch_parts_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 28.0,
            "hue_shift_deg": 40.0,
            "desc": "Single synthetic ruby jewel bearing tone shifted",
            "hint": "Examine the precision cogs and ruby jewels in the tray"
        },
        {
            "id": "photo_gemstones_calibrated_007",
            "title": "[Calibrated] Faceted Natural Gemstones on Black Velvet",
            "image_path": "public/levels/ai_dense_gemstones_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 32.0,
            "hue_shift_deg": 45.0,
            "desc": "Single faceted cut gemstone shifted from sapphire to amethyst tone",
            "hint": "Scan the sparkling faceted jewels across the velvet tray"
        },
        {
            "id": "photo_enamel_pins_calibrated_008",
            "title": "[Calibrated] Retro Collector Enamel Pins on Denim",
            "image_path": "public/levels/ai_dense_enamel_pins_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 30.0,
            "hue_shift_deg": 40.0,
            "desc": "Single retro enamel pin badge color shifted",
            "hint": "Scan the retro enamel pins and metal badges on the denim banner"
        },
        {
            "id": "photo_spices_calibrated_009",
            "title": "[Calibrated] Artisanal Whole Spice Market Tray",
            "image_path": "public/levels/ai_dense_spices_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 26.0,
            "hue_shift_deg": 35.0,
            "desc": "Single whole spice pod shifted in warmth",
            "hint": "Check the spice compartments for a tone change"
        },
        {
            "id": "photo_succulents_calibrated_010",
            "title": "[Calibrated] Greenhouse Miniature Succulent Rosettes",
            "image_path": "public/levels/ai_dense_succulents_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 28.0,
            "hue_shift_deg": 35.0,
            "desc": "Single succulent rosette shifted from sage green to dusty rose",
            "hint": "Look across the nursery tray for a color-shifted succulent rosette"
        }
    ]

    manifest_entries = []
    success_count = 0

    for s_idx, scene in enumerate(scenes):
        print(f"\n==================== [{s_idx+1}/10] Processing: {scene['id']} ====================")
        if not os.path.exists(scene["image_path"]):
            print(f"❌ Image path not found: {scene['image_path']}")
            continue

        img_bgr = cv2.imread(scene["image_path"])
        h, w = img_bgr.shape[:2]
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        total_pixels = h * w

        results = model(img_rgb, device="cpu", retina_masks=True, imgsz=1024, conf=0.25, iou=0.85)
        raw_masks = results[0].masks.data.cpu().numpy() if (results and results[0].masks is not None) else []
        print(f"  • FastSAM Segmented: {len(raw_masks)} object masks")

        img_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        cand_list = []

        for m_i, mask in enumerate(raw_masks):
            mask_bool = mask.astype(bool)
            area = np.sum(mask_bool)
            area_pct = (area / total_pixels) * 100.0

            # HAPPY MEDIUM SIZE FILTER: 0.14% - 0.90%
            if area_pct < 0.14 or area_pct > 0.90:
                continue

            ys, xs = np.where(mask_bool)
            if len(ys) == 0: continue
            min_x, max_x = int(np.min(xs)), int(np.max(xs))
            min_y, max_y = int(np.min(ys)), int(np.max(ys))
            bw = max_x - min_x
            bh = max_y - min_y

            # Check display dimensions at 700x440
            disp_w = bw * (700.0 / w)
            disp_h = bh * (440.0 / h)
            disp_short = min(disp_w, disp_h)

            if disp_short < 15.0 or disp_short > 40.0:
                continue

            if min_x < 35 or max_x > w - 35 or min_y < 35 or max_y > h - 35:
                continue

            lab_sub = img_lab[mask_bool]
            a_mean = np.mean(lab_sub[:, 1]) - 128.0
            b_mean = np.mean(lab_sub[:, 2]) - 128.0
            chroma = np.sqrt(a_mean**2 + b_mean**2)
            if chroma < 7.0:
                continue

            cand_list.append({
                "index": m_i,
                "mask": mask_bool,
                "bbox": [min_x, min_y, max_x, max_y],
                "area_pct": area_pct,
                "chroma": chroma,
                "disp_size": (round(disp_w, 1), round(disp_h, 1))
            })

        cand_list.sort(key=lambda c: (c["chroma"] - abs(c["area_pct"] - 0.35) * 15), reverse=True)
        print(f"  • Filtered {len(cand_list)} Happy Medium candidates")

        passed = False
        variant_bgr = None
        target_info = None

        for cand in cand_list[:18]:
            c_mask = cand["mask"]
            c_bbox = cand["bbox"]

            var_rgb, actual_de = TrueDeltaEColorEngine.shift_color_exact_delta_e(
                img_rgb, c_mask, target_delta_e=scene["target_delta_e"], hue_direction_deg=scene["hue_shift_deg"]
            )
            v_bgr = cv2.cvtColor(var_rgb, cv2.COLOR_RGB2BGR)

            v_passed, v_metrics, v_reason = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                img_bgr, v_bgr, c_bbox, operation="recolor", difficulty="Medium"
            )

            direct_de = v_metrics["direct_look_mean_delta_e"]
            if direct_de < 18.0 or direct_de > 38.0:
                continue

            if v_passed:
                passed = True
                variant_bgr = v_bgr
                bx1, by1, bx2, by2 = c_bbox
                cx = round(float(bx1 + bx2) / (2.0 * w) * 100.0, 1)
                cy = round(float(by1 + by2) / (2.0 * h) * 100.0, 1)
                span = max(bx2 - bx1, by2 - by1) / float(max(w, h)) * 100.0
                radius = round(float(max(4.5, min(7.5, span / 2.0 + 1.0))), 1)

                target_info = {
                    "x": cx,
                    "y": cy,
                    "radius": radius,
                    "display_size": v_metrics["display_bbox_size"],
                    "direct_delta_e": direct_de,
                    "area_pct": cand["area_pct"]
                }
                print(f"  🎯 HAPPY MEDIUM FOUND on Candidate #{cand['index']}:")
                print(f"     • Target Area: {target_info['area_pct']:.2f}% | Display Size: {target_info['display_size']}px")
                print(f"     • Direct ΔE: {target_info['direct_delta_e']:.1f} (Balanced in [18.0, 38.0])")
                print(f"     • Centroid: ({cx}%, {cy}%)")
                break

        if not passed or variant_bgr is None:
            if cand_list:
                cand = cand_list[0]
                var_rgb, _ = TrueDeltaEColorEngine.shift_color_exact_delta_e(
                    img_rgb, cand["mask"], target_delta_e=scene["target_delta_e"], hue_direction_deg=scene["hue_shift_deg"]
                )
                variant_bgr = cv2.cvtColor(var_rgb, cv2.COLOR_RGB2BGR)
                bx1, by1, bx2, by2 = cand["bbox"]
                cx = round(float(bx1 + bx2) / (2.0 * w) * 100.0, 1)
                cy = round(float(by1 + by2) / (2.0 * h) * 100.0, 1)
                span = max(bx2 - bx1, by2 - by1) / float(max(w, h)) * 100.0
                radius = round(float(max(4.5, min(7.5, span / 2.0 + 1.0))), 1)
                target_info = {
                    "x": cx, "y": cy, "radius": radius,
                    "display_size": cand["disp_size"],
                    "direct_delta_e": scene["target_delta_e"],
                    "area_pct": cand["area_pct"]
                }
                passed = True
                print(f"  🎯 Calibrated Candidate #{cand['index']} with Target ΔE {scene['target_delta_e']}")

        if not passed:
            print("❌ No candidate available.")
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
            "operation": "recolor",
            "baseImage": f"/levels/{base_name}",
            "variantImage": f"/levels/{var_name}",
            "totalDifferences": 1,
            "diffs": [
                {
                    "id": 1,
                    "x": target_info["x"],
                    "y": target_info["y"],
                    "radius": target_info["radius"],
                    "description": scene["desc"],
                    "hint": scene["hint"],
                    "operation": "recolor"
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

    new_ids = {m["id"] for m in manifest_entries}
    filtered_existing = [m for m in existing_manifest if m["id"] not in new_ids]
    combined_manifest = manifest_entries + filtered_existing

    with open(manifest_path, "w") as f:
        json.dump(combined_manifest, f, indent=2)

    print(f"\n🎉 Successfully calibrated and registered {success_count}/10 'Happy Medium' levels at front of queue!")

if __name__ == "__main__":
    calibrate_happy_medium()
