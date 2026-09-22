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
  // Test mock fetch response
  const originalFetch = globalThis.fetch;
  let sentPayload = null;

  globalThis.fetch = async (url, options) => {
    sentPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: 'true' })
    };
  };

  try {
    const result = await submitPlayerFeedback({
      playerName: 'SpeedHunter',
      feedbackText: 'Level 14 difference was super tricky!',
      attemptNumber: 2
    });

    assert.equal(result.success, true);
    assert.equal(sentPayload.name, 'SpeedHunter');
    assert.equal(sentPayload.message, 'Level 14 difference was super tricky!');
    assert.equal(sentPayload.attempt, 2);
    assert.match(sentPayload._subject, /\[Diff Hunter Feedback\] Player Feedback - SpeedHunter/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('submitPlayerFeedback defaults empty values safely', async () => {
  const originalFetch = globalThis.fetch;
  let sentPayload = null;

  globalThis.fetch = async (url, options) => {
    sentPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: 'true' })
    };
  };

  try {
    const result = await submitPlayerFeedback({});

    assert.equal(result.success, true);
    assert.equal(sentPayload.name, 'Hunter');
    assert.equal(sentPayload.message, '(No feedback comment written)');
    assert.equal(sentPayload.attempt, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
