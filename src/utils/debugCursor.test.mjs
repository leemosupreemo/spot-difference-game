import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseDebugStartId } from './debugCursor.js';

// The pool is ordered the way getDebugCandidateEntries returns it: the entries
// still needing a decision first, then everything already judged.
const pool = [
  { id: 'new_a' }, { id: 'new_b' },
  { id: 'done_a' }, { id: 'done_b' }, { id: 'done_c' }
];
const judged = new Set(['done_a', 'done_b', 'done_c']);
const isCategorized = (entry) => judged.has(entry.id);

test('a level still awaiting a decision keeps its place', () => {
  assert.equal(chooseDebugStartId(pool, 'new_b', isCategorized), 'new_b');
});

test('resuming on a judged level jumps to the first unjudged one', () => {
  // The regression: done_c sits behind new_a and new_b, and "next pair" only
  // walks forward, so resuming here stranded both of them permanently.
  assert.equal(chooseDebugStartId(pool, 'done_c', isCategorized), 'new_a');
  assert.equal(chooseDebugStartId(pool, 'done_a', isCategorized), 'new_a');
});

test('a level that has left the pool falls to the first unjudged one', () => {
  assert.equal(chooseDebugStartId(pool, 'pruned_level', isCategorized), 'new_a');
  assert.equal(chooseDebugStartId(pool, null, isCategorized), 'new_a');
});

test('with nothing left to judge, a curator keeps their position', () => {
  const allJudged = [{ id: 'done_a' }, { id: 'done_b' }];
  assert.equal(chooseDebugStartId(allJudged, 'done_b', isCategorized), 'done_b');
  // Only when the current level is gone does it fall back to the front.
  assert.equal(chooseDebugStartId(allJudged, 'gone', isCategorized), 'done_a');
});

test('an empty pool yields no level rather than throwing', () => {
  assert.equal(chooseDebugStartId([], 'new_a', isCategorized), null);
  assert.equal(chooseDebugStartId(undefined, 'new_a', isCategorized), null);
});
