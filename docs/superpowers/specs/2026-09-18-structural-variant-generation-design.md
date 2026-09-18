# Structural Variant Generation Design

## Goal

Improve the existing production image-pair pipeline so an explicit structural mode reliably produces small add, remove, or reorder differences in dense base images. Mixed-mode generation remains the default and retains recoloring behavior.

## Scope

This first production slice includes:

- An explicit, reusable structural-only generation policy.
- Strict operation routing with no recolor fallback in structural mode.
- Best-of-N evaluation instead of accepting the first passing structural edit.
- Refined object and cleanup masks for structural operations.
- Shared structural naturalness scoring for add, remove, and reorder candidates.
- End-to-end tests and operator documentation.

The following remain out of scope for this slice:

- Generative-AI or hosted inpainting integrations.
- Layout inference for rows, grids, arcs, or missing pattern slots.
- Sibling-derived background reconstruction.
- Replacement of FastSAM with another segmentation model.
- Changes to the runtime manifest schema or game UI.

## Compatibility

Existing callers that do not provide a generation policy retain the current mixed-mode behavior. Existing scene specifications, manifest records, output paths, and selector APIs remain compatible unless an optional parameter is added.

Structural mode is opt-in. It permits only `add`, `remove`, and `reorder`; a scene is rejected when none of those operations produces an acceptable result. Structural mode must never silently execute or register a recolor operation.

## Generation Policy

Add an immutable `GenerationPolicy` value with these fields:

- `name`: stable name included in attempt logs.
- `allowed_operations`: ordered tuple of permitted operations.
- `allow_operation_fallback`: whether the orchestrator may try another permitted operation after the preferred operation fails.
- `max_candidates_per_operation`: maximum candidate edits evaluated for each operation.
- `selection_mode`: `first_pass` or `best_score`.
- `refine_structural_masks`: whether structural mask refinement is enabled.

Two named policies are provided:

- `MIXED_GENERATION_POLICY`: current behavior, all four operations allowed, fallback enabled, existing candidate limit, first passing candidate selected.
- `STRUCTURAL_ONLY_POLICY`: add/remove/reorder only, fallback among those operations enabled, up to 12 candidates per operation, mask refinement enabled, and the highest-scoring passing edit selected.

`generate_single_scene_difference` and `generate_batch` accept an optional policy and default to `MIXED_GENERATION_POLICY`. The operation scheduler filters its target mix to the policy's allowed operations before selection.

If a scene's `preferred_op` is disallowed, structural mode ignores that preference and selects among its allowed affordances. If no allowed operation clears the minimum affordance threshold, the scene is rejected with a structured `NoAllowedOperation` reason.

## Candidate Evaluation and Selection

The orchestrator no longer embeds structural candidate acceptance directly into first-success loops. For every allowed structural operation it:

1. Obtains selector-ranked candidate targets or placements.
2. Refines each candidate's masks when the policy enables refinement.
3. Executes and verifies each candidate without saving files.
4. Collects passing results with the variant image, ground truth, selector score, QA metrics, and naturalness metrics.
5. Computes a normalized final score.
6. Chooses the highest-scoring result after the configured search budget is exhausted.

Mixed mode preserves first-pass selection to avoid changing established output behavior.

The structural score is deterministic and combines:

- 30% operation-selector confidence.
- 30% structural naturalness.
- 20% compactness of the changed region.
- 20% closeness to the center of the selected difficulty's perceptual acceptance band.

Missing optional metrics use a neutral value rather than giving an operation an automatic advantage. Every component and the final score are recorded in attempt logs.

## Structural Mask Refinement

Add a focused `StructuralMaskRefiner` that receives the base image, a FastSAM candidate mask, and its bounding box. It returns:

- `object_mask`: a tight binary mask for extraction and compositing.
- `cleanup_mask`: a conservative expansion covering antialiased edges and likely contact-shadow residue.
- `metrics`: original/refined area, connected-component count, solidity, boundary change, and refinement status.

Refinement performs deterministic local processing:

1. Normalize the mask to the source image dimensions.
2. Keep the connected component containing the original centroid, or the nearest component if the centroid lies outside all components.
3. Close only small internal holes and remove isolated specks.
4. Run local GrabCut refinement using eroded sure-foreground, the original mask as probable foreground, and a dilated ring as probable background.
5. Reject the refined mask and retain the cleaned original if area changes by more than 35%, its centroid leaves the original bounding box plus a 10% margin, or it becomes empty.
6. Build the cleanup mask by adding a small edge dilation and a directional down-right contact-shadow expansion, bounded to a local ROI.

Add and reorder use `object_mask` to extract the object. Remove and reorder use `cleanup_mask` for background reconstruction. All operations retain bit-identical pixels outside their existing clamped local ROI.

## Structural Naturalness Critic

Add a shared `StructuralNaturalnessCritic` that evaluates a completed variant inside its edit ROI. It returns a pass/fail result, normalized score, component metrics, and a stable rejection code.

Checks include:

- Boundary continuity around composited object edges.
- Local sharpness ratio between the edited region and its surrounding substrate.
- Color and luminance discontinuity at blend boundaries.
- Changed-region compactness and connected-component topology.
- For add/reorder, collision between the placed object and unrelated foreground masks.
- For reorder, compact union of the old and new footprints so both remain one playable answer region.

Hard rejection is limited to clear artifacts: severe boundary discontinuity, excessive blur, foreground collision, or a split reorder footprint. Softer metrics contribute to ranking rather than causing rejection. The existing `PerceptualVerificationEngine` remains authoritative for visibility and difficulty bounds.

Removal retains its specialized substrate and reconstruction critics; their normalized metrics feed the shared structural ranking rather than being replaced.

## Operation Integration

### Add

Refine the donor mask before extraction. Pass the placed object mask and raw foreground masks to the naturalness critic. Search up to the policy's candidate limit and retain every passing candidate for ranking.

### Remove

Use the refined cleanup mask for substrate analysis and reconstruction while using the tight object mask for target geometry. Preserve the existing reconstruction router and removal naturalness checks. Include selector confidence, substrate coherence, and removal naturalness in the final candidate record.

### Reorder

Use the tight object mask for transformation and the cleanup mask for reconstructing the original footprint. Reject candidates whose old/new union is noncompact or cannot fit one hotspot. Evaluate multiple selector-proposed targets within the policy budget and rank passing variants.

## Logging and Errors

Attempt logs add:

- `generation_policy`
- `allowed_operations`
- `operations_attempted`
- `candidate_attempt_count`
- `passing_candidate_count`
- `candidate_scores`
- `selected_candidate_score`
- stable rejection codes where no candidate succeeds

Expected structural rejection codes include `NoAllowedOperation`, `NoStructuralCandidate`, `MaskRefinementInvalid`, `StructuralBoundaryArtifact`, `StructuralBlurArtifact`, `StructuralCollision`, and `SplitDifferenceRegion`.

Failed structural generation does not write image files or update the manifest. Successful generation writes only the chosen pair using the existing paths and manifest structure.

## Operator Interface and Documentation

Document Python usage for both a single scene and a batch:

```python
from unified_operation_pipeline import (
    STRUCTURAL_ONLY_POLICY,
    generate_batch,
    generate_single_scene_difference,
)

success, entry, log = generate_single_scene_difference(
    scene_spec,
    policy=STRUCTURAL_ONLY_POLICY,
)

entries, logs, counts = generate_batch(
    scenes,
    policy=STRUCTURAL_ONLY_POLICY,
)
```

The documentation explains suitable base-image characteristics, output behavior, rejection behavior, scoring fields, and the distinction between mixed and structural-only modes.

## Testing

Tests follow red-green-refactor and use deterministic synthetic fixtures where possible.

Policy tests prove:

- Mixed mode remains the default.
- Structural mode never schedules or falls back to recolor.
- A disallowed preferred operation is ignored.
- Structural mode rejects when no allowed operation is viable.

Mask tests prove:

- Specks and disconnected fragments are removed.
- The primary object component is retained.
- Excessive GrabCut drift falls back to the cleaned original.
- Cleanup masks contain object masks and remain locally bounded.

Ranking tests prove:

- Best-score mode evaluates the configured candidate budget.
- It selects a later, higher-quality candidate over an earlier passing one.
- Mixed first-pass behavior remains unchanged.
- Ranking is deterministic for identical metrics.

Naturalness tests prove:

- Clean synthetic add/remove/reorder edits pass.
- Hard seams, excessive blur, collisions, and split reorder regions fail with the expected code.

End-to-end fixture tests run structural-only generation with deterministic precomputed masks for add, remove, and reorder. They verify a non-recolor manifest operation, one compact hotspot, unchanged pixels outside the edit ROI, and complete attempt-log diagnostics. Full FastSAM inference remains a smoke test rather than a unit-test dependency.

## Success Criteria

- Structural mode cannot emit recolor variants.
- It evaluates and ranks multiple passing structural candidates.
- Add/remove/reorder use refined operation-appropriate masks.
- Clear structural artifacts are rejected before saving.
- Existing mixed-mode callers and manifest consumers continue working.
- Unit, integration, and existing pipeline tests pass.
- Operator documentation is sufficient to run structural generation without reading implementation internals.
