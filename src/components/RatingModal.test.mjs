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

test('RatingModal displays emoji choices ("Could be better" vs "Enjoying it") and personalized copy', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Title / emoji choices / prompt copy
  assert.match(source, /Enjoying Diff Hunter\?/);
  assert.match(source, /Could be better/);
  assert.match(source, /Enjoying it/);
  assert.match(source, /🙁/);
  assert.match(source, /😍/);

  // Top and bottom padding to prevent bleeding off screen; standardized viewport cap
  assert.match(source, /paddingTop: 'max\(env\(safe-area-inset-top\)/);
  assert.match(source, /paddingBottom: 'max\(env\(safe-area-inset-bottom\)/);
  assert.match(source, /maxHeight: 'calc\(100dvh - 32px\)'/);
});

test('RatingModal routes "Enjoying it" to the store review link and "Could be better" to support email feedback', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Rate path
  assert.match(source, /getAppStoreReviewUrl/);
  assert.match(source, /window\.open\(reviewUrl/);
  assert.match(source, /diff_hunter_rating_handled', 'rated'/);

  // Dismiss path
  assert.match(source, /diff_hunter_rating_handled', 'dismissed'/);
  assert.match(source, /import \{ recordRatingPromptDismissed \} from '\.\.\/services\/ratingPrompt'/);
  assert.match(source, /recordRatingPromptDismissed\(\)/);

  // Feedback path with support email and filterable title prefix
  assert.match(source, /support@thejauntcompany\.com/);
  assert.match(source, /\[Diff Hunter Feedback\]/);
  assert.match(source, /mailto:\$\{SUPPORT_EMAIL\}\?subject=/);
  assert.match(source, /diff_hunter_rating_handled', 'feedback'/);
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
  assert.match(appSource, /isRatingPromptPlatformSupported\(\)/);
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

  assert.match(appSource, /onTriggerRatingPrompt=\{/);
  assert.match(appSource, /setRatingModalInitialStep/);
  assert.match(appSource, /setRatingModalOpen\(true\)/);
  assert.match(appSource, /onPreviewRating=\{/);
});
