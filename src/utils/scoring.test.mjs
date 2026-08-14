import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSpeedPoints } from './scoring.js';

test('awards 500 points at the start and drops by 10 per second', () => {
  assert.equal(calculateSpeedPoints(0), 500);
  assert.equal(calculateSpeedPoints(12_300), 377);
});

test('never awards fewer than 25 speed points', () => {
  assert.equal(calculateSpeedPoints(47_500), 25);
  assert.equal(calculateSpeedPoints(180_000), 25);
});
