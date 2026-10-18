#!/usr/bin/env python3
"""Generate polished Options A, B, and C (with 3 variants each) for Diff Hunter App Icon."""

import math
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_PATH = "/tmp/perfect_clean_base.png"
OUT_DIR = os.path.join(ROOT, "_design", "icon_options")
os.makedirs(OUT_DIR, exist_ok=True)

# Colors
CYAN = (0, 240, 255)
CYAN_BRIGHT = (210, 252, 255)
PINK = (255, 0, 127)
PINK_BRIGHT = (255, 128, 190)
WHITE = (255, 255, 255)
DARK_BG = (9, 10, 16)
DARK_ELEVATED = (15, 18, 30)
GOLD = (255, 183, 3)

def load_clean_base():
    """Load the clean base canvas."""
    return Image.open(BASE_PATH).convert("RGBA")

def create_glow(draw_fn, size, blur_radius=20, color=CYAN, opacity=0.85):
    """Render a soft neon glow layer."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    draw_fn(d, color)
    blurred = layer.filter(ImageFilter.GaussianBlur(blur_radius))
    if opacity < 1.0:
        r, g, b, a = blurred.split()
        a = a.point(lambda p: int(p * opacity))
        blurred = Image.merge("RGBA", (r, g, b, a))
    return blurred

def draw_circle(draw, center, radius, fill=None, outline=None, width=1):
    cx, cy = center
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    if fill:
        draw.ellipse(bbox, fill=fill)
    if outline and width > 0:
        draw.ellipse(bbox, outline=outline, width=width)

def draw_badge_base(im, cx, cy, radius=280):
    """Draw a dark obsidian glass circular badge with smooth drop shadow."""
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    
    # Layered drop shadow
    for offset, alpha in [(24, 25), (18, 40), (12, 60), (6, 80)]:
        d.ellipse([cx - radius - offset//2, cy - radius - offset//2 + offset,
                   cx + radius + offset//2, cy + radius + offset//2 + offset],
                  fill=(0, 0, 0, alpha))
                  
    # Obsidian glass base
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
              fill=(*DARK_BG, 250), outline=(*CYAN, 160), width=4)
              
    # Inner rim accent
    draw_circle(d, (cx, cy), radius - 15, outline=(*CYAN, 45), width=2)
    return overlay

# =========================================================================
# OPTION A: TARGET RETICLE / CROSSHAIR (Diff Hunter Tracking Theme)
# =========================================================================

def generate_a1_cyber_reticle(base):
    """A1: Sleek Cyberpunk Neon Reticle (The Hunter Target Lock)."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    r_badge = 285
    
    badge = draw_badge_base(im, cx, cy, r_badge)
    
    def draw_art(dr, col):
        # Primary targeting ring
        draw_circle(dr, (cx, cy), 180, outline=(*col, 255), width=7)
        # Inner range ring
        draw_circle(dr, (cx, cy), 105, outline=(*col, 200), width=4)
        # Crosshair cardinal bars
        dr.line([(cx - 225, cy), (cx - 125, cy)], fill=(*col, 255), width=7)
        dr.line([(cx + 125, cy), (cx + 225, cy)], fill=(*col, 255), width=7)
        dr.line([(cx, cy - 225), (cx, cy - 125)], fill=(*col, 255), width=7)
        dr.line([(cx, cy + 125), (cx, cy + 225)], fill=(*col, 255), width=7)
        
        # 4 Corner autofocus brackets at 45 degree angles
        bracket_dist = 220
        for ang in [45, 135, 225, 315]:
            rad = math.radians(ang)
            bx = cx + int(bracket_dist * math.cos(rad))
            by = cy + int(bracket_dist * math.sin(rad))
            dr.line([(bx - 16, by), (bx + 16, by)], fill=(*col, 240), width=4)
            dr.line([(bx, by - 16), (bx, by + 16)], fill=(*col, 240), width=4)
            
        # Target lock core pip
        dr.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=(*col, 255))
        dr.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(*WHITE, 255))

    glow = create_glow(draw_art, (w, h), blur_radius=22, color=CYAN, opacity=0.9)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(badge, (0, 0), badge)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

def generate_a2_split_reticle(base):
    """A2: Dual-Tone Split Reticle (Cyan & Pink Target Lock)."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    r_badge = 285
    
    badge = draw_badge_base(im, cx, cy, r_badge)
    
    def draw_art(dr, col):
        # Outer ring cyan
        draw_circle(dr, (cx, cy), 190, outline=(*CYAN, 255), width=7)
        # Inner ring pink
        draw_circle(dr, (cx, cy), 125, outline=(*PINK, 240), width=5)
        
        # 4 crosshairs aligned with the diagonal 45-degree world split!
        for ang in [45, 135, 225, 315]:
            rad = math.radians(ang)
            x1 = cx + int(140 * math.cos(rad))
            y1 = cy + int(140 * math.sin(rad))
            x2 = cx + int(235 * math.cos(rad))
            y2 = cy + int(235 * math.sin(rad))
            # Pink for left/bottom-left, Cyan for right/top-right
            c_line = CYAN if math.cos(rad) > 0 else PINK
            dr.line([(x1, y1), (x2, y2)], fill=(*c_line, 255), width=7)
            
        # Center target lock
        dr.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(*CYAN, 255))
        dr.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(*WHITE, 255))

    glow = create_glow(draw_art, (w, h), blur_radius=22, color=CYAN, opacity=0.85)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(badge, (0, 0), badge)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

def generate_a3_diamond_reticle(base):
    """A3: Precision Diamond Target Reticle (45° Diagonal Axis)."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    
    d_size = 310
    poly = [(cx, cy - d_size), (cx + d_size, cy), (cx, cy + d_size), (cx - d_size, cy)]
    
    # Shadow
    for off in range(20, 0, -4):
        s_poly = [(x, y + off) for x, y in poly]
        d.polygon(s_poly, fill=(0, 0, 0, int(60 * (1 - off/20))))
        
    d.polygon(poly, fill=(*DARK_BG, 250), outline=(*CYAN, 200))
    
    def draw_art(dr, col):
        inner_s = 220
        p_inner = [(cx, cy - inner_s), (cx + inner_s, cy), (cx, cy + inner_s), (cx - inner_s, cy)]
        dr.polygon(p_inner, outline=(*col, 255), fill=None)
        
        # Crosshair cardinal lines
        dr.line([(cx - 260, cy), (cx - 80, cy)], fill=(*col, 255), width=7)
        dr.line([(cx + 80, cy), (cx + 260, cy)], fill=(*col, 255), width=7)
        dr.line([(cx, cy - 260), (cx, cy - 80)], fill=(*col, 255), width=7)
        dr.line([(cx, cy + 80), (cx, cy + 260)], fill=(*col, 255), width=7)
        
        # Center circle reticle
        draw_circle(dr, (cx, cy), 70, outline=(*WHITE, 255), width=5)
        dr.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(*col, 255))
        dr.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(*WHITE, 255))

    glow = create_glow(draw_art, (w, h), blur_radius=20, color=CYAN, opacity=0.9)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(overlay, (0, 0), overlay)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

# =========================================================================
# OPTION B: GEOMETRIC DELTA (Δ) & DH MONOGRAM (Brand Mark Theme)
# =========================================================================

def generate_b1_delta_neon(base):
    """B1: Glowing Futuristic Delta (Δ = Mathematical Symbol for Difference)."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    r_badge = 285
    
    badge = draw_badge_base(im, cx, cy, r_badge)
    
    def draw_art(dr, col):
        side = 330
        h_t = int(side * math.sqrt(3) / 2)
        top = (cx, cy - int(h_t * 0.58))
        left = (cx - side // 2, cy + int(h_t * 0.42))
        right = (cx + side // 2, cy + int(h_t * 0.42))
        
        # Outer bold Delta triangle
        dr.polygon([top, right, left], outline=(*col, 255), width=20)
        
        # Inner cutout triangle
        in_side = 160
        in_h = int(in_side * math.sqrt(3) / 2)
        itop = (cx, cy - int(in_h * 0.45))
        ileft = (cx - in_side // 2, cy + int(in_h * 0.55))
        iright = (cx + in_side // 2, cy + int(in_h * 0.55))
        dr.polygon([itop, iright, ileft], fill=(*DARK_BG, 255), outline=(*WHITE, 255), width=5)
        
        # Center difference pinpoint
        dr.ellipse([cx - 14, cy + 12, cx + 14, cy + 40], fill=(*CYAN_BRIGHT, 255))
        
        # Horizontal crosshair wings
        dr.line([(cx - 210, cy + 25), (cx - 100, cy + 25)], fill=(*col, 255), width=6)
        dr.line([(cx + 100, cy + 25), (cx + 210, cy + 25)], fill=(*col, 255), width=6)

    glow = create_glow(draw_art, (w, h), blur_radius=24, color=CYAN, opacity=0.9)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(badge, (0, 0), badge)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

def generate_b2_dh_monogram(base):
    """B2: Bold Geometric 'DH' (Diff Hunter) Brand Monogram."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    r_badge = 285
    
    badge = draw_badge_base(im, cx, cy, r_badge)
    
    def draw_art(dr, col):
        # 'D' on left in neon cyan
        d_x = cx - 45
        dr.line([(d_x - 90, cy - 120), (d_x - 90, cy + 120)], fill=(*col, 255), width=22)
        dr.line([(d_x - 90, cy - 120), (d_x - 10, cy - 120)], fill=(*col, 255), width=22)
        dr.line([(d_x - 90, cy + 120), (d_x - 10, cy + 120)], fill=(*col, 255), width=22)
        dr.arc([d_x - 95, cy - 120, d_x + 65, cy + 120], start=-90, end=90, fill=(*col, 255), width=22)
        
        # 'H' on right in pure white with cyan crossbar
        h_x = cx + 55
        dr.line([(h_x, cy - 120), (h_x, cy + 120)], fill=(*WHITE, 255), width=20)
        dr.line([(h_x + 95, cy - 120), (h_x + 95, cy + 120)], fill=(*WHITE, 255), width=20)
        dr.line([(h_x, cy), (h_x + 95, cy)], fill=(*col, 255), width=20)

    glow = create_glow(draw_art, (w, h), blur_radius=22, color=CYAN, opacity=0.85)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(badge, (0, 0), badge)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

def generate_b3_delta_crosshair(base):
    """B3: Delta Brand Mark with Internal Difference Reticle Core."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    r_badge = 285
    
    badge = draw_badge_base(im, cx, cy, r_badge)
    
    def draw_art(dr, col):
        side = 320
        h_t = int(side * math.sqrt(3) / 2)
        top = (cx, cy - int(h_t * 0.55))
        left = (cx - side // 2, cy + int(h_t * 0.45))
        right = (cx + side // 2, cy + int(h_t * 0.45))
        
        dr.polygon([top, right, left], outline=(*col, 255), width=16)
        
        # Targeting ring inside
        draw_circle(dr, (cx, cy + 18), 75, outline=(*WHITE, 255), width=6)
        draw_circle(dr, (cx, cy + 18), 35, outline=(*col, 255), width=4)
        dr.ellipse([cx - 12, cy + 6, cx + 12, cy + 30], fill=(*CYAN_BRIGHT, 255))
        
        # 3 ticks radiating to vertices
        dr.line([(cx, cy - 55), (cx, cy - 105)], fill=(*col, 255), width=5)
        dr.line([(cx - 55, cy + 50), (cx - 105, cy + 75)], fill=(*col, 255), width=5)
        dr.line([(cx + 55, cy + 50), (cx + 105, cy + 75)], fill=(*col, 255), width=5)

    glow = create_glow(draw_art, (w, h), blur_radius=20, color=CYAN, opacity=0.9)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(badge, (0, 0), badge)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

# =========================================================================
# OPTION C: SCANNER / MAGNIFYING LENS (Spot & Inspect Theme)
# =========================================================================

def generate_c1_magnifier_lens(base):
    """C1: Cyber Finder Loupe / Magnifying Lens focused on the Split."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    r_badge = 285
    
    badge = draw_badge_base(im, cx, cy, r_badge)
    
    # Outer lens bevel
    lens_r = 230
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    
    # Glass glare highlight
    d.arc([cx - lens_r + 25, cy - lens_r + 25, cx + lens_r - 25, cy + lens_r - 25],
          start=-125, end=-35, fill=(255, 255, 255, 180), width=14)
          
    def draw_art(dr, col):
        draw_circle(dr, (cx, cy), lens_r, outline=(*col, 255), width=8)
        draw_circle(dr, (cx, cy), lens_r - 20, outline=(*col, 140), width=3)
        draw_circle(dr, (cx, cy), 105, outline=(*col, 220), width=5)
        # Precision crosshair tick marks
        dr.line([(cx - 160, cy), (cx - 80, cy)], fill=(*col, 255), width=6)
        dr.line([(cx + 80, cy), (cx + 160, cy)], fill=(*col, 255), width=6)
        dr.line([(cx, cy - 160), (cx, cy - 80)], fill=(*col, 255), width=6)
        dr.line([(cx, cy + 80), (cx, cy + 160)], fill=(*col, 255), width=6)
        dr.ellipse([cx - 15, cy - 15, cx + 15, cy + 15], fill=(*col, 255))
        dr.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(*WHITE, 255))

    glow = create_glow(draw_art, (w, h), blur_radius=20, color=CYAN, opacity=0.85)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(badge, (0, 0), badge)
    im.paste(overlay, (0, 0), overlay)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

def generate_c2_radar_scanner(base):
    """C2: Difference Radar Scanner with Dual Sweep Beams & Difference Blips."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    r_badge = 285
    
    badge = draw_badge_base(im, cx, cy, r_badge)
    
    def draw_art(dr, col):
        for r_ring in [80, 150, 220]:
            draw_circle(dr, (cx, cy), r_ring, outline=(*col, 160), width=4)
            
        # 45-degree scanner sweep beam (matching difference axis)
        sweep_len = 230
        for offset in range(-10, 11, 2):
            alpha = int(255 * (1.0 - abs(offset) / 12.0))
            dr.line([(cx - sweep_len + offset, cy - sweep_len - offset),
                     (cx + sweep_len + offset, cy + sweep_len - offset)],
                    fill=(*col, alpha), width=4)
                    
        # Difference detected blips
        blips = [
            (cx - 85, cy + 50, PINK),
            (cx + 95, cy - 70, CYAN_BRIGHT),
            (cx + 35, cy + 130, CYAN),
        ]
        for bx, by, b_col in blips:
            dr.ellipse([bx - 16, by - 16, bx + 16, by + 16], fill=(*b_col, 255))
            draw_circle(dr, (bx, by), 28, outline=(*b_col, 180), width=3)
            
        dr.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(*WHITE, 255))

    glow = create_glow(draw_art, (w, h), blur_radius=20, color=CYAN, opacity=0.85)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(badge, (0, 0), badge)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

def generate_c3_aperture_ring(base):
    """C3: Optical Camera Aperture / Iris Ring (Photo Mode Spotting Theme)."""
    im = base.copy()
    w, h = im.size
    cx, cy = w // 2, h // 2
    r_badge = 285
    
    badge = draw_badge_base(im, cx, cy, r_badge)
    
    def draw_art(dr, col):
        r_outer = 220
        r_inner = 85
        num_blades = 6
        for i in range(num_blades):
            theta = i * (2 * math.pi / num_blades)
            x1 = cx + int(r_outer * math.cos(theta))
            y1 = cy + int(r_outer * math.sin(theta))
            theta_next = (i + 1) * (2 * math.pi / num_blades)
            x2 = cx + int(r_inner * math.cos(theta_next + 0.35))
            y2 = cy + int(r_inner * math.sin(theta_next + 0.35))
            dr.line([(x1, y1), (x2, y2)], fill=(*col, 255), width=9)
            
        draw_circle(dr, (cx, cy), r_outer, outline=(*col, 255), width=7)
        draw_circle(dr, (cx, cy), r_inner, outline=(*WHITE, 255), width=6)
        dr.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=(*CYAN_BRIGHT, 255))
        dr.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(*WHITE, 255))

    glow = create_glow(draw_art, (w, h), blur_radius=22, color=CYAN, opacity=0.85)
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_art(ImageDraw.Draw(core), CYAN)
    
    im.paste(badge, (0, 0), badge)
    im.paste(glow, (0, 0), glow)
    im.paste(core, (0, 0), core)
    return im.convert("RGB")

def main():
    base = load_clean_base()
    print(f"Loaded clean base: {base.size}")
    
    generators = {
        # Option A: Target Reticle / Crosshair
        "A1_cyber_reticle.png": generate_a1_cyber_reticle,
        "A2_split_reticle.png": generate_a2_split_reticle,
        "A3_diamond_reticle.png": generate_a3_diamond_reticle,
        
        # Option B: Geometric Delta / Monogram
        "B1_delta_neon.png": generate_b1_delta_neon,
        "B2_dh_monogram.png": generate_b2_dh_monogram,
        "B3_delta_crosshair.png": generate_b3_delta_crosshair,
        
        # Option C: Scanner / Magnifying Lens
        "C1_magnifier_lens.png": generate_c1_magnifier_lens,
        "C2_radar_scanner.png": generate_c2_radar_scanner,
        "C3_aperture_ring.png": generate_c3_aperture_ring,
    }
    
    for filename, fn in generators.items():
        out_path = os.path.join(OUT_DIR, filename)
        img = fn(base)
        img.save(out_path, "PNG", optimize=True)
        print(f"Generated: {out_path} ({img.size})")

if __name__ == "__main__":
    main()
