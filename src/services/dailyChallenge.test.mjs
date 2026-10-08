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
  resetDailyPlayerStatus,
  getDailyCalendarMonth,
  isDailyChallengeCompleted,
  DAILY_CHALLENGE_EPOCH_DATE,
  syncDailyProgressFromFirestore,
  isDailyChallengeCompletedRemote
} from './dailyChallenge.js';
import { hasAdjacentRepeat, baseImageKey } from '../utils/stageOrdering.js';

test('daily set identity is stable and preserves ordered entry IDs', () => {
  resetDailyQueueToDefault();
  const first = getDailySetForDate('2026-09-11');
  const second = getDailySetForDate('2026-09-11');
  assert.equal(first.dailySetId, 'daily_2026-09-11');
  assert.equal(first.dateStr, '2026-09-11');
  assert.deepEqual(first.entryIds, first.map(level => level.id));
  assert.deepEqual(second.entryIds, first.entryIds);
  assert.equal(first.length, 3);
});

test('daily completion persists date, identity, ordered IDs, and first/repeat timing', () => {
  const dateStr = '2026-12-01';
  resetDailyPlayerStatus(dateStr);
  const first = recordDailyChallengeCompletion({
    dateStr,
    totalTimeMs: 30000,
    entryIds: ['daily_a', 'daily_b', 'daily_c']
  });
  assert.equal(first.setId, `daily_${dateStr}`);
  assert.deepEqual(first.entryIds, ['daily_a', 'daily_b', 'daily_c']);
  assert.equal(first.firstTime, 30000);
  assert.equal(first.fastestRepeat, null);

  const repeat = recordDailyChallengeCompletion({
    dateStr,
    totalTimeMs: 28000,
    entryIds: ['daily_a', 'daily_b', 'daily_c']
  });
  const status = getDailyPlayerStatus(dateStr);
  assert.equal(repeat.setId, `daily_${dateStr}`);
  assert.equal(status.firstTime, 30000);
  assert.equal(status.fastestRepeat, 28000);
  assert.deepEqual(status.entryIds, ['daily_a', 'daily_b', 'daily_c']);
});

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

test('getDailyLeaderboard returns sorted entries capped at 5', () => {
  const leaderboard = getDailyLeaderboard('2026-09-08');
  assert.ok(leaderboard.length > 0 && leaderboard.length <= 5);
  for (let i = 0; i < leaderboard.length - 1; i++) {
    assert.ok(leaderboard[i].totalTimeMs <= leaderboard[i + 1].totalTimeMs);
    assert.equal(leaderboard[i].rank, i + 1);
  }
});

test('recordDailyChallengeCompletion calculates position and stars', () => {
  const testDate = '2026-09-12';
  const result = recordDailyChallengeCompletion({
    dateStr: testDate,
    totalTimeMs: 19500, // Very fast! Should be #1 (3 stars)
    playerName: 'Speedy'
  });

  assert.equal(result.stars, 3);
  assert.equal(result.position, 1);
  assert.equal(result.isNewRecord, true);
  assert.equal(result.percentile, undefined);

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
      '2026-11-20': ['photo_set_002_05', 'photo_set_002_03', 'fresh_nature_pair_003']
    },
    queue: [
      { setId: 'set_1', levels: ['fresh_nature_pair_004', 'fresh_nature_pair_005', 'fresh_nature_pair_006'] }
    ],
    customLevels: []
  };

  setDailyQueue(customQueue);
  const retrieved = getDailyQueue();
  assert.deepEqual(retrieved.schedule['2026-11-20'], ['photo_set_002_05', 'photo_set_002_03', 'fresh_nature_pair_003']);
  assert.equal(retrieved.queue.length, 1);
});

test('getDailySetForDate resolves explicitly scheduled OTA daily sets', () => {
  const scheduledDate = '2026-12-25';
  setDailyQueue({
    schedule: {
      [scheduledDate]: ['photo_set_003_05', 'photo_set_004_01', 'photo_set_004_02']
    },
    queue: []
  });

  const levels = getDailySetForDate(scheduledDate);
  assert.equal(levels.length, 3);
  assert.equal(levels[0].id, 'photo_set_003_05');
  assert.equal(levels[1].id, 'photo_set_004_01');
  assert.equal(levels[2].id, 'photo_set_004_02');
});

test('getDailySetForDate resolves from sequential OTA queue when unscheduled', () => {
  const queuedDate = '2026-12-26';
  setDailyQueue({
    schedule: {},
    queue: [
      { setId: 'q1', levels: ['photo_set_003_04', 'photo_set_003_05', 'photo_set_004_01'] }
    ]
  });

  const levels = getDailySetForDate(queuedDate);
  assert.equal(levels.length, 3);
  assert.equal(levels[0].id, 'photo_set_003_04');
  assert.equal(levels[1].id, 'photo_set_003_05');
  assert.equal(levels[2].id, 'photo_set_004_01');
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
  // Pool should include the remaining scheduled and queue sets after dismissed assets were pruned.
  assert.ok(pool.length >= 30, `Expected at least 30 levels in daily pool, got ${pool.length}`);

  const legacyLevels = pool.filter(l => l.isLegacy);
  assert.ok(legacyLevels.length >= 10, `Expected at least 10 legacy levels, got ${legacyLevels.length}`);

  for (const legacy of legacyLevels) {
    assert.equal(legacy.isLegacy, true);
    assert.equal(legacy.isDaily, true);
    assert.equal(legacy.dailyLabel, 'Old (Legacy)');
    assert.ok(legacy.title.startsWith('[Old]'), `Expected title to start with [Old], got ${legacy.title}`);
  }

  const modernLevels = pool.filter(l => !l.isLegacy);
  assert.ok(modernLevels.length >= 15, `Expected at least 15 modern levels, got ${modernLevels.length}`);
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

test('getDailySetForDate spaces apart adjacent duplicate base images in scheduled queue', () => {
  const testDate = '2026-11-20';
  // Create schedule where entry 0 and 1 share the exact same photo/baseImage
  setDailyQueue({
    schedule: {
      [testDate]: [
        { id: 'custom_a1', baseImage: 'levels/dupphoto_base.webp', variantImage: 'levels/custom_a1_v.webp', diffs: [{ id: 1, x: 50, y: 50, radius: 5 }] },
        { id: 'custom_a2', baseImage: 'levels/dupphoto_base.webp', variantImage: 'levels/custom_a2_v.webp', diffs: [{ id: 1, x: 50, y: 50, radius: 5 }] },
        { id: 'custom_b1', baseImage: 'levels/otherphoto_base.webp', variantImage: 'levels/custom_b1_v.webp', diffs: [{ id: 1, x: 50, y: 50, radius: 5 }] }
      ]
    },
    queue: []
  });

  const levels = getDailySetForDate(testDate);
  assert.equal(levels.length, 3);
  assert.equal(hasAdjacentRepeat(levels), false, 'identical base images must not be adjacent');
  assert.notEqual(baseImageKey(levels[0]), baseImageKey(levels[1]));
  assert.notEqual(baseImageKey(levels[1]), baseImageKey(levels[2]));
});

test('getDailyCalendarMonth correctly tags completed, uncompleted active, and future days', () => {
  const simulatedToday = '2026-09-20';

  // Mark 2026-09-10 as completed
  recordDailyChallengeCompletion({
    dateStr: '2026-09-10',
    totalTimeMs: 25000,
    playerName: 'CalendarTester'
  });
  assert.equal(isDailyChallengeCompleted('2026-09-10'), true);
  assert.equal(isDailyChallengeCompleted('2026-09-11'), false);

  const cal = getDailyCalendarMonth(2026, 9, simulatedToday);
  assert.equal(cal.year, 2026);
  assert.equal(cal.month, 9);
  assert.equal(cal.daysInMonth, 30);
  assert.equal(typeof cal.startDayOfWeek, 'number');

  // Sept 10 is completed -> isCompleted: true, isActive: false
  const day10 = cal.days.find(d => d.dateStr === '2026-09-10');
  assert.ok(day10);
  assert.equal(day10.isCompleted, true);
  assert.equal(day10.isActive, false);

  // Sept 11 is past and uncompleted -> isCompleted: false, isActive: true (playable)
  const day11 = cal.days.find(d => d.dateStr === '2026-09-11');
  assert.ok(day11);
  assert.equal(day11.isCompleted, false);
  assert.equal(day11.isFuture, false);
  assert.equal(day11.isActive, true);

  // Sept 25 is future -> isFuture: true, isActive: false (locked)
  const day25 = cal.days.find(d => d.dateStr === '2026-09-25');
  assert.ok(day25);
  assert.equal(day25.isFuture, true);
  assert.equal(day25.isActive, false);

  // Navigation bounds
  assert.equal(cal.canGoPrev, false); // Sept 2026 is epoch month
  assert.equal(cal.canGoNext, false); // Sept 2026 is today's month
});

test('startDailyChallengeSession blocks archive run if already completed', async () => {
  const archiveDate = '2026-09-12';
  resetDailyPlayerStatus(archiveDate);

  // Uncompleted archive date is allowed
  const session1 = await startDailyChallengeSession({ dateStr: archiveDate, isArchive: true });
  assert.equal(session1.allowed, true);

  // Mark as completed
  recordDailyChallengeCompletion({
    dateStr: archiveDate,
    totalTimeMs: 24000
  });

  // Completed archive date is blocked
  const session2 = await startDailyChallengeSession({ dateStr: archiveDate, isArchive: true });
  assert.equal(session2.allowed, false);
  assert.equal(session2.status, 'completed');
});

test('recordDailyChallengeCompletionRemote handles archive completion without throwing', async () => {
  const archiveDate = '2026-09-13';
  resetDailyPlayerStatus(archiveDate);

  const res = await recordDailyChallengeCompletionRemote({
    dateStr: archiveDate,
    totalTimeMs: 25000,
    isArchive: true
  });
  assert.ok(res);
  assert.equal(res.totalTimeMs, 25000);
  assert.equal(isDailyChallengeCompleted(archiveDate), true);
});

test('syncDailyProgressFromFirestore and isDailyChallengeCompletedRemote handle offline gracefully', async () => {
  const checkDate = '2026-09-14';
  resetDailyPlayerStatus(checkDate);

  const isCompletedBefore = await isDailyChallengeCompletedRemote(checkDate);
  assert.equal(isCompletedBefore, false);

  const synced = await syncDailyProgressFromFirestore();
  assert.ok(synced);

  recordDailyChallengeCompletion({
    dateStr: checkDate,
    totalTimeMs: 22000
  });

  const isCompletedAfter = await isDailyChallengeCompletedRemote(checkDate);
  assert.equal(isCompletedAfter, true);
});



