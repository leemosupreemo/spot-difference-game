#!/usr/bin/env python3
"""Collapse duplicate base images to one content-addressed file per photo.

Every variant of one photo references an identical base image stored under its
own filename. This rewrites those references to a single `<digest>_base.<ext>`
file and deletes the redundant copies.

Safety: a file is only removed once the manifest no longer references it, the
manifest is written atomically before any deletion, and a base whose bytes do
not match its group is left alone rather than merged.
"""
import argparse
import hashlib
import json
import os
import sys
import tempfile
from collections import defaultdict
from pathlib import Path


def digest(path):
    hasher = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            hasher.update(chunk)
    return hasher.hexdigest()[:12]


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


def relative_asset(reference):
    """Manifest paths appear as both 'levels/x.jpg' and '/levels/x.jpg'.
    A leading slash would make Path() absolute and silently escape the root."""
    return str(reference).split("?")[0].lstrip("/")


def plan(entries, root):
    """Group base references by content. Returns (plan, skipped, missing)."""
    groups, missing = defaultdict(list), []
    for entry in entries:
        rel = entry.get("baseImage")
        if not rel:
            continue
        rel = relative_asset(rel)
        path = Path(root) / rel
        if not path.exists():
            missing.append(rel)
            continue
        groups[(digest(path), path.suffix)].append((entry, rel, path))

    actions, skipped = [], []
    for (content, suffix), members in groups.items():
        canonical_rel = f"{Path(members[0][1]).parent.as_posix()}/{content}_base{suffix}"
        canonical_path = Path(root) / canonical_rel
        # Only merge files that genuinely live side by side.
        if len({Path(rel).parent for _, rel, _ in members}) != 1:
            skipped.append(content)
            continue
        # members[0] is renamed into the canonical slot, so it is not redundant.
        # Everything after it is a duplicate copy that gets deleted.
        actions.append({
            "digest": content,
            "canonical_rel": canonical_rel,
            "canonical_path": canonical_path,
            "members": members,
            "canonical_source": members[0][2],
            "redundant": [path for _entry, _rel, path in members[1:]],
        })
    return actions, skipped, missing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default="public/levels/photo_pair_manifest.json")
    parser.add_argument("--root", default="public")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry run).")
    args = parser.parse_args()

    entries = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    actions, skipped, missing = plan(entries, args.root)

    duplicated = [a for a in actions if len(a["members"]) > 1]
    reclaimed = sum(p.stat().st_size for a in duplicated for p in a["redundant"] if p.exists())

    print(f"manifest entries:      {len(entries)}")
    print(f"distinct base images:  {len(actions)}")
    print(f"photos with dupes:     {len(duplicated)}")
    print(f"redundant files:       {sum(len(a['redundant']) for a in duplicated)}")
    print(f"space reclaimed:       {reclaimed / 1e6:.1f} MB")
    if missing:
        print(f"missing on disk:       {len(missing)} (left untouched)")
    if skipped:
        print(f"skipped (split dirs):  {len(skipped)}")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    # 1. Materialize every canonical file first.
    for action in actions:
        if not action["canonical_path"].exists():
            os.replace(action["canonical_source"], action["canonical_path"])

    # 2. Repoint the manifest and write it atomically.
    rewritten = {}
    for action in actions:
        for entry, _rel, _path in action["members"]:
            rewritten[entry["id"]] = action["canonical_rel"]
    updated = [dict(e, **({"baseImage": rewritten[e["id"]]} if e.get("id") in rewritten else {}))
               for e in entries]
    write_atomic(args.manifest, updated)

    # 3. Only now delete files nothing references.
    referenced = {relative_asset(e.get("baseImage") or "") for e in updated}
    referenced |= {relative_asset(e.get("variantImage") or "") for e in updated}
    removed = 0
    for action in actions:
        for path in action["redundant"]:
            rel = path.relative_to(args.root).as_posix()
            if path.exists() and rel not in referenced:
                path.unlink()
                removed += 1

    print(f"\nRewrote {args.manifest}; removed {removed} redundant base files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
