import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRemoteSets } from './group_remote_sets.mjs';
import { isPlaceholderEntry } from '../src/utils/remoteSetPolicy.js';

const levels = (n) => Array.from({ length: n }, (_, i) => ({ id: `lvl_${i + 1}` }));

test('splits into fives and numbers sets from 001', () => {
  const sets = buildRemoteSets(levels(10));
  assert.deepEqual(sets.map(s => s.setId), ['remote_set_001', 'remote_set_002']);
  assert.ok(sets.every(s => s.levels.length === 5));
  assert.ok(sets.every(s => s.levels.every(l => !isPlaceholderEntry(l))));
});

test('every level carries its set id and a 1-5 sequence', () => {
  const [set] = buildRemoteSets(levels(5));
  assert.deepEqual(set.levels.map(l => l.sequence), [1, 2, 3, 4, 5]);
  assert.ok(set.levels.every(l => l.setId === 'remote_set_001'));
});

test('a short final set is padded so it is still a complete five', () => {
  const sets = buildRemoteSets(levels(28));
  assert.equal(sets.length, 6);
  const last = sets[5];
  assert.equal(last.realCount, 3);
  assert.equal(last.levels.length, 5);
  assert.deepEqual(last.levels.map(isPlaceholderEntry), [false, false, false, true, true]);
  assert.deepEqual(last.levels.map(l => l.sequence), [1, 2, 3, 4, 5]);
  assert.ok(last.levels.every(l => l.setId === 'remote_set_006'));
});

test('padding never touches a full set', () => {
  const sets = buildRemoteSets(levels(25));
  assert.equal(sets.length, 5);
  assert.ok(sets.flatMap(s => s.levels).every(l => !isPlaceholderEntry(l)));
});

test('a single level still yields one complete padded set', () => {
  const [set] = buildRemoteSets(levels(1));
  assert.equal(set.levels.length, 5);
  assert.equal(set.realCount, 1);
  assert.equal(set.levels.filter(isPlaceholderEntry).length, 4);
});

test('no approved levels means no sets at all', () => {
  assert.deepEqual(buildRemoteSets([]), []);
});

test('level ids stay unique across the whole grouping', () => {
  const all = buildRemoteSets(levels(28)).flatMap(s => s.levels);
  assert.equal(new Set(all.map(l => l.id)).size, all.length);
});

test('the original entries are not mutated', () => {
  const source = levels(3);
  buildRemoteSets(source);
  assert.ok(source.every(l => !('setId' in l) && !('sequence' in l)));
});
