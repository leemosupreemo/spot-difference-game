import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayDateString,
  getDailySetForDate,
  getDailyLeaderboard,
  getDailyTimeToBeat,
  getDailyPlayerStatus,
  recordDailyChallengeCompletion,
  recordDailyChallengeAttempt,
  recordDailyChallengeFailure,
  canAttemptDaily,
  getTimeUntilNextDailyMs,
  formatTimeUntilNextDaily,
  getDailyQueue,
  setDailyQueue,
  syncRemoteDailyQueue,
  startDailyChallengeSession,
  recordDailyChallengeCompletionRemote,
  recordDailyChallengeFailureRemote,
  fetchDailyLeaderboard,
  updateDailyPlayerName,
  getDailyPlayerIdentifier,
  calculateRatingByStandardDeviation,
  getAllDailyChallengePoolLevels,
  resetDailyQueueToDefault,
  resetDailyPlayerStatus
} from './dailyChallenge.js';

test('getTodayDateString formats date correctly as YYYY-MM-DD', () => {
  const d = new Date(2026, 8, 8); // Sept 8, 2026
  assert.equal(getTodayDateString(d), '2026-09-08');
});

test('getDailySetForDate returns 3 distinct levels for a given date', () => {
  const levels = getDailySetForDate('2026-09-08');
  assert.equal(levels.length, 3);
  const ids = new Set(levels.map(l => l.id));
  assert.equal(ids.size, 3);
});

test('getDailySetForDate provides deterministic levels for the same date', () => {
  const set1 = getDailySetForDate('2026-09-09');
  const set2 = getDailySetForDate('2026-09-09');
  assert.deepEqual(set1.map(l => l.id), set2.map(l => l.id));
});

test('getDailySetForDate does not repeat levels across consecutive days', () => {
  const day1 = getDailySetForDate('2026-09-10');
  const day2 = getDailySetForDate('2026-09-11');
  const day1Ids = new Set(day1.map(l => l.id));
  for (const l of day2) {
    assert.equal(day1Ids.has(l.id), false, `Level ${l.id} was repeated between consecutive days!`);
  }
});

test('getDailyLeaderboard returns sorted entries capped at 20', () => {
  const leaderboard = getDailyLeaderboard('2026-09-08');
  assert.ok(leaderboard.length > 0 && leaderboard.length <= 20);
  for (let i = 0; i < leaderboard.length - 1; i++) {
    assert.ok(leaderboard[i].totalTimeMs <= leaderboard[i + 1].totalTimeMs);
    assert.equal(leaderboard[i].rank, i + 1);
  }
});

test('recordDailyChallengeCompletion calculates position, percentile, and stars', () => {
  const testDate = '2026-09-12';
  const result = recordDailyChallengeCompletion({
    dateStr: testDate,
    totalTimeMs: 19500, // Very fast! Should be #1 (3 stars)
    playerName: 'Speedy'
  });

  assert.equal(result.stars, 3);
  assert.equal(result.position, 1);
  assert.equal(result.isNewRecord, true);
  assert.ok(result.percentile >= 90);

  const status = getDailyPlayerStatus(testDate);
  assert.equal(status.completed, true);
  assert.equal(status.position, 1);

  const timeToBeat = getDailyTimeToBeat(testDate);
  assert.equal(timeToBeat, 19500);
});

test('canAttemptDaily enforces single attempt per day and records attempts & failures', () => {
  const attemptDate = '2026-09-15';
  assert.equal(canAttemptDaily(attemptDate), true);

  recordDailyChallengeAttempt(attemptDate);
  assert.equal(canAttemptDaily(attemptDate), false);

  const status = getDailyPlayerStatus(attemptDate);
  assert.equal(status.attempted, true);

  // Failure also records and prevents re-attempts
  const failDate = '2026-09-16';
  assert.equal(canAttemptDaily(failDate), true);
  recordDailyChallengeFailure({ dateStr: failDate, stageIndex: 1 });
  assert.equal(canAttemptDaily(failDate), false);
  const failStatus = getDailyPlayerStatus(failDate);
  assert.equal(failStatus.attempted, true);
  assert.equal(failStatus.failed, true);
  assert.equal(failStatus.stageIndex, 1);
});

test('getTimeUntilNextDailyMs returns positive milliseconds and formatTimeUntilNextDaily formats properly', () => {
  const ms = getTimeUntilNextDailyMs();
  assert.ok(ms > 0 && ms <= 86400000);

  const formatted = formatTimeUntilNextDaily();
  assert.match(formatted, /^[0-9]+[hm] [0-9]+[ms]$/);
});

test('getDailyQueue and setDailyQueue manage OTA queue data structure', () => {
  const customQueue = {
    schedule: {
      '2026-11-20': ['fresh_nature_pair_001', 'fresh_nature_pair_002', 'fresh_nature_pair_003']
    },
    queue: [
      { setId: 'set_1', levels: ['fresh_nature_pair_004', 'fresh_nature_pair_005', 'fresh_nature_pair_006'] }
    ],
    customLevels: []
  };

  setDailyQueue(customQueue);
  const retrieved = getDailyQueue();
  assert.deepEqual(retrieved.schedule['2026-11-20'], ['fresh_nature_pair_001', 'fresh_nature_pair_002', 'fresh_nature_pair_003']);
  assert.equal(retrieved.queue.length, 1);
});

test('getDailySetForDate resolves explicitly scheduled OTA daily sets', () => {
  const scheduledDate = '2026-12-25';
  setDailyQueue({
    schedule: {
      [scheduledDate]: ['fresh_nature_pair_007', 'fresh_nature_pair_008', 'fresh_nature_pair_009']
    },
    queue: []
  });

  const levels = getDailySetForDate(scheduledDate);
  assert.equal(levels.length, 3);
  assert.equal(levels[0].id, 'fresh_nature_pair_007');
  assert.equal(levels[1].id, 'fresh_nature_pair_008');
  assert.equal(levels[2].id, 'fresh_nature_pair_009');
});

test('getDailySetForDate resolves from sequential OTA queue when unscheduled', () => {
  const queuedDate = '2026-12-26';
  setDailyQueue({
    schedule: {},
    queue: [
      { setId: 'q1', levels: ['fresh_nature_pair_013', 'fresh_nature_pair_014', 'fresh_nature_pair_015'] }
    ]
  });

  const levels = getDailySetForDate(queuedDate);
  assert.equal(levels.length, 3);
  assert.equal(levels[0].id, 'fresh_nature_pair_013');
  assert.equal(levels[1].id, 'fresh_nature_pair_014');
  assert.equal(levels[2].id, 'fresh_nature_pair_015');
});

test('getDailyPlayerIdentifier resolves UID or Game Center prefix', () => {
  const resolved = getDailyPlayerIdentifier('mock_uid_123');
  assert.ok(resolved.includes('mock_uid_123') || resolved.startsWith('gc_'));
});

test('startDailyChallengeSession registers attempt immediately', async () => {
  const sessionDate = '2026-11-15';
  const session = await startDailyChallengeSession({ dateStr: sessionDate });
  assert.ok(session);
  assert.equal(session.allowed, true);
  const status = getDailyPlayerStatus(sessionDate);
  assert.equal(status.attempted, true);
});

test('recordDailyChallengeCompletionRemote updates local and remote status', async () => {
  const compDate = '2026-11-16';
  const result = await recordDailyChallengeCompletionRemote({
    dateStr: compDate,
    totalTimeMs: 25000,
    playerName: 'RemoteRacer'
  });
  assert.ok(result);
  assert.equal(result.stars, 3);
  const status = getDailyPlayerStatus(compDate);
  assert.equal(status.completed, true);
});

test('updateDailyPlayerName updates local player name across daily leaderboard', async () => {
  const nameDate = '2026-11-17';
  recordDailyChallengeCompletion({
    dateStr: nameDate,
    totalTimeMs: 28000,
    playerName: 'OldName'
  });

  await updateDailyPlayerName('NewCustomTag', nameDate);
  const leaderboard = getDailyLeaderboard(nameDate);
  const me = leaderboard.find(e => e.isLocalPlayer);
  assert.ok(me);
  assert.equal(me.playerName, 'NewCustomTag');
});

test('calculateRatingByStandardDeviation computes Gaussian 3, 2, or 1 star ratings', () => {
  // Population of times around mean 40000ms with spread
  const cohort = [22000, 26000, 32000, 36000, 40000, 44000, 48000, 54000, 60000];

  // Very fast time (> 0.5 sigma faster than mean): 3 stars
  assert.equal(calculateRatingByStandardDeviation(21000, cohort), 3);

  // Near-average time (within +- 0.5 sigma): 2 stars
  assert.equal(calculateRatingByStandardDeviation(40000, cohort), 2);

  // Very slow time (> 0.5 sigma slower than mean): 1 star
  assert.equal(calculateRatingByStandardDeviation(62000, cohort), 1);
});

test('getAllDailyChallengePoolLevels returns the whole daily catalog with labeled legacy sets', () => {
  resetDailyQueueToDefault();
  const pool = getAllDailyChallengePoolLevels();
  assert.ok(Array.isArray(pool));
  // Pool should have scheduled dates + modern queue sets + legacy queue sets (> 50 total levels)
  assert.ok(pool.length >= 50, `Expected at least 50 levels in daily pool, got ${pool.length}`);

  const legacyLevels = pool.filter(l => l.isLegacy);
  assert.ok(legacyLevels.length >= 20, `Expected at least 20 legacy levels, got ${legacyLevels.length}`);

  for (const legacy of legacyLevels) {
    assert.equal(legacy.isLegacy, true);
    assert.equal(legacy.isDaily, true);
    assert.equal(legacy.dailyLabel, 'Old (Legacy)');
    assert.ok(legacy.title.startsWith('[Old]'), `Expected title to start with [Old], got ${legacy.title}`);
  }

  const modernLevels = pool.filter(l => !l.isLegacy);
  assert.ok(modernLevels.length >= 20, `Expected at least 20 modern levels, got ${modernLevels.length}`);
  for (const mod of modernLevels) {
    assert.equal(mod.isLegacy, false);
    assert.equal(mod.isDaily, true);
    assert.ok(!mod.title.startsWith('[Old]'));
  }
});

test('resetDailyPlayerStatus clears failure/completion status so player can re-attempt in debug mode', () => {
  const testDate = '2026-09-08';
  recordDailyChallengeFailure({ dateStr: testDate, stageIndex: 1 });
  const statusAfterFail = getDailyPlayerStatus(testDate);
  assert.equal(statusAfterFail.failed, true);
  assert.equal(canAttemptDaily(testDate), false);

  resetDailyPlayerStatus(testDate);
  const statusAfterReset = getDailyPlayerStatus(testDate);
  assert.equal(statusAfterReset.failed, false);
  assert.equal(statusAfterReset.attempted, false);
  assert.equal(statusAfterReset.completed, false);
  assert.equal(canAttemptDaily(testDate), true);
});

test('resetDailyPlayerStatus removes the local leaderboard result too', () => {
  const testDate = '2026-09-07';
  recordDailyChallengeCompletion({ dateStr: testDate, totalTimeMs: 18000, playerName: 'Tester' });
  assert.equal(getDailyLeaderboard(testDate).some(entry => entry.isLocalPlayer), true);

  resetDailyPlayerStatus(testDate);

  assert.equal(getDailyLeaderboard(testDate).some(entry => entry.isLocalPlayer), false);
  assert.equal(canAttemptDaily(testDate), true);
});

test('getTodayDateString rolls over daily set at 4:00 AM Eastern (1:00 AM Pacific)', () => {
  // 3:59 AM ET on Sept 11 -> should still be Sept 10 challenge
  const lateNightET = new Date('2026-09-11T03:59:00-04:00');
  assert.equal(getTodayDateString(lateNightET), '2026-09-10');

  // 4:00 AM ET on Sept 11 -> rolls over to Sept 11 challenge
  const morningET = new Date('2026-09-11T04:00:00-04:00');
  assert.equal(getTodayDateString(morningET), '2026-09-11');

  // 12:45 AM PT on Sept 11 (3:45 AM ET) -> still Sept 10 challenge for late night player in Pacific
  const lateNightPT = new Date('2026-09-11T00:45:00-07:00');
  assert.equal(getTodayDateString(lateNightPT), '2026-09-10');

  // 1:05 AM PT on Sept 11 (4:05 AM ET) -> rolls over to Sept 11 challenge for Pacific
  const newDayPT = new Date('2026-09-11T01:05:00-07:00');
  assert.equal(getTodayDateString(newDayPT), '2026-09-11');
});





