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
