"""
REMOVE TARGET SELECTOR & SEAMLESS INPAINTING ENGINE (WITH GAP-ANOMALY SCORING)
================================================================================
Selects the optimal object for a REMOVE difference:
1. Filters candidates belonging to a repeated peer group (1 of N).
2. Measures Gap-Anomaly: Penalizes removals that break an unnaturally regular grid/row.
   Favors naturally scattered clusters, irregular piles, and organic arrangements.
3. Measures Background Recoverability (surrounding texture stationarity & edge flow).
4. Executes seamless Navier-Stokes inpainting with boundary feathering.
5. Runs Two-Sided Remove QA Critic & Direct-Look Verification.
================================================================================
"""

import cv2
import numpy as np
from perceptual_verification_engine import PerceptualVerificationEngine

class RemoveTargetSelector:
    """
    Evaluates, selects, and removes an object from a repeated peer family.
    """

    @classmethod
    def compute_gap_anomaly(cls, candidate_idx, group_indices, candidate_masks):
        """
        Measures if removing this candidate breaks a hyper-regular 1D/2D grid.
        Returns: (gap_penalty: float from 0.0 to 1.0, is_regular_grid: bool)
        """
        if len(group_indices) < 3:
            return 0.0, False

        centroids = np.array([candidate_masks[k]["centroid"] for k in group_indices]) # (N, 2)
        n = len(centroids)

        # Compute nearest-neighbor distances for all members
        nn_dists = []
        for i in range(n):
            dists = np.sqrt(np.sum((centroids - centroids[i])**2, axis=1))
            dists = dists[dists > 0]
            if len(dists) > 0:
                nn_dists.append(np.min(dists))

        if len(nn_dists) == 0:
            return 0.0, False

        # Regularity: coefficient of variation of nearest-neighbor distances
        cv_spacing = float(np.std(nn_dists) / (np.mean(nn_dists) + 1e-4))
        
        # If cv_spacing < 0.15, spacing is hyper-regular (e.g. perfect grid of dots/pills)
        is_hyper_regular = (cv_spacing < 0.18)
        gap_penalty = max(0.0, 1.0 - (cv_spacing / 0.35)) if is_hyper_regular else 0.0

        return float(gap_penalty), is_hyper_regular

    @classmethod
    def select_best_remove_target(cls, image_bgr, candidate_masks, peer_groups, target_difficulty="Medium"):
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        min_area, max_area = 0.15, 0.80
        if target_difficulty == "Hard": min_area, max_area = 0.10, 0.55
        elif target_difficulty == "Easy": min_area, max_area = 0.30, 1.40

        evaluated_candidates = []

        # Map candidate index to its peer group
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

            # 1. PEER CAMOUFLAGE: Must have at least 2 other similar items in the scene
            group = cand_to_group.get(i)
            peer_count = group["size"] - 1 if group else 0
            if peer_count < 2:
                continue

            # 2. GAP-ANOMALY SCORING: Penalize breaking hyper-regular grid lines
            gap_penalty, is_regular = cls.compute_gap_anomaly(i, group["indices"], candidate_masks)

            # 3. BACKGROUND RECOVERABILITY: Surrounding Halo Stationarity
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
            dilated = cv2.dilate(mask, kernel, iterations=1)
            halo = (dilated > 0) & (mask == 0)
            if np.sum(halo) == 0: continue

            halo_pixels = gray[halo]
            halo_std = np.std(halo_pixels)
            recoverability_score = max(0.0, 1.0 - (halo_std / 45.0))

            # 4. COMPACTNESS
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours: continue
            perimeter = cv2.arcLength(contours[0], True)
            compactness = float(4.0 * np.pi * pcount) / float((perimeter**2) + 1e-5)

            # Composite Removal Score:
            # Recoverability (35%) + Peer Group Size (35%) + Compactness (20%) - Gap Penalty (15%)
            removal_score = (recoverability_score * 35.0) + (min(1.0, peer_count / 6.0) * 35.0) + (min(1.0, compactness) * 20.0) - (gap_penalty * 15.0)

            evaluated_candidates.append({
                "candidate": c,
                "score": round(removal_score, 1),
                "peer_count": peer_count,
                "recoverability": round(recoverability_score, 2),
                "gap_penalty": round(gap_penalty, 2),
                "compactness": round(compactness, 2)
            })

        if not evaluated_candidates:
            return None, "No candidate met removal criteria (peer count >= 2, clean background, acceptable gap anomaly).", []

        evaluated_candidates.sort(key=lambda x: x["score"], reverse=True)
        best = evaluated_candidates[0]
        return best, f"Selected optimal Remove target (Score: {best['score']}/100, Peers: {best['peer_count']}, Recoverability: {best['recoverability']}, Gap Penalty: {best['gap_penalty']})", evaluated_candidates

    @classmethod
    def execute_removal_and_qa(cls, image_bgr, target_mask, target_bbox, difficulty="Medium"):
        """
        Inpaints the object cleanly, blends the boundaries, and runs Two-Sided Remove QA Critic.
        """
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        
        # Dilate inpainting mask slightly to cover shadow contact edge
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        inpaint_mask = cv2.dilate(target_mask, kernel, iterations=1)

        # High-quality Navier-Stokes inpainting
        inpainted_bgr = cv2.inpaint(image_bgr, inpaint_mask, inpaintRadius=4, flags=cv2.INPAINT_NS)

        # Feathered boundary alpha blending to eliminate any hard seam
        blur_mask = cv2.GaussianBlur(inpaint_mask.astype(np.float32), (7, 7), 2.0)
        alpha = np.expand_dims(blur_mask, axis=2)
        variant_bgr = (inpainted_bgr.astype(np.float32) * alpha + image_bgr.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)

        # Zero-drift background clamping outside bbox + margin
        bx1, by1, bx2, by2 = target_bbox
        pad = int(max(bx2 - bx1, by2 - by1) * 0.3)
        rx1, ry1 = max(0, bx1 - pad), max(0, by1 - pad)
        rx2, ry2 = min(w, bx2 + pad), min(h, by2 + pad)

        clamped_variant = image_bgr.copy()
        clamped_variant[ry1:ry2, rx1:rx2] = variant_bgr[ry1:ry2, rx1:rx2]

        # TWO-SIDED DIRECT-LOOK & DISPLAY RESOLUTION VERIFICATION GATE:
        v_passed, v_metrics, v_reason, v_code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            image_bgr, clamped_variant, target_bbox, operation="remove", difficulty=difficulty
        )
        if not v_passed:
            return False, None, None, f"Remove QA Reject ({v_code}): {v_reason}"

        # Compute centroid & hit radius
        diff_arr = np.max(np.abs(image_bgr.astype(np.int16) - clamped_variant.astype(np.int16)), axis=2)
        diff_pts = np.where(diff_arr > 14)
        if len(diff_pts[0]) > 0:
            cx_pct = round(float(np.mean(diff_pts[1])) / float(w) * 100.0, 1)
            cy_pct = round(float(np.mean(diff_pts[0])) / float(h) * 100.0, 1)
            span_x = (np.max(diff_pts[1]) - np.min(diff_pts[1])) / float(w) * 100.0
            span_y = (np.max(diff_pts[0]) - np.min(diff_pts[0])) / float(h) * 100.0
            radius = round(max(4.5, min(7.5, max(span_x, span_y) / 2.0 + 1.2)), 1)
        else:
            cx_pct = round(float(bx1 + bx2) / 2.0 / float(w) * 100.0, 1)
            cy_pct = round(float(by1 + by2) / 2.0 / float(h) * 100.0, 1)
            radius = 5.5

        ground_truth = {
            "x": cx_pct,
            "y": cy_pct,
            "radius": radius,
            "bbox": target_bbox,
            "metrics": v_metrics
        }

        return True, clamped_variant, ground_truth, v_reason
