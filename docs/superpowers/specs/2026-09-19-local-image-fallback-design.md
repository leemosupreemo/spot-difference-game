# Local image fallback pipeline

## Purpose and scope

Recover usable review candidates from manually supplied images that fail
the existing structural engine. Request up to five distinct candidates per
base; preserve existing success behavior and curator approval requirements.
The user excluded paid cloud image editing. There are no hosted image-edit
providers, API credentials, billing options, or cloud retries in this design.

## Delivery sequence

1. Preserve full ingest outcomes and classify rejection reasons in a JSON
   report. Structural limits recommend local target assessment; source
   quality, input, and unknown failures require inspection. This phase does
   not automatically edit or publish rejected images.
2. Detect star/blob targets from image pixels at multiple scales. Verify
   isolation, halo extent, and phone-size visibility before creating edits.
   Use the existing source as the starting image for every candidate.
3. Reuse local segmentation for bounded objects and local chroma edits that
   preserve luminance and texture. Evaluate whether a different segmentation
   model improves actual failures before adding model dependencies.
4. Add local inpainting for suitable backgrounds. Benchmark existing OpenCV
   and substrate reconstruction first; evaluate LaMa as an optional local
   engine with explicitly provisioned weights. Record unavailable engines
   without silently downloading or switching to a hosted service.
5. Composite accepted edit pixels over the original with a bounded feather
   band. Check exact equality outside the allowed mask before encoding and
   validate the delivered encoded assets for perceptibility and drift.
6. Feed passing, diverse candidates through existing finalization and
   manifest publication. Remote pack delivery uses existing hosting and
   Firestore tooling and is separate from editing. Curator approval remains
   necessary before live gameplay selection.

## Report interface

Optional ingest `--report PATH` writes an atomic JSON document with schema
version 1, UTC generation time, and an `images` array. Each outcome includes
absolute source, scene ID, requested count, difficulty, and status. Success
includes published IDs. Rejection includes stage, all reasons, and a fallback
decision (`category`, `next_step`, `candidate_methods`, `automatic_retry`).
Version 1 always sets `automatic_retry` to false. Recommendations describe
possible methods, not installed-engine availability or inferred scene type.

## Validation

Use targeted tests for classification precedence, legacy router early exits,
unknown failures, report durability through cleanup, and existing ingest
success/rejection behavior. Before enabling each editor, test pixel locality,
mask bounds, candidate diversity, perceptibility after resize/encoding, and
that failed candidates create no manifest entries. Review real source-image
examples before selecting an engine or changing quality thresholds.

## Implementation checkpoint: bounded-object masks

`--fallback local-segmented` reuses first-pass FastSAM masks, including masks
retained on an object-count rejection. If necessary it loads the existing
repository-local checkpoint, with no download on missing weights. Only compact,
single-component, non-overlapping masks enter the shared recolor pipeline.
`local-star` retains its detector and uses that same pipeline. Both modes use
hard compositing, lossless output, encoded pixel-locality checks, and pending
curation status. The generation-mask expansion helper is separate from the
final compositor mask; no inpainting engine is enabled at this checkpoint.

Initial real-image checks found no eligible segmented targets in the emission
and planetary nebula sources. This is a detector limitation, not evidence that
those sources are intrinsically uneditable. The deep-field galaxy source passed
the original structural pipeline and is not counted as fallback recovery.
The resin cosmic spheres source produced one accepted segmented recolor from
22 eligible targets, saved under `build/local-segmented-review/` for human review.

Object-count and no-object exits now retain source-quality metrics so the
ingest policy still checks sharpness, edge density, and dominant foreground.
A low object count cannot independently authorize bypassing those checks.

## Local removal assessment

An isolated assessment of two resin-image masks compared OpenCV Telea with
the existing `BackgroundReconstructionRouter`. Its report and scratch images
are in `build/local-removal-assessment/`; none entered a manifest.

- Telea target 20 passed the generic locality, visibility, and naturalness
  checks but visual inspection found an obvious smeared partial object.
- Telea target 21 failed the minimum changed-area check.
- Existing reconstruction rejected target 20 for boundary discontinuity and
  target 21 for background color mismatch.
- LaMa was not tested: its weights are not provisioned in the repository.

A segmented feature suitable for recoloring is not necessarily a complete
removable object. Before enabling any removal fallback, require whole-object
mask coverage, removal-specific boundary/texture validation, and visual review
against these observed failure cases. Hard compositing prevents external drift
but cannot repair a bad edit inside the final mask. Do not promote the single
generic-validator pass above into a production candidate.

## Amendment: automatic routing by default (2026-09-19)

The delivery sequence above describes an opt-in second pass with
`automatic_retry` always false. That was the checkpoint behavior, not the
destination. The pipeline now runs as one funnel by default:

- `--fallback` defaults to `auto`. Step 1 vets for structural-change candidacy;
  everything it accepts is finished, and everything it rejects moves to step 2.
- Routing no longer requires a `structural_limit` classification. Source-quality
  and unrecognized failures route too. `input_error` is the sole exception,
  because a normalization failure produces no master for an editor to read.
- Report schema is version 2. `routes_to_fallback` carries the routing decision
  and `automatic_retry` now mirrors it. `next_step` keeps its original meaning
  as the recommendation for the human, independent of what the machine attempts.
- `auto` runs `local-segmented` first (reusing first-pass FastSAM masks), then
  `local-star` for any shortfall, with variant numbering continued and the first
  engine's published boxes excluded from the second.

Unchanged: no hosted providers, no weight downloads, hard compositing, lossless
delivery with encoded pixel-locality checks, `curationStatus: pending`, and
mandatory curator approval before live gameplay selection. A wider funnel
feeds more candidates to review; it does not lower the bar for publication.
