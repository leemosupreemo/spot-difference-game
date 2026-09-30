# In-App Photo Content Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a debug-only in-app content studio that generates reviewable photo-pair candidates, lets the curator approve or reject them, and promotes approved pairs into the playable photo-pair manifest.

**Architecture:** Keep gameplay loading unchanged and add a separate candidate pipeline. Browser React renders candidate images and review controls; a local Node API owns filesystem writes, candidate state, manifest mutation, and validation.

**Tech Stack:** React 19, Vite 8, Node ESM, `node:test`, Node `http`, Node `fs/promises`, existing photo-pair manifest utilities.

## Global Constraints

- The studio is for local development and content curation.
- It should not be available in production builds or normal player flows.
- The React app handles generation controls and review decisions.
- The local API owns filesystem writes: candidate metadata, candidate image assets, approved asset placement, and manifest updates.
- Runtime gameplay should remain unchanged.
- Pending and rejected candidates never appear for players.
- Approved manifest entries must stay strict, validated, and playable.
- Do not add a required external service or AI provider in the first pass.
- Do not add production/admin authentication in the first pass.
- Do not ship the studio in iOS builds.

---

## File Structure

- Create `scripts/contentStudio/contentStore.mjs`: filesystem-backed candidate and promotion store.
- Create `scripts/contentStudio/contentStore.test.mjs`: unit tests for candidate state transitions and manifest mutation.
- Create `scripts/contentStudio/contentApiServer.mjs`: local HTTP API for the React studio.
- Create `scripts/contentStudio/contentApiServer.test.mjs`: API-level tests using a temporary repo root.
- Modify `package.json`: add `test`, `content:api`, and `dev:content` scripts.
- Create `src/utils/contentStudioClient.js`: browser API client and procedural candidate capture helpers.
- Create `src/components/ContentStudioModal.jsx`: debug-only generation, review, and approved-level UI.
- Modify `src/components/DebugLevelGeneratorModal.jsx`: add a button to open the content studio.
- Modify `src/App.jsx`: own content studio modal state and pass the open handler into the debug modal.
- Modify `src/index.css`: add compact content studio styles.
- Modify `scripts/validate_photo_pairs.mjs`: export a reusable `validatePhotoPairs({ repoRoot })` function while preserving CLI behavior.

---

### Task 1: Content Store

**Files:**
- Create: `scripts/contentStudio/contentStore.mjs`
- Create: `scripts/contentStudio/contentStore.test.mjs`
- Modify: `scripts/validate_photo_pairs.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `validatePhotoPairManifest(entries)` from `src/utils/photoPairManifest.js`
- Produces:
  - `makeContentStore({ repoRoot })`
  - `store.listCandidates(): Promise<{ candidates: Candidate[], approvedEntries: object[] }>`
  - `store.saveGeneratedCandidates({ candidates }): Promise<Candidate[]>`
  - `store.updateCandidateHotspot({ id, diff }): Promise<Candidate>`
  - `store.rejectCandidate({ id }): Promise<Candidate>`
  - `store.approveCandidate({ id }): Promise<{ candidate: Candidate, approvedEntry: object }>`
  - `slugifySegment(value): string`

- [ ] **Step 1: Write failing content store tests**

Create `scripts/contentStudio/contentStore.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeContentStore, slugifySegment } from './contentStore.mjs';

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function makeRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-store-'));
  await fs.mkdir(path.join(repoRoot, 'public/levels'), { recursive: true });
  await fs.writeFile(path.join(repoRoot, 'public/levels/photo_pair_manifest.json'), '[]\n');
  return repoRoot;
}

function candidate(overrides = {}) {
  return {
    id: 'candidate_001',
    title: 'Kitchen Counter Cup',
    pack: 'Find the Sniper',
    packId: 'find_the_sniper',
    category: 'Kitchen Clutter',
    difficulty: 'Easy',
    baseDataUrl: PNG_DATA_URL,
    variantDataUrl: PNG_DATA_URL,
    diffs: [{ id: 1, x: 58.2, y: 54.4, radius: 9.5, hint: 'Center-right counter.' }],
    ...overrides
  };
}

test('slugifySegment creates stable filesystem-safe names', () => {
  assert.equal(slugifySegment('Find The Sniper!'), 'find-the-sniper');
  assert.equal(slugifySegment('  Kitchen 001  '), 'kitchen-001');
});

test('saveGeneratedCandidates writes candidate metadata and images', async () => {
  const repoRoot = await makeRepo();
  const store = makeContentStore({ repoRoot });

  const saved = await store.saveGeneratedCandidates({ candidates: [candidate()] });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].status, 'pending');
  assert.match(saved[0].baseImage, /^\/levels\/photo-pair-candidates\//);
  await fs.access(path.join(repoRoot, 'public', saved[0].baseImage.slice(1)));
  await fs.access(path.join(repoRoot, 'public/levels/photo_pair_candidates.json'));
});

test('updateCandidateHotspot replaces the one manifest hotspot', async () => {
  const repoRoot = await makeRepo();
  const store = makeContentStore({ repoRoot });
  await store.saveGeneratedCandidates({ candidates: [candidate()] });

  const updated = await store.updateCandidateHotspot({
    id: 'candidate-001',
    diff: { id: 1, x: 50, y: 40, radius: 7, hint: 'Adjusted spot.' }
  });

  assert.deepEqual(updated.diffs, [{ id: 1, x: 50, y: 40, radius: 7, hint: 'Adjusted spot.' }]);
});

test('rejectCandidate marks a pending candidate rejected without touching approved manifest', async () => {
  const repoRoot = await makeRepo();
  const store = makeContentStore({ repoRoot });
  await store.saveGeneratedCandidates({ candidates: [candidate()] });

  const rejected = await store.rejectCandidate({ id: 'candidate-001' });
  const manifest = JSON.parse(await fs.readFile(path.join(repoRoot, 'public/levels/photo_pair_manifest.json'), 'utf8'));

  assert.equal(rejected.status, 'rejected');
  assert.deepEqual(manifest, []);
});

test('approveCandidate copies images into playable photo pairs and appends manifest entry', async () => {
  const repoRoot = await makeRepo();
  const store = makeContentStore({ repoRoot });
  await store.saveGeneratedCandidates({ candidates: [candidate()] });

  const result = await store.approveCandidate({ id: 'candidate-001' });
  const manifest = JSON.parse(await fs.readFile(path.join(repoRoot, 'public/levels/photo_pair_manifest.json'), 'utf8'));

  assert.equal(result.candidate.status, 'approved');
  assert.equal(result.approvedEntry.id, 'kitchen-counter-cup');
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].baseImage, '/levels/photo-pairs/find-the-sniper/kitchen-counter-cup/base.png');
  await fs.access(path.join(repoRoot, 'public/levels/photo-pairs/find-the-sniper/kitchen-counter-cup/base.png'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/contentStudio/contentStore.test.mjs
```

Expected: FAIL with a module-not-found error for `contentStore.mjs`.

- [ ] **Step 3: Export reusable validation while keeping CLI behavior**

Modify `scripts/validate_photo_pairs.mjs` so it exports `validatePhotoPairs` and still runs from the command line:

```js
export async function validatePhotoPairs({ repoRoot: root = repoRoot } = {}) {
  const targetManifestPath = path.join(root, 'public/levels/photo_pair_manifest.json');
  if (!fs.existsSync(targetManifestPath)) {
    throw new Error(`Missing manifest: ${targetManifestPath}`);
  }

  const entries = JSON.parse(fs.readFileSync(targetManifestPath, 'utf8'));
  const result = validatePhotoPairManifest(entries);
  const missingFiles = result.validEntries
    .flatMap(entry => [entry.baseImage, entry.variantImage])
    .filter(assetPath => !fs.existsSync(path.join(root, 'public', assetPath.replace(/^\/+/, ''))));

  if (result.errors.length || missingFiles.length) {
    throw new Error([
      ...result.errors,
      ...missingFiles.map(assetPath => `Missing asset: ${assetPath}`)
    ].join('\n'));
  }

  return { ...result, missingFiles };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await validatePhotoPairs();
    result.warnings.forEach(warning => console.warn(`[photo-pairs] ${warning}`));
    console.log(`Validated ${result.validEntries.length} photo pair level${result.validEntries.length === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Implement `contentStore.mjs`**

Create `scripts/contentStudio/contentStore.mjs`:

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePhotoPairManifest } from '../../src/utils/photoPairManifest.js';
import { validatePhotoPairs } from '../validate_photo_pairs.mjs';

const CANDIDATE_MANIFEST = 'public/levels/photo_pair_candidates.json';
const APPROVED_MANIFEST = 'public/levels/photo_pair_manifest.json';

export function slugifySegment(value) {
  return String(value || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function publicPath(repoRoot, assetPath) {
  return path.join(repoRoot, 'public', assetPath.replace(/^\/+/, ''));
}

async function readJsonArray(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tempPath, filePath);
}

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/(png);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Candidate images must be PNG data URLs.');
  return Buffer.from(match[2], 'base64');
}

function toCandidateRecord(candidate, index) {
  const batchId = candidate.batchId || `batch_${Date.now()}`;
  const id = slugifySegment(candidate.id || `${batchId}_${index + 1}`);
  const baseImage = `/levels/photo-pair-candidates/${batchId}/${id}/base.png`;
  const variantImage = `/levels/photo-pair-candidates/${batchId}/${id}/variant.png`;

  return {
    id,
    status: 'pending',
    batchId,
    title: candidate.title || id,
    pack: candidate.pack || 'Find the Sniper',
    packId: candidate.packId || 'find_the_sniper',
    category: candidate.category || candidate.pack || 'Find the Sniper',
    difficulty: candidate.difficulty || 'Medium',
    baseImage,
    variantImage,
    diffs: candidate.diffs
  };
}

function candidateToApprovedEntry(candidate, existingEntries) {
  const packSlug = slugifySegment(candidate.packId || candidate.pack);
  const baseId = slugifySegment(candidate.approvedLevelId || candidate.title || candidate.id);
  const existingIds = new Set(existingEntries.map(entry => entry.id));
  let levelId = baseId;
  let suffix = 2;
  while (existingIds.has(levelId)) {
    levelId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    id: levelId,
    title: candidate.title,
    pack: candidate.pack,
    packId: candidate.packId,
    category: candidate.category,
    difficulty: candidate.difficulty,
    baseImage: `/levels/photo-pairs/${packSlug}/${levelId}/base.png`,
    variantImage: `/levels/photo-pairs/${packSlug}/${levelId}/variant.png`,
    diffs: candidate.diffs
  };
}

export function makeContentStore({ repoRoot }) {
  const candidateManifestPath = path.join(repoRoot, CANDIDATE_MANIFEST);
  const approvedManifestPath = path.join(repoRoot, APPROVED_MANIFEST);

  async function readCandidates() {
    return readJsonArray(candidateManifestPath);
  }

  async function writeCandidates(candidates) {
    await writeJsonAtomic(candidateManifestPath, candidates);
  }

  return {
    async listCandidates() {
      return {
        candidates: await readCandidates(),
        approvedEntries: await readJsonArray(approvedManifestPath)
      };
    },

    async saveGeneratedCandidates({ candidates }) {
      const existing = await readCandidates();
      const batchId = `batch_${Date.now()}`;
      const records = [];

      for (const [index, candidate] of candidates.entries()) {
        const record = toCandidateRecord({ ...candidate, batchId }, index);
        await fs.mkdir(path.dirname(publicPath(repoRoot, record.baseImage)), { recursive: true });
        await fs.writeFile(publicPath(repoRoot, record.baseImage), decodeDataUrl(candidate.baseDataUrl));
        await fs.writeFile(publicPath(repoRoot, record.variantImage), decodeDataUrl(candidate.variantDataUrl));
        records.push(record);
      }

      await writeCandidates([...existing, ...records]);
      return records;
    },

    async updateCandidateHotspot({ id, diff }) {
      const candidates = await readCandidates();
      const index = candidates.findIndex(candidate => candidate.id === id);
      if (index === -1) throw new Error(`Unknown candidate: ${id}`);
      const next = { ...candidates[index], diffs: [{ ...diff, id: 1 }] };
      candidates[index] = next;
      await writeCandidates(candidates);
      return next;
    },

    async rejectCandidate({ id }) {
      const candidates = await readCandidates();
      const index = candidates.findIndex(candidate => candidate.id === id);
      if (index === -1) throw new Error(`Unknown candidate: ${id}`);
      const next = { ...candidates[index], status: 'rejected', rejectedAt: new Date().toISOString() };
      candidates[index] = next;
      await writeCandidates(candidates);
      return next;
    },

    async approveCandidate({ id }) {
      const candidates = await readCandidates();
      const index = candidates.findIndex(candidate => candidate.id === id);
      if (index === -1) throw new Error(`Unknown candidate: ${id}`);
      const candidate = candidates[index];
      const existingEntries = await readJsonArray(approvedManifestPath);
      const approvedEntry = candidateToApprovedEntry(candidate, existingEntries);
      const validation = validatePhotoPairManifest([approvedEntry]);
      if (validation.errors.length > 0) throw new Error(validation.errors.join('\n'));

      await fs.mkdir(path.dirname(publicPath(repoRoot, approvedEntry.baseImage)), { recursive: true });
      await fs.copyFile(publicPath(repoRoot, candidate.baseImage), publicPath(repoRoot, approvedEntry.baseImage));
      await fs.copyFile(publicPath(repoRoot, candidate.variantImage), publicPath(repoRoot, approvedEntry.variantImage));
      await writeJsonAtomic(approvedManifestPath, [...existingEntries, approvedEntry]);

      try {
        await validatePhotoPairs({ repoRoot });
      } catch (error) {
        await writeJsonAtomic(approvedManifestPath, existingEntries);
        throw error;
      }

      const nextCandidate = {
        ...candidate,
        status: 'approved',
        approvedLevelId: approvedEntry.id,
        approvedAt: new Date().toISOString()
      };
      candidates[index] = nextCandidate;
      await writeCandidates(candidates);
      return { candidate: nextCandidate, approvedEntry };
    }
  };
}
```

- [ ] **Step 5: Add a test script**

Modify `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "oxlint",
  "preview": "vite preview",
  "test": "node --test src/**/*.test.mjs scripts/**/*.test.mjs"
}
```

- [ ] **Step 6: Run content store tests**

Run:

```bash
node --test scripts/contentStudio/contentStore.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Run existing photo-pair tests and validator**

Run:

```bash
node --test src/utils/photoPairManifest.test.mjs src/utils/photoPairLevelLoader.test.mjs
node scripts/validate_photo_pairs.mjs
```

Expected: tests PASS; validator prints a validated count and existing low-count warnings only.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/validate_photo_pairs.mjs scripts/contentStudio/contentStore.mjs scripts/contentStudio/contentStore.test.mjs
git commit -m "Add content studio store"
```

---

### Task 2: Local Content API

**Files:**
- Create: `scripts/contentStudio/contentApiServer.mjs`
- Create: `scripts/contentStudio/contentApiServer.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `makeContentStore({ repoRoot })`
- Produces:
  - `createContentApiServer({ repoRoot, store }): http.Server`
  - `POST /api/content/generate`
  - `GET /api/content/candidates`
  - `POST /api/content/candidates/:id/hotspot`
  - `POST /api/content/candidates/:id/reject`
  - `POST /api/content/candidates/:id/approve`

- [ ] **Step 1: Write failing API tests**

Create `scripts/contentStudio/contentApiServer.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createContentApiServer } from './contentApiServer.mjs';

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function makeRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'content-api-'));
  await fs.mkdir(path.join(repoRoot, 'public/levels'), { recursive: true });
  await fs.writeFile(path.join(repoRoot, 'public/levels/photo_pair_manifest.json'), '[]\n');
  return repoRoot;
}

async function withServer(repoRoot, fn) {
  const server = createContentApiServer({ repoRoot });
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function candidate() {
  return {
    id: 'candidate_001',
    title: 'Kitchen Counter Cup',
    pack: 'Find the Sniper',
    packId: 'find_the_sniper',
    category: 'Kitchen Clutter',
    difficulty: 'Easy',
    baseDataUrl: PNG_DATA_URL,
    variantDataUrl: PNG_DATA_URL,
    diffs: [{ id: 1, x: 58, y: 54, radius: 9, hint: 'Cup.' }]
  };
}

test('content API generates, lists, updates, rejects, and approves candidates', async () => {
  const repoRoot = await makeRepo();
  await withServer(repoRoot, async (baseUrl) => {
    const generatedResponse = await fetch(`${baseUrl}/api/content/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidates: [candidate()] })
    });
    assert.equal(generatedResponse.status, 200);
    const generated = await generatedResponse.json();
    assert.equal(generated.candidates.length, 1);

    const listed = await (await fetch(`${baseUrl}/api/content/candidates`)).json();
    assert.equal(listed.candidates[0].status, 'pending');

    const hotspotResponse = await fetch(`${baseUrl}/api/content/candidates/candidate-001/hotspot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ diff: { id: 1, x: 50, y: 45, radius: 7, hint: 'Updated.' } })
    });
    assert.equal(hotspotResponse.status, 200);
    assert.equal((await hotspotResponse.json()).candidate.diffs[0].x, 50);

    const approveResponse = await fetch(`${baseUrl}/api/content/candidates/candidate-001/approve`, { method: 'POST' });
    assert.equal(approveResponse.status, 200);
    assert.equal((await approveResponse.json()).candidate.status, 'approved');
  });
});

test('content API returns 404 JSON for unknown endpoints', async () => {
  const repoRoot = await makeRepo();
  await withServer(repoRoot, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/content/nope`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'Not found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test scripts/contentStudio/contentApiServer.test.mjs
```

Expected: FAIL with a module-not-found error for `contentApiServer.mjs`.

- [ ] **Step 3: Implement the local API server**

Create `scripts/contentStudio/contentApiServer.mjs`:

```js
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContentStore } from './contentStore.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': 'http://localhost:5173',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(JSON.stringify(body));
}

function candidateIdFromPath(pathname, action) {
  const match = new RegExp(`^/api/content/candidates/([^/]+)/${action}$`).exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createContentApiServer({ repoRoot: root = repoRoot, store = makeContentStore({ repoRoot: root }) } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'OPTIONS') return sendJson(res, 204, {});

      if (req.method === 'GET' && url.pathname === '/api/content/candidates') {
        return sendJson(res, 200, await store.listCandidates());
      }

      if (req.method === 'POST' && url.pathname === '/api/content/generate') {
        const body = await readJson(req);
        const candidates = await store.saveGeneratedCandidates({ candidates: body.candidates || [] });
        return sendJson(res, 200, { candidates });
      }

      const hotspotId = req.method === 'POST' ? candidateIdFromPath(url.pathname, 'hotspot') : null;
      if (hotspotId) {
        const body = await readJson(req);
        const candidate = await store.updateCandidateHotspot({ id: hotspotId, diff: body.diff });
        return sendJson(res, 200, { candidate });
      }

      const rejectId = req.method === 'POST' ? candidateIdFromPath(url.pathname, 'reject') : null;
      if (rejectId) {
        const candidate = await store.rejectCandidate({ id: rejectId });
        return sendJson(res, 200, { candidate });
      }

      const approveId = req.method === 'POST' ? candidateIdFromPath(url.pathname, 'approve') : null;
      if (approveId) {
        return sendJson(res, 200, await store.approveCandidate({ id: approveId }));
      }

      return sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.CONTENT_STUDIO_PORT || 4174);
  createContentApiServer().listen(port, () => {
    console.log(`Content studio API listening on http://localhost:${port}`);
  });
}
```

- [ ] **Step 4: Add npm scripts**

Modify `package.json`:

```json
"content:api": "node scripts/contentStudio/contentApiServer.mjs",
"dev:content": "npm run content:api"
```

Keep `dev:content` as a visible alias even though it starts only the API. Run Vite separately with `npm run dev` so the two logs stay readable.

- [ ] **Step 5: Run API tests**

Run:

```bash
node --test scripts/contentStudio/contentApiServer.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run all Node tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/contentStudio/contentApiServer.mjs scripts/contentStudio/contentApiServer.test.mjs
git commit -m "Add content studio API"
```

---

### Task 3: Browser Candidate Generation Client

**Files:**
- Create: `src/utils/contentStudioClient.js`

**Interfaces:**
- Consumes: `generateProceduralLevelPair(themeId, difficulty, seed)` from `src/utils/proceduralGenerator.js`
- Produces:
  - `CONTENT_STUDIO_API_BASE`
  - `fetchContentStudioState(): Promise<{ candidates: object[], approvedEntries: object[] }>`
  - `generateProceduralCandidateDrafts(options): Promise<object[]>`
  - `saveGeneratedCandidates(candidates): Promise<object[]>`
  - `updateCandidateHotspot(id, diff): Promise<object>`
  - `approveCandidate(id): Promise<object>`
  - `rejectCandidate(id): Promise<object>`

- [ ] **Step 1: Create the client module**

Create `src/utils/contentStudioClient.js`:

```js
import { generateProceduralLevelPair, SCENE_THEMES } from './proceduralGenerator';

export const CONTENT_STUDIO_API_BASE = 'http://localhost:4174';
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

async function requestJson(path, options = {}) {
  const response = await fetch(`${CONTENT_STUDIO_API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Content studio request failed: ${response.status}`);
  return body;
}

function renderLevelDataUrl(level, isModified) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  level.render(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, isModified);
  return canvas.toDataURL('image/png');
}

function titleForTheme(themeId) {
  return SCENE_THEMES.find(theme => theme.id === themeId)?.title || 'Generated Scene';
}

export function apiAvailableInThisBuild() {
  return import.meta.env.DEV;
}

export async function fetchContentStudioState() {
  return requestJson('/api/content/candidates');
}

export async function generateProceduralCandidateDrafts({
  themeId = 'find_the_sniper',
  difficulty = 'Medium',
  count = 5,
  pack = 'Find the Sniper',
  packId = 'find_the_sniper',
  category = 'Generated Candidate'
} = {}) {
  const startedAt = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const seed = startedAt + index * 1009;
    const level = generateProceduralLevelPair(themeId, difficulty, seed);
    const diff = level.diffs[0] || { id: 1, x: 50, y: 50, radius: 8, hint: 'Compare the image pair.' };

    return {
      id: `candidate_${startedAt}_${index + 1}`,
      title: `${titleForTheme(themeId)} ${index + 1}`,
      pack,
      packId,
      category,
      difficulty,
      baseDataUrl: renderLevelDataUrl(level, false),
      variantDataUrl: renderLevelDataUrl(level, true),
      diffs: [{ ...diff, id: 1, hint: diff.hint || 'Compare the image pair.' }]
    };
  });
}

export async function saveGeneratedCandidates(candidates) {
  return (await requestJson('/api/content/generate', {
    method: 'POST',
    body: JSON.stringify({ candidates })
  })).candidates;
}

export async function updateCandidateHotspot(id, diff) {
  return (await requestJson(`/api/content/candidates/${encodeURIComponent(id)}/hotspot`, {
    method: 'POST',
    body: JSON.stringify({ diff })
  })).candidate;
}

export async function approveCandidate(id) {
  return requestJson(`/api/content/candidates/${encodeURIComponent(id)}/approve`, { method: 'POST' });
}

export async function rejectCandidate(id) {
  return (await requestJson(`/api/content/candidates/${encodeURIComponent(id)}/reject`, { method: 'POST' })).candidate;
}
```

- [ ] **Step 2: Confirm the client module compiles**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/contentStudioClient.js
git commit -m "Add content studio browser client"
```

---

### Task 4: Content Studio UI

**Files:**
- Create: `src/components/ContentStudioModal.jsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes:
  - `fetchContentStudioState()`
  - `generateProceduralCandidateDrafts(options)`
  - `saveGeneratedCandidates(candidates)`
  - `updateCandidateHotspot(id, diff)`
  - `approveCandidate(id)`
  - `rejectCandidate(id)`
- Produces:
  - `ContentStudioModal({ isOpen, onClose })`

- [ ] **Step 1: Create the modal component**

Create `src/components/ContentStudioModal.jsx`:

```jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCcw, Sparkles, Target, ThumbsDown, X } from 'lucide-react';
import {
  approveCandidate,
  fetchContentStudioState,
  generateProceduralCandidateDrafts,
  rejectCandidate,
  saveGeneratedCandidates,
  updateCandidateHotspot
} from '../utils/contentStudioClient';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

function CandidateCard({ candidate, onApprove, onReject, onHotspotChange }) {
  const diff = candidate.diffs?.[0] || { x: 50, y: 50, radius: 8, hint: '' };

  return (
    <article className="content-studio-card">
      <div className="content-studio-card-header">
        <div>
          <h3>{candidate.title}</h3>
          <span>{candidate.category} / {candidate.difficulty}</span>
        </div>
        <span className={`content-studio-status ${candidate.status}`}>{candidate.status}</span>
      </div>

      <div className="content-studio-previews">
        {[candidate.baseImage, candidate.variantImage].map((src, index) => (
          <div className="content-studio-preview" key={`${candidate.id}-${index}`}>
            <img src={src} alt={index === 0 ? 'Base candidate' : 'Variant candidate'} />
            <span
              className="content-studio-hotspot"
              style={{
                left: `${diff.x}%`,
                top: `${diff.y}%`,
                width: `${diff.radius * 2}%`,
                height: `${diff.radius * 2}%`
              }}
            />
          </div>
        ))}
      </div>

      <div className="content-studio-fields">
        <label>
          X
          <input
            type="number"
            min="0"
            max="100"
            value={diff.x}
            onChange={(event) => onHotspotChange(candidate.id, { ...diff, x: Number(event.target.value) })}
          />
        </label>
        <label>
          Y
          <input
            type="number"
            min="0"
            max="100"
            value={diff.y}
            onChange={(event) => onHotspotChange(candidate.id, { ...diff, y: Number(event.target.value) })}
          />
        </label>
        <label>
          Radius
          <input
            type="number"
            min="1"
            max="30"
            value={diff.radius}
            onChange={(event) => onHotspotChange(candidate.id, { ...diff, radius: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="content-studio-actions">
        <button className="glass-btn" onClick={() => onReject(candidate.id)} disabled={candidate.status !== 'pending'}>
          <ThumbsDown size={16} /> Reject
        </button>
        <button className="glass-btn glass-btn-primary" onClick={() => onApprove(candidate.id)} disabled={candidate.status !== 'pending'}>
          <Check size={16} /> Approve
        </button>
      </div>
    </article>
  );
}

export default function ContentStudioModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('review');
  const [difficulty, setDifficulty] = useState('Medium');
  const [count, setCount] = useState(5);
  const [state, setState] = useState({ candidates: [], approvedEntries: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pendingCandidates = useMemo(
    () => state.candidates.filter(candidate => candidate.status === 'pending'),
    [state.candidates]
  );

  async function refresh() {
    setError('');
    setState(await fetchContentStudioState());
  }

  useEffect(() => {
    if (!isOpen) return;
    refresh().catch(error => setError(error.message));
  }, [isOpen]);

  async function runAction(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="content-studio-shell">
      <section className="content-studio-panel glass-panel">
        <header className="content-studio-header">
          <div>
            <h2>Content Studio</h2>
            <span>Generate, review, and promote photo-pair candidates.</span>
          </div>
          <button className="glass-btn" onClick={onClose}><X size={18} /></button>
        </header>

        <nav className="content-studio-tabs">
          {['generate', 'review', 'approved'].map(tab => (
            <button
              key={tab}
              className={`glass-btn ${activeTab === tab ? 'glass-btn-primary' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {error && <div className="content-studio-error">{error}</div>}

        {activeTab === 'generate' && (
          <div className="content-studio-generate">
            <label>
              Difficulty
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                {DIFFICULTIES.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Count
              <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
                {[1, 3, 5, 10].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button
              className="glass-btn glass-btn-primary"
              disabled={busy}
              onClick={() => runAction(async () => {
                const drafts = await generateProceduralCandidateDrafts({ difficulty, count });
                await saveGeneratedCandidates(drafts);
                setActiveTab('review');
              })}
            >
              <Sparkles size={18} /> Generate Candidates
            </button>
          </div>
        )}

        {activeTab === 'review' && (
          <>
            <button className="glass-btn" disabled={busy} onClick={() => runAction(refresh)}>
              <RefreshCcw size={16} /> Refresh
            </button>
            <div className="content-studio-grid">
              {pendingCandidates.map(candidate => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onReject={(id) => runAction(() => rejectCandidate(id))}
                  onApprove={(id) => runAction(() => approveCandidate(id))}
                  onHotspotChange={(id, diff) => runAction(() => updateCandidateHotspot(id, diff))}
                />
              ))}
              {pendingCandidates.length === 0 && <div className="content-studio-empty"><Target size={18} /> No pending candidates.</div>}
            </div>
          </>
        )}

        {activeTab === 'approved' && (
          <div className="content-studio-approved-list">
            {state.approvedEntries.map(entry => (
              <div key={entry.id} className="content-studio-approved-row">
                <strong>{entry.title}</strong>
                <span>{entry.packId} / {entry.difficulty}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add content studio styles**

Append to `src/index.css`:

```css
.content-studio-shell {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 16px;
  background: rgba(5, 6, 12, 0.9);
}

.content-studio-panel {
  width: min(1180px, 100%);
  overflow: auto;
  padding: 20px;
  border-radius: 8px;
}

.content-studio-header,
.content-studio-card-header,
.content-studio-actions,
.content-studio-tabs,
.content-studio-generate,
.content-studio-fields {
  display: flex;
  align-items: center;
  gap: 12px;
}

.content-studio-header,
.content-studio-card-header {
  justify-content: space-between;
}

.content-studio-header h2,
.content-studio-card h3 {
  margin: 0;
  color: #fff;
}

.content-studio-tabs {
  margin: 18px 0;
  flex-wrap: wrap;
}

.content-studio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 14px;
}

.content-studio-card {
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.content-studio-previews {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 12px 0;
}

.content-studio-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 6px;
  background: #080812;
}

.content-studio-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.content-studio-hotspot {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 2px solid var(--accent-gold);
  border-radius: 999px;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.content-studio-fields {
  flex-wrap: wrap;
}

.content-studio-fields label,
.content-studio-generate label {
  display: grid;
  gap: 4px;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.content-studio-fields input,
.content-studio-generate select {
  width: 96px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border: 1px solid var(--border-glass);
  border-radius: 6px;
  padding: 8px;
}

.content-studio-status {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.1);
}

.content-studio-error {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid rgba(255, 0, 127, 0.4);
  border-radius: 8px;
  color: #fff;
  background: rgba(255, 0, 127, 0.12);
}

.content-studio-empty,
.content-studio-approved-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  color: var(--text-main);
}

.content-studio-approved-list {
  display: grid;
  gap: 8px;
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ContentStudioModal.jsx src/index.css
git commit -m "Add content studio modal"
```

---

### Task 5: Debug Integration

**Files:**
- Modify: `src/components/DebugLevelGeneratorModal.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `ContentStudioModal({ isOpen, onClose })`
- Produces:
  - `DebugLevelGeneratorModal` prop `onOpenContentStudio`
  - app state `contentStudioOpen`

- [ ] **Step 1: Wire the studio into App with a dev-only lazy import**

Modify the React import in `src/App.jsx`:

```js
import React, { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
```

Add this constant after the imports:

```js
const ContentStudioModal = import.meta.env.DEV
  ? React.lazy(() => import('./components/ContentStudioModal'))
  : null;
```

Add state near the other modal state:

```js
const [contentStudioOpen, setContentStudioOpen] = useState(false);
```

Pass the open handler into `DebugLevelGeneratorModal`:

```jsx
<DebugLevelGeneratorModal
  isOpen={debugModalOpen}
  onClose={() => setDebugModalOpen(false)}
  onOpenContentStudio={() => setContentStudioOpen(true)}
  onInjectLevels={(pack) => {
    setLevels(prev => [...prev, ...pack]);
    startStageWithLevels(pack);
  }}
/>
```

Render the studio only when the development-only lazy import exists and debug mode is active:

```jsx
{ContentStudioModal && debugMode && (
  <Suspense fallback={null}>
    <ContentStudioModal
      isOpen={contentStudioOpen}
      onClose={() => setContentStudioOpen(false)}
    />
  </Suspense>
)}
```

- [ ] **Step 2: Add the debug modal launcher**

Modify `src/components/DebugLevelGeneratorModal.jsx` function signature:

```js
export default function DebugLevelGeneratorModal({ isOpen, onClose, onInjectLevels, onOpenContentStudio }) {
```

Add a button in the modal header action area. Keep it development-only so packaged builds do not expose the studio launcher:

```jsx
{import.meta.env.DEV && onOpenContentStudio && (
  <button
    onClick={() => {
      sounds.playTap();
      onOpenContentStudio();
    }}
    className="glass-btn glass-btn-primary"
    style={{ padding: '8px 12px', borderRadius: '10px' }}
  >
    <ImageIcon size={16} /> Content Studio
  </button>
)}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/DebugLevelGeneratorModal.jsx
git commit -m "Wire content studio into debug tools"
```

---

### Task 6: End-To-End Local Verification

**Files:**
- Modify only if verification reveals a defect in files from Tasks 1-5.

**Interfaces:**
- Consumes: all interfaces from Tasks 1-5.
- Produces: verified local workflow.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm test
npm run lint
npm run build
node scripts/validate_photo_pairs.mjs
```

Expected: all commands exit 0. The validator may print existing warnings for pack/difficulty counts below five.

- [ ] **Step 2: Start the content API**

Run:

```bash
npm run content:api
```

Expected: terminal prints `Content studio API listening on http://localhost:4174`.

- [ ] **Step 3: Start Vite in a second terminal**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL, normally `http://localhost:5173/`.

- [ ] **Step 4: Manually verify generation and approval**

Open the app at:

```text
http://localhost:5173/?debug=1
```

Manual path:

1. Open the debug modal.
2. Open Content Studio.
3. Generate one `Easy` candidate.
4. Confirm the candidate appears in the `Review` tab with two images and a hotspot circle.
5. Adjust `X`, `Y`, and `Radius`.
6. Approve the candidate.
7. Confirm `public/levels/photo_pair_manifest.json` has one new approved entry.
8. Confirm approved images exist under `public/levels/photo-pairs/`.
9. Start a game with `Easy` / `find_the_sniper`.
10. Confirm the approved candidate can appear as playable content.

- [ ] **Step 5: Manually verify rejection**

Manual path:

1. Generate one more candidate.
2. Reject it.
3. Confirm its status is `rejected` in `public/levels/photo_pair_candidates.json`.
4. Confirm no new entry was appended to `public/levels/photo_pair_manifest.json`.

- [ ] **Step 6: Stop dev servers**

Stop both terminal sessions with `Ctrl-C`.

- [ ] **Step 7: Commit verification fixes**

If Task 6 required code fixes, commit them:

```bash
git add package.json scripts src public/levels/photo_pair_candidates.json
git commit -m "Verify content studio workflow"
```

If Task 6 required no code fixes, do not create an empty commit.

---

## Final Verification Checklist

- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `node scripts/validate_photo_pairs.mjs` passes.
- [ ] Content API starts on `http://localhost:4174`.
- [ ] Vite app starts on its local URL.
- [ ] Debug-only Content Studio opens when `?debug=1` is active.
- [ ] Generated candidates are persisted under `public/levels/photo-pair-candidates/`.
- [ ] Approved candidates are promoted under `public/levels/photo-pairs/`.
- [ ] Rejected candidates do not modify `photo_pair_manifest.json`.
- [ ] Gameplay still loads approved photo pairs through the existing loader.
