import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePercentileRank,
  checkAndUpdatePersonalBest,
  generateChallengeUrl,
  generateChallengeText,
  parseIncomingChallenge,
  getShareStats,
  recordLocalShareEvent
} from './challengeMetrics.js';

test('calculatePercentileRank calculates accurate top and beat percentiles for fast and normal times', () => {
  // Ultra fast 1.5s single pair
  const elite = calculatePercentileRank(1500, 'Medium', false);
  assert.equal(elite.topPercentile, 1);
  assert.equal(elite.beatPercentile, 99);
  assert.match(elite.rankLabel, /TOP 1%/);

  // 2.4s single pair
  const topTier = calculatePercentileRank(2400, 'Medium', false);
  assert.equal(topTier.topPercentile, 6);
  assert.equal(topTier.beatPercentile, 94);

  // Slower 12s single pair
  const slow = calculatePercentileRank(12000, 'Medium', false);
  assert.equal(slow.topPercentile, 85);
  assert.equal(slow.beatPercentile, 15);

  // 5-image stage cumulative time
  const stageFast = calculatePercentileRank(14000, 'Medium', true);
  assert.equal(stageFast.topPercentile, 5);
  assert.equal(stageFast.beatPercentile, 95);
});

test('checkAndUpdatePersonalBest tracks new records correctly', () => {
  // Clear any existing localStorage mock if needed
  const res1 = checkAndUpdatePersonalBest(3500, 'Medium', 'test_theme', false);
  assert.equal(typeof res1.isPersonalBest, 'boolean');

  const res2 = checkAndUpdatePersonalBest(2100, 'Medium', 'test_theme', false);
  assert.equal(res2.isPersonalBest, true);
});

test('generateChallengeUrl creates universal deep link with challenge params', () => {
  const url = generateChallengeUrl({
    elapsedTimeMs: 2430,
    playerName: 'Alex',
    difficulty: 'Medium',
    themeId: 'find_the_sniper',
    levelId: 'pair_123'
  });

  assert.match(url, /challenge=1/);
  assert.match(url, /time=2\.43/);
  assert.match(url, /challenger=Alex/);
  assert.match(url, /diff=Medium/);
  assert.match(url, /theme=find_the_sniper/);
  assert.match(url, /levelId=pair_123/);
});

test('generateChallengeText formats viral challenge copy', () => {
  const text = generateChallengeText({
    elapsedTimeMs: 2430,
    beatPercentile: 93,
    isPersonalBest: true,
    playerName: 'Alex',
    challengeUrl: 'https://example.com/play?c=1'
  });

  assert.match(text, /I spotted it in 2\.43 seconds/);
  assert.doesNotMatch(text, /Can you beat me/);
  assert.match(text, /NEW PERSONAL BEST/);
  assert.match(text, /beat 93% of Diff Hunter players/);
  assert.match(text, /There is ONE difference/);
  assert.match(text, /https:\/\/example\.com\/play\?c=1/);
});

test('parseIncomingChallenge parses query string parameters properly', () => {
  const parsed = parseIncomingChallenge('?challenge=1&time=2.43&challenger=Neemaa&diff=Hard&theme=abstract_animated&levelId=lvl_456');

  assert.ok(parsed);
  assert.equal(parsed.isChallenge, true);
  assert.equal(parsed.challengerName, 'Neemaa');
  assert.equal(parsed.targetTimeSec, 2.43);
  assert.equal(parsed.targetTimeMs, 2430);
  assert.equal(parsed.difficulty, 'Hard');
  assert.equal(parsed.themeId, 'abstract_animated');
  assert.equal(parsed.levelId, 'lvl_456');

  const nonChallenge = parseIncomingChallenge('?page=about');
  assert.equal(nonChallenge, null);
});

test('getShareStats and recordLocalShareEvent compute share rate cleanly', () => {
  const stats = getShareStats();
  assert.equal(typeof stats.resultViews, 'number');
  assert.equal(typeof stats.shareTaps, 'number');
  assert.equal(typeof stats.sharesCompleted, 'number');
  assert.equal(typeof stats.shareRate, 'number');
});

test('native and localhost challenge URLs use the public playable game', () => {
  const previous = globalThis.window;
  try {
    for (const origin of ['capacitor://localhost', 'http://localhost:5173', 'null']) {
      globalThis.window = { location: { origin } };
      const url = new URL(generateChallengeUrl({ elapsedTimeMs: 35000, playerName: 'Alex' }));
      assert.equal(url.origin, 'https://diffhunter.web.app');
      assert.equal(parseIncomingChallenge(url.search).targetTimeMs, 35000);
    }
  } finally { globalThis.window = previous; }
});
