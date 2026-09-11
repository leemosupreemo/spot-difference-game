import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_CENTER_LEADERBOARDS,
  GAME_CENTER_ACHIEVEMENTS,
  getLeaderboardForDifficulty
} from './gameCenterConfig.js';
import {
  isGameCenterSupported,
  isGameCenterAuthenticated,
  getGameCenterPlayer,
  mirrorRoundToGameCenter,
  openGameCenterLeaderboard,
  openGameCenterAchievements
} from './gameCenter.js';

test('getLeaderboardForDifficulty resolves corresponding Game Center leaderboard IDs', () => {
  assert.equal(getLeaderboardForDifficulty('Easy'), GAME_CENTER_LEADERBOARDS.EASY_FASTEST);
  assert.equal(getLeaderboardForDifficulty('easy'), GAME_CENTER_LEADERBOARDS.EASY_FASTEST);
  assert.equal(getLeaderboardForDifficulty('Hard'), GAME_CENTER_LEADERBOARDS.HARD_FASTEST);
  assert.equal(getLeaderboardForDifficulty('hard'), GAME_CENTER_LEADERBOARDS.HARD_FASTEST);
  assert.equal(getLeaderboardForDifficulty('Medium'), GAME_CENTER_LEADERBOARDS.MEDIUM_FASTEST);
  assert.equal(getLeaderboardForDifficulty('unknown'), GAME_CENTER_LEADERBOARDS.MEDIUM_FASTEST);
});

test('Game Center configuration has required leaderboards and achievements defined', () => {
  assert.ok(GAME_CENTER_LEADERBOARDS.GLOBAL_FASTEST);
  assert.ok(GAME_CENTER_LEADERBOARDS.HIGH_SCORE);
  assert.ok(GAME_CENTER_ACHIEVEMENTS.FIRST_WIN.id);
  assert.ok(GAME_CENTER_ACHIEVEMENTS.SPEED_DEMON_15S.id);
  assert.ok(GAME_CENTER_ACHIEVEMENTS.LIGHTNING_10S.id);
  assert.ok(GAME_CENTER_ACHIEVEMENTS.PERSONAL_BEST.id);
});

test('mirrorRoundToGameCenter gracefully ignores unauthenticated or unsupported platforms', async () => {
  const result = await mirrorRoundToGameCenter({
    elapsedTimeMs: 8200,
    difficulty: 'Medium',
    isPersonalBest: true,
    score: 1200,
    stars: 3
  });

  // Since we are in node test environment (not native iOS), it should return not_authenticated without throwing
  assert.equal(result.mirrored, false);
  assert.equal(result.reason, 'not_authenticated');
});

test('openGameCenterLeaderboard gracefully returns unsupported_platform in non-native environment', async () => {
  const result = await openGameCenterLeaderboard();
  assert.equal(result.success, false);
  assert.equal(result.reason, 'unsupported_platform');
});

test('openGameCenterAchievements gracefully returns unsupported_platform in non-native environment', async () => {
  const result = await openGameCenterAchievements();
  assert.equal(result.success, false);
  assert.equal(result.reason, 'unsupported_platform');
});

