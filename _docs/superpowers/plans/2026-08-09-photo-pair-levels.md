# Photo Pair Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manifest-driven pre-rendered photo pair level path for the spot-the-difference game.

**Architecture:** Add pure manifest validation helpers, a browser photo-pair level loader that adapts manifest entries to the existing `level.render()` contract, and wire `App.jsx` to prefer photo pairs before falling back to the current generated levels. Add a small sample manifest and asset folders so the path can be validated.

**Tech Stack:** React 19, Vite 8, browser Canvas, Node ESM scripts, Node built-in `node:test`.

## Global Constraints

- Source image pairs live under `public/levels/photo-pairs/<pack-slug>/<level-id>/`.
- Manifest path is `public/levels/photo_pair_manifest.json`.
- Each level has exactly one hotspot in percentage coordinates.
- Runtime should skip invalid or failed image pairs and fall back to generated content if needed.
- Do not redesign scoring, hints, misses, timer, or the main menu.
- Do not revert unrelated dirty worktree changes.

---

### Task 1: Manifest Validation Core

**Files:**
- Create: `src/utils/photoPairManifest.js`
- Create: `src/utils/photoPairManifest.test.mjs`

**Interfaces:**
- Produces: `PUBLIC_LEVEL_PREFIX: string`
- Produces: `isValidPhotoPairEntry(entry: unknown): boolean`
- Produces: `validatePhotoPairManifest(entries: unknown): { validEntries: object[], errors: string[], warnings: string[] }`
- Consumes: no app-specific modules.

- [ ] **Step 1: Write failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidPhotoPairEntry,
  validatePhotoPairManifest
} from './photoPairManifest.js';

const validEntry = {
  id: 'market_001',
  title: 'Cluttered Market Shelf',
  pack: 'Find the Sniper',
  packId: 'find_the_sniper',
  difficulty: 'Hard',
  category: 'Extreme Hunter',
  baseImage: '/levels/photo-pairs/find-the-sniper/market_001/base.webp',
  variantImage: '/levels/photo-pairs/find-the-sniper/market_001/variant.webp',
  diffs: [{ id: 1, x: 63.2, y: 48.7, radius: 4.5, hint: 'Middle shelf' }]
};

test('accepts a complete one-difference photo pair manifest entry', () => {
  assert.equal(isValidPhotoPairEntry(validEntry), true);
});

test('rejects entries with more than one hotspot', () => {
  assert.equal(isValidPhotoPairEntry({
    ...validEntry,
    diffs: [...validEntry.diffs, { id: 2, x: 10, y: 10, radius: 4 }]
  }), false);
});

test('returns valid entries and readable errors for invalid manifest data', () => {
  const result = validatePhotoPairManifest([validEntry, { id: 'bad' }]);
  assert.equal(result.validEntries.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /entry 2/i);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test src/utils/photoPairManifest.test.mjs`
Expected: FAIL because `photoPairManifest.js` does not exist.

- [ ] **Step 3: Implement minimal validation helpers**

```js
export const PUBLIC_LEVEL_PREFIX = '/levels/photo-pairs/';

export function isValidPhotoPairEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!isNonEmptyString(entry.id)) return false;
  if (!isNonEmptyString(entry.title)) return false;
  if (!isNonEmptyString(entry.packId)) return false;
  if (!['Easy', 'Medium', 'Hard'].includes(entry.difficulty)) return false;
  if (!isAssetPath(entry.baseImage) || !isAssetPath(entry.variantImage)) return false;
  if (!Array.isArray(entry.diffs) || entry.diffs.length !== 1) return false;
  return isValidDiff(entry.diffs[0]);
}

export function validatePhotoPairManifest(entries) {
  const validEntries = [];
  const errors = [];
  const warnings = [];
  if (!Array.isArray(entries)) {
    return { validEntries, errors: ['Manifest must be an array.'], warnings };
  }
  entries.forEach((entry, index) => {
    if (isValidPhotoPairEntry(entry)) validEntries.push(entry);
    else errors.push(`Entry ${index + 1} is not a valid photo pair level.`);
  });
  return { validEntries, errors, warnings };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node --test src/utils/photoPairManifest.test.mjs`
Expected: PASS.

### Task 2: Runtime Photo Pair Loader

**Files:**
- Create: `src/utils/photoPairLevelLoader.js`
- Create: `src/utils/photoPairLevelLoader.test.mjs`

**Interfaces:**
- Consumes: `validatePhotoPairManifest(entries)`
- Produces: `createPhotoPairLevel(entry: object, images: { base: HTMLImageElement, variant: HTMLImageElement }): object`
- Produces: `selectPhotoPairEntries(entries: object[], options: { packId: string, difficulty: string, count: number, seed: number }): object[]`
- Produces: `buildPhotoPairStage(options: { packId: string, difficulty: string, count?: number, seed?: number, fetchImpl?: Function, imageFactory?: Function }): Promise<object[]>`

- [ ] **Step 1: Write failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPhotoPairLevel,
  selectPhotoPairEntries
} from './photoPairLevelLoader.js';

const entry = {
  id: 'market_001',
  title: 'Cluttered Market Shelf',
  pack: 'Find the Sniper',
  packId: 'find_the_sniper',
  category: 'Extreme Hunter',
  difficulty: 'Hard',
  baseImage: '/levels/photo-pairs/find-the-sniper/market_001/base.webp',
  variantImage: '/levels/photo-pairs/find-the-sniper/market_001/variant.webp',
  diffs: [{ id: 1, x: 63.2, y: 48.7, radius: 4.5 }]
};

test('adapts a manifest entry into the existing level render contract', () => {
  const calls = [];
  const ctx = { drawImage: (...args) => calls.push(args) };
  const level = createPhotoPairLevel(entry, { base: { src: 'base' }, variant: { src: 'variant' } });
  level.render(ctx, 800, 600, false);
  level.render(ctx, 800, 600, true);
  assert.equal(level.totalDifferences, 1);
  assert.equal(level.diffs[0].x, 63.2);
  assert.deepEqual(calls.map(call => call[0].src), ['base', 'variant']);
});

test('selects matching entries by pack and difficulty with no duplicates', () => {
  const entries = [
    entry,
    { ...entry, id: 'market_002' },
    { ...entry, id: 'easy_001', difficulty: 'Easy' }
  ];
  const selected = selectPhotoPairEntries(entries, {
    packId: 'find_the_sniper',
    difficulty: 'Hard',
    count: 2,
    seed: 1
  });
  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map(item => item.id)).size, 2);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test src/utils/photoPairLevelLoader.test.mjs`
Expected: FAIL because `photoPairLevelLoader.js` does not exist.

- [ ] **Step 3: Implement loader and adapter**

```js
import { validatePhotoPairManifest } from './photoPairManifest.js';

export function createPhotoPairLevel(entry, images) {
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category || entry.pack,
    difficulty: entry.difficulty,
    totalDifferences: 1,
    bgGradient: ['#0b091a', '#1e1035'],
    accentColor: entry.difficulty === 'Hard' ? '#ff007f' : '#00f0ff',
    diffs: entry.diffs,
    render: (ctx, width, height, isModified) => {
      ctx.drawImage(isModified ? images.variant : images.base, 0, 0, width, height);
    }
  };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node --test src/utils/photoPairManifest.test.mjs src/utils/photoPairLevelLoader.test.mjs`
Expected: PASS.

### Task 3: Validator Script And Sample Manifest

**Files:**
- Create: `scripts/validate_photo_pairs.mjs`
- Create: `public/levels/photo_pair_manifest.json`
- Create: `public/levels/photo-pairs/find-the-sniper/sample_001/base.webp`
- Create: `public/levels/photo-pairs/find-the-sniper/sample_001/variant.webp`

**Interfaces:**
- Consumes: `validatePhotoPairManifest(entries)`
- Produces CLI: `node scripts/validate_photo_pairs.mjs`

- [ ] **Step 1: Write failing validation command expectation**

Run: `node scripts/validate_photo_pairs.mjs`
Expected: FAIL because the script does not exist.

- [ ] **Step 2: Implement validator script**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePhotoPairManifest } from '../src/utils/photoPairManifest.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'public/levels/photo_pair_manifest.json');
const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const result = validatePhotoPairManifest(entries);
const missingFiles = result.validEntries.flatMap(entry => [entry.baseImage, entry.variantImage])
  .filter(assetPath => !fs.existsSync(path.join(repoRoot, 'public', assetPath.replace(/^\/+/, ''))));

if (result.errors.length || missingFiles.length) {
  console.error([...result.errors, ...missingFiles.map(file => `Missing asset: ${file}`)].join('\n'));
  process.exit(1);
}
console.log(`Validated ${result.validEntries.length} photo pair levels.`);
```

- [ ] **Step 3: Add sample manifest and image files**

Create one small sample image pair at the target paths and add a manifest entry with `packId: "find_the_sniper"` and `difficulty: "Hard"`.

- [ ] **Step 4: Run validator**

Run: `node scripts/validate_photo_pairs.mjs`
Expected: PASS and reports one valid photo pair level.

### Task 4: App Integration

**Files:**
- Modify: `src/App.jsx`
- Test: `node --test src/utils/photoPairManifest.test.mjs src/utils/photoPairLevelLoader.test.mjs`

**Interfaces:**
- Consumes: `buildPhotoPairStage({ packId, difficulty, count, seed })`
- Preserves: existing generated fallback from `generatePhotographicLevelPair`.

- [ ] **Step 1: Write or run existing loader tests before app integration**

Run: `node --test src/utils/photoPairManifest.test.mjs src/utils/photoPairLevelLoader.test.mjs`
Expected: PASS before integrating into React state.

- [ ] **Step 2: Update start-game flow**

Change `handleStartGame` to be `async`, call `buildPhotoPairStage` first, and use returned levels when available. If no photo-pair levels are returned, build the current generated five-pair stage exactly as before.

- [ ] **Step 3: Preserve random-level fallback**

Update any single-level generation path that should use the new content pool only if it can do so without changing existing debug behavior. Keep debug generator procedural unless explicitly selected later.

- [ ] **Step 4: Run verification**

Run:

```bash
node scripts/validate_photo_pairs.mjs
node --test src/utils/photoPairManifest.test.mjs src/utils/photoPairLevelLoader.test.mjs
npm run build
```

Expected: all commands exit 0.
