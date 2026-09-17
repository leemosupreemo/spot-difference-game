// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import VictoryModal from './VictoryModal.jsx';
import DailyVictoryModal from './DailyVictoryModal.jsx';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../utils/audio', () => ({
  sounds: { playTap: vi.fn(), playWin: vi.fn(), playFanfare: vi.fn(), playError: vi.fn() }
}));
vi.mock('../utils/audio.js', () => ({
  sounds: { playTap: vi.fn(), playWin: vi.fn(), playFanfare: vi.fn(), playError: vi.fn() }
}));
vi.mock('../services/analytics', () => ({
  trackResultScreenViewed: vi.fn(), trackChallengeShareClicked: vi.fn(),
  trackChallengeShareCompleted: vi.fn(), trackChallengeShareCancelled: vi.fn(), identifyPlayer: vi.fn()
}));
vi.mock('../services/analytics.js', () => ({
  trackResultScreenViewed: vi.fn(), identifyPlayer: vi.fn()
}));
vi.mock('../services/gameCenter', () => ({
  mirrorRoundToGameCenter: vi.fn().mockResolvedValue(null),
  openGameCenterLeaderboard: vi.fn(), isGameCenterSupported: () => false,
  isGameCenterAuthenticated: () => false, onGameCenterAuthChange: () => () => {}
}));
vi.mock('../utils/challengeMetrics', async (importOriginal) => ({
  ...await importOriginal(), renderChallengeCardBlob: vi.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
}));
vi.mock('../utils/challengeMetrics.js', async (importOriginal) => ({
  ...await importOriginal(), recordLocalShareEvent: vi.fn()
}));
vi.mock('../utils/setLeaderboards.js', async (importOriginal) => ({
  ...await importOriginal(), calculateSetWorldRank: vi.fn(() => 1)
}));

const savePlayerName = vi.fn(name => name);
const submitLeaderboardScore = vi.fn().mockResolvedValue({ qualified: true, rank: 1, entries: [] });
const generateDefaultPlayerName = vi.fn(() => 'RandoBot_1234');
vi.mock('../services/playerProgress.js', () => ({
  getSavedPlayerName: () => 'PriorTag',
  savePlayerName: (...args) => savePlayerName(...args),
  generateDefaultPlayerName: (...args) => generateDefaultPlayerName(...args)
}));
vi.mock('../services/leaderboardService.js', () => ({
  submitLeaderboardScore: (...args) => submitLeaderboardScore(...args)
}));
vi.mock('../services/networkService.js', () => ({
  isOnline: () => true,
  subscribeNetworkStatus: () => () => {}
}));

const updateDailyPlayerName = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/dailyChallenge.js', () => ({
  getDailyLeaderboard: () => [],
  fetchDailyLeaderboard: vi.fn().mockResolvedValue([]),
  updateDailyPlayerName: (...args) => updateDailyPlayerName(...args),
  getDailyTimeToBeat: () => null
}));

beforeEach(() => {
  const storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    clear: () => storage.clear()
  });
  savePlayerName.mockClear();
  submitLeaderboardScore.mockClear();
  updateDailyPlayerName.mockClear();
  generateDefaultPlayerName.mockClear();
});
afterEach(cleanup);

test('VictoryModal rejects a profane Hunter Tag and never saves or submits it', () => {
  render(
    <VictoryModal
      isOpen
      elapsedTime={35000}
      score={1500}
      setId="photo_set_001"
      setNumber={1}
      onClose={vi.fn()}
      onRestart={vi.fn()}
      onNextLevel={vi.fn()}
    />
  );

  const input = screen.getByPlaceholderText('Enter name');
  fireEvent.change(input, { target: { value: 'fuckboy' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.getByText(/isn't allowed/i)).toBeTruthy();
  expect(savePlayerName).not.toHaveBeenCalled();
  expect(submitLeaderboardScore).not.toHaveBeenCalled();
});

test('VictoryModal accepts a clean Hunter Tag, saves it, and submits it', () => {
  render(
    <VictoryModal
      isOpen
      elapsedTime={35000}
      score={1500}
      setId="photo_set_001"
      setNumber={1}
      onClose={vi.fn()}
      onRestart={vi.fn()}
      onNextLevel={vi.fn()}
    />
  );

  const input = screen.getByPlaceholderText('Enter name');
  fireEvent.change(input, { target: { value: 'PixelSniper' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.queryByText(/isn't allowed/i)).toBeNull();
  expect(savePlayerName).toHaveBeenCalledWith('PixelSniper');
  expect(submitLeaderboardScore).toHaveBeenCalled();
});

test('VictoryModal requires at least one character before Save and shows a tooltip', () => {
  render(
    <VictoryModal
      isOpen
      elapsedTime={35000}
      score={1500}
      setId="photo_set_001"
      setNumber={1}
      onClose={vi.fn()}
      onRestart={vi.fn()}
      onNextLevel={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.getByText('Please enter a name before saving.')).toBeTruthy();
  expect(savePlayerName).not.toHaveBeenCalled();
  expect(submitLeaderboardScore).not.toHaveBeenCalled();
});

test('VictoryModal quitting a fresh record with an empty field submits a random generated name', () => {
  const onClose = vi.fn();
  render(
    <VictoryModal
      isOpen
      elapsedTime={35000}
      score={1500}
      setId="photo_set_001"
      setNumber={1}
      onClose={onClose}
      onRestart={vi.fn()}
      onNextLevel={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Return to Main Menu' }));

  expect(generateDefaultPlayerName).toHaveBeenCalled();
  expect(savePlayerName).toHaveBeenCalledWith('RandoBot_1234');
  expect(submitLeaderboardScore).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

test('VictoryModal quitting a fresh record after typing a valid name submits that name instead of a random one', () => {
  render(
    <VictoryModal
      isOpen
      elapsedTime={35000}
      score={1500}
      setId="photo_set_001"
      setNumber={1}
      onClose={vi.fn()}
      onRestart={vi.fn()}
      onNextLevel={vi.fn()}
    />
  );

  const input = screen.getByPlaceholderText('Enter name');
  fireEvent.change(input, { target: { value: 'TypedButNeverSaved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Return to Main Menu' }));

  expect(generateDefaultPlayerName).not.toHaveBeenCalled();
  expect(savePlayerName).toHaveBeenCalledWith('TypedButNeverSaved');
});

test('VictoryModal banner shows "1st Place Saved!" after saving, then fully collapses away', () => {
  vi.useFakeTimers();
  try {
    render(
      <VictoryModal
        isOpen
        elapsedTime={35000}
        score={1500}
        setId="photo_set_001"
        setNumber={1}
        onClose={vi.fn()}
        onRestart={vi.fn()}
        onNextLevel={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Enter name');
    fireEvent.change(input, { target: { value: 'PixelSniper' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    // Immediately after saving: the form (and its "LEADERBOARD QUALIFIED!" prompt) is replaced
    // by the "1st Place Saved!" message, within the same container
    expect(screen.getByText('1st Place Saved!')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Enter name')).toBeNull();
    expect(screen.queryByText('LEADERBOARD QUALIFIED!')).toBeNull();

    // After the hold + collapse delay, the entire banner is gone - not just visually hidden
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.queryByText('1st Place Saved!')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test('VictoryModal clears the rejection message once the name is edited again', () => {
  render(
    <VictoryModal
      isOpen
      elapsedTime={35000}
      score={1500}
      setId="photo_set_001"
      setNumber={1}
      onClose={vi.fn()}
      onRestart={vi.fn()}
      onNextLevel={vi.fn()}
    />
  );

  const input = screen.getByPlaceholderText('Enter name');
  fireEvent.change(input, { target: { value: 'shithead' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByText(/isn't allowed/i)).toBeTruthy();

  fireEvent.change(input, { target: { value: 'CleanTag' } });
  expect(screen.queryByText(/isn't allowed/i)).toBeNull();
});

test('DailyVictoryModal rejects a profane Hunter Tag and never saves or submits it', () => {
  render(
    <DailyVictoryModal
      isOpen
      totalTimeMs={18420}
      position={1}
      stars={3}
      score={1490}
      setId="photo_set_004"
      setNumber={4}
      onClose={vi.fn()}
      onOpenLeaderboard={vi.fn()}
      onRestart={vi.fn()}
    />
  );

  const input = screen.getByPlaceholderText('Enter name');
  fireEvent.change(input, { target: { value: 'bitchmaster' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.getByText(/isn't allowed/i)).toBeTruthy();
  expect(savePlayerName).not.toHaveBeenCalled();
  expect(updateDailyPlayerName).not.toHaveBeenCalled();
});

test('DailyVictoryModal accepts a clean Hunter Tag, saves it, and syncs it', () => {
  render(
    <DailyVictoryModal
      isOpen
      totalTimeMs={18420}
      position={1}
      stars={3}
      score={1490}
      setId="photo_set_004"
      setNumber={4}
      onClose={vi.fn()}
      onOpenLeaderboard={vi.fn()}
      onRestart={vi.fn()}
    />
  );

  const input = screen.getByPlaceholderText('Enter name');
  fireEvent.change(input, { target: { value: 'SpeedHunter99' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.queryByText(/isn't allowed/i)).toBeNull();
  expect(savePlayerName).toHaveBeenCalledWith('SpeedHunter99');
  expect(updateDailyPlayerName).toHaveBeenCalledWith('SpeedHunter99');
});

test('DailyVictoryModal banner shows "1st Place Saved!" after saving, then fully collapses away', () => {
  vi.useFakeTimers();
  try {
    render(
      <DailyVictoryModal
        isOpen
        totalTimeMs={18420}
        position={1}
        stars={3}
        score={1490}
        setId="photo_set_004"
        setNumber={4}
        onClose={vi.fn()}
        onOpenLeaderboard={vi.fn()}
        onRestart={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Enter name');
    fireEvent.change(input, { target: { value: 'SpeedHunter99' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText('1st Place Saved!')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Enter name')).toBeNull();
    expect(screen.queryByText('LEADERBOARD QUALIFIED!')).toBeNull();

    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.queryByText('1st Place Saved!')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test('DailyVictoryModal requires at least one character before Save and shows a tooltip', () => {
  render(
    <DailyVictoryModal
      isOpen
      totalTimeMs={18420}
      position={1}
      stars={3}
      score={1490}
      setId="photo_set_004"
      setNumber={4}
      onClose={vi.fn()}
      onOpenLeaderboard={vi.fn()}
      onRestart={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.getByText('Please enter a name before saving.')).toBeTruthy();
  expect(savePlayerName).not.toHaveBeenCalled();
  expect(updateDailyPlayerName).not.toHaveBeenCalled();
});

test('DailyVictoryModal quitting a fresh record with an empty field submits a random generated name', () => {
  const onClose = vi.fn();
  render(
    <DailyVictoryModal
      isOpen
      totalTimeMs={18420}
      position={1}
      stars={3}
      score={1490}
      setId="photo_set_004"
      setNumber={4}
      onClose={onClose}
      onOpenLeaderboard={vi.fn()}
      onRestart={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Close' }));

  expect(generateDefaultPlayerName).toHaveBeenCalled();
  expect(savePlayerName).toHaveBeenCalledWith('RandoBot_1234');
  expect(updateDailyPlayerName).toHaveBeenCalledWith('RandoBot_1234');
  expect(onClose).toHaveBeenCalled();
});
