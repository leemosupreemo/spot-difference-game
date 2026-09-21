import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_PHOTO_SET_IDS,
  getSetNumber,
  getDeterministicSetBaseline,
  calculateSetWorldRank,
  parseSetSearch
} from './setLeaderboards.js';
import { calculateSpeedPoints } from './scoring.js';

test('ALL_PHOTO_SET_IDS contains 26 photo sets', () => {
  assert.equal(ALL_PHOTO_SET_IDS.length, 26);
  assert.equal(ALL_PHOTO_SET_IDS[0], 'photo_set_001');
  assert.equal(ALL_PHOTO_SET_IDS[25], 'photo_set_026');
});

test('getSetNumber correctly parses set IDs', () => {
  assert.equal(getSetNumber('photo_set_001'), 1);
  assert.equal(getSetNumber('photo_set_007'), 7);
  assert.equal(getSetNumber('photo_set_026'), 26);
  assert.equal(getSetNumber('remote_set_001'), 27);
  assert.equal(getSetNumber('remote_set_006'), 32);
  assert.equal(getSetNumber('photo_set_035'), 35);
  assert.equal(getSetNumber('photo_set_041'), 41);
  assert.equal(getSetNumber('set_3'), 3);
  assert.equal(getSetNumber('daily_set_12'), 12);
  assert.equal(getSetNumber('set4'), 4);
  assert.equal(getSetNumber(5), 5);
  assert.equal(getSetNumber(null), 1);
});

test('getDeterministicSetBaseline returns at least 3 competitive runners for any set', () => {
  const baselines = getDeterministicSetBaseline('photo_set_001');
  assert.ok(baselines.length >= 3);
  assert.ok(baselines[0].fastestTime < baselines[1].fastestTime);
  assert.ok(baselines[1].fastestTime < baselines[2].fastestTime);
  assert.ok(baselines[0].playerName.length > 0);
});

test('calculateSetWorldRank determines top 3 placement relative to set leaderboard', () => {
  const baselines = getDeterministicSetBaseline('photo_set_005');
  // Beating the #1 time should give world 1st
  const superFastTime = baselines[0].fastestTime - 500;
  assert.equal(calculateSetWorldRank('photo_set_005', superFastTime), 1);

  // Between #1 and #2 gives world 2nd
  const secondFastTime = Math.round((baselines[0].fastestTime + baselines[1].fastestTime) / 2);
  assert.equal(calculateSetWorldRank('photo_set_005', secondFastTime), 2);

  // Between #2 and #3 gives world 3rd
  const thirdFastTime = Math.round((baselines[1].fastestTime + baselines[2].fastestTime) / 2);
  assert.equal(calculateSetWorldRank('photo_set_005', thirdFastTime), 3);

  // Slower than #3 gives null
  const slowTime = baselines[2].fastestTime + 50000;
  assert.equal(calculateSetWorldRank('photo_set_005', slowTime), null);
});

test('parseSetSearch parses various search query formats', () => {
  assert.equal(parseSetSearch('5'), 'photo_set_005');
  assert.equal(parseSetSearch('Set 5'), 'photo_set_005');
  assert.equal(parseSetSearch('#5'), 'photo_set_005');
  assert.equal(parseSetSearch('set#12'), 'photo_set_012');
  assert.equal(parseSetSearch('photo_set_020'), 'photo_set_020');
  assert.equal(parseSetSearch('999'), null);
  assert.equal(parseSetSearch('hello'), null);
});

// --- seeded rival scores must stay tied to the scoring curve ---------------

test('seeded rivals stay competitive against the current scoring curve', () => {
  // The whole point of these numbers is to be beatable but not trivially so.
  // If the speed-scoring curve moves and these do not, every rival is passed by
  // a wide margin and the ranks stop meaning anything -- which is exactly what
  // happened when the opening value went from 500 to 1250.
  const SET_SIZE = 5;
  const perfectSet = SET_SIZE * calculateSpeedPoints(0);

  for (const setId of ['photo_set_001', 'photo_set_014', 'remote_set_003']) {
    const rivals = getDeterministicSetBaseline(setId);
    const top = Math.max(...rivals.map(r => r.mostPoints));
    const bottom = Math.min(...rivals.map(r => r.mostPoints));

    assert.ok(top < perfectSet,
      `${setId}: top rival ${top} must be beatable (perfect set is ${perfectSet})`);
    assert.ok(top > perfectSet * 0.75,
      `${setId}: top rival ${top} is trivially beaten (perfect set is ${perfectSet})`);
    assert.ok(bottom > perfectSet * 0.5,
      `${setId}: bottom rival ${bottom} is too far off the pace`);
  }
});

test('rival scores decrease down the board, matching their times', () => {
  const rivals = getDeterministicSetBaseline('photo_set_001');
  for (let i = 1; i < rivals.length; i++) {
    assert.ok(rivals[i].mostPoints < rivals[i - 1].mostPoints,
      'a slower rival must not out-score a faster one');
    assert.ok(rivals[i].fastestTime > rivals[i - 1].fastestTime);
  }
});

test('the baseline is deterministic for a given set', () => {
  const a = getDeterministicSetBaseline('photo_set_007');
  const b = getDeterministicSetBaseline('photo_set_007');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, getDeterministicSetBaseline('photo_set_008'));
});
