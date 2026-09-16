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
  assert.match(source, /Today's Top 3/);
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
  assert.match(source, /\{!isFailed && \(\s*<div style=\{\{ marginBottom: '12px', display: 'flex'/);

  // Verify failure or forfeit limits displayed leaderboard to top 3 players
  assert.match(source, /leaderboardEntries\.slice\(0, 3\)/);
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
  assert.match(source, /!playerStatus\.completed && isAttempted/);
});

test('daily victory keeps failure details compact and exposes a top-three leaderboard', () => {
  const source = fs.readFileSync(dailyModalPath, 'utf8');

  assert.doesNotMatch(source, /Total 3-Image Time/);
  assert.doesNotMatch(source, /SET OF THE DAY COMPLETE!/);
  assert.match(source, /leaderboardEntries\.slice\(0, 3\)/);
  assert.match(source, /className="daily-victory-results-grid"/);
  assert.match(source, /aria-label="Share daily result"/);
  assert.match(source, /aria-label="Share daily result"[\s\S]*?width:\s*['"]40px['"]/);
});

test('daily success replaces rank and inline leaderboard with a link beside the hero time', () => {
  const source = fs.readFileSync(dailyModalPath, 'utf8');

  assert.doesNotMatch(source, /TODAY'S RANK/);
  assert.match(source, /aria-label="View daily leaderboard"/);
  assert.match(source, /Top \{Math\.max\(1, Math\.round\(100 - percentile\)\)\}%/);
  assert.match(source, /getDailyTimeToBeat/);
  assert.match(source, /aria-label="Share daily result"[\s\S]*?totalSecStr/);
  assert.match(source, /aria-label="View daily leaderboard"/);
});

test('daily forfeit hides button to left of main menu and lets main menu take full length', () => {
  const source = fs.readFileSync(dailyModalPath, 'utf8');

  assert.match(source, /isFailed && !isForfeit/);
  assert.match(source, /Main Menu/);
  assert.match(source, /width:\s*['"]100%['"]/);
});
