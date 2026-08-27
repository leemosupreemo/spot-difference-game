"""
ADD TARGET SELECTOR & SEAMLESS CLONE SYNTHESIZER (WITH PEER-SPACING PLAUSIBILITY)
================================================================================
Selects a donor object from a repeated peer family and finds a plausible empty
insertion slot within the same cluster to create an authentic ADD difference:
1. Identifies repeated peer family (e.g. 1 of 8 buttons, screws, capacitors, clips).
2. Evaluates peer spacing distribution (median nearest-neighbor distance).
3. Enforces peer-spacing plausibility: 0.65 * median_spacing <= new_slot <= 1.65 * median_spacing.
4. Synthesizes contact shadow and transfers donor via seamless alpha blending.
5. Runs Two-Sided Add QA Critic & Direct-Look Verification.
================================================================================
"""

import cv2
import numpy as np
from perceptual_verification_engine import PerceptualVerificationEngine

class AddTargetSelector:
    """
    Finds a donor object from a repeated family and a plausible insertion slot.
    """

    @classmethod
    def find_best_add_pair(cls, image_bgr, candidate_masks, peer_groups, raw_sam_masks, target_difficulty="Medium"):
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        min_donor_area = 0.15 if target_difficulty == "Medium" else (0.10 if target_difficulty == "Hard" else 0.25)
        max_donor_area = 0.85 if target_difficulty == "Medium" else (0.55 if target_difficulty == "Hard" else 1.20)

        # Scale factor for display resolution (700x440)
        disp_scale_x = 700.0 / float(w)
        disp_scale_y = 440.0 / float(h)

        # Build union mask of all existing objects in the scene
        existing_objects_mask = np.zeros((h, w), dtype=np.uint8)
        for m in raw_sam_masks:
            m_res = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            if np.sum(m_res > 0) / float(total_pixels) > 0.25 and len(raw_sam_masks) > 25:
                continue
            existing_objects_mask = cv2.bitwise_or(existing_objects_mask, m_res)

        safety_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
        occupied_space = cv2.dilate(existing_objects_mask, safety_kernel, iterations=1)

        candidate_pairs = []

        # Iterate over repeated peer groups with at least 2 members
        for g in peer_groups:
            if g["size"] < 2: continue

            group_centroids = np.array([candidate_masks[k]["centroid"] for k in g["indices"]]) # (N, 2)
            n_group = len(group_centroids)

            # Compute peer spacing distribution
            peer_nn_dists = []
            for i in range(n_group):
                dists = np.sqrt(np.sum((group_centroids - group_centroids[i])**2, axis=1))
                dists = dists[dists > 0]
                if len(dists) > 0:
                    peer_nn_dists.append(np.min(dists))

            median_spacing = float(np.median(peer_nn_dists)) if len(peer_nn_dists) > 0 else 60.0
            min_plausible_spacing = 0.60 * median_spacing
            max_plausible_spacing = 1.75 * median_spacing

            for donor_idx in g["indices"]:
                donor = candidate_masks[donor_idx]
                d_mask = donor["mask"]
                bx1, by1, bx2, by2 = donor["bbox"]
                bw, bh = bx2 - bx1 + 1, by2 - by1 + 1
                
                # Check display size
                disp_short = min(bw * disp_scale_x, bh * disp_scale_y)
                if disp_short < 18.0 or donor["area_pct"] < min_donor_area or donor["area_pct"] > max_donor_area:
                    continue

                donor_cx, donor_cy = int(donor["centroid"][0]), int(donor["centroid"][1])

                # Search around this specific donor and group members
                search_radius_x = int(max(bw * 3.5, median_spacing * 1.5))
                search_radius_y = int(max(bh * 3.5, median_spacing * 1.5))
                step_x = max(6, bw // 3)
                step_y = max(6, bh // 3)

                for dx in range(-search_radius_x, search_radius_x, step_x):
                    for dy in range(-search_radius_y, search_radius_y, step_y):
                        slot_x1 = donor_cx + dx - bw // 2
                        slot_y1 = donor_cy + dy - bh // 2
                        slot_x2 = slot_x1 + bw
                        slot_y2 = slot_y1 + bh
                        slot_cx = (slot_x1 + slot_x2) / 2.0
                        slot_cy = (slot_y1 + slot_y2) / 2.0

                        if slot_x1 < 15 or slot_y1 < 15 or slot_x2 >= w - 15 or slot_y2 >= h - 15:
                            continue

                        slot_occupied = occupied_space[slot_y1:slot_y2, slot_x1:slot_x2]
                        if np.sum(slot_occupied > 0) > 0:
                            continue

                        # Peer spacing plausibility check:
                        dists_to_peers = np.sqrt((group_centroids[:, 0] - slot_cx)**2 + (group_centroids[:, 1] - slot_cy)**2)
                        slot_nn_dist = float(np.min(dists_to_peers))

                        if slot_nn_dist < min_plausible_spacing or slot_nn_dist > max_plausible_spacing:
                            continue

                        spacing_score = 100.0 - abs(slot_nn_dist - median_spacing) / (median_spacing + 1e-4) * 35.0

                        slot_gray = gray[slot_y1:slot_y2, slot_x1:slot_x2]
                        slot_std = np.std(slot_gray)

                        dist_from_donor = np.sqrt(dx**2 + dy**2)
                        dist_penalty = min(1.0, dist_from_donor / (max(search_radius_x, search_radius_y) + 1e-5))

                        total_score = (spacing_score * 0.45) + ((1.0 - dist_penalty) * 35.0) + (max(0, 1.0 - slot_std / 45.0) * 20.0)

                        candidate_pairs.append({
                            "donor": donor,
                            "donor_bbox": [bx1, by1, bx2, by2],
                            "slot_bbox": [slot_x1, slot_y1, slot_x2, slot_y2],
                            "score": round(total_score, 1),
                            "slot_nn_dist": round(slot_nn_dist, 1),
                            "median_spacing": round(median_spacing, 1),
                            "peer_group_size": g["size"]
                        })

        if not candidate_pairs:
            return None, "No plausible empty insertion slot found near repeated peer families with natural peer spacing.", []

        candidate_pairs.sort(key=lambda x: x["score"], reverse=True)
        best = candidate_pairs[0]
        return best, f"Selected optimal Add pair (Score: {best['score']}/100, Peers: {best['peer_group_size']}, Spacing: {best['slot_nn_dist']}px vs median {best['median_spacing']}px)", candidate_pairs

    @classmethod
    def execute_add_and_qa(cls, image_bgr, donor_bbox, slot_bbox, donor_mask, difficulty="Medium"):
        """
        Synthesizes contact shadow, transfers donor object, and runs Two-Sided Add QA Critic.
        """
        h, w = image_bgr.shape[:2]
        total_pixels = h * w

        dx1, dy1, dx2, dy2 = donor_bbox
        sx1, sy1, sx2, sy2 = slot_bbox

        donor_obj_mask = (donor_mask[dy1:dy2+1, dx1:dx2+1] > 0).astype(np.float32)
        donor_pixels = image_bgr[dy1:dy2+1, dx1:dx2+1]
        bh, bw = donor_pixels.shape[:2]

        variant_bgr = image_bgr.copy()

        # 1. Synthesize Contact Shadow (offset down-right slightly with Gaussian blur)
        shadow_mask = np.zeros((bh + 8, bw + 8), dtype=np.float32)
        shadow_mask[4:bh+4, 4:bw+4] = donor_obj_mask
        shadow_mask = cv2.GaussianBlur(shadow_mask, (7, 7), 2.5) * 0.45

        sy_start = max(0, sy1 - 2)
        sx_start = max(0, sx1 - 2)
        sh_h = min(shadow_mask.shape[0], h - sy_start)
        sh_w = min(shadow_mask.shape[1], w - sx_start)

        if sh_h > 0 and sh_w > 0:
            shadow_crop = np.expand_dims(shadow_mask[:sh_h, :sh_w], axis=2)
            variant_bgr[sy_start:sy_start+sh_h, sx_start:sx_start+sh_w] = (
                variant_bgr[sy_start:sy_start+sh_h, sx_start:sx_start+sh_w].astype(np.float32) * (1.0 - shadow_crop * 0.45)
            ).astype(np.uint8)

        # 2. Feather donor mask slightly
        alpha_mask = cv2.GaussianBlur(donor_obj_mask, (3, 3), 0.8)
        alpha_3d = np.expand_dims(alpha_mask, axis=2)

        # 3. Composite donor object into slot
        variant_bgr[sy1:sy1+bh, sx1:sx1+bw] = (
            donor_pixels.astype(np.float32) * alpha_3d +
            variant_bgr[sy1:sy1+bh, sx1:sx1+bw].astype(np.float32) * (1.0 - alpha_3d)
        ).astype(np.uint8)

        # 4. Zero-drift background clamping outside slot bbox + margin
        pad = int(max(bw, bh) * 0.3)
        rx1, ry1 = max(0, sx1 - pad), max(0, sy1 - pad)
        rx2, ry2 = min(w, sx2 + pad), min(h, sy2 + pad)

        clamped_variant = image_bgr.copy()
        clamped_variant[ry1:ry2, rx1:rx2] = variant_bgr[ry1:ry2, rx1:rx2]

        # 5. TWO-SIDED DIRECT-LOOK & DISPLAY RESOLUTION VERIFICATION GATE:
        v_passed, v_metrics, v_reason, v_code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            image_bgr, clamped_variant, slot_bbox, operation="add", difficulty=difficulty
        )
        if not v_passed:
            return False, None, None, f"Add QA Reject ({v_code}): {v_reason}"

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
            cx_pct = round(float(sx1 + sx2) / 2.0 / float(w) * 100.0, 1)
            cy_pct = round(float(sy1 + sy2) / 2.0 / float(h) * 100.0, 1)
            radius = 5.5

        ground_truth = {
            "x": cx_pct,
            "y": cy_pct,
            "radius": radius,
            "bbox": slot_bbox,
            "donor_bbox": donor_bbox,
            "metrics": v_metrics
        }

        return True, clamped_variant, ground_truth, v_reason
