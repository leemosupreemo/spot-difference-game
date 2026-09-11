import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dailyModalPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'DailyVictoryModal.jsx'
);

const bannerPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'SetOfTheDayBanner.jsx'
);

test('DailyVictoryModal renders top times list and supports failure state', () => {
  const source = fs.readFileSync(dailyModalPath, 'utf8');

  // Verify top times list rendering
  assert.match(source, /getDailyLeaderboard/);
  assert.match(source, /Today's Top Times/);
  assert.match(source, /leaderboardEntries/);

  // Verify failure state handling instead of basic stage failed
  assert.match(source, /isFailed/);
  assert.match(source, /DAILY CHALLENGE RUN ENDED/);
  assert.doesNotMatch(source, /3 Strikes/);

  // Verify Try Again is completely removed (no try again options for daily challenge)
  assert.doesNotMatch(source, /Try Again/);
  assert.doesNotMatch(source, /1 attempt per day/);

  // Verify tapping outside modal invokes onClose and card propagation is stopped
  assert.match(source, /stopPropagation\(\)/);
  assert.match(source, /if \(onClose\) onClose\(\)/);

  // Verify time reached is not mentioned on failure
  assert.doesNotMatch(source, /Time Reached/);
  assert.match(source, /\{!isFailed && \(\s*<div style=\{\{ marginBottom: '12px' \}\}>\s*<div[\s\S]*?Total 3-Image Time/);

  // Verify failure or forfeit limits displayed leaderboard to top 3 players
  assert.match(source, /isFailed \|\| isForfeit \? leaderboardEntries\.slice\(0, 3\)/);
  assert.match(source, /Today's Top 3/);

  // Verify anonymous player tag editing and live leaderboard
  assert.match(source, /fetchDailyLeaderboard/);
  assert.match(source, /updateDailyPlayerName/);
  assert.match(source, /Your Hunter Tag/);
  assert.match(source, /customPlayerName/);
});

test('SetOfTheDayBanner does not show once completed or attempted', () => {
  const source = fs.readFileSync(bannerPath, 'utf8');

  assert.match(source, /playerStatus\.completed/);
  assert.match(source, /playerStatus\.attempted/);
  assert.match(source, /isAttempted/);
  assert.match(source, /if \(!enabled \|\| \(!forceShow && !debugMode && isAttempted\)\) return null;/);
});
