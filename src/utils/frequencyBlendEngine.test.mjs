import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSSIM,
  applyLaplacianFrequencyMutation
} from './frequencyBlendEngine.js';

test('calculateSSIM returns 1.0 for identical image data', () => {
  const dataA = new Uint8ClampedArray(100 * 4);
  const dataB = new Uint8ClampedArray(100 * 4);
  for (let i = 0; i < dataA.length; i += 4) {
    dataA[i] = 120;
    dataA[i + 1] = 130;
    dataA[i + 2] = 140;
    dataA[i + 3] = 255;

    dataB[i] = 120;
    dataB[i + 1] = 130;
    dataB[i + 2] = 140;
    dataB[i + 3] = 255;
  }

  const ssim = calculateSSIM(dataA, dataB);
  assert.ok(ssim >= 0.999, `SSIM should be ~1.0 for identical data, got ${ssim}`);
});

test('calculateSSIM returns lower score for distinctly different data', () => {
  const dataA = new Uint8ClampedArray(100 * 4);
  const dataB = new Uint8ClampedArray(100 * 4);
  for (let i = 0; i < dataA.length; i += 4) {
    dataA[i] = 10;
    dataA[i + 1] = 10;
    dataA[i + 2] = 10;
    dataA[i + 3] = 255;

    dataB[i] = 240;
    dataB[i + 1] = 240;
    dataB[i + 2] = 240;
    dataB[i + 3] = 255;
  }

  const ssim = calculateSSIM(dataA, dataB);
  assert.ok(ssim < 0.20, `SSIM should be low for inverted data, got ${ssim}`);
});

test('calculateSSIM handles length mismatch gracefully', () => {
  const dataA = new Uint8ClampedArray(20);
  const dataB = new Uint8ClampedArray(40);
  const ssim = calculateSSIM(dataA, dataB);
  assert.equal(ssim, 0);
});

test('applyLaplacianFrequencyMutation modifies target hotspot and preserves boundary', () => {
  const width = 50;
  const height = 50;
  const data = new Uint8ClampedArray(width * height * 4);

  // Fill with uniform texture
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100;
    data[i + 1] = 150;
    data[i + 2] = 200;
    data[i + 3] = 255;
  }

  const imageData = {
    data,
    width,
    height
  };

  const mutated = applyLaplacianFrequencyMutation(imageData, 25, 25, 8, width, height);
  assert.ok(mutated);
  assert.equal(mutated.data.length, data.length);

  // Check center has mutated
  const centerIdx = (25 * width + 25) * 4;
  const centerChanged = (
    mutated.data[centerIdx] !== 100 ||
    mutated.data[centerIdx + 1] !== 150 ||
    mutated.data[centerIdx + 2] !== 200
  );
  assert.ok(centerChanged, 'Center hotspot should have mutated hue/color');

  // Check outer border corner pixel is unchanged
  const cornerIdx = 0;
  assert.equal(mutated.data[cornerIdx], 100);
  assert.equal(mutated.data[cornerIdx + 1], 150);
  assert.equal(mutated.data[cornerIdx + 2], 200);
});
