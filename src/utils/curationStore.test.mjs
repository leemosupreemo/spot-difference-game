import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLevelCurationMeta,
  resetCuratedStatusMap,
  pruneDismissedStatuses,
  createCuratedDataset,
  serializeCuratedDataset
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
  }, 'photo_one', { packId: 'abstract_animated', pack: 'Fantastical' });

  assert.equal(updated.photo_one.status, 'approved');
  assert.equal(updated.photo_one.suggestedDifficulty, 'Hard');
  assert.equal(updated.photo_one.packId, 'abstract_animated');
  assert.equal(updated.photo_one.pack, 'Fantastical');
  assert.ok(updated.photo_one.updatedAt);
});
