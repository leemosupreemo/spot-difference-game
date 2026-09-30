# Structural Variant Generation

The authoritative production generator is `scripts/unified_operation_pipeline.py`. It supports an explicit structural-only policy for producing small object additions, removals, and reorders without falling back to recoloring.

## Requirements

Run commands from the repository root. Structural generation requires:

- Python 3 with OpenCV, NumPy, Pillow, and Ultralytics installed.
- `FastSAM-s.pt` at the repository root.
- A readable base image and a writable output directory.

The current environment can be checked with:

```bash
python3 -c 'import cv2, numpy, PIL, ultralytics; print("pipeline dependencies available")'
test -f FastSAM-s.pt
```

## Policies

`MIXED_GENERATION_POLICY` is the default. It preserves existing behavior: recolor, add, remove, and reorder are allowed, fallback is enabled, and the first passing candidate is accepted.

`STRUCTURAL_ONLY_POLICY` is opt-in. It:

- Allows only `add`, `remove`, and `reorder`.
- Ignores a disallowed `preferred_op`, including `recolor`.
- Tries other viable structural operations when the preferred structural operation fails.
- Evaluates up to 12 candidates per operation.
- Refines tight object masks and broader cleanup masks.
- Rejects severe seams, blur, collisions, and spatially split moves.
- Selects the highest-scoring passing candidate.
- Rejects the scene instead of falling back to recolor.

## Generate One Variant

```bash
PYTHONPATH=scripts python3 - <<'PY'
from unified_operation_pipeline import (
    STRUCTURAL_ONLY_POLICY,
    generate_single_scene_difference,
)

scene = {
    "id": "workbench_structural_001",
    "title": "Workbench Structural Difference",
    "image_path": "public/levels/my_dense_workbench_base.jpg",
    "preferred_op": "reorder",
    "difficulty": "Medium",
    "desc": "One small object was moved, added, or removed",
    "hint": "Compare the small repeated objects on the work surface",
}

success, entry, attempt_log = generate_single_scene_difference(
    scene,
    output_dir="public/levels",
    difficulty=scene["difficulty"],
    policy=STRUCTURAL_ONLY_POLICY,
)

print("success:", success)
print("entry:", entry)
print("log:", attempt_log)
PY
```

This writes the base and chosen variant only after at least one structural candidate passes. It does not update the manifest by itself.

## Generate a Batch

```python
from unified_operation_pipeline import STRUCTURAL_ONLY_POLICY, generate_batch

entries, logs, operation_counts = generate_batch(
    scenes,
    output_dir="public/levels",
    manifest_path="public/levels/photo_pair_manifest.json",
    policy=STRUCTURAL_ONLY_POLICY,
)
```

`generate_batch` registers successful entries in the supplied manifest. Rejected scenes produce logs but no images or manifest records.

## Suitable Base Images

Structural generation works best when a base image has:

- At least 14 detected objects; 20–80 is a useful practical range.
- Repeated families such as screws, buttons, caps, tokens, tools, or components.
- Small targets occupying roughly 0.1–1.4% of the frame, depending on difficulty.
- Sharp focus across the scene.
- Recoverable local surfaces beneath movable objects.
- Natural gaps and limited overlap between neighboring objects.

Avoid objects crossing material seams, heavy occlusion, shallow depth of field, large readable text, and targets whose shadows merge with neighboring objects.

## Selection and Scoring

Every passing structural candidate receives a deterministic score:

- 30% selector confidence.
- 30% structural naturalness.
- 20% changed-region compactness.
- 20% closeness to the requested difficulty band.

The highest score wins. Only the winner is saved. Mixed mode continues to accept its first passing candidate.

## Attempt Logs

Structural attempt logs include:

- `generation_policy`
- `allowed_operations`
- `operations_attempted`
- `candidate_attempt_count`
- `passing_candidate_count`
- `candidate_scores`
- `selected_candidate_score`
- `last_rejection_code`, when a candidate fails structural quality
- `rejection_code`, when the complete scene is rejected

Top-level rejection codes include:

- `NoAllowedOperation`: no structural operation met the scene-affordance floor.
- `NoStructuralCandidate`: structural operations were attempted but none passed.

Candidate-level codes include `StructuralBoundaryArtifact`, `StructuralBlurArtifact`, `StructuralCollision`, and `SplitDifferenceRegion`.

## Verification

Run the focused suites with:

```bash
PYTHONPATH=scripts python3 scripts/test_structural_generation.py
PYTHONPATH=scripts python3 scripts/test_pipeline_unit_suite.py
```

The repository-wide `npm test` command also runs both suites.
