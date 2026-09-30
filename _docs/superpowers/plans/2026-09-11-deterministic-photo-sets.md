# Deterministic Photo Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Photo Mode deterministic and competitive results/time records scoped to stable Photo Set identities, while preserving Daily’s date-keyed three-image behavior and legacy data.

**Architecture:** Add a small set-catalog layer over the existing photo manifest. The catalog groups entries by `setId`, sorts by `sequence`, and exposes only complete five-entry sets for standard competition. Photo stage construction consumes a set ID and never filters by difficulty; progress records add set identity and ordered entry IDs while retaining old fields for compatibility.

**Tech Stack:** React, Vite, JavaScript modules, Node’s built-in test runner, localStorage, Firebase Firestore.

**Spec:** `docs/superpowers/specs/2026-09-11-deterministic-photo-sets-design.md`

## Global Constraints

- Competitive photo results are comparable only when players face the same ordered content and conditions.
- New photo selection and ranking must not depend on Easy/Medium/Hard.
- Standard Photo Sets contain five ordered puzzles; Daily contains three ordered puzzles.
- Legacy records and procedural difficulty behavior remain readable and functional.
- Every completion record stores `setId`, ordered entry IDs, elapsed time, and first/repeat classification.

---

### Task 1: Add manifest set metadata and catalog helpers

**Files:**
- Modify: `public/levels/photo_pair_manifest.json`
- Modify: `src/utils/photoPairManifest.js`
- Create: `src/utils/photoSetCatalog.js`
- Test: `src/utils/photoSetCatalog.test.mjs`

**Interfaces:**
- Produces `getPhotoSetCatalog(entries, { setSize = 5 })` returning `{ sets, unassigned }`, where each set is `{ setId, entries }` and entries are sorted by `sequence` then `id`.
- Produces `getCompletePhotoSets(entries, setSize = 5)` returning only complete sets.
- Manifest entries participating in competition carry `setId` and positive integer `sequence`.

- [ ] **Step 1: Write failing tests** for grouping, ordering, complete-set filtering, and distinct variant IDs.
- [ ] **Step 2: Run `node --test src/utils/photoSetCatalog.test.mjs`** and verify the new helpers fail because they do not exist.
- [ ] **Step 3: Add the catalog helpers** and assign stable set metadata to the retained manifest entries. Use deterministic set IDs such as `photo_set_001`, assigning five entries in manifest order unless an existing explicit set assignment is present.
- [ ] **Step 4: Run the focused tests** and verify they pass.
- [ ] **Step 5: Run `node --test src/utils/photoPairManifest.test.mjs src/utils/photoSetCatalog.test.mjs`** to verify validation and catalog behavior together.

### Task 2: Make photo-stage construction set-scoped and difficulty-independent

**Files:**
- Modify: `src/utils/photoPairLevelLoader.js`
- Modify: `src/utils/photoPairLevelLoader.test.mjs`
- Modify: `src/App.jsx`
- Modify: `src/components/MainMenu.jsx`
- Modify: `src/components/MainMenu.test.mjs`

**Interfaces:**
- `buildPhotoPairStage({ packId, setId, count = 5, ... })` returns the ordered entries for `setId` and does not use `difficulty` to filter photo entries.
- Photo Mode stores the selected `photoSetId` and passes it to `buildPhotoPairStage`.

- [ ] **Step 1: Add failing tests** proving the same `setId` returns the same ordered IDs for different difficulty values, and an incomplete set is not filled by mixing unrelated entries.
- [ ] **Step 2: Run `node --test src/utils/photoPairLevelLoader.test.mjs`** and verify the new assertions fail against seeded/randomized selection.
- [ ] **Step 3: Implement set-scoped selection** using `getCompletePhotoSets`, preserving explicit entry order and returning a clear empty result for incomplete sets. Keep procedural generation’s difficulty parameter unchanged.
- [ ] **Step 4: Add a Photo Set selector to Photo Mode** using the catalog’s set IDs, persist the selected set locally, and launch the selected set deterministically. Keep Abstract/procedural mode separate.
- [ ] **Step 5: Run loader and MainMenu tests** and verify the selector and deterministic stage behavior pass.

### Task 3: Persist set-scoped completion timing

**Files:**
- Modify: `src/services/playerProgress.js`
- Modify: `src/services/playerProgress.test.mjs`
- Modify: `src/App.jsx`
- Modify: `src/viewmodels/useGameViewModel.js`

**Interfaces:**
- Completion records contain `{ setId, entryIds, firstTime, fastestRepeat, fastestTime, ...legacyFields }`.
- `saveImageProgress` and set-level payload builders accept `setId` and `entryIds` without requiring difficulty.
- Existing records without `setId` continue through legacy pack/difficulty aggregation.

- [ ] **Step 1: Add failing tests** for first completion, repeat completion, and serialization of `setId` plus ordered `entryIds`.
- [ ] **Step 2: Run the focused progress tests** and verify the new assertions fail because records currently aggregate by difficulty/pack.
- [ ] **Step 3: Add set-scoped record storage and update completion call sites** to pass the active set ID and ordered level IDs. Preserve legacy fields when present.
- [ ] **Step 4: Run `node --test src/services/playerProgress.test.mjs src/services/dailyChallenge.test.mjs`** and verify all timing paths pass.

### Task 4: Key standard leaderboards by Photo Set

**Files:**
- Modify: `src/services/playerProgress.js`
- Modify: `src/components/ProgressModal.jsx`
- Modify: `src/components/ProgressModal.test.mjs`
- Modify: `src/services/gameCenter.js`
- Modify: `src/services/gameCenter.test.mjs`

**Interfaces:**
- Progress payloads expose `bySetFirst`, `bySetRepeat`, and `fastestTimeBySet` keyed by `setId`.
- Progress UI labels standard rankings with the selected Photo Set identity and no new difficulty selector for photo results.
- Game Center mirroring uses a stable global/set-compatible score path without choosing a difficulty leaderboard for photo results; existing legacy difficulty IDs remain supported for old callers.

- [ ] **Step 1: Add failing tests** for set-keyed payload fields and UI source behavior that avoids new photo difficulty ranking.
- [ ] **Step 2: Run progress and Game Center tests** and verify failures.
- [ ] **Step 3: Implement set-keyed aggregation and UI selection** while retaining legacy fallback lists for records that lack `setId`.
- [ ] **Step 4: Run all service/component tests** covering progress, Game Center, and Photo Mode.

### Task 5: Verify Daily uses the same content identity model

**Files:**
- Modify: `src/services/dailyChallenge.js`
- Modify: `src/services/dailyChallenge.test.mjs`
- Modify: `src/App.jsx`
- Modify: `src/components/SetOfTheDayBanner.jsx`

**Interfaces:**
- Daily completion records include `dateStr`, daily `setId`, ordered three-entry IDs, and first/repeat timing fields.
- Existing date-keyed leaderboard behavior remains unchanged externally.

- [ ] **Step 1: Add failing tests** for stable daily set identity and ordered entry IDs in completion payloads.
- [ ] **Step 2: Run the daily tests** and verify failures.
- [ ] **Step 3: Add the daily set ID to queue resolution and completion persistence** without changing the current three-entry schedule or debug behavior.
- [ ] **Step 4: Verify the completed daily banner and modal still show the same date’s data.**

### Task 6: Full regression verification

**Files:**
- Test: `src/**/*.test.mjs`

- [ ] **Step 1: Run `node --test src/**/*.test.mjs`** and resolve regressions in deterministic selection, daily behavior, progress, or UI.
- [ ] **Step 2: Run `npm run build`** and verify the production bundle succeeds.
- [ ] **Step 3: Inspect the generated manifest and confirm every competitive Photo Set has exactly five ordered entries and every Daily set has exactly three.**
- [ ] **Step 4: Record the final set count and compatibility notes in the completion report.**
