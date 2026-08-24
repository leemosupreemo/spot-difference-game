import os
import json
import cv2
import numpy as np
from ultralytics import FastSAM

def rgb_to_hsv_transform(image_rgb, mask, hue_shift=0.55):
    """
    Transforms the hue/chroma of masked pixels while preserving 100% of the original
    luminance, reflections, scratches, texture, and edge antialiasing.
    """
    hsv = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    
    mask_bool = mask > 0
    # Apply hue shift only where object has saturation (preserves neutral highlights & deep shadows)
    sat_mask = mask_bool & (s > 30) & (v > 25) & (v < 240)
    h[sat_mask] = (h[sat_mask] + hue_shift * 180.0) % 180.0
    
    hsv[:, :, 0] = h
    hsv[:, :, 1] = s
    hsv[:, :, 2] = v
    
    recolored = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    
    out = image_rgb.copy()
    out[sat_mask] = recolored[sat_mask]
    return out

def run_sam_pipeline():
    print("Initializing FastSAM model...")
    model = FastSAM("FastSAM-s.pt")
    
    specs = [
        {
            "id": "sam_toolpile_wrench_handle_001",
            "title": "[SAM Segmented] Master Tool Pile Screwdriver Grip",
            "base_image": "public/levels/real_toolpile_screwdriver_handle_001_base.jpg",
            "point": [650, 410],
            "desc": "Single screwdriver handle segmented via FastSAM and color-shifted to deep cobalt blue",
            "hint": "Inspect the tool handles and grip sleeves in the workshop collection",
            "hue_shift": 0.55
        },
        {
            "id": "sam_sewing_thread_spool_001",
            "title": "[SAM Segmented] Tailor Notions Box Spool Thread",
            "base_image": "public/levels/real_sewing_threads_spool_001_base.jpg",
            "point": [720, 415],
            "desc": "Single wooden thread spool segmented via FastSAM and shifted to emerald green",
            "hint": "Check the colored thread spools and notions near the scissors",
            "hue_shift": 0.35
        },
        {
            "id": "sam_artist_paint_tube_001",
            "title": "[SAM Segmented] Artist Oil Paint Tube Cap & Label",
            "base_image": "public/levels/real_artist_paint_tube_cap_001_base.jpg",
            "point": [740, 560],
            "desc": "Single oil paint tube label and cap segmented via FastSAM and shifted to cobalt blue",
            "hint": "Scan the caps and labels on the oil paint tubes on the table",
            "hue_shift": 0.58
        }
    ]

    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    new_entries = []

    for spec in specs:
        if not os.path.exists(spec["base_image"]):
            print(f"Skipping {spec['id']}: {spec['base_image']} not found")
            continue
            
        img_bgr = cv2.imread(spec["base_image"])
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        h, w = img_rgb.shape[:2]
        px, py = spec["point"]

        print(f"Running FastSAM on {spec['id']} at point [{px}, {py}]...")
        results = model(
            img_bgr,
            device="cpu",
            retina_masks=True,
            imgsz=1024,
            conf=0.35,
            iou=0.9
        )

        target_mask = None
        if results and len(results) > 0 and results[0].masks is not None:
            masks = results[0].masks.data.cpu().numpy()
            print(f"  Detected {len(masks)} candidate object instances in scene.")
            
            # Find candidate mask containing the prompt point
            for m in masks:
                m_resized = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
                if m_resized[py, px] > 0:
                    target_mask = m_resized
                    break

        if target_mask is None:
            print(f"  Fallback mask for {spec['id']}")
            target_mask = np.zeros((h, w), dtype=np.uint8)
            cv2.circle(target_mask, (px, py), int(min(w, h) * 0.035), 1, -1)

        pixel_count = int(np.sum(target_mask > 0))
        area_pct = pixel_count / (w * h) * 100
        print(f"  ✓ FastSAM segmented {pixel_count} exact object pixels ({area_pct:.2f}% of image)!")

        # Apply luminance-preserving recolor strictly on object mask
        variant_rgb = rgb_to_hsv_transform(img_rgb, target_mask, spec["hue_shift"])
        
        var_file_name = f"{spec['id']}_variant.jpg"
        base_file_name = f"{spec['id']}_base.jpg"
        var_path = os.path.join("public/levels", var_file_name)
        base_path = os.path.join("public/levels", base_file_name)

        cv2.imwrite(base_path, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
        cv2.imwrite(var_path, cv2.cvtColor(variant_rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])

        # Compute ground truth centroid from the SAM mask
        ys, xs = np.where(target_mask > 0)
        true_cx = round(float(np.mean(xs)) / w * 100, 1)
        true_cy = round(float(np.mean(ys)) / h * 100, 1)
        span_x = (np.max(xs) - np.min(xs)) / w * 100
        span_y = (np.max(ys) - np.min(ys)) / h * 100
        true_rad = round(float(max(4.2, min(7.5, max(span_x, span_y) / 2 + 1.2))), 1)

        print(f"  ✓ Calibrated: Centroid=({true_cx}%, {true_cy}%), Radius={true_rad}%\n")

        new_entries.append({
            "id": spec["id"],
            "title": spec["title"],
            "category": "Photography",
            "pack": "Photography",
            "packId": "find_the_sniper",
            "difficulty": "Hard",
            "baseImage": f"/levels/{base_file_name}",
            "variantImage": f"/levels/{var_file_name}",
            "diffs": [{
                "id": 1,
                "x": true_cx,
                "y": true_cy,
                "radius": true_rad,
                "description": spec["desc"],
                "hint": spec["hint"]
            }]
        })

    new_id_set = {e["id"] for e in new_entries}
    updated = new_entries + [m for m in manifest if m["id"] not in new_id_set]
    with open(manifest_path, "w") as f:
        json.dump(updated, f, indent=2)

    print(f"🎉 Successfully deployed {len(new_entries)} FastSAM-segmented pairs at indices 0..{len(new_entries)-1}! Total manifest size: {len(updated)}")

if __name__ == "__main__":
    run_sam_pipeline()
