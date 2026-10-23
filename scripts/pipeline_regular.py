#!/usr/bin/env python3
"""
Pipeline 3: Regular Set Generation & Moderation Pipeline
================================================================================
Generates Gold Standard spot-the-difference pairs formatted for Regular Photography Sets:
  - In-game dimensions: 4:3 landscape (1200x900 px).
  - Sources: AI-generated images or curated high-resolution free stock images.
  - Flagging & In-Game Review:
      * Stamped with `curationStatus: 'pending'` (gated for in-game debug mode only).
      * Organized into sets of 5 (canonical set size: SET_SIZE = 5).
      * Distinct base photographs per set of 5 (no repeated photos within a set).
  - Strict Batching Gate:
      * Regular sets MUST be generated and published in exact batches of 5.
      * Promotes to active gameplay upon approval.

Usage:
  # Generate a 5-level regular set from AI bases:
  python3 scripts/pipeline_regular.py --source ai --count 5

  # Generate from free stock images:
  python3 scripts/pipeline_regular.py --source stock --count 5

  # Validate and approve a pending set for live production gameplay:
  python3 scripts/pipeline_regular.py --approve --set-id photo_set_025
================================================================================
"""

import argparse
import glob
import json
import math
import os
import sys
from pathlib import Path
from typing import List, Dict, Tuple

import cv2
import numpy as np
from PIL import Image
from ultralytics import FastSAM

# Add scripts directory to path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import small_object_editor as E
from perceptual_verification_engine import PerceptualVerificationEngine
from stock_image_provider import get_stock_candidates, crop_to_aspect
from variant_code import variant_code
from generate_small_structural_variants import process_scene

# Paths
PUBLIC_LEVELS = Path("public/levels")
REGULAR_DIR = PUBLIC_LEVELS
MANIFEST_PATH = PUBLIC_LEVELS / "photo_pair_manifest.json"

# In-Game 4:3 Standard
CANVAS_W, CANVAS_H = 1200, 900
MIN_AREA_FRAC = 0.0006   # 0.06% canvas area
MAX_AREA_FRAC = 0.0035   # 0.35% canvas area
MIN_ISOLATION = 0.55
REGULAR_SET_SIZE = 5


def next_regular_set_id(manifest: list) -> str:
    """Finds the next unused photo_set_NNN identifier."""
    used = set()
    for entry in manifest:
        s_id = entry.get("setId", "")
        if s_id.startswith("photo_set_"):
            used.add(s_id)
    for n in range(1, 1000):
        cand = f"photo_set_{n:03d}"
        if cand not in used:
            return cand
    return "photo_set_999"


def validate_regular_batch(levels: List[Dict]) -> Tuple[bool, str]:
    """Validates that a list of levels forms valid regular sets of 5."""
    if len(levels) % REGULAR_SET_SIZE != 0:
        return False, f"Regular sets must be in multiples of {REGULAR_SET_SIZE} (got {len(levels)})"

    # Check distinct base photos within each 5-pack
    for i in range(0, len(levels), REGULAR_SET_SIZE):
        chunk = levels[i : i + REGULAR_SET_SIZE]
        bases = [l.get("baseImage") for l in chunk]
        if len(set(bases)) != len(bases):
            return False, f"Regular set {i // REGULAR_SET_SIZE + 1} contains repeated base photographs"

        for seq, l in enumerate(chunk, 1):
            if l.get("sequence") != seq:
                return False, f"Level {l.get('id')} has sequence {l.get('sequence')}, expected {seq}"

    return True, "Valid"


def generate_regular_level(
    base_info: dict,
    model: FastSAM,
    set_id: str,
    sequence: int,
    out_dir: Path,
    difficulty: str = "Medium",
) -> Optional[Dict]:
    """Generates a single Gold Standard regular set level."""
    rng = np.random.default_rng(sequence * 23)
    variants = process_scene(model, base_info, out_dir, rng)
    if not variants:
        return None

    var = variants[0]
    level_id = f"{set_id}_{sequence:02d}"

    orig_base = Path(var["baseImage"])
    orig_var = Path(var["variantImage"])

    reg_base = out_dir / f"{level_id}_base.jpg"
    reg_var = out_dir / f"{level_id}_variant.jpg"

    if orig_base.resolve() != reg_base.resolve() and orig_base.exists():
        reg_base.write_bytes(orig_base.read_bytes())
    if orig_var.resolve() != reg_var.resolve() and orig_var.exists():
        reg_var.write_bytes(orig_var.read_bytes())

    diff = var["diffs"][0]
    entry = {
        "id": level_id,
        "title": f"{base_info.get('title', 'Photography Level')} (Part {sequence})",
        "category": "Photography",
        "pack": "Find the Sniper",
        "packId": "find_the_sniper",
        "difficulty": difficulty,
        "baseImage": f"levels/{level_id}_base.jpg",
        "variantImage": f"levels/{level_id}_variant.jpg",
        "operation": var.get("operation", "remove"),
        "curationStatus": "pending",  # GATED FOR IN-GAME DEBUG REVIEW
        "setId": set_id,
        "sequence": sequence,
        "dimensions": var.get("dimensions", {"width": CANVAS_W, "height": CANVAS_H}),
        "aspectRatio": "4:3",
        "photoKey": f"levels/{level_id}",
        "diffs": [diff],
        "variantCode": var.get("variantCode", "STR-REM"),
    }
    return entry


def run_regular_pipeline(
    source: str = "ai",
    count: int = 5,
    set_id: str = None,
    difficulty: str = "Medium",
) -> List[Dict]:
    """Runs the Regular Set generation pipeline in batches of 5."""
    if count % REGULAR_SET_SIZE != 0:
        print(f"❌ Error: Regular set count must be a multiple of {REGULAR_SET_SIZE} (e.g. 5, 10). Got: {count}")
        return []

    REGULAR_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8")) if MANIFEST_PATH.exists() else []

    if not set_id:
        set_id = next_regular_set_id(manifest)

    print("=" * 80)
    print(f"REGULAR SET PIPELINE: {set_id} ({count} levels)")
    print(f"Source: {source} | Canvas: {CANVAS_W}x{CANVAS_H} (4:3) | Status: pending (debug-only)")
    print("=" * 80)

    # 1. Fetch base images
    bases = []
    if source == "stock":
        print(f"\n[1/3] Sourcing {count} high-resolution 4:3 stock images...")
        stock_dir = REGULAR_DIR / "stock_bases"
        bases = get_stock_candidates(stock_dir, CANVAS_W, CANVAS_H, limit=count)
    else:
        print(f"\n[1/3] Sourcing {count} 4:3 AI base images...")
        existing = sorted(glob.glob("public/levels/*_base.jpg"))
        for f in existing[:count]:
            p = Path(f)
            im = Image.open(p)
            if im.size != (CANVAS_W, CANVAS_H):
                im = crop_to_aspect(im, CANVAS_W, CANVAS_H)
                dest = REGULAR_DIR / f"{p.stem}.jpg"
                im.save(dest, "JPEG", quality=92)
                f = str(dest)
            bases.append({"id": p.stem, "title": p.stem.title(), "path": f})

    if len(bases) < count:
        print(f"❌ Error: Required {count} distinct bases, but only found {len(bases)}. Aborting.")
        return []

    # 2. Run FastSAM + small structural generation
    print(f"\n[2/3] Generating {count} Gold Standard regular levels...")
    model = FastSAM("FastSAM-s.pt")
    generated_levels = []

    for seq, base in enumerate(bases[:count], 1):
        print(f"   -> Generating Part {seq}/{count}: {base['title']}...")
        level_entry = generate_regular_level(base, model, set_id, seq, REGULAR_DIR, difficulty=difficulty)
        if level_entry:
            generated_levels.append(level_entry)
            print(f"   ✓ Part {seq} generated: {level_entry['id']} ({level_entry['variantCode']})")
        else:
            print(f"   ✗ Failed to generate level for {base['title']}")

    # 3. Batch-of-5 Validation Gate
    print(f"\n[3/3] Validating Regular Set Batch Constraints...")
    ok, reason = validate_regular_batch(generated_levels)
    if not ok:
        print(f"❌ Batch Validation FAILED: {reason}. Rolling back.")
        for l in generated_levels:
            (Path("public") / l["baseImage"]).unlink(missing_ok=True)
            (Path("public") / l["variantImage"]).unlink(missing_ok=True)
        return []

    # Add to manifest with curationStatus: 'pending' (debug-only review)
    existing_ids = {e["id"] for e in manifest}
    filtered_new = [l for l in generated_levels if l["id"] not in existing_ids]
    updated_manifest = manifest + filtered_new
    MANIFEST_PATH.write_text(json.dumps(updated_manifest, indent=2), encoding="utf-8")

    print("\n" + "=" * 80)
    print(f"🎉 Regular Set {set_id} created successfully!")
    print(f"   Total Levels:    {len(generated_levels)} (Batch of {REGULAR_SET_SIZE})")
    print(f"   Curation Status: pending (Visible in In-Game Review: ?review=1)")
    print(f"   Promotion:       Run with --approve --set-id {set_id} to promote to live gameplay")
    print("=" * 80)
    return generated_levels


def approve_regular_batch(set_id: str) -> bool:
    """Approves a 5-pack regular set and promotes it for live production gameplay."""
    if not MANIFEST_PATH.exists():
        print("❌ Manifest not found.")
        return False

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    batch_levels = [e for e in manifest if e.get("setId") == set_id and not e.get("dailyOnly")]

    if len(batch_levels) != REGULAR_SET_SIZE:
        print(f"❌ Batch approval rejected: {set_id} has {len(batch_levels)} levels (must be exactly {REGULAR_SET_SIZE})")
        return False

    # Mark as approved in manifest
    for entry in manifest:
        if entry.get("setId") == set_id and not entry.get("dailyOnly"):
            entry["curationStatus"] = "approved"

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"✓ Marked {len(batch_levels)} levels in {set_id} as 'approved' (Live in production play)")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default="ai", choices=["ai", "stock"], help="Base image source")
    parser.add_argument("--count", type=int, default=5, help="Number of levels (multiple of 5)")
    parser.add_argument("--set-id", default=None, help="Target setId (e.g. photo_set_025)")
    parser.add_argument("--difficulty", default="Medium", choices=["Easy", "Medium", "Hard"], help="Difficulty")
    parser.add_argument("--approve", action="store_true", help="Approve and promote a pending set to live gameplay")
    args = parser.parse_args()

    if args.approve:
        if not args.set_id:
            print("❌ Must provide --set-id to approve (e.g. --set-id photo_set_025)")
            sys.exit(1)
        ok = approve_regular_batch(args.set_id)
        sys.exit(0 if ok else 1)
    else:
        run_regular_pipeline(source=args.source, count=args.count, set_id=args.set_id, difficulty=args.difficulty)


if __name__ == "__main__":
    main()
