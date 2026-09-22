import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORT_EMAIL,
  FEEDBACK_SUBJECT_PREFIX,
  submitPlayerFeedback
} from './feedbackService.js';

test('feedbackService exports expected email and prefix constants', () => {
  assert.equal(SUPPORT_EMAIL, 'support@thejauntcompany.com');
  assert.equal(FEEDBACK_SUBJECT_PREFIX, '[Diff Hunter Feedback]');
});

test('submitPlayerFeedback gracefully completes and returns success status', async () => {
  const result = await submitPlayerFeedback({
    playerName: 'SpeedHunter',
    feedbackText: 'Level 14 difference was super tricky!',
    attemptNumber: 2
  });

  assert.equal(result.success, true);
  assert.equal(typeof result, 'object');
});

test('submitPlayerFeedback defaults empty values safely', async () => {
  const result = await submitPlayerFeedback({});

  assert.equal(result.success, true);
  assert.equal(typeof result, 'object');
});
