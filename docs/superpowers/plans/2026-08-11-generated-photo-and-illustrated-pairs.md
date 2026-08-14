# Generated Photo and Illustrated Pair Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 200 validated, playable one-difference image-pair levels: 100 photo-style and 100 illustrated/abstract scenes.

**Architecture:** Create each base image and a precise variant edit in a dedicated public asset directory. Append corresponding records to the existing manifest, then derive hotspot values from the image delta and validate the assets through the project's scripts.

**Tech Stack:** Built-in image generation and edit tool, PNG assets, JSON manifest, Node.js validation scripts.

## Global Constraints

- Create new assets only; do not replace existing level assets or manifest entries.
- Every record must pass `validatePhotoPairManifest` and contain exactly one diff.
- Each base/variant pair must have the same dimensions and only one intentional localized change.
- Photos use `find_the_sniper`; the illustrated and abstract set uses `abstract_animated`.
- Do not include readable text, watermarks, or people.

---

### Task 1: Produce the 100 photo-style levels

**Files:**
- Modify: `scripts/generate_authored_photo_pairs.swift`
- Create: `public/levels/photo-pairs/mass-photo/*/{base,variant}.png`

**Interfaces:**
- Produces: paired PNG files to be referenced by Task 3 manifest records.

- [ ] **Step 1: Generate each rich, horizontal base scene**

Create 100 seeded dense tabletop and object scenes with a distinct small target suitable for a single localized change.

- [ ] **Step 2: Create a variant edit from each corresponding base**

Use the renderer's deterministic target primitives to change only one target in each photo-style pair.

- [ ] **Step 3: Inspect each pair**

Confirm base and variant share framing, lighting, and all non-target content before keeping the pair.

### Task 2: Produce the 100 illustrated/abstract levels

**Files:**
- Create: `public/levels/photo-pairs/mass-abstract/*/{base,variant}.png`

**Interfaces:**
- Produces: paired PNG files to be referenced by Task 3 manifest records.

- [ ] **Step 1: Generate each horizontal base scene**

Create 100 seeded illustrated and abstract scenes cycling through the renderer's pattern, foliage, workshop, and object-field visual systems.

- [ ] **Step 2: Create a variant edit from each corresponding base**

Use the renderer's deterministic target primitives to create exactly one localized visual change per pair.

- [ ] **Step 3: Inspect each pair**

Confirm the variant preserves line work, framing, palette, and scene detail outside the named target.

### Task 3: Integrate levels and calculate hotspots

**Files:**
- Modify: `public/levels/photo_pair_manifest.json`

**Interfaces:**
- Consumes: the twenty PNG files from Tasks 1 and 2.
- Produces: ten valid manifest entries, each using `{ id, title, pack, packId, category, difficulty, baseImage, variantImage, diffs }`.

- [ ] **Step 1: Append ten records with provisional target locations**

Append 100 `mass_photo_*` records to `find_the_sniper` and 100 `mass_abstract_*` records to `abstract_animated`, all with a one-element `diffs` array.

- [ ] **Step 2: Recalculate hotspot coordinates**

Run: `node scripts/recalculate_photo_pair_targets.mjs`

Expected: one `x`, `y`, and `radius` report per eligible PNG pair, including all ten new ids.

- [ ] **Step 3: Validate the manifest and assets**

Run: `node scripts/validate_photo_pairs.mjs`

Expected: `Validated <count> photo pair levels.` with no missing assets or manifest errors.

### Task 4: Verify the integrated set

**Files:**
- Test: `src/utils/photoPairManifest.test.mjs`
- Test: `src/utils/photoPairLevelLoader.test.mjs`

- [ ] **Step 1: Run focused level tests**

Run: `node --test src/utils/photoPairManifest.test.mjs src/utils/photoPairLevelLoader.test.mjs`

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: the Vite build completes successfully.

- [ ] **Step 3: Review changed files and commit**

Run: `git status --short`

Stage only the ten new level directories and `public/levels/photo_pair_manifest.json`, then commit with message `Add generated photo and illustrated level pairs`.
