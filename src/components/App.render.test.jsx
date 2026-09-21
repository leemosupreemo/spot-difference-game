// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from '../App.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';

beforeEach(() => {
  vi.clearAllMocks();
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
