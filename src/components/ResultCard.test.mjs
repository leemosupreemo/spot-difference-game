import assert from 'node:assert/strict';
import test from 'node:test';
import { generateResultCardText } from '../utils/challengeMetrics.js';

test('shared result copy keeps time and link without the challenge slogan', () => {
  const text = generateResultCardText({ elapsedTimeMs: 2310, challengeUrl: 'https://example.com/play' });
  assert.match(text, /I spotted it in 2\.31 seconds\./);
  assert.doesNotMatch(text, /Top \d+%/);
  assert.match(text, /https:\/\/example.com\/play/);
  assert.doesNotMatch(text, /Can you beat me/);
});
