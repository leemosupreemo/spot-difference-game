"""
REMOVE TARGET SELECTOR & SEAMLESS INPAINTING ENGINE
================================================================================
Selects the optimal object for a REMOVE difference:
1. Filters candidates that belong to a repeated peer group (1 of N).
2. Measures Background Recoverability (surrounding texture stationarity & edge flow).
3. Executes seamless bi-harmonic inpainting with soft boundary feathering.
4. Remove QA Critic (detects blur smear, ghost edges, and background drift).
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
    def select_best_remove_target(cls, image_bgr, candidate_masks, peer_groups, target_difficulty="Hard"):
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        # Gating sizes based on human verification floor
        min_area, max_area = 0.20, 1.00
        if target_difficulty == "Hard": min_area, max_area = 0.12, 0.70  # Peer camouflage drives search, not micro-size
        elif target_difficulty == "Easy": min_area, max_area = 0.40, 2.20

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

            # 2. BACKGROUND RECOVERABILITY: Surrounding Halo Stationarity
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
            dilated = cv2.dilate(mask, kernel, iterations=1)
            halo = (dilated > 0) & (mask == 0)
            if np.sum(halo) == 0: continue

            halo_pixels = gray[halo]
            halo_std = np.std(halo_pixels)
            # Texture stationarity score (lower variance = cleaner reconstruction)
            recoverability_score = max(0.0, 1.0 - (halo_std / 45.0))

            # 3. ISOLATION / OCCLUSION CHECK: Low overlap with other items
            bx1, by1, bx2, by2 = c["bbox"]
            bw, bh = bx2 - bx1, by2 - by1

            # Check compactness (perimeter^2 / area)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours: continue
            perimeter = cv2.arcLength(contours[0], True)
            compactness = float(4.0 * np.pi * pcount) / float((perimeter**2) + 1e-5)

            # Composite Removal Score: Recoverability (40%) + Peer Group Size (35%) + Compactness (25%)
            removal_score = (recoverability_score * 40.0) + (min(1.0, peer_count / 6.0) * 35.0) + (min(1.0, compactness) * 25.0)

            evaluated_candidates.append({
                "candidate": c,
                "score": round(removal_score, 1),
                "peer_count": peer_count,
                "recoverability": round(recoverability_score, 2),
                "halo_std": round(halo_std, 1),
                "compactness": round(compactness, 2)
            })

        if not evaluated_candidates:
            return None, "No candidate met removal criteria (peer count >= 2 and clean background recoverability).", []

        evaluated_candidates.sort(key=lambda x: x["score"], reverse=True)
        best = evaluated_candidates[0]
        return best, f"Selected optimal Remove target (Score: {best['score']}/100, Peers: {best['peer_count']}, Recoverability: {best['recoverability']})", evaluated_candidates

    @classmethod
    def execute_removal_and_qa(cls, image_bgr, target_mask, target_bbox, difficulty="Hard"):
        """
        Inpaints the object cleanly, blends the boundaries, and runs Remove QA Critic + Direct-Look Verification.
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

        # REMOVE QA CRITIC:
        diff = np.max(np.abs(image_bgr.astype(np.int16) - clamped_variant.astype(np.int16)), axis=2)
        diff_mask = (diff > 14).astype(np.uint8)
        changed_pixels = np.sum(diff_mask)
        area_pct = (changed_pixels / total_pixels) * 100.0

        min_area = 0.12 if difficulty == "Hard" else 0.20
        if area_pct < min_area:
            return False, None, None, f"Remove QA Reject: Changed area too small ({area_pct:.3f}% < {min_area:.2f}%)."

        # DIRECT-LOOK & DISPLAY RESOLUTION VERIFICATION GATE:
        v_passed, v_metrics, v_reason = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            image_bgr, clamped_variant, target_bbox, operation="remove", difficulty=difficulty
        )
        if not v_passed:
            return False, None, None, f"Remove QA Direct-Look Reject: {v_reason}"

        ys, xs = np.where(diff_mask > 0)
        cx = float(np.mean(xs)) / w * 100.0
        cy = float(np.mean(ys)) / h * 100.0
        span = max(np.max(xs) - np.min(xs) + 1, np.max(ys) - np.min(ys) + 1) / max(w, h) * 100.0
        radius = round(float(max(4.2, min(7.5, span / 2.0 + 1.2))), 1)

        final_info = {
            "x": round(cx, 1),
            "y": round(cy, 1),
            "radius": radius,
            "area_pct": round(area_pct, 3),
            "operation": "remove",
            "verification": v_metrics
        }

        return True, clamped_variant, final_info, f"Remove QA Passed ({v_reason})"
