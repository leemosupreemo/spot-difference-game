import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLevelCurationMeta,
  resetCuratedStatusMap,
  pruneDismissedStatuses,
  createCuratedDataset,
  serializeCuratedDataset,
  normalizeImageKey,
  getEntryCurationStatus,
  getImageKeyForLevel,
  legacyImageKey
} from './curationStore.js';

test('resets all curation decisions to an empty map', () => {
  assert.deepEqual(resetCuratedStatusMap(), {});
});

test('prunes dismissed entries while retaining approvals and wrong-difficulty decisions', () => {
  const statuses = pruneDismissedStatuses({
    approved: { status: 'approved' },
    dismissed: { status: 'dismissed' },
    wrongDifficulty: { status: 'wrong_difficulty' }
  });

  assert.deepEqual(statuses, {
    approved: { status: 'approved' },
    wrongDifficulty: { status: 'wrong_difficulty' }
  });
});

const packs = [
  { id: 'photo_one', title: 'Photo One', category: 'Kitchen' },
  { id: 'photo_two', title: 'Photo Two', category: 'Market' },
  { id: 'photo_three', title: 'Photo Three', category: 'Forest' }
];

test('creates a curated export dataset from an explicit status map', () => {
  const dataset = createCuratedDataset({
    photo_one: { status: 'approved', updatedAt: '2026-08-10T12:00:00.000Z' },
    photo_two: { status: 'dismissed', updatedAt: '2026-08-10T12:05:00.000Z' },
    photo_three: { status: 'wrong_difficulty', updatedAt: '2026-08-10T12:10:00.000Z' }
  }, packs, '2026-08-10T12:15:00.000Z');

  assert.equal(dataset.exportedAt, '2026-08-10T12:15:00.000Z');
  assert.deepEqual(dataset.summary, {
    totalCurated: 3,
    approvedCount: 1,
    dismissedCount: 1,
    wrongDifficultyCount: 1
  });
  assert.deepEqual(dataset.approvedLevelIds, ['photo_one']);
  assert.equal(dataset.approvedLevels[0].title, 'Photo One');
});

test('serializes curated data as readable JSON that includes approved ids', () => {
  const dataset = createCuratedDataset({
    photo_one: 'approved'
  }, packs, '2026-08-10T12:15:00.000Z');

  const json = serializeCuratedDataset(dataset);
  assert.match(json, /"approvedLevelIds": \[\n    "photo_one"\n  \]/);
  assert.doesNotThrow(() => JSON.parse(json));
});

test('adds a category designation without replacing a curation decision', () => {
  const updated = applyLevelCurationMeta({
    photo_one: { status: 'approved', suggestedDifficulty: 'Hard' }
  }, 'photo_one', { packId: 'abstract_animated', pack: 'Abstract' });

  assert.equal(updated.photo_one.status, 'approved');
  assert.equal(updated.photo_one.suggestedDifficulty, 'Hard');
  assert.equal(updated.photo_one.packId, 'abstract_animated');
  assert.equal(updated.photo_one.pack, 'Abstract');
  assert.ok(updated.photo_one.updatedAt);
});

test('normalizes image paths to stable image keys', () => {
  // Keys now include the directory so same-named files in different folders
  // stay distinct; the _base/_variant suffix and URL noise still drop out.
  assert.equal(normalizeImageKey('levels/sample_scene_001_base.jpg'), 'levels/sample_scene_001');
  assert.equal(normalizeImageKey('/public/levels/sample_scene_001_variant.jpg?v=2'),
    'public/levels/sample_scene_001');
  // An absolute URL contributes its path, never its host.
  assert.equal(normalizeImageKey('https://example.com/images/scene_abc.PNG'), 'images/scene_abc');
  assert.equal(normalizeImageKey('https://cdn.other.com/images/scene_abc.png'), 'images/scene_abc',
    'the same asset served from two hosts is one level');
});

test('legacyImageKey reproduces the pre-path format for saved decisions', () => {
  assert.equal(legacyImageKey('levels/sample_scene_001_base.jpg'), 'sample_scene_001');
  assert.equal(legacyImageKey('/public/levels/sample_scene_001_variant.jpg?v=2'), 'sample_scene_001');
  assert.equal(legacyImageKey('https://example.com/images/scene_abc.PNG'), 'scene_abc');
});

test('a degenerate legacy key never resurrects the 33-level collision', () => {
  // These entries live in different folders but are all named base.jpg, so the
  // old format gave them the single key "base". A status stored under that key
  // must not resolve for any of them.
  const nursery = { id: 'photo_set_008_01', baseImage: 'levels/photo-pairs/nursery/x/base.jpg',
                    variantImage: 'levels/photo-pairs/nursery/x/variant.jpg' };
  const workbench = { id: 'photo_set_008_02', baseImage: 'levels/photo-pairs/workbench/y/base.jpg',
                      variantImage: 'levels/photo-pairs/workbench/y/variant.jpg' };
  const statusMap = { base: { status: 'approved' }, variant: { status: 'approved' } };
  assert.equal(getEntryCurationStatus(nursery, statusMap), null);
  assert.equal(getEntryCurationStatus(workbench, statusMap), null);
});

test('getEntryCurationStatus falls back to sibling entry sharing the same base image', () => {
  // Test entry with same image as another
  const entryA = { id: 'test_sibling_a', baseImage: 'levels/fresh_shared_scene_base.jpg' };
  const entryB = { id: 'test_sibling_b', baseImage: 'levels/fresh_shared_scene_base.jpg' };

  const statusMap = {
    test_sibling_a: { status: 'approved', packId: 'find_the_sniper' }
  };

  // Direct lookup on entryA
  const statusA = getEntryCurationStatus(entryA, statusMap);
  assert.equal(statusA?.status, 'approved');

  // Direct lookup on an entry without sibling indexing falls back to null
  const statusNonExistent = getEntryCurationStatus({ id: 'non_existent' }, statusMap);
  assert.equal(statusNonExistent, null);
});

test('getEntryCurationStatus resolves status saved under legacy ID matching base image key', () => {
  // photo_set_014_01 has baseImage 'levels/fresh_v7_marine_shells_002_base.jpg'
  const entry = { id: 'photo_set_014_01', baseImage: 'levels/fresh_v7_marine_shells_002_base.jpg' };
  const statusMap = {
    fresh_v7_marine_shells_002: { status: 'approved', packId: 'find_the_sniper' }
  };

  const status = getEntryCurationStatus(entry, statusMap);
  assert.ok(status);
  assert.equal(status.status, 'approved');
  assert.equal(status.packId, 'find_the_sniper');
});

test('getEntryCurationStatus resolves status saved under direct base image key', () => {
  const entry = { id: 'photo_set_014_02', baseImage: 'levels/fresh_v7_apothecary_herbs_003_base.jpg' };
  const statusMap = {
    fresh_v7_apothecary_herbs_003: { status: 'wrong_difficulty', packId: 'find_the_sniper' }
  };

  const status = getEntryCurationStatus(entry, statusMap);
  assert.ok(status);
  assert.equal(status.status, 'wrong_difficulty');
});


test('normalizeImageKey keeps the directory so same-named files stay distinct', () => {
  // Legacy pairs are all named base.jpg/variant.jpg inside a per-scene folder.
  const a = normalizeImageKey('levels/photo-pairs/nursery/medium_nursery_001/variant.jpg');
  const b = normalizeImageKey('levels/photo-pairs/workbench/medium_workbench_001/variant.jpg');
  assert.notEqual(a, b, 'levels in different folders must not share a curation key');
  assert.equal(a, 'levels/photo-pairs/nursery/medium_nursery_001/variant');
});

test('normalizeImageKey is stable across leading-slash and ./ spellings', () => {
  const canonical = normalizeImageKey('levels/a/variant.webp');
  assert.equal(normalizeImageKey('/levels/a/variant.webp'), canonical);
  assert.equal(normalizeImageKey('./levels/a/variant.webp'), canonical);
  assert.equal(normalizeImageKey('levels/a/variant.webp?v=2'), canonical);
});

test('variants sharing one deduplicated base image are not siblings', () => {
  // After base deduplication every variant of a photo points at the SAME base
  // file. Curation identity must come from the variant, which stays unique,
  // or approving one variant would promote its unreviewed siblings.
  const sharedBase = 'levels/66fb05cd97c9_base.webp';
  const v1 = { id: 'photo_v1', baseImage: sharedBase, variantImage: 'levels/photo_v1_aaa_variant.webp' };
  const v2 = { id: 'photo_v2', baseImage: sharedBase, variantImage: 'levels/photo_v2_bbb_variant.webp' };
  assert.notEqual(getImageKeyForLevel(v1), getImageKeyForLevel(v2),
    'two variants of one photo must have different curation keys');
});

test('a level with only a base image still resolves a key', () => {
  assert.equal(getImageKeyForLevel({ id: 'x', baseImage: 'levels/x_base.webp' }), 'levels/x');
});
