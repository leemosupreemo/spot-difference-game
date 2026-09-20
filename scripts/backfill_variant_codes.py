#!/usr/bin/env python3
"""Add a derived `variantCode` to every manifest entry.

Purely additive and idempotent. Nothing is guessed: an entry whose operation is
absent from both the entry and its diffs becomes `???-???` so the gap stays
visible instead of being papered over with a plausible-looking label.

Scene ids and asset paths are never touched -- ids are external handles carried
in shared challenge URLs.
"""
import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from variant_code import variant_code, is_complete


def infer_operation(entry):
    """Operation from the entry, else from a diff that agrees with itself."""
    if entry.get("operation"):
        return entry["operation"]
    operations = {d.get("operation") for d in entry.get("diffs") or [] if d.get("operation")}
    # Only a single unambiguous operation may stand in for the entry's own.
    return operations.pop() if len(operations) == 1 else None


def backfill_entries(entries):
    updated, stats = [], {"coded": 0, "unknown": 0, "operation_recovered": 0}
    for entry in entries:
        entry = dict(entry)
        if not entry.get("operation"):
            recovered = infer_operation(entry)
            if recovered:
                entry["operation"] = recovered
                stats["operation_recovered"] += 1
        code = variant_code(entry)
        entry["variantCode"] = code
        stats["coded" if is_complete(code) else "unknown"] += 1
        updated.append(entry)
    return updated, stats


def write_atomic(path, payload):
    path = Path(path)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", nargs="?", default="public/levels/photo_pair_manifest.json")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry run).")
    args = parser.parse_args()

    entries = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    updated, stats = backfill_entries(entries)

    print(f"entries:              {len(updated)}")
    print(f"complete codes:       {stats['coded']}")
    print(f"unknown (???-???):    {stats['unknown']}")
    print(f"operation recovered:  {stats['operation_recovered']} (from diffs)")
    if stats["unknown"]:
        print("\nUnknown entries need their operation recorded by hand:")
        for entry in updated:
            if not is_complete(entry["variantCode"]):
                print(f"  {entry['id']}")

    if args.apply:
        write_atomic(args.manifest, updated)
        print(f"\nWrote {args.manifest}")
    else:
        print("\nDry run. Re-run with --apply to write.")


if __name__ == "__main__":
    main()
