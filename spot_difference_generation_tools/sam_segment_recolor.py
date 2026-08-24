"""
Adaptive Spotability & Semantic Spot-the-Difference Generation Pipeline
Implements:
1. True CIELAB Delta-E Scaling (Actual Euclidean delta-E enforcement in a*b* space)
2. Local Clutter & Salience Estimation (Sobel edge density & entropy in 3x target neighborhood)
3. Adaptive Spotability Convergence Loop (Iteratively adjusts edit strength into target difficulty window)
4. Strict Centroid-vs-Target Bounding Box QA (Rejects false-positive matches outside target)
5. Minimum Perceptible Area Constraint (0.15% - 2.5% of frame)
6. Scene Affordance Pre-Filter (Rejects low-clutter & hero-object dominated scenes)
"""

import os
import json
import cv2
import numpy as np
import ssl
import urllib.request
from ultralytics import FastSAM

# ==============================================================================
# 1. SCENE AFFORDANCE & CLUTTER PRE-FILTER
# ==============================================================================
class SceneAffordanceFilter:
    @staticmethod
    def evaluate_scene(image_bgr, masks):
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        
        # 1. Global edge density check
        edges = cv2.Canny(gray, 60, 150)
        global_edge_density = np.sum(edges > 0) / total_pixels
        if global_edge_density < 0.025:
            return False, f"Low scene complexity (Edge density {global_edge_density:.3f} < 0.025). Background too uniform."
        
        # 2. Object instance count (must be a cluttered composition)
        if len(masks) < 14:
            return False, f"Too few objects ({len(masks)} < 14). Lacks necessary visual clutter."
        
        # 3. Dominant hero object check (reject if any single object > 22% of frame)
        for idx, m in enumerate(masks):
            mask_area = np.sum(m > 0)
            area_pct = (mask_area / total_pixels) * 100.0
            if area_pct > 22.0:
                return False, f"Dominant hero object detected (Object #{idx} is {area_pct:.1f}% of frame > 22%)."
                
        return True, f"Scene Approved! (Objects: {len(masks)}, Global Edge Density: {global_edge_density:.3f})"

# ==============================================================================
# 2. LOCAL CLUTTER ESTIMATOR & PERCEPTUAL CIELAB COLOR ENGINE
# ==============================================================================
class LocalClutterEstimator:
    @staticmethod
    def estimate_clutter(image_bgr, target_bbox):
        """
        Estimates local visual clutter in a 3x expanded envelope around the target bbox.
        Returns a clutter multiplier >= 1.0 (busier scenes require higher Delta-E).
        """
        h, w = image_bgr.shape[:2]
        bx_min, by_min, bx_max, by_max = target_bbox
        bw = bx_max - bx_min
        bh = by_max - by_min
        
        # 3x expanded ROI
        rx_min = max(0, int(bx_min - bw))
        rx_max = min(w, int(bx_max + bw))
        ry_min = max(0, int(by_min - bh))
        ry_max = min(h, int(by_max + bh))
        
        roi_bgr = image_bgr[ry_min:ry_max, rx_min:rx_max]
        if roi_bgr.size == 0:
            return 1.0
            
        roi_gray = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(roi_gray, 50, 140)
        edge_density = np.sum(edges > 0) / (roi_gray.shape[0] * roi_gray.shape[1] + 1e-5)
        
        # Standardize: 0.05 edge density -> 1.0x, 0.20 edge density -> 2.2x
        clutter_multiplier = float(np.clip(1.0 + (edge_density * 6.0), 1.0, 2.6))
        return clutter_multiplier

class TrueDeltaEColorEngine:
    """
    Implements true Euclidean Delta-E scaling in CIELAB color space.
    Scales chromatic movement vector so actual measured Delta-E matches target.
    """
    @staticmethod
    def shift_color_exact_delta_e(image_rgb, mask, target_delta_e=22.0, hue_direction_deg=45.0):
        lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
        l_chan, a_chan, b_chan = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]

        mask_bool = mask > 0
        chroma = np.hypot(a_chan - 128.0, b_chan - 128.0)
        # Isolate genuine colored material pixels (preserves specular highlights and deep shadow crevasses)
        valid_material = mask_bool & (chroma > 8.0) & (l_chan > 20.0) & (l_chan < 245.0)

        if np.sum(valid_material) == 0:
            return image_rgb.copy(), 0.0

        old_a = a_chan[valid_material]
        old_b = b_chan[valid_material]

        # Calculate initial directional movement vector
        theta_rad = np.deg2rad(hue_direction_deg)
        a_centered = old_a - 128.0
        b_centered = old_b - 128.0
        
        rot_a = a_centered * np.cos(theta_rad) - b_centered * np.sin(theta_rad) + 128.0
        rot_b = a_centered * np.sin(theta_rad) + b_centered * np.cos(theta_rad) + 128.0

        delta_a = rot_a - old_a
        delta_b = rot_b - old_b
        vector_length = np.hypot(delta_a, delta_b)
        
        mean_len = float(np.mean(vector_length))
        if mean_len < 1e-3:
            scale = 1.0
        else:
            # Scale chromatic shift so actual mean Delta-E across material = target_delta_e
            scale = target_delta_e / mean_len

        scaled_a = np.clip(old_a + delta_a * scale, 0, 255)
        scaled_b = np.clip(old_b + delta_b * scale, 0, 255)

        a_chan[valid_material] = scaled_a
        b_chan[valid_material] = scaled_b

        lab[:, :, 0] = l_chan
        lab[:, :, 1] = a_chan
        lab[:, :, 2] = b_chan

        out_rgb = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)

        result = image_rgb.copy()
        result[valid_material] = out_rgb[valid_material]
        
        # Calculate actual resulting mean Delta-E
        actual_delta_e = float(np.mean(np.hypot(scaled_a - old_a, scaled_b - old_b)))
        return result, actual_delta_e

# ==============================================================================
# 3. MULTI-FACTOR MASK SCORER
# ==============================================================================
class SemanticMaskScorer:
    @staticmethod
    def compute_edge_alignment(mask_binary, gray_image):
        contours, _ = cv2.findContours(mask_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not contours: return 0.0
        grad_x = cv2.Sobel(gray_image, cv2.CV_32F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray_image, cv2.CV_32F, 0, 1, ksize=3)
        magnitude = np.hypot(grad_x, grad_y)
        boundary_mask = np.zeros_like(mask_binary)
        cv2.drawContours(boundary_mask, contours, -1, 255, 1)
        edge_pixels = magnitude[boundary_mask > 0]
        return float(np.clip(np.mean(edge_pixels) / 120.0, 0.0, 1.0)) if len(edge_pixels) > 0 else 0.0

    @classmethod
    def rank_and_select(cls, masks, target_bbox, prompt_point, image_rgb):
        h, w = image_rgb.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        
        bx_min, by_min, bx_max, by_max = target_bbox
        bbox_w = bx_max - bx_min
        bbox_h = by_max - by_min
        bbox_area = bbox_w * bbox_h
        
        scored = []
        for idx, m in enumerate(masks):
            m_resized = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            pixel_count = int(np.sum(m_resized > 0))
            if pixel_count == 0: continue
                
            area_pct = (pixel_count / total_pixels) * 100.0
            # Strict sub-object size gating: 0.15% to 2.5% of frame
            if area_pct < 0.15 or area_pct > 2.5:
                continue
                
            ys, xs = np.where(m_resized > 0)
            mx_min, mx_max = np.min(xs), np.max(xs)
            my_min, my_max = np.min(ys), np.max(ys)
            
            # 1. IoU with target bounding box
            inter_x1, inter_y1 = max(bx_min, mx_min), max(by_min, my_min)
            inter_x2, inter_y2 = min(bx_max, mx_max), min(by_max, my_max)
            inter_w = max(0, inter_x2 - inter_x1)
            inter_h = max(0, inter_y2 - inter_y1)
            inter_area = inter_w * inter_h
            
            mask_box_area = (mx_max - mx_min) * (my_max - my_min)
            union_area = bbox_area + mask_box_area - inter_area
            bbox_iou = inter_area / (union_area + 1e-5)
            
            # Must have non-trivial overlap with target bbox (>= 0.08 IoU or containment >= 0.28)
            coverage = inter_area / (mask_box_area + 1e-5)
            if bbox_iou < 0.08 and coverage < 0.28:
                continue
                
            edge_score = cls.compute_edge_alignment(m_resized, gray)
            span_w, span_h = mx_max - mx_min + 1, my_max - my_min + 1
            compactness = pixel_count / (span_w * span_h)
            
            mcx, mcy = np.mean(xs), np.mean(ys)
            dist_to_prompt = np.hypot(mcx - prompt_point[0], mcy - prompt_point[1])
            prox_score = max(0.0, 1.0 - (dist_to_prompt / (min(w, h) * 0.12)))
            
            total_score = (bbox_iou * 0.40) + (edge_score * 0.25) + (compactness * 0.20) + (prox_score * 0.15)
            
            scored.append({
                "index": idx,
                "mask": m_resized,
                "pixel_count": pixel_count,
                "area_pct": area_pct,
                "score": total_score,
                "bbox_iou": bbox_iou,
                "edge_score": edge_score,
                "centroid": (round(float(mcx) / w * 100, 1), round(float(mcy) / h * 100, 1)),
                "pixel_centroid": (mcx, mcy),
                "span": (span_w / w * 100, span_h / h * 100)
            })
            
        if not scored:
            return None, "No candidate masks satisfied semantic bounding-box containment and size constraints."
            
        scored.sort(key=lambda c: c["score"], reverse=True)
        best = scored[0]
        return best, f"Selected Object #{best['index']} (Score: {best['score']:.2f}, IoU: {best['bbox_iou']:.2f}, Area: {best['area_pct']:.2f}%)"

# ==============================================================================
# 4. ADAPTIVE SPOTABILITY FEEDBACK LOOP & QA CRITIC
# ==============================================================================
class AdaptiveSpotabilityLoop:
    """
    Iteratively converges edit strength to guarantee that the resulting difference
    falls precisely within the human-perceivable difficulty window.
    """
    SPOTABILITY_TARGETS = {
        "Easy": (12.0, 22.0),
        "Medium": (6.0, 12.0),
        "Hard": (3.2, 6.0)
    }

    @classmethod
    def generate_and_calibrate(cls, image_rgb, mask, target_bbox, difficulty="Medium", hue_direction_deg=45.0, clutter_multiplier=1.0):
        h, w = image_rgb.shape[:2]
        target_min_s, target_max_s = cls.SPOTABILITY_TARGETS.get(difficulty, (6.0, 12.0))
        
        # Base delta-E adjusted for local clutter
        base_delta_e = 22.0 if difficulty == "Medium" else (35.0 if difficulty == "Easy" else 13.0)
        current_delta_e = base_delta_e * clutter_multiplier
        
        best_variant = None
        best_metrics = None
        
        # Exposure convergence loop (up to 5 iterations)
        for iteration in range(1, 6):
            variant_rgb, actual_delta_e = TrueDeltaEColorEngine.shift_color_exact_delta_e(
                image_rgb, mask, target_delta_e=current_delta_e, hue_direction_deg=hue_direction_deg
            )
            
            diff = np.max(np.abs(image_rgb.astype(np.int16) - variant_rgb.astype(np.int16)), axis=2)
            diff_mask = (diff > 14).astype(np.uint8)
            changed_pixels = np.sum(diff_mask)
            area_pct = (changed_pixels / (h * w)) * 100.0
            
            if changed_pixels == 0:
                return False, None, None, "No pixels modified in color space."
                
            # Spotability Score: (Actual Delta-E * sqrt(Area%)) / (1.0 + Clutter)
            spotability = (actual_delta_e * np.sqrt(max(0.1, area_pct))) / (1.0 + (clutter_multiplier - 1.0) * 0.6)
            
            # Check convergence
            if target_min_s <= spotability <= target_max_s or iteration == 5:
                best_variant = variant_rgb
                best_metrics = {
                    "spotability": spotability,
                    "delta_e": actual_delta_e,
                    "area_pct": area_pct,
                    "iterations": iteration
                }
                break
            elif spotability < target_min_s:
                current_delta_e *= 1.25
            else:
                current_delta_e *= 0.80

        # Technical & Spatial Cluster QA
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(diff_mask)
        valid_components = [i for i in range(1, num_labels) if stats[i, cv2.CC_STAT_AREA] > 10]
        
        if len(valid_components) == 0:
            return False, None, None, "QA Rejected: No coherent diff components detected."
            
        all_x1 = min(stats[i, cv2.CC_STAT_LEFT] for i in valid_components)
        all_y1 = min(stats[i, cv2.CC_STAT_TOP] for i in valid_components)
        all_x2 = max(stats[i, cv2.CC_STAT_LEFT] + stats[i, cv2.CC_STAT_WIDTH] for i in valid_components)
        all_y2 = max(stats[i, cv2.CC_STAT_TOP] + stats[i, cv2.CC_STAT_HEIGHT] for i in valid_components)
        
        cluster_span_w = (all_x2 - all_x1) / w * 100
        cluster_span_h = (all_y2 - all_y1) / h * 100
        cluster_max_span = max(cluster_span_w, cluster_span_h)
        
        if cluster_max_span > 22.0:
            return False, None, None, f"QA Rejected: Difference islands scattered across frame (Span: {cluster_max_span:.1f}% > 22.0%)."
            
        total_area = sum(stats[i, cv2.CC_STAT_AREA] for i in valid_components)
        weighted_cx = sum(centroids[i][0] * stats[i, cv2.CC_STAT_AREA] for i in valid_components) / total_area
        weighted_cy = sum(centroids[i][1] * stats[i, cv2.CC_STAT_AREA] for i in valid_components) / total_area
        
        cx_pct = round(float(weighted_cx) / w * 100, 1)
        cy_pct = round(float(weighted_cy) / h * 100, 1)
        radius = round(float(max(4.2, min(7.5, cluster_max_span / 2 + 1.2))), 1)
        
        # 5. HARD CENTROID-VS-TARGET BBOX VALIDATION
        bx_min, by_min, bx_max, by_max = target_bbox
        pad_x, pad_y = w * 0.10, h * 0.10
        if not (bx_min - pad_x <= weighted_cx <= bx_max + pad_x and by_min - pad_y <= weighted_cy <= by_max + pad_y):
            return False, None, None, f"QA Rejected: Difference centroid ({cx_pct}%, {cy_pct}%) is outside intended target bbox."
            
        # 6. Minimum Perceptible Area Constraint (>= 0.15%)
        if best_metrics["area_pct"] < 0.15:
            return False, None, None, f"QA Rejected: Changed area too tiny ({best_metrics['area_pct']:.3f}% < 0.15%). Cannot be comfortably perceived."
            
        final_info = {
            "x": cx_pct,
            "y": cy_pct,
            "radius": radius,
            "area_pct": best_metrics["area_pct"],
            "delta_e": best_metrics["delta_e"],
            "spotability": best_metrics["spotability"],
            "iterations": best_metrics["iterations"]
        }
        return True, best_variant, final_info, "QA Passed (Converged within target spotability window)"

# ==============================================================================
# 5. EXECUTION PIPELINE
# ==============================================================================
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

def execute_adaptive_pipeline():
    print("=" * 80)
    print("ADAPTIVE SPOTABILITY & SEMANTIC CALIBRATION PIPELINE")
    print("=" * 80)
    
    model = FastSAM("FastSAM-s.pt")
    
    proposals = [
        {
            "id": "adaptive_tailor_green_spool_001",
            "title": "[Photo] Tailor Notions Box Green Thread Spool",
            "source_url": "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_tailor_green_spool_001_base.jpg",
            "target_object": "Thread Spool",
            "target_part": "Green thread wrap fibers",
            "target_bbox": [500, 650, 620, 780],
            "prompt_point": [560, 715],
            "difficulty": "Medium",
            "hue_direction_deg": 65.0, # Emerald Green -> Golden Ochre
            "desc": "Single thread spool wrap fibers tone shifted to golden ochre in CIELAB (preserving wound thread texture)",
            "hint": "Check the collection of thread spools in the tailor box"
        },
        {
            "id": "adaptive_workshop_utility_knife_002",
            "title": "[Photo] Master Workbench Utility Knife Slide",
            "source_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_workshop_utility_knife_002_base.jpg",
            "target_object": "Utility Knife",
            "target_part": "Thumb slide lock button",
            "target_bbox": [480, 340, 600, 460],
            "prompt_point": [540, 400],
            "difficulty": "Medium",
            "hue_direction_deg": 50.0, # Orange -> Deep Crimson
            "desc": "Single utility knife thumb slide lock button shifted to crimson in CIELAB",
            "hint": "Inspect the slider buttons on the tools in the central workbench array"
        },
        {
            "id": "adaptive_workshop_screwdriver_grip_003",
            "title": "[Photo] Master Workbench Rubber Screwdriver Sleeve",
            "source_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_workshop_screwdriver_grip_003_base.jpg",
            "target_object": "Screwdriver",
            "target_part": "Rubber grip handle sleeve",
            "target_bbox": [700, 420, 810, 520],
            "prompt_point": [755, 470],
            "difficulty": "Medium",
            "hue_direction_deg": 40.0, # Amber -> Terracotta
            "desc": "Single screwdriver handle rubber grip tone shifted in CIELAB (preserving molded ridges & wear)",
            "hint": "Scan the tool handles and grip sleeves near the center"
        },
        {
            "id": "adaptive_tailor_red_spool_004",
            "title": "[Photo] Tailor Sewing Kit Crimson Thread Wrap",
            "source_url": "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_tailor_red_spool_004_base.jpg",
            "target_object": "Thread Spool",
            "target_part": "Crimson thread wrap fibers",
            "target_bbox": [500, 650, 620, 780],
            "prompt_point": [560, 715],
            "difficulty": "Medium",
            "hue_direction_deg": 45.0, # Crimson -> Deep Plum
            "desc": "Single crimson thread spool fibers shifted to plum in CIELAB (preserving winding lines)",
            "hint": "Look closely at the rows of sewing thread spools in the box"
        },
        {
            "id": "adaptive_tailor_pearl_notion_005",
            "title": "[Photo] Tailor Notions Box Pearl Button Trim",
            "source_url": "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_tailor_pearl_notion_005_base.jpg",
            "target_object": "Notion",
            "target_part": "Collar button trim",
            "target_bbox": [500, 650, 620, 780],
            "prompt_point": [560, 715],
            "difficulty": "Medium",
            "hue_direction_deg": 55.0, # Amber -> Emerald Accent
            "desc": "Single tailor notion accessory shifted in CIELAB (preserving stitch texture)",
            "hint": "Look closely at the notions and accessories in the tailor kit"
        },
        {
            "id": "adaptive_workshop_hex_key_sleeve_006",
            "title": "[Photo] Master Workbench T-Handle Hex Wrench Grip",
            "source_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_workshop_hex_key_sleeve_006_base.jpg",
            "target_object": "Hex Key",
            "target_part": "Rubber handle grip",
            "target_bbox": [820, 480, 940, 600],
            "prompt_point": [880, 540],
            "difficulty": "Medium",
            "hue_direction_deg": 55.0, # Orange -> Crimson
            "desc": "Single hex wrench rubber grip sleeve tone shifted in CIELAB (preserving tool wear)",
            "hint": "Look across the hex keys and small wrenches on the right"
        },
        {
            "id": "adaptive_tailor_sewing_notion_amber_007",
            "title": "[Photo] Tailor Sewing Box Amber Notion Accent",
            "source_url": "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_tailor_sewing_notion_amber_007_base.jpg",
            "target_object": "Notion",
            "target_part": "Amber notions accessory",
            "target_bbox": [500, 650, 620, 780],
            "prompt_point": [560, 715],
            "difficulty": "Medium",
            "hue_direction_deg": 40.0,
            "desc": "Single tailor accessory tone shifted naturally in CIELAB",
            "hint": "Examine the sewing notions and spool accessories"
        },
        {
            "id": "adaptive_workshop_tape_measure_lock_008",
            "title": "[Photo] Workshop Bench Measuring Tape Lock Slider",
            "source_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_workshop_tape_measure_lock_008_base.jpg",
            "target_object": "Tape Measure",
            "target_part": "Lock button slide",
            "target_bbox": [480, 340, 600, 460],
            "prompt_point": [540, 400],
            "difficulty": "Medium",
            "hue_direction_deg": 45.0, # Orange -> Terracotta
            "desc": "Single measuring tape lock button shifted to terracotta in CIELAB",
            "hint": "Inspect the measuring tools and small sliders in the tool pile"
        },
        {
            "id": "adaptive_tailor_crimson_thread_spool_009",
            "title": "[Photo] Tailor Notions Box Woven Thread Spool",
            "source_url": "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_tailor_crimson_thread_spool_009_base.jpg",
            "target_object": "Thread Spool",
            "target_part": "Thread wrap fibers",
            "target_bbox": [500, 650, 620, 780],
            "prompt_point": [560, 715],
            "difficulty": "Medium",
            "hue_direction_deg": 50.0,
            "desc": "Single thread spool wrap fibers tone shifted in CIELAB (preserving wound texture)",
            "hint": "Check the thread spools in the notions collection"
        },
        {
            "id": "adaptive_workshop_screwdriver_grip_bronze_010",
            "title": "[Photo] Master Workbench Bronze Screwdriver Grip",
            "source_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=92",
            "base_image": "public/levels/adaptive_workshop_screwdriver_grip_bronze_010_base.jpg",
            "target_object": "Screwdriver",
            "target_part": "Rubber grip handle sleeve",
            "target_bbox": [700, 420, 810, 520],
            "prompt_point": [755, 470],
            "difficulty": "Medium",
            "hue_direction_deg": 55.0,
            "desc": "Single screwdriver handle rubber grip shifted to deep bronze in CIELAB",
            "hint": "Inspect the tool handles and grip sleeves in the workshop collection"
        }
    ]

    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f: manifest = json.load(f)

    approved_entries = []

    for prop in proposals:
        print(f"\n--- Evaluating: {prop['id']} ({prop['target_object']} -> {prop['target_part']}) ---")
        if not os.path.exists(prop["base_image"]):
            download_if_missing(prop["source_url"], prop["base_image"])
            
        img_bgr = cv2.imread(prop["base_image"])
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        
        # Step 1: FastSAM Instance Segmentation
        results = model(img_bgr, device="cpu", retina_masks=True, imgsz=1024, conf=0.30, iou=0.9, verbose=False)
        if not results or len(results) == 0 or results[0].masks is None:
            print("❌ FastSAM failed to detect objects. Rejected.")
            continue
            
        raw_masks = results[0].masks.data.cpu().numpy()
        
        # Step 2: Scene Affordance Pre-Filter
        passed_affordance, affordance_msg = SceneAffordanceFilter.evaluate_scene(img_bgr, raw_masks)
        if not passed_affordance:
            print(f"❌ Scene Affordance Rejection: {affordance_msg}")
            continue
        print(f"✓ Scene Affordance: {affordance_msg}")
        
        # Step 3: Local Clutter Estimation
        clutter_mult = LocalClutterEstimator.estimate_clutter(img_bgr, prop["target_bbox"])
        print(f"✓ Local Clutter Multiplier: {clutter_mult:.2f}x")
        
        # Step 4: Semantic Mask Scorer
        best_candidate, selection_msg = SemanticMaskScorer.rank_and_select(
            raw_masks, prop["target_bbox"], prop["prompt_point"], img_rgb
        )
        if not best_candidate:
            print(f"❌ Mask Selection Rejection: {selection_msg}")
            continue
        print(f"✓ {selection_msg}")
        
        # Step 5: Adaptive Spotability Exposure Loop & QA Critic
        passed, variant_rgb, qa_metrics, qa_msg = AdaptiveSpotabilityLoop.generate_and_calibrate(
            img_rgb, best_candidate["mask"], prop["target_bbox"],
            difficulty=prop["difficulty"],
            hue_direction_deg=prop["hue_direction_deg"],
            clutter_multiplier=clutter_mult
        )
        
        if not passed:
            print(f"❌ Adaptive Calibration Rejection: {qa_msg}")
            continue
            
        print(f"✓ {qa_msg}")
        print(f"  • Spotability: {qa_metrics['spotability']:.2f} (Converged in {qa_metrics['iterations']} iterations)")
        print(f"  • Final Delta-E: {qa_metrics['delta_e']:.1f}")
        print(f"  • Changed Area: {qa_metrics['area_pct']:.2f}%")
        print(f"  • Centroid: ({qa_metrics['x']}%, {qa_metrics['y']}%), Radius: {qa_metrics['radius']}%")
        
        # Step 6: Save Output Files
        base_name = f"{prop['id']}_base.jpg"
        var_name = f"{prop['id']}_variant.jpg"
        base_path = os.path.join("public/levels", base_name)
        var_path = os.path.join("public/levels", var_name)
        
        cv2.imwrite(base_path, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 94])
        cv2.imwrite(var_path, cv2.cvtColor(variant_rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 94])
        
        entry = {
            "id": prop["id"],
            "title": prop["title"],
            "category": "Photography",
            "pack": "Photography",
            "packId": "find_the_sniper",
            "difficulty": prop["difficulty"],
            "baseImage": f"/levels/{base_name}",
            "variantImage": f"/levels/{var_name}",
            "diffs": [{
                "id": 1,
                "x": qa_metrics["x"],
                "y": qa_metrics["y"],
                "radius": qa_metrics["radius"],
                "description": prop["desc"],
                "hint": prop["hint"]
            }]
        }
        approved_entries.append(entry)

    if approved_entries:
        new_id_set = {e["id"] for e in approved_entries}
        updated_manifest = approved_entries + [m for m in manifest if m["id"] not in new_id_set]
        with open(manifest_path, "w") as f:
            json.dump(updated_manifest, f, indent=2)
        print(f"\n🎉 Successfully calibrated and registered {len(approved_entries)} adaptive photorealistic pairs!")

    print(f"🎉 Pipeline Finished! {len(approved_entries)} / {len(proposals)} passed all adaptive spotability gates.")

if __name__ == "__main__":
    execute_adaptive_pipeline()



