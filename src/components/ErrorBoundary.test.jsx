// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary.jsx';

const mockCaptureError = vi.fn();
const mockTrackAppError = vi.fn();

vi.mock('../services/sentry.js', () => ({
  captureError: (...args) => mockCaptureError(...args)
}));

vi.mock('../services/analytics.js', () => ({
  trackAppError: (...args) => mockTrackAppError(...args)
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Suppress expected console.error during ErrorBoundary tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  console.error.mockRestore();
});

function BuggyComponent({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Explosive component render error');
  }
  return <div data-testid="healthy-child">Healthy Game Content</div>;
}

test('renders healthy children when no runtime error occurs', () => {
  render(
    <ErrorBoundary>
      <BuggyComponent shouldThrow={false} />
    </ErrorBoundary>
  );

  expect(screen.getByTestId('healthy-child')).toBeDefined();
  expect(mockCaptureError).not.toHaveBeenCalled();
  expect(mockTrackAppError).not.toHaveBeenCalled();
});

test('catches thrown error, renders fallback screen, and forwards to Sentry & Mixpanel', () => {
  render(
    <ErrorBoundary>
      <BuggyComponent shouldThrow={true} />
    </ErrorBoundary>
  );

  expect(screen.queryByTestId('healthy-child')).toBeNull();
  expect(screen.getByText(/Display Error/i)).toBeDefined();
  expect(screen.getByText(/Explosive component render error/i)).toBeDefined();

  // Verifies Sentry captureError was invoked
  expect(mockCaptureError).toHaveBeenCalledTimes(1);
  const [capturedError, context] = mockCaptureError.mock.calls[0];
  expect(capturedError.message).toBe('Explosive component render error');
  expect(context).toHaveProperty('componentStack');

  // Verifies Mixpanel trackAppError was invoked
  expect(mockTrackAppError).toHaveBeenCalledTimes(1);
  expect(mockTrackAppError).toHaveBeenCalledWith({
    errorMessage: 'Explosive component render error',
    errorName: 'Error'
  });
});
