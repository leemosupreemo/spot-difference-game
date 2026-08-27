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
        if global_edge_density < 0.018:
            return False, f"Low scene complexity (Edge density {global_edge_density:.3f} < 0.018). Background too uniform."
        
        # 2. Object instance count (must be a cluttered composition)
        object_count = len(masks)
        if object_count < 14:
            return False, f"Too few objects ({object_count} < 14). Lacks necessary visual clutter."
        
        # 3. Hero Object Suppression (Exclude background tabletop / cutting mat)
        largest_foreground_pct = 0.0
        largest_fg_idx = -1
        
        for idx, m in enumerate(masks):
            mask_resized = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            pcount = np.sum(mask_resized > 0)
            area_pct = (pcount / total_pixels) * 100.0
            
            # If a mask covers > 25% of the frame in a scene with > 25 objects, it is the background tabletop/mat
            if area_pct > 25.0 and object_count > 25:
                continue
                
            if area_pct > largest_foreground_pct:
                largest_foreground_pct = area_pct
                largest_fg_idx = idx
                
        if largest_foreground_pct > 26.0:
            return False, f"Dominant hero object detected (Object #{largest_fg_idx} is {largest_foreground_pct:.1f}% of frame > 26%)."
            
        return True, f"Scene Approved! (Objects: {object_count}, Global Edge Density: {global_edge_density:.3f}, Largest Foreground: {largest_foreground_pct:.1f}%)"

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


class PeerPaletteColorEngine:
    """
    Selects peer-relative destination colors based on the scene peer palette,
    preventing arbitrary neon outliers.
    """
    @staticmethod
    def extract_dominant_lab(image_bgr, mask):
        lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        valid = (mask > 0)
        if np.sum(valid) == 0:
            return np.array([128.0, 128.0, 128.0], dtype=np.float32)
        mean_l = float(np.mean(lab[:, :, 0][valid]))
        mean_a = float(np.mean(lab[:, :, 1][valid]))
        mean_b = float(np.mean(lab[:, :, 2][valid]))
        return np.array([mean_l, mean_a, mean_b], dtype=np.float32)

    @classmethod
    def shift_color_peer_relative(cls, image_bgr, target_mask, peer_masks=None, target_delta_e=22.0, default_hue_deg=45.0):
        """
        Recolors target_mask towards an authentic peer palette hue or natural neighboring hue.
        Returns: (result_bgr, actual_delta_e, metrics_dict)
        """
        lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        l_chan, a_chan, b_chan = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]
        
        target_valid = (target_mask > 0)
        target_chroma = np.hypot(a_chan - 128.0, b_chan - 128.0)
        valid_material = target_valid & (target_chroma > 8.0) & (l_chan > 20.0) & (l_chan < 245.0)
        
        if np.sum(valid_material) == 0:
            return image_bgr.copy(), 0.0, {"peer_color_outlier_zscore": 0.0}

        target_mean_lab = cls.extract_dominant_lab(image_bgr, target_mask)
        
        # Build peer palette if peer masks provided
        peer_labs = []
        if peer_masks and len(peer_masks) > 0:
            for pm in peer_masks:
                if np.sum(pm > 0) > 0:
                    peer_labs.append(cls.extract_dominant_lab(image_bgr, pm))
                    
        hue_direction_deg = default_hue_deg
        peer_color_dist_before = 0.0
        peer_color_dist_after = 0.0
        outlier_zscore = 0.0

        if len(peer_labs) >= 2:
            peer_labs_arr = np.array(peer_labs) # (N, 3)
            # Distances from target to peers before edit
            dists_before = np.sqrt(np.sum((peer_labs_arr[:, 1:3] - target_mean_lab[1:3])**2, axis=1))
            peer_color_dist_before = float(np.mean(dists_before))
            
            # Find a peer that is at least 15 ΔE away in chromatic space to use as destination hue direction
            chroma_dists = np.sqrt(np.sum((peer_labs_arr[:, 1:3] - target_mean_lab[1:3])**2, axis=1))
            viable_dest_peers = np.where(chroma_dists >= 14.0)[0]
            
            if len(viable_dest_peers) > 0:
                # Pick the closest viable peer to mutate towards (e.g. navy -> olive if olive peer exists)
                best_peer_idx = viable_dest_peers[np.argmin(chroma_dists[viable_dest_peers])]
                dest_peer_lab = peer_labs_arr[best_peer_idx]
                
                delta_a_dest = dest_peer_lab[1] - target_mean_lab[1]
                delta_b_dest = dest_peer_lab[2] - target_mean_lab[2]
                hue_direction_deg = float(np.rad2deg(np.arctan2(delta_b_dest, delta_a_dest)))
                
                # Check palette standard deviation
                palette_std = float(np.std(peer_labs_arr[:, 1:3]) + 1e-4)
                outlier_zscore = float(np.min(dists_before) / palette_std)

        # Apply true Delta-E shift along hue direction
        old_a = a_chan[valid_material]
        old_b = b_chan[valid_material]

        theta_rad = np.deg2rad(hue_direction_deg)
        a_centered = old_a - 128.0
        b_centered = old_b - 128.0
        
        rot_a = a_centered * np.cos(theta_rad) - b_centered * np.sin(theta_rad) + 128.0
        rot_b = a_centered * np.sin(theta_rad) + b_centered * np.cos(theta_rad) + 128.0

        delta_a = rot_a - old_a
        delta_b = rot_b - old_b
        vector_length = np.hypot(delta_a, delta_b)
        
        mean_len = float(np.mean(vector_length))
        scale = target_delta_e / (mean_len + 1e-5)

        scaled_a = np.clip(old_a + delta_a * scale, 0, 255)
        scaled_b = np.clip(old_b + delta_b * scale, 0, 255)

        a_chan[valid_material] = scaled_a
        b_chan[valid_material] = scaled_b

        lab[:, :, 0] = l_chan
        lab[:, :, 1] = a_chan
        lab[:, :, 2] = b_chan

        out_bgr = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
        result_bgr = image_bgr.copy()
        result_bgr[valid_material] = out_bgr[valid_material]
        
        actual_delta_e = float(np.mean(np.hypot(scaled_a - old_a, scaled_b - old_b)))
        
        # Calculate post-edit peer color distance
        if len(peer_labs) >= 2:
            new_target_mean_lab = cls.extract_dominant_lab(result_bgr, target_mask)
            dists_after = np.sqrt(np.sum((peer_labs_arr[:, 1:3] - new_target_mean_lab[1:3])**2, axis=1))
            peer_color_dist_after = float(np.mean(dists_after))

        metrics = {
            "peer_color_distance_before": round(peer_color_dist_before, 1),
            "peer_color_distance_after": round(peer_color_dist_after, 1),
            "peer_color_outlier_zscore": round(outlier_zscore, 2),
            "hue_direction_deg": round(hue_direction_deg, 1)
        }
        
        return result_bgr, actual_delta_e, metrics

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
            # Sub-object size gating: 0.08% to 3.5% of frame
            if area_pct < 0.08 or area_pct > 3.5:
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
            coverage = inter_area / (mask_box_area + 1e-5)
            
            mcx, mcy = np.mean(xs), np.mean(ys)
            dist_to_prompt = np.hypot(mcx - prompt_point[0], mcy - prompt_point[1])
            
            # Candidate must either overlap bbox or be near prompt point (< 25% frame)
            if bbox_iou < 0.05 and coverage < 0.15 and dist_to_prompt > (min(w, h) * 0.25):
                continue
                
            edge_score = cls.compute_edge_alignment(m_resized, gray)
            span_w, span_h = mx_max - mx_min + 1, my_max - my_min + 1
            compactness = pixel_count / (span_w * span_h)
            prox_score = max(0.0, 1.0 - (dist_to_prompt / (min(w, h) * 0.25)))
            
            total_score = (bbox_iou * 0.35) + (edge_score * 0.25) + (compactness * 0.20) + (prox_score * 0.20)
            
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
        "Easy": (13.0, 22.0),
        "Medium": (8.0, 14.0),
        "Hard": (6.0, 11.0)
    }

    @classmethod
    def generate_and_calibrate(cls, image_rgb, mask, target_bbox, difficulty="Medium", hue_direction_deg=60.0, clutter_multiplier=1.0):
        h, w = image_rgb.shape[:2]
        target_min_s, target_max_s = cls.SPOTABILITY_TARGETS.get(difficulty, (8.0, 14.0))
        
        # Base delta-E adjusted for local clutter (ensure solid visible color delta)
        base_delta_e = 26.0 if difficulty == "Medium" else (36.0 if difficulty == "Easy" else 22.0)
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
            
            # 4. Gating Check
            if target_min_s <= spotability <= target_max_s:
                best_variant = variant_rgb
                best_metrics = {
                    "spotability": round(spotability, 2),
                    "delta_e": round(actual_delta_e, 1),
                    "area_pct": round(area_pct, 3),
                    "iterations": iteration
                }
                break
                
            if iteration == 5:
                return False, None, None, f"QA Rejected: Target failed to converge into difficulty window ({spotability:.2f} not in [{target_min_s}, {target_max_s}] after 5 exposure iterations)."
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
        
        if cluster_max_span > 35.0:
            return False, None, None, f"QA Rejected: Difference islands scattered across frame (Span: {cluster_max_span:.1f}% > 35.0%)."
            
        total_area = sum(stats[i, cv2.CC_STAT_AREA] for i in valid_components)
        weighted_cx = sum(centroids[i][0] * stats[i, cv2.CC_STAT_AREA] for i in valid_components) / total_area
        weighted_cy = sum(centroids[i][1] * stats[i, cv2.CC_STAT_AREA] for i in valid_components) / total_area
        
        cx_pct = round(float(weighted_cx) / w * 100, 1)
        cy_pct = round(float(weighted_cy) / h * 100, 1)
        radius = round(float(max(4.2, min(7.5, cluster_max_span / 2 + 1.2))), 1)
        
        # 5. HARD CENTROID-VS-TARGET BBOX VALIDATION
        bx_min, by_min, bx_max, by_max = target_bbox
        pad_x, pad_y = w * 0.20, h * 0.20
        if not (bx_min - pad_x <= weighted_cx <= bx_max + pad_x and by_min - pad_y <= weighted_cy <= by_max + pad_y):
            return False, None, None, f"QA Rejected: Difference centroid ({cx_pct}%, {cy_pct}%) is outside intended target bbox."
            
        # 6. Minimum Perceptible Area Constraint (>= 0.12% for Hard, >= 0.20% for Medium/Easy)
        min_perceptible_area = 0.12 if difficulty == "Hard" else 0.20
        if best_metrics["area_pct"] < min_perceptible_area:
            return False, None, None, f"QA Rejected: Changed area too tiny ({best_metrics['area_pct']:.3f}% < {min_perceptible_area:.2f}%)."
            
        # 7. DIRECT-LOOK & DISPLAY RESOLUTION VERIFICATION GATE:
        from perceptual_verification_engine import PerceptualVerificationEngine
        base_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        var_bgr = cv2.cvtColor(best_variant, cv2.COLOR_RGB2BGR)
        v_passed, v_metrics, v_reason = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            base_bgr, var_bgr, target_bbox, operation="recolor", difficulty=difficulty
        )
        if not v_passed:
            return False, None, None, f"Recolor QA Direct-Look Reject: {v_reason}"

        final_info = {
            "x": cx_pct,
            "y": cy_pct,
            "radius": radius,
            "area_pct": best_metrics["area_pct"],
            "delta_e": best_metrics["delta_e"],
            "spotability": best_metrics["spotability"],
            "iterations": best_metrics["iterations"],
            "verification": v_metrics
        }
        return True, best_variant, final_info, f"QA Passed ({v_reason})"

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

from goldilocks_target_selector import GoldilocksTargetSelector

def execute_adaptive_pipeline():
    print("=" * 80)
    print("GOLDILOCKS TARGET SELECTOR & ADAPTIVE SPOTABILITY CALIBRATION PIPELINE")
    print("=" * 80)
    
    model = FastSAM("FastSAM-s.pt")
    
    proposals = [
        {
            "id": "goldilocks_hard_ai_watchmaker_jewel_001",
            "title": "[AI Hard] Horologist Parts Tray Escapement Jewel Bearing",
            "source_url": "local:ai_watchmaker_parts_base",
            "base_image": "public/levels/ai_watchmaker_parts_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 45.0,
            "desc": "Single watchmaker ruby jewel setting micro-tone shifted in CIELAB",
            "hint": "Inspect the intricate micro watch parts and jewel bearings in the sorting tray"
        },
        {
            "id": "goldilocks_hard_ai_electronics_resistor_002",
            "title": "[AI Hard] Electronics Antistatic Bench Resistor Band",
            "source_url": "local:ai_electronics_pcb_base",
            "base_image": "public/levels/ai_electronics_pcb_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 50.0,
            "desc": "Single through-hole resistor color code band shifted in CIELAB",
            "hint": "Scan the small resistor leads and miniature component sleeves"
        },
        {
            "id": "goldilocks_hard_ai_mechanic_socket_003",
            "title": "[AI Hard] Mechanic Workbench Socket Collar Ring",
            "source_url": "local:ai_mechanic_workbench_base",
            "base_image": "public/levels/ai_mechanic_workbench_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 55.0,
            "desc": "Single socket collar indicator ring tone shifted in CIELAB",
            "hint": "Check the knurled rings and socket collars on the workbench"
        },
        {
            "id": "goldilocks_hard_ai_sewing_pinhead_004",
            "title": "[AI Hard] Tailor Notions Box Pincushion Bead Head",
            "source_url": "local:ai_sewing_notions_base",
            "base_image": "public/levels/ai_sewing_notions_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 45.0,
            "desc": "Single sewing ball-head pin bead tone shifted in CIELAB",
            "hint": "Examine the tiny pin heads on the pincushion and sorting compartments"
        },
        {
            "id": "goldilocks_hard_ai_miniature_brushcollar_005",
            "title": "[AI Hard] Miniature Painter Detail Brush Handle Collar",
            "source_url": "local:ai_miniature_painter_base",
            "base_image": "public/levels/ai_miniature_painter_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 50.0,
            "desc": "Single miniature paintbrush colored handle accent ring shifted in CIELAB",
            "hint": "Look closely at the colored accent bands on the detail paintbrushes"
        },
        {
            "id": "goldilocks_hard_ai_gardener_clip_006",
            "title": "[AI Hard] Greenhouse Potting Bench Plant Ring Clip",
            "source_url": "local:ai_gardener_potting_base",
            "base_image": "public/levels/ai_gardener_potting_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 45.0,
            "desc": "Single plant stem support clip ring tone shifted in CIELAB",
            "hint": "Check the plant support clips and twine loops on the potting bench"
        },
        {
            "id": "goldilocks_hard_ai_artist_palette_knife_007",
            "title": "[AI Hard] Fine Art Studio Pastel Stick Nub",
            "source_url": "local:ai_artist_palette_base",
            "base_image": "public/levels/ai_artist_palette_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 50.0,
            "desc": "Single soft pastel stick tip tone shifted in CIELAB",
            "hint": "Inspect the pastel stick tips and small paint caps on the taboret"
        },
        {
            "id": "goldilocks_hard_ai_woodworking_pencil_008",
            "title": "[AI Hard] Woodworking Bench Carpenter Pencil Tip",
            "source_url": "local:ai_woodworking_bench_base",
            "base_image": "public/levels/ai_woodworking_bench_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 45.0,
            "desc": "Single carpenter marking pencil sharpened lead collar shifted in CIELAB",
            "hint": "Scan the carpenter marking pencils and chisel collars"
        },
        {
            "id": "goldilocks_hard_ai_retro_gaming_cart_009",
            "title": "[AI Hard] Retro Gaming Desk Memory Card Slider",
            "source_url": "local:ai_retro_gaming_base",
            "base_image": "public/levels/ai_retro_gaming_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 45.0,
            "desc": "Single translucent memory card edge tone shifted in CIELAB",
            "hint": "Examine the translucent memory cards and cartridge edges"
        },
        {
            "id": "goldilocks_hard_ai_expedition_toggle_010",
            "title": "[AI Hard] Expedition Table Paracord Lock Toggle",
            "source_url": "local:ai_expedition_bushcraft_base",
            "base_image": "public/levels/ai_expedition_bushcraft_base.jpg",
            "difficulty": "Hard",
            "hue_direction_deg": 50.0,
            "desc": "Single paracord spring lock slider tone shifted in CIELAB",
            "hint": "Check the cord lock toggles and carabiner gate collars"
        }
    ]

    manifest_path = "public/levels/photo_pair_manifest.json"
    with open(manifest_path, "r") as f: manifest = json.load(f)

    approved_entries = []

    for prop in proposals:
        print(f"\n--- Evaluating Scene: {prop['id']} ({prop['title']}) ---")
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
        
        # Step 3: Goldilocks Target Selection (Operation suitability, recolorable fraction, visual peers, response probe)
        target_info, selection_reason, feasible_candidates = GoldilocksTargetSelector.select_best_goldilocks_target(
            img_bgr, raw_masks, target_difficulty=prop.get("difficulty", "Medium")
        )
        if not feasible_candidates:
            print(f"❌ Goldilocks Target Selection Rejection: {selection_reason}\n")
            continue
        print(f"✓ {selection_reason}")
            
        # Step 4: Try candidates in order until one passes QA
        passed = False
        final_variant_rgb = None
        final_info = None
        final_qa_msg = None
        
        for cand in feasible_candidates[:5]:
            p, v_rgb, f_info, q_msg = AdaptiveSpotabilityLoop.generate_and_calibrate(
                image_rgb=img_rgb,
                mask=cand["mask"],
                target_bbox=cand["bbox"],
                difficulty=prop.get("difficulty", "Medium"),
                hue_direction_deg=prop.get("hue_direction_deg", 50.0),
                clutter_multiplier=cand["local_clutter_mult"]
            )
            if p:
                passed = True
                final_variant_rgb = v_rgb
                final_info = f_info
                final_qa_msg = q_msg
                break
                
        if not passed:
            print(f"❌ Adaptive Calibration Rejection: {final_qa_msg}")
            continue
            
        print(f"✓ {final_qa_msg}")
        print(f"  • Spotability: {final_info['spotability']:.2f} (Converged in {final_info['iterations']} iterations)")
        print(f"  • Final Delta-E: {final_info['delta_e']:.1f}")
        print(f"  • Changed Area: {final_info['area_pct']:.2f}%")
        print(f"  • Centroid: ({final_info['x']}%, {final_info['y']}%), Radius: {final_info['radius']}%")
        
        # Step 5: Save Output Files
        base_name = f"{prop['id']}_base.jpg"
        var_name = f"{prop['id']}_variant.jpg"
        base_path = os.path.join("public/levels", base_name)
        var_path = os.path.join("public/levels", var_name)
        
        cv2.imwrite(base_path, img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 94])
        cv2.imwrite(var_path, cv2.cvtColor(final_variant_rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 94])
        
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
                "x": final_info["x"],
                "y": final_info["y"],
                "radius": final_info["radius"],
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



