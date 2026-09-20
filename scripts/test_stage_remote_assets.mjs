import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectFiles, findCollisions } from './stage_remote_assets.mjs';

function tmpTree(spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-'));
  for (const [rel, content] of Object.entries(spec)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

test('collects nested files as paths relative to the source root', () => {
  const root = tmpTree({ 'levels/a_base.webp': 'A', 'levels/b_variant.webp': 'B', 'levels/deep/c.webp': 'C' });
  assert.deepEqual(collectFiles(root).sort(),
    ['levels/a_base.webp', 'levels/b_variant.webp', 'levels/deep/c.webp'].map(p => p.split('/').join(path.sep)).sort());
});

test('a missing source directory stages nothing rather than throwing', () => {
  assert.deepEqual(collectFiles(path.join(os.tmpdir(), 'definitely-not-here-' + Date.now())), []);
});

test('refuses to shadow a file the app already ships', () => {
  // A remote-only copy overwriting bundled artwork would silently change what
  // players see, so staging must stop rather than clobber.
  const files = ['levels/shared.webp', 'levels/remote_only.webp'];
  const collisions = findCollisions(files, rel => rel === 'levels/shared.webp');
  assert.deepEqual(collisions, ['levels/shared.webp']);
});

test('no collisions when remote assets are genuinely separate', () => {
  assert.deepEqual(findCollisions(['levels/x.webp', 'levels/y.webp'], () => false), []);
});

test('the real remote-levels tree holds only level assets', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../remote-levels');
  const files = collectFiles(root);
  assert.ok(files.length > 0, 'remote-levels should not be empty');
  assert.ok(files.every(f => f.startsWith('levels' + path.sep)),
    'everything staged must land under levels/ so remote pack URLs resolve');
  assert.ok(files.every(f => /\.(webp|jpe?g|png)$/i.test(f)),
    'only image assets belong here');
});

test('remote-only assets are absent from public/, or they would be bundled', () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const remote = collectFiles(path.resolve(here, '../remote-levels'));
  const publicDir = path.resolve(here, '../public');
  const leaked = remote.filter(rel => fs.existsSync(path.join(publicDir, rel)));
  assert.deepEqual(leaked, [],
    'a remote-only asset still under public/ ships inside the native binary');
});
