# Base Image Ingest — Operator Guide

`scripts/generate_photo_batch.py ingest` is the entry point for turning a
manually-sourced base image into a published spot-the-difference pair.

Base images are generated outside this tool -- by hand, with whatever image
generator you have access to (there is no automated, paid provider call in
this pipeline; the earlier automated Google/OpenAI batch generator was
removed because it duplicated billable usage that free/bundled tools like
Antigravity's own Gemini access already cover). You supply one image file at
a time; the CLI normalizes it, runs free local technical quality checks,
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

```bash
python3 scripts/generate_photo_batch.py ingest /path/to/your/image.jpg --id fresh_v6_workbench_001
```

Options:

| Flag | Default | Meaning |
|---|---|---|
| `--id` (required) | — | Unique scene id. Also used to derive the display title if `--title` is omitted. |
| `--title` | derived from `--id` | Display title stored in the manifest. |
| `--difficulty` | `Medium` | `Easy`, `Medium`, or `Hard`. |
| `--keep-staging` | off | Keep the temporary staging directory (normalized master, raw structural output, finalized pair) instead of deleting it after the run. |

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
   resized together to the canonical production size (1200x900, JPEG
   quality 95, 4:4:4 chroma), and the declared difference region is
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
