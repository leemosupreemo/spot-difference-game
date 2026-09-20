import test from 'node:test';
import assert from 'node:assert/strict';
import { rebuildSets } from './rebuild_photo_sets.mjs';
import { baseKey } from './group_remote_sets.mjs';

const lvl = (id, base, extra = {}) => ({ id, baseImage: `levels/${base}_base.webp`, ...extra });

test('survivors are regrouped into complete fives', () => {
  const entries = Array.from({ length: 12 }, (_, i) => lvl(`l${i}`, `photo_${i}`));
  const { assigned, singles, setCount } = rebuildSets(entries);
  assert.equal(setCount, 2);
  assert.equal(assigned.length, 10);
  assert.equal(singles.length, 2);
  assert.deepEqual([...new Set(assigned.map(e => e.setId))], ['photo_set_001', 'photo_set_002']);
});

test('every set is sequenced 1-5 and repeats no photo', () => {
  // Two copies of one photo across two sets is separable: one each.
  const entries = [
    ...Array.from({ length: 2 }, (_, i) => lvl(`a${i}`, 'shared')),
    ...Array.from({ length: 8 }, (_, i) => lvl(`b${i}`, `other_${i}`))
  ];
  const { assigned } = rebuildSets(entries);
  for (let i = 0; i < assigned.length; i += 5) {
    const group = assigned.slice(i, i + 5);
    assert.deepEqual(group.map(e => e.sequence), [1, 2, 3, 4, 5]);
    assert.equal(new Set(group.map(baseKey)).size, 5, 'a set must not repeat a photograph');
  }
});

test('a partial remainder carries no set metadata', () => {
  // It could never be served as a set, so claiming membership would be a lie.
  const entries = Array.from({ length: 7 }, (_, i) => lvl(`l${i}`, `p${i}`));
  const { singles } = rebuildSets(entries);
  assert.equal(singles.length, 2);
  assert.ok(singles.every(e => !e.setId && !e.sequence));
});

test('stale set metadata on a leftover level is cleared', () => {
  const entries = Array.from({ length: 6 }, (_, i) =>
    lvl(`l${i}`, `p${i}`, { setId: 'photo_set_099', sequence: 3 }));
  const { singles } = rebuildSets(entries);
  assert.equal(singles.length, 1);
  assert.equal(singles[0].setId, undefined);
  assert.equal(singles[0].sequence, undefined);
});

test('daily-reserved levels are never pulled into a photo set', () => {
  const entries = [
    ...Array.from({ length: 5 }, (_, i) => lvl(`l${i}`, `p${i}`)),
    lvl('daily_set_01_01', 'd1'),
    { id: 'x', baseImage: 'levels/d2_base.webp', dailyOnly: true }
  ];
  const { assigned, singles, daily } = rebuildSets(entries);
  assert.equal(daily.length, 2);
  assert.equal(assigned.length, 5);
  assert.equal(singles.length, 0);
  assert.ok(!assigned.some(e => e.id.startsWith('daily_set_') || e.dailyOnly));
});

test('no level is lost or duplicated', () => {
  const entries = [
    ...Array.from({ length: 13 }, (_, i) => lvl(`l${i}`, `p${i % 4}`)),
    lvl('daily_set_01_01', 'd1')
  ];
  const { assigned, singles, daily } = rebuildSets(entries);
  const out = [...assigned, ...singles, ...daily].map(e => e.id).sort();
  assert.deepEqual(out, entries.map(e => e.id).sort());
});

test('fewer than five survivors produces no sets at all', () => {
  const { assigned, singles, setCount } = rebuildSets(
    Array.from({ length: 4 }, (_, i) => lvl(`l${i}`, `p${i}`)));
  assert.equal(setCount, 0);
  assert.equal(assigned.length, 0);
  assert.equal(singles.length, 4);
});

test('a photo with more copies than there are sets is still placed, not dropped', () => {
  // Three copies across two sets cannot avoid a repeat. Losing a level would be
  // worse than showing one twice, so allocation places them all.
  const entries = [
    ...Array.from({ length: 3 }, (_, i) => lvl(`a${i}`, 'shared')),
    ...Array.from({ length: 7 }, (_, i) => lvl(`b${i}`, `other_${i}`))
  ];
  const { assigned, singles } = rebuildSets(entries);
  assert.equal(assigned.length + singles.length, entries.length);
  assert.deepEqual([...assigned, ...singles].map(e => e.id).sort(), entries.map(e => e.id).sort());
});
