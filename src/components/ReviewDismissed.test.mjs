import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const menu = fs.readFileSync(new URL('./MainMenu.jsx', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../utils/photoPairLevelLoader.js', import.meta.url), 'utf8');

test('dismissed levels stay hidden unless explicitly asked for', () => {
  // The default must not change: dismissed levels are invisible everywhere.
  assert.match(loader, /includeDismissed = false/);
  // Placeholders are exempt: they are structural slots with no artwork to
  // judge, and honouring a dismissal on one would break its set.
  assert.match(loader,
    /if \(statusVal === 'dismissed' && !includeDismissed && !isPlaceholderEntry\(entry\)\) continue;/);
});

test('review mode shows only what was dismissed', () => {
  // Reviewing dismissals is the inverse of curation -- a pool mixing them with
  // live levels would make it impossible to tell what is being reconsidered.
  assert.match(app, /if \(dismissedOnly\) \{[\s\S]*?if \(statusVal !== 'dismissed'\) continue;/);
  assert.match(app, /getAllPhotoPairEntries\(\{ includeDismissed: dismissedOnly \}\)/);
});

test('an empty dismissed pool is not papered over with the normal pool', () => {
  // The fallback exists so debug is never empty, but here an empty result is
  // the answer: nothing was dismissed.
  assert.match(app, /if \(reviewDismissedLevels\) return pool;/);
});

test('the toggle is debug-only and announces its state', () => {
  assert.match(menu, /aria-label="Review Dismissed Levels"/);
  assert.match(menu, /aria-pressed=\{reviewDismissedLevels\}/);
  assert.match(menu, /\{debugMode && \(\s*\n\s*<button[\s\S]*?Review Dismissed Levels/);
});

test('the button reports how many are still recoverable', () => {
  // Once pruned they are gone, so the count is the remaining window.
  assert.match(menu, /REVIEW DISMISSED \(\$\{dismissedCount\}\)/);
  assert.match(menu, /disabled=\{!reviewDismissedLevels && dismissedCount === 0\}/);
  assert.match(app, /dismissedAvailableCount/);
  assert.match(app, /includeDismissed: true/);
});

test('the pool recomputes when the review mode or a decision changes', () => {
  assert.match(app, /\}, \[debugMode, curatedStatusMap, skipKeptLevels, reviewDismissedLevels\]\);/);
});
