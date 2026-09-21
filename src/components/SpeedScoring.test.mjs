import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { calculateSpeedPoints } from '../utils/scoring.js';

const componentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(componentDirectory, '..', 'App.jsx'), 'utf8');
const canvasSource = fs.readFileSync(path.join(componentDirectory, 'GameCanvas.jsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(componentDirectory, '..', 'index.css'), 'utf8');
const progressModalSource = fs.readFileSync(path.join(componentDirectory, 'ProgressModal.jsx'), 'utf8');

test('uses dynamic countdown speed score, clean hollow hit marker, and displays points on stats screen', () => {
  assert.equal(calculateSpeedPoints(0), 1250);
  // Unchanged rate: still 10 points a second.
  assert.equal(calculateSpeedPoints(10000), 1150);
  assert.equal(calculateSpeedPoints(60000), 650);
  // Unchanged floor, now reached at 122.5s rather than 47.5s.
  assert.equal(calculateSpeedPoints(122500), 25);
  assert.equal(calculateSpeedPoints(600000), 25);
  // Negative or zero elapsed time cannot exceed the opening value.
  assert.equal(calculateSpeedPoints(-5000), 1250);

  assert.match(appSource, /calculateSpeedPoints/);
  assert.match(canvasSource, /calculateSpeedPoints\(elapsedTime\)/);
  assert.match(canvasSource, /speed-popup/);
  assert.match(cssSource, /\.hit-marker[\s\S]*?background:\s*transparent;/);
  assert.match(progressModalSource, /TOTAL POINTS/);
  assert.match(progressModalSource, /AVG PTS \/ SET/);
});
