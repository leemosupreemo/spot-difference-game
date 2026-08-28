import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_PACKS } from './photoPacks.js';

test('PHOTO_PACKS contains a non-empty array of valid photo packs', () => {
  assert.ok(Array.isArray(PHOTO_PACKS));
  assert.ok(PHOTO_PACKS.length > 0);
});

test('each photo pack has valid schema, required fields, and unique id', () => {
  const ids = new Set();

  for (const pack of PHOTO_PACKS) {
    assert.ok(typeof pack.id === 'string' && pack.id.length > 0, `Invalid id in ${JSON.stringify(pack)}`);
    assert.ok(!ids.has(pack.id), `Duplicate pack id: ${pack.id}`);
    ids.add(pack.id);

    assert.ok(typeof pack.title === 'string' && pack.title.length > 0);
    assert.ok(typeof pack.url === 'string' && pack.url.startsWith('http'));
    assert.ok(pack.target && typeof pack.target === 'object');
    assert.ok(typeof pack.target.x === 'number' && pack.target.x >= 0 && pack.target.x <= 100);
    assert.ok(typeof pack.target.y === 'number' && pack.target.y >= 0 && pack.target.y <= 100);
    assert.ok(typeof pack.target.radius === 'number' && pack.target.radius > 0);
    assert.ok(['COLOR_SHIFT', 'REMOVE_OBJECT', 'ADD_DETAIL', 'ROTATE', 'ASSET_SWAP'].includes(pack.mutationType));
  }
});
