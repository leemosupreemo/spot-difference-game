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

test('RatingModal conforms to strict styling and layout specifications', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // 1) No small description text under "Enjoying Diff Hunter?"
  assert.doesNotMatch(source, /You're back for round two/);
  assert.doesNotMatch(source, /If you're having fun spotting/);

  // 2) No "App Store Review" label on top
  assert.doesNotMatch(source, /App Store Review/);

  // 3) Top and bottom padding to prevent bleeding off screen
  assert.match(source, /paddingTop: 'max\(env\(safe-area-inset-top\)/);
  assert.match(source, /paddingBottom: 'max\(env\(safe-area-inset-bottom\)/);
  assert.match(source, /maxHeight: 'min\(90vh/);

  // 5) No "Rate on App Store" button
  assert.doesNotMatch(source, />\s*Rate on App Store/);
});

test('RatingModal supports half-star selection and routes >= 4 to store and < 4 to support', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // 4) Half-star interactive selection & conditional routing
  assert.match(source, /star - 0\.5/);
  assert.match(source, /clipPath/);
  assert.match(source, /rating >= 4\.0/);
  assert.match(source, /onOpenSupport/);
});

test('App Store review link is dynamically configurable post-launch via appConfig', () => {
  const configSource = fs.readFileSync(appConfigPath, 'utf8');

  // 6) Dynamic OTA URL configuration
  assert.match(configSource, /getAppStoreReviewUrl/);
  assert.match(configSource, /setAppStoreReviewUrl/);
  assert.match(configSource, /syncRemoteAppConfig/);
  assert.match(configSource, /app_config/);
});

test('App.jsx tracks launch counts, connects support routing, and syncs remote config', () => {
  const appSource = fs.readFileSync(appPath, 'utf8');

  assert.match(appSource, /RatingModal/);
  assert.match(appSource, /syncRemoteAppConfig/);
  assert.match(appSource, /diff_hunter_launch_count/);
  assert.match(appSource, /count === 2 && !ratingHandled/);
  assert.match(appSource, /onOpenSupport/);
});
