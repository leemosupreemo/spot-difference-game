# Approved Photo Pair Fill Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ten new playable photo-pair candidates that address the curator feedback and fill the Easy, Medium, and Hard level gaps.

**Architecture:** Generate static 4:3 raster pairs under `public/levels/photo-pairs/` and register them in `public/levels/photo_pair_manifest.json`. Each variant is authored from the same base scene with exactly one object-level change: shifted, added, removed, or rotated small object detail. Runtime game code remains unchanged.

**Tech Stack:** Node/browser manifest validation, PNG assets, existing `scripts/validate_photo_pairs.mjs` validator, existing React canvas level loader.

## Global Constraints

- Keep the five approved entries already in `public/levels/photo_pair_manifest.json`.
- Add exactly ten new candidate entries: 3 Easy, 3 Medium, and 4 Hard.
- Do not use pure discoloration, broad brightness patches, circular mutation masks, or stretched source images.
- All new base and variant images must be 1448x1086 PNG, matching the approved 4:3 asset size.
- Each new entry must have exactly one hotspot with percentage coordinates.
- Keep gameplay code unchanged.

---

### Task 1: Generate Controlled Candidate Assets

**Files:**
- Create: `public/levels/photo-pairs/<category>/<level-id>/base.png`
- Create: `public/levels/photo-pairs/<category>/<level-id>/variant.png`

**Interfaces:**
- Produces: paired image files referenced by manifest entries.

- [ ] **Step 1: Generate ten base/variant PNG pairs**

Create 1448x1086 scenes with dense tabletop, shelf, desk, garden, workshop, market, and camouflage clutter. Variant images must differ by only one small object-level change.

- [ ] **Step 2: Inspect dimensions**

Run: `sips -g pixelWidth -g pixelHeight public/levels/photo-pairs/*/*/*.png`
Expected: every new image reports `pixelWidth: 1448` and `pixelHeight: 1086`.

### Task 2: Register Manifest Entries

**Files:**
- Modify: `public/levels/photo_pair_manifest.json`

**Interfaces:**
- Consumes: generated assets from Task 1.
- Produces: valid runtime manifest entries.

- [ ] **Step 1: Append ten entries**

Add one manifest entry per new pair with `id`, `title`, `pack`, `packId`, `category`, `difficulty`, image paths, and one `diffs` hotspot.

- [ ] **Step 2: Validate manifest**

Run: `node scripts/validate_photo_pairs.mjs`
Expected: all image paths exist and manifest validation passes.

### Task 3: Full Verification

**Files:**
- Test: `scripts/validate_photo_pairs.mjs`
- Test: `src/utils/photoPairManifest.test.mjs`
- Test: `src/utils/photoPairLevelLoader.test.mjs`

**Interfaces:**
- Consumes: final manifest and assets.

- [ ] **Step 1: Run targeted tests**

Run: `node --test src/utils/curationStore.test.mjs src/utils/photoPairManifest.test.mjs src/utils/photoPairLevelLoader.test.mjs`
Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Vite build exits 0.
