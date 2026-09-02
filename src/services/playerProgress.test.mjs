import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLeaderboardPayload,
  syncProgressFromFirestore,
  getSavedPlayerName,
  savePlayerName,
  fetchLeaderboards
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

test('fetchLeaderboards ranks by avg first time as primary anchor with all 3 metrics present', async () => {
  const data = await fetchLeaderboards({});
  assert.ok(data.byPackFirst);
  assert.ok(data.byPackRepeat);
  assert.ok(data.localPlayer);
  assert.ok(data.byPackRepeat.find_the_sniper.length >= 5);

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

