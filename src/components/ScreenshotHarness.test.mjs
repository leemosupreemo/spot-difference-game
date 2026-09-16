import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SCREENSHOT_MODALS } from './screenshotModals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(here, '../../scripts/capture_modal_screenshots.mjs');

test('ScreenshotHarness defines complete coverage of modals and special menus', () => {
  assert.ok(Array.isArray(SCREENSHOT_MODALS), 'SCREENSHOT_MODALS must be an array');
  assert.ok(SCREENSHOT_MODALS.length >= 20, `Expected at least 20 modal configurations, found ${SCREENSHOT_MODALS.length}`);

  const ids = SCREENSHOT_MODALS.map(m => m.id);

  // 1. Offline states
  assert.ok(ids.includes('offline-banner'), 'Must include offline warning banner');
  assert.ok(ids.includes('victory-offline'), 'Must include victory offline notice');
  assert.ok(ids.includes('progress-offline'), 'Must include progress modal offline notice');

  // 2. Daily Challenge states
  assert.ok(ids.includes('daily-banner-unattempted'), 'Must include daily banner active state');
  assert.ok(ids.includes('daily-banner-completed'), 'Must include daily banner completed state');
  assert.ok(ids.includes('daily-victory-success'), 'Must include daily victory success');
  assert.ok(ids.includes('daily-victory-failed'), 'Must include daily victory failed');
  assert.ok(ids.includes('daily-victory-forfeited'), 'Must include daily victory forfeited');
  assert.ok(ids.includes('daily-victory-name-editing'), 'Must include daily victory name editing');
  assert.ok(ids.includes('confirm-exit-daily'), 'Must include daily forfeit confirmation modal');

  // 3. New record, leaderboard, name editing, fanfare
  assert.ok(ids.includes('victory-standard'), 'Must include standard victory');
  assert.ok(ids.includes('victory-world-1st'), 'Must include world 1st placement');
  assert.ok(ids.includes('victory-new-record'), 'Must include new personal best');
  assert.ok(ids.includes('victory-leaderboard'), 'Must include leaderboard qualified banner');
  assert.ok(ids.includes('victory-name-editing'), 'Must include writing in name for leaderboard');
  assert.ok(ids.includes('victory-fanfare'), 'Must include golden fanfare celebration');

  // 4. Other core modals
  assert.ok(ids.includes('game-over'), 'Must include game over stage failed modal');
  assert.ok(ids.includes('confirm-exit-standard'), 'Must include standard confirm exit modal');
  assert.ok(ids.includes('share-challenge'), 'Must include share challenge modal');
  assert.ok(ids.includes('help'), 'Must include help modal');
  assert.ok(ids.includes('rating'), 'Must include rating modal');
  assert.ok(ids.includes('progress-leaderboards'), 'Must include progress global leaderboard');
  assert.ok(ids.includes('progress-daily'), 'Must include progress daily challenge tab');
  assert.ok(ids.includes('progress-my-progress'), 'Must include progress my progress tab');

  // Verify all items have required metadata
  for (const item of SCREENSHOT_MODALS) {
    assert.ok(item.id, 'item.id is required');
    assert.ok(item.name, `item.name is required for ${item.id}`);
    assert.ok(item.description, `item.description is required for ${item.id}`);
    assert.ok(item.category, `item.category is required for ${item.id}`);
  }
});

test('capture_modal_screenshots script exists and references valid output directory and report', () => {
  assert.ok(fs.existsSync(scriptPath), 'capture_modal_screenshots.mjs must exist');
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(source, /SCREENSHOT_MODALS/);
  assert.match(source, /screenshots\/modals/);
  assert.match(source, /puppeteer/);
  assert.match(source, /index\.html/);
});
