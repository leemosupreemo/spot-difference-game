import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isFirstAttemptForSet,
  markSetFirstAttemptFailed,
  STORAGE_KEY_ACTIVE_FIRST_ATTEMPT
} from './setAttemptTracker.js';

test('isFirstAttemptForSet returns true when set has never been attempted', () => {
  const stats = {
    Medium: { sets: {} }
  };
  assert.equal(isFirstAttemptForSet(stats, 'Medium', 'photo_set_001'), true);
  assert.equal(isFirstAttemptForSet(null, 'Medium', 'photo_set_001'), true);
  assert.equal(isFirstAttemptForSet(stats, '', 'photo_set_001'), false);
  assert.equal(isFirstAttemptForSet(stats, 'Medium', ''), false);
});

test('isFirstAttemptForSet returns false when set has already succeeded', () => {
  const stats = {
    Medium: {
      sets: {
        photo_set_001: {
          firstTime: 18500,
          clears: 1,
          attempts: 1
        }
      }
    }
  };
  assert.equal(isFirstAttemptForSet(stats, 'Medium', 'photo_set_001'), false);
});

test('isFirstAttemptForSet returns false when set already failed on first attempt', () => {
  const stats = {
    Medium: {
      sets: {
        photo_set_001: {
          firstFailed: true,
          firstTime: 'failed',
          clears: 0,
          attempts: 1
        }
      }
    }
  };
  assert.equal(isFirstAttemptForSet(stats, 'Medium', 'photo_set_001'), false);
});

test('markSetFirstAttemptFailed marks firstTime as failed and increments attempts count', () => {
  const stats = {
    Medium: {
      setsCleared: 0,
      sets: {}
    }
  };

  const updated = markSetFirstAttemptFailed(stats, {
    difficulty: 'Medium',
    themeId: 'find_the_sniper',
    setId: 'photo_set_005',
    stageKey: 'photo_set_005'
  });

  const record = updated.Medium.sets.photo_set_005;
  assert.ok(record, 'record should exist');
  assert.equal(record.firstFailed, true);
  assert.equal(record.firstTime, 'failed');
  assert.equal(record.attempts, 1);
  assert.equal(record.clears, 0);
  assert.equal(record.fastestRepeat, null);
});

test('markSetFirstAttemptFailed preserves existing successful first time without overwriting', () => {
  const stats = {
    Medium: {
      sets: {
        photo_set_001: {
          firstTime: 16200,
          clears: 1,
          attempts: 1
        }
      }
    }
  };

  const updated = markSetFirstAttemptFailed(stats, {
    difficulty: 'Medium',
    themeId: 'find_the_sniper',
    setId: 'photo_set_001',
    stageKey: 'photo_set_001'
  });

  assert.equal(updated.Medium.sets.photo_set_001.firstTime, 16200);
  assert.equal(updated.Medium.sets.photo_set_001.firstFailed, undefined);
});
