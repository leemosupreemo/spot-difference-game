import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'SetOfTheDayBanner.jsx'
);

test('completed daily banner stays visible and shows the top three times', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /getDailyLeaderboard/);
  assert.match(source, /fetchDailyLeaderboard/);
  assert.match(source, /playerStatus\.completed \? 'Top 3 Today' : 'Time to Beat'/);
  assert.match(source, /topTimes\.slice\(0, 3\)|topTimes\.map/);
  assert.match(source, /!playerStatus\.completed && isAttempted/);
  assert.match(source, /border: '2px solid/);
  assert.match(source, /setOfTheDayBorderShift/);
  assert.match(source, /border-color: rgba\(0, 240, 255/);
});
