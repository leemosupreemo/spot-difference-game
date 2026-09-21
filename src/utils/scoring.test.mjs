import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSpeedPoints } from './scoring.js';

test('awards 1250 points at the start and drops by 10 per second', () => {
  assert.equal(calculateSpeedPoints(0), 1250);
  // Partial seconds round down, so 12.3s costs 123 rather than 124.
  assert.equal(calculateSpeedPoints(12_300), 1127);
});

test('never awards fewer than 25 speed points', () => {
  // The floor is unchanged; at 10 a second from 1250 it is reached at 122.5s.
  assert.equal(calculateSpeedPoints(122_500), 25);
  assert.equal(calculateSpeedPoints(180_000), 25);
  assert.equal(calculateSpeedPoints(3_600_000), 25);
});

test('the countdown rate is unchanged at 10 points per second', () => {
  // The opening value moved; the slope did not. Ten seconds still costs 100.
  for (const seconds of [1, 5, 30, 90]) {
    assert.equal(
      calculateSpeedPoints(seconds * 1000) - calculateSpeedPoints((seconds + 10) * 1000),
      100,
      `ten seconds should cost 100 points at ${seconds}s`
    );
  }
});

test('elapsed time at or below zero cannot beat the opening value', () => {
  assert.equal(calculateSpeedPoints(0), 1250);
  assert.equal(calculateSpeedPoints(-1), 1250);
  assert.equal(calculateSpeedPoints(-60_000), 1250);
});
