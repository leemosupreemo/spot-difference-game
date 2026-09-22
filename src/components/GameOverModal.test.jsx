// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GameOverModal from './GameOverModal.jsx';

afterEach(cleanup);

test('GameOverModal renders top-left repeat button and bottom buttons matching Set Complete modal in order', () => {
  const onClose = vi.fn();
  const onRestart = vi.fn();
  const onNextStage = vi.fn();

  render(
    <GameOverModal
      isOpen={true}
      onClose={onClose}
      onRestart={onRestart}
      onNextStage={onNextStage}
      elapsedTime={12500}
      setId="photo_set_003"
    />
  );

  // Top-left repeat button
  const redoBtn = screen.getByRole('button', { name: /repeat set/i });
  expect(redoBtn).toBeTruthy();

  // Bottom buttons in order: Return to Menu (back to menu), then Next Stage
  const menuBtn = screen.getByRole('button', { name: 'Return to Menu' });
  const nextStageBtn = screen.getByRole('button', { name: /next stage/i });
  expect(menuBtn).toBeTruthy();
  expect(nextStageBtn).toBeTruthy();

  // Verify order: Return to Menu appears before Next Stage in DOM
  expect(menuBtn.compareDocumentPosition(nextStageBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  // Clicking Return to Menu calls onClose
  fireEvent.click(menuBtn);
  expect(onClose).toHaveBeenCalledTimes(1);

  // Clicking Next Stage calls onNextStage
  fireEvent.click(nextStageBtn);
  expect(onNextStage).toHaveBeenCalledTimes(1);
});

test('tapping top-left repeat button opens dropdown of attempted sets with failed set highlighted on top', () => {
  const onRestart = vi.fn();
  const onClose = vi.fn();

  render(
    <GameOverModal
      isOpen={true}
      onClose={onClose}
      onRestart={onRestart}
      elapsedTime={15200}
      setId="photo_set_002"
      attemptedSets={['photo_set_002', 'photo_set_001', 'photo_set_005']}
    />
  );

  // Initially dropdown is not open
  expect(screen.queryByRole('listbox', { name: /attempted sets/i })).toBeNull();

  // Tap repeat button to open dropdown
  const redoBtn = screen.getByRole('button', { name: /repeat set/i });
  fireEvent.click(redoBtn);

  // Dropdown should now be visible
  const dropdown = screen.getByRole('listbox', { name: /attempted sets/i });
  expect(dropdown).toBeTruthy();

  // Dropdown shows all attempted sets
  expect(screen.getByText(/Photo Set 2/i)).toBeTruthy();
  expect(screen.getByText(/Photo Set 1/i)).toBeTruthy();
  expect(screen.getByText(/Photo Set 5/i)).toBeTruthy();

  // Failed set is highlighted on top with FAILED badge
  const failedBadge = screen.getByText('FAILED');
  expect(failedBadge).toBeTruthy();

  // Tapping Photo Set 5 calls onRestart('photo_set_005')
  fireEvent.click(screen.getByText(/Photo Set 5/i));
  expect(onRestart).toHaveBeenCalledWith('photo_set_005');
});

test('tapping failed set in dropdown calls onRestart with the failed set id', () => {
  const onRestart = vi.fn();

  render(
    <GameOverModal
      isOpen={true}
      onClose={() => {}}
      onRestart={onRestart}
      elapsedTime={9800}
      setId="photo_set_004"
      attemptedSets={['photo_set_004', 'photo_set_001']}
    />
  );

  // Open dropdown
  fireEvent.click(screen.getByRole('button', { name: /repeat set/i }));

  // Tap failed set (Photo Set 4)
  fireEvent.click(screen.getByText(/Photo Set 4/i));
  expect(onRestart).toHaveBeenCalledWith('photo_set_004');
});

test('repeat button has prominent blue styling and backdrop clicks do not close the modal', () => {
  const onClose = vi.fn();
  const onRestart = vi.fn();

  render(
    <GameOverModal
      isOpen={true}
      onClose={onClose}
      onRestart={onRestart}
      elapsedTime={5000}
      setId="photo_set_001"
    />
  );

  const redoBtn = screen.getByRole('button', { name: /repeat set/i });
  expect(redoBtn.style.border).toContain('var(--accent-cyan)');

  // Clicking backdrop does NOT dismiss the modal
  const backdrop = screen.getByTestId('game-over-backdrop');
  fireEvent.click(backdrop);
  expect(onClose).not.toHaveBeenCalled();
});

test('outside pointerdown closes dropdown without any fixed click catcher overlay blocking touches', () => {
  render(
    <GameOverModal
      isOpen={true}
      onClose={() => {}}
      onRestart={() => {}}
      elapsedTime={4000}
      setId="photo_set_001"
      attemptedSets={['photo_set_001', 'photo_set_002']}
    />
  );

  const redoBtn = screen.getByRole('button', { name: /repeat set/i });
  fireEvent.click(redoBtn);

  // Dropdown is open
  expect(screen.getByRole('listbox', { name: /attempted sets/i })).toBeTruthy();

  // Ensure there is NO fixed transparent click-catcher overlay rendered
  const backdrop = screen.getByTestId('game-over-backdrop');
  const transparentFixedOverlays = Array.from(backdrop.querySelectorAll('div')).filter(el => {
    return el.style.position === 'fixed' && el.style.background === 'transparent';
  });
  expect(transparentFixedOverlays.length).toBe(0);

  // Pointerdown outside dropdown closes the dropdown
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('listbox', { name: /attempted sets/i })).toBeNull();
});
