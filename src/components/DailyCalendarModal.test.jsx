// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import DailyCalendarModal from './DailyCalendarModal.jsx';
import {
  recordDailyChallengeCompletion,
  recordDailyChallengeFailure,
  recordDailyChallengeAttempt,
  resetDailyPlayerStatus
} from '../services/dailyChallenge.js';

afterEach(() => {
  cleanup();
  resetDailyPlayerStatus('2026-09-10');
  resetDailyPlayerStatus('2026-09-11');
  resetDailyPlayerStatus('2026-09-12');
  resetDailyPlayerStatus('2026-09-13');
});

test('DailyCalendarModal does not render when isOpen is false', () => {
  const { container } = render(
    <DailyCalendarModal
      isOpen={false}
      onClose={() => {}}
      onSelectDate={() => {}}
      todayDateStr="2026-09-20"
    />
  );
  expect(container.firstChild).toBeNull();
});

test('DailyCalendarModal renders calendar and only enables uncompleted dates', () => {
  // Mark Sept 10 as completed
  recordDailyChallengeCompletion({
    dateStr: '2026-09-10',
    totalTimeMs: 22000,
    playerName: 'Tester'
  });

  const onSelectDate = vi.fn();
  const onClose = vi.fn();

  render(
    <DailyCalendarModal
      isOpen={true}
      onClose={onClose}
      onSelectDate={onSelectDate}
      todayDateStr="2026-09-20"
    />
  );

  expect(screen.getByText('PAST CHALLENGES')).toBeDefined();
  expect(screen.getByText('September 2026')).toBeDefined();

  // Day 10 (completed) should be disabled
  const day10Btn = screen.getByLabelText('Date 2026-09-10 completed');
  expect(day10Btn).toBeDefined();
  expect(day10Btn.disabled).toBe(true);

  // Clicking completed date does not invoke onSelectDate
  fireEvent.click(day10Btn);
  expect(onSelectDate).not.toHaveBeenCalled();

  // Day 11 (uncompleted past date) should be enabled and active
  const day11Btn = screen.getByLabelText('Date 2026-09-11 available to play');
  expect(day11Btn).toBeDefined();
  expect(day11Btn.disabled).toBe(false);

  // Clicking uncompleted active date invokes onSelectDate and onClose
  fireEvent.click(day11Btn);
  expect(onSelectDate).toHaveBeenCalledWith('2026-09-11');
  expect(onClose).toHaveBeenCalled();

  // Future day (e.g. Day 25) should be locked and disabled
  const day25Btn = screen.getByLabelText('Date 2026-09-25 locked');
  expect(day25Btn).toBeDefined();
  expect(day25Btn.disabled).toBe(true);
});

test('DailyCalendarModal re-reads completion status and disables date after completion', () => {
  const onSelectDate = vi.fn();
  const onClose = vi.fn();

  const { rerender } = render(
    <DailyCalendarModal
      isOpen={true}
      onClose={onClose}
      onSelectDate={onSelectDate}
      todayDateStr="2026-09-20"
      refreshKey={0}
    />
  );

  // Day 11 is available initially
  const day11BtnInitial = screen.getByLabelText('Date 2026-09-11 available to play');
  expect(day11BtnInitial.disabled).toBe(false);

  // Close calendar to simulate entering gameplay
  rerender(
    <DailyCalendarModal
      isOpen={false}
      onClose={onClose}
      onSelectDate={onSelectDate}
      todayDateStr="2026-09-20"
      refreshKey={0}
    />
  );

  // Complete Sept 11
  recordDailyChallengeCompletion({
    dateStr: '2026-09-11',
    totalTimeMs: 19000,
    playerName: 'Tester'
  });

  // Re-open calendar with incremented refreshKey
  rerender(
    <DailyCalendarModal
      isOpen={true}
      onClose={onClose}
      onSelectDate={onSelectDate}
      todayDateStr="2026-09-20"
      refreshKey={1}
    />
  );

  // Day 11 should now be completed and disabled
  const day11BtnUpdated = screen.getByLabelText('Date 2026-09-11 completed');
  expect(day11BtnUpdated).toBeDefined();
  expect(day11BtnUpdated.disabled).toBe(true);

  // Clicking it does not trigger onSelectDate
  fireEvent.click(day11BtnUpdated);
  expect(onSelectDate).not.toHaveBeenCalled();
});

test('DailyCalendarModal displays attempted and failed past dates as locked and blocks clicks', () => {
  // Mark Sept 12 as failed (attempted)
  recordDailyChallengeFailure({
    dateStr: '2026-09-12',
    stageIndex: 1
  });

  // Mark Sept 13 as attempted (in-progress or abandoned)
  recordDailyChallengeAttempt('2026-09-13');

  const onSelectDate = vi.fn();
  const onClose = vi.fn();

  render(
    <DailyCalendarModal
      isOpen={true}
      onClose={onClose}
      onSelectDate={onSelectDate}
      todayDateStr="2026-09-20"
      refreshKey={0}
    />
  );

  // Day 12 (failed) should be marked attempted - locked and disabled
  const day12Btn = screen.getByLabelText('Date 2026-09-12 attempted - locked');
  expect(day12Btn).toBeDefined();
  expect(day12Btn.disabled).toBe(true);

  fireEvent.click(day12Btn);
  expect(onSelectDate).not.toHaveBeenCalled();

  // Day 13 (attempted) should be marked attempted - locked and disabled
  const day13Btn = screen.getByLabelText('Date 2026-09-13 attempted - locked');
  expect(day13Btn).toBeDefined();
  expect(day13Btn.disabled).toBe(true);

  fireEvent.click(day13Btn);
  expect(onSelectDate).not.toHaveBeenCalled();
});
