import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateStarRating,
  checkAndUpdatePersonalBest,
  generateChallengeUrl,
  generateChallengeText,
  parseIncomingChallenge,
  getShareStats,
  recordLocalShareEvent
} from './challengeMetrics.js';

test('calculateStarRating awards more stars for faster times', () => {
  // Ultra fast single pair
  assert.equal(calculateStarRating(1500, 'Medium', false), 3);

  // Mid-pack single pair
  assert.equal(calculateStarRating(5000, 'Medium', false), 2);

  // Slower single pair
  assert.equal(calculateStarRating(12000, 'Medium', false), 1);

  // Fast 5-image stage cumulative time
  assert.equal(calculateStarRating(14000, 'Medium', true), 3);

  // Slower stage cumulative time
  assert.equal(calculateStarRating(60000, 'Medium', true), 1);
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
    isPersonalBest: true,
    playerName: 'Alex',
    challengeUrl: 'https://example.com/play?c=1'
  });

  assert.match(text, /Alex spotted it in 2\.43 seconds/);
  assert.doesNotMatch(text, /Can you beat me/);
  assert.doesNotMatch(text, /Top \d+%/);
  assert.doesNotMatch(text, /beat \d+% of/i);
  assert.match(text, /NEW PERSONAL BEST/);
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
