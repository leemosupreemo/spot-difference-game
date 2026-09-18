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

test('ProgressModal My Progress summary labels its best-time stat as the fastest 1st attempt', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /FASTEST 1ST ATTEMPT/);
  // Must be driven purely by firstTime, not a mix that prefers fastestRepeat
  assert.match(source, /const bestOverallTimeMs = allSets\.reduce\(\(best, s\) => \{\s*const t = s\.firstTime;/);
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

  assert.match(source, />\s*Game Center\s*</);
  assert.match(source, /openGameCenterLeaderboard/);
  assert.match(source, /isGameCenterSupported\(\) && gameCenterAuthenticated/);
  assert.doesNotMatch(source, /openGameCenterAchievements/);
  assert.doesNotMatch(source, />\s*Achievements\s*</);
});

test('ProgressModal does not substitute a pack ranking when a selected Photo Set is empty', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /Once a Photo Set is selected, an empty set remains empty/);
  assert.match(source, /selectedLeaderboardPack === 'find_the_sniper' && selectedLeaderboardSet/);
});

test('ProgressModal reserves the Photo Set dropdown row height so switching to Abstract does not shift the table up', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  // The row wrapper (marginBottom + minHeight) must render unconditionally; only the <select>
  // itself is conditional on the Photography pack being active
  assert.match(source, /Photo Set Dropdown[\s\S]*?<div style=\{\{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', justifyContent: 'flex-start', minHeight: '40px' \}\}>\s*\{selectedLeaderboardPack === 'find_the_sniper'/);
});

test('ProgressModal renders daily challenge leaderboard limited to top 5', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /dailyBoard\.slice\(0,\s*5\)/);
  // The "Today's 3-Image Sequence" subtext under the heading has been removed
  assert.doesNotMatch(source, /3-Image Sequence/);
});

test('ProgressModal styles the daily leaderboard table like the other tables and drops the Date column', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  const dailyTableSection = source.slice(source.indexOf('Top 5 Times Table'), source.indexOf('MY PROGRESS VIEW'));

  assert.match(dailyTableSection, /background: 'rgba\(0,0,0,0\.3\)', borderRadius: '16px', overflowX: 'auto', border: '1px solid var\(--border-glass\)'/);
  assert.match(dailyTableSection, /background: 'rgba\(255,255,255,0\.06\)', color: 'var\(--text-muted\)', textAlign: 'left', borderBottom: '1px solid var\(--border-glass\)'/);
  assert.doesNotMatch(dailyTableSection, /textTransform: 'uppercase'/);
  assert.doesNotMatch(dailyTableSection, />DATE</);
  assert.doesNotMatch(dailyTableSection, />\s*Today\s*</);
  assert.match(dailyTableSection, /colSpan=\{3\}/);
});

test('ProgressModal renders global live leaderboard limited to top 25', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /topLeaderboardEntries\.slice\(0,\s*25\)/);
  // No "TOP 25" badge cluttering the header - the limit is just implicit in the list length
  assert.doesNotMatch(source, /TOP 25/);
});

test('ProgressModal renders 2 columns for individual set records', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /FASTEST 1ST ATTEMPT/);
  assert.match(source, /MOST POINTS PER ANY ATTEMPT/);
  assert.match(source, /isSetView \? 2 : 4/);
  // The first column's header must label the rank/player half of the cell, not just the
  // fastest-attempt time half - the data row itself packs both into one <td>
  assert.match(source, /RANK \/ PLAYER[\s\S]*?FASTEST 1ST ATTEMPT/);
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

test('ProgressModal renders Failed in neon pink when a first attempt is marked failed', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Verify detection of first attempt failure
  assert.match(source, /playerSet\?\.firstFailed \|\| playerSet\?\.firstTime === 'failed'/);
  assert.match(source, /const firstTimeStr = isFirstFailed\s*\?\s*'Failed'/);

  // Verify neon pink styling for failed status in set view and pack view
  assert.match(source, /color:\s*isFirstFailed \? 'var\(--accent-pink\)' : 'var\(--accent-gold\)'/);
});

