import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getSuccessfulRounds,
  incrementSuccessfulRounds,
  getSessionsPlayed,
  getRatingPromptAttempts,
  shouldShowRatingPrompt,
  recordRatingPromptShown,
  recordRatingPromptDismissed,
  resetRatingPromptState
} from './ratingPrompt.js';

function freshStorage() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear()
  };
}

test('successfulRounds increments and persists', () => {
  globalThis.localStorage = freshStorage();
  assert.equal(getSuccessfulRounds(), 0);
  assert.equal(incrementSuccessfulRounds(), 1);
  assert.equal(incrementSuccessfulRounds(), 2);
  assert.equal(getSuccessfulRounds(), 2);
});

test('first attempt is not eligible before 5 successful rounds', () => {
  globalThis.localStorage = freshStorage();
  for (let i = 0; i < 4; i++) incrementSuccessfulRounds();
  assert.equal(shouldShowRatingPrompt(), false);
  incrementSuccessfulRounds(); // 5th
  assert.equal(shouldShowRatingPrompt(), true);
});

test('never proactively re-prompts once the player has rated or submitted feedback', () => {
  globalThis.localStorage = freshStorage();
  for (let i = 0; i < 5; i++) incrementSuccessfulRounds();
  localStorage.setItem('diff_hunter_rating_handled', 'rated');
  recordRatingPromptShown();
  assert.equal(shouldShowRatingPrompt(), false);

  localStorage.setItem('diff_hunter_rating_handled', 'feedback');
  assert.equal(shouldShowRatingPrompt(), false);
});

test('after "Maybe Later", stays ineligible until both the round bonus and a new session are met', () => {
  globalThis.localStorage = freshStorage();
  for (let i = 0; i < 5; i++) incrementSuccessfulRounds();
  localStorage.setItem('diff_hunter_launch_count', '1');

  assert.equal(shouldShowRatingPrompt(), true);
  recordRatingPromptShown();
  localStorage.setItem('diff_hunter_rating_handled', 'dismissed');
  recordRatingPromptDismissed();
  assert.equal(getRatingPromptAttempts(), 1);

  // Same session, rounds not yet bumped: still not eligible.
  assert.equal(shouldShowRatingPrompt(), false);

  // New session but not enough extra rounds yet: still not eligible.
  assert.equal(shouldShowRatingPrompt({ successfulRounds: getSuccessfulRounds() + 3, sessionsPlayed: 2 }), false);

  // Enough extra rounds (max possible bonus is 20) but same session: still not eligible.
  assert.equal(shouldShowRatingPrompt({ successfulRounds: getSuccessfulRounds() + 20, sessionsPlayed: 1 }), false);

  // Enough extra rounds AND a new session: eligible for the second (final) attempt.
  assert.equal(shouldShowRatingPrompt({ successfulRounds: getSuccessfulRounds() + 20, sessionsPlayed: 2 }), true);
});

test('caps at two attempts total, no further prompting afterward', () => {
  globalThis.localStorage = freshStorage();
  for (let i = 0; i < 40; i++) incrementSuccessfulRounds();
  localStorage.setItem('diff_hunter_launch_count', '1');

  recordRatingPromptShown();
  localStorage.setItem('diff_hunter_rating_handled', 'dismissed');
  recordRatingPromptDismissed();

  localStorage.setItem('diff_hunter_launch_count', '2');
  for (let i = 0; i < 20; i++) incrementSuccessfulRounds(); // cover the max possible 10-20 bonus
  assert.equal(shouldShowRatingPrompt({ sessionsPlayed: 2 }), true);

  recordRatingPromptShown({ sessionsPlayed: 2 });
  localStorage.setItem('diff_hunter_rating_handled', 'dismissed');
  recordRatingPromptDismissed();

  assert.equal(getRatingPromptAttempts(), 2);
  assert.equal(shouldShowRatingPrompt({ sessionsPlayed: 99, successfulRounds: 9999 }), false);
});

test('getSessionsPlayed reads the shared launch-count key', () => {
  globalThis.localStorage = freshStorage();
  localStorage.setItem('diff_hunter_launch_count', '7');
  assert.equal(getSessionsPlayed(), 7);
});

test('resetRatingPromptState clears all rating prompt tracking keys', () => {
  globalThis.localStorage = freshStorage();
  incrementSuccessfulRounds();
  recordRatingPromptShown();
  localStorage.setItem('diff_hunter_rating_handled', 'rated');
  resetRatingPromptState();
  assert.equal(getSuccessfulRounds(), 0);
  assert.equal(getRatingPromptAttempts(), 0);
  assert.equal(shouldShowRatingPrompt(), false);
});
