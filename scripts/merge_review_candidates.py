#!/usr/bin/env python3
"""Merge pending review candidates into the app manifest for debug review.

Only entries marked `curationStatus: pending` are merged, and an id already in
the target manifest is never overwritten -- a collision aborts the whole merge
rather than silently replacing a live level. Assets are copied, not moved, so
the source review directory stays intact and the merge can be undone.

Merged levels are gated by src/utils/pendingLevelGate.js: visible in debug for
review, hidden from production until a curator approves them.
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from variant_code import variant_code


def load(path):
    path = Path(path)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def write_atomic(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def plan_merge(source_entries, target_entries):
    pending = [e for e in source_entries if e.get("curationStatus") == "pending"]
    existing = {e["id"] for e in target_entries}
    collisions = sorted({e["id"] for e in pending} & existing)
    return pending, collisions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="build/full-run-review/manifest.json")
    parser.add_argument("--source-root", default="build/full-run-review")
    parser.add_argument("--target", default="public/levels/photo_pair_manifest.json")
    parser.add_argument("--target-root", default="public")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry run).")
    args = parser.parse_args()

    source, target = load(args.source), load(args.target)
    pending, collisions = plan_merge(source, target)

    print(f"source entries:   {len(source)}")
    print(f"pending to merge: {len(pending)}")
    print(f"target entries:   {len(target)}")

    if collisions:
        print(f"\nABORT: {len(collisions)} id(s) already exist in the target:")
        for cid in collisions[:10]:
            print(f"  {cid}")
        return 1

    total = 0
    for entry in pending:
        for key in ("baseImage", "variantImage"):
            src = Path(args.source_root) / entry[key]
            if not src.exists():
                print(f"\nABORT: missing asset {src}")
                return 1
            total += src.stat().st_size

    print(f"assets to copy:   {total / 1e6:.1f} MB")
    codes = sorted({variant_code(e) for e in pending})
    print(f"variant codes:    {', '.join(codes)}")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    copied = []
    try:
        for entry in pending:
            for key in ("baseImage", "variantImage"):
                src = Path(args.source_root) / entry[key]
                dest = Path(args.target_root) / entry[key]
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)
                copied.append(dest)
        write_atomic(args.target, target + [dict(e, variantCode=variant_code(e)) for e in pending])
    except Exception:
        for path in copied:
            path.unlink(missing_ok=True)
        raise

    print(f"\nMerged {len(pending)} pending entries into {args.target}")
    print("They are debug-only until approved (src/utils/pendingLevelGate.js).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
