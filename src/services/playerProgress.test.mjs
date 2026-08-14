import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLeaderboardPayload,
  syncProgressFromFirestore,
  getSavedPlayerName,
  savePlayerName,
  fetchLeaderboards
} from './playerProgress.js';

test('computes separate first-time and repeat average times per image pack', () => {
  const dummyStats = {
    All: {
      sets: {
        set_1: { packId: 'find_the_sniper', firstTime: 10000, fastestRepeat: 8000 },
        set_2: { packId: 'find_the_sniper', firstTime: 12000, fastestRepeat: 10000 },
        set_3: { packId: 'abstract_animated', firstTime: 20000, fastestRepeat: 16000 }
      }
    }
  };

  const payload = computeLeaderboardPayload(dummyStats, 'Tester');

  assert.equal(payload.playerName, 'Tester');
  assert.equal(payload.avgFirstTimeByPack.find_the_sniper, 11000);
  assert.equal(payload.avgRepeatTimeByPack.find_the_sniper, 9000);
  assert.equal(payload.avgFirstTimeByPack.abstract_animated, 20000);
  assert.equal(payload.avgRepeatTimeByPack.abstract_animated, 16000);
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

test('fetchLeaderboards builds top 5 structure with fallbacks and local player entry', async () => {
  const data = await fetchLeaderboards({});
  assert.ok(data.byPackFirst);
  assert.ok(data.byPackRepeat);
  assert.ok(data.localPlayer);
  assert.equal(data.byPackRepeat.find_the_sniper.length, 5);
});
