// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import DailyVictoryModal from './DailyVictoryModal.jsx';

afterEach(cleanup);

const renderForfeit = () => render(
  <DailyVictoryModal
    isOpen
    isFailed
    isForfeit
    dateStr="2026-09-21"
    onClose={() => {}}
    onMainMenu={() => {}}
  />
);

test('the forfeit title is centred on the modal, not on the space beside the icons', () => {
  renderForfeit();
  const title = screen.getByText('DAILY CHALLENGE FORFEITED');
  expect(title.style.textAlign).toBe('center');

  // Centring depends on the header laying out as three tracks whose outer two
  // are equal -- text-align alone would only centre it within whatever space
  // the icons left over, which is what looked off.
  const header = title.parentElement;
  expect(header.style.display).toBe('grid');
  expect(header.style.gridTemplateColumns).toBe('1fr auto 1fr');

  // The icons stay in the first track, to the left of the title.
  const icons = screen.getByLabelText('Share daily result').parentElement;
  expect(header.firstElementChild).toBe(icons);
  expect(header.children.length).toBe(3);
});

test('the run-ended title shares the same centred header', () => {
  render(
    <DailyVictoryModal isOpen isFailed dateStr="2026-09-21" onClose={() => {}} onMainMenu={() => {}} />
  );
  const title = screen.getByText('DAILY CHALLENGE RUN ENDED');
  expect(title.style.textAlign).toBe('center');
  expect(title.parentElement.style.gridTemplateColumns).toBe('1fr auto 1fr');
});
