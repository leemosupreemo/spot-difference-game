// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import MainMenu from './MainMenu.jsx';

afterEach(cleanup);

const defaultProps = {
  selectedTheme: 'find_the_sniper',
  setSelectedTheme: vi.fn(),
  photoSetIds: ['set_1'],
  photoSetId: 'set_1',
  onPhotoSetChange: vi.fn(),
  onStartGame: vi.fn(),
  hasCompletedFirstSet: true,
  tutorialAnimationEnabled: false
};

test('Debug mode exposes a manual remote-pack refresh action', () => {
  const onRefreshRemotePacks = vi.fn();
  render(
    <MainMenu
      {...defaultProps}
      debugMode
      onRefreshRemotePacks={onRefreshRemotePacks}
      remotePackSync={{ status: 'idle', count: 0 }}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Refresh Remote Packs' }));
  expect(onRefreshRemotePacks).toHaveBeenCalledOnce();
});

test('remote-pack refresh reports progress and the resulting remote count', () => {
  const { rerender } = render(
    <MainMenu
      {...defaultProps}
      debugMode
      onRefreshRemotePacks={vi.fn()}
      remotePackSync={{ status: 'refreshing', count: 0 }}
    />
  );

  expect(screen.getByRole('button', { name: 'Refreshing Remote Packs' }).disabled).toBe(true);

  rerender(
    <MainMenu
      {...defaultProps}
      debugMode
      onRefreshRemotePacks={vi.fn()}
      remotePackSync={{ status: 'success', count: 10 }}
    />
  );

  expect(screen.getByText('10 remote levels loaded')).toBeTruthy();
});

test('remote-pack refresh is hidden outside Debug mode', () => {
  render(
    <MainMenu
      {...defaultProps}
      debugMode={false}
      onRefreshRemotePacks={vi.fn()}
      remotePackSync={{ status: 'idle', count: 0 }}
    />
  );

  expect(screen.queryByRole('button', { name: 'Refresh Remote Packs' })).toBeNull();
});
