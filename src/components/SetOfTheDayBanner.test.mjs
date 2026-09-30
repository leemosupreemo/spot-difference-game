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

test('banner card does not apply translateY on hover so it does not shift up into header', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Verify transform is not applied conditionally on isHovered (e.g. translateY(-2px))
  assert.doesNotMatch(source, /transform:\s*isHovered/);
  assert.doesNotMatch(source, /translateY\(-/);
});

test('banner exposes past challenges calendar CTA when playerStatus.completed is true', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /onOpenDailyCalendar/);
  assert.match(source, /playerStatus\.completed \? \([\s\S]*?Past Days/);
  assert.match(source, /if \(onOpenDailyCalendar\) \{[\s\S]*onOpenDailyCalendar\(\)/);
});


