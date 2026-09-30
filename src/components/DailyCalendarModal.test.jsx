// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import DailyCalendarModal from './DailyCalendarModal.jsx';
import { recordDailyChallengeCompletion, resetDailyPlayerStatus } from '../services/dailyChallenge.js';

afterEach(() => {
  cleanup();
  resetDailyPlayerStatus('2026-09-10');
  resetDailyPlayerStatus('2026-09-11');
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
