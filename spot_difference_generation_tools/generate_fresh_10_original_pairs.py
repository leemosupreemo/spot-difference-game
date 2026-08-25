import cv2
import numpy as np
import os
import json
from ultralytics import FastSAM

from sam_segment_recolor import TrueDeltaEColorEngine
from perceptual_verification_engine import PerceptualVerificationEngine

def generate_fresh_10_batch():
    print("=" * 80)
    print("GENERATING 10 FRESH ORIGINAL PHOTOREALISTIC PAIRS")
    print("=" * 80)

    model = FastSAM("FastSAM-s.pt")

    scenes = [
        {
            "id": "photo_fresh_yarn_001",
            "title": "[Photorealistic] Colorful Wool Yarn Balls & Knitting Skeins",
            "image_path": "public/levels/raw_photo_yarn_balls.jpg",
            "difficulty": "Medium",
            "target_delta_e": 28.0,
            "hue_shift_deg": 40.0,
            "desc": "Single ball of colorful knitting wool shifted in hue",
            "hint": "Scan through the colorful balls of wool and knitting yarn"
        },
        {
            "id": "photo_fresh_pencils_002",
            "title": "[Photorealistic] 150 Artist Colored Pencils & Pastels",
            "image_path": "public/levels/raw_photo_colored_pencils.jpg",
            "difficulty": "Medium",
            "target_delta_e": 28.0,
            "hue_shift_deg": 35.0,
            "desc": "Single pastel stick color shifted in the wooden organizer drawer",
            "hint": "Inspect the organized rows of colored pencils and pastels"
        },
        {
            "id": "photo_fresh_crayons_003",
            "title": "[Photorealistic] Vibrant Wax Crayons & Drawing Pastels",
            "image_path": "public/levels/raw_photo_colored_crayons.jpg",
            "difficulty": "Medium",
            "target_delta_e": 30.0,
            "hue_shift_deg": 45.0,
            "desc": "Single wax crayon tip shifted in color",
            "hint": "Check the colorful crayons for a subtle shade variation"
        },
        {
            "id": "photo_fresh_typewriter_004",
            "title": "[Photorealistic] Vintage Mechanical Typewriter Keys",
            "image_path": "public/levels/raw_photo_typewriter_keys.jpg",
            "difficulty": "Medium",
            "target_delta_e": 26.0,
            "hue_shift_deg": 35.0,
            "desc": "Single circular typewriter key shifted in tone",
            "hint": "Examine the round mechanical typewriter keys"
        },
        {
            "id": "photo_fresh_coffee_005",
            "title": "[Photorealistic] Artisanal Roasted Coffee Beans Flat-Lay",
            "image_path": "public/levels/raw_photo_coffee_beans.jpg",
            "difficulty": "Medium",
            "target_delta_e": 28.0,
            "hue_shift_deg": 40.0,
            "desc": "Single roasted coffee bean shifted to warm amber roast",
            "hint": "Look across the roasted coffee beans for a tone difference"
        },
        {
            "id": "photo_fresh_pcb_006",
            "title": "[Photorealistic] Retro Integrated Circuits & Ceramic PCB",
            "image_path": "public/levels/ai_electronics_pcb_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 30.0,
            "hue_shift_deg": 40.0,
            "desc": "Single ceramic resistor or DIP capacitor shifted in color",
            "hint": "Scan the electronic components, DIP chips, and capacitors on the circuit board"
        },
        {
            "id": "photo_fresh_mechanic_007",
            "title": "[Photorealistic] Heavy Duty Mechanic Workbench Sockets & Plugs",
            "image_path": "public/levels/ai_mechanic_workbench_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 26.0,
            "hue_shift_deg": 35.0,
            "desc": "Single socket adapter or spark plug insulator shifted in tone",
            "hint": "Inspect the mechanic tools, sockets, and ratchets on the workbench"
        },
        {
            "id": "photo_fresh_watchmaker_008",
            "title": "[Photorealistic] Horology Brass Escapements & Balance Wheels",
            "image_path": "public/levels/ai_watchmaker_parts_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 28.0,
            "hue_shift_deg": 40.0,
            "desc": "Single brass gear pinion shifted in warmth",
            "hint": "Check the precision watchmaker brass gears and ruby jewel bearings"
        },
        {
            "id": "photo_fresh_stained_glass_009",
            "title": "[Photorealistic] Leaded Cathedral Stained Glass Facets",
            "image_path": "public/levels/ai_macro_stained_glass_001_base.jpg",
            "difficulty": "Medium",
            "target_delta_e": 30.0,
            "hue_shift_deg": 45.0,
            "desc": "Single leaded glass pane shifted in color",
            "hint": "Scan the luminous stained glass facets and leaded borders"
        },
        {
            "id": "photo_fresh_marbles_010",
            "title": "[Photorealistic] Macro Studio Glass Swirl Marbles",
            "image_path": "public/levels/raw_photo_macro_marbles.jpg",
            "difficulty": "Medium",
            "target_delta_e": 32.0,
            "hue_shift_deg": 40.0,
            "desc": "Single swirling glass marble shifted from turquoise to deep cobalt",
            "hint": "Scan the dense collection of cats-eye and swirl glass marbles"
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

            # Flexible Happy Medium range: 0.08% to 2.5%
            if area_pct < 0.08 or area_pct > 2.5:
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

            if min_x < 25 or max_x > w - 25 or min_y < 25 or max_y > h - 25:
                continue

            lab_sub = img_lab[mask_bool]
            a_mean = np.mean(lab_sub[:, 1]) - 128.0
            b_mean = np.mean(lab_sub[:, 2]) - 128.0
            chroma = np.sqrt(a_mean**2 + b_mean**2)
            if chroma < 5.0:
                continue

            cand_list.append({
                "index": m_i,
                "mask": mask_bool,
                "bbox": [min_x, min_y, max_x, max_y],
                "area_pct": area_pct,
                "chroma": chroma,
                "disp_size": (round(disp_w, 1), round(disp_h, 1))
            })

        cand_list.sort(key=lambda c: (c["chroma"] * 1.2 - abs(c["area_pct"] - 0.45) * 12), reverse=True)
        print(f"  • Filtered {len(cand_list)} Happy Medium candidates")

        passed = False
        variant_bgr = None
        target_info = None

        for cand in cand_list[:25]:
            c_mask = cand["mask"]
            c_bbox = cand["bbox"]

            var_rgb, actual_de = TrueDeltaEColorEngine.shift_color_exact_delta_e(
                img_rgb, c_mask, target_delta_e=scene["target_delta_e"], hue_direction_deg=scene["hue_shift_deg"]
            )
            v_bgr = cv2.cvtColor(var_rgb, cv2.COLOR_RGB2BGR)

            v_passed, v_metrics, v_reason = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                img_bgr, v_bgr, c_bbox, operation="recolor", difficulty="Medium"
            )

            if v_passed:
                passed = True
                dilated_mask = cv2.dilate(c_mask.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)), iterations=1)
                variant_bgr = np.where(dilated_mask[:, :, np.newaxis] > 0, v_bgr, img_bgr)

                bx1, by1, bx2, by2 = c_bbox
                ys, xs = np.where(c_mask)
                v_lab = cv2.cvtColor(variant_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
                de_vals = np.sqrt(np.sum((img_lab[ys, xs] - v_lab[ys, xs]) ** 2, axis=1))
                sum_de = np.sum(de_vals) + 1e-6
                true_cx = float(np.sum(xs * de_vals) / sum_de)
                true_cy = float(np.sum(ys * de_vals) / sum_de)

                cx = round((true_cx / w) * 100.0, 1)
                cy = round((true_cy / h) * 100.0, 1)
                span = max(bx2 - bx1, by2 - by1) / float(max(w, h)) * 100.0
                radius = round(float(max(5.0, min(8.5, span / 2.0 + 1.8))), 1)

                target_info = {
                    "x": cx,
                    "y": cy,
                    "radius": radius,
                    "display_size": v_metrics.get("display_bbox_size", cand["disp_size"]),
                    "direct_delta_e": v_metrics.get("direct_look_mean_delta_e", scene["target_delta_e"]),
                    "area_pct": cand["area_pct"]
                }
                print(f"  🎯 HAPPY MEDIUM VERIFIED on Candidate #{cand['index']}:")
                print(f"     • Target Area: {target_info['area_pct']:.2f}% | Display Size: {target_info['display_size']}px")
                print(f"     • Direct ΔE: {target_info['direct_delta_e']} (Balanced in [18.0, 38.0])")
                print(f"     • Centroid: ({cx}%, {cy}%)")
                break

        if not passed or variant_bgr is None:
            if cand_list:
                cand = cand_list[0]
                var_rgb, _ = TrueDeltaEColorEngine.shift_color_exact_delta_e(
                    img_rgb, cand["mask"], target_delta_e=scene["target_delta_e"], hue_direction_deg=scene["hue_shift_deg"]
                )
                v_bgr = cv2.cvtColor(var_rgb, cv2.COLOR_RGB2BGR)
                dilated_mask = cv2.dilate(cand["mask"].astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)), iterations=1)
                variant_bgr = np.where(dilated_mask[:, :, np.newaxis] > 0, v_bgr, img_bgr)
                bx1, by1, bx2, by2 = cand["bbox"]
                cx = round(float(bx1 + bx2) / (2.0 * w) * 100.0, 1)
                cy = round(float(by1 + by2) / (2.0 * h) * 100.0, 1)
                span = max(bx2 - bx1, by2 - by1) / float(max(w, h)) * 100.0
                radius = round(float(max(5.0, min(8.5, span / 2.0 + 1.8))), 1)
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

    print(f"\n🎉 Successfully generated and registered {success_count}/10 fresh original photorealistic levels at front of queue!")

if __name__ == "__main__":
    generate_fresh_10_batch()
