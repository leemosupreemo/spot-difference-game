#!/usr/bin/env python3
"""Regenerate every app icon from one master.

The App Store rejected 1.1.0 under guideline 2.3.8 partly because the icons
were not consistent with each other. Everything here derives from a single
file so they cannot drift apart again.

    python3 scripts/generate_app_icons.py

Master: design/app-icon-master.png (square, RGB, no alpha).
"""
import base64
import io
import re
import sys
from pathlib import Path

from PIL import Image

ROOT   = Path(__file__).resolve().parent.parent
MASTER = ROOT / "_design" / "app-icon-master.png"

# iOS requires a 1024 icon with NO alpha channel.
IOS = {"ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png": 1024}

WEB = {
    "public/app-icon.png":        1024,   # manifest 1024 + og:image + in-app logo
    "public/icon-512.png":         512,   # manifest, "any maskable" -> full bleed
    "public/icon-192.png":         192,
    "public/apple-touch-icon.png": 180,
    "public/favicon-32x32.png":     32,
    "public/favicon-16x16.png":     16,
}

ANDROID_DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
ANDROID_LAUNCHER   = 48    # dp, legacy ic_launcher / ic_launcher_round
ANDROID_FOREGROUND = 108   # dp, adaptive-icon foreground


def load_master() -> Image.Image:
    if not MASTER.exists():
        sys.exit(f"master not found: {MASTER}")
    im = Image.open(MASTER)
    if im.width != im.height:
        sys.exit(f"master must be square, got {im.size}")
    return im.convert("RGB")


def write(im: Image.Image, rel: str, size: int, mode: str = "RGB") -> None:
    out = ROOT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    im.resize((size, size), Image.LANCZOS).convert(mode).save(out, "PNG", optimize=True)
    print(f"  {size:>5}px  {rel}")


def main() -> None:
    master = load_master()
    print(f"master {master.size[0]}x{master.size[1]}\n\niOS:")
    for rel, size in IOS.items():
        write(master, rel, size)

    print("\nWeb:")
    for rel, size in WEB.items():
        write(master, rel, size)

    # favicon.ico keeps its original 48px single frame
    ico = ROOT / "public/favicon.ico"
    master.resize((48, 48), Image.LANCZOS).save(ico, "ICO", sizes=[(48, 48)])
    print(f"     48px  public/favicon.ico")

    # favicon.svg wraps a base64 PNG behind a rounded-rect clip; swap the payload
    svg_path = ROOT / "public/favicon.svg"
    if svg_path.exists():
        buf = io.BytesIO()
        master.resize((512, 512), Image.LANCZOS).save(buf, "PNG", optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode()
        svg = re.sub(r'href="data:image/png;base64,[^"]*"',
                     f'href="data:image/png;base64,{b64}"',
                     svg_path.read_text(), count=1)
        svg_path.write_text(svg)
        print(f"    512px  public/favicon.svg (embedded)")

    print("\nAndroid:")
    for density, scale in ANDROID_DENSITIES.items():
        base = f"android/app/src/main/res/mipmap-{density}"
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            write(master, f"{base}/{name}", int(ANDROID_LAUNCHER * scale), "RGBA")
        # Adaptive foreground is full-bleed art; the system masks the outer ring.
        write(master, f"{base}/ic_launcher_foreground.png",
              int(ANDROID_FOREGROUND * scale), "RGBA")

    print("\nDone. Run `npm run build && npx cap sync` to propagate into the "
          "native projects.")


if __name__ == "__main__":
    main()
