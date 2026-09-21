import test from 'node:test';
import assert from 'node:assert/strict';
import { stampPhotoKey, stampAll } from './backfill_photo_keys.mjs';

test('an unstamped entry gets the key of its base photograph', () => {
  const { entry, stamped } = stampPhotoKey({ id: 'a', baseImage: 'levels/abc_base.jpg', variantImage: 'levels/a_variant.jpg' });
  assert.equal(stamped, true);
  assert.equal(entry.photoKey, 'levels/abc');
});

test('an existing key is never overwritten', () => {
  const original = { id: 'a', photoKey: 'levels/kept', baseImage: 'levels/other_base.jpg' };
  const { entry, stamped } = stampPhotoKey(original);
  assert.equal(stamped, false);
  assert.equal(entry.photoKey, 'levels/kept');
});

test('running twice changes nothing the second time', () => {
  const entries = [{ id: 'a', baseImage: 'levels/abc_base.jpg' }, { id: 'b', baseImage: 'levels/def_base.jpg' }];
  const once = stampAll(entries);
  assert.equal(once.stamped, 2);
  const twice = stampAll(once.entries);
  assert.equal(twice.stamped, 0);
  assert.deepEqual(twice.entries, once.entries);
});

test('a placeholder is left alone', () => {
  const placeholder = { id: 'remote_set_001_placeholder_05', isPlaceholder: true };
  const { entry, stamped } = stampPhotoKey(placeholder);
  assert.equal(stamped, false);
  assert.equal(entry.photoKey, undefined);
});

test('two variants of one photograph receive the same key', () => {
  const { entries } = stampAll([
    { id: 'v1', baseImage: 'levels/shared_base.webp', variantImage: 'levels/v1_variant.webp' },
    { id: 'v2', baseImage: 'levels/shared_base.webp', variantImage: 'levels/v2_variant.webp' }
  ]);
  assert.equal(entries[0].photoKey, entries[1].photoKey);
});
