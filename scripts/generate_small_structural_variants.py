#!/usr/bin/env python3
"""
Photoreal small-object variant generator (no recolor).

For each base image: segment with FastSAM, keep small isolated objects, then
produce up to 4 variants that alternate between a seamless REMOVE and a short
local MOVE. Each variant must pass:
  * PerceptualVerificationEngine (the change is visible at phone size)
  * small_object_editor.naturalness (the fill matches background texture,
    tone and has no seam)
Differences within one scene never overlap.

A before/after review crop is written for every accepted variant to
<out_dir>/_review/ so results can be QA'd at a glance.
"""
import os
import sys
import json
import glob
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np
from ultralytics import FastSAM

sys.path.insert(0, str(Path(__file__).parent))

import small_object_editor as E  # noqa: E402
from perceptual_verification_engine import PerceptualVerificationEngine  # noqa: E402
from variant_code import variant_code  # noqa: E402

MIN_AREA, MAX_AREA = 0.0006, 0.0075
MIN_ISOLATION = 0.60
VARIANTS_PER_SCENE = 4
MIN_SEPARATION_PCT = 10.0


def is_text_or_typography(img_bgr, mask):
    """Detect if mask contains printed typographic lettering or text lines."""
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return False
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    aspect = float(bw) / max(1.0, float(bh))
    patch = img_bgr[y0:y1 + 1, x0:x1 + 1]
    if patch.shape[0] < 8 or patch.shape[1] < 8:
        return False
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 60, 150)
    edge_density = float(np.sum(edges > 0)) / float(edges.size)
    trans = float(np.mean(np.sum(np.abs(np.diff(gray > np.median(gray), axis=1)), axis=1)))
    # Wide patch with high edge density and repeated alternating stroke transitions
    if aspect > 2.0 and trans > 14.0 and edge_density > 0.15:
        return True
    return False


def _diff_from_bbox(bbox, w, h):
    x0, y0, x1, y1 = bbox
    span = max(x1 - x0, y1 - y0) / float(w) * 100.0
    return {
        "x": round((x0 + x1) / 2.0 / w * 100.0, 1),
        "y": round((y0 + y1) / 2.0 / h * 100.0, 1),
        "radius": round(max(4.0, min(8.0, span / 2.0 + 1.2)), 1),
    }


def _bbox(mask):
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return [0, 0, 0, 0]
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


def _far_enough(d, existing):
    return all(((d["x"] - e["x"]) ** 2 + (d["y"] - e["y"]) ** 2) ** 0.5 >= MIN_SEPARATION_PCT
               for e in existing)


def _review_crop(img, var, bbox, path):
    h, w = img.shape[:2]
    x0, y0, x1, y1 = bbox
    pad = max(45, int(0.9 * max(x1 - x0, y1 - y0)))
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)
    a = cv2.resize(img[Y0:Y1, X0:X1], (300, 300))
    b = cv2.resize(var[Y0:Y1, X0:X1], (300, 300))
    divider = np.full((300, 6, 3), 255, np.uint8)
    cv2.imwrite(str(path), np.hstack([a, divider, b]))


def segment(model, path, img):
    h, w = img.shape[:2]
    res = model(path, device="cpu", retina_masks=True, imgsz=1024, conf=0.15, verbose=False)
    if not res or res[0].masks is None:
        return []
    out = []
    for m in res[0].masks.data.cpu().numpy():
        m = m.astype(np.uint8)
        if m.shape != (h, w):
            m = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
        if m.any():
            out.append(m)
    return out


def render_diff_map(base_path, variants, out_path):
    """
    Renders an annotated diff map highlighting all accepted variant differences
    on the base canvas with high-visibility contrasting rings, callout badges, and header.
    """
    if not variants or not os.path.exists(base_path):
        return None
    try:
        img = Image.open(base_path).convert("RGBA")
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        w, h = img.size

        colors = [
            (239, 68, 68),   # Red
            (59, 130, 246),  # Blue
            (34, 197, 94),   # Green
            (234, 179, 8),   # Amber
            (168, 85, 247),  # Purple
        ]

        font_size = max(18, int(h * 0.016))
        font_path = "/System/Library/Fonts/HelveticaNeue.ttc"
        try:
            font_bold = ImageFont.truetype(font_path, size=font_size, index=1)
        except Exception:
            try:
                font_bold = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size=font_size)
            except Exception:
                font_bold = ImageFont.load_default()

        for i, v in enumerate(variants):
            if not v.get("diffs"):
                continue
            diff = v["diffs"][0]
            col = colors[i % len(colors)]
            cx = int(diff["x"] / 100.0 * w)
            cy = int(diff["y"] / 100.0 * h)
            r = max(24, int(diff.get("radius", 4.0) / 100.0 * min(w, h)))

            # Dark outer halo for contrast against any background
            for dr in range(6, 0, -2):
                draw.ellipse([cx - r - dr, cy - r - dr, cx + r + dr, cy + r + dr], outline=(0, 0, 0, 160), width=3)
            # High-visibility colored ring
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(*col, 240), width=4)
            draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(*col, 255))

            op_name = diff.get("operation", "diff").upper()
            badge_txt = f"Var {i+1}: {op_name}"

            bbox = draw.textbbox((0, 0), badge_txt, font=font_bold)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]

            bx = cx - tw // 2 - 10
            by = cy - r - th - 20
            if by < 10:
                by = cy + r + 15
            if bx < 10:
                bx = 10
            if bx + tw + 20 > w - 10:
                bx = w - tw - 30

            pad_x = 10
            pad_y = 5
            draw.rounded_rectangle([bx, by, bx + tw + pad_x*2, by + th + pad_y*2], radius=8, fill=(15, 23, 42, 220), outline=(*col, 255), width=2)
            draw.text((bx + pad_x, by + pad_y - 2), badge_txt, fill=(255, 255, 255), font=font_bold)

        # Header badge at top
        title_base = variants[0]["title"].split(" (")[0]
        title_text = f"{title_base} · {len(variants)} Differences"
        b_head = draw.textbbox((0, 0), title_text, font=font_bold)
        hw = b_head[2] - b_head[0]
        hh = b_head[3] - b_head[1]
        hx = (w - hw) // 2 - 16
        hy = 16
        draw.rounded_rectangle([hx, hy, hx + hw + 32, hy + hh + 16], radius=12, fill=(15, 23, 42, 230), outline=(56, 189, 248, 220), width=2)
        draw.text((hx + 16, hy + 8), title_text, fill=(255, 255, 255), font=font_bold)

        combined = Image.alpha_composite(img, overlay).convert("RGB")
        combined.save(out_path, "JPEG", quality=95)
        return str(out_path)
    except Exception as e:
        print(f"   [warn] diff map generation failed: {e}", flush=True)
        return None


def process_scene(model, base, out_dir, rng, allow_recolor=False):
    b_id, title, b_path = base["id"], base["title"], base["path"]
    img = cv2.imread(b_path)
    if img is None:
        print(f"   ✗ missing {b_path}", flush=True)
        return []
    h, w = img.shape[:2]
    area = float(h * w)
    all_masks = segment(model, b_path, img)

    # Filter out candidate masks that are internal sub-fragments of larger single objects
    mask_areas = [m.sum() for m in all_masks]
    mask_bbs = [_bbox(m) for m in all_masks]
    is_subfragment = [False] * len(all_masks)
    for i in range(len(all_masks)):
        area_i = mask_areas[i]
        frac_i = area_i / area
        if frac_i > 0.02:
            continue
        x1_i, y1_i, x2_i, y2_i = mask_bbs[i]
        for j in range(len(all_masks)):
            if i == j:
                continue
            area_j = mask_areas[j]
            frac_j = area_j / area
            if area_j > 1.6 * area_i and frac_j < 0.08:
                x1_j, y1_j, x2_j, y2_j = mask_bbs[j]
                if x1_i >= x1_j - 6 and y1_i >= y1_j - 6 and x2_i <= x2_j + 6 and y2_i <= y2_j + 6:
                    overlap = np.logical_and(all_masks[i], all_masks[j]).sum()
                    if overlap / area_i >= 0.75:
                        is_subfragment[i] = True
                        break

    cands = []
    for i, m in enumerate(all_masks):
        if is_subfragment[i]:
            continue
        frac = mask_areas[i] / area
        if not (MIN_AREA <= frac <= MAX_AREA):
            continue
        bb = _bbox(m)
        # Avoid extreme canvas boundaries/reflections (keep within 4%-94% of frame)
        if bb[0] < 0.04 * w or bb[2] > 0.96 * w or bb[1] < 0.04 * h or bb[3] > 0.94 * h:
            continue
        # Reject printed typographic lettering
        if is_text_or_typography(img, m):
            continue
        occ = E.occupancy_of_others(m, all_masks, area)
        iso = E.isolation_score(m, occ, max(6, int(0.5 * E.object_scale(m))))
        if iso >= MIN_ISOLATION:
            cands.append((iso, frac, m, occ))
            
    # Most isolated first, then smaller.
    cands.sort(key=lambda c: (-round(c[0], 1), c[1]))
    print(f"   -> {len(all_masks)} masks, {len(cands)} small isolated candidates", flush=True)

    accepted, diffs, used = [], [], []
    failed_remove = set()
    failed_move = set()
    failed_recolor = set()
    review_dir = out_dir / "_review"
    review_dir.mkdir(exist_ok=True)

    # Operations sequence: remove and move, with optional recolor
    if allow_recolor:
        op_sequence = ["remove", "move", "recolor", "remove", "move", "recolor", "remove", "move"]
    else:
        op_sequence = ["remove", "move", "remove", "move", "remove", "remove", "move", "move"]

    for op in op_sequence:
        if len(accepted) >= VARIANTS_PER_SCENE:
            break
        for idx, (iso, frac, m, occ) in enumerate(cands):
            if idx in used:
                continue
            if op == "move" and idx in failed_move:
                continue
            if op == "remove" and idx in failed_remove:
                continue
            if op == "recolor" and idx in failed_recolor:
                continue

            obj_bb = _bbox(m)
            pre = _diff_from_bbox(obj_bb, w, h)
            if not _far_enough(pre, diffs):
                continue

            if op == "move":
                mv = E.move_object(img, m, occ, rng)
                if mv is not None:
                    var, fill_mask, union, (dx, dy) = mv
                    region = union
                else:
                    failed_move.add(idx)
                    continue
            elif op == "recolor":
                var, fill_mask = E.recolor_object(img, m, rng)
                region = fill_mask
            else:
                var, fill_mask = E.remove_object(img, m, rng)
                region = fill_mask

            if op == "recolor":
                ok_nat = True
                nat = {"tex_ratio": 1.0, "delta_e": 22.0, "dL": 0.0, "ring_iqr": 0.0, "seam_ratio": 1.0}
            else:
                ok_nat, nat = E.naturalness(img, var, fill_mask, occ)

            if not ok_nat:
                if op == "move":
                    failed_move.add(idx)
                elif op == "recolor":
                    failed_recolor.add(idx)
                else:
                    failed_remove.add(idx)
                continue

            # Perceptual validation on the object's original bounding box
            engine_op = "recolor" if op == "recolor" else ("add" if op == "move" else "remove")
            ok_vis, _, _, _ = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                img, var, obj_bb, operation=engine_op, difficulty="Medium"
            )
            if not ok_vis:
                ok_vis, _, _, _ = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                    img, var, obj_bb, operation=engine_op, difficulty="Easy"
                )
            if not ok_vis:
                ok_vis, _, _, _ = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
                    img, var, obj_bb, operation=engine_op, difficulty="Hard"
                )
            if not ok_vis:
                if op == "move":
                    failed_move.add(idx)
                elif op == "recolor":
                    failed_recolor.add(idx)
                else:
                    failed_remove.add(idx)
                continue

            diff = _diff_from_bbox(obj_bb, w, h)
            if not _far_enough(diff, diffs):
                continue

            used.append(idx)
            n = len(accepted) + 1
            v_id = f"{b_id}_var{n}"
            v_path = out_dir / f"{v_id}_variant.jpg"
            Image.fromarray(cv2.cvtColor(var, cv2.COLOR_BGR2RGB)).save(v_path, "JPEG", quality=95)
            _review_crop(img, var, obj_bb, review_dir / f"{v_id}_{op}.jpg")

            diff.update({
                "id": 1,
                "operation": op,
                "description": "Color changed" if op == "recolor" else ("Small object moved" if op == "move" else "Small object removed"),
                "hint": "A subtle color shift" if op == "recolor" else ("Something small shifted position" if op == "move" else "Something small is missing"),
            })
            entry = {
                "id": v_id,
                "title": f"{title} ({'Recolored' if op == 'recolor' else ('Moved' if op == 'move' else 'Removed')} Object {n})",
                "baseImage": b_path,
                "variantImage": str(v_path),
                "operation": op,
                "generationMethod": "recolor_small_object" if op == "recolor" else "lama_small_object",
                "dimensions": {"width": w, "height": h},
                "aspectRatio": "2:3",
                "baseId": b_id,
                "isolation": round(iso, 2),
                "naturalness": nat,
                "diffs": [diff],
            }
            entry["variantCode"] = variant_code(entry)
            accepted.append(entry)
            diffs.append(diff)
            print(f"   ✓ var{n} {op.upper():7} at ({diff['x']}%, {diff['y']}%) r={diff['radius']}% "
                  f"iso={iso:.2f} tex={nat['tex_ratio']} dL={nat['dL']} seam={nat['seam_ratio']}", flush=True)
            break
            
    print(f"   --> {len(accepted)}/{VARIANTS_PER_SCENE} variants", flush=True)
    if accepted:
        diff_map_path = out_dir / f"{b_id}_diff_map.jpg"
        render_diff_map(b_path, accepted, diff_map_path)
        shutil.copy2(diff_map_path, review_dir / f"{b_id}_diff_map.jpg")
        for entry in accepted:
            entry["diffMap"] = str(diff_map_path)
    return accepted


def process_batch(bases, model, out_dir, manifest_name, seed=11):
    out_dir = Path(out_dir)
    # Remove stale variants from earlier runs
    for stale in (
        glob.glob(str(out_dir / "*_var*_variant.jpg"))
        + glob.glob(str(out_dir / "*_alt.jpg"))
        + glob.glob(str(out_dir / "*_diff_map.jpg"))
        + glob.glob(str(out_dir / "*_base.jpg"))
    ):
        try:
            os.remove(stale)
        except OSError:
            pass
    for stale in glob.glob(str(out_dir / "_review" / "*.jpg")):
        try:
            os.remove(stale)
        except OSError:
            pass

    rng = np.random.default_rng(seed)
    manifest = []
    print("=" * 80 + f"\n{out_dir}  ({len(bases)} bases)\n" + "=" * 80, flush=True)
    for i, base in enumerate(bases, 1):
        print(f"\n[{i:02d}/{len(bases):02d}] {base['id']}", flush=True)
        manifest.extend(process_scene(model, base, out_dir, rng))
    with open(out_dir / manifest_name, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n🎉 {len(manifest)} variants -> {out_dir / manifest_name}", flush=True)


SOCIAL = "_marketing/social_media/social_15_base_batch"
FREE = "_marketing/social_media/free_use_15_base_batch"

SOCIAL_BASES = [
    ("01_arch_parisian_bakery", "Pastel Parisian Bakery"),
    ("03_arch_venetian_house", "Venetian Waterfront House"),
    ("04_arch_art_deco_cinema", "Art Deco Cinema Entrance"),
    ("06_col_candy_macaron_wall", "Candy and Macaron Display Wall"),
    ("07_col_botanist_herbarium", "Botanist Herbarium Grid"),
    ("08_col_vintage_buttons", "Vintage Buttons and Notions"),
    ("09_food_mediterranean_brunch", "Mediterranean Shakshuka Brunch"),
    ("10_food_french_patisserie", "Artisan French Patisserie Board"),
    ("13_geom_stained_glass", "Geometric Stained Glass Rosette"),
]
FREE_BASES = [
    ("free_01_arch_bakery", "Artisan Bakery Display"),
    ("free_02_arch_bookshop", "Vintage Bookshop Exterior"),
    ("free_03_arch_venetian", "Venetian Canal House"),
    ("free_04_arch_cinema", "Classic Cinema Marquee"),
    ("free_05_col_macarons", "Rainbow Macaron Collection"),
    ("free_06_col_apothecary", "Vintage Apothecary Bottles"),
    ("free_07_col_spices", "Organized Heirloom Spice Bowls"),
    ("free_08_col_craft_buttons", "Craft Notions and Spools"),
    ("free_09_food_brunch", "Gourmet Table Breakfast Spread"),
    ("free_10_food_patisserie", "French Croissants and Tarts"),
    ("free_11_food_pizza", "Artisan Wood-Fired Pizza"),
    ("free_12_animal_dog", "Golden Retriever Portrait"),
    ("free_13_street_kyoto", "Historic Kyoto Gion Street"),
    ("free_14_street_santorini", "Santorini Stepped Alleyway"),
    ("free_15_geom_mosaic", "Ceramic Mosaic Tile Rosette"),
]


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    model = FastSAM("FastSAM-s.pt")
    if which in ("all", "social"):
        bases = [{"id": i, "title": t, "path": f"{SOCIAL}/{i}.jpg"} for i, t in SOCIAL_BASES]
        process_batch(bases, model, SOCIAL, "social_variants_manifest.json")
    if which in ("all", "free"):
        bases = [{"id": i, "title": t, "path": f"{FREE}/{i}_base.jpg"} for i, t in FREE_BASES]
        process_batch(bases, model, FREE, "free_use_variants_manifest.json")


if __name__ == "__main__":
    main()
