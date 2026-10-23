#!/usr/bin/env python3
"""
Downloads the 15 curated free-use stock images from Unsplash into _marketing/social_media/free_use_15_base_batch/.
Sizes them to exact 2:3 social portrait format (848x1264 px).
"""

import os
import urllib.request
from PIL import Image
import io

DEST_DIR = "_marketing/social_media/free_use_15_base_batch"
os.makedirs(DEST_DIR, exist_ok=True)

CURATED_SOURCES = [
    ("free_01_arch_bakery", "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=85&w=848&h=1264&auto=format&fit=crop", "Artisan Bakery Display"),
    ("free_02_arch_bookshop", "https://images.unsplash.com/photo-1526243741027-444d633d7365?q=85&w=848&h=1264&auto=format&fit=crop", "Vintage Bookshop Exterior"),
    ("free_03_arch_venetian", "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?q=85&w=848&h=1264&auto=format&fit=crop", "Venetian Canal House"),
    ("free_04_arch_cinema", "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=85&w=848&h=1264&auto=format&fit=crop", "Classic Cinema Marquee"),
    ("free_05_col_macarons", "https://images.unsplash.com/photo-1569864358642-9d1684040f43?q=85&w=848&h=1264&auto=format&fit=crop", "Rainbow Macaron Collection"),
    ("free_06_col_apothecary", "https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=85&w=848&h=1264&auto=format&fit=crop", "Vintage Apothecary Bottles"),
    ("free_07_col_spices", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=85&w=848&h=1264&auto=format&fit=crop", "Organized Heirloom Spice Bowls"),
    ("free_08_col_craft_buttons", "https://images.unsplash.com/photo-1544816155-12df9643f363?q=85&w=848&h=1264&auto=format&fit=crop", "Craft Notions and Spools"),
    ("free_09_food_brunch", "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=85&w=848&h=1264&auto=format&fit=crop", "Gourmet Table Breakfast Spread"),
    ("free_10_food_patisserie", "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=85&w=848&h=1264&auto=format&fit=crop", "French Croissants and Tarts"),
    ("free_11_food_pizza", "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=85&w=848&h=1264&auto=format&fit=crop", "Artisan Wood-Fired Pizza"),
    ("free_12_animal_dog", "https://images.unsplash.com/photo-1552053831-71594a27632d?q=85&w=848&h=1264&auto=format&fit=crop", "Golden Retriever Portrait"),
    ("free_13_street_kyoto", "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=85&w=848&h=1264&auto=format&fit=crop", "Historic Kyoto Gion Street"),
    ("free_14_street_santorini", "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=85&w=848&h=1264&auto=format&fit=crop", "Santorini Stepped Alleyway"),
    ("free_15_geom_mosaic", "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=85&w=848&h=1264&auto=format&fit=crop", "Ceramic Mosaic Tile Rosette")
]

headers = {"User-Agent": "Mozilla/5.0"}
print(f"Downloading 15 free-use base images to {DEST_DIR}...")

for idx, (cid, url, title) in enumerate(CURATED_SOURCES, 1):
    dest_path = os.path.join(DEST_DIR, f"{cid}_base.jpg")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            im = Image.open(io.BytesIO(data))
            # Ensure exact 848x1264
            if im.size != (848, 1264):
                im = im.resize((848, 1264), Image.Resampling.LANCZOS)
            im.save(dest_path, "JPEG", quality=95)
            print(f"[{idx:02d}/15] ✓ Saved: {cid}_base.jpg ({im.size[0]}x{im.size[1]}) - {title}")
    except Exception as e:
        print(f"[{idx:02d}/15] ✗ Failed: {cid} - {e}")

print("Download phase complete!")
