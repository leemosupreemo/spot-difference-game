import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'ProgressModal.jsx'
);

test('ProgressModal renders 4-column Live Leaderboard table with centered FASTEST TIME', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Verify all 4 column headers
  assert.match(source, /RANK \/ PLAYER/);
  assert.match(source, /★ AVG 1ST ATTEMPT/);
  assert.match(source, /AVG OVERALL/);
  assert.match(source, /FASTEST TIME/);

  // Verify FASTEST TIME is centered in both header and cell
  assert.match(source, /<th[^>]*textAlign:\s*'center'[^>]*>FASTEST TIME<\/th>/);
  assert.match(source, /<td[^>]*textAlign:\s*'center'[^>]*color:\s*'var\(--accent-cyan\)'[^>]*>\s*\{fastestTimeStr\}\s*<\/td>/);

  // Verify ★ AVG 1ST ATTEMPT has golden highlight column styling
  assert.match(source, /background:\s*'rgba\(255, 183, 3, 0\.14\)'/);
});

test('ProgressModal omits removed deprecated labels and footer texts', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Verify removed explanatory footer note
  assert.doesNotMatch(source, /Leaderboard rankings are anchored by/i);

  // Verify removed CATEGORY BREAKDOWN h3 heading
  assert.doesNotMatch(source, /CATEGORY BREAKDOWN/);
});

test('ProgressModal renders Category Breakdown table with clean columns', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /CATEGORY/);
  assert.match(source, /CLEARED/);
  assert.match(source, /TOTAL PTS/);
  assert.match(source, /AVG \/ SET/);
  assert.match(source, /BEST TIME/);
});

test('ProgressModal exposes one Game Center leaderboard action beside the heading', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /View in Game Center/);
  assert.match(source, /openGameCenterLeaderboard/);
  assert.doesNotMatch(source, /openGameCenterAchievements/);
  assert.doesNotMatch(source, />\s*Achievements\s*</);
});

test('ProgressModal does not substitute a pack ranking when a selected Photo Set is empty', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /Once a Photo Set is selected, an empty set remains empty/);
  assert.match(source, /selectedLeaderboardPack === 'find_the_sniper' && selectedLeaderboardSet/);
});

test('ProgressModal renders daily challenge leaderboard limited to top 5', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /Fastest 5 Times/);
  assert.doesNotMatch(source, /Fastest 20 Times/);
  assert.match(source, /dailyBoard\.slice\(0,\s*5\)/);
});

test('ProgressModal renders global live leaderboard limited to top 25', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /TOP 25/);
  assert.match(source, /topLeaderboardEntries\.slice\(0,\s*25\)/);
});

test('ProgressModal renders 2 columns for individual set records', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /FASTEST 1ST ATTEMPT/);
  assert.match(source, /MOST POINTS PER ANY ATTEMPT/);
  assert.match(source, /isSetView \? 2 : 4/);
});

test('ProgressModal detects offline mode and displays indicator banner with retry action', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Network detection and subscriptions
  assert.match(source, /isOnline/);
  assert.match(source, /subscribeNetworkStatus/);
  assert.match(source, /isOfflineMode/);

  // Offline banner rendering and copy
  assert.match(source, /leaderboard-offline-banner/);
  assert.match(source, /Offline Mode:/);
  assert.match(source, /Showing cached leaderboards\. New records will sync once reconnected\./);

  // Retry action when network is restored
  assert.match(source, /handleRetryFetch/);
  assert.match(source, /<RefreshCw/);
  assert.match(source, /Retry/);
});

