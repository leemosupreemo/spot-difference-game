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
    sounds.playWin(3);
    sounds.playFanfare();
    sounds.playFanfare(1);
    sounds.playFanfare(2);
    sounds.playFanfare(3);
    sounds.playFanfare(3, { isPersonalBest: true });
    sounds.playFanfare(3, { isLeaderboardRecord: true });
    sounds.playLose();
    sounds.playHint();
    sounds.playTick();
  });
});

test('sounds supports different levels of fanfare', () => {
  assert.doesNotThrow(() => {
    // 1 star: none
    sounds.playFanfare(1);
    // 2 stars: some
    sounds.playFanfare(2);
    // 3 stars: more
    sounds.playFanfare(3);
    // fireworks variant for personal best
    sounds.playFanfare(3, { isPersonalBest: true });
    // golden fireworks for leaderboard record
    sounds.playFanfare(3, { isLeaderboardRecord: true });
  });
});
