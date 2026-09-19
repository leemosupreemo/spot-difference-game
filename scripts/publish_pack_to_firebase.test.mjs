import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPackDocument } from './publish_pack_to_firebase.mjs';

function validEntry(overrides = {}) {
  return {
    id: 'sample_scene_1',
    title: 'Sample Scene',
    category: 'Photography',
    pack: 'Find the Sniper',
    packId: 'find_the_sniper',
    difficulty: 'Medium',
    baseImage: 'https://diffhunter.web.app/levels/sample_scene_1_abc123_base.jpg',
    variantImage: 'https://diffhunter.web.app/levels/sample_scene_1_def456_variant.jpg',
    operation: 'add',
    diffs: [{ id: 1, x: 50, y: 50, radius: 5, description: 'Single add difference', hint: 'Look closely', operation: 'add' }],
    dimensions: { width: 1200, height: 900 },
    aspectRatio: '4:3',
    ...overrides
  };
}

test('buildPackDocument accepts a valid entry and shapes the document', () => {
  const doc = buildPackDocument({ packId: 'test_pack', title: 'Test Pack', levels: [validEntry()] });

  assert.equal(doc.packId, 'test_pack');
  assert.equal(doc.title, 'Test Pack');
  assert.equal(doc.active, true);
  assert.equal(doc.levelCount, 1);
  assert.equal(doc.levels.length, 1);
  assert.equal(doc.levels[0].id, 'sample_scene_1');
  assert.ok(typeof doc.publishedAt === 'string');
});

test('buildPackDocument rejects an empty levels array', () => {
  assert.throws(() => buildPackDocument({ packId: 'p', title: 't', levels: [] }), /non-empty array/);
});

test('buildPackDocument rejects a non-array levels value', () => {
  assert.throws(() => buildPackDocument({ packId: 'p', title: 't', levels: null }), /non-empty array/);
});

test('buildPackDocument rejects a relative baseImage path with the offending id named', () => {
  const entry = validEntry({ baseImage: 'levels/sample_scene_1_abc123_base.jpg' });
  assert.throws(
    () => buildPackDocument({ packId: 'p', title: 't', levels: [entry] }),
    /relative baseImage\/variantImage path.*sample_scene_1/s
  );
});

test('buildPackDocument rejects a relative variantImage even when baseImage is absolute', () => {
  // A relative "levels/..." path is a normally-valid asset path (it's how
  // bundled entries work), so only the explicit absolute-URL guard here --
  // not the generic manifest-schema validator -- would catch this case.
  const entry = validEntry({ variantImage: 'levels/sample_scene_1_def456_variant.jpg' });
  assert.throws(
    () => buildPackDocument({ packId: 'p', title: 't', levels: [entry] }),
    /relative baseImage\/variantImage path.*sample_scene_1/s
  );
});

test('buildPackDocument rejects a manifest-schema violation (missing diffs) with the validator error', () => {
  const entry = validEntry({ diffs: [] });
  assert.throws(() => buildPackDocument({ packId: 'p', title: 't', levels: [entry] }), /invalid manifest entries/);
});

test('buildPackDocument rejects an invalid difficulty value', () => {
  const entry = validEntry({ difficulty: 'Impossible' });
  assert.throws(() => buildPackDocument({ packId: 'p', title: 't', levels: [entry] }), /invalid manifest entries/);
});

test('buildPackDocument accepts multiple valid entries and preserves order', () => {
  const first = validEntry({ id: 'scene_a' });
  const second = validEntry({
    id: 'scene_b',
    baseImage: 'https://diffhunter.web.app/levels/scene_b_base.jpg',
    variantImage: 'https://diffhunter.web.app/levels/scene_b_variant.jpg'
  });
  const doc = buildPackDocument({ packId: 'p', title: 't', levels: [first, second] });

  assert.equal(doc.levelCount, 2);
  assert.deepEqual(doc.levels.map(l => l.id), ['scene_a', 'scene_b']);
});
