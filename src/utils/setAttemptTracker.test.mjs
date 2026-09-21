import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isFirstAttemptForSet,
  markSetFirstAttemptFailed,
  STORAGE_KEY_ACTIVE_FIRST_ATTEMPT,
  STORAGE_KEY_ATTEMPTED_SETS,
  markSetAttempted,
  getAttemptedSetIds
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

test('getAttemptedSetIds places currently failed set on top followed by other attempted sets sorted', () => {
  const stats = {
    Medium: {
      sets: {
        photo_set_005: { setId: 'photo_set_005', clears: 1 },
        photo_set_002: { setId: 'photo_set_002', clears: 1 }
      }
    },
    Easy: {
      sets: {
        photo_set_001: { setId: 'photo_set_001', clears: 0, firstFailed: true }
      }
    }
  };

  // Failed set is photo_set_003
  const result = getAttemptedSetIds(stats, 'photo_set_003');
  assert.equal(result[0], 'photo_set_003', 'Failed set must be on top');
  assert.deepEqual(result, ['photo_set_003', 'photo_set_001', 'photo_set_002', 'photo_set_005']);
});

test('getAttemptedSetIds works when no previous sets have been attempted', () => {
  const result = getAttemptedSetIds({}, 'photo_set_007');
  assert.deepEqual(result, ['photo_set_007']);
});

function freshStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; }
  };
}

test('markSetAttempted persists to localStorage and is included in getAttemptedSetIds', () => {
  const orig = globalThis.localStorage;
  globalThis.localStorage = freshStorage();
  try {
    markSetAttempted('photo_set_012');
    markSetAttempted('photo_set_004');

    const result = getAttemptedSetIds({}, 'photo_set_012');
    assert.equal(result[0], 'photo_set_012', 'Failed set on top');
    assert.ok(result.includes('photo_set_004'));
  } finally {
    globalThis.localStorage = orig;
  }
});

