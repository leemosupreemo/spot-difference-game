// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import VictoryModal from './VictoryModal.jsx';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../utils/audio', () => ({ sounds: { playTap: vi.fn(), playWin: vi.fn(), playFanfare: vi.fn() } }));
vi.mock('../services/analytics', () => ({
  trackResultScreenViewed: vi.fn(), trackChallengeShareClicked: vi.fn(),
  trackChallengeShareCompleted: vi.fn(), trackChallengeShareCancelled: vi.fn()
}));
vi.mock('../services/gameCenter', () => ({
  mirrorRoundToGameCenter: vi.fn().mockResolvedValue(null),
  openGameCenterLeaderboard: vi.fn(), isGameCenterSupported: () => false,
  isGameCenterAuthenticated: () => false
}));
vi.mock('../utils/challengeMetrics', async (importOriginal) => ({
  ...await importOriginal(), renderChallengeCardBlob: vi.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
}));

beforeEach(() => {
  const storage = new Map();
  vi.stubGlobal('localStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), clear: () => storage.clear() });
});
afterEach(cleanup);
const props = { isOpen: true, elapsedTime: 35000, score: 1500, onClose: vi.fn(), onRestart: vi.fn(), onNextLevel: vi.fn() };

test('top 45% earns two stars even with a high score', () => {
  render(<VictoryModal {...props} />);
  expect(screen.getByLabelText('2 out of 3 stars')).toBeTruthy();
});

test('a personal best has one label and one Share button that opens all share options', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<VictoryModal {...props} />);
  expect(screen.getAllByText(/personal best/i)).toHaveLength(1);
  expect(screen.queryByText(/can you beat me/i)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Text', exact: true })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^(Share|Challenge a Friend)$/ }));
  const sheet = await screen.findByRole('dialog', { name: 'Share result' });
  expect(sheet).toBeTruthy();
  for (const name of ['Text', 'TikTok', 'Instagram', 'More', 'Copy link', 'Save image']) {
    expect(screen.getByRole('button', { name, exact: true })).toBeTruthy();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Copy link', exact: true }));
  await waitFor(() => expect(writeText).toHaveBeenCalled());
  expect(writeText.mock.calls[0][0]).toMatch(/^https:\/\/diffhunter.web.app\/\?challenge=1/);
});

test('existing challenge button can open the sheet without a reference error', async () => {
  render(<VictoryModal {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /^(Share|Challenge a Friend)$/ }));
  expect(await screen.findByRole('dialog', { name: 'Share result' })).toBeTruthy();
});

test('Retry does not celebrate again while the next stage is loading', async () => {
  const { default: confetti } = await import('canvas-confetti');
  confetti.mockClear();
  const onClose = vi.fn();
  const onRestart = vi.fn();
  const { rerender } = render(<VictoryModal {...props} onClose={onClose} onRestart={onRestart} />);
  const initialBursts = confetti.mock.calls.length;
  expect(initialBursts).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onRestart).toHaveBeenCalledOnce();
  rerender(<VictoryModal {...props} score={0} elapsedTime={0} onClose={onClose} onRestart={onRestart} />);
  expect(confetti.mock.calls).toHaveLength(initialBursts);
});
