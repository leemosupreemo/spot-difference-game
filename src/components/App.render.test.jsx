// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';

let storage = new Map();

beforeEach(() => {
  vi.clearAllMocks();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear()
  });
  // Provide mock window matchMedia if needed
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  }
});

afterEach(() => {
  cleanup();
});

test('App mounts without triggering ErrorBoundary Display Error', () => {
  render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );

  // The Display Error header should NOT appear
  expect(screen.queryByText(/Display Error/i)).toBeNull();
  expect(screen.queryByText(/getCuratedStatusMap is not defined/i)).toBeNull();
});

test('clicking START GAME in non-debug mode launches photography stage and switches to game view', async () => {
  localStorage.setItem('diff_hunter_debug', 'false');
  render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );

  const startButton = screen.getByText(/START GAME/i);
  expect(startButton).toBeDefined();

  fireEvent.click(startButton);

  await waitFor(() => {
    // Menu is gone and game view has rendered
    expect(screen.queryByText(/START GAME/i)).toBeNull();
  }, { timeout: 3000 });
});

test('clicking START GAME in non-debug mode with invalid/stale photoSetId recovers and launches game', async () => {
  localStorage.setItem('diff_hunter_debug', 'false');
  localStorage.setItem('diff_hunter_photo_set_id', 'non_existent_or_incomplete_set');
  render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );

  const startButton = screen.getByText(/START GAME/i);
  expect(startButton).toBeDefined();

  fireEvent.click(startButton);

  await waitFor(() => {
    expect(screen.queryByText(/START GAME/i)).toBeNull();
  }, { timeout: 3000 });
});
