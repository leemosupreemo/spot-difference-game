import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'VictoryModal.jsx'
);

test('contains a fail-safe around the native victory celebration effect', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /try \{[\s\S]*confetti\(/);
  assert.match(source, /catch \(error\) \{[\s\S]*Victory celebration unavailable/);
});

test('triggers fanfare and golden confetti when an image set is completed with 3 stars', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Confirms fanfare sound invocation
  assert.match(source, /sounds\.playFanfare\(/);

  // Confirms golden color palette for 3-star completion
  assert.match(source, /goldenColors\s*=\s*\[/);
  assert.match(source, /#FFD700/);
  assert.match(source, /#FFA500/);
  assert.match(source, /isThreeStars\s*\?\s*goldenColors\s*:\s*standardColors/);
});

test('displays Next Stage button and folds Accuracy into the detail list instead of a standalone breakdown grid', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /Next Stage/);
  assert.doesNotMatch(source, /Next Pair/);
  // Accuracy now lives as a row in the same detail list as Set # / Attempt #, not an uppercase
  // label in a separate 3-column Performance Breakdown Grid
  assert.match(source, />Accuracy<\/span>/);
  assert.doesNotMatch(source, /ACCURACY/);
  assert.doesNotMatch(source, /MISSES/);
});

test('uses the compact share sheet and star rating benchmark', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /calculateStarRating/);
  assert.match(source, /<ShareChallengeModal/);
  assert.match(source, /trackResultScreenViewed/);
  assert.doesNotMatch(source, /PERFORMANCE BENCHMARK/);
  assert.doesNotMatch(source, /[Pp]ercentile/);
});

test('keeps Stage Clear actions compact and focused on the next stage', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.doesNotMatch(source, />\s*<RotateCcw[^>]*\/>\s*Retry/);
  assert.match(source, /aria-label="Share result"/);
  assert.match(source, /width: '100%'[\s\S]*Next Stage/);
  assert.match(source, /Return to Menu[\s\S]*?Next Stage/);
  assert.match(source, /onClick=\{\(\) => handleLeaveResult\(onNextLevel\)\}/);
});

test('calculates World Top 3 rank and displays World 1st/2nd/3rd title with gold/silver/bronze trophy', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /calculateSetWorldRank/);
  assert.match(source, /worldRank === 1[\s\S]*World 1st![\s\S]*#FFD700/);
  assert.match(source, /worldRank === 2[\s\S]*World 2nd![\s\S]*#E0E0E0/);
  assert.match(source, /worldRank === 3[\s\S]*World 3rd![\s\S]*#CD7F32/);
  assert.doesNotMatch(source, /\(world 1st!\)/);
});

test('supports different levels of fanfare with fireworks for leaderboard records and personal best', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Confirms tiered fanfare and fireworks logic
  assert.match(source, /isLeaderboardRecord/);
  assert.match(source, /isPb/);
  assert.match(source, /goldenFireworksColors/);
  assert.match(source, /pbFireworksColors/);
  assert.match(source, /sounds\.playFanfare\(displayStars,\s*\{\s*isLeaderboardRecord,\s*isPersonalBest:\s*isPb\s*\}\)/);
});
