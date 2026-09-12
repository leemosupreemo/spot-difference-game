import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'App.jsx'
);

test('App.jsx defines essential state variables including view and incomingChallenge', () => {
  const source = fs.readFileSync(appPath, 'utf8');

  // Verify view state is properly declared
  assert.match(source, /const\s*\[\s*view\s*,\s*setView\s*\]\s*=\s*useState\(['"]menu['"]\)/);

  // Verify incomingChallenge state is properly declared
  assert.match(source, /const\s*\[\s*incomingChallenge\s*,\s*setIncomingChallenge\s*\]\s*=/);

  // Verify view transitions and routing exist
  assert.match(source, /view\s*===\s*['"]menu['"]/);
  assert.match(source, /view\s*===\s*['"]stats['"]/);
  assert.match(source, /view\s*===\s*['"]creator['"]/);
  assert.match(source, /view\s*===\s*['"]game['"]/);
});

test('App.jsx tracks hasCompletedFirstSetState and passes it to MainMenu', () => {
  const source = fs.readFileSync(appPath, 'utf8');

  assert.match(source, /hasCompletedFirstSetState/);
  assert.match(source, /hasCompletedFirstSet=\{hasCompletedFirstSetState\}/);
  assert.match(source, /markFirstSetCompleted\(\)/);
});

test('Scores opens My Progress as the active default tab', () => {
  const source = fs.readFileSync(appPath, 'utf8');

  assert.match(source, /const handleOpenLeaderboard = \(\) => \{\s*setStatsInitialTab\('progress'\)/);
  assert.match(source, /onOpenStats=\{\(\) => \{\s*setStatsInitialTab\('progress'\)/);
});

test('standard Photo Mode does not fall back to generated abstract levels', () => {
  const source = fs.readFileSync(appPath, 'utf8');

  assert.match(source, /setId:\s*photoSetId/);
  assert.doesNotMatch(source, /\[StartGame:Fallback\]/);
});

test('Photo Mode offers only complete Photography sets and blocks an invalid selection', () => {
  const source = fs.readFileSync(appPath, 'utf8');

  assert.match(source, /filter\(entry => entry\.packId === 'find_the_sniper'\)/);
  assert.match(source, /if \(!photoSetId \|\| !photoSetIds\.includes\(photoSetId\)\)/);
});

test('App.jsx gates SetOfTheDayBanner behind !isDailyCompleted and routes daily failure to DailyVictoryModal', () => {
  const source = fs.readFileSync(appPath, 'utf8');

  // Gated banner (always shows in debug mode)
  assert.match(source, /\{\s*\(\s*!isDailyCompleted \|\| debugMode\s*\) && \(\s*<SetOfTheDayBanner/);
  assert.match(source, /setIsDailyCompleted\(true\)/);

  // Daily failure routes to DailyVictoryModal instead of GameOverModal
  assert.match(source, /if \(gameMode === 'daily'\) \{/);
  assert.match(source, /isFailed:\s*true/);
  assert.match(source, /isFailed=\{dailyVictoryData\?\.isFailed\}/);
});

test('debug daily mode uses the three-image queue set and reaches the daily victory path', () => {
  const source = fs.readFileSync(appPath, 'utf8');

  assert.match(source, /\[StartDailyChallenge:Debug\][\s\S]*dailyLevels = getDailySetForDate\(\)/);
  assert.match(source, /if \(debugMode\) \{[\s\S]*syncRemoteDailyQueue\(\)\.catch/);
  assert.doesNotMatch(source, /await syncRemoteDailyQueue/);
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*setVictoryModalOpen\(true\)/);
  assert.match(source, /if \(gameMode === 'daily'\) \{[\s\S]*setDailyVictoryData\(/);
});
