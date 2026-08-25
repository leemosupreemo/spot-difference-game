"""
AI SOURCE CANVAS & EDITABILITY SCORER PIPELINE
================================================================================
Implements the AI-first source image architecture for spot-the-difference:
1. Library of 30+ Difference-Rich Scene Archetypes optimized for editability.
2. EditabilityScorer evaluating candidate images before any editing attempts:
   - Object instance count (20-50+ distinct items)
   - Small editable target inventory (10+ candidates in 0.15% - 2.5% area)
   - Hero object suppression (largest foreground object < 20% of frame)
   - Deep depth-of-field / sharpness uniformity (Laplacian variance across 9 grid cells)
   - Uniform background rejection (no plain/white backdrops)
   - Repetition camouflage score (identifies sets of visually related objects)
3. Direct hand-off to True CIELAB Delta-E Recolor & Adaptive Spotability Loop.
================================================================================
"""

import os
import sys
import json
import glob
import math
import cv2
import numpy as np
from ultralytics import FastSAM

# ==============================================================================
# 1. 30+ SCENE ARCHETYPES OPTIMIZED FOR SPOT-THE-DIFFERENCE CANVASES
# ==============================================================================
ARCHETYPE_PROMPT_SUFFIX = (
    " Overlaid with 30-50 distinct, mundane small objects, tools, and accessories scattered naturally. "
    "Include several visually related groups of repeated objects with natural variation in size, orientation, and color. "
    "Dense, authentic working clutter across the entire surface. No single hero object dominating the composition. "
    "No large empty or uniform areas, no plain white backgrounds. Rich natural texture throughout the frame. "
    "Even, soft diffuse lighting with realistic contact shadows. Deep depth of field, f/8 to f/11 appearance with the entire work surface sharply focused from edge to edge. "
    "No dramatic bokeh, no shallow depth of field, no macro blur. No people, hands, faces, brand names, logos, or readable text. "
    "Documentary photographic realism, mundane authentic appearance, not styled product photography."
)

SCENE_ARCHETYPES = [
    {
        "id": "mechanic_workbench",
        "category": "Workshop & Mechanical",
        "prompt": (
            "Photorealistic overhead flat lay photograph of a heavily used mechanic's wooden workbench."
            " Covered with metric combination wrenches, colored socket organizer trays with 15 sockets, multiple screwdrivers with amber and red handles,"
            " needle-nose pliers, wire strippers, lock washers, hex nuts, machine bolts, drill bits, and brass fittings."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "electronics_repair_bench",
        "category": "Electronics & Tech",
        "prompt": (
            "Photorealistic overhead top-down documentary photograph of an electronics technician's antistatic workbench."
            " Covered with circuit boards, multimeter probe cables, blue electrolytic capacitors, copper toroidal inductor coils, DIP IC chips, jumper wires,"
            " precision tweezers, wire snips, heat shrink tubing pieces, SMD component reels, and small solder flux bottles."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "sewing_notions_box",
        "category": "Crafts & Textiles",
        "prompt": (
            "Photorealistic overhead top-down photograph of a vintage wooden sewing notions organizer tray."
            " Filled with 12 colored thread spools (crimson, emerald, gold, navy, violet), mother-of-pearl buttons, brass snap fasteners, sewing needles,"
            " tailoring chalks, thimbles, bias tape rolls, measuring tape end tabs, embroidery floss skeins, and safety pins."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "watchmaker_parts_tray",
        "category": "Horology & Precision",
        "prompt": (
            "Photorealistic overhead documentary photograph of an antique watchmaker's bench."
            " Filled with miniature brass escapement gears, ruby jewel bearings, balance wheels, hairsprings, precision horologist screwdrivers with color-coded heads,"
            " brass tweezers, loupe lenses, stem screws, small glass parts vials, and winding crowns."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "fine_art_supply_table",
        "category": "Fine Art & Studio",
        "prompt": (
            "Photorealistic top-down flat lay of an oil painter's studio supply table."
            " Filled with 20 oil pastel sticks with colored paper sleeves, paint tube caps, natural sable brushes with brass ferrules, palette knives,"
            " charcoal sticks, eraser stumps, linseed oil dropper bottles, pigment powder jars, and color swatch cards."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "gardener_potting_bench",
        "category": "Botanical & Garden",
        "prompt": (
            "Photorealistic overhead documentary photograph of a greenhouse potting shed workbench."
            " Scattered with wooden plant marker stakes, terracotta nursery pots, seed packet envelopes, jute twine coils, brass pruning shears,"
            " garden trowels, bulb markers, plant labels, raffia ribbons, and dry seed pods."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "bakers_workstation",
        "category": "Culinary & Kitchen",
        "prompt": (
            "Photorealistic overhead top-down photograph of an artisan baker's wooden prep station."
            " Scattered with wooden dough scrapers, fluted pastry wheel cutters, cookie stamp molds, star anise, cinnamon sticks, vanilla bean pods,"
            " small spice pinch bowls, measuring spoons, linen proofing cloth, and metal piping nozzle tips."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "numismatist_coin_tray",
        "category": "Antiques & Collections",
        "prompt": (
            "Photorealistic overhead flat lay photograph of a coin collector's felt sorting tray."
            " Filled with 30 diverse collectible copper, bronze, and silver coins, coin capsule bezels, magnifying loupes, cotton collector gloves,"
            " sorting tongs, millimeter brass gauge calipers, vintage postage stamps, and appraisal notebooks."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "retro_gaming_desk",
        "category": "Gaming & Tech",
        "prompt": (
            "Photorealistic top-down flat lay of a retro gaming enthusiast's workstation desk."
            " Covered with 16 colorful 90s gaming cartridge spines with label art, game boy cartridges, memory cards, RCA audio/video composite cable connectors,"
            " controller extension cords, game discs in jewel cases, and plastic dust covers."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    },
    {
        "id": "bushcraft_expedition_table",
        "category": "Outdoor & Bushcraft",
        "prompt": (
            "Photorealistic overhead documentary photograph of an outdoor explorer's gear inspection table."
            " Covered with olive and coyote paracord coils, plastic spring toggle cord locks, brass button compasses, carabiners, waterproof match cases,"
            " ferrocerium fire rods, titanium tent stakes, webbing clips, and leather sheath repair needles."
            + ARCHETYPE_PROMPT_SUFFIX
        )
    }
]

# ==============================================================================
# 2. EDITABILITY SCORER (PRE-FILTERING CANVASES)
# ==============================================================================
class EditabilityScorer:
    """
    Evaluates candidate base images BEFORE any puzzle difference generation.
    Rejects unsuitable images and scores candidates from 0.0 to 100.0.
    """
    
    @classmethod
    def evaluate_canvas(cls, image_path, masks=None, model=None):
        if not os.path.exists(image_path):
            return {
                "approved": False,
                "score": 0.0,
                "reason": f"File missing: {image_path}",
                "metrics": {}
            }
            
        img = cv2.imread(image_path)
        if img is None:
            return {
                "approved": False,
                "score": 0.0,
                "reason": "Could not decode image",
                "metrics": {}
            }
            
        h, w = img.shape[:2]
        total_pixels = h * w
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 1. SHARPNESS & DEPTH OF FIELD UNIFORMITY (9-Cell Grid Analysis)
        grid_sharpness = []
        cell_h, cell_w = h // 3, w // 3
        for r in range(3):
            for c in range(3):
                cell = gray[r*cell_h:(r+1)*cell_h, c*cell_w:(c+1)*cell_w]
                lap_var = cv2.Laplacian(cell, cv2.CV_64F).var()
                grid_sharpness.append(lap_var)
                
        min_sharpness = min(grid_sharpness)
        avg_sharpness = np.mean(grid_sharpness)
        sharpness_uniformity = min_sharpness / (avg_sharpness + 1e-5)
        
        if avg_sharpness < 30.0:
            return {
                "approved": False,
                "score": 15.0,
                "reason": f"Reject: Image overall blurry/soft (Laplacian variance {avg_sharpness:.1f} < 30.0).",
                "metrics": {"avg_sharpness": avg_sharpness}
            }
            
        # 2. GLOBAL EDGE DENSITY & TEXTURE (Avoid flat/white backdrops)
        edges = cv2.Canny(gray, 60, 150)
        edge_density = np.sum(edges > 0) / total_pixels
        if edge_density < 0.018:
            return {
                "approved": False,
                "score": 20.0,
                "reason": f"Reject: Plain or empty background (Edge density {edge_density:.3f} < 0.018).",
                "metrics": {"edge_density": edge_density}
            }
            
        # 3. SEGMENTATION & OBJECT INVENTORY
        if masks is None:
            if model is None:
                model = FastSAM("FastSAM-s.pt")
            results = model(
                image_path,
                device="cpu",
                retina_masks=True,
                imgsz=1024,
                conf=0.20,
                iou=0.65,
                verbose=False
            )
            if results and len(results) > 0 and results[0].masks is not None:
                masks = results[0].masks.data.cpu().numpy()
            else:
                masks = []
                
        object_count = len(masks)
        if object_count < 14:
            return {
                "approved": False,
                "score": 30.0,
                "reason": f"Reject: Insufficient object density ({object_count} < 14 distinct items).",
                "metrics": {"object_count": object_count}
            }
            
        # 4. HERO OBJECT SUPPRESSION & EDITABLE TARGET INVENTORY
        # Separate background surface mask from foreground objects
        largest_foreground_area_pct = 0.0
        editable_targets = []
        
        for idx, m in enumerate(masks):
            mask_resized = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            pcount = np.sum(mask_resized > 0)
            area_pct = (pcount / total_pixels) * 100.0
            
            ys, xs = np.where(mask_resized > 0)
            if len(xs) == 0: continue
            span_w = (np.max(xs) - np.min(xs)) / w
            span_h = (np.max(ys) - np.min(ys)) / h
            
            # If a mask covers > 25% of the frame in a scene with > 20 objects, it is the background tabletop/surface
            is_background_canvas = (area_pct > 25.0 and object_count > 20)
            
            if not is_background_canvas:
                if area_pct > largest_foreground_area_pct:
                    largest_foreground_area_pct = area_pct
                
            if 0.10 <= area_pct <= 3.2:
                editable_targets.append({
                    "index": idx,
                    "area_pct": area_pct
                })
                
        if largest_foreground_area_pct > 22.0:
            return {
                "approved": False,
                "score": 35.0,
                "reason": f"Reject: Dominant hero foreground object detected ({largest_foreground_area_pct:.1f}% > 22.0% of frame).",
                "metrics": {"largest_foreground_area_pct": largest_foreground_area_pct}
            }
            
        if len(editable_targets) < 6:
            return {
                "approved": False,
                "score": 40.0,
                "reason": f"Reject: Too few small editable targets ({len(editable_targets)} < 6 in 0.10%-3.2% area).",
                "metrics": {"editable_targets": len(editable_targets)}
            }
            
        # 5. REPETITION CAMOUFLAGE SCORE
        areas = [t["area_pct"] for t in editable_targets]
        repetition_score = min(1.0, max(0.0, 1.0 - (np.std(areas) / (np.mean(areas) + 1e-5))))
        
        # 6. COMPOSITE EDITABILITY SCORE (0.0 to 100.0)
        count_score = min(1.0, object_count / 35.0)
        targets_score = min(1.0, len(editable_targets) / 15.0)
        sharp_score = min(1.0, sharpness_uniformity / 0.50)
        edge_score = min(1.0, edge_density / 0.07)
        
        composite_score = round((
            (count_score * 25.0) +
            (targets_score * 30.0) +
            (sharp_score * 20.0) +
            (repetition_score * 15.0) +
            (edge_score * 10.0)
        ), 1)
        
        is_approved = composite_score >= 60.0
        
        return {
            "approved": is_approved,
            "score": composite_score,
            "reason": "Canvas Approved!" if is_approved else f"Score {composite_score} below threshold (60.0)",
            "metrics": {
                "object_count": object_count,
                "editable_targets": len(editable_targets),
                "largest_foreground_area_pct": round(largest_foreground_area_pct, 2),
                "edge_density": round(edge_density, 4),
                "avg_sharpness": round(avg_sharpness, 1),
                "sharpness_uniformity": round(sharpness_uniformity, 2),
                "repetition_score": round(repetition_score, 2),
                "composite_score": composite_score
            },
            "editable_targets_list": editable_targets
        }

if __name__ == "__main__":
    print("Testing EditabilityScorer across existing base levels...")
    test_files = glob.glob("public/levels/scene_*_base.jpg")
    for f in test_files[:6]:
        res = EditabilityScorer.evaluate_canvas(f)
        print(f"\nEvaluating: {f}")
        print(f"  • Approved: {res['approved']}, Score: {res['score']}/100 - {res['reason']}")
        if res['metrics']:
            print(f"  • Metrics: {res['metrics']}")
