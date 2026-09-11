/**
 * Game Center Configuration
 * Leaderboard & Achievement IDs configured in App Store Connect.
 */

export const GAME_CENTER_LEADERBOARDS = {
  GLOBAL_FASTEST: 'diff_hunter_fastest_time',
  EASY_FASTEST: 'diff_hunter_fastest_easy',
  MEDIUM_FASTEST: 'diff_hunter_fastest_medium',
  HARD_FASTEST: 'diff_hunter_fastest_hard',
  HIGH_SCORE: 'diff_hunter_high_score'
};

export const GAME_CENTER_ACHIEVEMENTS = {
  FIRST_WIN: {
    id: 'diff_hunter_first_win',
    title: 'First Discovery',
    description: 'Complete your first spot-the-difference level'
  },
  PERSONAL_BEST: {
    id: 'diff_hunter_personal_best',
    title: 'Record Breaker',
    description: 'Set a new personal best time'
  },
  THREE_STARS: {
    id: 'diff_hunter_three_stars',
    title: 'Flawless Vision',
    description: 'Earn a 3-star rating on any level'
  },
  SPEED_DEMON_15S: {
    id: 'diff_hunter_speed_demon',
    title: 'Speed Demon',
    description: 'Clear any level in under 15 seconds'
  },
  LIGHTNING_10S: {
    id: 'diff_hunter_lightning_fast',
    title: 'Lightning Reflexes',
    description: 'Clear any level in under 10 seconds'
  },
  HARD_MASTER: {
    id: 'diff_hunter_hard_master',
    title: 'Eagle Eye Master',
    description: 'Successfully complete a Hard difficulty challenge'
  }
};

/**
 * Returns the appropriate leaderboard ID for a given difficulty string.
 * @param {string} difficulty
 * @returns {string}
 */
export function getLeaderboardForDifficulty(difficulty = 'Medium') {
  const norm = String(difficulty || '').toLowerCase();
  if (norm === 'easy') return GAME_CENTER_LEADERBOARDS.EASY_FASTEST;
  if (norm === 'hard') return GAME_CENTER_LEADERBOARDS.HARD_FASTEST;
  return GAME_CENTER_LEADERBOARDS.MEDIUM_FASTEST;
}
