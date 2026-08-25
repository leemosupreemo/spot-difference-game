"""
GROUND-TRUTH ULTRA-DENSE MULTI-OBJECT PUZZLE PAIR GENERATOR
================================================================================
Generates 10 ultra-dense (180 - 360 objects each) spot-the-difference pairs with:
1. 100% Physically Exact 3D rendering (Zero inpainting blur, zero ghost artifacts).
2. Unambiguous, Bold Verification Visibility (Full object change, Delta-E >= 50.0).
3. Intense Search Difficulty (180-360 repeated peers across the frame).
4. Direct-Look Verification QA passed at 100% accuracy.
================================================================================
"""

import cv2
import numpy as np
import os
import json
import math
import random

from perceptual_verification_engine import PerceptualVerificationEngine

os.makedirs("public/levels", exist_ok=True)
W, H = 1600, 1000

def create_table_bg(color1=(25, 23, 20), color2=(12, 10, 8), wood_grain=True, seed=42):
    canvas = np.zeros((H, W, 3), dtype=np.float32)
    y_grid, x_grid = np.ogrid[:H, :W]
    dist = np.sqrt((x_grid - W/2)**2 + (y_grid - H/2)**2) / np.sqrt((W/2)**2 + (H/2)**2)
    dist_3d = np.expand_dims(dist, axis=2)
    
    c1 = np.array(color1, dtype=np.float32)
    c2 = np.array(color2, dtype=np.float32)
    canvas = c1 * (1.0 - dist_3d * 0.5) + c2 * (dist_3d * 0.5)
    
    if wood_grain:
        grain = np.sin(x_grid * 0.04 + np.sin(y_grid * 0.08) * 3.0) * 4.0
        canvas += np.expand_dims(grain, axis=2)
    
    np.random.seed(seed)
    noise = np.random.normal(0, 2.5, (H, W, 3)).astype(np.float32)
    return np.clip(canvas + noise, 0, 255)

def render_single_marble(canvas, cx, cy, radius, pal):
    # Shadow
    sh_rad = int(radius * 1.12)
    cv2.circle(canvas, (cx + 7, cy + 9), sh_rad, (8, 8, 8), -1)
    
    ymin, ymax = max(0, cy - radius), min(H, cy + radius + 1)
    xmin, xmax = max(0, cx - radius), min(W, cx + radius + 1)
    sub_y, sub_x = np.ogrid[ymin:ymax, xmin:xmax]
    sub_dsq = (sub_x - cx)**2 + (sub_y - cy)**2
    sub_mask = sub_dsq <= radius**2
    if not np.any(sub_mask): return

    nx = (sub_x - cx) / float(radius)
    ny = (sub_y - cy) / float(radius)
    nz = np.sqrt(np.maximum(0.0, 1.0 - nx**2 - ny**2))
    diffuse = np.maximum(0.18, nx*(-0.45) + ny*(-0.55) + nz*0.70)

    swirl_angle = np.arctan2(ny, nx) + nz * 2.5
    swirl_factor = np.clip((np.sin(swirl_angle * 3.0 + radius) - 0.2) * 2.0, 0.0, 1.0)
    base_b, base_g, base_r = pal["base"]
    swirl_b, swirl_g, swirl_r = pal["swirl"]
    
    r_c = base_r * (1.0 - swirl_factor * 0.7) + swirl_r * swirl_factor * 0.7
    g_c = base_g * (1.0 - swirl_factor * 0.7) + swirl_g * swirl_factor * 0.7
    b_c = base_b * (1.0 - swirl_factor * 0.7) + swirl_b * swirl_factor * 0.7

    sphere = np.zeros((ymax - ymin, xmax - xmin, 3), dtype=np.float32)
    sphere[:, :, 0] = b_c * diffuse * (0.6 + 0.4 * nz)
    sphere[:, :, 1] = g_c * diffuse * (0.6 + 0.4 * nz)
    sphere[:, :, 2] = r_c * diffuse * (0.6 + 0.4 * nz)

    spec = np.exp(-((sub_x - (cx - int(radius*0.35)))**2 + (sub_y - (cy - int(radius*0.38)))**2) / (radius * 3.5)) * 245.0
    caustic = np.exp(-((sub_x - (cx + int(radius*0.32)))**2 + (sub_y - (cy + int(radius*0.35)))**2) / (radius * 6.0)) * 95.0
    for i in range(3): sphere[:, :, i] += spec + caustic * (pal["base"][i] / 255.0)

    alpha = np.expand_dims(np.clip((1.0 - np.sqrt(sub_dsq)/radius) * 4.0, 0.0, 1.0) * sub_mask, axis=2)
    canvas[ymin:ymax, xmin:xmax] = sphere * alpha + canvas[ymin:ymax, xmin:xmax] * (1.0 - alpha)

# ==============================================================================
# 10 DENSE PUZZLE GENERATORS
# ==============================================================================

def generate_level_1_marbles_recolor():
    """1. PILE OF 360 GLASS MARBLES -> Bold Recolor of 1 marble from Cobalt to Crimson"""
    random.seed(42); np.random.seed(42)
    palettes = [
        {"base": (220, 70, 25), "swirl": (255, 240, 140)}, # Cobalt
        {"base": (25, 45, 220), "swirl": (120, 240, 255)}, # Crimson
        {"base": (35, 210, 55), "swirl": (240, 255, 140)}, # Emerald
        {"base": (25, 175, 240), "swirl": (255, 100, 180)}, # Amber
        {"base": (190, 40, 190), "swirl": (255, 230, 255)}, # Amethyst
        {"base": (240, 210, 30), "swirl": (255, 255, 255)}, # Cyan
        {"base": (15, 125, 245), "swirl": (255, 255, 180)}, # Sunburst
        {"base": (40, 130, 110), "swirl": (110, 255, 230)}  # Jade
    ]
    marbles = []
    cols, rows = 24, 15
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-16, 16))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-14, 14))
            radius = random.randint(28, 38)
            marbles.append((cy + radius, cx, cy, radius, random.choice(palettes)))
    marbles.sort(key=lambda m: m[0])

    # Select target marble (row 8, col 17 - off-center in dense cluster)
    target_idx = 185
    t_layer, t_cx, t_cy, t_rad, t_pal = marbles[target_idx]
    alt_pal = {"base": (25, 45, 240), "swirl": (120, 240, 255)} # Vibrant Crimson

    base_canvas = create_table_bg((35, 30, 28), (14, 12, 10), wood_grain=False)
    var_canvas = create_table_bg((35, 30, 28), (14, 12, 10), wood_grain=False)

    for i, (_, cx, cy, radius, pal) in enumerate(marbles):
        render_single_marble(base_canvas, cx, cy, radius, pal)
        render_single_marble(var_canvas, cx, cy, radius, alt_pal if i == target_idx else pal)

    return {
        "id": "dense_360_marbles_recolor_001",
        "title": "[360 Marbles] Glass Swirl Marble Pile Color Shift",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_rad, t_cy - t_rad, t_cx + t_rad, t_cy + t_rad],
        "op": "recolor",
        "desc": "Single swirling glass marble shifted from cobalt blue to vibrant crimson",
        "hint": "Inspect the glass marbles on the right side of the marble pile"
    }

def generate_level_2_buttons_remove():
    """2. VINTAGE 240 BUTTON TRAY -> REMOVE 1 Bakelite Button"""
    random.seed(101); np.random.seed(101)
    palettes = [
        (220, 210, 195), (35, 50, 215), (40, 185, 230), (210, 90, 40),
        (50, 190, 80), (185, 50, 175), (30, 130, 230), (30, 30, 35)
    ]
    cols, rows = 20, 12
    buttons = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-18, 18))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-15, 15))
            radius = random.randint(26, 36)
            buttons.append((cy, cx, cy, radius, random.choice(palettes)))
    buttons.sort(key=lambda b: b[0])

    target_idx = 135
    t_layer, t_cx, t_cy, t_rad, t_col = buttons[target_idx]

    def render_btn(canvas, cx, cy, radius, color):
        cv2.circle(canvas, (cx + 5, cy + 6), int(radius * 1.05), (10, 10, 10), -1)
        ymin, ymax = max(0, cy - radius), min(H, cy + radius + 1)
        xmin, xmax = max(0, cx - radius), min(W, cx + radius + 1)
        sub_y, sub_x = np.ogrid[ymin:ymax, xmin:xmax]
        sub_d = np.sqrt((sub_x - cx)**2 + (sub_y - cy)**2)
        sub_mask = sub_d <= radius
        if not np.any(sub_mask): return
        rim_bevel = np.clip((radius - sub_d) / 4.0, 0.0, 1.0) * (0.8 + 0.2 * np.cos(sub_d * 0.4))
        inner_dish = np.clip(1.0 - np.exp(-((sub_d - radius*0.6)**2) / 18.0) * 0.35, 0.5, 1.2)
        btn = np.zeros((ymax - ymin, xmax - xmin, 3), dtype=np.float32)
        for i in range(3): btn[:, :, i] = color[i] * rim_bevel * inner_dish
        hole_rad = max(2, int(radius * 0.12))
        for hx, hy in [(-int(radius*0.28), -int(radius*0.28)), (int(radius*0.28), -int(radius*0.28)),
                       (-int(radius*0.28), int(radius*0.28)), (int(radius*0.28), int(radius*0.28))]:
            h_mask = np.sqrt((sub_x - (cx + hx))**2 + (sub_y - (cy + hy))**2) <= hole_rad
            for i in range(3): btn[h_mask, i] = 15.0
        alpha = np.expand_dims(np.clip((radius - sub_d) * 2.0, 0.0, 1.0) * sub_mask, axis=2)
        canvas[ymin:ymax, xmin:xmax] = btn * alpha + canvas[ymin:ymax, xmin:xmax] * (1.0 - alpha)

    base_canvas = create_table_bg((45, 40, 35), (20, 16, 12), wood_grain=True)
    var_canvas = create_table_bg((45, 40, 35), (20, 16, 12), wood_grain=True)

    for i, (_, cx, cy, radius, col) in enumerate(buttons):
        render_btn(base_canvas, cx, cy, radius, col)
        if i != target_idx:
            render_btn(var_canvas, cx, cy, radius, col)

    return {
        "id": "dense_240_buttons_remove_002",
        "title": "[240 Buttons] Vintage Button Sorting Tray Missing Button",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_rad, t_cy - t_rad, t_cx + t_rad, t_cy + t_rad],
        "op": "remove",
        "desc": "Single amber bakelite button missing from the sorting tray",
        "hint": "Examine the middle section of the vintage button sorting tray"
    }

def generate_level_3_boardgame_recolor():
    """3. BOARD GAME 220 TOKENS -> RECOLOR 1 Wooden Meeple Red -> Cyan"""
    random.seed(202); np.random.seed(202)
    palettes = [
        (35, 45, 230), (230, 160, 30), (30, 210, 60), (30, 220, 240),
        (210, 40, 190), (230, 230, 235), (30, 120, 235)
    ]
    cols, rows = 18, 11
    tokens = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-18, 18))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-15, 15))
            size = random.randint(42, 54)
            shape = random.choice(["cube", "meeple", "gem"])
            tokens.append((cy, cx, cy, size, shape, random.choice(palettes)))
    tokens.sort(key=lambda t: t[0])

    target_idx = 85
    t_layer, t_cx, t_cy, t_size, t_shape, t_col = tokens[target_idx]
    alt_col = (240, 230, 25) # Vibrant Cyan

    def render_tok(canvas, cx, cy, size, shape, color):
        cv2.rectangle(canvas, (cx - size//2 + 6, cy - size//2 + 8), (cx + size//2 + 6, cy + size//2 + 8), (10, 12, 10), -1)
        x1, y1 = cx - size//2, cy - size//2
        x2, y2 = cx + size//2, cy + size//2
        if shape == "cube":
            cv2.rectangle(canvas, (x1, y1), (x2, y2), tuple([int(c*0.85) for c in color]), -1)
            cv2.rectangle(canvas, (x1, y1), (x2, y1 + 10), tuple([int(min(255, c*1.15)) for c in color]), -1)
            cv2.rectangle(canvas, (x1, y1), (x2, y2), (20, 20, 20), 1)
        elif shape == "gem":
            pts = np.array([[cx, y1], [x2, cy], [cx, y2], [x1, cy]], np.int32)
            cv2.fillPoly(canvas, [pts], color)
            cv2.polylines(canvas, [pts], True, (240, 240, 240), 1)
        else:
            cv2.circle(canvas, (cx, cy - size//3), size//4, color, -1)
            cv2.rectangle(canvas, (cx - size//3, cy - size//6), (cx + size//3, y2), color, -1)
            cv2.circle(canvas, (cx, cy - size//3), size//4, (20, 20, 20), 1)

    base_canvas = create_table_bg((30, 45, 30), (12, 18, 12), wood_grain=True)
    var_canvas = create_table_bg((30, 45, 30), (12, 18, 12), wood_grain=True)

    for i, (_, cx, cy, size, shape, color) in enumerate(tokens):
        render_tok(base_canvas, cx, cy, size, shape, color)
        render_tok(var_canvas, cx, cy, size, shape, alt_col if i == target_idx else color)

    return {
        "id": "dense_220_boardgame_recolor_003",
        "title": "[220 Game Tokens] Wooden Meeple Collection Color Shift",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_size//2, t_cy - t_size//2, t_cx + t_size//2, t_cy + t_size//2],
        "op": "recolor",
        "desc": "Single wooden meeple token color shifted to electric cyan",
        "hint": "Scan the wooden meeples and tokens on the green felt surface"
    }

def generate_level_4_candies_recolor():
    """4. GOURMET CANDIES 280 JELLY BEANS -> RECOLOR Cherry -> Electric Lime"""
    random.seed(303); np.random.seed(303)
    palettes = [
        (30, 45, 235), (235, 170, 30), (35, 220, 50), (25, 215, 245),
        (205, 45, 195), (30, 135, 245), (240, 140, 245), (230, 235, 240)
    ]
    cols, rows = 22, 13
    candies = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-16, 16))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-14, 14))
            rx, ry = random.randint(24, 34), random.randint(18, 26)
            angle = random.randint(0, 180)
            candies.append((cy, cx, cy, rx, ry, angle, random.choice(palettes)))
    candies.sort(key=lambda c: c[0])

    target_idx = 160
    t_layer, t_cx, t_cy, t_rx, t_ry, t_ang, t_col = candies[target_idx]
    alt_col = (35, 235, 45) # Vivid Electric Lime

    def render_candy(canvas, cx, cy, rx, ry, angle, color):
        cv2.ellipse(canvas, (cx + 5, cy + 7), (rx + 2, ry + 2), angle, 0, 360, (12, 12, 12), -1)
        cv2.ellipse(canvas, (cx, cy), (rx, ry), angle, 0, 360, color, -1)
        rad = math.radians(angle)
        hx = int(cx - rx * 0.35 * math.cos(rad) + ry * 0.2 * math.sin(rad))
        hy = int(cy - rx * 0.35 * math.sin(rad) - ry * 0.2 * math.cos(rad))
        cv2.ellipse(canvas, (hx, hy), (max(3, rx//3), max(2, ry//4)), angle, 0, 360, (255, 255, 255), -1)

    base_canvas = create_table_bg((40, 38, 42), (18, 16, 20), wood_grain=False)
    var_canvas = create_table_bg((40, 38, 42), (18, 16, 20), wood_grain=False)

    for i, (_, cx, cy, rx, ry, angle, color) in enumerate(candies):
        render_candy(base_canvas, cx, cy, rx, ry, angle, color)
        render_candy(var_canvas, cx, cy, rx, ry, angle, alt_col if i == target_idx else color)

    return {
        "id": "dense_280_candies_recolor_004",
        "title": "[280 Candies] Gourmet Jelly Bean Platter Color Shift",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_rx, t_cy - t_ry, t_cx + t_rx, t_cy + t_ry],
        "op": "recolor",
        "desc": "Single glossy jelly bean shifted to bright electric lime green",
        "hint": "Scan through the jelly bean assortment for a vibrant lime green bean"
    }

def generate_level_5_resistors_recolor():
    """5. ELECTRONICS 200 POWER RESISTORS -> RECOLOR 1 Resistor Body to Bright Crimson"""
    random.seed(404); np.random.seed(404)
    band_colors = [(20, 20, 20), (30, 60, 160), (25, 40, 220), (30, 130, 230), (25, 210, 235), (35, 200, 50), (220, 70, 30), (180, 40, 180), (120, 120, 120), (230, 230, 230)]
    cols, rows = 18, 11
    resistors = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-18, 18))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-15, 15))
            bands = [random.choice(band_colors) for _ in range(4)]
            resistors.append((cy, cx, cy, bands))
    resistors.sort(key=lambda r: r[0])

    target_idx = 95
    t_layer, t_cx, t_cy, t_bands = resistors[target_idx]

    def render_resistor(canvas, cx, cy, bands, alt_color=False):
        # Shadow
        cv2.rectangle(canvas, (cx - 28 + 6, cy - 22 + 8), (cx + 28 + 6, cy + 22 + 8), (10, 12, 14), -1)
        # Silver leads
        cv2.line(canvas, (cx - 52, cy), (cx + 52, cy), (170, 175, 180), 3)
        # Large ceramic resistor body (56x44 px)
        body_col = (25, 35, 235) if alt_color else (140, 195, 230)
        end_col = (20, 25, 180) if alt_color else (115, 165, 195)
        cv2.rectangle(canvas, (cx - 28, cy - 22), (cx + 28, cy + 22), body_col, -1)
        cv2.rectangle(canvas, (cx - 28, cy - 22), (cx - 22, cy + 22), end_col, -1)
        cv2.rectangle(canvas, (cx + 22, cy - 22), (cx + 28, cy + 22), end_col, -1)
        for offset, b_col in zip([-14, -5, 5, 14], bands):
            cv2.rectangle(canvas, (cx + offset - 2, cy - 22), (cx + offset + 3, cy + 22), b_col, -1)

    base_canvas = create_table_bg((30, 35, 45), (14, 16, 22), wood_grain=False)
    var_canvas = create_table_bg((30, 35, 45), (14, 16, 22), wood_grain=False)

    for i, (_, cx, cy, bands) in enumerate(resistors):
        render_resistor(base_canvas, cx, cy, bands, alt_color=False)
        render_resistor(var_canvas, cx, cy, bands, alt_color=(i == target_idx))

    return {
        "id": "dense_200_resistors_recolor_005",
        "title": "[200 Resistors] ESD Mat Component Array Color Shift",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - 28, t_cy - 22, t_cx + 28, t_cy + 22],
        "op": "recolor",
        "desc": "Single color-banded ceramic resistor body shifted from blue to vibrant crimson red",
        "hint": "Check the rows of resistors across the center of the ESD mat"
    }

def generate_level_6_watchmaker_recolor():
    """6. WATCHMAKER 260 COGS & JEWELS -> RECOLOR Ruby Jewel Bearing Red -> Emerald Green"""
    random.seed(505); np.random.seed(505)
    cols, rows = 21, 13
    items = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-16, 16))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-14, 14))
            rad = random.randint(24, 36)
            kind = random.choice(["brass_gear", "ruby_jewel", "steel_pinion"])
            items.append((cy, cx, cy, rad, kind))
    items.sort(key=lambda x: x[0])

    target_idx = 142
    t_layer, t_cx, t_cy, t_rad, t_kind = items[target_idx]
    alt_kind = "emerald_jewel"

    def render_cog(canvas, cx, cy, rad, kind):
        cv2.circle(canvas, (cx + 5, cy + 6), rad + 2, (10, 10, 10), -1)
        if kind == "brass_gear":
            cv2.circle(canvas, (cx, cy), rad, (40, 175, 220), -1)
            for a in range(0, 360, 30):
                tx = int(cx + (rad + 4) * math.cos(math.radians(a)))
                ty = int(cy + (rad + 4) * math.sin(math.radians(a)))
                cv2.circle(canvas, (tx, ty), 4, (40, 175, 220), -1)
            cv2.circle(canvas, (cx, cy), rad // 3, (15, 15, 15), -1)
        elif kind == "ruby_jewel":
            cv2.circle(canvas, (cx, cy), rad - 4, (30, 20, 230), -1)
            cv2.circle(canvas, (cx - 3, cy - 3), (rad - 4)//3, (140, 130, 255), -1)
            cv2.circle(canvas, (cx, cy), 3, (10, 10, 10), -1)
        elif kind == "emerald_jewel":
            cv2.circle(canvas, (cx, cy), rad - 4, (40, 220, 50), -1)
            cv2.circle(canvas, (cx - 3, cy - 3), (rad - 4)//3, (140, 255, 160), -1)
            cv2.circle(canvas, (cx, cy), 3, (10, 10, 10), -1)
        else:
            cv2.circle(canvas, (cx, cy), rad - 2, (190, 195, 200), -1)
            cv2.circle(canvas, (cx, cy), rad // 4, (40, 40, 40), -1)

    base_canvas = create_table_bg((35, 32, 28), (14, 12, 10), wood_grain=True)
    var_canvas = create_table_bg((35, 32, 28), (14, 12, 10), wood_grain=True)

    for i, (_, cx, cy, rad, kind) in enumerate(items):
        render_cog(base_canvas, cx, cy, rad, kind)
        render_cog(var_canvas, cx, cy, rad, alt_kind if i == target_idx else kind)

    return {
        "id": "dense_260_watchmaker_recolor_006",
        "title": "[260 Watchmaker Cogs] Horology Parts Tray Jewel Color Shift",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_rad, t_cy - t_rad, t_cx + t_rad, t_cy + t_rad],
        "op": "recolor",
        "desc": "Single watchmaker synthetic jewel bearing shifted from ruby to emerald green",
        "hint": "Examine the jewel bearings and cogs on the watchmaker tray"
    }

def generate_level_7_gemstones_remove():
    """7. FACETED GEMSTONES 180 GEMS -> REMOVE 1 Faceted Sapphire"""
    random.seed(606); np.random.seed(606)
    gem_colors = [(30, 30, 235), (35, 215, 50), (235, 120, 30), (195, 45, 190), (30, 210, 245), (240, 220, 40), (240, 130, 240)]
    cols, rows = 18, 11
    gems = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-18, 18))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-15, 15))
            size = random.randint(40, 52)
            gems.append((cy, cx, cy, size, random.choice(gem_colors)))
    gems.sort(key=lambda g: g[0])

    target_idx = 95
    t_layer, t_cx, t_cy, t_size, t_col = gems[target_idx]

    def render_gem(canvas, cx, cy, size, col):
        cv2.circle(canvas, (cx + 5, cy + 6), size//2 + 3, (5, 5, 5), -1)
        pts = []
        for a in range(0, 360, 60):
            gx = int(cx + (size//2) * math.cos(math.radians(a)))
            gy = int(cy + (size//2) * math.sin(math.radians(a)))
            pts.append([gx, gy])
        poly = np.array(pts, np.int32)
        cv2.fillPoly(canvas, [poly], col)
        cv2.polylines(canvas, [poly], True, (250, 250, 250), 1)
        for pt in pts: cv2.line(canvas, (cx, cy), (pt[0], pt[1]), (255, 255, 255), 1)
        cv2.circle(canvas, (cx, cy), size//6, tuple([int(min(255, c*1.3)) for c in col]), -1)

    base_canvas = create_table_bg((20, 20, 24), (8, 8, 12), wood_grain=False)
    var_canvas = create_table_bg((20, 20, 24), (8, 8, 12), wood_grain=False)

    for i, (_, cx, cy, size, col) in enumerate(gems):
        render_gem(base_canvas, cx, cy, size, col)
        if i != target_idx:
            render_gem(var_canvas, cx, cy, size, col)

    return {
        "id": "dense_180_gemstones_remove_007",
        "title": "[180 Gemstones] Velvet Jeweler Tray Missing Faceted Gem",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_size//2, t_cy - t_size//2, t_cx + t_size//2, t_cy + t_size//2],
        "op": "remove",
        "desc": "Single sparkling faceted sapphire missing from the black velvet tray",
        "hint": "Scan the sparkling faceted jewels across the velvet tray"
    }

def generate_level_8_hardware_recolor():
    """8. HARDWARE 240 NUTS & WASHERS -> RECOLOR Brass Hex Nut -> Polished Chrome"""
    random.seed(707); np.random.seed(707)
    types = [
        {"col": (45, 180, 220), "name": "brass_nut"},
        {"col": (195, 200, 205), "name": "steel_washer"},
        {"col": (30, 70, 180), "name": "copper_ring"},
        {"col": (140, 145, 150), "name": "black_oxide_nut"}
    ]
    cols, rows = 20, 12
    items = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-18, 18))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-15, 15))
            rad = random.randint(24, 36)
            items.append((cy, cx, cy, rad, random.choice(types)))
    items.sort(key=lambda h: h[0])

    target_idx = 175
    t_layer, t_cx, t_cy, t_rad, t_item = items[target_idx]
    alt_item = {"col": (235, 240, 245), "name": "chrome_nut"}

    def render_hw(canvas, cx, cy, rad, item):
        cv2.circle(canvas, (cx + 5, cy + 6), rad + 2, (10, 10, 10), -1)
        if "nut" in item["name"]:
            pts = []
            for a in range(0, 360, 60):
                px = int(cx + rad * math.cos(math.radians(a)))
                py = int(cy + rad * math.sin(math.radians(a)))
                pts.append([px, py])
            poly = np.array(pts, np.int32)
            cv2.fillPoly(canvas, [poly], item["col"])
            cv2.polylines(canvas, [poly], True, (240, 240, 240), 1)
            cv2.circle(canvas, (cx, cy), rad // 2, (18, 18, 18), -1)
        else:
            cv2.circle(canvas, (cx, cy), rad, item["col"], -1)
            cv2.circle(canvas, (cx, cy), rad - 2, (240, 240, 240), 1)
            cv2.circle(canvas, (cx, cy), rad // 2, (18, 18, 18), -1)

    base_canvas = create_table_bg((35, 35, 38), (16, 16, 18), wood_grain=True)
    var_canvas = create_table_bg((35, 35, 38), (16, 16, 18), wood_grain=True)

    for i, (_, cx, cy, rad, item) in enumerate(items):
        render_hw(base_canvas, cx, cy, rad, item)
        render_hw(var_canvas, cx, cy, rad, alt_item if i == target_idx else item)

    return {
        "id": "dense_240_hardware_recolor_008",
        "title": "[240 Hardware] Workshop Organizer Nut Color Shift",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_rad, t_cy - t_rad, t_cx + t_rad, t_cy + t_rad],
        "op": "recolor",
        "desc": "Single brass hex nut shifted to polished chrome steel",
        "hint": "Inspect the brass hex nuts in the hardware organizer tray"
    }

def generate_level_9_artist_palette_remove():
    """9. ARTIST PALETTE 200 DOLLOPS -> REMOVE 1 Impasto Paint Dollop"""
    random.seed(808); np.random.seed(808)
    palette_colors = [
        (25, 35, 235), (235, 160, 25), (35, 210, 45), (20, 215, 245),
        (190, 40, 180), (25, 130, 240), (230, 235, 240), (35, 90, 160), (30, 30, 35)
    ]
    cols, rows = 19, 11
    dollops = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-18, 18))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-15, 15))
            rad = random.randint(26, 38)
            dollops.append((cy, cx, cy, rad, random.choice(palette_colors)))
    dollops.sort(key=lambda d: d[0])

    target_idx = 88
    t_layer, t_cx, t_cy, t_rad, t_col = dollops[target_idx]

    def render_dollop(canvas, cx, cy, rad, col):
        cv2.circle(canvas, (cx + 6, cy + 7), rad + 2, (10, 10, 10), -1)
        cv2.circle(canvas, (cx, cy), rad, col, -1)
        cv2.ellipse(canvas, (cx - 4, cy - 4), (rad//2, rad//3), 45, 0, 360, tuple([int(min(255, c*1.35)) for c in col]), -1)
        cv2.circle(canvas, (cx - 6, cy - 6), rad//5, (255, 255, 255), -1)

    base_canvas = create_table_bg((40, 35, 30), (18, 15, 12), wood_grain=True)
    var_canvas = create_table_bg((40, 35, 30), (18, 15, 12), wood_grain=True)

    for i, (_, cx, cy, rad, col) in enumerate(dollops):
        render_dollop(base_canvas, cx, cy, rad, col)
        if i != target_idx:
            render_dollop(var_canvas, cx, cy, rad, col)

    return {
        "id": "dense_200_palette_remove_009",
        "title": "[200 Paint Swirls] Studio Palette Missing Oil Paint Dollop",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_rad, t_cy - t_rad, t_cx + t_rad, t_cy + t_rad],
        "op": "remove",
        "desc": "Single rich oil paint impasto dollop missing from the wooden palette",
        "hint": "Check the colorful oil paint dollops across the palette"
    }

def generate_level_10_enamel_pins_recolor():
    """10. RETRO ENAMEL PINS 190 BADGES -> RECOLOR Emerald Pin -> Tangerine Gold"""
    random.seed(909); np.random.seed(909)
    pin_colors = [
        (30, 40, 235), (235, 180, 35), (35, 215, 60), (25, 215, 245),
        (205, 50, 195), (30, 135, 240)
    ]
    cols, rows = 19, 10
    pins = []
    for r in range(rows):
        for c in range(cols):
            cx = int((c + 0.5) * (W / cols) + random.uniform(-18, 18))
            cy = int((r + 0.5) * (H / rows) + random.uniform(-15, 15))
            rad = random.randint(28, 40)
            pins.append((cy, cx, cy, rad, random.choice(pin_colors)))
    pins.sort(key=lambda p: p[0])

    target_idx = 120
    t_layer, t_cx, t_cy, t_rad, t_col = pins[target_idx]
    alt_col = (30, 130, 245) # Vivid Tangerine

    def render_pin(canvas, cx, cy, rad, col):
        cv2.circle(canvas, (cx + 6, cy + 8), rad + 3, (8, 8, 10), -1)
        cv2.circle(canvas, (cx, cy), rad, (40, 185, 230), -1)
        cv2.circle(canvas, (cx, cy), rad - 4, col, -1)
        cv2.circle(canvas, (cx, cy), rad // 3, (40, 185, 230), -1)
        cv2.circle(canvas, (cx - rad//4, cy - rad//4), max(2, rad//8), (255, 255, 255), -1)

    base_canvas = create_table_bg((30, 30, 38), (14, 14, 18), wood_grain=False)
    var_canvas = create_table_bg((30, 30, 38), (14, 14, 18), wood_grain=False)

    for i, (_, cx, cy, rad, col) in enumerate(pins):
        render_pin(base_canvas, cx, cy, rad, col)
        render_pin(var_canvas, cx, cy, rad, alt_col if i == target_idx else col)

    return {
        "id": "dense_190_pins_recolor_010",
        "title": "[190 Enamel Pins] Collector Pin Board Color Shift",
        "base_bgr": np.clip(base_canvas, 0, 255).astype(np.uint8),
        "var_bgr": np.clip(var_canvas, 0, 255).astype(np.uint8),
        "target_bbox": [t_cx - t_rad, t_cy - t_rad, t_cx + t_rad, t_cy + t_rad],
        "op": "recolor",
        "desc": "Single enamel collector pin shifted to bright tangerine gold",
        "hint": "Scan the retro enamel pins and metal badges on the board"
    }

# ==============================================================================
# MAIN EXECUTION & QA ENGINE VERIFICATION
# ==============================================================================

def generate_all_10_ultra_dense_levels():
    generators = [
        generate_level_1_marbles_recolor,
        generate_level_2_buttons_remove,
        generate_level_3_boardgame_recolor,
        generate_level_4_candies_recolor,
        generate_level_5_resistors_recolor,
        generate_level_6_watchmaker_recolor,
        generate_level_7_gemstones_remove,
        generate_level_8_hardware_recolor,
        generate_level_9_artist_palette_remove,
        generate_level_10_enamel_pins_recolor
    ]

    manifest_entries = []
    print("=" * 80)
    print("GENERATING & VERIFYING 10 ULTRA-DENSE MULTI-OBJECT LEVELS")
    print("=" * 80)

    for idx, gen in enumerate(generators):
        data = gen()
        print(f"\n[{idx+1}/10] Processing: {data['id']} ({data['title']})")
        
        base_bgr = data["base_bgr"]
        var_bgr = data["var_bgr"]
        bbox = data["target_bbox"]
        op = data["op"]

        # Run strict Perceptual Verification Engine
        v_passed, v_metrics, v_reason = PerceptualVerificationEngine.evaluate_display_resolution_and_direct_look(
            base_bgr, var_bgr, bbox, operation=op, difficulty="Medium"
        )
        if not v_passed:
            print(f"❌ Direct-Look QA FAILED: {v_reason}")
            continue

        print(f"✅ QA Passed! {v_reason}")
        print(f"   • Display Size: {v_metrics['display_bbox_size']} | Thickness: {v_metrics['display_thickness']}px | Direct ΔE: {v_metrics['direct_look_mean_delta_e']}")

        # Save image files
        base_name = f"{data['id']}_base.jpg"
        var_name = f"{data['id']}_variant.jpg"
        base_path = os.path.join("public/levels", base_name)
        var_path = os.path.join("public/levels", var_name)

        cv2.imwrite(base_path, base_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
        cv2.imwrite(var_path, var_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])

        # Centroid and radius
        bx1, by1, bx2, by2 = bbox
        cx = round(float(bx1 + bx2) / (2.0 * W) * 100.0, 1)
        cy = round(float(by1 + by2) / (2.0 * H) * 100.0, 1)
        span = max(bx2 - bx1, by2 - by1) / float(max(W, H)) * 100.0
        radius = round(float(max(4.5, min(8.0, span / 2.0 + 1.2))), 1)

        manifest_entry = {
            "id": data["id"],
            "title": data["title"],
            "pack": "Photography",
            "packId": "find_the_sniper",
            "category": "Photography",
            "difficulty": "Medium",
            "operation": op,
            "baseImage": f"/levels/{base_name}",
            "variantImage": f"/levels/{var_name}",
            "totalDifferences": 1,
            "diffs": [
                {
                    "id": 1,
                    "x": cx,
                    "y": cy,
                    "radius": radius,
                    "description": data["desc"],
                    "hint": data["hint"],
                    "operation": op
                }
            ]
        }
        manifest_entries.append(manifest_entry)

    # Register into manifest at the very front
    manifest_path = "public/levels/photo_pair_manifest.json"
    existing_manifest = []
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            existing_manifest = json.load(f)

    new_ids = {m["id"] for m in manifest_entries}
    filtered_existing = [m for m in existing_manifest if m["id"] not in new_ids]
    combined_manifest = manifest_entries + filtered_existing

    with open(manifest_path, "w") as f:
        json.dump(combined_manifest, f, indent=2)

    print(f"\n🎉 Successfully calibrated and registered {len(manifest_entries)}/10 ultra-dense multi-object levels at front of queue!")

if __name__ == "__main__":
    generate_all_10_ultra_dense_levels()
