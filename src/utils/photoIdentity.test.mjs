import test from 'node:test';
import assert from 'node:assert/strict';
import { imagePathKey, photoKeyOf, derivePhotoKey, isFlipped, groupByPhoto } from './photoIdentity.js';

test('a key keeps the directory, drops the role and extension', () => {
  assert.equal(imagePathKey('levels/0449cfdb7b28_base.jpg'), 'levels/0449cfdb7b28');
  assert.equal(imagePathKey('levels/0449cfdb7b28_variant.webp'), 'levels/0449cfdb7b28');
  // A host contributes nothing: the same photo served remotely is the same photo.
  assert.equal(
    imagePathKey('https://diff-hunter.web.app/levels/cfdec592b3ce_base.webp?v=2'),
    'levels/cfdec592b3ce'
  );
});

test('legacy per-scene folders stay distinct but pair up', () => {
  // Every legacy pair is named base.jpg / variant.jpg. A filename-only key
  // would collapse all of them onto "base" and call them one photograph.
  const a = imagePathKey('levels/photo-pairs/ai-bakery-counter/base.jpg');
  const b = imagePathKey('levels/photo-pairs/ai-artist-easel/base.jpg');
  assert.equal(a, 'levels/photo-pairs/ai-bakery-counter');
  assert.notEqual(a, b);
  // ...and the two halves of one legacy pair must be the same photograph.
  assert.equal(imagePathKey('levels/photo-pairs/ai-bakery-counter/variant.jpg'), a);
});

test('a stamped key wins over whatever is in the image slots', () => {
  const entry = {
    photoKey: 'levels/original',
    baseImage: 'levels/something_else_variant.jpg',
    variantImage: 'levels/original_base.jpg',
    flipped: true
  };
  assert.equal(photoKeyOf(entry), 'levels/original');
});

test('an unstamped entry falls back to the slot holding the photograph', () => {
  assert.equal(photoKeyOf({ baseImage: 'levels/abc_base.jpg' }), 'levels/abc');
  // Flipped moved the photograph into the variant slot.
  assert.equal(
    photoKeyOf({ baseImage: 'levels/v_variant.jpg', variantImage: 'levels/abc_base.jpg', flipped: true }),
    'levels/abc'
  );
});

test('a flipped level still groups with its unflipped siblings', () => {
  // This is the whole point: the flipped one no longer has the shared base in
  // its base slot, and must still be recognised as the same photograph.
  const shared = 'levels/photo7';
  const entries = [
    { id: 'a', photoKey: shared, baseImage: 'levels/photo7_base.jpg', variantImage: 'levels/a_variant.jpg' },
    { id: 'b', photoKey: shared, baseImage: 'levels/b_variant.jpg', variantImage: 'levels/photo7_base.jpg', flipped: true },
    { id: 'c', photoKey: 'levels/other', baseImage: 'levels/other_base.jpg', variantImage: 'levels/c_variant.jpg' }
  ];
  const groups = groupByPhoto(entries);
  assert.deepEqual(groups.get(shared).map(e => e.id), ['a', 'b']);
  assert.equal(groups.size, 2);
});

test('derivePhotoKey reads the slot that currently holds the photograph', () => {
  assert.equal(derivePhotoKey({ baseImage: 'levels/x_base.jpg' }), 'levels/x');
  assert.equal(
    derivePhotoKey({ baseImage: 'levels/y_variant.jpg', variantImage: 'levels/x_base.jpg', flipped: true }),
    'levels/x'
  );
});

test('isFlipped is explicit, never guessed', () => {
  assert.equal(isFlipped({ flipped: true }), true);
  assert.equal(isFlipped({ operation: 'remove' }), false);
  assert.equal(isFlipped(undefined), false);
});
