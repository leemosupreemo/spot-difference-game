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
  assert.match(source, /placeholder="Enter name"/);
  assert.match(source, /customPlayerName/);

  // Tag entry is arcade style: it only appears once a Top 3 record is set, not on every success
  assert.match(source, /\{isLeaderboardRecord && bannerPhase !== 'hidden' && \(/);
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
  assert.match(source, /margin:\s*['"]-12px 0 14px 0['"]/);
  // The header used to reserve its right-hand clearance with paddingRight;
  // the third grid track does that now, and DailyForfeitHeader.test.jsx owns
  // the centring it exists for.
  assert.match(source, /gridTemplateColumns:\s*['"]1fr auto 1fr['"]/);
});

test('daily success replaces rank and inline leaderboard with a link beside the hero time', () => {
  const source = fs.readFileSync(dailyModalPath, 'utf8');

  assert.doesNotMatch(source, /TODAY'S RANK/);
  assert.match(source, /aria-label="View daily leaderboard"/);
  assert.doesNotMatch(source, /[Pp]ercentile/);
  assert.match(source, /aria-label="Share daily result"[\s\S]*?totalSecStr/);
  assert.match(source, /aria-label="View daily leaderboard"/);
});

test('daily failure footer has no leaderboard button beside main menu, which takes full length', () => {
  const source = fs.readFileSync(dailyModalPath, 'utf8');

  assert.doesNotMatch(source, /Daily Board/);
  assert.match(source, /Main Menu/);
  assert.match(source, /width:\s*['"]100%['"]/);
});
