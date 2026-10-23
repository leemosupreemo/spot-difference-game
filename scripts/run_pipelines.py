#!/usr/bin/env python3
"""
Diff Hunter Multi-Pipeline Suite CLI
================================================================================
Unified CLI for the 3 Diff Hunter variant generation pipelines:
  1. social:  Social media sizes (2:3 or 4:5), exports to _marketing/social_media/ with review crops.
  2. daily:   Daily challenge sizes (4:3), pending review gate, strict batches of 3, daily queue sync.
  3. regular: Regular photography sets (4:3), pending review gate, strict batches of 5.

All 3 pipelines support starting with AI-generated images or curated free stock images.

Usage:
  # Check pipeline status & pending review queues:
  python3 scripts/run_pipelines.py status

  # Social Media Pipeline:
  python3 scripts/run_pipelines.py social --source [ai|stock] --batch-name [name] --aspect [2:3|4:5]

  # Daily Challenge Pipeline (Batches of 3):
  python3 scripts/run_pipelines.py daily --source [ai|stock] --count 3
  python3 scripts/run_pipelines.py approve-daily --set-id daily_set_001 [--push]

  # Regular Set Pipeline (Batches of 5):
  python3 scripts/run_pipelines.py regular --source [ai|stock] --count 5
  python3 scripts/run_pipelines.py approve-regular --set-id photo_set_025
================================================================================
"""

import argparse
import glob
import json
import sys
from pathlib import Path

# Add scripts directory to path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from pipeline_social import run_social_pipeline
from pipeline_daily import run_daily_pipeline, approve_daily_batch
from pipeline_regular import run_regular_pipeline, approve_regular_batch

MANIFEST_PATH = Path("public/levels/photo_pair_manifest.json")
DAILY_QUEUE_PATH = Path("public/daily-queue.json")
SOCIAL_ROOT = Path("_marketing/social_media")


def print_status():
    """Prints a clear overview of all 3 pipelines and their queues."""
    print("=" * 80)
    print("DIFF HUNTER PIPELINE STATUS DASHBOARD")
    print("=" * 80)

    # Input Folders Staged
    def count_inputs(sub: str) -> int:
        p = Path(f"_pipeline_io/inputs/{sub}")
        if not p.exists():
            return 0
        return len([f for f in p.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png") and not f.name.startswith(".")])

    in_soc, in_dai, in_reg = count_inputs("social"), count_inputs("daily"), count_inputs("regular")
    print("\n[Input Drop Folders (_pipeline_io/inputs/)]")
    print(f"  📁 inputs/daily/   : {in_dai} image(s) staged {'(Ready for batch of 3!)' if in_dai >= 3 else '(Drop 3 images here or use --source)'}")
    print(f"  📁 inputs/regular/ : {in_reg} image(s) staged {'(Ready for batch of 5!)' if in_reg >= 5 else '(Drop 5 images here or use --source)'}")
    print(f"  📁 inputs/social/  : {in_soc} image(s) staged")

    # 1. Social Media Status
    social_batches = sorted([d.name for d in SOCIAL_ROOT.iterdir() if d.is_dir() and not d.name.startswith(".")])
    print("\n[Pipeline 1: Social Media]")
    print(f"  Active Batches ({len(social_batches)}): {', '.join(social_batches[:5])}")
    total_social_crops = len(glob.glob(str(SOCIAL_ROOT / "*/*_review/*.jpg")))
    print(f"  Review Crops Available: {total_social_crops}")

    # 2. In-Game Manifest & Pending Review
    manifest = []
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    pending_daily = [e for e in manifest if e.get("curationStatus") == "pending" and e.get("dailyOnly")]
    pending_regular = [e for e in manifest if e.get("curationStatus") == "pending" and not e.get("dailyOnly")]
    approved_total = [e for e in manifest if e.get("curationStatus") == "approved" or "curationStatus" not in e]

    print("\n[Pipeline 2: Daily Challenge (Batch of 3)]")
    daily_sets = {e.get("setId") for e in pending_daily}
    print(f"  Pending In-Game Review: {len(pending_daily)} levels ({len(daily_sets)} sets: {', '.join(sorted(daily_sets)) if daily_sets else 'None'})")

    daily_queue_count = 0
    if DAILY_QUEUE_PATH.exists():
        try:
            q = json.loads(DAILY_QUEUE_PATH.read_text(encoding="utf-8"))
            daily_queue_count = len(q.get("queue", []))
        except Exception:
            pass
    print(f"  Queued Daily 3-Packs:   {daily_queue_count} scheduled / unrepeated sets")

    print("\n[Pipeline 3: Regular Sets (Batch of 5)]")
    reg_sets = {e.get("setId") for e in pending_regular}
    print(f"  Pending In-Game Review: {len(pending_regular)} levels ({len(reg_sets)} sets: {', '.join(sorted(reg_sets)) if reg_sets else 'None'})")
    print(f"  Live Approved Levels:   {len(approved_total)} levels in production rotation")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Status
    subparsers.add_parser("status", help="Show overview of all 3 pipelines and queues")

    # Social Subcommand
    p_soc = subparsers.add_parser("social", help="Run Social Media Pipeline (2:3 or 4:5)")
    p_soc.add_argument("--source", default="ai", help="Image source: 'ai', 'stock', or path to file/folder")
    p_soc.add_argument("--images", nargs="+", default=None, help="Explicit list of base image file paths")
    p_soc.add_argument("--batch-name", default="social_batch", help="Output batch folder name")
    p_soc.add_argument("--aspect", default="2:3", choices=["2:3", "4:5"], help="Aspect ratio")
    p_soc.add_argument("--variants-per-scene", type=int, default=4, help="Target variants per image")
    p_soc.add_argument("--limit", type=int, default=3, help="Max base images to process")
    p_soc.add_argument("--allow-recolor", action="store_true", help="Include subtle object recoloring in operations")

    # Daily Subcommand
    p_dai = subparsers.add_parser("daily", help="Run Daily Challenge Pipeline (Batch of 3)")
    p_dai.add_argument("--source", default="ai", help="Image source: 'ai', 'stock', or path to file/folder")
    p_dai.add_argument("--images", nargs="+", default=None, help="Explicit list of base image file paths")
    p_dai.add_argument("--count", type=int, default=3, help="Number of levels (multiple of 3)")
    p_dai.add_argument("--set-id", default=None, help="Target setId (e.g. daily_set_001)")
    p_dai.add_argument("--allow-recolor", action="store_true", help="Include subtle object recoloring in operations")

    # Approve Daily Subcommand
    p_app_d = subparsers.add_parser("approve-daily", help="Approve and queue a pending 3-pack daily set")
    p_app_d.add_argument("--set-id", required=True, help="Set ID to approve (e.g. daily_set_001)")
    p_app_d.add_argument("--push", action="store_true", help="Push to Firebase Firestore immediately")

    # Regular Subcommand
    p_reg = subparsers.add_parser("regular", help="Run Regular Set Pipeline (Batch of 5)")
    p_reg.add_argument("--source", default="ai", help="Image source: 'ai', 'stock', or path to file/folder")
    p_reg.add_argument("--images", nargs="+", default=None, help="Explicit list of base image file paths")
    p_reg.add_argument("--count", type=int, default=5, help="Number of levels (multiple of 5)")
    p_reg.add_argument("--set-id", default=None, help="Target setId (e.g. photo_set_025)")
    p_reg.add_argument("--difficulty", default="Medium", choices=["Easy", "Medium", "Hard"], help="Difficulty level")
    p_reg.add_argument("--allow-recolor", action="store_true", help="Include subtle object recoloring in operations")

    # Approve Regular Subcommand
    p_app_r = subparsers.add_parser("approve-regular", help="Approve and promote a pending 5-pack regular set")
    p_app_r.add_argument("--set-id", required=True, help="Set ID to approve (e.g. photo_set_025)")

    args = parser.parse_args()

    if args.command == "status":
        print_status()
    elif args.command == "social":
        run_social_pipeline(
            source=args.source,
            batch_name=args.batch_name,
            aspect=args.aspect,
            variants_per_scene=args.variants_per_scene,
            limit=args.limit,
            allow_recolor=args.allow_recolor,
            images=args.images,
        )
    elif args.command == "daily":
        run_daily_pipeline(source=args.source, count=args.count, set_id=args.set_id, allow_recolor=args.allow_recolor, images=args.images)
    elif args.command == "approve-daily":
        approve_daily_batch(args.set_id, push_to_firebase=args.push)
    elif args.command == "regular":
        run_regular_pipeline(source=args.source, count=args.count, set_id=args.set_id, difficulty=args.difficulty, allow_recolor=args.allow_recolor, images=args.images)
    elif args.command == "approve-regular":
        approve_regular_batch(args.set_id)


if __name__ == "__main__":
    main()
