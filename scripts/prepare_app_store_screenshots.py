#!/usr/bin/env python3
"""
App Store Screenshot Formatter & Validator
Automatically resizes, removes alpha channels, and formats screenshots to exact Apple App Store Connect dimensions.
"""

import sys
import os
import argparse
from PIL import Image

TARGET_SIZES = {
    "6.7_landscape": (2796, 1290),
    "6.7_portrait": (1290, 2796),
    "6.5_landscape": (2688, 1242),
    "6.5_portrait": (1242, 2688),
    "ipad_landscape": (2732, 2048),
    "ipad_portrait": (2048, 2732),
}

def format_screenshot(input_path, output_dir=None, target_key="6.7_landscape"):
    if not os.path.isfile(input_path):
        print(f"❌ File not found: {input_path}")
        return False

    target_w, target_h = TARGET_SIZES.get(target_key, (2796, 1290))
    is_target_landscape = target_w > target_h

    out_dir = output_dir or os.path.dirname(input_path) or "."
    os.makedirs(out_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    out_path = os.path.join(out_dir, f"{base_name}_{target_w}x{target_h}.png")

    try:
        with Image.open(input_path) as img:
            # Detect orientation and rotate if needed to match target aspect
            w, h = img.size
            is_img_landscape = w > h

            if is_img_landscape != is_target_landscape:
                # Rotate 90 degrees if orientations don't match
                img = img.transpose(Image.Transpose.ROTATE_90)
                w, h = img.size

            # Remove alpha channel (Apple rejects PNGs with transparency/alpha)
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                background = Image.new('RGB', img.size, (0, 0, 0))
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # High-quality resize to exact App Store dimensions
            resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            resized.save(out_path, format="PNG", optimize=True)
            print(f"✅ Formatted: {os.path.basename(input_path)} -> {os.path.basename(out_path)} ({target_w}x{target_h} RGB PNG)")
            return True
    except Exception as e:
        print(f"❌ Error processing {input_path}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Format screenshots for App Store Connect")
    parser.add_argument("files", nargs="+", help="Input screenshot paths")
    parser.add_argument("--size", choices=TARGET_SIZES.keys(), default="6.7_landscape", help="Target size (default: 6.7_landscape / 2796x1290)")
    parser.add_argument("--output", "-o", help="Output directory")
    args = parser.parse_args()

    success_count = 0
    for f in args.files:
        if format_screenshot(f, args.output, args.size):
            success_count += 1

    print(f"\n🎉 Done! Formatted {success_count}/{len(args.files)} screenshot(s) ready for App Store Connect.")

if __name__ == "__main__":
    main()
