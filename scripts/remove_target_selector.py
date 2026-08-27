"""
REMOVE TARGET SELECTOR & BOUNDARY-MATCHED LOCAL BACKGROUND SYNTHESIZER
================================================================================
Implements next-generation full-object deletion with structure-aware reconstruction:
1. Substrate Coherence Analysis (substrate_coherence_score):
   - Rejects objects bridging multiple materials, sitting on seams, or heavily crowded.
2. No Global Fallback:
   - Strictly requires local coherent substrate; no sampling from arbitrary image regions.
3. Boundary-Guided Exemplar Synthesis:
   - Matches candidate patches by LAB color distribution, texture variance, and gradient orientation.
   - Interpolates 2D planar lighting gradients to match surrounding illumination trends.
   - Eliminates random patch tiling seams and repeating patterns.
4. Comprehensive RemovalNaturalnessCritic:
   - BoundaryContinuityReject (verifies smooth seam transition without color/edge steps).
   - BackgroundMismatchReject (verifies fill matches substrate material & texture).
   - LightingMismatchReject (verifies illumination gradient consistency).
   - PatchworkArtifactReject (detects periodic tiling peaks or unnatural seams).
   - ObjectResidueReject (detects lingering color smears from the original object).
   - PyramidArtifactReject (detects radial Navier-Stokes isophote convergence).
5. Tightened RemoveTargetSelector:
   - Whole-object mask completeness gate.
   - Coherent substrate gate.
   - Peer camouflage & gap-anomaly scoring.
================================================================================
"""

import cv2
import numpy as np
from perceptual_verification_engine import PerceptualVerificationEngine


class SubstrateCoherenceAnalyzer:
    """
    Analyzes whether a target object sits on a single, coherent, reconstructable
    background substrate prior to attempting removal.
    """

    @classmethod
    def analyze_substrate_coherence(cls, image_bgr, target_mask, occupied_fg_mask, max_radius_mult=2.0):
        """
        Analyzes the immediate surrounding background ring around the target mask.
        Returns: (is_coherent: bool, score: float, metrics: dict, reason: str or None)
        """
        h, w = image_bgr.shape[:2]
        ys, xs = np.where(target_mask > 0)
        if len(xs) == 0:
            return False, 0.0, {}, "LowSubstrateCoherenceReject: Empty target mask."

        bx1, by1, bx2, by2 = np.min(xs), np.min(ys), np.max(xs), np.max(ys)
        bw = bx2 - bx1 + 1
        bh = by2 - by1 + 1
        cx, cy = (bx1 + bx2) // 2, (by1 + by2) // 2
        short_side = min(bw, bh)
        long_side = max(bw, bh)

        expand_px = max(4, int(short_side * 0.14))
        r_inner = int(long_side * 0.55) + expand_px
        r_outer = int(long_side * max_radius_mult) + expand_px + 15

        Y, X = np.ogrid[:h, :w]
        dist_sq = (X - cx)**2 + (Y - cy)**2
        annulus = (dist_sq >= r_inner**2) & (dist_sq <= r_outer**2)
        total_annulus_px = np.sum(annulus)

        if total_annulus_px == 0:
            return False, 0.0, {}, "LowSubstrateCoherenceReject: Zero annulus area."

        # Clean substrate = inside annulus and NOT in any foreground object
        clean_sub_mask = annulus & (occupied_fg_mask == 0)
        clean_px_count = int(np.sum(clean_sub_mask))

        # 1. SUBSTRATE SUPPORT FRACTION
        support_fraction = float(clean_px_count) / float(total_annulus_px)
        if clean_px_count < 150 or support_fraction < 0.28:
            return False, 0.0, {
                "clean_px_count": clean_px_count,
                "support_fraction": round(support_fraction, 2)
            }, f"LowSubstrateCoherenceReject: Insufficient clean local substrate (support {support_fraction*100:.1f}%, clean px {clean_px_count} < 150)."

        # 2. COLOR HOMOGENEITY & MATERIAL UNIFORMITY
        lab_img = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        sub_lab = lab_img[clean_sub_mask] # (N, 3)

        std_l = float(np.std(sub_lab[:, 0]))
        std_a = float(np.std(sub_lab[:, 1]))
        std_b = float(np.std(sub_lab[:, 2]))
        total_color_std = float(np.sqrt(std_l**2 + std_a**2 + std_b**2))

        # Check for bimodal material split (e.g. bridging two distinct surfaces like wood and cloth)
        l_channel = sub_lab[:, 0]
        hist, bin_edges = np.histogram(l_channel, bins=16, range=(0, 255))
        # Normalized peak analysis
        hist_norm = hist.astype(float) / (np.max(hist) + 1e-5)
        peaks = []
        for p_idx in range(1, len(hist_norm) - 1):
            if hist_norm[p_idx] > 0.4 and hist_norm[p_idx] >= hist_norm[p_idx-1] and hist_norm[p_idx] >= hist_norm[p_idx+1]:
                peaks.append(p_idx)

        bimodal_penalty = 0.0
        if len(peaks) >= 2:
            peak_dist = abs(peaks[0] - peaks[1]) * (255.0 / 16.0)
            if peak_dist > 28.0 and std_l > 18.0:
                bimodal_penalty = min(0.5, (peak_dist / 60.0) * 0.4)

        # 3. TEXTURE & GRADIENT UNIFORMITY
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        sub_lap_var = float(np.var(lap[clean_sub_mask]))

        # Check if high contrast edge crosses through the substrate under the object
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        sobel_mag = np.sqrt(sobel_x**2 + sobel_y**2)
        sub_edge_max = float(np.percentile(sobel_mag[clean_sub_mask], 95))

        # High variance in color + high edge max indicates a patterned seam or material boundary
        if total_color_std > 32.0 and sub_edge_max > 85.0:
            return False, 0.0, {
                "color_std": round(total_color_std, 1),
                "edge_max": round(sub_edge_max, 1)
            }, "LowSubstrateCoherenceReject: Substrate crosses high-contrast seam or patterned edge transition."

        # 4. COMPUTE SUBSTRATE COHERENCE SCORE (0.0 to 1.0)
        color_coherence = max(0.0, 1.0 - (total_color_std / 32.0))
        support_coherence = min(1.0, support_fraction / 0.50)
        coherence_score = float(color_coherence * 0.6 + support_coherence * 0.4 - bimodal_penalty)
        coherence_score = float(np.clip(coherence_score, 0.0, 1.0))

        metrics = {
            "coherence_score": round(coherence_score, 2),
            "support_fraction": round(support_fraction, 2),
            "color_std": round(total_color_std, 1),
            "lap_var": round(sub_lap_var, 1),
            "clean_px_count": clean_px_count
        }

        if coherence_score < 0.45:
            return False, coherence_score, metrics, f"LowSubstrateCoherenceReject: Coherence score {coherence_score:.2f} < 0.45."

        return True, coherence_score, metrics, None


class RemovalNaturalnessCritic:
    """
    Evaluates photographic realism and background texture naturalness of a removed region.
    Rejects radial smears, pyramid cones, patchwork seams, lighting mismatches, and object residue.
    """

    @classmethod
    def evaluate_removal_naturalness(cls, base_bgr, filled_bgr, target_mask, expanded_mask, background_ring_mask, object_dominant_lab):
        """
        Runs comprehensive photographic naturalness and boundary QA audit.
        Returns: (passed: bool, metrics: dict, rejection_reason: str or None, rejection_code: str or None)
        """
        h, w = base_bgr.shape[:2]

        fill_mask_bool = (target_mask > 0)
        expanded_mask_bool = (expanded_mask > 0)
        bg_mask_bool = (background_ring_mask > 0)

        if np.sum(fill_mask_bool) == 0 or np.sum(bg_mask_bool) == 0:
            return False, {}, "Naturalness Reject: Invalid mask area.", "InvalidMaskReject"

        base_gray = cv2.cvtColor(base_bgr, cv2.COLOR_BGR2GRAY)
        filled_gray = cv2.cvtColor(filled_bgr, cv2.COLOR_BGR2GRAY)
        base_lab = cv2.cvtColor(base_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        filled_lab = cv2.cvtColor(filled_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

        # -------------------------------------------------------------
        # 1. BOUNDARY CONTINUITY CHECK (BoundaryContinuityReject)
        # -------------------------------------------------------------
        # Compares immediate inner rim (1-3px inside fill) with outer rim (1-3px outside in substrate)
        kernel_3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        kernel_7 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

        dilated_fill = cv2.dilate(expanded_mask.astype(np.uint8), kernel_7, iterations=1)
        eroded_fill = cv2.erode(expanded_mask.astype(np.uint8), kernel_3, iterations=1)

        outer_rim_mask = (dilated_fill > 0) & (expanded_mask == 0) & bg_mask_bool
        inner_rim_mask = (expanded_mask > 0) & (eroded_fill == 0)

        if np.sum(outer_rim_mask) > 10 and np.sum(inner_rim_mask) > 10:
            outer_mean_lab = np.mean(filled_lab[outer_rim_mask], axis=0)
            inner_mean_lab = np.mean(filled_lab[inner_rim_mask], axis=0)
            boundary_step_de = float(np.sqrt(np.sum((outer_mean_lab - inner_mean_lab)**2)))

            # Discontinuity step across the seam should be less than 6.0 ΔE
            if boundary_step_de > 6.5:
                return False, {"boundary_step_de": round(boundary_step_de, 1)}, f"BoundaryContinuityReject: Discontinuity step across seam is too sharp (ΔE {boundary_step_de:.1f} > 6.5).", "BoundaryContinuityReject"
        else:
            boundary_step_de = 0.0

        # -------------------------------------------------------------
        # 2. SUBSTRATE MATERIAL & COLOR MATCH (BackgroundMismatchReject)
        # -------------------------------------------------------------
        fill_l = np.mean(filled_lab[:, :, 0][fill_mask_bool])
        fill_a = np.mean(filled_lab[:, :, 1][fill_mask_bool])
        fill_b = np.mean(filled_lab[:, :, 2][fill_mask_bool])

        bg_l = np.mean(base_lab[:, :, 0][bg_mask_bool])
        bg_a = np.mean(base_lab[:, :, 1][bg_mask_bool])
        bg_b = np.mean(base_lab[:, :, 2][bg_mask_bool])

        delta_e_fill_to_bg = float(np.sqrt((fill_l - bg_l)**2 + (fill_a - bg_a)**2 + (fill_b - bg_b)**2))

        if delta_e_fill_to_bg > 11.5:
            return False, {"delta_e_fill_to_bg": round(delta_e_fill_to_bg, 1)}, f"BackgroundMismatchReject: Reconstructed fill color deviates from substrate (ΔE {delta_e_fill_to_bg:.1f} > 11.5).", "BackgroundMismatchReject"

        # -------------------------------------------------------------
        # 3. TEXTURE PRESERVATION (Laplacian Variance Ratio)
        # -------------------------------------------------------------
        lap_filled = cv2.Laplacian(filled_gray, cv2.CV_64F)
        lap_base_bg = cv2.Laplacian(base_gray, cv2.CV_64F)

        fill_lap_var = float(np.var(lap_filled[fill_mask_bool]))
        bg_lap_var = float(np.var(lap_base_bg[bg_mask_bool]))
        texture_ratio = float(fill_lap_var / (bg_lap_var + 1e-4))

        if bg_lap_var > 25.0 and (texture_ratio < 0.35 or texture_ratio > 3.0):
            return False, {
                "texture_ratio": round(texture_ratio, 2),
                "bg_lap_var": round(bg_lap_var, 1)
            }, f"BackgroundMismatchReject: Fill texture variance ratio {texture_ratio:.2f} is outside acceptable range (0.35 - 3.0).", "BackgroundMismatchReject"

        # -------------------------------------------------------------
        # 4. ILLUMINATION GRADIENT CONSISTENCY (LightingMismatchReject)
        # -------------------------------------------------------------
        # Fit 2D plane L(x, y) = ax + by + c on surrounding substrate
        bg_ys, bg_xs = np.where(bg_mask_bool)
        if len(bg_xs) >= 20:
            bg_L = base_lab[:, :, 0][bg_mask_bool]
            A = np.column_stack([bg_xs, bg_ys, np.ones_like(bg_xs)])
            try:
                plane_coeffs, _, _, _ = np.linalg.lstsq(A, bg_L, rcond=None)
                fill_ys, fill_xs = np.where(fill_mask_bool)
                pred_L = plane_coeffs[0] * fill_xs + plane_coeffs[1] * fill_ys + plane_coeffs[2]
                actual_L = filled_lab[:, :, 0][fill_mask_bool]
                lighting_error = float(np.abs(np.mean(actual_L) - np.mean(pred_L)))

                if lighting_error > 7.5:
                    return False, {"lighting_error": round(lighting_error, 1)}, f"LightingMismatchReject: Shading does not match local illumination plane (Error {lighting_error:.1f} > 7.5 L*).", "LightingMismatchReject"
            except Exception:
                lighting_error = 0.0
        else:
            lighting_error = 0.0

        # -------------------------------------------------------------
        # 5. PATCHWORK & REPETITION DETECTION (PatchworkArtifactReject)
        # -------------------------------------------------------------
        # Check for unnatural periodic tiling or high-frequency blockiness
        ys, xs = np.where(fill_mask_bool)
        bx1, by1, bx2, by2 = np.min(xs), np.min(ys), np.max(xs), np.max(ys)
        crop_fill = filled_gray[by1:by2+1, bx1:bx2+1]
        
        if crop_fill.shape[0] >= 16 and crop_fill.shape[1] >= 16:
            norm_crop = (crop_fill - np.mean(crop_fill)).astype(np.float32)
            f_transform = np.fft.fft2(norm_crop)
            f_shift = np.fft.fftshift(f_transform)
            magnitude_spectrum = np.abs(f_shift)**2
            
            # Mask out DC component
            ch, cw = crop_fill.shape
            cy, cx = ch // 2, cw // 2
            magnitude_spectrum[max(0, cy-2):min(ch, cy+3), max(0, cx-2):min(cw, cx+3)] = 0.0
            
            total_energy = np.sum(magnitude_spectrum) + 1e-5
            peak_energy = np.max(magnitude_spectrum)
            peak_ratio = float(peak_energy / total_energy)

            # High peak ratio in frequency domain indicates strong periodic patchwork repetition
            if peak_ratio > 0.40 and texture_ratio > 0.6:
                return False, {"patchwork_peak_ratio": round(peak_ratio, 3)}, f"PatchworkArtifactReject: Strong periodic tiling / patchwork repetition detected (Peak ratio {peak_ratio:.3f} > 0.40).", "PatchworkArtifactReject"
        else:
            peak_ratio = 0.0

        # -------------------------------------------------------------
        # 6. OBJECT COLOR RESIDUE CHECK (ObjectResidueReject)
        # -------------------------------------------------------------
        obj_l, obj_a, obj_b = object_dominant_lab
        dist_to_obj = np.sqrt(
            (filled_lab[:, :, 0][fill_mask_bool] - obj_l)**2 +
            (filled_lab[:, :, 1][fill_mask_bool] - obj_a)**2 +
            (filled_lab[:, :, 2][fill_mask_bool] - obj_b)**2
        )
        
        obj_to_bg_de = np.sqrt((obj_l - bg_l)**2 + (obj_a - bg_a)**2 + (obj_b - bg_b)**2)
        if obj_to_bg_de > 18.0:
            residual_obj_pixels = np.sum(dist_to_obj < 11.0)
            residual_frac = float(residual_obj_pixels) / float(np.sum(fill_mask_bool))
            if residual_frac > 0.12:
                return False, {"residual_obj_frac": round(residual_frac, 2)}, f"ObjectResidueReject: Fill retains {residual_frac*100:.1f}% of removed object color.", "ObjectResidueReject"
        else:
            residual_frac = 0.0

        # -------------------------------------------------------------
        # 7. RADIAL CONVERGENCE / STARBURST SMEAR (PyramidArtifactReject)
        # -------------------------------------------------------------
        cx, cy = np.mean(xs), np.mean(ys)
        grad_x = cv2.Sobel(filled_gray, cv2.CV_64F, 1, 0, ksize=3)[fill_mask_bool]
        grad_y = cv2.Sobel(filled_gray, cv2.CV_64F, 0, 1, ksize=3)[fill_mask_bool]
        grad_mag = np.sqrt(grad_x**2 + grad_y**2) + 1e-5

        rx = xs - cx
        ry = ys - cy
        rmag = np.sqrt(rx**2 + ry**2) + 1e-5
        rx_norm = rx / rmag
        ry_norm = ry / rmag

        radial_alignment = np.abs((grad_x / grad_mag) * rx_norm + (grad_y / grad_mag) * ry_norm)
        mean_radial_align = float(np.mean(radial_alignment))

        if mean_radial_align > 0.72 and texture_ratio < 0.60:
            return False, {"radial_alignment": round(mean_radial_align, 2)}, f"PyramidArtifactReject: Radial smear detected (Alignment {mean_radial_align:.2f} > 0.72).", "PyramidArtifactReject"

        metrics = {
            "boundary_step_de": round(boundary_step_de, 1),
            "delta_e_fill_to_bg": round(delta_e_fill_to_bg, 1),
            "texture_ratio": round(texture_ratio, 2),
            "lighting_error": round(lighting_error, 1),
            "residual_obj_frac": round(residual_frac, 2),
            "radial_alignment": round(mean_radial_align, 2)
        }

        return True, metrics, None, None


class LocalBackgroundSynthesizer:
    """
    Synthesizes authentic background texture from surrounding non-foreground substrate
    using boundary-guided exemplar matching and continuous illumination gradient compensation.
    """

    @classmethod
    def synthesize_background_fill(cls, image_bgr, target_mask, raw_sam_masks, difficulty="Medium"):
        """
        Executes:
        1. Scale-aware mask expansion + contact shadow capture.
        2. Substrate Coherence Analysis (rejects inhomogeneous backgrounds).
        3. Boundary-guided exemplar matching (color, texture, grain orientation).
        4. Continuous illumination plane interpolation.
        5. Seamless gradient-domain boundary integration.
        6. RemovalNaturalnessCritic verification.
        """
        h, w = image_bgr.shape[:2]
        total_pixels = h * w

        ys, xs = np.where(target_mask > 0)
        if len(xs) == 0:
            return None, None, None, "Target mask is empty."

        bx1, by1, bx2, by2 = np.min(xs), np.min(ys), np.max(xs), np.max(ys)
        bw = bx2 - bx1 + 1
        bh = by2 - by1 + 1
        short_side = min(bw, bh)
        cx, cy = (bx1 + bx2) // 2, (by1 + by2) // 2

        # 1. OBJECT-SCALE-AWARE EXPANSION (10-15% of short side + contact shadow)
        expand_px = max(4, int(short_side * 0.14))
        exp_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (expand_px * 2 + 1, expand_px * 2 + 1))
        expanded_mask = cv2.dilate(target_mask.astype(np.uint8), exp_kernel, iterations=1)

        # Include contact shadow down-right
        shadow_shift_x = max(2, int(expand_px * 0.6))
        shadow_shift_y = max(2, int(expand_px * 0.6))
        M = np.float32([[1, 0, shadow_shift_x], [0, 1, shadow_shift_y]])
        shifted_shadow = cv2.warpAffine(expanded_mask, M, (w, h))
        expanded_mask = cv2.bitwise_or(expanded_mask, shifted_shadow)

        # 2. IDENTIFY TRUE NON-FOREGROUND SUBSTRATE
        all_fg_mask = np.zeros((h, w), dtype=np.uint8)
        for m in raw_sam_masks:
            m_res = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            if np.sum(m_res > 0) / float(total_pixels) > 0.25 and len(raw_sam_masks) > 25:
                continue
            all_fg_mask = cv2.bitwise_or(all_fg_mask, m_res)

        fg_safety_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        occupied_fg = cv2.dilate(all_fg_mask, fg_safety_kernel, iterations=1)

        # 3. SUBSTRATE COHERENCE ANALYSIS GATE
        is_coherent, coh_score, coh_metrics, coh_reason = SubstrateCoherenceAnalyzer.analyze_substrate_coherence(
            image_bgr, target_mask, occupied_fg
        )
        if not is_coherent:
            return None, None, None, coh_reason

        # 4. LOCAL SEARCH ANNULUS (NO GLOBAL FALLBACK!)
        ring_inner_radius = int(max(bw, bh) * 0.55) + expand_px
        ring_outer_radius = int(max(bw, bh) * 2.0) + expand_px + 20

        Y, X = np.ogrid[:h, :w]
        dist_from_center = np.sqrt((X - cx)**2 + (Y - cy)**2)
        annulus_mask = (dist_from_center >= ring_inner_radius) & (dist_from_center <= ring_outer_radius)
        clean_substrate_mask = annulus_mask & (occupied_fg == 0)

        clean_sub_px_count = int(np.sum(clean_substrate_mask))
        if clean_sub_px_count < 120:
            # Expand slightly if strictly necessary within local radius
            annulus_mask = (dist_from_center <= ring_outer_radius * 1.3)
            clean_substrate_mask = annulus_mask & (occupied_fg == 0)
            clean_sub_px_count = int(np.sum(clean_substrate_mask))

        if clean_sub_px_count < 80:
            return None, None, None, "LowSubstrateCoherenceReject: Local clean substrate support is insufficient (no global fallback permitted)."

        # Dominant color of original removed object
        lab_img = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        obj_mean_l = float(np.mean(lab_img[:, :, 0][target_mask > 0]))
        obj_mean_a = float(np.mean(lab_img[:, :, 1][target_mask > 0]))
        obj_mean_b = float(np.mean(lab_img[:, :, 2][target_mask > 0]))
        obj_dominant_lab = (obj_mean_l, obj_mean_a, obj_mean_b)

        # 5. BOUNDARY-GUIDED EXEMPLAR MATCHING
        # Extract immediate boundary rim statistics
        boundary_rim_mask = annulus_mask & (dist_from_center <= ring_inner_radius + 15) & (occupied_fg == 0)
        if np.sum(boundary_rim_mask) < 20:
            boundary_rim_mask = clean_substrate_mask

        rim_lab = lab_img[boundary_rim_mask]
        rim_mean_lab = np.mean(rim_lab, axis=0) # [L, a, b]
        rim_std_lab = np.std(rim_lab, axis=0)

        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        rim_lap = cv2.Laplacian(gray, cv2.CV_64F)[boundary_rim_mask]
        rim_lap_var = float(np.var(rim_lap))

        # Gradient orientation of boundary rim (grain direction)
        grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)[boundary_rim_mask]
        grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)[boundary_rim_mask]
        rim_angles = np.arctan2(grad_y, grad_x)
        # Dominant orientation (modulo pi for axis)
        rim_dominant_angle = float(np.median(rim_angles % np.pi))

        # Collect candidate exemplar patches from local substrate
        sub_ys, sub_xs = np.where(clean_substrate_mask)
        patch_size = max(14, min(32, int(short_side * 0.40)))
        if patch_size % 2 != 0: patch_size += 1

        candidate_patches = []
        # Step through clean substrate pixels
        sample_step = max(3, patch_size // 4)
        for sy, sx in zip(sub_ys[::sample_step], sub_xs[::sample_step]):
            py1 = sy - patch_size // 2
            px1 = sx - patch_size // 2
            py2 = py1 + patch_size
            px2 = px1 + patch_size
            if py1 >= 0 and px1 >= 0 and py2 < h and px2 < w:
                if np.sum(occupied_fg[py1:py2, px1:px2] > 0) == 0:
                    p_bgr = image_bgr[py1:py2, px1:px2]
                    p_lab = lab_img[py1:py2, px1:px2]
                    p_gray = gray[py1:py2, px1:px2]

                    # 1. Color match (ΔE to rim mean)
                    p_mean_lab = np.mean(p_lab, axis=(0, 1))
                    color_de = float(np.sqrt(np.sum((p_mean_lab - rim_mean_lab)**2)))

                    # 2. Texture match
                    p_lap_var = float(np.var(cv2.Laplacian(p_gray, cv2.CV_64F)))
                    texture_diff = abs(p_lap_var - rim_lap_var) / (rim_lap_var + 5.0)

                    # 3. Gradient orientation match
                    p_gx = cv2.Sobel(p_gray, cv2.CV_64F, 1, 0, ksize=3)
                    p_gy = cv2.Sobel(p_gray, cv2.CV_64F, 0, 1, ksize=3)
                    p_angle = float(np.median(np.arctan2(p_gy, p_gx) % np.pi))
                    angle_diff = abs(p_angle - rim_dominant_angle)
                    angle_diff = min(angle_diff, np.pi - angle_diff)

                    # Composite similarity score (lower is better)
                    match_score = color_de + (texture_diff * 4.0) + (angle_diff * 6.0)

                    candidate_patches.append({
                        "coords": (py1, px1, py2, px2),
                        "bgr": p_bgr,
                        "lab": p_lab,
                        "score": match_score,
                        "color_de": color_de,
                        "mean_lab": p_mean_lab
                    })

        if len(candidate_patches) < 3:
            return None, None, None, "LowSubstrateCoherenceReject: Insufficient valid exemplar patches in local substrate."

        # Rank candidate patches and keep top quartile
        candidate_patches.sort(key=lambda x: x["score"])
        top_patches = candidate_patches[:max(4, len(candidate_patches) // 3)]

        # 6. BOUNDARY-GUIDED SYNTHESIS WITH ILLUMINATION PLANE
        ebx1 = max(0, bx1 - expand_px - 4)
        eby1 = max(0, by1 - expand_px - 4)
        ebx2 = min(w, bx2 + expand_px + shadow_shift_x + 4)
        eby2 = min(h, by2 + expand_px + shadow_shift_y + 4)
        ew = ebx2 - ebx1
        eh = eby2 - eby1

        # Fit 2D lighting plane on local boundary rim
        A_rim = np.column_stack([sub_xs, sub_ys, np.ones_like(sub_xs)])
        L_rim = lab_img[:, :, 0][clean_substrate_mask]
        try:
            plane_coeffs, _, _, _ = np.linalg.lstsq(A_rim, L_rim, rcond=None)
        except Exception:
            plane_coeffs = np.array([0.0, 0.0, rim_mean_lab[0]])

        synth_patch_canvas = np.zeros((eh, ew, 3), dtype=np.uint8)
        
        # Structure-aware patch assembly with soft feathering and lighting adjustment
        np.random.seed(42 + int(cx) * 7 + int(cy))
        step = max(6, patch_size // 2)

        for ty in range(0, eh, step):
            for tx in range(0, ew, step):
                global_x = ebx1 + tx + step // 2
                global_y = eby1 + ty + step // 2
                
                # Target predicted luminance from lighting plane
                target_L = plane_coeffs[0] * global_x + plane_coeffs[1] * global_y + plane_coeffs[2]

                # Find best patch whose lightness matches local plane
                best_patch = min(top_patches, key=lambda p: abs(p["mean_lab"][0] - target_L) + p["score"] * 0.5)
                p_bgr = best_patch["bgr"].copy()

                # Adjust patch luminance to smoothly track lighting plane
                p_lab = cv2.cvtColor(p_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
                l_shift = np.clip(target_L - best_patch["mean_lab"][0], -18.0, 18.0)
                p_lab[:, :, 0] = np.clip(p_lab[:, :, 0] + l_shift, 0, 255)
                p_bgr_adjusted = cv2.cvtColor(p_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)

                ty2 = min(eh, ty + patch_size)
                tx2 = min(ew, tx + patch_size)
                ph = ty2 - ty
                pw = tx2 - tx

                if ph > 0 and pw > 0:
                    synth_patch_canvas[ty:ty2, tx:tx2] = p_bgr_adjusted[:ph, :pw]

        # 7. SEAMLESS COMPOSITING WITH GRADIENT-DOMAIN BOUNDARY BLEND
        target_crop = target_mask[eby1:eby2, ebx1:ebx2].astype(np.float32)
        expanded_crop = expanded_mask[eby1:eby2, ebx1:ebx2].astype(np.float32)
        
        rim_crop = cv2.GaussianBlur(expanded_crop, (7, 7), 1.6)
        hole_alpha = np.maximum(target_crop, rim_crop)
        hole_alpha_3d = np.expand_dims(np.clip(hole_alpha, 0.0, 1.0), axis=2)

        reconstructed_bgr = image_bgr.copy()
        current_crop = reconstructed_bgr[eby1:eby2, ebx1:ebx2].astype(np.float32)
        blended_crop = (synth_patch_canvas.astype(np.float32) * hole_alpha_3d + current_crop * (1.0 - hole_alpha_3d)).astype(np.uint8)
        reconstructed_bgr[eby1:eby2, ebx1:ebx2] = blended_crop

        # 8. ZERO-DRIFT BACKGROUND CLAMPING OUTSIDE LOCAL ROI
        pad = int(max(bw, bh) * 0.35)
        rx1, ry1 = max(0, bx1 - pad), max(0, by1 - pad)
        rx2, ry2 = min(w, bx2 + pad + shadow_shift_x), min(h, by2 + pad + shadow_shift_y)

        clamped_variant = image_bgr.copy()
        clamped_variant[ry1:ry2, rx1:rx2] = reconstructed_bgr[ry1:ry2, rx1:rx2]

        # 9. REMOVAL NATURALNESS CRITIC AUDIT
        nat_passed, nat_metrics, nat_reason, nat_code = RemovalNaturalnessCritic.evaluate_removal_naturalness(
            image_bgr, clamped_variant, target_mask, expanded_mask, clean_substrate_mask, obj_dominant_lab
        )

        if not nat_passed:
            return None, None, None, nat_reason

        return clamped_variant, [ebx1, eby1, ebx2, eby2], {**nat_metrics, **coh_metrics}, None


class RemoveTargetSelector:
    """
    Evaluates, selects, and removes an object from a repeated peer family
    using substrate coherence analysis, boundary-matched synthesis, and naturalness critic.
    """

    @classmethod
    def compute_gap_anomaly(cls, candidate_idx, group_indices, candidate_masks):
        if len(group_indices) < 3:
            return 0.0, False

        centroids = np.array([candidate_masks[k]["centroid"] for k in group_indices])
        n = len(centroids)

        nn_dists = []
        for i in range(n):
            dists = np.sqrt(np.sum((centroids - centroids[i])**2, axis=1))
            dists = dists[dists > 0]
            if len(dists) > 0:
                nn_dists.append(np.min(dists))

        if len(nn_dists) == 0:
            return 0.0, False

        cv_spacing = float(np.std(nn_dists) / (np.mean(nn_dists) + 1e-4))
        is_hyper_regular = (cv_spacing < 0.18)
        gap_penalty = max(0.0, 1.0 - (cv_spacing / 0.35)) if is_hyper_regular else 0.0

        return float(gap_penalty), is_hyper_regular

    @classmethod
    def check_mask_completeness(cls, image_bgr, mask_uint8):
        """
        Whole-Object Mask Completeness Gate:
        Ensures SAM captured the full visible silhouette (including outer rim/edges),
        not merely an internal decorative sub-region.
        """
        h, w = image_bgr.shape[:2]
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        dilated = cv2.dilate(mask_uint8, kernel, iterations=1)
        rim_boundary = (dilated > 0) & (mask_uint8 == 0)

        if np.sum(rim_boundary) == 0:
            return True, 1.0

        interior_eroded = cv2.erode(mask_uint8, kernel, iterations=1)
        interior_rim = (mask_uint8 > 0) & (interior_eroded == 0)

        if np.sum(interior_rim) == 0:
            return True, 1.0

        mean_int = np.mean(gray[interior_rim])
        mean_ext = np.mean(gray[rim_boundary])
        boundary_contrast = abs(mean_int - mean_ext)

        is_complete = (boundary_contrast >= 7.5)
        return is_complete, boundary_contrast

    @classmethod
    def select_best_remove_target(cls, image_bgr, candidate_masks, peer_groups, target_difficulty="Medium"):
        h, w = image_bgr.shape[:2]
        total_pixels = h * w

        disp_scale_x = 700.0 / float(w)
        disp_scale_y = 440.0 / float(h)

        min_area, max_area = 0.15, 0.80
        if target_difficulty == "Hard": min_area, max_area = 0.10, 0.55
        elif target_difficulty == "Easy": min_area, max_area = 0.30, 1.40

        # Build occupied foreground mask for substrate coherence check
        all_fg = np.zeros((h, w), dtype=np.uint8)
        for c in candidate_masks:
            all_fg = cv2.bitwise_or(all_fg, c["mask"])
        fg_safety_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        occupied_fg = cv2.dilate(all_fg, fg_safety_kernel, iterations=1)

        evaluated_candidates = []
        cand_to_group = {}
        for g_idx, g in enumerate(peer_groups):
            for c_idx in g["indices"]:
                cand_to_group[c_idx] = g

        for i, c in enumerate(candidate_masks):
            area_pct = c["area_pct"]
            if area_pct < min_area or area_pct > max_area:
                continue

            mask = c["mask"]
            pcount = np.sum(mask > 0)
            if pcount == 0: continue

            bw = c["bbox"][2] - c["bbox"][0] + 1
            bh = c["bbox"][3] - c["bbox"][1] + 1
            d_short = min(bw * disp_scale_x, bh * disp_scale_y)
            if d_short < 18.0 or d_short > 42.0:
                continue

            # 1. WHOLE-OBJECT MASK COMPLETENESS GATE
            is_complete, b_contrast = cls.check_mask_completeness(image_bgr, mask)
            if not is_complete:
                continue

            # 2. SUBSTRATE COHERENCE GATE (Reconstructability Check)
            is_coherent, coh_score, coh_metrics, coh_reason = SubstrateCoherenceAnalyzer.analyze_substrate_coherence(
                image_bgr, mask, occupied_fg
            )
            if not is_coherent or coh_score < 0.48:
                continue

            # 3. PEER CAMOUFLAGE (>= 2 other similar items)
            group = cand_to_group.get(i)
            peer_count = group["size"] - 1 if group else 0
            if peer_count < 2:
                continue

            # 4. GAP-ANOMALY SCORING
            gap_penalty, is_regular = cls.compute_gap_anomaly(i, group["indices"], candidate_masks)

            # 5. COMPACTNESS
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours: continue
            perimeter = cv2.arcLength(contours[0], True)
            compactness = float(4.0 * np.pi * pcount) / float((perimeter**2) + 1e-5)

            removal_score = (coh_score * 40.0) + (min(1.0, peer_count / 6.0) * 35.0) + (min(1.0, compactness) * 25.0) - (gap_penalty * 15.0)

            evaluated_candidates.append({
                "candidate": c,
                "score": round(removal_score, 1),
                "coh_score": coh_score,
                "peer_count": peer_count,
                "gap_penalty": round(gap_penalty, 2),
                "compactness": round(compactness, 2)
            })

        if not evaluated_candidates:
            return None, "No candidate met whole-object removal and substrate coherence criteria.", []

        evaluated_candidates.sort(key=lambda x: x["score"], reverse=True)
        best = evaluated_candidates[0]
        return best, f"Selected optimal Remove target (Score: {best['score']}/100, Coherence: {best['coh_score']}, Peers: {best['peer_count']}, Gap: {best['gap_penalty']})", evaluated_candidates

    @classmethod
    def execute_removal_and_qa(cls, image_bgr, target_mask, target_bbox, raw_sam_masks, difficulty="Medium"):
        """
        Executes boundary-matched background synthesis and runs RemovalNaturalnessCritic + PerceptualVerificationEngine.
        """
        h, w = image_bgr.shape[:2]
        bx1, by1, bx2, by2 = target_bbox

        # 1. SYNTHESIZE BOUNDARY-MATCHED BACKGROUND TEXTURE
        clamped_variant, expanded_bbox, nat_metrics, err = LocalBackgroundSynthesizer.synthesize_background_fill(
            image_bgr, target_mask, raw_sam_masks, difficulty=difficulty
        )

        if clamped_variant is None:
            return False, None, None, f"Remove Synthesis Reject: {err}"

        # 2. TWO-SIDED DIRECT-LOOK & DISPLAY RESOLUTION VERIFICATION GATE
        v_passed, v_metrics, v_reason, v_code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            image_bgr, clamped_variant, target_bbox, operation="remove", difficulty=difficulty
        )
        if not v_passed:
            return False, None, None, f"Remove QA Reject ({v_code}): {v_reason}"

        diff_arr = np.max(np.abs(image_bgr.astype(np.int16) - clamped_variant.astype(np.int16)), axis=2)
        diff_pts = np.where(diff_arr > 14)
        if len(diff_pts[0]) > 0:
            cx_pct = round(float(np.mean(diff_pts[1])) / float(w) * 100.0, 1)
            cy_pct = round(float(np.mean(diff_pts[0])) / float(h) * 100.0, 1)
            span_x = (np.max(diff_pts[1]) - np.min(diff_pts[1])) / float(w) * 100.0
            span_y = (np.max(diff_pts[0]) - np.min(diff_pts[0])) / float(h) * 100.0
            radius = round(max(4.5, min(8.5, max(span_x, span_y) / 2.0 + 1.5)), 1)
        else:
            cx_pct = round(float(bx1 + bx2) / 2.0 / float(w) * 100.0, 1)
            cy_pct = round(float(by1 + by2) / 2.0 / float(h) * 100.0, 1)
            radius = 5.5

        ground_truth = {
            "x": cx_pct,
            "y": cy_pct,
            "radius": radius,
            "bbox": target_bbox,
            "metrics": {**v_metrics, **nat_metrics}
        }

        return True, clamped_variant, ground_truth, v_reason
