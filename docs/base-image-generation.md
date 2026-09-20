# Base Image Ingest — Operator Guide

`scripts/generate_photo_batch.py` is the entry point for turning manually-
sourced base images into published spot-the-difference pairs.

Base images are generated outside this tool -- by hand, with whatever image
generator you have access to (there is no automated, paid provider call in
this pipeline; the earlier automated Google/OpenAI batch generator was
removed because it duplicated billable usage that free/bundled tools like
Antigravity's own Gemini access already cover). You supply the image file(s);
the CLI normalizes each one, runs free local technical quality checks,
generates the difference variant through the existing structural pipeline,
and atomically publishes both images plus a manifest entry.

> No paid API calls happen anywhere in this pipeline.
> Only a locally-validated, structurally-successful, size-checked pair is ever published.

## 1. Installation

```bash
pip install -r requirements-generation.txt
```

This installs `typer`, `rich`, `Pillow`, `numpy`, `opencv-python`, and
`ultralytics` (for the local FastSAM-based quality gates). No provider SDKs
or credential-storage packages are needed.

## 2. Usage

**One image, zero flags** — id and title are derived from the filename:

```bash
python3 scripts/generate_photo_batch.py path/to/cozy_workbench.jpg
```

**One image, full control:**

```bash
python3 scripts/generate_photo_batch.py path/to/image.jpg --id fresh_v6_workbench_001 --title "Cozy Workbench" --difficulty Hard
```

**A whole folder of images in one call** — every `.jpg`/`.jpeg`/`.png`/`.webp`
file directly inside the folder is ingested, each getting its own id derived
from its filename (deduplicated against the manifest automatically if two
files would slugify to the same id):

```bash
python3 scripts/generate_photo_batch.py path/to/folder-of-images/
```

**Several explicit files, or a mix of files and folders, in one call:**

```bash
python3 scripts/generate_photo_batch.py photo1.jpg photo2.jpg more-photos/
```

One rejected image never stops the rest of the batch -- each image is
processed independently and a results table is printed at the end (file,
scene id, Published/Rejected, and why). The command exits non-zero if any
image in the batch was rejected, so it's still safe to script.

There's no `ingest` subcommand to type — this is the CLI's only command, so
Typer runs it directly.

Options (all optional):

| Flag | Default | Meaning |
|---|---|---|
| `--id` | derived from filename | Scene id. Only valid when ingesting a single image (multiple images always get filename-derived ids). |
| `--title` | derived from filename/id | Display title stored in the manifest. Only valid for a single image. |
| `--difficulty` | `Medium` | `Easy`, `Medium`, or `Hard`. Applies to every image in the batch. |
| `--manifest` | `public/levels/photo_pair_manifest.json` | Manifest file to publish into. |
| `--levels-dir` | `public/levels` | Directory to publish base/variant images into. |
| `--keep-staging` | off | Keep each image's temporary staging directory (normalized master, raw structural output, finalized pair) instead of deleting it after the run. |
| `--report` | off | Save JSON outcomes including full rejection reasons and local second-pass recommendations. |
| `--fallback` | `auto` | Second pass for images the first pass rejects. `auto` runs `local-segmented` then tops up any shortfall with `local-star`. Force one engine with `local-star` or `local-segmented`, or turn the second pass off with `none`. |

### Local second-pass triage

```bash
python3 scripts/generate_photo_batch.py path/to/photo.jpg --variants 5 --report /tmp/photo-ingest.json
```

The report survives staging cleanup and records absolute source paths,
requested variant count, difficulty, successful IDs, or complete failure
reasons and the failing stage. Each rejection also carries a `fallback` block:
`category` and `next_step` are the recommendation for the human, and
`routes_to_fallback` is the machine-readable routing decision.

The two are deliberately independent. A blurry source still reads
`next_step: review_source` even though the second pass attempted it — a local
edit that happens to pass its checks does not clear a bad source. A structural
rejection is likewise not proof that an image contains stars or texture worth
editing; passing the second pass makes a candidate eligible for curator review,
never automatically suitable for a puzzle.

- Object count, editable-target, peer-group, structural-affordance, and
  empty-operation-queue failures are structural limits: `assess_local_targets`.
- Sharpness, texture-density, or hero-object failures: `review_source`.
- Invalid inputs: `repair_input`. Unrecognized codes: `inspect_failure`.
- When several gates fail, the most serious category names the `next_step`.

### Which failures reach the second pass

Every image whose normalized master exists gets a second pass. The pipeline is
one funnel: step 1 vets for structural-change candidacy, everything it accepts
is finished and goes no further, and everything it rejects moves to step 2.

| Stage | Raised by | Reaches second pass? |
| --- | --- | --- |
| normalization | `normalize_local_image` | **No.** There is no decoded master to edit. Repair the file. |
| `local_gates` | `run_local_gates` | Yes — structural limits, quality failures, and unrecognized codes alike. |
| `structural` | `generate_structural_pair[_variants]` | Yes, on the same terms. |

`input_error` is the only category that does not route, and it is a physical
limit rather than a policy: `local-star` and `local-segmented` both read the
normalized master, which a normalization failure never produced.

Two consequences worth knowing:

- An unrecognized rejection code classifies as `unknown` and still routes, so a
  code added to the structural pipeline can never silently drop an image out of
  the funnel. Adding it to `classify_rejection` in
  `scripts/ingest_failure_report.py` only improves the recommendation text.
- Second-pass output is always `curationStatus: pending` and lossless. It is
  published to the local manifest, never to Hosting or Firestore, and a curator
  still has to approve it.

### How `auto` chains the two engines

`local-segmented` runs first because an approved gate already paid for FastSAM
and its masks ride along on the route result, so reusing them costs nothing. It
only loads `FastSAM-s.pt` from disk when no first-pass masks exist. If it
returns fewer candidates than `--variants`, `local-star` runs for the shortfall.

The second engine continues the first one's variant numbering, so ids never
collide, and it is given the boxes the first engine actually published so it
skips those objects. One image never ships the same star in two colors from two
detectors.

A partial first-pass yield is a success, not a failure: if five variants are
requested and the structural pipeline returns two, those two are published and
the shortfall is **not** handed to the second pass. One image never mixes
structural and local-recolor variants.

One image's unexpected crash no longer aborts the batch. It is recorded with
`status: "error"` plus its traceback, classified `unknown`, and the remaining
images still run and still reach the report.

Paid cloud image editing is excluded from the fallback design. Later local
engines must retain the existing perceptual checks and curator approval;
passing triage alone never qualifies an image for publication.

### Local star fallback

```bash
python3 scripts/generate_photo_batch.py path/to/starfield.jpg --variants 5 \
  --fallback local-star --report /tmp/starfield-report.json
```

The first pass runs normally, and a first-pass success always wins the image.
Naming an engine explicitly pins the second pass to it instead of letting `auto`
chain both; the routing rules above are unchanged, so only a normalization
failure still stops the image outright. This engine uses OpenCV/NumPy with no model downloads or
network access. Multiscale bright-feature detection proposes compact masks;
Lab chroma rotation changes hue with an inward feather, preserving all
original pixels outside the mask. It keeps at most one candidate per
non-overlapping target and returns up to the requested count.

The original visibility and naturalness checks apply to the master; the
delivered lossless WebP is reopened and checked for visibility and visible background
drift. A failed edit is skipped. This version implements recoloring only:
removal, insertion, segmentation-model upgrades and LaMa are not enabled.
Some starfields have only tiny features or broad clouds and will still fail.
Lossless delivery is limited to this fallback and costs more storage than
the normal structural pipeline's lossy WebP, avoiding scattered compression
differences across dense star textures.

When `--report` is supplied, `fallback_execution` records original rejection
reasons, each attempted target/angle, quality metrics, encoded-image checks,
and accepted count even when temporary staging files are cleaned up.
Passing output uses the ordinary local manifest path and awaits curator
approval. It is not automatically deployed to Hosting or Firestore.

For an isolated trial, also supply `--levels-dir build/local-star-review/levels`
and `--manifest build/local-star-review/manifest.json`.

### Local segmented fallback

```bash
python3 scripts/generate_photo_batch.py path/to/photo.jpg --variants 5 \
  --fallback local-segmented \
  --levels-dir build/local-segmented-review/levels \
  --manifest build/local-segmented-review/manifest.json \
  --report build/local-segmented-review/report.json
python3 scripts/render_photo_review.py build/local-segmented-review/manifest.json
```

This follows the same routing as `local-star`; a successful first pass still
takes precedence. It reuses raw FastSAM masks from the quality
gate, including its early object-count rejection. When masks are unavailable,
the fallback loads the existing `FastSAM-s.pt` at the repository root. Missing
weights or an unusable local engine produce `LocalSegmentationUnavailable` in
the report. The fallback never downloads weights or invokes a hosted provider.

Only single connected masks covering 0.1–1.2% of the image are considered.
Border-touching, elongated, sparse, and overlapping masks are excluded. A mask
is an object proposal, not a semantic identification of a celestial object.
An additional local-lightness check rejects dark background gaps surrounded
by brighter objects; this was added after a cotton-image review exposed a
technically passing edit of the blue gap between cotton pieces.
Each candidate changes one object's chroma, passes the existing visibility and
naturalness checks, and enters the manifest with `curationStatus: pending`.
The report retains target boxes, centers, areas, mask source, edit attempts,
and accepted count through staging cleanup.

Both local modes use the shared hard compositor: original pixels outside the
final mask are copied exactly and feathering occurs only inside it. An expanded
context-mask helper is available for subsequent inpainting engines; recoloring
does not need it. Delivered lossless WebP assets are reopened and checked for
exact equality outside the resized mask plus the Lanczos filter's narrow support
band. This checks every pixel, rather than accepting a low global average drift.

FastSAM can miss compact objects in astronomy images. No passing mask means no
fallback candidate; the limits are not relaxed to force output. This stage does
not implement LaMa, automatic semantic validation, or a new segmentation model.
Passing pixel and perceptual checks makes a candidate eligible for visual
review, not automatically suitable for a puzzle. A molecular-cloud edit can
still produce an unnatural green patch inside its mask, so curator review must
reject such local artifacts.

## 3. What happens, step by step

1. **Normalize** (`base_image_normalizer.py`) — the source image is
   center-cropped to exact 4:3 (rejecting with `NormalizationCropExceeded`
   if that would need more than a 0.5% crop) and resized to the canonical
   1536x1152 master, re-encoded as opaque sRGB PNG.
2. **Local quality gates** (`base_candidate_evaluator.py`) — free,
   local computer-vision checks; no network call and no cost:

   | Gate | Threshold |
   |---|---|
   | Sharpness uniformity | ≥ 0.25 |
   | Global edge density | ≥ 0.02 |
   | Detected objects (FastSAM) | ≥ 18 |
   | Small editable targets | ≥ 8 |
   | Repeated-object peer groups | ≥ 2 |
   | Largest foreground object | ≤ 22% of frame |
   | Best structural-operation affordance | ≥ 0.45 |

   A failing image is rejected immediately with the specific reject code(s)
   printed; nothing is published. There is no semantic/AI critic step here
   — a manually-supplied image has already been judged by you.
3. **Structural difference generation** (`base_pair_publisher.generate_structural_pair`,
   `unified_operation_pipeline.generate_single_scene_difference`) — the
   normalized master is handed to the existing structural-only
   add/remove/reorder pipeline. If no viable edit is found, the image is
   rejected with the pipeline's own reason (e.g. `NoStructuralCandidate`) and
   nothing is published.
4. **Finalization** (`image_pair_finalizer.py`) — base and variant are
   resized together to the canonical production size (1200x900, WebP
   quality 85 -- supported in WKWebView since iOS 14, well within this app's
   iOS 15 floor, unlike AVIF which needs iOS 16), and the declared difference region is
   re-verified to survive downsampling at both production size and a
   simulated 800x600 display size (`DifferenceLostAfterDownsample` if not),
   with every pixel outside that region required to stay aligned between
   base and variant (`OutsideRegionDrift` if not).
5. **Publication** (`base_pair_publisher.publish_pair`) — atomic and never
   risks a currently-registered asset: destination filenames are derived
   from the scene id plus a content digest, so re-ingesting the same id with
   different content always lands on new files. Both files are copied into
   `public/levels/` before the manifest is touched; `public/levels/photo_pair_manifest.json`
   (the file the game actually loads, via `src/utils/photoPairLevelLoader.js`)
   is replaced via a sibling temp file and an atomic rename. If manifest
   replacement fails, only the files this call just copied are rolled back —
   anything already registered is left untouched.

## 4. Rejection codes

| Code | Stage |
|---|---|
| `NormalizationCropExceeded` | Normalization — source aspect ratio too far from 4:3 |
| `LocalGateReject` | Local gates — the router's own universal gate |
| `SharpnessUniformityReject` / `EdgeDensityReject` / `ObjectCountReject` / `EditableTargetReject` / `PeerGroupReject` / `HeroObjectReject` / `StructuralAffordanceReject` | Local gates |
| `NoStructuralCandidate` (or another routing error from `unified_operation_pipeline`) | Structural difference generation |
| `PairDimensionMismatch` / `DifferenceLostAfterDownsample` / `OutsideRegionDrift` | Finalization |

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Not found: <path>` | Wrong path or the file doesn't exist | Check the path you passed as the first argument |
| A local gate rejects the image | The source photo doesn't have enough small, distinct, editable objects, or is too soft/flat | Try a busier, sharper source photo; inspect the printed metric vs. threshold |
| Structural pipeline rejects with `NoStructuralCandidate` | FastSAM couldn't find a safe add/remove/reorder edit in this image | Try a different image; this is the same structural engine used by the rest of the game's pipeline |
| `pip install` fails on `ultralytics`/`opencv-python` | Missing system build tools or wrong Python version | See the main project README's environment setup |
