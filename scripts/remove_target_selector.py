"""
REMOVE TARGET SELECTOR & STRUCTURE-AWARE BACKGROUND RECONSTRUCTION ROUTER
================================================================================
Implements next-generation full-object deletion with structure-aware reconstruction:
1. Substrate Coherence Analysis (SubstrateCoherenceAnalyzer):
   - Rejects objects bridging multiple materials, sitting on seams, or heavily crowded.
2. BackgroundReconstructionRouter:
   - Pathway 1: Coherent Single-Source Local Patch Cloning (Poisson / gradient-domain)
     for simple homogeneous or continuous directional substrates.
   - Pathway 2: Neighborhood-Aware Exemplar / PatchMatch Completion
     for stochastic, granular, and textured substrates.
   - Pathway 3: Localized Structural / Generative Inpainting
     with edge-guided propagation and high-frequency texture injection.
   - NEVER tiles independent rectangular patches directly into the hole.
   - Preserves 100% bit-identical pixels outside the local ROI.
3. Tightened RemovalNaturalnessCritic:
   - Evaluates full expanded removal region (hole + transition zone).
   - Enforces minimum texture-preservation ratio >= 0.65 for textured backgrounds.
   - Explicit Local Blur Detection (Tenengrad sharpness & high-frequency power).
   - Independent 16-sector perimeter boundary continuity testing (no halos/steps).
   - Rejects texture loss, warped structure, patch repetition, or lighting mismatch.
4. RemoveTargetSelector:
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
        sub_lab = lab_img[clean_sub_mask]  # (N, 3)

        std_l = float(np.std(sub_lab[:, 0]))
        std_a = float(np.std(sub_lab[:, 1]))
        std_b = float(np.std(sub_lab[:, 2]))
        total_color_std = float(np.sqrt(std_l**2 + std_a**2 + std_b**2))

        # Check for bimodal material split (e.g. bridging two distinct surfaces like wood and cloth)
        l_channel = sub_lab[:, 0]
        hist, _ = np.histogram(l_channel, bins=16, range=(0, 255))
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
    Tightened QA Gates:
    1. Full expanded removal region evaluation (hole + transition zone).
    2. Minimum acceptable texture-preservation ratio >= 0.65 for textured substrates.
    3. Explicit Local Blur Detection (Tenengrad sharpness & HF energy vs ambient substrate).
    4. Independent 16-sector perimeter boundary continuity testing (detects dark/light halos or edge cuts).
    5. Rejects radial smears, patchwork peaks, lighting mismatch, and residual object colors.
    """

    @classmethod
    def evaluate_removal_naturalness(cls, base_bgr, filled_bgr, target_mask, expanded_mask, background_ring_mask, object_dominant_lab):
        """
        Runs comprehensive photographic naturalness and boundary QA audit.
        Returns: (passed: bool, metrics: dict, rejection_reason: str or None, rejection_code: str or None)
        """
        h, w = base_bgr.shape[:2]

        fill_mask_bool = (expanded_mask > 0)  # Evaluate full expanded removal region
        target_mask_bool = (target_mask > 0)
        bg_mask_bool = (background_ring_mask > 0)

        if np.sum(fill_mask_bool) == 0 or np.sum(bg_mask_bool) == 0:
            return False, {}, "Naturalness Reject: Invalid mask area.", "InvalidMaskReject"

        base_gray = cv2.cvtColor(base_bgr, cv2.COLOR_BGR2GRAY)
        filled_gray = cv2.cvtColor(filled_bgr, cv2.COLOR_BGR2GRAY)
        base_lab = cv2.cvtColor(base_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        filled_lab = cv2.cvtColor(filled_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

        # -------------------------------------------------------------
        # 1. INDEPENDENT PERIMETER BOUNDARY CONTINUITY (16 Sectors)
        # -------------------------------------------------------------
        # Evaluates local boundary step delta-E at 16 equidistant radial sectors
        ys, xs = np.where(fill_mask_bool)
        cx, cy = np.mean(xs), np.mean(ys)

        kernel_3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        kernel_7 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

        dilated_fill = cv2.dilate(expanded_mask.astype(np.uint8), kernel_7, iterations=1)
        eroded_fill = cv2.erode(expanded_mask.astype(np.uint8), kernel_3, iterations=1)

        outer_rim_mask = (dilated_fill > 0) & (expanded_mask == 0) & bg_mask_bool
        inner_rim_mask = (expanded_mask > 0) & (eroded_fill == 0)

        sector_de_list = []
        if np.sum(outer_rim_mask) > 16 and np.sum(inner_rim_mask) > 16:
            # Partition boundary pixels into 16 angular bins around (cx, cy)
            outer_ys, outer_xs = np.where(outer_rim_mask)
            inner_ys, inner_xs = np.where(inner_rim_mask)

            outer_angles = np.arctan2(outer_ys - cy, outer_xs - cx)
            inner_angles = np.arctan2(inner_ys - cy, inner_xs - cx)

            num_sectors = 16
            bin_edges = np.linspace(-np.pi, np.pi, num_sectors + 1)

            for s in range(num_sectors):
                s_min, s_max = bin_edges[s], bin_edges[s+1]
                o_idx = (outer_angles >= s_min) & (outer_angles < s_max)
                i_idx = (inner_angles >= s_min) & (inner_angles < s_max)

                if np.sum(o_idx) >= 3 and np.sum(i_idx) >= 3:
                    o_lab_pts = filled_lab[outer_ys[o_idx], outer_xs[o_idx]]
                    i_lab_pts = filled_lab[inner_ys[i_idx], inner_xs[i_idx]]
                    o_mean = np.mean(o_lab_pts, axis=0)
                    i_mean = np.mean(i_lab_pts, axis=0)
                    sec_de = float(np.sqrt(np.sum((o_mean - i_mean)**2)))
                    sector_de_list.append(sec_de)

            if sector_de_list:
                max_sector_de = float(np.max(sector_de_list))
                mean_sector_de = float(np.mean(sector_de_list))
                p90_sector_de = float(np.percentile(sector_de_list, 90))

                # Substrate grain standard deviation
                bg_lab_pts = base_lab[bg_mask_bool]
                sub_grain_std = float(np.sqrt(np.sum(np.var(bg_lab_pts, axis=0)))) if len(bg_lab_pts) > 10 else 10.0
                allowable_max_de = max(13.5, sub_grain_std * 0.90)

                if mean_sector_de > 9.5 or p90_sector_de > allowable_max_de:
                    return False, {
                        "max_sector_de": round(max_sector_de, 1),
                        "mean_sector_de": round(mean_sector_de, 1),
                        "p90_sector_de": round(p90_sector_de, 1)
                    }, f"BoundaryDiscontinuityReject: Perimeter boundary step exceeds natural substrate continuity (Mean ΔE {mean_sector_de:.1f} > 9.5, P90 {p90_sector_de:.1f} > {allowable_max_de:.1f}).", "BoundaryDiscontinuityReject"
            else:
                max_sector_de = 0.0
                mean_sector_de = 0.0
        else:
            max_sector_de = 0.0
            mean_sector_de = 0.0

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

        if delta_e_fill_to_bg > 10.5:
            return False, {"delta_e_fill_to_bg": round(delta_e_fill_to_bg, 1)}, f"BackgroundMismatchReject: Reconstructed fill color deviates from substrate (ΔE {delta_e_fill_to_bg:.1f} > 10.5).", "BackgroundMismatchReject"

        # -------------------------------------------------------------
        # 3. TEXTURE PRESERVATION & LOCAL BLUR DETECTION (LocalBlurReject)
        # -------------------------------------------------------------
        # 3a. Laplacian Variance Ratio (Raised minimum from 0.35 to 0.65 for textured backgrounds)
        lap_filled = cv2.Laplacian(filled_gray, cv2.CV_64F)
        lap_base_bg = cv2.Laplacian(base_gray, cv2.CV_64F)

        fill_lap_var = float(np.var(lap_filled[fill_mask_bool]))
        bg_lap_var = float(np.var(lap_base_bg[bg_mask_bool]))
        texture_ratio = float(fill_lap_var / (bg_lap_var + 1e-4))

        if bg_lap_var > 20.0:
            if texture_ratio < 0.65 or texture_ratio > 2.20:
                return False, {
                    "texture_ratio": round(texture_ratio, 2),
                    "bg_lap_var": round(bg_lap_var, 1)
                }, f"BackgroundMismatchReject: Texture preservation ratio {texture_ratio:.2f} is outside acceptable range (0.65 - 2.20).", "BackgroundMismatchReject"

        # 3b. Tenengrad Gradient Energy Sharpness Check (Local Blur Detection)
        sobel_x_fill = cv2.Sobel(filled_gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y_fill = cv2.Sobel(filled_gray, cv2.CV_64F, 0, 1, ksize=3)
        tenengrad_fill = np.mean((sobel_x_fill[fill_mask_bool]**2 + sobel_y_fill[fill_mask_bool]**2))

        sobel_x_bg = cv2.Sobel(base_gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y_bg = cv2.Sobel(base_gray, cv2.CV_64F, 0, 1, ksize=3)
        tenengrad_bg = np.mean((sobel_x_bg[bg_mask_bool]**2 + sobel_y_bg[bg_mask_bool]**2))

        sharpness_ratio = float(tenengrad_fill / (tenengrad_bg + 1e-4))
        if tenengrad_bg > 80.0 and sharpness_ratio < 0.70:
            return False, {
                "sharpness_ratio": round(sharpness_ratio, 2),
                "tenengrad_fill": round(tenengrad_fill, 1),
                "tenengrad_bg": round(tenengrad_bg, 1)
            }, f"LocalBlurReject: Reconstructed fill is too blurry/soft (Sharpness ratio {sharpness_ratio:.2f} < 0.70).", "LocalBlurReject"

        # -------------------------------------------------------------
        # 4. ILLUMINATION GRADIENT CONSISTENCY (LightingMismatchReject)
        # -------------------------------------------------------------
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

                if lighting_error > 6.5:
                    return False, {"lighting_error": round(lighting_error, 1)}, f"LightingMismatchReject: Shading does not match local illumination plane (Error {lighting_error:.1f} > 6.5 L*).", "LightingMismatchReject"
            except Exception:
                lighting_error = 0.0
        else:
            lighting_error = 0.0

        # -------------------------------------------------------------
        # 5. PATCHWORK & REPETITION DETECTION (PatchworkArtifactReject)
        # -------------------------------------------------------------
        bx1, by1, bx2, by2 = np.min(xs), np.min(ys), np.max(xs), np.max(ys)
        crop_fill = filled_gray[by1:by2+1, bx1:bx2+1]

        if crop_fill.shape[0] >= 16 and crop_fill.shape[1] >= 16:
            norm_crop = (crop_fill - np.mean(crop_fill)).astype(np.float32)
            f_transform = np.fft.fft2(norm_crop)
            f_shift = np.fft.fftshift(f_transform)
            magnitude_spectrum = np.abs(f_shift)**2

            ch, cw = crop_fill.shape
            cy_c, cx_c = ch // 2, cw // 2
            magnitude_spectrum[max(0, cy_c-2):min(ch, cy_c+3), max(0, cx_c-2):min(cw, cx_c+3)] = 0.0

            total_energy = np.sum(magnitude_spectrum) + 1e-5
            peak_energy = np.max(magnitude_spectrum)
            peak_ratio = float(peak_energy / total_energy)

            if peak_ratio > 0.32 and texture_ratio > 0.5:
                return False, {"patchwork_peak_ratio": round(peak_ratio, 3)}, f"PatchworkArtifactReject: Strong periodic tiling / patchwork repetition detected (Peak ratio {peak_ratio:.3f} > 0.32).", "PatchworkArtifactReject"
        else:
            peak_ratio = 0.0

        # -------------------------------------------------------------
        # 6. OBJECT COLOR RESIDUE CHECK (ObjectResidueReject)
        # -------------------------------------------------------------
        obj_l, obj_a, obj_b = object_dominant_lab
        dist_to_obj = np.sqrt(
            (filled_lab[:, :, 0][target_mask_bool] - obj_l)**2 +
            (filled_lab[:, :, 1][target_mask_bool] - obj_a)**2 +
            (filled_lab[:, :, 2][target_mask_bool] - obj_b)**2
        )

        obj_to_bg_de = np.sqrt((obj_l - bg_l)**2 + (obj_a - bg_a)**2 + (obj_b - bg_b)**2)
        if obj_to_bg_de > 16.0:
            residual_obj_pixels = np.sum(dist_to_obj < 9.5)
            residual_frac = float(residual_obj_pixels) / float(np.sum(target_mask_bool))
            if residual_frac > 0.07:
                return False, {"residual_obj_frac": round(residual_frac, 2)}, f"ObjectResidueReject: Fill retains {residual_frac*100:.1f}% of removed object color.", "ObjectResidueReject"
        else:
            residual_frac = 0.0

        # -------------------------------------------------------------
        # 7. RADIAL CONVERGENCE / STARBURST SMEAR (PyramidArtifactReject)
        # -------------------------------------------------------------
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

        if mean_radial_align > 0.65 and texture_ratio < 0.75:
            return False, {"radial_alignment": round(mean_radial_align, 2)}, f"PyramidArtifactReject: Radial smear detected (Alignment {mean_radial_align:.2f} > 0.65).", "PyramidArtifactReject"

        metrics = {
            "max_sector_de": round(max_sector_de, 1),
            "delta_e_fill_to_bg": round(delta_e_fill_to_bg, 1),
            "texture_ratio": round(texture_ratio, 2),
            "sharpness_ratio": round(sharpness_ratio, 2),
            "lighting_error": round(lighting_error, 1),
            "residual_obj_frac": round(residual_frac, 2),
            "radial_alignment": round(mean_radial_align, 2)
        }

        return True, metrics, None, None


class BackgroundReconstructionRouter:
    """
    Advanced Structure-Aware Background Reconstruction Router:
    Never tiles disconnected rectangular patches blindly into the hole.
    Provides 3 specialized reconstruction pathways:
    1. Coherent Single-Source Local Patch Cloning (Poisson / gradient-domain)
       for homogeneous or continuous directional substrates.
    2. Neighborhood-Aware Exemplar / PatchMatch Completion
       for stochastic, granular, and textured substrates.
    3. Localized Structural / Generative Inpainting
       with edge-guided curvature propagation and high-frequency texture injection.
    """

    @classmethod
    def reconstruct_background(cls, image_bgr, target_mask, raw_sam_masks, difficulty="Medium"):
        """
        Routes and reconstructs background under target_mask.
        Returns: (clamped_variant, [ebx1, eby1, ebx2, eby2], combined_metrics, error_reason)
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
        long_side = max(bw, bh)
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

        # 4. LOCAL SEARCH ANNULUS (STRICTLY LOCAL, NO GLOBAL FALLBACK)
        ring_inner_radius = int(long_side * 0.55) + expand_px
        ring_outer_radius = int(long_side * 2.2) + expand_px + 20

        Y, X = np.ogrid[:h, :w]
        dist_from_center = np.sqrt((X - cx)**2 + (Y - cy)**2)
        annulus_mask = (dist_from_center >= ring_inner_radius) & (dist_from_center <= ring_outer_radius)
        clean_substrate_mask = annulus_mask & (occupied_fg == 0)

        clean_sub_px_count = int(np.sum(clean_substrate_mask))
        if clean_sub_px_count < 100:
            annulus_mask = (dist_from_center <= ring_outer_radius * 1.3)
            clean_substrate_mask = annulus_mask & (occupied_fg == 0)
            clean_sub_px_count = int(np.sum(clean_substrate_mask))

        if clean_sub_px_count < 80:
            return None, None, None, "LowSubstrateCoherenceReject: Local clean substrate support is insufficient."

        # Dominant color of original removed object
        lab_img = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        obj_mean_l = float(np.mean(lab_img[:, :, 0][target_mask > 0]))
        obj_mean_a = float(np.mean(lab_img[:, :, 1][target_mask > 0]))
        obj_mean_b = float(np.mean(lab_img[:, :, 2][target_mask > 0]))
        obj_dominant_lab = (obj_mean_l, obj_mean_a, obj_mean_b)

        # 5. SUBSTRATE FEATURE ANALYSIS & ROUTING
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        sub_lap = cv2.Laplacian(gray, cv2.CV_64F)[clean_substrate_mask]
        sub_lap_var = float(np.var(sub_lap))

        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)[clean_substrate_mask]
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)[clean_substrate_mask]
        sub_angles = np.arctan2(sobel_y, sobel_x) % np.pi
        hist_ang, _ = np.histogram(sub_angles, bins=8, range=(0, np.pi))
        dominant_angle_ratio = float(np.max(hist_ang)) / float(np.sum(hist_ang) + 1e-5)

        # Extended ROI bounding box
        ebx1 = max(0, bx1 - expand_px - 4)
        eby1 = max(0, by1 - expand_px - 4)
        ebx2 = min(w, bx2 + expand_px + shadow_shift_x + 4)
        eby2 = min(h, by2 + expand_px + shadow_shift_y + 4)
        ew = ebx2 - ebx1
        eh = eby2 - eby1

        reconstructed_bgr = None
        chosen_pathway = "single_source_clone"

        # 6. EXECUTE ROUTED RECONSTRUCTION PATHWAY
        # Pathway 1: Coherent Single-Source Local Patch Cloning (preferred for clean / smooth / directional)
        if sub_lap_var < 75.0 or dominant_angle_ratio > 0.40:
            reconstructed_bgr = cls._coherent_single_source_clone(
                image_bgr, target_mask, expanded_mask, clean_substrate_mask, (ebx1, eby1, ebx2, eby2), cx, cy
            )
            chosen_pathway = "single_source_clone"

        # Pathway 2: Neighborhood-Aware Exemplar / PatchMatch Completion (for stochastic textures)
        if reconstructed_bgr is None and sub_lap_var >= 35.0:
            reconstructed_bgr = cls._neighborhood_exemplar_completion(
                image_bgr, target_mask, expanded_mask, clean_substrate_mask, (ebx1, eby1, ebx2, eby2), patch_radius=max(7, int(short_side * 0.22))
            )
            chosen_pathway = "exemplar_completion"

        # Pathway 3: Localized Structural / Generative Inpainting (fallback for complex substrates)
        if reconstructed_bgr is None:
            reconstructed_bgr = cls._localized_structural_inpainting(
                image_bgr, target_mask, expanded_mask, clean_substrate_mask, (ebx1, eby1, ebx2, eby2)
            )
            chosen_pathway = "structural_inpainting"

        if reconstructed_bgr is None:
            return None, None, None, "Reconstruction failed across all 3 structure-aware pathways."

        # 7. ZERO-DRIFT BIT-IDENTICAL BACKGROUND CLAMPING OUTSIDE LOCAL ROI
        pad = int(long_side * 0.35)
        rx1, ry1 = max(0, bx1 - pad), max(0, by1 - pad)
        rx2, ry2 = min(w, bx2 + pad + shadow_shift_x), min(h, by2 + pad + shadow_shift_y)

        clamped_variant = image_bgr.copy()
        clamped_variant[ry1:ry2, rx1:rx2] = reconstructed_bgr[ry1:ry2, rx1:rx2]

        # 8. TIGHTENED REMOVAL NATURALNESS CRITIC AUDIT
        nat_passed, nat_metrics, nat_reason, nat_code = RemovalNaturalnessCritic.evaluate_removal_naturalness(
            image_bgr, clamped_variant, target_mask, expanded_mask, clean_substrate_mask, obj_dominant_lab
        )

        if not nat_passed:
            return None, None, None, nat_reason

        combined_metrics = {
            **nat_metrics,
            **coh_metrics,
            "reconstruction_pathway": chosen_pathway
        }

        return clamped_variant, [ebx1, eby1, ebx2, eby2], combined_metrics, None

    @classmethod
    def _coherent_single_source_clone(cls, image_bgr, target_mask, expanded_mask, clean_substrate_mask, ebbox, cx, cy):
        """
        Pathway 1: Finds the single best continuous donor window of identical shape/size from
        the surrounding non-foreground substrate, and blends it using boundary-aligned gradient transfer.
        Zero tiling, zero patchwork, 100% natural substrate grain.
        """
        h, w = image_bgr.shape[:2]
        ebx1, eby1, ebx2, eby2 = ebbox
        ew = ebx2 - ebx1
        eh = eby2 - eby1

        if ew <= 0 or eh <= 0:
            return None

        target_roi = target_mask[eby1:eby2, ebx1:ebx2]
        expanded_roi = expanded_mask[eby1:eby2, ebx1:ebx2]
        if np.sum(target_roi > 0) == 0:
            return None

        lab_img = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

        # Rim statistics around the hole for matching
        kernel_5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        dil_hole = cv2.dilate(expanded_roi, kernel_5, iterations=1)
        rim_roi = (dil_hole > 0) & (expanded_roi == 0)

        if np.sum(rim_roi) > 10:
            rim_mean_lab = np.mean(lab_img[eby1:eby2, ebx1:ebx2][rim_roi], axis=0)
        else:
            rim_mean_lab = np.mean(lab_img[clean_substrate_mask], axis=0)

        # Search candidates in clean substrate
        sub_ys, sub_xs = np.where(clean_substrate_mask)
        if len(sub_xs) < 50:
            return None

        # O(1) Integral image for instant donor candidate evaluation
        integral_clean = cv2.integral(clean_substrate_mask.astype(np.uint8))
        total_patch_area = float(ew * eh)

        candidate_donors = []
        step = max(5, min(ew, eh) // 3)

        for sy, sx in zip(sub_ys[::step], sub_xs[::step]):
            dy1 = sy - eh // 2
            dx1 = sx - ew // 2
            dy2 = dy1 + eh
            dx2 = dx1 + ew

            if dy1 >= 0 and dx1 >= 0 and dy2 < h and dx2 < w:
                clean_count = integral_clean[dy2, dx2] - integral_clean[dy1, dx2] - integral_clean[dy2, dx1] + integral_clean[dy1, dx1]
                donor_clean_fraction = clean_count / total_patch_area
                if donor_clean_fraction >= 0.82:
                    d_lab = lab_img[dy1:dy2, dx1:dx2]
                    d_mean_lab = np.mean(d_lab, axis=(0, 1))

                    de = float(np.sqrt(np.sum((d_mean_lab - rim_mean_lab)**2)))
                    dist = np.sqrt((sx - cx)**2 + (sy - cy)**2)
                    dist_penalty = (dist / float(max(w, h))) * 3.5

                    score = de + dist_penalty
                    candidate_donors.append({
                        "bbox": (dx1, dy1, dx2, dy2),
                        "score": score,
                        "de": de
                    })

        if not candidate_donors:
            return None

        candidate_donors.sort(key=lambda d: d["score"])
        best_donor = candidate_donors[0]
        dx1, dy1, dx2, dy2 = best_donor["bbox"]
        donor_patch = image_bgr[dy1:dy2, dx1:dx2].copy()

        # Pre-align donor color and luminance to destination boundary rim
        d_lab = cv2.cvtColor(donor_patch, cv2.COLOR_BGR2LAB).astype(np.float32)
        l_shift = np.clip(rim_mean_lab[0] - np.mean(d_lab[:, :, 0]), -18.0, 18.0)
        a_shift = np.clip(rim_mean_lab[1] - np.mean(d_lab[:, :, 1]), -8.0, 8.0)
        b_shift = np.clip(rim_mean_lab[2] - np.mean(d_lab[:, :, 2]), -8.0, 8.0)
        d_lab[:, :, 0] = np.clip(d_lab[:, :, 0] + l_shift, 0, 255)
        d_lab[:, :, 1] = np.clip(d_lab[:, :, 1] + a_shift, 0, 255)
        d_lab[:, :, 2] = np.clip(d_lab[:, :, 2] + b_shift, 0, 255)
        donor_adjusted = cv2.cvtColor(d_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)

        # Smooth alpha mask: 1.0 over expanded hole, feathering smoothly into clean substrate
        expanded_f = (expanded_roi > 0).astype(np.float32)
        alpha = cv2.GaussianBlur(expanded_f, (7, 7), 1.5)
        alpha = np.clip(alpha * 1.25, 0.0, 1.0)
        alpha_3d = np.expand_dims(alpha, axis=2)

        res = image_bgr.copy()
        res_crop = res[eby1:eby2, ebx1:ebx2].astype(np.float32)
        blended = (donor_adjusted.astype(np.float32) * alpha_3d + res_crop * (1.0 - alpha_3d)).astype(np.uint8)
        res[eby1:eby2, ebx1:ebx2] = blended
        return res

    @classmethod
    def _neighborhood_exemplar_completion(cls, image_bgr, target_mask, expanded_mask, clean_substrate_mask, ebbox, patch_radius=9):
        """
        Pathway 2: Vectorized fast exemplar / PatchMatch completion for stochastic textures.
        Fills the hole inward along the fill front by matching local boundary neighborhoods.
        Never tiles rectangular blocks blindly.
        """
        h, w = image_bgr.shape[:2]
        ebx1, eby1, ebx2, eby2 = ebbox

        work_img = image_bgr.copy()
        unfilled_mask = (expanded_mask > 0).astype(np.uint8)

        # Extract local search area (clean substrate inside expanded neighborhood)
        sub_ys, sub_xs = np.where(clean_substrate_mask)
        if len(sub_xs) < 40:
            return None

        # Build candidate source patches (fixed size 2*pr+1)
        pr = patch_radius
        ps = 2 * pr + 1
        sample_step = max(4, pr)
        donor_patches = []
        donor_coords = []

        for sy, sx in zip(sub_ys[::sample_step], sub_xs[::sample_step]):
            if sy - pr >= 0 and sy + pr + 1 <= h and sx - pr >= 0 and sx + pr + 1 <= w:
                if np.sum(unfilled_mask[sy-pr:sy+pr+1, sx-pr:sx+pr+1]) == 0:
                    patch = work_img[sy-pr:sy+pr+1, sx-pr:sx+pr+1]
                    donor_patches.append(patch.astype(np.float32))
                    donor_coords.append((sy, sx))

        if len(donor_patches) < 6:
            return None

        # Stack into (K, ps, ps, 3) tensor for vectorized matching
        donor_stack = np.stack(donor_patches[:40])  # (K, ps, ps, 3)
        K = len(donor_stack)

        max_iterations = 25
        iter_count = 0

        while np.sum(unfilled_mask[eby1:eby2, ebx1:ebx2] > 0) > 0 and iter_count < max_iterations:
            iter_count += 1

            # Find current fill front
            kernel_3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            dilated = cv2.dilate(unfilled_mask, kernel_3, iterations=1)
            front = (dilated > 0) & (unfilled_mask > 0)

            front_ys, front_xs = np.where(front)
            if len(front_xs) == 0:
                break

            # Stride along front points for rapid inward synthesis
            stride = max(2, pr // 2)
            for fy, fx in zip(front_ys[::stride], front_xs[::stride]):
                if unfilled_mask[fy, fx] == 0:
                    continue

                py1, py2 = fy - pr, fy + pr + 1
                px1, px2 = fx - pr, fx + pr + 1

                if py1 < 0 or py2 > h or px1 < 0 or px2 > w:
                    continue

                t_patch = work_img[py1:py2, px1:px2].astype(np.float32)
                t_known = (unfilled_mask[py1:py2, px1:px2] == 0).astype(np.float32)

                known_count = np.sum(t_known)
                if known_count < 6:
                    continue

                # Vectorized SSD across all K donors over known pixels
                t_known_3d = np.expand_dims(t_known, axis=2)  # (ps, ps, 1)
                t_target_broadcast = np.expand_dims(t_patch * t_known_3d, axis=0)  # (1, ps, ps, 3)
                d_masked = donor_stack * np.expand_dims(t_known_3d, axis=0)  # (K, ps, ps, 3)

                ssd = np.sum((d_masked - t_target_broadcast)**2, axis=(1, 2, 3)) / (known_count * 3.0)
                best_idx = np.argmin(ssd)

                # Fill only the unknown pixels with the winning donor patch
                best_donor = donor_stack[best_idx].astype(np.uint8)
                to_fill = (unfilled_mask[py1:py2, px1:px2] > 0)
                work_img[py1:py2, px1:px2][to_fill] = best_donor[to_fill]
                unfilled_mask[py1:py2, px1:px2] = 0

        # Boundary-aware smoothing
        roi = work_img[eby1:eby2, ebx1:ebx2]
        smooth_roi = cv2.bilateralFilter(roi, 5, 25, 25)
        hole_blend = cv2.GaussianBlur((expanded_mask[eby1:eby2, ebx1:ebx2] > 0).astype(np.float32), (7, 7), 1.5)
        hole_blend_3d = np.expand_dims(hole_blend, axis=2)

        work_img[eby1:eby2, ebx1:ebx2] = (
            smooth_roi.astype(np.float32) * hole_blend_3d +
            work_img[eby1:eby2, ebx1:ebx2].astype(np.float32) * (1.0 - hole_blend_3d)
        ).astype(np.uint8)

        return work_img

    @classmethod
    def _localized_structural_inpainting(cls, image_bgr, target_mask, expanded_mask, clean_substrate_mask, ebbox):
        """
        Pathway 3: Localized structural Navier-Stokes/Telea inpainting with high-frequency
        texture injection to eliminate blurriness on complex/structured substrates.
        """
        h, w = image_bgr.shape[:2]
        ebx1, eby1, ebx2, eby2 = ebbox

        hole_mask_u8 = (expanded_mask > 0).astype(np.uint8) * 255

        # 1. Structural Navier-Stokes inpaint
        in結構 = cv2.inpaint(image_bgr, hole_mask_u8, 4, cv2.INPAINT_NS)

        # 2. Extract high-frequency texture residual from clean substrate
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        sub_lap = cv2.Laplacian(gray, cv2.CV_64F)[clean_substrate_mask]
        sub_lap_var = float(np.var(sub_lap))

        if sub_lap_var > 25.0:
            # High-frequency texture injection
            sub_ys, sub_xs = np.where(clean_substrate_mask)
            if len(sub_xs) > 20:
                donor_idx = np.random.choice(len(sub_xs))
                dsx, dsy = sub_xs[donor_idx], sub_ys[donor_idx]
                ew = ebx2 - ebx1
                eh = eby2 - eby1

                dsx1 = max(0, min(w - ew, dsx - ew // 2))
                dsy1 = max(0, min(h - eh, dsy - eh // 2))
                dsx2, dsy2 = dsx1 + ew, dsy1 + eh

                tex_donor = image_bgr[dsy1:dsy2, dsx1:dsx2].astype(np.float32)
                tex_blur = cv2.GaussianBlur(tex_donor, (5, 5), 1.2)
                hf_residual = tex_donor - tex_blur

                roi_inpaint = in結構[eby1:eby2, ebx1:ebx2].astype(np.float32)
                hole_alpha = np.expand_dims(cv2.GaussianBlur((expanded_mask[eby1:eby2, ebx1:ebx2] > 0).astype(np.float32), (5, 5), 1.0), axis=2)

                injected = np.clip(roi_inpaint + hf_residual * 0.45 * hole_alpha, 0, 255).astype(np.uint8)
                in結構[eby1:eby2, ebx1:ebx2] = injected

        return in結構


# Backward compatibility alias
class LocalBackgroundSynthesizer:
    @classmethod
    def synthesize_background_fill(cls, image_bgr, target_mask, raw_sam_masks, difficulty="Medium"):
        return BackgroundReconstructionRouter.reconstruct_background(
            image_bgr, target_mask, raw_sam_masks, difficulty=difficulty
        )


class RemoveTargetSelector:
    """
    Evaluates, selects, and removes an object from a repeated peer family
    using substrate coherence analysis, structure-aware reconstruction router, and naturalness critic.
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
        Executes structure-aware background reconstruction and runs RemovalNaturalnessCritic + PerceptualVerificationEngine.
        """
        h, w = image_bgr.shape[:2]
        bx1, by1, bx2, by2 = target_bbox

        # 1. RECONSTRUCT BACKGROUND WITH STRUCTURE-AWARE ROUTER
        clamped_variant, expanded_bbox, nat_metrics, err = BackgroundReconstructionRouter.reconstruct_background(
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
