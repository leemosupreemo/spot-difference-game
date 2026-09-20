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

test('a placeholder is valid precisely because it has no artwork', () => {
  const placeholder = {
    id: 'remote_set_006_placeholder_04', title: 'Coming soon', category: 'Photography',
    pack: 'Find the Sniper', packId: 'find_the_sniper', difficulty: 'Medium',
    setId: 'remote_set_006', sequence: 4, isPlaceholder: true, diffs: []
  };
  assert.equal(isValidPhotoPairEntry(placeholder), true);

  // Half-placeholders are rejected: an entry claiming to be a placeholder while
  // carrying artwork or a findable difference is malformed, not permissive.
  assert.equal(isValidPhotoPairEntry({ ...placeholder, baseImage: 'levels/a.webp' }), false);
  assert.equal(isValidPhotoPairEntry({ ...placeholder, variantImage: 'levels/b.webp' }), false);
  assert.equal(isValidPhotoPairEntry({ ...placeholder, diffs: [{ id: 1, x: 5, y: 5, radius: 4 }] }), false);
});

test('a normal entry still needs both images and exactly one difference', () => {
  const real = {
    id: 'x', title: 'X', category: 'Photography', pack: 'Find the Sniper',
    packId: 'find_the_sniper', difficulty: 'Medium',
    baseImage: 'levels/x_base.webp', variantImage: 'levels/x_variant.webp',
    diffs: [{ id: 1, x: 50, y: 50, radius: 5 }]
  };
  assert.equal(isValidPhotoPairEntry(real), true);
  assert.equal(isValidPhotoPairEntry({ ...real, baseImage: undefined }), false,
    'isPlaceholder must be explicit -- missing images alone is still invalid');
  assert.equal(isValidPhotoPairEntry({ ...real, diffs: [] }), false);
});
