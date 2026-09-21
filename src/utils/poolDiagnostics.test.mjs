import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPoolDiagnostics } from './poolDiagnostics.js';

const entry = (id, extra = {}) => ({ id, setId: 'set_a', ...extra });

test('counts the queue the way the curation screen sees it', () => {
  const d = buildPoolDiagnostics({
    entries: [entry('a'), entry('b'), entry('c'), entry('ph', { isPlaceholder: true })],
    statusMap: { a: 'approved', b: 'dismissed' },
    isPlaceholder: (e) => e.isPlaceholder === true
  });
  assert.equal(d.counts.entriesInPool, 4);
  assert.equal(d.counts.placeholders, 1);
  assert.equal(d.counts.dismissed, 1);
  assert.equal(d.counts.unreviewed, 1);
  assert.deepEqual(d.unreviewedIds, ['c']);
});

test('a level awaiting review is listed individually, decided or not', () => {
  const d = buildPoolDiagnostics({
    entries: [entry('p1', { curationStatus: 'pending' }), entry('p2', { curationStatus: 'pending' })],
    statusMap: { p1: 'dismissed' }
  });
  assert.deepEqual(d.pendingLevels, [
    { id: 'p1', setId: 'set_a', status: 'dismissed' },
    { id: 'p2', setId: 'set_a', status: null }
  ]);
});

test('a level absent from the queue is absent from the report', () => {
  // The point of the whole file: this answers what the DEVICE holds, so a
  // level missing from `entries` must not be invented from the status map.
  const d = buildPoolDiagnostics({ entries: [entry('a')], statusMap: { missing: 'approved' } });
  assert.equal(d.counts.entriesInPool, 1);
  assert.ok(!d.unreviewedIds.includes('missing'));
  assert.deepEqual(d.entriesPerSet, { set_a: 1 });
});

test('the resolver the app uses is honoured over a bare map lookup', () => {
  // getEntryCurationStatus resolves siblings and legacy keys; a plain lookup
  // would report a level unreviewed that the queue considers judged.
  const d = buildPoolDiagnostics({
    entries: [entry('a')],
    resolveStatus: () => ({ status: 'approved' })
  });
  assert.equal(d.counts.unreviewed, 0);
});

test('long queues are truncated but the remainder is reported', () => {
  const many = Array.from({ length: 40 }, (_, i) => entry('e' + i));
  const d = buildPoolDiagnostics({ entries: many, sampleSize: 10 });
  assert.equal(d.unreviewedIds.length, 10);
  assert.equal(d.unreviewedTruncated, 30);
});

test('the device flags ride along', () => {
  const d = buildPoolDiagnostics({ entries: [], online: false, debugMode: true, skipKeptLevels: true });
  assert.deepEqual(d.flags, { online: false, debugMode: true, skipKeptLevels: true, reviewDismissedLevels: false });
});
