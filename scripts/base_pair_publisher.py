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

from variant_code import variant_code

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
    base_ext = Path(finalized_pair.base_path).suffix
    variant_ext = Path(finalized_pair.variant_path).suffix
    # The code goes in the asset filename (internal, derived) but never in the
    # scene id, which is an external handle carried in shared challenge URLs.
    code = variant_code(manifest_entry)
    # The base image is content-addressed: every variant of one photo shares the
    # identical base, so naming it by digest alone stores it once instead of
    # once per variant. It deliberately carries no scene id and no variant code
    # -- under "auto" one photo's variants can come from different engines, and
    # a code in the name would split one file back into several.
    base_filename = f"{_content_digest(finalized_pair.base_path)}_base{base_ext}"
    variant_filename = f"{scene_id}_{code}_{_content_digest(finalized_pair.variant_path)}_variant{variant_ext}"
    base_dest = levels_dir / base_filename
    variant_dest = levels_dir / variant_filename

    # A shared base may already be on disk from an earlier variant of the same
    # photo. Only roll back files this call actually created, or a failure here
    # would delete a base that already-published entries point at.
    newly_created = []
    try:
        if not base_dest.exists():
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
        entry["variantCode"] = code

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


def _positions_overlap(item, picked):
    gt, picked_gt = item["ground_truth"], picked["ground_truth"]
    radius = gt.get("radius", 0.0)
    picked_radius = picked_gt.get("radius", 0.0)
    distance = ((gt["x"] - picked_gt["x"]) ** 2 + (gt["y"] - picked_gt["y"]) ** 2) ** 0.5
    return distance < radius + picked_radius


def _select_diverse_candidates(ranked, count):
    """Greedily pick up to `count` candidates from `ranked` (already sorted
    best first).

    Two things make a candidate "the same option" as one already picked,
    either of which disqualifies it on the first pass:
      - its position overlaps an already-picked one (two edits a couple of
        pixels apart aren't meaningfully different to review), or
      - it manipulates the same source object as an already-picked one (the
        pipeline can rank "duplicate this button to position A" above
        "...to position B" above "...to position C" for the same flawed
        button -- that's one option repeated, not several).

    A second pass fills any remaining slots by position alone, allowing a
    repeated source object, so a real base image with genuinely few passing
    candidates still returns as close to `count` as it actually has, rather
    than being cut short by the diversity preference.
    """
    selected = []
    used_source_keys = set()
    for item in ranked:
        if len(selected) >= count:
            break
        source_key = item.get("source_object_key")
        if source_key is not None and source_key in used_source_keys:
            continue
        if any(_positions_overlap(item, picked) for picked in selected):
            continue
        selected.append(item)
        if source_key is not None:
            used_source_keys.add(source_key)

    if len(selected) < count:
        for item in ranked:
            if len(selected) >= count:
                break
            if any(item is picked for picked in selected):
                continue
            if any(_positions_overlap(item, picked) for picked in selected):
                continue
            selected.append(item)

    return selected


def generate_structural_pair_variants(
    candidate, scene_spec: dict, staging_dir, count, policy=DEFAULT_BASE_GENERATION_POLICY, difficulty="Medium"
):
    """Like generate_structural_pair, but returns up to `count` distinct
    structural edits of the same base image instead of only the single
    best-scoring one. The pipeline already explores many candidate edits
    (different donor objects, different placement positions) internally and
    discards every one but the winner; this exposes the rest, ranked best
    first, via log_entry["ranked_candidates"] -- useful for presenting
    several real options for human review instead of auto-publishing
    whichever one happened to score highest.

    Each variant gets its own scene id (f"{base_id}_v{n}", 1-indexed) so
    publishing them never collides with each other or with a pair already
    published under the bare base id.

    Returns (variants, log_entry) where `variants` is a list of
    (FinalizedPair, manifest_entry) tuples, best first -- possibly shorter
    than `count` if the pipeline found fewer distinct passing candidates, or
    empty if it found none (log_entry then carries the rejection reason,
    matching generate_structural_pair's failure shape).
    """
    import cv2
    from PIL import Image

    from generation_policy import STRUCTURAL_ONLY_POLICY
    from unified_operation_pipeline import generate_single_scene_difference

    staging_dir = Path(staging_dir)
    raw_dir = staging_dir / "structural"
    raw_dir.mkdir(parents=True, exist_ok=True)

    base_id = scene_spec.get("id") or candidate.scene_brief_id
    full_spec = dict(scene_spec)
    full_spec["id"] = base_id
    full_spec["image_path"] = candidate.master_path

    success, _manifest_entry, log_entry = generate_single_scene_difference(
        full_spec,
        output_dir=str(raw_dir),
        difficulty=difficulty,
        policy=STRUCTURAL_ONLY_POLICY,
    )
    if not success:
        return [], log_entry

    ranked = log_entry.get("ranked_candidates") or []
    diverse = _select_diverse_candidates(ranked, count)
    finalized_dir = staging_dir / "finalized"
    variants = []

    for index, item in enumerate(diverse, start=1):
        variant_id = f"{base_id}_v{index}"
        operation = item["operation"]
        ground_truth = item["ground_truth"]

        variant_path = raw_dir / f"{variant_id}_variant.jpg"
        variant_rgb = cv2.cvtColor(item["variant"], cv2.COLOR_BGR2RGB)
        Image.fromarray(variant_rgb).save(variant_path, "JPEG", quality=100, subsampling=0)

        finalized = finalize_pair(
            candidate.master_path, str(variant_path), ground_truth, str(finalized_dir), variant_id, policy
        )

        manifest_entry = {
            "id": variant_id,
            "title": full_spec.get("title", f"Level {variant_id}"),
            "category": "Photography",
            "pack": "Find the Sniper",
            "packId": "find_the_sniper",
            "difficulty": difficulty,
            "operation": operation,
            "diffs": [{
                "id": 1,
                "x": ground_truth["x"],
                "y": ground_truth["y"],
                "radius": ground_truth["radius"],
                "description": f"Single {operation} difference",
                "hint": f"Look closely for a {operation} difference",
                "operation": operation,
            }],
        }
        variants.append((finalized, manifest_entry))

    return variants, log_entry
