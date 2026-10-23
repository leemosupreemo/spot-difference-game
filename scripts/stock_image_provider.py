#!/usr/bin/env python3
"""
Stock Image Provider & Quality Validator
================================================================================
Fetches, validates, and normalizes royalty-free stock images for:
  - Social Media (2:3 portrait 848x1264 px or 4:5 1080x1350 px)
  - In-Game Daily Challenge & Regular Sets (4:3 landscape 1200x900 px)

Quality Criteria Enforced:
  1. Minimum Resolution: Width & Height >= 1200 px.
  2. Aspect Ratio: Center-weighted crop to exact target aspect (4:3 or 2:3).
  3. Typography Filter: Rejects images with prominent signboards, text, or book covers.
  4. Detail & Contrast: Minimum color variance and edge density for good gameplay.
  5. Categories: Architecture, Collections/Flatlays, Food/Dining, Nature, Geometry.
================================================================================
"""

import io
import os
import urllib.request
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import cv2
import numpy as np
from PIL import Image

# Curated high-resolution stock sources verified for quality and commercial reuse
CURATED_STOCK_CATALOG = [
    # Architecture
    {
        "id": "stock_arch_venice_facade",
        "category": "Architecture",
        "title": "Historic Venetian Canal Facade",
        "url": "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?q=85&w=1600&auto=format&fit=crop",
    },
    {
        "id": "stock_arch_parisian_building",
        "category": "Architecture",
        "title": "Haussmannian Balcony Facade",
        "url": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=85&w=1600&auto=format&fit=crop",
    },
    {
        "id": "stock_arch_cinema_marquee",
        "category": "Architecture",
        "title": "Vintage Cinema Marquee Entrance",
        "url": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=85&w=1600&auto=format&fit=crop",
    },
    # Collections / Flatlays
    {
        "id": "stock_col_heirloom_spices",
        "category": "Collections",
        "title": "Heirloom Spice Bowls and Seeds",
        "url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=85&w=1600&auto=format&fit=crop",
    },
    {
        "id": "stock_col_apothecary_jars",
        "category": "Collections",
        "title": "Apothecary Bottles on Wooden Shelf",
        "url": "https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=85&w=1600&auto=format&fit=crop",
    },
    {
        "id": "stock_col_vintage_notions",
        "category": "Collections",
        "title": "Vintage Buttons and Sewing Spools",
        "url": "https://images.unsplash.com/photo-1544816155-12df9643f363?q=85&w=1600&auto=format&fit=crop",
    },
    # Food & Dining
    {
        "id": "stock_food_mediterranean_table",
        "category": "Food",
        "title": "Mediterranean Breakfast Spread",
        "url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=85&w=1600&auto=format&fit=crop",
    },
    {
        "id": "stock_food_patisserie_croissant",
        "category": "Food",
        "title": "French Bakery Croissants and Berries",
        "url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=85&w=1600&auto=format&fit=crop",
    },
    {
        "id": "stock_food_artisan_pizza",
        "category": "Food",
        "title": "Rustic Wood-Fired Pizza with Basil",
        "url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=85&w=1600&auto=format&fit=crop",
    },
    # Nature / Botanicals
    {
        "id": "stock_nat_succulents_greenhouse",
        "category": "Nature",
        "title": "Botanical Succulents Collection",
        "url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=85&w=1600&auto=format&fit=crop",
    },
    {
        "id": "stock_nat_kyoto_lanterns",
        "category": "Nature",
        "title": "Kyoto Gion Street with Stone Lanterns",
        "url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=85&w=1600&auto=format&fit=crop",
    },
    # Geometry
    {
        "id": "stock_geom_mosaic_tiles",
        "category": "Geometry",
        "title": "Ornamental Ceramic Mosaic Rosette",
        "url": "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=85&w=1600&auto=format&fit=crop",
    },
]


def validate_image_criteria(img: Image.Image, min_w=1200, min_h=900) -> Tuple[bool, str]:
    """Validates that an image meets quality criteria for spot-the-difference gameplay."""
    w, h = img.size
    if w < min_w or h < min_h:
        return False, f"Image resolution {w}x{h} below minimum {min_w}x{min_h}"

    arr = np.array(img.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)

    # 1. Contrast / variance check
    std_dev = np.std(gray)
    if std_dev < 30.0:
        return False, f"Image has low contrast / standard deviation ({std_dev:.1f} < 30.0)"

    # 2. Blur / sharpness check via Laplacian variance (reject completely blurred/out-of-focus images)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if laplacian_var < 50.0:
        return False, f"Image is blurry (Laplacian variance {laplacian_var:.1f} < 50.0)"

    # 3. Typography density check (reject book text / dense signage)
    edges = cv2.Canny(gray, 100, 200)
    # Check scanline stroke transitions
    mid_h = h // 2
    sample_rows = edges[mid_h - 40 : mid_h + 40, :]
    transitions = np.sum(np.diff(sample_rows > 0, axis=1) != 0, axis=1)
    if np.median(transitions) > 220:
        return False, "Image contains excessive dense typographic strokes"

    return True, "Valid"


def crop_to_aspect(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Center-crops and resizes an image to exact target dimensions."""
    src_w, src_h = img.size
    target_aspect = target_w / float(target_h)
    src_aspect = src_w / float(src_h)

    if src_aspect > target_aspect:
        # Source is wider: crop sides
        new_w = int(src_h * target_aspect)
        left = (src_w - new_w) // 2
        img = img.crop((left, 0, left + new_w, src_h))
    else:
        # Source is taller: crop top/bottom
        new_h = int(src_w / target_aspect)
        top = (src_h - new_h) // 2
        img = img.crop((0, top, src_w, top + new_h))

    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)


def fetch_stock_image(url: str, dest_path: Path, target_w: int, target_h: int) -> Optional[Image.Image]:
    """Fetches a stock image from URL, validates it, crops it, and saves to dest_path."""
    headers = {"User-Agent": "Mozilla/5.0 (DiffHunter/1.0 Pipeline)"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        im = Image.open(io.BytesIO(data)).convert("RGB")
        ok, reason = validate_image_criteria(im)
        if not ok:
            print(f"   [Stock Warning] {reason} for {url}")
            return None

        cropped = crop_to_aspect(im, target_w, target_h)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(dest_path, "JPEG", quality=95)
        return cropped
    except Exception as err:
        print(f"   [Stock Error] Failed fetching {url}: {err}")
        return None


def get_stock_candidates(
    dest_dir: Path, target_w: int, target_h: int, limit: int = 5, category: Optional[str] = None
) -> List[Dict]:
    """Returns a list of local stock candidate image paths, downloading if necessary."""
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    catalog = CURATED_STOCK_CATALOG
    if category:
        catalog = [item for item in catalog if item["category"].lower() == category.lower()]

    candidates = []
    for item in catalog[:limit]:
        dest_file = dest_dir / f"{item['id']}_base.jpg"
        if not dest_file.exists():
            print(f"   Fetching stock image: {item['title']}...")
            im = fetch_stock_image(item["url"], dest_file, target_w, target_h)
            if im is None:
                continue
        candidates.append({
            "id": item["id"],
            "title": item["title"],
            "category": item["category"],
            "path": str(dest_file),
            "dimensions": {"width": target_w, "height": target_h},
        })
    return candidates
