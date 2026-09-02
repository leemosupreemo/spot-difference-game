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
