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
  if (typeof window !== 'undefined' && window.HTMLMediaElement) {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.load = vi.fn();
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

test('failing via 3 misses goes straight to fail modal without showing answer spotlight or delay', async () => {
  localStorage.setItem('diff_hunter_debug', 'false');
  const { container } = render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );

  fireEvent.click(screen.getByText(/START GAME/i));
  await waitFor(() => {
    expect(screen.queryByText(/START GAME/i)).toBeNull();
  });

  const canvas = container.querySelector('.canvas-card');
  expect(canvas).toBeTruthy();
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
    right: 400,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => {}
  });

  const tap = () => {
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 150 });
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 150 });
  };
  tap();
  tap();
  tap();

  // Answer is NOT revealed on canvas
  expect(container.querySelector('.reveal-marker')).toBeNull();

  // Fail modal is shown immediately
  expect(screen.getByText(/STAGE FAILED/i)).toBeTruthy();
});
