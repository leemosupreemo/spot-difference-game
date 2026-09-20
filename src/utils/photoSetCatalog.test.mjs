import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getCompletePhotoSets,
  getPhotoSetCatalog
} from './photoSetCatalog.js';

test('groups assigned entries and orders each set by sequence then id', () => {
  const alphaSecond = { id: 'alpha_second', setId: 'photo_set_001', sequence: 2 };
  const alphaFirstB = { id: 'alpha_first_b', setId: 'photo_set_001', sequence: 1 };
  const alphaFirstA = { id: 'alpha_first_a', setId: 'photo_set_001', sequence: 1 };
  const betaFirst = { id: 'beta_first', setId: 'photo_set_002', sequence: 1 };
  const missingSet = { id: 'missing_set', sequence: 1 };
  const invalidSequence = { id: 'invalid_sequence', setId: 'photo_set_003', sequence: 0 };

  const result = getPhotoSetCatalog([
    alphaSecond,
    betaFirst,
    missingSet,
    alphaFirstB,
    invalidSequence,
    alphaFirstA
  ]);

  assert.deepEqual(result.sets, [
    {
      setId: 'photo_set_001',
      entries: [alphaFirstA, alphaFirstB, alphaSecond]
    },
    {
      setId: 'photo_set_002',
      entries: [betaFirst]
    }
  ]);
  assert.deepEqual(result.unassigned, [missingSet, invalidSequence]);
});

test('returns only complete sets without mixing unassigned or incomplete entries', () => {
  const entries = [
    { id: 'complete_3', setId: 'photo_set_001', sequence: 3 },
    { id: 'complete_1', setId: 'photo_set_001', sequence: 1 },
    { id: 'complete_2', setId: 'photo_set_001', sequence: 2 },
    { id: 'incomplete_1', setId: 'photo_set_002', sequence: 1 },
    { id: 'unassigned_1' }
  ];

  assert.deepEqual(getCompletePhotoSets(entries, 3), [{
    setId: 'photo_set_001',
    entries: [entries[1], entries[2], entries[0]]
  }]);
});

test('keeps distinct variant entries addressable by their own IDs', () => {
  const firstVariant = { id: 'market_variant_a', setId: 'photo_set_001', sequence: 1 };
  const secondVariant = { id: 'market_variant_b', setId: 'photo_set_001', sequence: 2 };

  const { sets } = getPhotoSetCatalog([secondVariant, firstVariant], { setSize: 2 });

  assert.deepEqual(sets[0].entries.map(entry => entry.id), [
    'market_variant_a',
    'market_variant_b'
  ]);
  assert.notEqual(sets[0].entries[0].id, sets[0].entries[1].id);
});

test('retained manifest entries have stable five-entry set metadata', () => {
  const manifest = JSON.parse(fs.readFileSync(
    new URL('../../public/levels/photo_pair_manifest.json', import.meta.url),
    'utf8'
  ));

  assert.equal(new Set(manifest.map(entry => entry.id)).size, manifest.length,
    'every entry must have a unique id');

  // The 26 five-entry photo sets are what this guards. Individual levels move
  // between bundled and remote delivery as packs are published, so counting the
  // whole manifest churns; the sets themselves must never lose an entry or have
  // their sequencing disturbed.
  const catalog = getPhotoSetCatalog(manifest);
  assert.equal(catalog.sets.length, 26);
  assert.equal(getCompletePhotoSets(manifest).length, 26);
  assert.deepEqual(
    catalog.sets.map(set => set.setId).sort(),
    Array.from({ length: 26 }, (_, i) => `photo_set_${String(i + 1).padStart(3, '0')}`),
    'set ids must stay contiguous -- a gap means a set lost its entries'
  );

  for (const set of catalog.sets) {
    assert.equal(set.entries.length, 5, `${set.setId} must keep five entries`);
    assert.deepEqual(set.entries.map(entry => entry.sequence), [1, 2, 3, 4, 5],
      `${set.setId} must stay sequenced 1-5`);
    assert.ok(set.entries.every(entry => entry.setId === set.setId));
  }
  assert.equal(catalog.sets.reduce((n, set) => n + set.entries.length, 0), 130);

  // Everything else is a standalone level: manual ingests, approved fallback
  // levels, pending candidates. None may claim set membership, or it could be
  // pulled into a set and change what a player is served.
  for (const entry of catalog.unassigned) {
    assert.ok(!entry.setId && !entry.sequence,
      `${entry.id} is unassigned and must carry no set metadata`);
  }

  // A fallback level only reaches the manifest once reviewed, and always
  // carries the code describing how it was produced.
  const fallbackLevels = manifest.filter(entry =>
    String(entry.generationMethod || '').startsWith('local_'));
  assert.ok(fallbackLevels.every(entry =>
    entry.variantCode && entry.curationStatus === 'approved'),
    'a fallback level in the manifest must be reviewed and carry its variant code');
});
