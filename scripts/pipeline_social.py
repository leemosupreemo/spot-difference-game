#!/usr/bin/env python3
"""
Pipeline 1: Social Media Variant Generation Pipeline
================================================================================
Generates Gold Standard spot-the-difference pairs formatted for social media:
  - Formats: 2:3 portrait (848x1264 px) or 4:5 portrait (1080x1350 px).
  - Sources: AI-generated images or curated high-resolution free stock images.
  - Review: Generates side-by-side cropped review pairs in _marketing/social_media/<batch>/_review/
  - Output: Full resolution variant assets and metadata manifest for marketing/launch carousels.

Usage:
  # Using AI generated bases (default):
  python3 scripts/pipeline_social.py --source ai --batch-name social_launch

  # Using free stock images:
  python3 scripts/pipeline_social.py --source stock --batch-name stock_social_batch

  # Using a custom folder of source images:
  python3 scripts/pipeline_social.py --source /path/to/images --batch-name custom_social
================================================================================
"""

import argparse
import glob
import json
import math
import os
import sys
from pathlib import Path
from typing import List, Dict

import cv2
import numpy as np
from PIL import Image
from ultralytics import FastSAM

# Add scripts directory to path for imports
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import small_object_editor as E
from perceptual_verification_engine import PerceptualVerificationEngine
from stock_image_provider import get_stock_candidates, crop_to_aspect
from variant_code import variant_code
from generate_small_structural_variants import process_scene, is_text_or_typography, _diff_from_bbox, _bbox, _far_enough, _review_crop

# Constants
SOCIAL_ROOT = Path("_marketing/social_media")
ASPECT_DIMENSIONS = {
    "2:3": (848, 1264),
    "4:5": (1080, 1350),
}

# Strict Gold Standard thresholds
MIN_AREA_FRAC = 0.0006   # 0.06% canvas area
MAX_AREA_FRAC = 0.0038   # 0.38% canvas area
MIN_ISOLATION = 0.55


def generate_scene_variants(
    base_info: dict,
    model: FastSAM,
    out_dir: Path,
    review_dir: Path,
    variants_per_scene: int = 4,
    aspect_ratio: str = "2:3",
) -> List[Dict]:
    """Generates small structural variants for a single social scene."""
    rng = np.random.default_rng(11)
    variants = process_scene(model, base_info, out_dir, rng)
    for v in variants:
        v["aspectRatio"] = aspect_ratio
    return variants[:variants_per_scene]


def run_social_pipeline(
    source: str = "ai",
    batch_name: str = "social_batch",
    aspect: str = "2:3",
    variants_per_scene: int = 4,
    limit: int = 5,
) -> Path:
    """Runs the complete social media variant generation pipeline."""
    target_w, target_h = ASPECT_DIMENSIONS.get(aspect, (848, 1264))
    out_dir = SOCIAL_ROOT / batch_name
    review_dir = out_dir / "_review"
    out_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print(f"SOCIAL MEDIA PIPELINE: {batch_name}")
    print(f"Source: {source} | Aspect: {aspect} ({target_w}x{target_h}) | Variants/Scene: {variants_per_scene}")
    print(f"Output Dir: {out_dir}")
    print("=" * 80)

    # 1. Resolve source base images
    bases = []
    if source == "stock":
        print(f"\n[1/3] Preparing stock base images ({target_w}x{target_h})...")
        stock_dir = out_dir / "stock_bases"
        candidates = get_stock_candidates(stock_dir, target_w, target_h, limit=limit)
        bases = candidates
    elif source == "ai":
        print(f"\n[1/3] Sourcing AI base images...")
        ai_existing = sorted(glob.glob("_marketing/social_media/social_15_base_batch/*.jpg"))
        # Exclude existing variants
        ai_bases = [f for f in ai_existing if "_var" not in f and "_alt" not in f]
        for f in ai_bases[:limit]:
            p = Path(f)
            # Ensure exact target size
            im = Image.open(p)
            if im.size != (target_w, target_h):
                im = crop_to_aspect(im, target_w, target_h)
                norm_path = out_dir / f"{p.stem}_base.jpg"
                im.save(norm_path, "JPEG", quality=95)
                f = str(norm_path)
            bases.append({
                "id": p.stem,
                "title": p.stem.replace("_", " ").title(),
                "path": f,
                "dimensions": {"width": target_w, "height": target_h},
            })
    else:
        # Custom directory or file
        p = Path(source)
        if p.is_dir():
            files = sorted(glob.glob(str(p / "*.jpg")) + glob.glob(str(p / "*.png")))
            for f in files[:limit]:
                stem = Path(f).stem
                bases.append({"id": stem, "title": stem.title(), "path": f})
        elif p.is_file():
            bases.append({"id": p.stem, "title": p.stem.title(), "path": str(p)})

    if not bases:
        print("✗ No valid base images found. Aborting.")
        return out_dir

    print(f"✓ Found {len(bases)} base images to process.")

    # 2. Run FastSAM and small object editor
    print("\n[2/3] Generating Gold Standard structural variants...")
    model = FastSAM("FastSAM-s.pt")
    all_variants = []

    for idx, base in enumerate(bases, 1):
        print(f"\n[{idx:02d}/{len(bases):02d}] {base['id']}")
        scene_variants = generate_scene_variants(
            base,
            model,
            out_dir,
            review_dir,
            variants_per_scene=variants_per_scene,
            aspect_ratio=aspect,
        )
        all_variants.extend(scene_variants)

    # 3. Save manifest
    manifest_path = out_dir / f"{batch_name}_manifest.json"
    manifest_data = {
        "pipeline": "social_media",
        "batchName": batch_name,
        "aspectRatio": aspect,
        "dimensions": {"width": target_w, "height": target_h},
        "variantCount": len(all_variants),
        "reviewDir": str(review_dir),
        "variants": all_variants,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    print("\n" + "=" * 80)
    print(f"🎉 Social Pipeline Complete! Generated {len(all_variants)} verified variants.")
    print(f"📁 Review Crops: {review_dir}")
    print(f"📄 Manifest:    {manifest_path}")
    print("=" * 80)
    return manifest_path


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default="ai", choices=["ai", "stock"], help="Source of base images (ai, stock, or path)")
    parser.add_argument("--batch-name", default="social_launch_batch", help="Name of output batch directory")
    parser.add_argument("--aspect", default="2:3", choices=["2:3", "4:5"], help="Aspect ratio (2:3 or 4:5)")
    parser.add_argument("--variants-per-scene", type=int, default=4, help="Target variants per scene")
    parser.add_argument("--limit", type=int, default=3, help="Max base images to process")
    args = parser.parse_args()

    run_social_pipeline(
        source=args.source,
        batch_name=args.batch_name,
        aspect=args.aspect,
        variants_per_scene=args.variants_per_scene,
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
