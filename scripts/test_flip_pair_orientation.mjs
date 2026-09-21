import test from 'node:test';
import assert from 'node:assert/strict';
import { flipEntry, flipEligibility, flipsPerPhoto, selectFlips, selectUnflips, unflipEligibility } from './flip_pair_orientation.mjs';

const addEntry = (id, base, variant) => ({
  id,
  photoKey: `levels/${base}`.replace(/_base\.\w+$/, ''),
  baseImage: `levels/${base}`,
  variantImage: `levels/${variant}`,
  operation: 'add',
  variantCode: 'STR-ADD',
  diffs: [{
    id: 1, x: 4.3, y: 57.8, radius: 4.9,
    description: 'Single add difference',
    hint: 'Look closely for a add difference',
    operation: 'add'
  }]
});

test('flipping swaps the two images and renames the operation', () => {
  const flipped = flipEntry(addEntry('a', 'p_base.jpg', 'a_variant.jpg'));
  assert.equal(flipped.baseImage, 'levels/a_variant.jpg');
  assert.equal(flipped.variantImage, 'levels/p_base.jpg');
  assert.equal(flipped.operation, 'remove');
  assert.equal(flipped.diffs[0].operation, 'remove');
  assert.equal(flipped.diffs[0].description, 'Single remove difference');
  assert.equal(flipped.diffs[0].hint, 'Look closely for a remove difference');
  // variantCode is derived from operation and must not contradict it.
  assert.equal(flipped.variantCode, 'STR-REM');
});

test('the difference does not move', () => {
  const original = addEntry('a', 'p_base.jpg', 'a_variant.jpg');
  const flipped = flipEntry(original);
  for (const key of ['x', 'y', 'radius', 'id']) {
    assert.equal(flipped.diffs[0][key], original.diffs[0][key], `${key} should be untouched`);
  }
});

test('flipping twice returns the original', () => {
  const original = addEntry('a', 'p_base.jpg', 'a_variant.jpg');
  assert.deepEqual(flipEntry(flipEntry(original)), original);
});

test('a coordinate hint is left alone', () => {
  const entry = addEntry('a', 'p_base.jpg', 'a_variant.jpg');
  entry.diffs[0].hint = 'Look closely near coordinates (4%, 58%)';
  assert.equal(flipEntry(entry).diffs[0].hint, 'Look closely near coordinates (4%, 58%)');
});

test('a photograph is flipped at most once, across siblings', () => {
  // Two variants of one photograph. Flipping both would leave them serving the
  // same shared base as their variant, repeating the right-hand panel.
  const entries = [
    addEntry('twin_1', 'shared_base.jpg', 'twin_1_variant.jpg'),
    addEntry('twin_2', 'shared_base.jpg', 'twin_2_variant.jpg'),
    addEntry('solo', 'solo_base.jpg', 'solo_variant.jpg')
  ];
  // A sibling may now be flipped -- unlike the base-filename rule it replaced.
  assert.deepEqual(selectFlips(entries), ['twin_1', 'solo']);

  // Once one is flipped, its sibling is refused.
  const afterFlip = [flipEntry(entries[0]), entries[1], entries[2]];
  const tally = flipsPerPhoto(afterFlip);
  assert.equal(flipEligibility(entries[1], tally).ok, false);
  assert.match(flipEligibility(entries[1], tally).reason, /already flipped/);
});

test('a flipped level keeps its photograph identity', () => {
  const entry = addEntry('v1', 'shared_base.jpg', 'v1_variant.jpg');
  const flipped = flipEntry(entry);
  assert.equal(flipped.photoKey, entry.photoKey, 'photoKey must survive the flip');
  assert.equal(flipped.flipped, true);
  // And the marker is removed again on the way back, not left as false.
  assert.equal('flipped' in flipEntry(flipped), false);
});

test('an already-flipped level is not flipped again', () => {
  const flipped = flipEntry(addEntry('v1', 'shared_base.jpg', 'v1_variant.jpg'));
  assert.equal(flipEligibility(flipped, new Map()).ok, false);
});

test('a level with no photoKey is refused rather than guessed at', () => {
  const entry = addEntry('v1', 'shared_base.jpg', 'v1_variant.jpg');
  delete entry.photoKey;
  entry.baseImage = '';
  entry.variantImage = '';
  assert.equal(flipEligibility(entry, new Map()).ok, false);
});

test('only add and remove have a mirror', () => {
  const sizes = new Map();
  for (const op of ['recolor', 'reorder', 'duplicate']) {
    const entry = { ...addEntry('x', 'b.jpg', 'v.jpg'), operation: op, diffs: [{ operation: op }] };
    assert.equal(flipEligibility(entry, sizes).ok, false, `${op} must not be flippable`);
  }
  assert.throws(() => flipEntry({ id: 'x', operation: 'recolor' }), /Cannot flip/);
});

test('a placeholder is never flipped', () => {
  const placeholder = { id: 'remote_set_001_placeholder_05', isPlaceholder: true };
  assert.equal(flipEligibility(placeholder, new Map()).ok, false);
});

test('--limit takes the first eligible levels and no more', () => {
  const entries = [1, 2, 3, 4].map(n => addEntry(`e${n}`, `b${n}.jpg`, `v${n}.jpg`));
  assert.deepEqual(selectFlips(entries, { limit: 2 }), ['e1', 'e2']);
});

test('selection only takes the operation asked for', () => {
  // flipEligibility is symmetric so a flip can be undone, but selecting
  // symmetrically would turn genuine removes into adds -- the opposite of the
  // intent when asking for more removes.
  const entries = [
    { ...addEntry('an_add', 'a_base.jpg', 'a_variant.jpg') },
    { ...addEntry('a_remove', 'b_base.jpg', 'b_variant.jpg'), operation: 'remove',
      diffs: [{ operation: 'remove', description: 'Single remove difference' }] }
  ];
  assert.deepEqual(selectFlips(entries), ['an_add']);
  assert.deepEqual(selectFlips(entries, { from: 'remove' }), ['a_remove']);
});

test('restoring picks only levels that are currently flipped', () => {
  const plain = addEntry('plain', 'a_base.jpg', 'a_variant.jpg');
  const already = flipEntry(addEntry('already', 'b_base.jpg', 'b_variant.jpg'));
  assert.deepEqual(selectUnflips([plain, already]), ['already']);
  assert.equal(unflipEligibility(plain).ok, false);
  assert.equal(unflipEligibility(already).ok, true);
});

test('restoring returns the entry to exactly its original form', () => {
  const original = addEntry('a', 'a_base.jpg', 'a_variant.jpg');
  assert.deepEqual(flipEntry(flipEntry(original)), original);
});

test('the one-flip-per-photo tally counts levels outside the chosen pool', () => {
  // A photograph with one variant bundled and one remote. Flipping is narrowed
  // to the remote side, but the bundled sibling is already flipped -- so the
  // remote one must still be refused.
  const bundledSibling = flipEntry(addEntry('bundled_v1', 'shared_base.jpg', 'v1_variant.jpg'));
  const remoteSibling = addEntry('remote_v2', 'shared_base.jpg', 'v2_variant.jpg');
  const published = [bundledSibling, remoteSibling];
  assert.deepEqual(
    selectFlips([remoteSibling], { published }),
    [],
    'a flip already published elsewhere must still block its sibling'
  );
  // Without the full picture it would wrongly be allowed.
  assert.deepEqual(selectFlips([remoteSibling]), ['remote_v2']);
});
