# Spot the Difference Image Generation & Pipeline Toolkit

> **Current production entry point:** Use `scripts/unified_operation_pipeline.py`. Historical pipeline copies have been removed to prevent accidental use of outdated generation behavior.

For add/remove/reorder generation, policies, examples, scoring, rejection codes, and base-image guidance, see [`docs/structural-variant-generation.md`](../docs/structural-variant-generation.md).

This toolkit contains all scripts, generator engines, computer vision analyzers, and manifests used to create and curate spot-the-difference puzzle pairs.

## Base image generation

`scripts/generate_photo_batch.py` takes one or more manually-sourced base
images (no paid API calls), runs each through free local quality gates,
hands it to the existing structural add/remove/reorder pipeline, and
atomically publishes the finalized pair. See
[`docs/base-image-generation.md`](../docs/base-image-generation.md) for the
full operator guide.

## 📁 File Manifest:

1. **`sam_segment_recolor.py`**
   - FastSAM (Segment Anything Model) object segmentation script.
   - Segments physical object instances (e.g. tool handles, paint tubes, thread spools) in sub-second inference and performs deterministic luminance-preserving HSV/LAB color transformations.

2. **`layeredSceneEngine.js`**
   - Structured Layered Scene Graph Engine.
   - Builds 60–100+ object scene graphs (gears, ICs, fasteners, jewels) with SVG/PNG materials, dynamic drop shadows, and 100% zero background drift.

3. **`proceduralGenerator.js`**
   - Procedural abstract artwork generator across 12 distinct art worlds and 16 rendering styles.

4. **`diffAnalyzer.js`**
   - Computer vision ground-truth analyzer for detecting single difference centroids, hit radii, and clamping drift.

5. **`photoPairLevelLoader.js`**
   - Runtime loader and unreviewed-first candidate queue selector.

6. **`curationStore.js`**
   - 3-way curation store (Approved / Dismissed / Wrong Difficulty).

7. **`curationLevelPruner.mjs`**
   - Utility for deleting dismissed images and pruning manifests.

8. **`photo_pair_manifest.json`**
   - The primary manifest registry of active levels with exact coordinates and radii.

9. **`official_curated_levels.json`**
   - Official dataset of all approved level IDs.

10. **`vite.config.js`**
    - Vite server config with real-time curation sync API and tunnel support.
