"""Structural-pipeline handoff and atomic publication of a finalized pair.

Publication never overwrites a currently registered asset: destination
filenames are derived from the scene id plus a content digest, so
republishing a scene id with different image content always lands on a new
path. The manifest is the single source of truth for what is "published" --
files are copied into place first, and only a successful atomic manifest
replace makes them live. If manifest replacement fails, only the files this
call just copied are rolled back; anything already registered is untouched.
"""

import hashlib
import json
import os
from pathlib import Path

from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY
from image_pair_finalizer import finalize_pair

_DIGEST_LENGTH = 12


def _content_digest(path, length: int = _DIGEST_LENGTH) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()[:length]


def _atomic_copy_into_place(source_path, dest_path: Path) -> None:
    tmp_path = dest_path.with_name(f".{dest_path.name}.tmp")
    with open(source_path, "rb") as src, open(tmp_path, "wb") as dst:
        dst.write(src.read())
    os.replace(tmp_path, dest_path)


def _replace_manifest_entry(manifest_path, scene_id: str, entry: dict, replace_fn) -> None:
    manifest_path = Path(manifest_path)
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = []

    manifest = [existing for existing in manifest if existing.get("id") != scene_id]
    manifest.insert(0, entry)

    tmp_path = manifest_path.with_name(f".{manifest_path.name}.tmp")
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    replace_fn(str(tmp_path), str(manifest_path))


def publish_pair(finalized_pair, manifest_entry: dict, levels_dir, manifest_path, replace_fn=os.replace) -> dict:
    levels_dir = Path(levels_dir)
    levels_dir.mkdir(parents=True, exist_ok=True)

    scene_id = finalized_pair.manifest_id
    base_filename = f"{scene_id}_{_content_digest(finalized_pair.base_path)}_base.jpg"
    variant_filename = f"{scene_id}_{_content_digest(finalized_pair.variant_path)}_variant.jpg"
    base_dest = levels_dir / base_filename
    variant_dest = levels_dir / variant_filename

    newly_created = []
    try:
        _atomic_copy_into_place(finalized_pair.base_path, base_dest)
        newly_created.append(base_dest)
        _atomic_copy_into_place(finalized_pair.variant_path, variant_dest)
        newly_created.append(variant_dest)

        width, height = finalized_pair.dimensions
        entry = dict(manifest_entry)
        entry["id"] = scene_id
        entry["baseImage"] = f"levels/{base_filename}"
        entry["variantImage"] = f"levels/{variant_filename}"
        entry["dimensions"] = {"width": width, "height": height}
        entry["aspectRatio"] = finalized_pair.aspect_ratio

        _replace_manifest_entry(manifest_path, scene_id, entry, replace_fn=replace_fn)
        return entry
    except Exception:
        # Roll back only the files this call just created. Anything already
        # registered under a different digest-named path is never touched.
        for path in newly_created:
            if path.exists():
                path.unlink()
        raise


def generate_structural_pair(
    candidate, scene_spec: dict, staging_dir, policy=DEFAULT_BASE_GENERATION_POLICY, difficulty="Medium"
):
    """Hand an accepted base-image candidate to the existing structural-only
    add/remove/reorder pipeline, then finalize the result to production size.

    Returns (FinalizedPair, log_entry) on success, or (None, log_entry) if the
    structural pipeline found no viable candidate. Never writes to
    `public/levels` -- everything happens under `staging_dir`.
    """
    from generation_policy import STRUCTURAL_ONLY_POLICY
    from unified_operation_pipeline import generate_single_scene_difference

    staging_dir = Path(staging_dir)
    raw_dir = staging_dir / "structural"
    raw_dir.mkdir(parents=True, exist_ok=True)

    scene_id = scene_spec.get("id") or candidate.scene_brief_id
    full_spec = dict(scene_spec)
    full_spec["id"] = scene_id
    full_spec["image_path"] = candidate.master_path

    success, manifest_entry, log_entry = generate_single_scene_difference(
        full_spec,
        output_dir=str(raw_dir),
        difficulty=difficulty,
        policy=STRUCTURAL_ONLY_POLICY,
    )
    if not success:
        return None, log_entry

    base_path = raw_dir / f"{scene_id}_base.jpg"
    variant_path = raw_dir / f"{scene_id}_variant.jpg"
    ground_truth = log_entry.get("ground_truth") or manifest_entry["diffs"][0]

    finalized_dir = staging_dir / "finalized"
    finalized = finalize_pair(
        str(base_path), str(variant_path), ground_truth, str(finalized_dir), scene_id, policy
    )
    log_entry["manifest_entry"] = manifest_entry
    return finalized, log_entry
