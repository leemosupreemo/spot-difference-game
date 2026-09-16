import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateLeaderboardQualification,
  LEADERBOARD_LIMITS,
  getBaselineEntries,
  getDailyLeaderboard,
  fetchDailyLeaderboard,
  getCategoryLeaderboard,
  fetchCategoryLeaderboard,
  getPhotoSetLeaderboard,
  fetchPhotoSetLeaderboard,
  cacheLeaderboard,
  getCachedLeaderboard,
  submitLeaderboardScore
} from './leaderboardService.js';
import { getSavedPlayerName, savePlayerName } from './playerProgress.js';
import {
  _setMockOnlineStateForTesting,
  clearPendingSubmissions,
  getPendingSubmissions
} from './networkService.js';

test('LEADERBOARD_LIMITS matches specification', () => {
  assert.equal(LEADERBOARD_LIMITS.daily, 5);
  assert.equal(LEADERBOARD_LIMITS.category, 25);
  assert.equal(LEADERBOARD_LIMITS.photoSet, 3);
});

test('evaluateLeaderboardQualification accepts score when board has empty space', () => {
  const currentEntries = [
    { playerId: 'player_1', score: 12000, rank: 1 }
  ];
  const candidate = { playerId: 'player_2', score: 9500 };

  const result = evaluateLeaderboardQualification(currentEntries, candidate, 3, 'elapsedMs');
  assert.equal(result.qualifies, true);
  assert.equal(result.rank, 1);
  assert.equal(result.updatedEntries.length, 2);
  assert.equal(result.updatedEntries[0].playerId, 'player_2');
  assert.equal(result.updatedEntries[0].rank, 1);
  assert.equal(result.updatedEntries[1].playerId, 'player_1');
  assert.equal(result.updatedEntries[1].rank, 2);
});

test('evaluateLeaderboardQualification accepts faster candidate on full board and evicts worst', () => {
  const currentEntries = [
    { playerId: 'bot_1', score: 10000, rank: 1 },
    { playerId: 'bot_2', score: 12000, rank: 2 },
    { playerId: 'bot_3', score: 15000, rank: 3 }
  ];
  const candidate = { playerId: 'player_hero', score: 11000 };

  const result = evaluateLeaderboardQualification(currentEntries, candidate, 3, 'elapsedMs');
  assert.equal(result.qualifies, true);
  assert.equal(result.rank, 2);
  assert.equal(result.updatedEntries.length, 3);
  assert.equal(result.updatedEntries[0].playerId, 'bot_1');
  assert.equal(result.updatedEntries[1].playerId, 'player_hero');
  assert.equal(result.updatedEntries[2].playerId, 'bot_2');
  // bot_3 was evicted outside Top 3
  assert.equal(result.updatedEntries.some(e => e.playerId === 'bot_3'), false);
  assert.equal(result.replacedEntry?.playerId, 'bot_3');
});

test('evaluateLeaderboardQualification rejects candidate that does not beat cutoff', () => {
  const currentEntries = [
    { playerId: 'bot_1', score: 10000, rank: 1 },
    { playerId: 'bot_2', score: 12000, rank: 2 },
    { playerId: 'bot_3', score: 15000, rank: 3 }
  ];
  const candidate = { playerId: 'player_slow', score: 16000 };

  const result = evaluateLeaderboardQualification(currentEntries, candidate, 3, 'elapsedMs');
  assert.equal(result.qualifies, false);
  assert.equal(result.rank, null);
  assert.equal(result.updatedEntries.length, 3);
});

test('evaluateLeaderboardQualification deduplicates same player and preserves only their best score', () => {
  const currentEntries = [
    { playerId: 'player_hero', score: 13000, rank: 1 },
    { playerId: 'bot_2', score: 14000, rank: 2 },
    { playerId: 'bot_3', score: 15000, rank: 3 }
  ];

  // Slower attempt by same player should be rejected without altering the board
  const slowerAttempt = { playerId: 'player_hero', score: 14500 };
  const slowRes = evaluateLeaderboardQualification(currentEntries, slowerAttempt, 3, 'elapsedMs');
  assert.equal(slowRes.qualifies, false);
  assert.equal(slowRes.updatedEntries[0].score, 13000);

  // Faster attempt by same player updates their record
  const fasterAttempt = { playerId: 'player_hero', score: 11500 };
  const fastRes = evaluateLeaderboardQualification(currentEntries, fasterAttempt, 3, 'elapsedMs');
  assert.equal(fastRes.qualifies, true);
  assert.equal(fastRes.rank, 1);
  // Player does not appear twice on the board
  const appearances = fastRes.updatedEntries.filter(e => e.playerId === 'player_hero');
  assert.equal(appearances.length, 1);
  assert.equal(appearances[0].score, 11500);
});

test('evaluateLeaderboardQualification supports points metric where higher score is better', () => {
  const currentEntries = [
    { playerId: 'player_a', score: 4000, rank: 1 },
    { playerId: 'player_b', score: 3500, rank: 2 },
    { playerId: 'player_c', score: 2000, rank: 3 }
  ];

  // 4500 beats 4000 in points metric
  const candidate = { playerId: 'player_high_scorer', score: 4500 };
  const res = evaluateLeaderboardQualification(currentEntries, candidate, 3, 'points');

  assert.equal(res.qualifies, true);
  assert.equal(res.rank, 1);
  assert.equal(res.updatedEntries[0].playerId, 'player_high_scorer');
  assert.equal(res.updatedEntries[1].playerId, 'player_a');
  assert.equal(res.updatedEntries[2].playerId, 'player_b');
  assert.equal(res.updatedEntries.some(e => e.playerId === 'player_c'), false);
});

test('getBaselineEntries returns at least Top 3 for photoSet, Top 5 for daily, and Top 25 for category', () => {
  const photoSetBaseline = getBaselineEntries('photoSet', 'photo_set_001');
  assert.equal(photoSetBaseline.length, 3);
  assert.equal(photoSetBaseline[0].rank, 1);
  assert.equal(photoSetBaseline[1].rank, 2);
  assert.equal(photoSetBaseline[2].rank, 3);

  const dailyBaseline = getBaselineEntries('daily', '2026-09-15');
  assert.equal(dailyBaseline.length, 5);
  assert.equal(dailyBaseline[0].rank, 1);
  assert.equal(dailyBaseline[4].rank, 5);

  const catBaseline = getBaselineEntries('category', 'photo');
  assert.equal(catBaseline.length, 25);
});

test('getPhotoSetLeaderboard, getDailyLeaderboard, and getCategoryLeaderboard return ranked records', () => {
  const setBoard = getPhotoSetLeaderboard('photo_set_005');
  assert.ok(Array.isArray(setBoard));
  assert.equal(setBoard.length, 3);
  assert.equal(setBoard[0].rank, 1);
  assert.equal(typeof setBoard[0].isCurrentPlayer, 'boolean');

  const dailyBoard = getDailyLeaderboard('2026-09-15');
  assert.ok(Array.isArray(dailyBoard));
  assert.equal(dailyBoard.length, 5);
  assert.equal(dailyBoard[0].rank, 1);

  const photoCatBoard = getCategoryLeaderboard('photo');
  assert.ok(Array.isArray(photoCatBoard));
  assert.equal(photoCatBoard.length, 25);

  const abstractCatBoard = getCategoryLeaderboard('abstract');
  assert.ok(Array.isArray(abstractCatBoard));
  assert.equal(abstractCatBoard.length, 25);
});

test('cacheLeaderboard and getCachedLeaderboard preserve entries in local storage', () => {
  const mockEntries = [
    { playerId: 'test_p1', score: 8000, rank: 1 },
    { playerId: 'test_p2', score: 9200, rank: 2 }
  ];

  cacheLeaderboard('photoSet', 'test_set_999', mockEntries);
  const cached = getCachedLeaderboard('photoSet', 'test_set_999');

  assert.ok(Array.isArray(cached));
  assert.equal(cached.length, 2);
  assert.equal(cached[0].playerId, 'test_p1');
  assert.equal(cached[1].playerId, 'test_p2');
});

test('submitLeaderboardScore evaluates candidate and updates local cache gracefully', async () => {
  const result = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId: 'test_set_qualify',
    score: 5000,
    metric: 'elapsedMs',
    displayName: 'TestHunter'
  });

  assert.ok(typeof result.qualified === 'boolean');
  assert.ok(Array.isArray(result.entries));
  assert.ok(result.entries.length <= 3);
  // Qualifies with 5000ms compared to baseline (> 16000ms)
  assert.equal(result.qualified, true);
  assert.equal(result.rank, 1);
  assert.equal(result.entries[0].isCurrentPlayer, true);
});

test('async leaderboard fetch functions return ranked records and reflect cache', async () => {
  const setBoard = await fetchPhotoSetLeaderboard('photo_set_010');
  assert.ok(Array.isArray(setBoard));
  assert.equal(setBoard.length, 3);
  assert.equal(setBoard[0].rank, 1);
  assert.equal(typeof setBoard[0].isCurrentPlayer, 'boolean');

  const dailyBoard = await fetchDailyLeaderboard('2026-09-15');
  assert.ok(Array.isArray(dailyBoard));
  assert.equal(dailyBoard.length, 5);
  assert.equal(dailyBoard[0].rank, 1);

  const catBoard = await fetchCategoryLeaderboard('photo');
  assert.ok(Array.isArray(catBoard));
  assert.equal(catBoard.length, 25);
  assert.equal(catBoard[0].rank, 1);
});

test('submitLeaderboardScore rejects score that does not beat the leaderboard cutoff', async () => {
  // Baseline 3rd place is ~23,000ms. A 99,000ms time should not qualify for Top 3.
  const result = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId: 'test_set_cutoff_check',
    score: 99000,
    metric: 'elapsedMs',
    displayName: 'SlowTurtle'
  });

  assert.equal(result.qualified, false);
  assert.equal(result.rank, null);
  // Entries remain unchanged and capped at 3
  assert.equal(result.entries.length, 3);
  assert.equal(result.entries.some(e => e.displayName === 'SlowTurtle'), false);
});

test('submitLeaderboardScore supports daily Top 5 and category Top 25 qualification', async () => {
  // Daily qualification (limit 5)
  const dailyRes = await submitLeaderboardScore({
    boardType: 'daily',
    boardId: '2026-09-15',
    score: 6000,
    metric: 'elapsedMs',
    displayName: 'DailyChamp'
  });
  assert.equal(dailyRes.qualified, true);
  assert.equal(dailyRes.rank, 1);
  assert.ok(dailyRes.entries.length <= 5);
  assert.equal(dailyRes.entries[0].displayName, 'DailyChamp');

  // Category qualification (limit 25)
  const catRes = await submitLeaderboardScore({
    boardType: 'category',
    boardId: 'photo',
    score: 7500,
    metric: 'elapsedMs',
    displayName: 'CategoryMaster'
  });
  assert.equal(catRes.qualified, true);
  assert.equal(catRes.rank, 1);
  assert.ok(catRes.entries.length <= 25);
  assert.equal(catRes.entries[0].displayName, 'CategoryMaster');
});

test('submitLeaderboardScore replaces existing player score on improvement without duplicate entries', async () => {
  const boardId = 'test_set_dedup_flow';

  // First qualifying submission: rank 2 or 3
  const firstSub = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId,
    score: 18000,
    metric: 'elapsedMs',
    displayName: 'EvolvingHunter'
  });
  assert.equal(firstSub.qualified, true);
  const firstRank = firstSub.rank;

  // Faster submission by same player: should improve rank and appear exactly once
  const improvedSub = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId,
    score: 4000,
    metric: 'elapsedMs',
    displayName: 'EvolvingHunter'
  });
  assert.equal(improvedSub.qualified, true);
  assert.equal(improvedSub.rank, 1);

  const playerEntries = improvedSub.entries.filter(e => e.isCurrentPlayer);
  assert.equal(playerEntries.length, 1);
  assert.equal(playerEntries[0].score, 4000);

  // Slower subsequent attempt should not overwrite the 4000ms personal best
  const slowerSub = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId,
    score: 15000,
    metric: 'elapsedMs',
    displayName: 'EvolvingHunter'
  });
  assert.equal(slowerSub.qualified, false);
  const stillBest = slowerSub.entries.find(e => e.isCurrentPlayer);
  assert.equal(stillBest.score, 4000);
});

test('submitLeaderboardScore automatically falls back to getSavedPlayerName() when displayName is omitted', async () => {
  savePlayerName('AutoNameHunter_99');

  const result = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId: 'test_set_autoname',
    score: 4200,
    metric: 'elapsedMs'
  });

  assert.equal(result.qualified, true);
  assert.equal(result.entries[0].displayName, 'AutoNameHunter_99');
});

test('read-after-write consistency: getPhotoSetLeaderboard immediately reflects newly submitted score', async () => {
  const boardId = 'test_set_read_after_write';

  await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId,
    score: 3500,
    metric: 'elapsedMs',
    displayName: 'SynchronousHunter'
  });

  // Synchronous read
  const syncRead = getPhotoSetLeaderboard(boardId);
  assert.equal(syncRead[0].displayName, 'SynchronousHunter');
  assert.equal(syncRead[0].score, 3500);
  assert.equal(syncRead[0].isCurrentPlayer, true);

  // Async read
  const asyncRead = await fetchPhotoSetLeaderboard(boardId);
  assert.equal(asyncRead[0].displayName, 'SynchronousHunter');
  assert.equal(asyncRead[0].score, 3500);
});

test('submitLeaderboardScore queues offline submissions when network is unavailable', async () => {
  clearPendingSubmissions();
  _setMockOnlineStateForTesting(false);

  const res = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId: 'test_set_offline_queue',
    score: 3100,
    metric: 'elapsedMs',
    displayName: 'OfflineAce'
  });

  assert.equal(res.qualified, true);
  assert.equal(res.isOffline, true);
  assert.equal(res.remoteSynced, false);

  const pending = getPendingSubmissions();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].boardId, 'test_set_offline_queue');
  assert.equal(pending[0].score, 3100);

  _setMockOnlineStateForTesting(null);
  clearPendingSubmissions();
});


