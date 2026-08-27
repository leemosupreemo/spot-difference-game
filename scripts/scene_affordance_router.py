"""
SCENE AFFORDANCE ROUTER & MULTI-OPERATION BASE IMAGE QA (RECOLOR / REMOVE / ADD / REORDER)
================================================================================
Evaluates a base canvas before editing and scores all four operations:
1. Universal Puzzle Suitability (edge density, DOF uniformity, hero suppression).
2. Recolor Affordance Score (0.0 - 1.0)
3. Remove Affordance Score (0.0 - 1.0)
4. Add Affordance Score (0.0 - 1.0)
5. Reorder Affordance Score (0.0 - 1.0)
6. Discovers Visual Peer Groups & Recommended Operation Route.
================================================================================
"""

import cv2
import numpy as np
from ultralytics import FastSAM

class SceneAffordanceRouter:
    """
    Evaluates base canvas image quality and routes to the optimal difference operation:
    recolor, remove, add, or reorder.
    """

    @classmethod
    def evaluate_and_route_canvas(cls, image_path, target_mix_preference=None):
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            return {"approved": False, "reason": "Failed to read image file."}

        h, w = img_bgr.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        # 1. UNIVERSAL GATES: Sharpness Uniformity (9-Grid Laplacian)
        grid_h, grid_w = h // 3, w // 3
        cell_sharpnesses = []
        for r in range(3):
            for c in range(3):
                cell = gray[r*grid_h:(r+1)*grid_h, c*grid_w:(c+1)*grid_w]
                lap = cv2.Laplacian(cell, cv2.CV_64F)
                cell_sharpnesses.append(np.var(lap))
        
        avg_sharpness = np.mean(cell_sharpnesses)
        min_sharpness = np.min(cell_sharpnesses)
        sharpness_uniformity = float(min_sharpness / (avg_sharpness + 1e-5))

        if sharpness_uniformity < 0.20:
            return {
                "approved": False,
                "reason": f"Universal Gate Fail: Shallow depth-of-field / macro bokeh (Uniformity {sharpness_uniformity:.2f} < 0.20)."
            }

        # 2. UNIVERSAL GATES: Global Edge Density
        edges = cv2.Canny(gray, 60, 150)
        edge_density = float(np.sum(edges > 0) / total_pixels)
        if edge_density < 0.020:
            return {
                "approved": False,
                "reason": f"Universal Gate Fail: Low texture / plain background (Edge density {edge_density:.3f} < 0.020)."
            }

        # 3. FASTSAM SEGMENTATION & OBJECT EXTRACTION
        model = FastSAM("FastSAM-s.pt")
        results = model(image_path, device="cpu", retina_masks=True, imgsz=1024, conf=0.20, iou=0.65, verbose=False)
        if not results or len(results) == 0 or results[0].masks is None:
            return {"approved": False, "reason": "Universal Gate Fail: FastSAM found no objects."}

        raw_masks = results[0].masks.data.cpu().numpy()
        object_count = len(raw_masks)
        if object_count < 14:
            return {"approved": False, "reason": f"Universal Gate Fail: Too few objects ({object_count} < 14)."}

        # 4. FILTER MASKS & IDENTIFY PEER GROUPS
        candidate_masks = []
        shape_descriptors = []
        
        img_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        chroma = np.sqrt((img_lab[:, :, 1] - 128.0)**2 + (img_lab[:, :, 2] - 128.0)**2)
        l_chan = img_lab[:, :, 0]

        recolor_candidates = 0
        remove_candidates = 0
        reorder_candidates = 0
        largest_foreground_pct = 0.0

        for idx, m in enumerate(raw_masks):
            mask_resized = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            pcount = int(np.sum(mask_resized > 0))
            if pcount == 0: continue
            
            area_pct = (pcount / total_pixels) * 100.0
            
            # Treat mat / tabletop plane (>25% with >25 objects) as background
            if area_pct > 25.0 and object_count > 25:
                continue
                
            if area_pct > largest_foreground_pct:
                largest_foreground_pct = area_pct
                
            # Candidate objects: 0.035% to 3.0%
            if 0.035 <= area_pct <= 3.0:
                ys, xs = np.where(mask_resized > 0)
                span_w = (np.max(xs) - np.min(xs) + 1) / w * 100.0
                span_h = (np.max(ys) - np.min(ys) + 1) / h * 100.0
                if max(span_w, span_h) <= 30.0:
                    # Check recolorable fraction
                    r_pixels = np.sum((mask_resized > 0) & (chroma >= 10.0) & (l_chan >= 25.0) & (l_chan <= 235.0))
                    r_frac = float(r_pixels) / float(pcount)
                    if r_frac >= 0.35:
                        recolor_candidates += 1
                        
                    # Check background recoverability for removal and reorder
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
                    dilated = cv2.dilate(mask_resized, kernel, iterations=1)
                    halo_mask = (dilated > 0) & (mask_resized == 0)
                    halo_std = 999.0
                    if np.sum(halo_mask) > 0:
                        halo_gray = gray[halo_mask]
                        halo_std = np.std(halo_gray)
                        if halo_std < 42.0:
                            remove_candidates += 1

                    # Reorder candidate check: loose object with recoverable background and reasonable size (0.15 - 1.2%)
                    if 0.15 <= area_pct <= 1.2 and halo_std < 42.0:
                        reorder_candidates += 1
                            
                    candidate_masks.append({
                        "idx": idx,
                        "mask": mask_resized,
                        "area_pct": area_pct,
                        "bbox": [int(np.min(xs)), int(np.min(ys)), int(np.max(xs)), int(np.max(ys))],
                        "centroid": (float(np.mean(xs)), float(np.mean(ys))),
                        "r_frac": r_frac,
                        "halo_std": float(halo_std)
                    })
                    
                    # Extract shape descriptor for clustering
                    crop = mask_resized[np.min(ys):np.max(ys)+1, np.min(xs):np.max(xs)+1]
                    resized_shape = cv2.resize(crop, (24, 24), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
                    shape_descriptors.append(resized_shape.flatten())

        if largest_foreground_pct > 26.0:
            return {
                "approved": False,
                "reason": f"Universal Gate Fail: Hero foreground object ({largest_foreground_pct:.1f}% > 26.0%)."
            }

        # 5. COMPUTE PEER GROUPS (Repeated object families)
        peer_groups = []
        n_cands = len(shape_descriptors)
        visited = set()
        
        for i in range(n_cands):
            if i in visited: continue
            group = [i]
            vec_i = shape_descriptors[i]
            norm_i = np.linalg.norm(vec_i) + 1e-6
            for j in range(i+1, n_cands):
                if j in visited: continue
                vec_j = shape_descriptors[j]
                norm_j = np.linalg.norm(vec_j) + 1e-6
                sim = np.dot(vec_i, vec_j) / (norm_i * norm_j)
                if sim >= 0.78:
                    group.append(j)
                    visited.add(j)
            if len(group) >= 2:
                peer_groups.append({
                    "size": len(group),
                    "indices": group,
                    "avg_area": float(np.mean([candidate_masks[k]["area_pct"] for k in group]))
                })

        # 6. COMPUTE OPERATION AFFORDANCE SCORES
        # Recolor Affordance: Rich colored candidates + peer groups
        recolor_score = min(1.0, (recolor_candidates / 12.0) * 0.6 + (len(peer_groups) / 3.0) * 0.4)
        
        # Remove Affordance: Clean recoverable objects + repeated peer families (can remove 1 of N)
        remove_peer_support = sum(1 for g in peer_groups if g["size"] >= 3)
        remove_score = min(1.0, (remove_candidates / 10.0) * 0.5 + (remove_peer_support / 2.0) * 0.5)
        
        # Add Affordance: Repeated peer families + empty space around them
        add_peer_support = sum(1 for g in peer_groups if g["size"] >= 2)
        add_score = min(1.0, (add_peer_support / 3.0) * 0.6 + (edge_density / 0.20) * 0.4)

        # Reorder Affordance: Loose movable objects with recoverable background + peer groups + nearby space
        reorder_peer_support = sum(1 for g in peer_groups if g["size"] >= 2)
        reorder_score = min(1.0, (reorder_candidates / 8.0) * 0.5 + (reorder_peer_support / 3.0) * 0.3 + (edge_density / 0.18) * 0.2)

        # 7. ROUTER DECISION
        scores = {
            "recolor": round(recolor_score, 2),
            "remove": round(remove_score, 2),
            "add": round(add_score, 2),
            "reorder": round(reorder_score, 2)
        }
        
        if target_mix_preference and target_mix_preference in scores and scores[target_mix_preference] >= 0.40:
            recommended_operation = target_mix_preference
        else:
            recommended_operation = max(scores, key=scores.get)

        return {
            "approved": True,
            "image_path": image_path,
            "object_count": object_count,
            "candidate_count": len(candidate_masks),
            "peer_group_count": len(peer_groups),
            "peer_groups": peer_groups,
            "candidate_masks": candidate_masks,
            "raw_masks": raw_masks,
            "affordances": scores,
            "recommended_operation": recommended_operation,
            "metrics": {
                "sharpness_uniformity": round(sharpness_uniformity, 2),
                "edge_density": round(edge_density, 3),
                "largest_foreground_pct": round(largest_foreground_pct, 1),
                "recolor_candidates": recolor_candidates,
                "remove_candidates": remove_candidates,
                "reorder_candidates": reorder_candidates
            }
        }
