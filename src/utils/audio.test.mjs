import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sounds } from './audio.js';

test('sounds initializes with muted=false by default', () => {
  assert.equal(sounds.isMuted(), false);
});

test('sounds toggles mute state correctly', () => {
  const initialState = sounds.isMuted();
  const newState = sounds.toggleMute();
  assert.equal(newState, !initialState);
  assert.equal(sounds.isMuted(), !initialState);

  // Restore
  sounds.toggleMute();
  assert.equal(sounds.isMuted(), initialState);
});

test('sounds play methods execute safely without throwing', () => {
  assert.doesNotThrow(() => {
    sounds.playTap();
    sounds.playSuccess();
    sounds.playError();
    sounds.playWin();
    sounds.playHint();
    sounds.playTick();
  });
});
