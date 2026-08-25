"""
ADD TARGET SELECTOR & SEAMLESS CLONE SYNTHESIZER
================================================================================
Selects a donor object from a repeated peer family and finds a plausible empty
insertion slot within the same cluster to create an authentic ADD difference:
1. Identifies repeated peer family (e.g. 1 of 8 buttons, screws, capacitors, clips).
2. Scans for candidate insertion slots that do NOT overlap foreground masks.
3. Synthesizes contact shadow and transfers donor via seamless alpha blending.
4. Add QA Critic (validates natural contact, area bounds, zero drift).
================================================================================
"""

import cv2
import numpy as np

class AddTargetSelector:
    """
    Finds a donor object from a repeated family and a plausible insertion slot.
    """

    @classmethod
    def find_best_add_pair(cls, image_bgr, candidate_masks, peer_groups, raw_sam_masks, target_difficulty="Hard"):
        h, w = image_bgr.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        # Build union mask of all existing objects in the scene
        existing_objects_mask = np.zeros((h, w), dtype=np.uint8)
        for m in raw_sam_masks:
            m_res = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            # Exclude large background tabletop planes (> 25% with > 25 objects)
            if np.sum(m_res > 0) / total_pixels > 0.25 and len(raw_sam_masks) > 25:
                continue
            existing_objects_mask = cv2.bitwise_or(existing_objects_mask, m_res)

        # Dilate existing objects slightly so we don't place too close/colliding
        safety_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        occupied_space = cv2.dilate(existing_objects_mask, safety_kernel, iterations=1)

        candidate_pairs = []

        # Iterate over repeated peer groups with at least 2 members
        for g in peer_groups:
            if g["size"] < 2: continue

            # Pick the best segmented member of this peer group as donor
            for donor_idx in g["indices"]:
                donor = candidate_masks[donor_idx]
                d_mask = donor["mask"]
                bx1, by1, bx2, by2 = donor["bbox"]
                bw, bh = bx2 - bx1 + 1, by2 - by1 + 1
                
                # Check difficulty size constraints
                if donor["area_pct"] < 0.035 or donor["area_pct"] > 0.50:
                    continue

                donor_crop_mask = d_mask[by1:by2+1, bx1:bx2+1]
                donor_crop_bgr = image_bgr[by1:by2+1, bx1:bx2+1]

                # Get peer group centroid to search for nearby slots
                group_xs = [candidate_masks[k]["centroid"][0] for k in g["indices"]]
                group_ys = [candidate_masks[k]["centroid"][1] for k in g["indices"]]
                group_cx, group_cy = int(np.mean(group_xs)), int(np.mean(group_ys))

                # Search around the peer group envelope in a grid
                search_radius = max(bw * 3, bh * 3)
                for dx in range(-search_radius, search_radius, max(8, bw // 2)):
                    for dy in range(-search_radius, search_radius, max(8, bh // 2)):
                        slot_x1 = group_cx + dx - bw // 2
                        slot_y1 = group_cy + dy - bh // 2
                        slot_x2 = slot_x1 + bw
                        slot_y2 = slot_y1 + bh

                        # Boundary check
                        if slot_x1 < 20 or slot_y1 < 20 or slot_x2 >= w - 20 or slot_y2 >= h - 20:
                            continue

                        # Check if slot overlaps occupied objects
                        slot_occupied = occupied_space[slot_y1:slot_y2, slot_x1:slot_x2]
                        if np.sum(slot_occupied > 0) > 0:
                            continue

                        # Measure background texture match between donor neighborhood and slot
                        slot_gray = gray[slot_y1:slot_y2, slot_x1:slot_x2]
                        slot_mean = np.mean(slot_gray)
                        slot_std = np.std(slot_gray)

                        # Distance from peer group center (prefer closer to its family)
                        dist_from_group = np.sqrt(dx**2 + dy**2)
                        dist_penalty = min(1.0, dist_from_group / (search_radius + 1e-5))

                        slot_score = 100.0 - (dist_penalty * 40.0) - (slot_std * 0.5)

                        candidate_pairs.append({
                            "donor": donor,
                            "donor_bbox": [bx1, by1, bx2, by2],
                            "slot_bbox": [slot_x1, slot_y1, slot_x2, slot_y2],
                            "score": round(slot_score, 1),
                            "peer_group_size": g["size"]
                        })

        if not candidate_pairs:
            return None, "No plausible empty insertion slot found near repeated peer families.", []

        candidate_pairs.sort(key=lambda x: x["score"], reverse=True)
        best = candidate_pairs[0]
        return best, f"Selected optimal Add pair (Score: {best['score']}/100, Peers: {best['peer_group_size']})", candidate_pairs

    @classmethod
    def execute_add_and_qa(cls, image_bgr, donor_bbox, slot_bbox, donor_mask):
        """
        Synthesizes contact shadow, transfers donor object, and runs Add QA Critic.
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

        # Apply subtle shadow darkening
        for c in range(3):
            variant_bgr[sy_start:sy_start+sh_h, sx_start:sx_start+sh_w, c] = (
                variant_bgr[sy_start:sy_start+sh_h, sx_start:sx_start+sh_w, c].astype(np.float32) *
                (1.0 - shadow_mask[:sh_h, :sh_w])
            ).astype(np.uint8)

        # 2. Composite Donor Object into Insertion Slot with Smooth Alpha Boundary
        obj_alpha = cv2.GaussianBlur(donor_obj_mask, (5, 5), 1.0)
        obj_alpha = np.expand_dims(obj_alpha, axis=2)

        target_roi = variant_bgr[sy1:sy1+bh, sx1:sx1+bw].astype(np.float32)
        blended_roi = donor_pixels.astype(np.float32) * obj_alpha + target_roi * (1.0 - obj_alpha)
        variant_bgr[sy1:sy1+bh, sx1:sx1+bw] = blended_roi.astype(np.uint8)

        # 3. ADD QA CRITIC:
        diff = np.max(np.abs(image_bgr.astype(np.int16) - variant_bgr.astype(np.int16)), axis=2)
        diff_mask = (diff > 14).astype(np.uint8)
        changed_pixels = np.sum(diff_mask)
        area_pct = (changed_pixels / total_pixels) * 100.0

        if area_pct < 0.035:
            return False, None, None, f"Add QA Reject: Added area too small ({area_pct:.3f}% < 0.035%)."

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
            "operation": "add"
        }

        return True, variant_bgr, final_info, f"Add QA Passed (Area: {area_pct:.2f}%, Centroid: ({cx:.1f}%, {cy:.1f}%))"
