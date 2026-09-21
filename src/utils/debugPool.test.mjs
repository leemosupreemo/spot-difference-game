import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDebugPool, isKeptStatus, isCategorized } from './debugPool.js';

const e = (id, extra = {}) => ({ id, ...extra });
const from = (map) => (entry) => map[entry.id] || null;

test('levels never judged come strictly before judged ones', () => {
  const entries = [e('judged'), e('fresh'), e('also_judged'), e('also_fresh')];
  const pool = buildDebugPool({
    entries,
    resolveStatus: from({ judged: { status: 'approved' }, also_judged: { status: 'approved' } })
  });
  assert.deepEqual(pool.map(x => x.id), ['fresh', 'also_fresh', 'judged', 'also_judged']);
});

test('a placeholder is never offered for a decision', () => {
  // It has no status, so without this it sorts to the FRONT as unreviewed and
  // is the first thing a curator is asked to judge.
  const pool = buildDebugPool({
    entries: [e('ph', { isPlaceholder: true }), e('real')],
    isPlaceholder: (x) => x.isPlaceholder === true
  });
  assert.deepEqual(pool.map(x => x.id), ['real']);
});

test('dismissed levels are excluded from normal curation', () => {
  const pool = buildDebugPool({
    entries: [e('a'), e('gone')],
    resolveStatus: from({ gone: { status: 'dismissed' } })
  });
  assert.deepEqual(pool.map(x => x.id), ['a']);
});

test('review-dismissals mode shows dismissed levels and nothing else', () => {
  const pool = buildDebugPool({
    entries: [e('a'), e('gone'), e('kept'), e('ph', { isPlaceholder: true })],
    resolveStatus: from({ gone: { status: 'dismissed' }, kept: { status: 'approved' } }),
    dismissedOnly: true,
    isPlaceholder: (x) => x.isPlaceholder === true
  });
  assert.deepEqual(pool.map(x => x.id), ['gone']);
});

test('an empty dismissed pool stays empty rather than falling back', () => {
  // Nothing dismissed is the answer, not a reason to show the normal pool.
  const pool = buildDebugPool({ entries: [e('a'), e('b')], dismissedOnly: true });
  assert.deepEqual(pool, []);
});

test('skipKept drops levels the curator already kept', () => {
  const resolveStatus = from({
    ok: { status: 'approved' }, wrong: { status: 'wrong_difficulty' }, no: { status: 'dismissed' }
  });
  const entries = [e('ok'), e('wrong'), e('no'), e('fresh')];
  assert.deepEqual(buildDebugPool({ entries, resolveStatus, skipKept: true }).map(x => x.id), ['fresh']);
  assert.deepEqual(buildDebugPool({ entries, resolveStatus }).map(x => x.id),
    ['fresh', 'ok', 'wrong'], 'without the flag, kept levels stay available to revisit');
});

test('metadata without a decision still counts as looked at', () => {
  // A level given a pack or difficulty has been handled; treating it as fresh
  // would put it back at the front of the queue for ever.
  const pool = buildDebugPool({
    entries: [e('tagged'), e('fresh')],
    resolveStatus: from({ tagged: { packId: 'find_the_sniper' } })
  });
  assert.deepEqual(pool.map(x => x.id), ['fresh', 'tagged']);
});

test('the status helpers name what they judge', () => {
  assert.equal(isKeptStatus('approved'), true);
  assert.equal(isKeptStatus('wrong_difficulty'), true);
  assert.equal(isKeptStatus('dismissed'), false);
  assert.equal(isCategorized({ difficulty: 'Hard' }), true);
  assert.equal(isCategorized({}), false);
  assert.equal(isCategorized(null), false);
});

test('the caller decides how status resolves, not this', () => {
  // getEntryCurationStatus resolves siblings and legacy keys; a bare map lookup
  // would call a judged level fresh.
  const pool = buildDebugPool({
    entries: [e('via_sibling')],
    resolveStatus: () => ({ status: 'approved' })
  });
  assert.deepEqual(pool.map(x => x.id), ['via_sibling']);
});
