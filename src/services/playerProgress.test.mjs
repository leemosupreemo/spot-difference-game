import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLeaderboardPayload,
  syncProgressFromFirestore,
  mergeDifficultyStats,
  restoreProgressFromCloud,
  getSavedPlayerName,
  savePlayerName,
  fetchLeaderboards,
  hasCompletedFirstSet,
  markFirstSetCompleted,
  _resetFirstSetCompletedForTesting,
  STORAGE_KEY_HAS_COMPLETED_SET
} from './playerProgress.js';

test('computes separate first-time, repeat, and fastest individual times per image pack', () => {
  const dummyStats = {
    All: {
      sets: {
        set_1: { packId: 'find_the_sniper', firstTime: 10000, fastestRepeat: 8000, bestCleanTime: 2500 },
        set_2: { packId: 'find_the_sniper', firstTime: 12000, fastestRepeat: 10000, bestCleanTime: 3200 },
        set_3: { packId: 'abstract_animated', firstTime: 20000, fastestRepeat: 16000, bestCleanTime: 4100 }
      }
    }
  };

  const payload = computeLeaderboardPayload(dummyStats, 'Tester');

  assert.equal(payload.playerName, 'Tester');
  assert.equal(payload.avgFirstTimeByPack.find_the_sniper, 11000);
  assert.equal(payload.avgRepeatTimeByPack.find_the_sniper, 9000);
  assert.equal(payload.fastestTimeByPack.find_the_sniper, 2500);
  assert.equal(payload.avgFirstTimeByPack.abstract_animated, 20000);
  assert.equal(payload.avgRepeatTimeByPack.abstract_animated, 16000);
  assert.equal(payload.fastestTimeByPack.abstract_animated, 4100);
  assert.equal(payload.totalSetsCleared, 3);
});

test('handles empty or null difficultyStats gracefully in computeLeaderboardPayload', () => {
  const payload = computeLeaderboardPayload(null, '');
  assert.equal(payload.playerName, 'SpeedHunter');
  assert.equal(payload.totalSetsCleared, 0);
});

test('manages player handle storage cleanly', () => {
  const saved = savePlayerName('  CyberHunter  ');
  assert.equal(saved, 'CyberHunter');
  assert.equal(getSavedPlayerName(), 'CyberHunter');
  savePlayerName('SpeedHunter'); // reset
});

test('syncProgressFromFirestore returns merged stats when cloud history contains records', async () => {
  const localStats = { All: { setsCleared: 1, sets: { img_1: { firstTime: 5000 } } } };
  const res = await syncProgressFromFirestore(localStats);
  assert.equal(res.All.setsCleared, 1);
});

test('mergeDifficultyStats restores cloud sets when local is empty (reinstall scenario)', () => {
  const localStats = {
    Medium: { setsCleared: 0, sets: {} }
  };
  const cloudStats = {
    Medium: {
      setsCleared: 2,
      sets: {
        photo_set_001: {
          setId: 'photo_set_001',
          firstTime: 14000,
          fastestRepeat: 11000,
          fastestTime: 11000,
          clears: 3,
          totalPoints: 2800
        },
        photo_set_002: {
          setId: 'photo_set_002',
          firstTime: 18000,
          fastestRepeat: null,
          fastestTime: 18000,
          clears: 1,
          totalPoints: 950
        }
      }
    }
  };

  const merged = mergeDifficultyStats(localStats, cloudStats);
  assert.equal(merged.Medium.setsCleared, 2);
  assert.equal(merged.Medium.sets.photo_set_001.clears, 3);
  assert.equal(merged.Medium.sets.photo_set_001.fastestTime, 11000);
  assert.equal(merged.Medium.sets.photo_set_002.clears, 1);
  assert.equal(merged.Medium.sets.photo_set_002.firstTime, 18000);
});

test('mergeDifficultyStats keeps optimal metrics and highest attempt counts across local and cloud', () => {
  const localStats = {
    Medium: {
      setsCleared: 1,
      sets: {
        photo_set_001: {
          setId: 'photo_set_001',
          firstTime: 15000,
          fastestRepeat: 10500,
          fastestTime: 10500,
          clears: 4,
          totalPoints: 3500
        }
      }
    }
  };
  const cloudStats = {
    Medium: {
      setsCleared: 1,
      sets: {
        photo_set_001: {
          setId: 'photo_set_001',
          firstTime: 14000,
          fastestRepeat: 12000,
          fastestTime: 12000,
          clears: 2,
          totalPoints: 1800
        }
      }
    }
  };

  const merged = mergeDifficultyStats(localStats, cloudStats);
  const set1 = merged.Medium.sets.photo_set_001;
  // Best first time from cloud (14000 vs 15000)
  assert.equal(set1.firstTime, 14000);
  // Best repeat from local (10500 vs 12000)
  assert.equal(set1.fastestRepeat, 10500);
  // Overall fastest is 10500
  assert.equal(set1.fastestTime, 10500);
  // Maximum clears/attempts (4 vs 2)
  assert.equal(set1.clears, 4);
  // Maximum total points (3500 vs 1800)
  assert.equal(set1.totalPoints, 3500);
});

test('restoreProgressFromCloud returns stats gracefully in offline test environment', async () => {
  const localStats = {
    Medium: { setsCleared: 1, sets: { photo_set_001: { clears: 1 } } }
  };
  const res = await restoreProgressFromCloud(localStats);
  assert.ok(res);
  assert.equal(res.Medium.setsCleared, 1);
});

test('fetchLeaderboards ranks by avg first time as primary anchor with all 3 metrics present', async () => {
  const data = await fetchLeaderboards({});
  assert.ok(data.byPackFirst);
  assert.ok(data.byPackRepeat);
  assert.ok(data.localPlayer);
  assert.ok(data.byPackRepeat.find_the_sniper.length >= 5);
  assert.equal(data.byPackRepeat.find_the_sniper.length, 25);

  const entries = data.byPackRepeat.find_the_sniper;
  for (let i = 0; i < entries.length - 1; i++) {
    const a = entries[i].firstTime || 999999;
    const b = entries[i + 1].firstTime || 999999;
    assert.ok(a <= b, `Entry ${i} (${a}) should be <= Entry ${i+1} (${b})`);
  }

  const top1 = entries[0];
  assert.ok(top1.firstTime);
  assert.ok(top1.repeatTime);
  assert.ok(top1.fastestTime);
});

test('tracks first set completion lifecycle', () => {
  _resetFirstSetCompletedForTesting();
  assert.equal(hasCompletedFirstSet(), false);

  markFirstSetCompleted();
  assert.equal(hasCompletedFirstSet(), true);

  _resetFirstSetCompletedForTesting();
  assert.equal(hasCompletedFirstSet(), false);
});



test('builds a set-scoped first completion payload with ordered entry IDs', async () => {
  const { buildImageProgressPayload } = await import('./playerProgress.js');
  const payload = buildImageProgressPayload({
    imageId: 'photo_001',
    packId: 'find_the_sniper',
    title: 'Photo 001',
    completionTimeMs: 18420,
    isFirstSeen: true,
    clears: 1,
    setId: 'photo_set_007',
    entryIds: ['photo_001', 'photo_002', 'photo_003', 'photo_004', 'photo_005']
  });
  assert.equal(payload.setId, 'photo_set_007');
  assert.deepEqual(payload.entryIds, ['photo_001', 'photo_002', 'photo_003', 'photo_004', 'photo_005']);
  assert.equal(payload.firstTime, 18420);
  assert.equal(payload.fastestRepeat, null);
  assert.equal(payload.fastestTime, 18420);
});

test('builds a set-scoped repeat payload without overwriting the original first time', async () => {
  const { buildImageProgressPayload } = await import('./playerProgress.js');
  const payload = buildImageProgressPayload({
    imageId: 'photo_001',
    packId: 'find_the_sniper',
    title: 'Photo 001',
    completionTimeMs: 16000,
    isFirstSeen: false,
    clears: 2,
    setId: 'photo_set_007',
    entryIds: ['photo_001', 'photo_002', 'photo_003', 'photo_004', 'photo_005'],
    existingData: { firstTime: 18420, firstSeenTimeMs: 18420, fastestRepeat: 17200, bestRepeatTimeMs: 17200, fastestTime: 17200 }
  });
  assert.equal(payload.firstTime, 18420);
  assert.equal(payload.fastestRepeat, 16000);
  assert.equal(payload.fastestTime, 16000);
  assert.equal(payload.firstSeenTimeMs, undefined);
  assert.equal(payload.bestRepeatTimeMs, undefined);
});

test('keeps legacy image history fields when no set identity is supplied', async () => {
  const { buildImageProgressPayload } = await import('./playerProgress.js');
  const first = buildImageProgressPayload({
    imageId: 'legacy_001', packId: 'find_the_sniper', title: 'Legacy',
    completionTimeMs: 9000, isFirstSeen: true, clears: 1
  });
  assert.equal(first.firstSeenTimeMs, 9000);
  assert.equal(first.setId, undefined);

  const repeat = buildImageProgressPayload({
    imageId: 'legacy_001', packId: 'find_the_sniper', title: 'Legacy',
    completionTimeMs: 8000, isFirstSeen: false, clears: 2,
    existingData: first
  });
  assert.equal(repeat.bestRepeatTimeMs, 8000);
  assert.equal(repeat.firstSeenTimeMs, undefined);
});

test('computes standard deterministic Photo Set timing payloads by set identity', () => {
  const payload = computeLeaderboardPayload({
    Medium: {
      sets: {
        photo_set_007: { setId: 'photo_set_007', packId: 'find_the_sniper', firstTime: 18420, fastestRepeat: 16000 },
        photo_set_008: { setId: 'photo_set_008', packId: 'find_the_sniper', firstTime: 22000, fastestRepeat: 19000 },
        abstract_legacy: { packId: 'abstract_animated', firstTime: 12000, fastestRepeat: 10000 }
      }
    }
  }, 'Tester');

  assert.equal(payload.bySetFirst.photo_set_007, 18420);
  assert.equal(payload.bySetRepeat.photo_set_007, 16000);
  assert.equal(payload.fastestTimeBySet.photo_set_007, 16000);
  assert.equal(payload.bySetFirst.photo_set_008, 22000);
  assert.equal(payload.fastestTimeBySet.photo_set_008, 19000);
  assert.equal(payload.bySetFirst.abstract_legacy, undefined);
});

test('keeps first and repeat Photo Set timing payloads independently ranked', () => {
  const payload = computeLeaderboardPayload({ All: { sets: {
    first: { setId: 'photo_set_001', firstTime: 12000, fastestRepeat: 9000 },
    second: { setId: 'photo_set_002', firstTime: 8000, fastestRepeat: 11000 }
  } } }, 'Tester');
  assert.equal(payload.bySetFirst.photo_set_001, 12000);
  assert.equal(payload.bySetRepeat.photo_set_001, 9000);
  assert.equal(payload.bySetFirst.photo_set_002, 8000);
  assert.equal(payload.bySetRepeat.photo_set_002, 11000);
});

test('registers failed first attempt in computeLeaderboardPayload without overwriting repeat time', () => {
  const payload = computeLeaderboardPayload({
    Medium: {
      sets: {
        photo_set_001: {
          setId: 'photo_set_001',
          packId: 'find_the_sniper',
          firstFailed: true,
          firstTime: 'failed',
          fastestRepeat: 9500,
          clears: 1,
          attempts: 2
        }
      }
    }
  }, 'Tester');

  assert.equal(payload.bySetFirst.photo_set_001, 'failed');
  assert.equal(payload.bySetRepeat.photo_set_001, 9500);
  assert.equal(payload.fastestTimeBySet.photo_set_001, 9500);
});

test('mergeDifficultyStats preserves firstFailed and firstTime failed across cloud and local', () => {
  const localStats = {
    Medium: {
      sets: {
        photo_set_005: {
          setId: 'photo_set_005',
          firstFailed: true,
          firstTime: 'failed',
          attempts: 1,
          clears: 0
        }
      }
    }
  };

  const cloudStats = {
    Medium: {
      sets: {
        photo_set_005: {
          setId: 'photo_set_005',
          fastestRepeat: 8200,
          clears: 1,
          attempts: 1
        }
      }
    }
  };

  const merged = mergeDifficultyStats(localStats, cloudStats);
  const setRecord = merged.Medium.sets.photo_set_005;

  assert.equal(setRecord.firstFailed, true);
  assert.equal(setRecord.firstTime, 'failed');
  assert.equal(setRecord.fastestRepeat, 8200);
  assert.equal(setRecord.fastestTime, 8200);
  assert.equal(setRecord.clears, 1);
  assert.equal(setRecord.attempts, 1);
});
