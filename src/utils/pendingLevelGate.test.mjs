import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPendingEntry,
  isApprovedForProduction,
  isEntryPlayable,
  filterPendingEntries,
  describePendingFilter
} from './pendingLevelGate.js';

const pending = { id: 'star_v1', curationStatus: 'pending' };
const legacy = { id: 'old_level_v1' };
const approvedEntry = { id: 'star_v2', curationStatus: 'approved' };

test('only an explicit pending status is gated', () => {
  assert.equal(isPendingEntry(pending), true);
  assert.equal(isPendingEntry({ id: 'x', curationStatus: 'PENDING' }), true);
  assert.equal(isPendingEntry(legacy), false, 'a pre-gate level is not pending');
  assert.equal(isPendingEntry(approvedEntry), false);
  assert.equal(isPendingEntry(null), false);
});

test('a pending level is hidden in production until it is approved', () => {
  assert.equal(isEntryPlayable(pending, {}, false), false);
  assert.equal(isEntryPlayable(pending, { star_v1: 'approved' }, false), true);
});

test('a pending level is visible in debug so it can be reviewed', () => {
  assert.equal(isEntryPlayable(pending, {}, true), true);
});

test('levels without a curationStatus keep their existing behavior', () => {
  // The 157 entries that shipped before this gate have no status field and
  // must not start disappearing from production.
  assert.equal(isEntryPlayable(legacy, {}, false), true);
  assert.equal(isEntryPlayable(legacy, {}, true), true);
});

test('wrong_difficulty is a keep decision and promotes the level', () => {
  assert.equal(isEntryPlayable(pending, { star_v1: 'wrong_difficulty' }, false), true);
});

test('dismissed never promotes a pending level', () => {
  assert.equal(isEntryPlayable(pending, { star_v1: 'dismissed' }, false), false);
});

test('the gate fails closed on anything it does not recognize', () => {
  for (const statusMap of [
    null,
    undefined,
    {},
    { star_v1: null },
    { star_v1: 'unknown_status' },
    { star_v1: { status: 'maybe' } },
    { star_v1: { notAStatus: true } },
    { other_level: 'approved' }
  ]) {
    assert.equal(isEntryPlayable(pending, statusMap, false), false,
      `should stay hidden for ${JSON.stringify(statusMap)}`);
  }
});

test('a throwing status map cannot promote an unreviewed level', () => {
  const hostile = new Proxy({}, { get() { throw new Error('boom'); } });
  assert.equal(isApprovedForProduction(pending, hostile), false);
  assert.equal(isEntryPlayable(pending, hostile, false), false);
});

test('object-form statuses are read like the curation store reads them', () => {
  assert.equal(isEntryPlayable(pending, { star_v1: { status: 'approved' } }, false), true);
});

test('filterPendingEntries splits a mixed manifest correctly', () => {
  const entries = [legacy, pending, { id: 'star_v3', curationStatus: 'pending' }, approvedEntry];
  const statusMap = { star_v1: 'approved' };

  const production = filterPendingEntries(entries, statusMap, false);
  assert.deepEqual(production.map(e => e.id), ['old_level_v1', 'star_v1', 'star_v2'],
    'star_v3 is pending and unapproved, so production must not see it');

  const debug = filterPendingEntries(entries, statusMap, true);
  assert.equal(debug.length, 4, 'debug sees everything for review');
});

test('filterPendingEntries tolerates a missing manifest', () => {
  assert.deepEqual(filterPendingEntries(null, {}, false), []);
  assert.deepEqual(filterPendingEntries(undefined, {}, true), []);
});

test('describePendingFilter reports what was hidden', () => {
  const entries = [legacy, pending, { id: 'star_v3', curationStatus: 'pending' }];
  assert.deepEqual(describePendingFilter(entries, { star_v1: 'approved' }, false), {
    total: 3, pending: 2, pendingApproved: 1, pendingHidden: 1, debugMode: false
  });
  assert.deepEqual(describePendingFilter(entries, {}, true), {
    total: 3, pending: 2, pendingApproved: 0, pendingHidden: 0, debugMode: true
  });
});
