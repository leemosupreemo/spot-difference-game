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

  assert.equal(manifest.length, 175);
  assert.equal(new Set(manifest.map(entry => entry.id)).size, manifest.length);
  assert.deepEqual(
    manifest.slice(0, 6).map(({ id, setId, sequence }) => ({ id, setId, sequence })),
    [
      { id: 'fresh_v7_marine_shells_002', setId: 'photo_set_001', sequence: 1 },
      { id: 'fresh_v7_apothecary_herbs_003', setId: 'photo_set_001', sequence: 2 },
      { id: 'fresh_v7_cobbler_leather_007', setId: 'photo_set_001', sequence: 3 },
      { id: 'fresh_v7_pottery_tools_011', setId: 'photo_set_001', sequence: 4 },
      { id: 'fresh_v7_bonsai_tools_012', setId: 'photo_set_001', sequence: 5 },
      { id: 'fresh_v7_tabletop_rpg_004', setId: 'photo_set_002', sequence: 1 }
    ]
  );

  const catalog = getPhotoSetCatalog(manifest);
  assert.equal(catalog.unassigned.length, 0);
  assert.equal(catalog.sets.length, 35);
  assert.equal(getCompletePhotoSets(manifest).length, 35);
});
