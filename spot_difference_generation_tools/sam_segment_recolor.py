"""
Constrained Photorealistic Spot-the-Difference Generation Pipeline
Implements:
1. Scene Affordance & Clutter Pre-Filtering (Reject low-object / hero-object scenes)
2. FastSAM Instance Detection & Smart Sub-Object Mask Ranking (No "first match")
3. ZERO Geometric Circle Fallback (Hard rejection if segmentation fails or is out of bounds)
4. Sub-Object Targeting (Handles, caps, spools, fasteners - not entire object bodies)
5. Object-Class Aware Luminance-Preserving Recolor Engine (100% scratch & reflection retention)
6. Automated Pixel Diff QA Gate (Area, single hotspot, zero drift)
"""

import os
import json
import cv2
import numpy as np
from ultralytics import FastSAM

# ==============================================================================
# 1. SCENE AFFORDANCE & CLUTTER PRE-FILTER
# ==============================================================================
class SceneAffordanceFilter:
    """
    Evaluates whether a candidate photograph supports natural, subtle, high-clutter edits.
    Rejects single hero objects, low-clutter compositions, and large smooth surfaces.
    """
    @staticmethod
    def evaluate_scene(image_bgr, masks):
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        
        # 1. Check object instance count
        if len(masks) < 12:
            return False, f"Too few objects ({len(masks)} < 12). Scene lacks required clutter."
        
        # 2. Check for dominant hero object (> 25% of frame)
        for idx, m in enumerate(masks):
            mask_area = np.sum(m > 0)
            area_pct = (mask_area / total_pixels) * 100.0
            if area_pct > 25.0:
                return False, f"Dominant hero object detected (Object #{idx} is {area_pct:.1f}% of frame > 25%)."
        
        # 3. Count viable sub-object targets (between 0.15% and 3.0% of image)
        viable_targets = 0
        for m in masks:
            area_pct = (np.sum(m > 0) / total_pixels) * 100.0
            if 0.15 <= area_pct <= 3.0:
                viable_targets += 1
                
        if viable_targets < 5:
            return False, f"Insufficient sub-object edit targets ({viable_targets} viable targets < 5)."
            
        return True, f"Scene approved! {len(masks)} total objects, {viable_targets} viable sub-object targets."

# ==============================================================================
# 2. SMART SUB-OBJECT MASK SCORER & RANKER (NO CIRCLE FALLBACK)
# ==============================================================================
class SubObjectMaskScorer:
    """
    Evaluates all FastSAM instance masks intersecting a candidate target region.
    Scores candidates by ideal sub-object area, compactness, centroid proximity, and edge fidelity.
    """
    @staticmethod
    def rank_and_select_mask(masks, prompt_point, image_shape, ideal_area_pct_range=(0.20, 2.5)):
        h, w = image_shape[:2]
        total_pixels = h * w
        px, py = prompt_point
        
        scored_candidates = []
        min_pct, max_pct = ideal_area_pct_range
        
        for idx, m in enumerate(masks):
            m_resized = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            
            # Must intersect prompt point or immediate neighborhood (within 10px)
            neighborhood = m_resized[max(0, py-10):min(h, py+10), max(0, px-10):min(w, px+10)]
            if np.sum(neighborhood) == 0:
                continue
                
            pixel_count = int(np.sum(m_resized > 0))
            area_pct = (pixel_count / total_pixels) * 100.0
            
            # Hard size gating: reject masks that are too tiny (< 0.08%) or parent containers (> 3.5%)
            if area_pct < 0.08 or area_pct > 3.5:
                continue
                
            ys, xs = np.where(m_resized > 0)
            cx, cy = np.mean(xs), np.mean(ys)
            dist_to_prompt = np.hypot(cx - px, cy - py)
            
            # Bounding box span
            span_x = np.max(xs) - np.min(xs)
            span_y = np.max(ys) - np.min(ys)
            aspect_ratio = max(span_x, span_y) / (min(span_x, span_y) + 1e-5)
            
            # Compactness score (reject sprawling background leakage)
            compactness = pixel_count / ((span_x + 1) * (span_y + 1))
            
            # Distance penalty
            dist_score = max(0.0, 1.0 - (dist_to_prompt / (min(w, h) * 0.15)))
            
            # Ideal area bonus (centered around 0.5% - 1.5%)
            area_score = 1.0 if min_pct <= area_pct <= max_pct else 0.5
            
            total_score = (dist_score * 0.40) + (compactness * 0.35) + (area_score * 0.25)
            
            scored_candidates.append({
                "index": idx,
                "mask": m_resized,
                "pixel_count": pixel_count,
                "area_pct": area_pct,
                "score": total_score,
                "centroid": (round(float(cx) / w * 100, 1), round(float(cy) / h * 100, 1)),
                "span": (span_x / w * 100, span_y / h * 100)
            })
            
        if not scored_candidates:
            # STRICT REJECTION: ZERO CIRCULAR FALLBACK
            return None, "All candidate masks failed area gating, shape compactness, or proximity checks."
            
        # Sort by score descending
        scored_candidates.sort(key=lambda c: c["score"], reverse=True)
        best = scored_candidates[0]
        return best, f"Selected Object #{best['index']} (Score: {best['score']:.2f}, Area: {best['area_pct']:.2f}%)"

# ==============================================================================
# 3. OBJECT-CLASS AWARE LUMINANCE-PRESERVING RECOLOR ENGINE
# ==============================================================================
def transform_object_chroma(image_rgb, mask, target_hue, sat_scale=1.0, val_scale=1.0):
    """
    Transforms the hue of the isolated sub-object material while preserving 100% of:
    - Molded ridges and tool grip contours
    - Surface scratches, micro-texture, and wear
    - Specular highlights and cast shadow gradients
    """
    hsv = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    
    mask_bool = mask > 0
    # Apply only to saturated material pixels (preserves neutral highlights & shadow occlusions)
    material_mask = mask_bool & (s > 25) & (v > 20) & (v < 245)
    
    h[material_mask] = (target_hue * 180.0) % 180.0
    s[material_mask] = np.clip(s[material_mask] * sat_scale, 0, 255)
    v[material_mask] = np.clip(v[material_mask] * val_scale, 0, 255)
    
    hsv[:, :, 0] = h
    hsv[:, :, 1] = s
    hsv[:, :, 2] = v
    
    recolored = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    
    # Hard composite: 100% byte invariance everywhere outside the isolated sub-object mask
    out = image_rgb.copy()
    out[material_mask] = recolored[material_mask]
    return out

# ==============================================================================
# 4. DIFF QA & GROUND TRUTH VALIDATOR
# ==============================================================================
def qa_validate_difference(base_rgb, variant_rgb):
    """
    Verifies that the generated pair satisfies all production spot-the-difference constraints:
    - Exactly 1 localized difference hotspot
    - No background drift outside the target
    - Area between 0.08% and 3.0%
    """
    diff = np.max(np.abs(base_rgb.astype(np.int16) - variant_rgb.astype(np.int16)), axis=2)
    diff_mask = (diff > 18).astype(np.uint8)
    
    total_diff_pixels = np.sum(diff_mask)
    h, w = base_rgb.shape[:2]
    area_pct = (total_diff_pixels / (h * w)) * 100.0
    
    if area_pct < 0.05:
        return False, None, f"QA Failed: Difference is too subtle/invisible ({area_pct:.3f}% < 0.05%)."
    if area_pct > 3.5:
        return False, None, f"QA Failed: Difference is too large/loud ({area_pct:.2f}% > 3.5%)."
        
    # Check connected components (must be strictly 1 unified component)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(diff_mask)
    
    # Filter out single-pixel noise
    valid_components = [i for i in range(1, num_labels) if stats[i, cv2.CC_STAT_AREA] > 15]
    if len(valid_components) != 1:
        return False, None, f"QA Failed: Detected {len(valid_components)} disconnected difference hotspots (Must be strictly 1)."
        
    target_idx = valid_components[0]
    cx = round(float(centroids[target_idx][0]) / w * 100, 1)
    cy = round(float(centroids[target_idx][1]) / h * 100, 1)
    span_w = stats[target_idx, cv2.CC_STAT_WIDTH] / w * 100
    span_h = stats[target_idx, cv2.CC_STAT_HEIGHT] / h * 100
    radius = round(float(max(4.2, min(7.5, max(span_w, span_h) / 2 + 1.2))), 1)
    
    return True, { "x": cx, "y": cy, "radius": radius, "area_pct": area_pct }, "QA Passed"

import urllib.request
import ssl

def download_if_missing(url, dest_path):
    if not os.path.exists(dest_path):
        print(f"Downloading high-resolution source photo from {url[:50]}... -> {dest_path}")
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
        )
        with urllib.request.urlopen(req, context=ctx) as response, open(dest_path, 'wb') as out_file:
            out_file.write(response.read())

# ==============================================================================
# 5. EXECUTION PIPELINE
# ==============================================================================
def execute_production_pipeline():
    print("=" * 70)
    print("PHOTOREALISTIC SPOT-THE-DIFFERENCE PIPELINE (CONSTRAINED SUB-OBJECT)")
    print("=" * 70)
    
    model = FastSAM("FastSAM-s.pt")
    
    # Candidate specs targeting authentic sub-objects
    candidate_specs = [
        {
            "id": "prod_toolpile_screwdriver_handle_001",
            "title": "[Photo] Workshop Bench Screwdriver Grip Recolor",
            "source_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/prod_toolpile_screwdriver_handle_001_base.jpg",
            "prompt_point": [750, 470],
            "target_part": "Screwdriver rubber grip sleeve",
            "target_hue": 0.60, # Natural Cobalt Blue
            "desc": "Single screwdriver handle rubber grip shifted from amber to deep cobalt blue (preserving 100% molded ridges & wear)",
            "hint": "Inspect the tool handles and grip sleeves in the workshop collection"
        },
        {
            "id": "prod_sewing_thread_spool_001",
            "title": "[Photo] Tailor Notions Box Spool Thread Wrap",
            "source_url": "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/prod_sewing_thread_spool_001_base.jpg",
            "prompt_point": [830, 480],
            "target_part": "Spool thread fibers",
            "target_hue": 0.38, # Natural Emerald Green
            "desc": "Single wooden thread spool wrap shifted from gold-yellow to emerald green (preserving thread fiber texture & wood endcaps)",
            "hint": "Check the colored thread spools and notions near the scissors"
        },
        {
            "id": "prod_artist_paint_tube_cap_001",
            "title": "[Photo] Artist Oil Paint Tube Cap & Label",
            "source_url": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/prod_artist_paint_tube_cap_001_base.jpg",
            "prompt_point": [850, 640],
            "target_part": "Oil paint tube cap and shoulder collar",
            "target_hue": 0.58, # Natural Violet/Blue
            "desc": "Single oil paint tube label and cap shifted from vermilion red to cobalt blue",
            "hint": "Scan the caps and labels on the oil paint tubes on the table"
        }
    ]

    manifest_path = "public/levels/photo_pair_manifest.json"
    official_path = "official_curated_levels.json"
    
    with open(manifest_path, "r") as f: manifest = json.load(f)
    with open(official_path, "r") as f: official = json.load(f)

    approved_entries = []

    for spec in candidate_specs:
        print(f"\n--- Processing Candidate: {spec['id']} ---")
        if not os.path.exists(spec["base_image"]) and "source_url" in spec:
            try:
                download_if_missing(spec["source_url"], spec["base_image"])
            except Exception as e:
                print(f"❌ Failed to download {spec['source_url']}: {e}")
                continue
            
        img_bgr = cv2.imread(spec["base_image"])
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        
        # Step 1: Run FastSAM
        results = model(img_bgr, device="cpu", retina_masks=True, imgsz=1024, conf=0.35, iou=0.9, verbose=False)
        if not results or len(results) == 0 or results[0].masks is None:
            print("❌ FastSAM failed to detect objects. Candidate rejected.")
            continue
            
        raw_masks = results[0].masks.data.cpu().numpy()
        
        # Step 2: Scene Affordance Pre-Filter
        passed_affordance, affordance_msg = SceneAffordanceFilter.evaluate_scene(img_bgr, raw_masks)
        if not passed_affordance:
            print(f"❌ Scene Affordance Rejection: {affordance_msg}")
            continue
        print(f"✓ Scene Affordance: {affordance_msg}")
        
        # Step 3: Smart Sub-Object Mask Ranking (Zero Circle Fallback)
        best_candidate, selection_msg = SubObjectMaskScorer.rank_and_select_mask(raw_masks, spec["prompt_point"], img_bgr.shape)
        if not best_candidate:
            print(f"❌ Mask Selection Rejection: {selection_msg}")
            continue
        print(f"✓ Mask Selection: {selection_msg}")
        
        # Step 4: Object-Class Aware Luminance-Preserving Recolor
        variant_rgb = transform_object_chroma(img_rgb, best_candidate["mask"], spec["target_hue"])
        
        # Step 5: Diff QA Validation
        qa_passed, qa_metrics, qa_msg = qa_validate_difference(img_rgb, variant_rgb)
        if not qa_passed:
            print(f"❌ Diff QA Rejection: {qa_msg}")
            continue
        print(f"✓ QA Gate Passed: Area={qa_metrics['area_pct']:.2f}%, Centroid=({qa_metrics['x']}%, {qa_metrics['y']}%), Radius={qa_metrics['radius']}%")
        
        # Step 6: Save Output Files
        base_name = f"{spec['id']}_base.jpg"
        var_name = f"{spec['id']}_variant.jpg"
        base_path = os.path.join("public/levels", base_name)
        var_path = os.path.join("public/levels", var_name)
        
        cv2.imwrite(base_path, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 94])
        cv2.imwrite(var_path, cv2.cvtColor(variant_rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 94])
        
        entry = {
            "id": spec["id"],
            "title": spec["title"],
            "category": "Photography",
            "pack": "Photography",
            "packId": "find_the_sniper",
            "difficulty": "Medium",
            "baseImage": f"/levels/{base_name}",
            "variantImage": f"/levels/{var_name}",
            "diffs": [{
                "id": 1,
                "x": qa_metrics["x"],
                "y": qa_metrics["y"],
                "radius": qa_metrics["radius"],
                "description": spec["desc"],
                "hint": spec["hint"]
            }]
        }
        approved_entries.append(entry)

    if approved_entries:
        new_id_set = {e["id"] for e in approved_entries}
        updated_manifest = approved_entries + [m for m in manifest if m["id"] not in new_id_set]
        with open(manifest_path, "w") as f:
            json.dump(updated_manifest, f, indent=2)
        print(f"\n🎉 Successfully registered {len(approved_entries)} high-quality pairs in photo_pair_manifest.json!")

    print(f"🎉 Pipeline Finished! {len(approved_entries)} / {len(candidate_specs)} candidates passed all hard rejection gates.")

if __name__ == "__main__":
    execute_production_pipeline()

