import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { calculateSpeedPoints } from '../utils/scoring.js';

const componentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(componentDirectory, '..', 'App.jsx'), 'utf8');
const canvasSource = fs.readFileSync(path.join(componentDirectory, 'GameCanvas.jsx'), 'utf8');

test('uses a speed score with a 25 point floor and displays speed popups', () => {
  assert.equal(calculateSpeedPoints(0), 500);
  assert.equal(calculateSpeedPoints(10000), 400);
  assert.equal(calculateSpeedPoints(60000), 25);

  assert.match(appSource, /calculateSpeedPoints/);
  assert.match(canvasSource, /speed-popup/);
});
