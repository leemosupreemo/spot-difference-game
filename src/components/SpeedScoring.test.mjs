import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(componentDirectory, '..', 'App.jsx'), 'utf8');
const canvasSource = fs.readFileSync(path.join(componentDirectory, 'GameCanvas.jsx'), 'utf8');

test('uses a speed score with a 25 point floor for both the score and popup', () => {
  assert.match(appSource, /calculateSpeedPoints\(elapsedTime\)/);
  assert.match(canvasSource, /pointsAwarded/);
  assert.doesNotMatch(canvasSource, /const bonusAmount = 300/);
});
