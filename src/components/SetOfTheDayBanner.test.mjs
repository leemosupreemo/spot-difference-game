import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'SetOfTheDayBanner.jsx'
);

test('completed daily banner stays visible and shows the top time with no tap to improve text', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /getDailyLeaderboard/);
  assert.match(source, /fetchDailyLeaderboard/);
  assert.match(source, /playerStatus\.completed \? 'Top Time' : 'Time to Beat'/);
  assert.match(source, /topTimeSec/);
  assert.doesNotMatch(source, /Tap to improve/i);
  assert.doesNotMatch(source, /Cleared in/i);
  assert.doesNotMatch(source, /Top 3 Today/);
  assert.match(source, /!playerStatus\.completed && isAttempted/);
  assert.match(source, /border: '2px solid/);
  assert.match(source, /setOfTheDayBorderShift/);
  assert.match(source, /border-color: rgba\(0, 240, 255/);
});

