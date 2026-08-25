"""
GOLDILOCKS TARGET SELECTOR & DIFFICULTY FEASIBILITY PROBER
================================================================================
Implements the next-generation spot-the-difference target selection layer:
1. RecolorableFractionFilter (rejects low-chroma metals, reflections, coin rims).
2. BaselineSalienceEstimator (narrow neighborhood halo LAB contrast).
3. VisualPeerClusterer (real shape/texture visual peer group detection).
4. TrialEditResponseProber (ΔE sweep response curves & Goldilocks operating width).
5. Automatic selection of the candidate with the widest safe Medium-difficulty range.
================================================================================
"""

import cv2
import numpy as np
from ultralytics import FastSAM

class GoldilocksTargetSelector:
    """
    Selects the optimal spot-the-difference target from all segmented masks in a scene
    by evaluating suitability, baseline salience, visual peers, and probe response curves.
    """
    
    @staticmethod
    def compute_recolorable_fraction(image_bgr, mask_uint8):
        """
        Measures the fraction of mask pixels with sufficient chroma and valid luminance
        to accept a natural, visible CIELAB chromatic shift.
        """
        img_lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        l_chan = img_lab[:, :, 0]
        a_chan = img_lab[:, :, 1] - 128.0
        b_chan = img_lab[:, :, 2] - 128.0
        chroma = np.sqrt(a_chan**2 + b_chan**2)
        
        mask_bool = mask_uint8 > 0
        total_mask_pixels = np.sum(mask_bool)
        if total_mask_pixels == 0:
            return 0.0, 0, np.zeros_like(mask_bool)
            
        # Pixels that are colored (not pure gray/metal/white/black)
        recolorable_pixels_mask = mask_bool & (chroma >= 10.0) & (l_chan >= 25.0) & (l_chan <= 235.0)
        recolorable_count = np.sum(recolorable_pixels_mask)
        fraction = float(recolorable_count) / float(total_mask_pixels)
        
        return fraction, recolorable_count, recolorable_pixels_mask

    @staticmethod
    def compute_baseline_salience(image_bgr, mask_uint8):
        """
        Measures the initial CIELAB color/luminance contrast between the target object
        and its immediate surrounding neighborhood halo (ring).
        """
        h, w = image_bgr.shape[:2]
        kernel_size = max(5, int(min(w, h) * 0.015))
        if kernel_size % 2 == 0: kernel_size += 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        
        dilated = cv2.dilate(mask_uint8, kernel, iterations=1)
        halo_mask = (dilated > 0) & (mask_uint8 == 0)
        
        if np.sum(mask_uint8 > 0) == 0 or np.sum(halo_mask) == 0:
            return 15.0 # fallback neutral
            
        img_lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        
        obj_l = np.mean(img_lab[:, :, 0][mask_uint8 > 0])
        obj_a = np.mean(img_lab[:, :, 1][mask_uint8 > 0])
        obj_b = np.mean(img_lab[:, :, 2][mask_uint8 > 0])
        
        halo_l = np.mean(img_lab[:, :, 0][halo_mask])
        halo_a = np.mean(img_lab[:, :, 1][halo_mask])
        halo_b = np.mean(img_lab[:, :, 2][halo_mask])
        
        delta_e = np.sqrt((obj_l - halo_l)**2 + (obj_a - halo_a)**2 + (obj_b - halo_b)**2)
        return float(delta_e)

    @staticmethod
    def extract_shape_descriptor(mask_uint8, target_size=(32, 32)):
        """
        Extracts a normalized, color-invariant shape & aspect descriptor for visual peer clustering.
        """
        ys, xs = np.where(mask_uint8 > 0)
        if len(xs) == 0:
            return np.zeros(target_size[0] * target_size[1] + 2, dtype=np.float32)
            
        x1, x2 = np.min(xs), np.max(xs)
        y1, y2 = np.min(ys), np.max(ys)
        crop = mask_uint8[y1:y2+1, x1:x2+1]
        
        aspect_ratio = float(x2 - x1 + 1) / float(y2 - y1 + 1)
        area_fill = float(np.sum(crop > 0)) / float((x2 - x1 + 1) * (y2 - y1 + 1))
        
        resized = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
        feature_vec = np.concatenate([resized.flatten(), [aspect_ratio, area_fill]])
        return feature_vec

    @classmethod
    def find_visual_peers(cls, candidate_descriptors):
        """
        Calculates how many visual peers (similar-shaped objects) each candidate has in the scene.
        """
        n = len(candidate_descriptors)
        peer_counts = [0] * n
        
        for i in range(n):
            vec_i = candidate_descriptors[i]
            norm_i = np.linalg.norm(vec_i) + 1e-6
            for j in range(n):
                if i == j: continue
                vec_j = candidate_descriptors[j]
                norm_j = np.linalg.norm(vec_j) + 1e-6
                
                cosine_sim = np.dot(vec_i, vec_j) / (norm_i * norm_j)
                if cosine_sim >= 0.78:
                    peer_counts[i] += 1
                    
        return peer_counts

    @classmethod
    def probe_difficulty_feasibility(cls, image_bgr, candidate, local_clutter_mult, target_difficulty="Medium"):
        """
        Runs a lightweight response curve sweep across ΔE values: [8, 12, 16, 20, 25, 30, 36, 42].
        Measures the 'Goldilocks width' (the range of ΔE where difficulty lands in the target window).
        """
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        mask_uint8 = candidate["mask"]
        area_pct = candidate["area_pct"]
        recolorable_frac = candidate["recolorable_fraction"]
        baseline_salience = candidate["baseline_salience"]
        
        # Target spotability band: Medium = 8.0 to 14.0, Hard = 6.0 to 11.0, Easy = 13.0 to 22.0
        min_s, max_s = 8.0, 14.0
        if target_difficulty == "Easy": min_s, max_s = 13.0, 22.0
        elif target_difficulty == "Hard": min_s, max_s = 6.0, 11.0
        
        test_delta_es = [16.0, 20.0, 25.0, 30.0, 36.0, 42.0, 48.0, 56.0]
        acceptable_delta_es = []
        
        for de in test_delta_es:
            # Spotability response function factoring in actual recolorable area & baseline salience
            effective_area_pct = area_pct * max(0.25, recolorable_frac)
            salience_factor = 1.0 + 0.35 * max(0.0, (baseline_salience / 15.0) - 1.0)
            clutter_factor = 1.0 + 0.60 * (local_clutter_mult - 1.0)
            
            spotability = (de * np.sqrt(effective_area_pct) * salience_factor) / clutter_factor
            
            if min_s <= spotability <= max_s:
                acceptable_delta_es.append((de, spotability))
                
        if not acceptable_delta_es:
            return {
                "feasible": False,
                "goldilocks_width": 0.0,
                "optimal_delta_e": None,
                "expected_spotability": None,
                "range": []
            }
            
        min_de = acceptable_delta_es[0][0]
        max_de = acceptable_delta_es[-1][0]
        goldilocks_width = max_de - min_de
        
        # Pick the optimal midpoint ΔE
        mid_idx = len(acceptable_delta_es) // 2
        optimal_de, expected_s = acceptable_delta_es[mid_idx]
        
        return {
            "feasible": True,
            "goldilocks_width": goldilocks_width,
            "optimal_delta_e": optimal_de,
            "expected_spotability": round(expected_s, 2),
            "range": [min_de, max_de],
            "sample_count": len(acceptable_delta_es)
        }

    @classmethod
    def select_best_goldilocks_target(cls, image_bgr, masks, target_difficulty="Medium"):
        """
        Evaluates all segmented masks in the image and selects the candidate with the
        highest suitability score and widest Goldilocks difficulty band.
        """
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        
        candidates = []
        descriptors = []
        
        # 1. FILTER CANDIDATE MASKS BY SIZE & RECOLORABLE FRACTION
        min_area, max_area = 0.20, 1.00
        if target_difficulty == "Hard":
            min_area, max_area = 0.12, 0.65  # Search difficulty via clutter + peers, not microscopic size
        elif target_difficulty == "Easy":
            min_area, max_area = 0.40, 2.20
            
        for idx, m in enumerate(masks):
            mask_resized = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            pcount = int(np.sum(mask_resized > 0))
            if pcount == 0: continue
            
            area_pct = (pcount / total_pixels) * 100.0
            
            # Difficulty-calibrated size gating
            if area_pct < min_area or area_pct > max_area:
                continue
                
            ys, xs = np.where(mask_resized > 0)
            span_w = (np.max(xs) - np.min(xs) + 1) / w * 100.0
            span_h = (np.max(ys) - np.min(ys) + 1) / h * 100.0
            max_span = max(span_w, span_h)
            
            # Reject scattered / sprawling masks
            if max_span > 28.0:
                continue
                
            # Compute recolorable fraction (hard reject < 0.35)
            frac, r_count, r_mask = cls.compute_recolorable_fraction(image_bgr, mask_resized)
            if frac < 0.35:
                continue
                
            # Compute baseline salience
            baseline_salience = cls.compute_baseline_salience(image_bgr, mask_resized)
            if baseline_salience < 5.0 or baseline_salience > 38.0:
                continue
                
            mcx, mcy = np.mean(xs), np.mean(ys)
            desc_vec = cls.extract_shape_descriptor(mask_resized)
            
            candidates.append({
                "index": idx,
                "mask": mask_resized,
                "pixel_count": pcount,
                "area_pct": round(area_pct, 3),
                "recolorable_fraction": round(frac, 3),
                "recolorable_count": r_count,
                "baseline_salience": round(baseline_salience, 2),
                "centroid": (round(float(mcx) / w * 100, 1), round(float(mcy) / h * 100, 1)),
                "pixel_centroid": (mcx, mcy),
                "bbox": [int(np.min(xs)), int(np.min(ys)), int(np.max(xs)), int(np.max(ys))],
                "span": (round(span_w, 1), round(span_h, 1))
            })
            descriptors.append(desc_vec)
            
        if not candidates:
            return None, "No candidate masks satisfied size (0.15-2.2%), recolorable fraction (>=0.35), and baseline salience (5-38).", []
            
        # 2. COMPUTE VISUAL PEERS
        peer_counts = cls.find_visual_peers(descriptors)
        for i, c in enumerate(candidates):
            c["peer_count"] = peer_counts[i]
            
        # 3. PROBE RESPONSE CURVES & GOLDILOCKS OPERATING WIDTH
        feasible_candidates = []
        for c in candidates:
            # Estimate local clutter in 3x envelope
            bx1, by1, bx2, by2 = c["bbox"]
            bw, bh = bx2 - bx1, by2 - by1
            pad_x, pad_y = bw, bh
            rx1, ry1 = max(0, bx1 - pad_x), max(0, by1 - pad_y)
            rx2, ry2 = min(w, bx2 + pad_x), min(h, by2 + pad_y)
            roi_gray = gray[ry1:ry2, rx1:rx2]
            roi_edges = cv2.Canny(roi_gray, 60, 150)
            roi_edge_density = np.sum(roi_edges > 0) / (roi_gray.shape[0] * roi_gray.shape[1] + 1e-5)
            local_clutter_mult = min(2.6, max(1.0, 1.0 + 6.0 * roi_edge_density))
            c["local_clutter_mult"] = round(local_clutter_mult, 2)
            
            probe_res = cls.probe_difficulty_feasibility(image_bgr, c, local_clutter_mult, target_difficulty)
            c["probe"] = probe_res
            
            if probe_res["feasible"] and probe_res["goldilocks_width"] >= 6.0:
                # Score candidate: Goldilocks Width (40%) + Recolorable Fraction (25%) + Peer Camouflage (20%) + Baseline Salience (15%)
                width_score = min(1.0, probe_res["goldilocks_width"] / 20.0)
                recolor_score = min(1.0, c["recolorable_fraction"] / 0.80)
                peer_score = min(1.0, c["peer_count"] / 4.0)
                salience_score = 1.0 - abs(c["baseline_salience"] - 16.0) / 16.0
                salience_score = max(0.0, min(1.0, salience_score))
                
                composite_suitability = (
                    (width_score * 40.0) +
                    (recolor_score * 25.0) +
                    (peer_score * 20.0) +
                    (salience_score * 15.0)
                )
                c["suitability_score"] = round(composite_suitability, 1)
                feasible_candidates.append(c)
                
        if not feasible_candidates:
            return None, "Candidates rejected during trial-edit response probe (none had sufficient Goldilocks operating width >= 6.0 ΔE).", []
            
        # Sort by composite suitability score descending
        feasible_candidates.sort(key=lambda x: x["suitability_score"], reverse=True)
        best_candidate = feasible_candidates[0]
        
        return best_candidate, f"Selected optimal Goldilocks target #{best_candidate['index']} (Score: {best_candidate['suitability_score']}/100, Goldilocks Width: {best_candidate['probe']['goldilocks_width']} ΔE, Recolorable: {best_candidate['recolorable_fraction']*100:.0f}%, Peers: {best_candidate['peer_count']})", feasible_candidates

if __name__ == "__main__":
    print("Testing GoldilocksTargetSelector on public levels...")
    import glob
    model = FastSAM("FastSAM-s.pt")
    test_files = glob.glob("public/levels/ai_*_base.jpg")
    for tf in test_files[:3]:
        img = cv2.imread(tf)
        results = model(tf, device="cpu", retina_masks=True, imgsz=1024, conf=0.20, iou=0.65, verbose=False)
        masks = results[0].masks.data.cpu().numpy()
        best, reason = GoldilocksTargetSelector.select_best_goldilocks_target(img, masks)
        print(f"\nImage: {tf}")
        print(f"  • {reason}")
        if best:
            print(f"  • Target: Centroid={best['centroid']}, Area={best['area_pct']}%, Optimal ΔE={best['probe']['optimal_delta_e']}, Expected Spotability={best['probe']['expected_spotability']}")
