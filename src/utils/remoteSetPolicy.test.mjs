import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRemoteSetId, isRemoteEntry, isPlaceholderEntry, createPlaceholderEntry,
  toPlaceholder, selectableEntries, selectableSetIds, countsAsAttempt,
  REMOTE_SET_PREFIX
} from './remoteSetPolicy.js';

const bundled = { id: 'a', setId: 'photo_set_001', sequence: 1 };
const remote  = { id: 'b', setId: 'remote_set_001', sequence: 1 };

test('the namespace alone says whether a set needs a connection', () => {
  assert.equal(isRemoteSetId('remote_set_001'), true);
  assert.equal(isRemoteSetId('photo_set_026'), false);
  assert.equal(isRemoteSetId(undefined), false);
  assert.equal(isRemoteEntry(remote), true);
  assert.equal(isRemoteEntry(bundled), false);
  assert.equal(isRemoteEntry({ id: 'loose' }), false, 'a level in no set is not remote');
});

test('offline withholds online-only sets and keeps bundled ones', () => {
  const entries = [bundled, remote];
  assert.deepEqual(selectableEntries(entries, { online: true }).map(e => e.id), ['a', 'b']);
  assert.deepEqual(selectableEntries(entries, { online: false }).map(e => e.id), ['a']);
  assert.deepEqual(selectableSetIds(['photo_set_001', 'remote_set_001'], { online: false }),
    ['photo_set_001']);
});

test('a placeholder keeps its set complete but requests nothing', () => {
  const slot = createPlaceholderEntry({ setId: 'remote_set_006', sequence: 4 });
  assert.equal(slot.setId, 'remote_set_006');
  assert.equal(slot.sequence, 4);
  assert.equal(isPlaceholderEntry(slot), true);
  assert.equal(slot.baseImage, undefined, 'nothing to fetch');
  assert.equal(slot.variantImage, undefined);
  assert.deepEqual(slot.diffs, [], 'nothing to find');
  assert.ok(slot.placeholderMessage.length > 0);
  assert.match(slot.id, /^remote_set_006_placeholder_04$/);
});

test('placeholder ids are unique within a set', () => {
  const ids = [1, 2, 3, 4, 5].map(n => createPlaceholderEntry({ setId: 'remote_set_006', sequence: n }).id);
  assert.equal(new Set(ids).size, 5);
});

test('a placeholder needs a real slot to fill', () => {
  assert.throws(() => createPlaceholderEntry({ sequence: 1 }));
  assert.throws(() => createPlaceholderEntry({ setId: 'remote_set_006', sequence: 0 }));
  assert.throws(() => createPlaceholderEntry({ setId: 'remote_set_006', sequence: 1.5 }));
});

test('a level whose artwork fails degrades into an explanation', () => {
  const broken = toPlaceholder(
    { id: 'x', setId: 'remote_set_001', sequence: 2, baseImage: 'https://h/a.webp',
      variantImage: 'https://h/b.webp', diffs: [{ id: 1, x: 5, y: 5, radius: 4 }] },
    'load-failed'
  );
  assert.equal(isPlaceholderEntry(broken), true);
  assert.equal(broken.placeholderReason, 'load-failed');
  assert.equal(broken.baseImage, undefined, 'must not retry a URL that just failed');
  assert.deepEqual(broken.diffs, [], 'no findable difference without artwork');
  assert.equal(broken.setId, 'remote_set_001', 'set position is preserved');
  assert.equal(broken.sequence, 2);
});

test('a run containing a placeholder is not a real attempt', () => {
  const real = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }];
  assert.equal(countsAsAttempt(real), true);

  const withSlot = [...real.slice(0, 4), createPlaceholderEntry({ setId: 'remote_set_006', sequence: 5 })];
  assert.equal(countsAsAttempt(withSlot), false);

  const withBroken = [...real.slice(0, 4), toPlaceholder(real[4])];
  assert.equal(countsAsAttempt(withBroken), false,
    'artwork that failed mid-stage must not burn the first attempt either');
});

test('an empty or missing stage is never a countable attempt', () => {
  assert.equal(countsAsAttempt([]), false);
  assert.equal(countsAsAttempt(null), false);
});

test('the prefix is the single source of truth', () => {
  assert.equal(isRemoteSetId(`${REMOTE_SET_PREFIX}042`), true);
});
