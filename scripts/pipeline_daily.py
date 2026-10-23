#!/usr/bin/env python3
"""
Pipeline 2: Daily Challenge Generation & Moderation Pipeline
================================================================================
Generates Gold Standard spot-the-difference pairs formatted for Daily Challenges:
  - In-game dimensions: 4:3 landscape (1200x900 px).
  - Sources: AI-generated images or curated high-resolution free stock images.
  - Flagging & In-Game Review:
      * Stamped with `curationStatus: 'pending'` (gated for in-game debug mode only).
      * Flagged with `dailyOnly: true` and grouped under `setId: 'daily_set_NNN'`.
      * Manifest entry added to public/levels/photo_pair_manifest.json.
  - Strict Batching Gate:
      * Daily challenges MUST be generated and published in exact batches of 3.
      * Base photographs must be unique within each 3-level daily challenge.
      * Approved batches are appended to public/daily-queue.json.

Usage:
  # Generate a 3-level daily challenge batch from AI bases:
  python3 scripts/pipeline_daily.py --source ai --count 3

  # Generate from free stock images:
  python3 scripts/pipeline_daily.py --source stock --count 3

  # Validate and approve a pending daily batch into the daily challenge queue:
  python3 scripts/pipeline_daily.py --approve --set-id daily_set_001 [--push]
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
from stock_image_provider import get_stock_candidates, crop_to_aspect, resolve_base_images
from variant_code import variant_code
from generate_small_structural_variants import process_scene, _review_crop

# Paths
PUBLIC_LEVELS = Path("public/levels")
DAILY_DIR = PUBLIC_LEVELS / "daily"
MANIFEST_PATH = PUBLIC_LEVELS / "photo_pair_manifest.json"
DAILY_QUEUE_PATH = Path("public/daily-queue.json")

# In-Game 4:3 Standard
CANVAS_W, CANVAS_H = 1200, 900
MIN_AREA_FRAC = 0.0006   # 0.06% canvas area
MAX_AREA_FRAC = 0.0035   # 0.35% canvas area
MIN_ISOLATION = 0.55
DAILY_SET_SIZE = 3


def next_daily_set_id(manifest: list) -> str:
    """Finds the next unused daily_set_NNN identifier."""
    used = set()
    for entry in manifest:
        s_id = entry.get("setId", "")
        if s_id.startswith("daily_set_"):
            used.add(s_id)
    for n in range(1, 1000):
        cand = f"daily_set_{n:03d}"
        if cand not in used:
            return cand
    return "daily_set_999"


def validate_daily_batch(levels: List[Dict]) -> Tuple[bool, str]:
    """Validates that a list of levels forms a valid daily challenge batch of 3."""
    if len(levels) % DAILY_SET_SIZE != 0:
        return False, f"Daily challenges must be in multiples of {DAILY_SET_SIZE} (got {len(levels)})"

    # Check distinct base photos within each 3-pack
    for i in range(0, len(levels), DAILY_SET_SIZE):
        chunk = levels[i : i + DAILY_SET_SIZE]
        bases = [l.get("baseImage") for l in chunk]
        if len(set(bases)) != len(bases):
            return False, f"Daily set {i // DAILY_SET_SIZE + 1} contains repeated base photographs"

        for l in chunk:
            if not l.get("dailyOnly"):
                return False, f"Level {l.get('id')} is missing dailyOnly: true flag"
            if not str(l.get("setId", "")).startswith("daily_set_"):
                return False, f"Level {l.get('id')} has invalid setId ({l.get('setId')})"

    return True, "Valid"


def generate_daily_level(
    base_info: dict,
    model: FastSAM,
    set_id: str,
    sequence: int,
    out_dir: Path,
    allow_recolor: bool = False,
) -> Optional[Dict]:
    """Generates a single Gold Standard daily challenge level."""
    rng = np.random.default_rng(sequence * 17)
    variants = process_scene(model, base_info, out_dir, rng, allow_recolor=allow_recolor)
    if not variants:
        return None

    var = variants[0]
    level_id = f"{set_id}_{sequence:02d}"

    orig_base = Path(var["baseImage"])
    orig_var = Path(var["variantImage"])

    daily_base = out_dir / f"{level_id}_base.jpg"
    daily_var = out_dir / f"{level_id}_variant.jpg"

    if orig_base.resolve() != daily_base.resolve() and orig_base.exists():
        daily_base.write_bytes(orig_base.read_bytes())
    if orig_var.resolve() != daily_var.resolve() and orig_var.exists():
        daily_var.write_bytes(orig_var.read_bytes())

    diff = var["diffs"][0]
    entry = {
        "id": level_id,
        "title": f"Daily Challenge #{set_id.replace('daily_set_', '')} - Part {sequence}",
        "category": "Photography",
        "difficulty": "Hard",
        "baseImage": f"levels/daily/{level_id}_base.jpg",
        "variantImage": f"levels/daily/{level_id}_variant.jpg",
        "operation": var.get("operation", "remove"),
        "curationStatus": "pending",  # GATED FOR IN-GAME DEBUG REVIEW
        "dailyOnly": True,
        "setId": set_id,
        "sequence": sequence,
        "dimensions": var.get("dimensions", {"width": CANVAS_W, "height": CANVAS_H}),
        "aspectRatio": "4:3",
        "photoKey": f"levels/daily/{level_id}",
        "diffs": [diff],
        "variantCode": var.get("variantCode", "STR-REM"),
    }
    return entry


def run_daily_pipeline(
    source: str = "ai",
    count: int = 3,
    set_id: str = None,
    allow_recolor: bool = False,
    images: list = None,
) -> List[Dict]:
    """Runs the Daily Challenge generation pipeline in batches of 3."""
    if count % DAILY_SET_SIZE != 0:
        print(f"❌ Error: Daily challenge count must be a multiple of {DAILY_SET_SIZE} (e.g. 3, 6, 9). Got: {count}")
        return []

    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8")) if MANIFEST_PATH.exists() else []

    if not set_id:
        set_id = next_daily_set_id(manifest)

    print("=" * 80)
    print(f"DAILY CHALLENGE PIPELINE: {set_id} ({count} levels)")
    print(f"Source: {source} | Canvas: {CANVAS_W}x{CANVAS_H} (4:3) | Allow Recolor: {allow_recolor} | Status: pending")
    print("=" * 80)

    # 1. Resolve source base images
    print(f"\n[1/3] Resolving {count} base images ({CANVAS_W}x{CANVAS_H})...")
    bases = resolve_base_images(
        source=source,
        target_w=CANVAS_W,
        target_h=CANVAS_H,
        count=count,
        dest_dir=DAILY_DIR / "bases",
        explicit_paths=images,
    )

    if len(bases) < count:
        print(f"❌ Error: Required {count} distinct bases, but only found {len(bases)}. Aborting.")
        return []

    # 2. Run FastSAM + small structural generation
    print(f"\n[2/3] Generating {count} Gold Standard daily levels...")
    model = FastSAM("FastSAM-s.pt")
    generated_levels = []

    for seq, base in enumerate(bases[:count], 1):
        print(f"   -> Generating Part {seq}/{count}: {base['title']}...")
        level_entry = generate_daily_level(base, model, set_id, seq, DAILY_DIR, allow_recolor=allow_recolor)
        if level_entry:
            generated_levels.append(level_entry)
            print(f"   ✓ Part {seq} generated: {level_entry['id']} ({level_entry['variantCode']})")
        else:
            print(f"   ✗ Failed to generate level for {base['title']}")

    # 3. Batch-of-3 Validation Gate
    print(f"\n[3/3] Validating Daily Batch Constraints...")
    ok, reason = validate_daily_batch(generated_levels)
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

    # Generate side-by-side review comparison crops in _pipeline_io/outputs/daily/
    io_output_dir = Path("_pipeline_io/outputs/daily") / set_id
    io_review_dir = io_output_dir / "_review"
    io_review_dir.mkdir(parents=True, exist_ok=True)
    for l in generated_levels:
        b_p = Path("public") / l["baseImage"]
        v_p = Path("public") / l["variantImage"]
        if b_p.exists() and v_p.exists():
            im_a = cv2.imread(str(b_p))
            im_b = cv2.imread(str(v_p))
            diff = l["diffs"][0]
            cx = diff["x"] / 100.0 * CANVAS_W
            cy = diff["y"] / 100.0 * CANVAS_H
            rad = max(25, int(diff["radius"] / 100.0 * CANVAS_W * 1.5))
            bbox = (int(cx - rad), int(cy - rad), int(cx + rad), int(cy + rad))
            _review_crop(im_a, im_b, bbox, io_review_dir / f"{l['id']}_{l['operation']}.jpg")
    (io_output_dir / "set_manifest.json").write_text(json.dumps(generated_levels, indent=2), encoding="utf-8")

    print("\n" + "=" * 80)
    print(f"🎉 Daily Challenge Batch {set_id} created successfully!")
    print(f"   Total Levels:    {len(generated_levels)} (Batch of {DAILY_SET_SIZE})")
    print(f"   Curation Status: pending (Visible in In-Game Review: ?review=1)")
    print(f"   Review Crops:    {io_review_dir}")
    print(f"   Daily Queue:     Run with --approve --set-id {set_id} to publish to daily queue")
    print("=" * 80)
    return generated_levels


def approve_daily_batch(set_id: str, push_to_firebase: bool = False) -> bool:
    """Approves a 3-pack daily challenge and appends it to public/daily-queue.json."""
    if not MANIFEST_PATH.exists():
        print("❌ Manifest not found.")
        return False

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    batch_levels = [e for e in manifest if e.get("setId") == set_id and e.get("dailyOnly")]

    if len(batch_levels) != DAILY_SET_SIZE:
        print(f"❌ Batch approval rejected: {set_id} has {len(batch_levels)} levels (must be exactly {DAILY_SET_SIZE})")
        return False

    # Mark as approved in manifest
    for entry in manifest:
        if entry.get("setId") == set_id and entry.get("dailyOnly"):
            entry["curationStatus"] = "approved"

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"✓ Marked {len(batch_levels)} levels in {set_id} as 'approved'")

    # Append to daily-queue.json
    queue_data = {"updatedAt": "", "schedule": {}, "queue": [], "customLevels": []}
    if DAILY_QUEUE_PATH.exists():
        try:
            queue_data = json.loads(DAILY_QUEUE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    # Add 3-pack item to queue
    level_ids = [l["id"] for l in batch_levels]
    queue_data["queue"].append({
        "setId": set_id,
        "levels": level_ids,
    })
    DAILY_QUEUE_PATH.write_text(json.dumps(queue_data, indent=2) + "\n", encoding="utf-8")
    print(f"✓ Appended 3-pack [{', '.join(level_ids)}] to {DAILY_QUEUE_PATH}")

    if push_to_firebase:
        print("🚀 Pushing to Firebase Firestore...")
        os.system("node scripts/manage_daily_queue.mjs push")

    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default="ai", help="Base image source: 'ai', 'stock', or path to file/folder")
    parser.add_argument("--images", nargs="+", default=None, help="Explicit list of base image file paths")
    parser.add_argument("--count", type=int, default=3, help="Number of levels (multiple of 3)")
    parser.add_argument("--set-id", default=None, help="Target setId (e.g. daily_set_001)")
    parser.add_argument("--allow-recolor", action="store_true", help="Include subtle object recoloring in operations")
    parser.add_argument("--approve", action="store_true", help="Approve and promote a pending daily set to the queue")
    parser.add_argument("--push", action="store_true", help="Push approved queue to Firebase")
    args = parser.parse_args()

    if args.approve:
        if not args.set_id:
            print("❌ Must provide --set-id to approve (e.g. --set-id daily_set_001)")
            sys.exit(1)
        ok = approve_daily_batch(args.set_id, push_to_firebase=args.push)
        sys.exit(0 if ok else 1)
    else:
        run_daily_pipeline(source=args.source, count=args.count, set_id=args.set_id, allow_recolor=args.allow_recolor, images=args.images)


if __name__ == "__main__":
    main()
