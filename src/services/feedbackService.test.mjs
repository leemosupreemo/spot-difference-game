import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORT_EMAIL,
  FEEDBACK_SUBJECT_PREFIX,
  submitPlayerFeedback,
  withTimeout
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

/*
 * The Send button awaits submitPlayerFeedback, so any unbounded await inside it
 * freezes the button on "Sending..." with no way out. Firestore's addDoc is the
 * specific hazard: it settles only on server acknowledgement, so offline it stays
 * pending indefinitely rather than rejecting.
 */
test('withTimeout rejects a promise that never settles', async () => {
  const neverSettles = new Promise(() => {});
  const started = Date.now();

  await assert.rejects(
    () => withTimeout(neverSettles, 40, 'stuck call'),
    /stuck call timed out after 40ms/
  );

  assert.ok(Date.now() - started < 1000, 'should reject promptly, not hang');
});

test('withTimeout passes a resolved value straight through', async () => {
  assert.equal(await withTimeout(Promise.resolve('done'), 1000, 'quick call'), 'done');
});

test('withTimeout clears its timer so a settled call leaves nothing pending', async () => {
  // A leaked timer would keep the event loop alive past this test.
  const before = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;
  await withTimeout(Promise.resolve('x'), 5000, 'quick call');
  const after = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;
  assert.equal(after, before, 'timeout timer should be cleared');
});
