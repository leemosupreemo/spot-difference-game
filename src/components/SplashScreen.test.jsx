// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import SplashScreen from './SplashScreen.jsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test('SplashScreen displays Diff Hunter logo and label initially', () => {
  render(<SplashScreen onFinish={vi.fn()} />);

  // Should render Diff Hunter logo image
  const logo = screen.getByAltText('Diff Hunter Logo');
  expect(logo).toBeTruthy();
  expect(logo.getAttribute('src')).toBe('/app-icon.png');

  // Should render DIFF HUNTER label
  expect(screen.getByText('DIFF HUNTER')).toBeTruthy();
  expect(screen.queryByText(/Spot The Difference/i)).toBeNull();

  // Jaunt Co logo is rendered
  const jauntLogo = screen.getByAltText('The Jaunt Co.');
  expect(jauntLogo).toBeTruthy();
  expect(jauntLogo.getAttribute('src')).toBe('/jaunt-logo-cropped.png');
});

test('SplashScreen staggers Jaunt Co section and fades out to complete onFinish', () => {
  const handleFinish = vi.fn();
  render(
    <SplashScreen
      onFinish={handleFinish}
      initialDelay={300}
      holdDuration={1000}
      fadeDuration={500}
    />
  );

  // At 0ms, onFinish has not been called
  expect(handleFinish).not.toHaveBeenCalled();

  // Advance to initialDelay (Jaunt Co revealed)
  act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(handleFinish).not.toHaveBeenCalled();

  // Advance through holdDuration to trigger fade-out
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(handleFinish).not.toHaveBeenCalled();

  // Advance through fadeDuration to complete
  act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(handleFinish).toHaveBeenCalledTimes(1);
});

test('tapping the splash screen skips early and finishes after fade', () => {
  const handleFinish = vi.fn();
  render(
    <SplashScreen
      onFinish={handleFinish}
      initialDelay={400}
      holdDuration={1500}
      fadeDuration={500}
    />
  );

  // User taps the screen immediately
  const splashContainer = screen.getByRole('region', { name: /Diff Hunter by The Jaunt Co./i });
  fireEvent.click(splashContainer);

  // Advancing fadeDuration triggers completion immediately without waiting full 1900ms
  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(handleFinish).toHaveBeenCalledTimes(1);
});
