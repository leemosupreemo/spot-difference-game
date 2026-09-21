import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'RatingModal.jsx'
);

const appPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'App.jsx'
);

const appConfigPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'services',
  'appConfig.js'
);

const ratingPromptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'services',
  'ratingPrompt.js'
);

test('RatingModal follows the cheatsheet copy and layout', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Title / body / CTAs exactly as specified
  assert.match(source, /Enjoying the game\?/);
  assert.match(source, /A quick rating really helps us out\./);
  assert.match(source, />\s*Rate the Game\s*</);
  assert.match(source, />\s*Maybe Later\s*</);

  // No interactive star picker or feedback-routing left over from the old design
  assert.doesNotMatch(source, /handleSelectRating/);
  assert.doesNotMatch(source, /onOpenSupport/);
  assert.doesNotMatch(source, /star - 0\.5/);
  assert.doesNotMatch(source, />\s*Rate on App Store/);
  assert.doesNotMatch(source, /App Store Review/);

  // Top and bottom padding to prevent bleeding off screen; standardized viewport cap
  assert.match(source, /paddingTop: 'max\(env\(safe-area-inset-top\)/);
  assert.match(source, /paddingBottom: 'max\(env\(safe-area-inset-bottom\)/);
  assert.match(source, /maxHeight: 'calc\(100dvh - 32px\)'/);
});

test('RatingModal rate action opens the store link and dismiss schedules a retry window', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /getAppStoreReviewUrl/);
  assert.match(source, /window\.open\(reviewUrl/);
  assert.match(source, /diff_hunter_rating_handled', 'rated'/);
  assert.match(source, /diff_hunter_rating_handled', 'dismissed'/);
  assert.match(source, /import \{ recordRatingPromptDismissed \} from '\.\.\/services\/ratingPrompt'/);
  assert.match(source, /recordRatingPromptDismissed\(\)/);
});

test('App Store review link is dynamically configurable post-launch via appConfig', () => {
  const configSource = fs.readFileSync(appConfigPath, 'utf8');

  assert.match(configSource, /getAppStoreReviewUrl/);
  assert.match(configSource, /setAppStoreReviewUrl/);
  assert.match(configSource, /syncRemoteAppConfig/);
  assert.match(configSource, /app_config/);
});

test('App.jsx shows the rating prompt only after a successful-round return to the menu', () => {
  const appSource = fs.readFileSync(appPath, 'utf8');

  assert.match(appSource, /RatingModal/);
  assert.match(appSource, /syncRemoteAppConfig/);

  // Counts a "successful round" as a full stage/set win, not per launch
  assert.match(appSource, /incrementSuccessfulRounds\(\)/);
  assert.match(appSource, /justWonRoundRef\.current = true/);

  // Gated on landing back on the menu after that win, never mid-game
  assert.match(appSource, /if \(view !== 'menu' \|\| !justWonRoundRef\.current\) return;/);
  assert.match(appSource, /shouldShowRatingPrompt\(/);

  // The old "second launch" trigger is gone
  assert.doesNotMatch(appSource, /count === 2 && !ratingHandled/);
  assert.doesNotMatch(appSource, /onOpenSupport/);
});

test('ratingPrompt service implements the cheatsheet eligibility rules', () => {
  const source = fs.readFileSync(ratingPromptPath, 'utf8');

  assert.match(source, /export function incrementSuccessfulRounds/);
  assert.match(source, /export function shouldShowRatingPrompt/);
  assert.match(source, /export function recordRatingPromptShown/);
  assert.match(source, /export function recordRatingPromptDismissed/);

  // First attempt at >= 5 successful rounds
  assert.match(source, /FIRST_ATTEMPT_ROUND_THRESHOLD = 5/);
  // Retry only after 10-20 more rounds
  assert.match(source, /RETRY_BONUS_ROUNDS_MIN = 10/);
  assert.match(source, /RETRY_BONUS_ROUNDS_MAX = 20/);
  // Caps at two attempts total
  assert.match(source, /MAX_ATTEMPTS = 2/);
  // Already-rated players are never prompted again
  assert.match(source, /handledType === 'rated'/);
});

test('App.jsx provides debug rating prompt triggers to MainMenu and DiagnosticsModal', () => {
  const appSource = fs.readFileSync(appPath, 'utf8');

  assert.match(appSource, /onTriggerRatingPrompt=\{\(\) => setRatingModalOpen\(true\)\}/);
  assert.match(appSource, /onPreviewRating=\{\(\) => \{\s*setDiagnosticsModalOpen\(false\);\s*setRatingModalOpen\(true\);\s*\}\}/);
});
