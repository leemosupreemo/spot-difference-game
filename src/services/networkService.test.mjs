import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOnline,
  _setMockOnlineStateForTesting,
  subscribeNetworkStatus,
  getPendingSubmissions,
  queuePendingSubmission,
  clearPendingSubmissions,
  syncPendingSubmissions,
  STORAGE_KEY_PENDING_QUEUE
} from './networkService.js';

test('isOnline returns boolean and responds to mock state overrides', () => {
  assert.equal(typeof isOnline(), 'boolean');

  _setMockOnlineStateForTesting(false);
  assert.equal(isOnline(), false);

  _setMockOnlineStateForTesting(true);
  assert.equal(isOnline(), true);

  _setMockOnlineStateForTesting(null);
});

test('queuePendingSubmission deduplicates and retains best score', () => {
  clearPendingSubmissions();

  const sub1 = {
    boardType: 'photoSet',
    boardId: 'set_1',
    score: 12000,
    metric: 'elapsedMs',
    displayName: 'Hunter_A',
    playerId: 'p1'
  };

  queuePendingSubmission(sub1);
  let queue = getPendingSubmissions();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].score, 12000);

  // Slower score for same board and player is ignored
  const sub2 = {
    boardType: 'photoSet',
    boardId: 'set_1',
    score: 15000,
    metric: 'elapsedMs',
    displayName: 'Hunter_A',
    playerId: 'p1'
  };
  queuePendingSubmission(sub2);
  queue = getPendingSubmissions();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].score, 12000);

  // Faster score for same board and player updates queue
  const sub3 = {
    boardType: 'photoSet',
    boardId: 'set_1',
    score: 8500,
    metric: 'elapsedMs',
    displayName: 'Hunter_A',
    playerId: 'p1'
  };
  queuePendingSubmission(sub3);
  queue = getPendingSubmissions();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].score, 8500);

  // Different board is added as second item
  const subOther = {
    boardType: 'daily',
    boardId: '2026-09-15',
    score: 7000,
    metric: 'elapsedMs',
    displayName: 'Hunter_A',
    playerId: 'p1'
  };
  queuePendingSubmission(subOther);
  queue = getPendingSubmissions();
  assert.equal(queue.length, 2);

  clearPendingSubmissions();
  assert.equal(getPendingSubmissions().length, 0);
});

test('syncPendingSubmissions flushes queued submissions when online', async () => {
  clearPendingSubmissions();

  queuePendingSubmission({
    boardType: 'photoSet',
    boardId: 'set_sync_test',
    score: 9000,
    metric: 'elapsedMs',
    displayName: 'SyncHunter',
    playerId: 'p_sync'
  });

  // Offline: does not sync
  _setMockOnlineStateForTesting(false);
  let syncResult = await syncPendingSubmissions(async () => ({ qualified: true }));
  assert.equal(syncResult.synced, 0);
  assert.equal(syncResult.remaining, 1);

  // Online: calls submitFn and clears successfully synced items
  _setMockOnlineStateForTesting(true);
  const submittedItems = [];
  syncResult = await syncPendingSubmissions(async (item) => {
    submittedItems.push(item);
    return { qualified: true, remoteSynced: true };
  });

  assert.equal(syncResult.synced, 1);
  assert.equal(syncResult.remaining, 0);
  assert.equal(submittedItems.length, 1);
  assert.equal(submittedItems[0].boardId, 'set_sync_test');
  assert.equal(getPendingSubmissions().length, 0);

  _setMockOnlineStateForTesting(null);
});
