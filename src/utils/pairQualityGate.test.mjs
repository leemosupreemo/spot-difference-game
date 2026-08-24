import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePixelDifferences, enforceZeroDriftBackground } from './pairQualityGate.js';

test('analyzePixelDifferences detects single difference centroid and scale bounds', () => {
  const width = 100;
  const height = 100;
  const base = new Uint8ClampedArray(width * height * 4);
  const variant = new Uint8ClampedArray(width * height * 4);

  // Alter a 10x10 block centered around (50, 50)
  for (let y = 45; y < 55; y++) {
    for (let x = 45; x < 55; x++) {
      const idx = (y * width + x) * 4;
      variant[idx] = 255; // Red difference
    }
  }

  const result = analyzePixelDifferences(base, variant, width, height, 18);
  assert.equal(result.valid, true);
  assert.equal(Math.round(result.centroid.x), 50);
  assert.equal(Math.round(result.centroid.y), 50);
  assert.ok(result.diffAreaPercent > 0.5 && result.diffAreaPercent < 3.0);
});

test('enforceZeroDriftBackground clamps all pixels outside radius to exact base pixels', () => {
  const width = 100;
  const height = 100;
  const base = new Uint8ClampedArray(width * height * 4);
  const variant = new Uint8ClampedArray(width * height * 4);

  // Place accidental drift far away at (10, 10)
  const driftIdx = (10 * width + 10) * 4;
  variant[driftIdx] = 200;

  // Enforce zero-drift around intended center (50, 50) with radius 8%
  const clamped = enforceZeroDriftBackground(base, variant, width, height, 50, 50, 8);

  // The accidental drift at (10, 10) must be reset back to base (0)
  assert.equal(clamped[driftIdx], 0);
});
