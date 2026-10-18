#!/usr/bin/env python3
"""
Google Play Store Asset Generator
Generates all required store graphics and metadata:
1. 512x512 High-Res App Icon (RGB, no alpha, max 1MB)
2. 1024x500 Feature Graphic (RGB, no alpha)
3. 1920x1080 16:9 Screenshots (RGB, no alpha)
4. store_listing_copy.txt (Formatted copy compliant with character limits)
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "_design" / "google_play"
SCREENSHOTS_DIR = OUTPUT_DIR / "screenshots"
MASTER_ICON = ROOT / "_design" / "app-icon-master.png"
SOURCE_SCREENSHOTS = ROOT / "screenshots" / "app_store_6.7_inch_landscape"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def find_font(size: int, bold: bool = False):
    font_candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in font_candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def generate_store_icon():
    print("🎨 1. Generating Google Play Store Icon (512x512 RGB)...")
    if not MASTER_ICON.exists():
        print(f"❌ Master icon not found at {MASTER_ICON}")
        return
    with Image.open(MASTER_ICON) as img:
        icon_512 = img.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
        out_path = OUTPUT_DIR / "icon-512x512.png"
        icon_512.save(out_path, format="PNG", optimize=True)
        print(f"   ✅ Saved: {out_path} ({os.path.getsize(out_path) // 1024} KB)")


def generate_feature_graphic():
    print("🎨 2. Generating Google Play Feature Graphic (1024x500 RGB)...")
    width, height = 1024, 500

    # Base background: smooth cyberpunk deep gradient
    bg = Image.new("RGB", (width, height), (9, 10, 16))
    draw = ImageDraw.Draw(bg)

    for y in range(height):
        # Vertical gradient from #07080d to #12182b
        r = int(7 + (18 - 7) * (y / height))
        g = int(8 + (24 - 8) * (y / height))
        b = int(13 + (43 - 13) * (y / height))
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Add subtle cyan glow on top-left and amber glow on bottom-right
    glow_cyan = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_cyan)
    glow_draw.ellipse([-100, -100, 500, 400], fill=(0, 240, 255, 35))
    glow_cyan = glow_cyan.filter(ImageFilter.GaussianBlur(80))

    glow_amber = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    amber_draw = ImageDraw.Draw(glow_amber)
    amber_draw.ellipse([width - 400, height - 300, width + 100, height + 100], fill=(255, 183, 3, 30))
    glow_amber = glow_amber.filter(ImageFilter.GaussianBlur(90))

    bg = Image.alpha_composite(bg.convert("RGBA"), glow_cyan)
    bg = Image.alpha_composite(bg, glow_amber)

    # Decorative grid lines
    grid_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_layer)
    for x in range(0, width, 64):
        grid_draw.line([(x, 0), (x, height)], fill=(255, 255, 255, 8))
    for y in range(0, height, 64):
        grid_draw.line([(0, y), (width, y)], fill=(255, 255, 255, 8))
    bg = Image.alpha_composite(bg, grid_layer)

    # Load master icon and frame it with a sleek squircle badge
    if MASTER_ICON.exists():
        with Image.open(MASTER_ICON) as master:
            icon_size = 280
            icon_resized = master.convert("RGBA").resize((icon_size, icon_size), Image.Resampling.LANCZOS)

            # Squircle mask
            mask = Image.new("L", (icon_size, icon_size), 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.rounded_rectangle([0, 0, icon_size, icon_size], radius=56, fill=255)

            # Drop shadow
            shadow_size = icon_size + 40
            shadow = Image.new("RGBA", (shadow_size, shadow_size), (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow)
            shadow_draw.rounded_rectangle([20, 24, icon_size + 20, icon_size + 24], radius=56, fill=(0, 0, 0, 140))
            shadow = shadow.filter(ImageFilter.GaussianBlur(16))

            icon_x = 90
            icon_y = (height - icon_size) // 2
            bg.paste(shadow, (icon_x - 20, icon_y - 20), shadow)

            # Border
            border_badge = Image.new("RGBA", (icon_size, icon_size), (0, 0, 0, 0))
            b_draw = ImageDraw.Draw(border_badge)
            b_draw.rounded_rectangle([0, 0, icon_size - 1, icon_size - 1], radius=56, outline=(0, 240, 255, 120), width=4)

            bg.paste(icon_resized, (icon_x, icon_y), mask)
            bg.paste(border_badge, (icon_x, icon_y), border_badge)

    # Render Typography
    text_draw = ImageDraw.Draw(bg)
    font_title = find_font(68, bold=True)
    font_subtitle = find_font(26, bold=True)
    font_badge = find_font(18, bold=True)

    text_x = 420
    # Badge: SPOT THE DIFFERENCE
    badge_text = "ULTIMATE SPOT THE DIFFERENCE"
    badge_bbox = text_draw.textbbox((0, 0), badge_text, font=font_badge)
    bw, bh = badge_bbox[2] - badge_bbox[0], badge_bbox[3] - badge_bbox[1]
    bx, by = text_x, 120
    badge_pad = 12
    text_draw.rounded_rectangle(
        [bx - badge_pad, by - 6, bx + bw + badge_pad, by + bh + 6],
        radius=8,
        fill=(0, 240, 255, 30),
        outline=(0, 240, 255, 160),
        width=1,
    )
    text_draw.text((bx, by - 2), badge_text, fill=(0, 240, 255), font=font_badge)

    # Main Title: DIFF HUNTER
    text_draw.text((text_x, 165), "DIFF HUNTER", fill=(255, 255, 255), font=font_title)

    # Subtitle: Handcrafted Puzzles • Daily Challenge • Leaderboards
    sub_text = "Handcrafted Scenes  •  Daily Challenge  •  Global Ranks"
    text_draw.text((text_x, 260), sub_text, fill=(180, 195, 215), font=font_subtitle)

    # Feature tags (Pills)
    tags = ["🎯 100% Verified Solvable", "🔍 Precision Zoom", "🏆 Global Leaderboard"]
    tag_x = text_x
    tag_y = 325
    for tag in tags:
        t_bbox = text_draw.textbbox((0, 0), tag, font=font_badge)
        tw = t_bbox[2] - t_bbox[0]
        text_draw.rounded_rectangle(
            [tag_x, tag_y, tag_x + tw + 20, tag_y + 32],
            radius=16,
            fill=(255, 255, 255, 18),
            outline=(255, 255, 255, 40),
            width=1,
        )
        text_draw.text((tag_x + 10, tag_y + 6), tag, fill=(230, 240, 255), font=font_badge)
        tag_x += tw + 32

    final_graphic = bg.convert("RGB")
    out_path = OUTPUT_DIR / "feature_graphic-1024x500.png"
    final_graphic.save(out_path, format="PNG", optimize=True)
    print(f"   ✅ Saved: {out_path} ({os.path.getsize(out_path) // 1024} KB)")


def generate_screenshots():
    print("🎨 3. Generating Google Play 16:9 Screenshots (1920x1080 RGB)...")
    if not SOURCE_SCREENSHOTS.exists():
        print(f"⚠️ Source screenshots not found at {SOURCE_SCREENSHOTS}")
        return

    files = sorted(SOURCE_SCREENSHOTS.glob("*.png"))
    if not files:
        print("⚠️ No PNG screenshots found to convert.")
        return

    target_w, target_h = 1920, 1080
    for src in files:
        with Image.open(src) as img:
            w, h = img.size
            # 2796x1290 is 2.167:1. We center-crop to 16:9 (aspect 1.7778) then scale to 1920x1080
            target_ratio = 16.0 / 9.0
            src_ratio = w / h

            if src_ratio > target_ratio:
                # Wider than 16:9, crop width
                crop_w = int(h * target_ratio)
                crop_h = h
                left = (w - crop_w) // 2
                top = 0
            else:
                crop_w = w
                crop_h = int(w / target_ratio)
                left = 0
                top = (h - crop_h) // 2

            cropped = img.crop((left, top, left + crop_w, top + crop_h))
            final_ss = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS).convert("RGB")

            out_path = SCREENSHOTS_DIR / src.name
            final_ss.save(out_path, format="PNG", optimize=True)
            print(f"   ✅ Formatted: {src.name} -> {out_path.name} (1920x1080 RGB)")


def generate_store_listing_copy():
    print("📄 4. Generating store listing text copy...")
    copy_text = """================================================================================
DIFF HUNTER - GOOGLE PLAY STORE METADATA & LISTING COPY
================================================================================

1. APP NAME (Max 30 characters)
--------------------------------------------------------------------------------
Diff Hunter
(11 / 30 characters)


2. SHORT DESCRIPTION (Max 80 characters)
--------------------------------------------------------------------------------
Find subtle differences in handcrafted photographic and stylized puzzle scenes!
(79 / 80 characters)


3. FULL DESCRIPTION (Max 4,000 characters)
--------------------------------------------------------------------------------
Put your observation skills to the ultimate test with Diff Hunter — the premier spot-the-difference puzzle game designed for true detail seekers!

Explore breathtaking photographic vistas, vibrant stylized scenes, and intricate macro compositions. Every single puzzle pair in Diff Hunter is handcrafted, curated, and verified with 100% solvability guarantees — no random pixel artifacts or unfair invisible differences.

KEY FEATURES:

✨ DAILY CHALLENGE & STREAKS
Every midnight, a brand-new exclusive Daily Challenge unlocks worldwide. Complete it on your first attempt to earn bonus stars, protect your daily streak, and unlock the past daily challenge calendar.

🔍 PRECISION PINCH & ZOOM
Take full control with seamless pinch-to-zoom and pan navigation. Inspect tiny background details, nuanced color variations, and hidden textures with crystal-clear precision.

🏆 LIVE GLOBAL LEADERBOARDS
Compete against players across the globe on Firestore-powered leaderboards. Race for the fastest completion times and climb the ranks from Bronze to Master Hunter.

🎨 DIVERSE VISUAL STYLES
• Architectural & Urban Landscapes
• Dramatic Wildlife & Nature Photography
• Vivid Minimalist & Stylized Vector Art
• Complex Dense Macro Compositions

🧘 RELAXING YET CHALLENGING GAMEPLAY
Play at your own pace without punishing timers, or race the clock in Daily Challenge mode to climb the global leaderboard. Clean cyberpunk aesthetics, tactile haptic feedback, and a distraction-free glassmorphic interface keep you immersed.

🔒 PRIVACY & TRANSPARENCY
No intrusive tracking or predatory mechanics. Your progress syncs smoothly, and you can play offline whenever you want.

Can you spot them all? Download Diff Hunter today and sharpen your eyes!
--------------------------------------------------------------------------------
(1,980 / 4,000 characters)


4. CATEGORY & CONTENT RATING
--------------------------------------------------------------------------------
Category: Games / Puzzle
Content Rating: Everyone (IARC)
Target Age: 13+ and Everyone
Contains Ads: No
In-App Purchases: No
Privacy Policy URL: https://diff-hunter-test.web.app/privacy-policy.html
================================================================================
"""
    out_file = OUTPUT_DIR / "store_listing_copy.txt"
    out_file.write_text(copy_text, encoding="utf-8")
    print(f"   ✅ Saved: {out_file}")


def main():
    print("====================================================")
    print("🚀 GENERATING GOOGLE PLAY STORE ASSETS")
    print("====================================================")
    generate_store_icon()
    generate_feature_graphic()
    generate_screenshots()
    generate_store_listing_copy()
    print("====================================================")
    print(f"🎉 All Google Play assets generated in: {OUTPUT_DIR}")
    print("====================================================")


if __name__ == "__main__":
    main()
