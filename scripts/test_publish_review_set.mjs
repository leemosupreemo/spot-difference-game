import test from 'node:test';
import assert from 'node:assert/strict';
import { nextSetId, buildReviewSets } from './publish_review_set.mjs';
import { isPlaceholderEntry } from '../src/utils/remoteSetPolicy.js';

const HOST = 'https://example.web.app/';
const candidate = (id) => ({
  id, operation: 'duplicate', variantCode: 'LST-DUP',
  baseImage: 'levels/abc_base.webp', variantImage: `levels/${id}_variant.webp`,
  diffs: [{ id: 1, x: 10, y: 10, radius: 5 }]
});

test('takes the next free set id rather than reusing one', () => {
  assert.equal(nextSetId(['remote_set_001', 'remote_set_002']), 'remote_set_003');
  assert.equal(nextSetId([]), 'remote_set_001');
  // A gap is filled, because an unused id is genuinely free.
  assert.equal(nextSetId(['remote_set_001', 'remote_set_003']), 'remote_set_002');
  assert.equal(nextSetId([undefined, null, 'remote_set_001']), 'remote_set_002');
});

test('candidates go out as pending so the gate keeps them out of regular play', () => {
  const [set] = buildReviewSets([candidate('a'), candidate('b')], 7, HOST);
  const levels = set.levels;
  const real = levels.filter(l => !isPlaceholderEntry(l));
  assert.equal(real.length, 2);
  assert.ok(real.every(l => l.curationStatus === 'pending'));
  assert.ok(real.every(l => l.setId === 'remote_set_007'));
  assert.deepEqual(real.map(l => l.sequence), [1, 2]);
});

test('the set is padded to five so it can actually be started', () => {
  const [{ levels }] = buildReviewSets([candidate('a')], 7, HOST);
  assert.equal(levels.length, 5);
  assert.equal(levels.filter(isPlaceholderEntry).length, 4);
  assert.deepEqual(levels.map(l => l.sequence), [1, 2, 3, 4, 5]);
});

test('image paths become absolute, since remote packs are not bundled', () => {
  const [{ levels: [level] }] = buildReviewSets([candidate('a')], 7, HOST);
  assert.equal(level.baseImage, 'https://example.web.app/levels/abc_base.webp');
  assert.equal(level.variantImage, 'https://example.web.app/levels/a_variant.webp');
});

test('a host with no trailing slash still yields one separator', () => {
  const [{ levels: [level] }] = buildReviewSets([candidate('a')], 7, 'https://example.web.app');
  assert.equal(level.baseImage, 'https://example.web.app/levels/abc_base.webp');
});

test('a batch larger than one set spills into further sets', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => candidate(`c${i}`));
  const sets = buildReviewSets(twelve, 7, HOST);
  assert.equal(sets.length, 3);
  assert.deepEqual(sets.map(s => s.setId),
    ['remote_set_007', 'remote_set_008', 'remote_set_009']);
  assert.equal(sets.flatMap(s => s.levels).filter(l => !isPlaceholderEntry(l)).length, 12);
});

test('variants of one photograph are spread, never stacked in a set', () => {
  // A batch is usually several variants of a few photos; chunking in order
  // would put one picture five times in a single set.
  // Three variants of each of two photos, across three sets: one slot each.
  const entries = [
    ...Array.from({ length: 3 }, (_, i) => ({ ...candidate(`a${i}`), baseImage: 'levels/one_base.webp' })),
    ...Array.from({ length: 3 }, (_, i) => ({ ...candidate(`b${i}`), baseImage: 'levels/two_base.webp' })),
    ...Array.from({ length: 9 }, (_, i) => ({ ...candidate(`c${i}`), baseImage: `levels/x${i}_base.webp` }))
  ];
  const sets = buildReviewSets(entries, 1, HOST);
  assert.equal(sets.length, 3);
  assert.ok(sets.every(s => s.repeats === 0), 'no review set may show one photo twice');
});

test('an id that already exists is caught, not silently dropped later', async () => {
  const { findIdCollisions } = await import('./publish_review_set.mjs');
  const batch = [candidate('spilled_toy_box_v1'), candidate('brand_new')];
  assert.deepEqual(findIdCollisions(batch, ['spilled_toy_box_v1', 'other']), ['spilled_toy_box_v1']);
  assert.deepEqual(findIdCollisions(batch, ['unrelated']), []);
});

test('a batch repeating an id within itself is refused', () => {
  assert.throws(() => buildReviewSets([candidate('a'), candidate('a')], 7, HOST),
    /repeated level ids/);
});
