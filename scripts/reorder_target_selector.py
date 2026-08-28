"""
REORDER TARGET SELECTOR & LOCAL POSE MUTATION ENGINE
================================================================================
Selects and repositions ONE existing loose object within a compact local ROI:
1. Candidate Selection: Loose movable objects with peer camouflage & clean background.
2. Local Pose Generator:
   - Small translation (15 - 35 px)
   - Angle rotation (15° - 45°)
   - Translation + rotation
3. Footprint Reconstruction:
   - Uses BackgroundReconstructionRouter (coherent single-source clone / exemplar completion).
   - Strictly NO blind full-object inpainting fallback (restricted to genuinely tiny/thin masks <= 3px only).
4. Composite: Rotated/translated object with synthesized contact shadow.
5. Strict Compactness Gate: Union bounding box must form ONE compact answer region.
6. Zero-Drift Bit-Identical Clamping outside local ROI.
================================================================================
"""

import cv2
import numpy as np
from perceptual_verification_engine import PerceptualVerificationEngine
from remove_target_selector import BackgroundReconstructionRouter, LocalBackgroundSynthesizer


class ReorderTargetSelector:
    """
    Finds a loose object candidate and applies a subtle, natural local pose/orientation shift.
    """

    @classmethod
    def find_best_reorder_target(cls, image_bgr, candidate_masks, peer_groups, raw_sam_masks, target_difficulty="Medium"):
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        disp_scale_x = 700.0 / float(w)
        disp_scale_y = 440.0 / float(h)

        min_area, max_area = 0.15, 0.85
        if target_difficulty == "Hard": min_area, max_area = 0.10, 0.60
        elif target_difficulty == "Easy": min_area, max_area = 0.30, 1.40

        # Build occupied space mask of other objects
        occupied_mask = np.zeros((h, w), dtype=np.uint8)
        for m in raw_sam_masks:
            m_res = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            if np.sum(m_res > 0) / float(total_pixels) > 0.25 and len(raw_sam_masks) > 25:
                continue
            occupied_mask = cv2.bitwise_or(occupied_mask, m_res)

        cand_to_group = {}
        for g in peer_groups:
            for c_idx in g["indices"]:
                cand_to_group[c_idx] = g

        evaluated_candidates = []

        for i, c in enumerate(candidate_masks):
            area_pct = c["area_pct"]
            if area_pct < min_area or area_pct > max_area:
                continue

            mask = c["mask"]
            pcount = np.sum(mask > 0)
            if pcount == 0: continue

            # Display size check (18px to 42px)
            bx1, by1, bx2, by2 = c["bbox"]
            bw, bh = bx2 - bx1 + 1, by2 - by1 + 1
            d_short = min(bw * disp_scale_x, bh * disp_scale_y)
            if d_short < 18.0 or d_short > 42.0:
                continue

            group = cand_to_group.get(i)
            peer_count = group["size"] - 1 if group else 0
            if peer_count < 1:
                continue

            # Check background recoverability
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
            dilated = cv2.dilate(mask, kernel, iterations=1)
            halo = (dilated > 0) & (mask == 0)
            if np.sum(halo) == 0: continue

            halo_std = np.std(gray[halo])
            if halo_std > 42.0:
                continue
            recoverability = max(0.0, 1.0 - (halo_std / 45.0))

            # Try candidate pose mutations: [angle_deg, shift_x, shift_y]
            shift_dist = max(12, int(min(bw, bh) * 0.40))
            test_mutations = [
                {"type": "rotation", "angle": 25.0, "dx": 0, "dy": 0},
                {"type": "rotation", "angle": -28.0, "dx": 0, "dy": 0},
                {"type": "trans_rot", "angle": 18.0, "dx": shift_dist, "dy": -int(shift_dist * 0.4)},
                {"type": "trans_rot", "angle": -18.0, "dx": -shift_dist, "dy": int(shift_dist * 0.4)},
                {"type": "translation", "angle": 0.0, "dx": int(shift_dist * 0.75), "dy": int(shift_dist * 0.75)},
                {"type": "translation", "angle": 0.0, "dx": -int(shift_dist * 0.75), "dy": -int(shift_dist * 0.75)},
            ]

            valid_mutations = []
            for mut in test_mutations:
                # Compute transformed bounding box
                nbx1 = int(bx1 + mut["dx"])
                nby1 = int(by1 + mut["dy"])
                nbx2 = nbx1 + bw - 1
                nby2 = nby1 + bh - 1

                # Check frame bounds
                if nbx1 < 10 or nby1 < 10 or nbx2 >= w - 10 or nby2 >= h - 10:
                    continue

                # Check collision with other non-target objects
                other_occupied = occupied_mask.copy()
                other_occupied[by1:by2+1, bx1:bx2+1] = cv2.bitwise_and(
                    other_occupied[by1:by2+1, bx1:bx2+1],
                    cv2.bitwise_not(mask[by1:by2+1, bx1:bx2+1])
                )
                target_dest_roi = other_occupied[nby1:nby2+1, nbx1:nbx2+1]
                overlap_ratio = np.sum(target_dest_roi > 0) / float(pcount + 1e-5)
                if overlap_ratio > 0.22:
                    continue

                # Compactness of change
                ubx1 = min(bx1, nbx1)
                uby1 = min(by1, nby1)
                ubx2 = max(bx2, nbx2)
                uby2 = max(by2, nby2)
                uw = ubx2 - ubx1 + 1
                uh = uby2 - uby1 + 1

                # Ensure union bounding box is not excessively stretched
                u_area_pct = (uw * uh) / float(total_pixels) * 100.0
                if u_area_pct > 2.5:
                    continue

                valid_mutations.append({
                    "mutation": mut,
                    "union_bbox": (ubx1, uby1, ubx2, uby2),
                    "new_bbox": (nbx1, nby1, nbx2, nby2),
                    "overlap_ratio": overlap_ratio
                })

            if not valid_mutations:
                continue

            best_mut = valid_mutations[0]

            score = (recoverability * 45.0) + (min(1.0, peer_count / 5.0) * 35.0) + (min(1.0, (1.0 - best_mut["overlap_ratio"])) * 20.0)

            evaluated_candidates.append({
                "candidate": c,
                "score": round(score, 1),
                "recoverability": round(recoverability, 2),
                "peer_count": peer_count,
                "best_mutation": best_mut["mutation"],
                "union_bbox": best_mut["union_bbox"],
                "new_bbox": best_mut["new_bbox"]
            })

        if not evaluated_candidates:
            return None, "No candidate met reorder criteria (loose object, recoverable background, compact pose).", []

        evaluated_candidates.sort(key=lambda x: x["score"], reverse=True)
        best = evaluated_candidates[0]
        return best, f"Selected optimal Reorder target (Score: {best['score']}/100, Peers: {best['peer_count']}, Mutation: {best['best_mutation']['type']})", evaluated_candidates

    @classmethod
    def execute_reorder_and_qa(cls, image_bgr, target_mask, target_bbox, mutation, union_bbox, raw_sam_masks, difficulty="Medium"):
        """
        Executes structure-aware background reconstruction on vacated footprint, transforms object,
        composites with contact shadow, and verifies using PerceptualVerificationEngine.
        Strictly disallows full-object inpaint fallback.
        """
        h, w = image_bgr.shape[:2]
        total_pixels = h * w

        bx1, by1, bx2, by2 = target_bbox
        bw = bx2 - bx1 + 1
        bh = by2 - by1 + 1
        area_pct = (np.sum(target_mask > 0) / float(total_pixels)) * 100.0

        # 1. Clean old footprint with BackgroundReconstructionRouter
        base_reconstructed, _, _, err = BackgroundReconstructionRouter.reconstruct_background(
            image_bgr, target_mask, raw_sam_masks, difficulty=difficulty
        )

        if base_reconstructed is None:
            # Strictly restrict any fallback to genuinely tiny/thin masks only
            if area_pct <= 0.05 or min(bw, bh) <= 3:
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
                inpaint_mask = cv2.dilate(target_mask, kernel, iterations=1)
                base_reconstructed = cv2.inpaint(image_bgr, inpaint_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
            else:
                return False, None, None, f"Reorder Reject: Background reconstruction failed on vacated footprint ({err})"

        # 2. Extract object patch
        crop_mask = (target_mask[by1:by2+1, bx1:bx2+1] > 0).astype(np.float32)
        crop_bgr = image_bgr[by1:by2+1, bx1:bx2+1]

        # 3. Rotate and translate object patch
        angle = mutation.get("angle", 0.0)
        dx = mutation.get("dx", 0)
        dy = mutation.get("dy", 0)

        center = (bw // 2, bh // 2)
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        rot_mask = cv2.warpAffine(crop_mask, rot_mat, (bw, bh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        rot_bgr = cv2.warpAffine(crop_bgr, rot_mat, (bw, bh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

        # 4. Target placement coordinates
        nbx1 = int(bx1 + dx)
        nby1 = int(by1 + dy)
        nbx2 = nbx1 + bw - 1
        nby2 = nby1 + bh - 1

        if nbx1 < 0 or nby1 < 0 or nbx2 >= w or nby2 >= h:
            return False, None, None, "Reorder Reject: Transformed bbox out of bounds."

        # 5. Composite rotated object onto reconstructed base with contact shadow
        variant_bgr = base_reconstructed.copy()

        # Contact shadow
        shadow_mask = cv2.GaussianBlur(rot_mask, (7, 7), 2.0) * 0.40
        sy1 = min(h - 1, max(0, nby1 + 2))
        sx1 = min(w - 1, max(0, nbx1 + 2))
        sy2 = min(h, sy1 + bh)
        sx2 = min(w, sx1 + bw)
        sh_h = sy2 - sy1
        sh_w = sx2 - sx1

        if sh_h > 0 and sh_w > 0:
            shadow_crop = np.expand_dims(shadow_mask[:sh_h, :sh_w], axis=2)
            variant_bgr[sy1:sy2, sx1:sx2] = (variant_bgr[sy1:sy2, sx1:sx2].astype(np.float32) * (1.0 - shadow_crop * 0.45)).astype(np.uint8)

        # Composite object pixels
        rot_alpha = cv2.GaussianBlur(rot_mask, (3, 3), 0.8)
        rot_alpha_3d = np.expand_dims(rot_alpha, axis=2)
        variant_bgr[nby1:nby1+bh, nbx1:nbx1+bw] = (
            rot_bgr.astype(np.float32) * rot_alpha_3d +
            variant_bgr[nby1:nby1+bh, nbx1:nbx1+bw].astype(np.float32) * (1.0 - rot_alpha_3d)
        ).astype(np.uint8)

        # 6. Zero-drift bit-identical clamping outside union_bbox + margin
        ubx1, uby1, ubx2, uby2 = union_bbox
        pad = int(max(ubx2 - ubx1, uby2 - uby1) * 0.25)
        rx1, ry1 = max(0, ubx1 - pad), max(0, uby1 - pad)
        rx2, ry2 = min(w, ubx2 + pad), min(h, uby2 + pad)

        clamped_variant = image_bgr.copy()
        clamped_variant[ry1:ry2, rx1:rx2] = variant_bgr[ry1:ry2, rx1:rx2]

        # 7. Verification Gate (Two-Sided)
        v_passed, v_metrics, v_reason, v_code = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            image_bgr, clamped_variant, union_bbox, operation="reorder", difficulty=difficulty
        )

        if not v_passed:
            return False, None, None, f"Reorder QA Reject ({v_code}): {v_reason}"

        # Compute centroid & hit radius
        diff_arr = np.max(np.abs(image_bgr.astype(np.int16) - clamped_variant.astype(np.int16)), axis=2)
        diff_pts = np.where(diff_arr > 14)
        if len(diff_pts[0]) > 0:
            cx_pct = round(float(np.mean(diff_pts[1])) / float(w) * 100.0, 1)
            cy_pct = round(float(np.mean(diff_pts[0])) / float(h) * 100.0, 1)
            span_x = (np.max(diff_pts[1]) - np.min(diff_pts[1])) / float(w) * 100.0
            span_y = (np.max(diff_pts[0]) - np.min(diff_pts[0])) / float(h) * 100.0
            radius = round(max(5.0, min(8.5, max(span_x, span_y) / 2.0 + 1.2)), 1)
        else:
            cx_pct = round(float(ubx1 + ubx2) / 2.0 / float(w) * 100.0, 1)
            cy_pct = round(float(uby1 + uby2) / 2.0 / float(h) * 100.0, 1)
            radius = 6.0

        ground_truth = {
            "x": cx_pct,
            "y": cy_pct,
            "radius": radius,
            "union_bbox": [ubx1, uby1, ubx2, uby2],
            "metrics": v_metrics
        }

        return True, clamped_variant, ground_truth, v_reason
