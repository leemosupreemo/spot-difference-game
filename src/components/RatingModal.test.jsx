// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/*
 * The Send button used to show the same celebratory "Thank You!" whatever
 * happened, including a total failure -- and then close 2.2s later, discarding
 * what the player had written. These pin the three outcomes apart.
 */
const submitPlayerFeedback = vi.fn();
vi.mock('../services/feedbackService', () => ({
  submitPlayerFeedback: (...args) => submitPlayerFeedback(...args),
  SUPPORT_EMAIL: 'support@thejauntcompany.com',
  FEEDBACK_SUBJECT_PREFIX: '[Diff Hunter Feedback]'
}));
vi.mock('../utils/audio', () => ({
  sounds: { playTap: vi.fn(), playWin: vi.fn(), playError: vi.fn() }
}));
vi.mock('../services/analytics', () => ({ trackRatingPromptAction: vi.fn() }));
vi.mock('../services/appConfig', () => ({ getAppStoreReviewUrl: () => 'https://example.test' }));
vi.mock('../services/ratingPrompt', () => ({ recordRatingPromptDismissed: vi.fn() }));
vi.mock('../services/playerProgress', () => ({ getSavedPlayerName: () => 'Hunter' }));

const { default: RatingModal } = await import('./RatingModal.jsx');

afterEach(() => { cleanup(); submitPlayerFeedback.mockReset(); });

async function send(report) {
  submitPlayerFeedback.mockResolvedValue(report);
  render(<RatingModal isOpen={true} onClose={vi.fn()} initialStep="feedback" />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'the level was tricky' } });
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));
}

test('a delivered submission thanks the player', async () => {
  await send({ success: true, cloudFunction: true, firestore: true, email: true, queued: false });
  await waitFor(() => expect(screen.getByText(/thank you/i)).toBeTruthy());
  expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
});

test('a queued submission says it will send once back online', async () => {
  await send({ success: true, cloudFunction: false, firestore: false, email: false, queued: true });
  await waitFor(() => expect(screen.getByText(/back online/i)).toBeTruthy());
  expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
});

test('a failed submission says so and offers a retry', async () => {
  await send({ success: true, cloudFunction: false, firestore: false, email: false, queued: false });
  await waitFor(() => expect(screen.getByText(/couldn't send/i)).toBeTruthy());
  expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
});

test('retrying after a failure keeps what the player wrote', async () => {
  await send({ success: true, cloudFunction: false, firestore: false, email: false, queued: false });
  await waitFor(() => expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: /try again/i }));

  expect(screen.getByRole('textbox').value).toBe('the level was tricky');
});

test('a thrown submission is treated as a failure, not a success', async () => {
  submitPlayerFeedback.mockRejectedValue(new Error('network down'));
  render(<RatingModal isOpen={true} onClose={vi.fn()} initialStep="feedback" />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));

  await waitFor(() => expect(screen.getByText(/couldn't send/i)).toBeTruthy());
});

test('the send button shows a spinner while the submission is in flight', async () => {
  let release;
  submitPlayerFeedback.mockReturnValue(new Promise(resolve => { release = resolve; }));

  const { container } = render(<RatingModal isOpen={true} onClose={vi.fn()} initialStep="feedback" />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'thoughts' } });
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));

  await waitFor(() => expect(container.querySelector('.btn-spinner')).toBeTruthy());
  expect(screen.getByRole('button', { name: /sending/i }).disabled).toBe(true);

  release({ success: true, cloudFunction: true, firestore: true, email: true, queued: false });
  await waitFor(() => expect(container.querySelector('.btn-spinner')).toBeNull());
});

/*
 * The status used to close itself 2.2s later, which read as a separate popup
 * flashing past rather than the modal simply changing what it says.
 */
test('the status replaces the form in place and does not close itself', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const onClose = vi.fn();
  submitPlayerFeedback.mockResolvedValue({ success: true, cloudFunction: true, firestore: true, email: true, queued: false });

  render(<RatingModal isOpen={true} onClose={onClose} initialStep="feedback" />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'thoughts' } });
  fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));

  await waitFor(() => expect(screen.getByText(/thank you/i)).toBeTruthy());
  // The form it replaced is gone, not stacked underneath.
  expect(screen.queryByRole('textbox')).toBeNull();

  vi.advanceTimersByTime(5000);
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /done/i }));
  expect(onClose).toHaveBeenCalled();
  vi.useRealTimers();
});
