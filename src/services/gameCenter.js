import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  GAME_CENTER_LEADERBOARDS,
  GAME_CENTER_ACHIEVEMENTS,
  getLeaderboardForDifficulty
} from './gameCenterConfig.js';

// Register native plugin with graceful fallback for web/non-iOS platforms
const NativeGameCenter = registerPlugin('GameCenter', {
  web: {
    authenticate: async () => ({ isAuthenticated: false, player: null }),
    isAuthenticated: async () => ({ isAuthenticated: false, player: null }),
    getPlayer: async () => ({ isAuthenticated: false, player: null }),
    submitScore: async () => ({ success: false, reason: 'unsupported_platform' }),
    showLeaderboard: async () => ({ success: false, reason: 'unsupported_platform' }),
    showAchievements: async () => ({ success: false, reason: 'unsupported_platform' }),
    unlockAchievement: async () => ({ success: false, reason: 'unsupported_platform' }),
    addListener: async () => ({ remove: async () => {} })
  }
});

let authState = {
  isInitialized: false,
  isAuthenticated: false,
  player: null
};

const listeners = new Set();

// Register listener for native Game Center authentication events (iOS only)
if (isGameCenterSupported() && typeof NativeGameCenter.addListener === 'function') {
  try {
    NativeGameCenter.addListener('gameCenterAuthChanged', (data) => {
      authState = {
        isInitialized: true,
        isAuthenticated: Boolean(data?.isAuthenticated),
        player: data?.player || null
      };
      notifyListeners();
    });
  } catch (e) {
    console.warn('Could not register gameCenterAuthChanged listener:', e);
  }
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...authState });
    } catch (e) {
      console.warn('GameCenter listener error:', e);
    }
  });
}

/**
 * Subscribe to Game Center authentication state changes.
 * @param {(state: typeof authState) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function onGameCenterAuthChange(callback) {
  listeners.add(callback);
  // Send immediate state
  callback({ ...authState });
  return () => listeners.delete(callback);
}

/**
 * Check if running on native iOS.
 */
export function isGameCenterSupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/**
 * Initialize Game Center authentication silently.
 * Safe to call on any platform.
 */
export async function initGameCenter() {
  if (!isGameCenterSupported()) {
    authState = { isInitialized: true, isAuthenticated: false, player: null };
    notifyListeners();
    return authState;
  }

  try {
    const res = await NativeGameCenter.authenticate();
    authState = {
      isInitialized: true,
      isAuthenticated: Boolean(res?.isAuthenticated),
      player: res?.player || null
    };
    notifyListeners();
    return authState;
  } catch (err) {
    console.warn('Game Center authentication failed or cancelled:', err);
    authState = {
      isInitialized: true,
      isAuthenticated: false,
      player: null
    };
    notifyListeners();
    return authState;
  }
}

/**
 * Quick synchronous check if the user is authenticated with Game Center.
 * @returns {boolean}
 */
export function isGameCenterAuthenticated() {
  return Boolean(authState.isAuthenticated);
}

/**
 * Get the current Game Center player details.
 * @returns {{ alias?: string, displayName?: string, gamePlayerID?: string } | null}
 */
export function getGameCenterPlayer() {
  return authState.player;
}

/**
 * Submit a score/time to a specified Game Center leaderboard.
 * Only submits if authenticated.
 * @param {{ leaderboardId: string, score: number }} params
 */
export async function submitGameCenterScore({ leaderboardId, score }) {
  if (!isGameCenterSupported() || !authState.isAuthenticated) {
    return { success: false, reason: 'not_authenticated' };
  }

  try {
    const intScore = Math.round(score);
    return await NativeGameCenter.submitScore({
      leaderboardId,
      score: intScore
    });
  } catch (err) {
    console.warn(`Failed to submit score to leaderboard ${leaderboardId}:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Unlock or report progress on a Game Center achievement.
 * Only reports if authenticated.
 * @param {{ achievementId: string, percentComplete?: number, showsCompletionBanner?: boolean }} params
 */
export async function unlockGameCenterAchievement({
  achievementId,
  percentComplete = 100.0,
  showsCompletionBanner = true
}) {
  if (!isGameCenterSupported() || !authState.isAuthenticated) {
    return { success: false, reason: 'not_authenticated' };
  }

  try {
    return await NativeGameCenter.unlockAchievement({
      achievementId,
      percentComplete,
      showsCompletionBanner
    });
  } catch (err) {
    console.warn(`Failed to report achievement ${achievementId}:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Automatically mirror level completion time and stats to Game Center leaderboards and achievements.
 * Only executes if user is signed into Game Center.
 *
 * @param {Object} params
 * @param {number} params.elapsedTimeMs - Round duration in milliseconds
 * @param {string} [params.difficulty] - 'Easy', 'Medium', 'Hard'
 * @param {boolean} [params.isPersonalBest] - Whether this was a new personal record
 * @param {number} [params.score] - In-game points earned
 * @param {number} [params.stars] - Star rating (1-3)
 * @returns {Promise<{ mirrored: boolean, leaderboards?: string[], achievements?: string[], reason?: string }>}
 */
export async function mirrorRoundToGameCenter({
  elapsedTimeMs,
  difficulty = 'Medium',
  isPersonalBest = false,
  score = 0,
  stars = 3
}) {
  if (!isGameCenterSupported() || !authState.isAuthenticated) {
    return { mirrored: false, reason: 'not_authenticated' };
  }

  if (typeof elapsedTimeMs !== 'number' || elapsedTimeMs <= 0) {
    return { mirrored: false, reason: 'invalid_time' };
  }

  const leaderboardsUpdated = [];
  const achievementsUnlocked = [];

  // 1. Submit to Difficulty-specific Fastest Time Leaderboard
  const diffLeaderboardId = getLeaderboardForDifficulty(difficulty);
  const diffResult = await submitGameCenterScore({
    leaderboardId: diffLeaderboardId,
    score: elapsedTimeMs
  });
  if (diffResult?.success) leaderboardsUpdated.push(diffLeaderboardId);

  // 2. Submit to Global Fastest Time Leaderboard
  const globalResult = await submitGameCenterScore({
    leaderboardId: GAME_CENTER_LEADERBOARDS.GLOBAL_FASTEST,
    score: elapsedTimeMs
  });
  if (globalResult?.success) leaderboardsUpdated.push(GAME_CENTER_LEADERBOARDS.GLOBAL_FASTEST);

  // 3. Submit High Score if score is provided
  if (typeof score === 'number' && score > 0) {
    const scoreResult = await submitGameCenterScore({
      leaderboardId: GAME_CENTER_LEADERBOARDS.HIGH_SCORE,
      score
    });
    if (scoreResult?.success) leaderboardsUpdated.push(GAME_CENTER_LEADERBOARDS.HIGH_SCORE);
  }

  // 4. Mirror Qualified Achievements
  // First Win
  await unlockGameCenterAchievement({ achievementId: GAME_CENTER_ACHIEVEMENTS.FIRST_WIN.id });
  achievementsUnlocked.push(GAME_CENTER_ACHIEVEMENTS.FIRST_WIN.id);

  // Personal Best
  if (isPersonalBest) {
    await unlockGameCenterAchievement({ achievementId: GAME_CENTER_ACHIEVEMENTS.PERSONAL_BEST.id });
    achievementsUnlocked.push(GAME_CENTER_ACHIEVEMENTS.PERSONAL_BEST.id);
  }

  // Three Stars
  if (stars >= 3) {
    await unlockGameCenterAchievement({ achievementId: GAME_CENTER_ACHIEVEMENTS.THREE_STARS.id });
    achievementsUnlocked.push(GAME_CENTER_ACHIEVEMENTS.THREE_STARS.id);
  }

  // Speed Demon (< 15 seconds)
  if (elapsedTimeMs < 15000) {
    await unlockGameCenterAchievement({ achievementId: GAME_CENTER_ACHIEVEMENTS.SPEED_DEMON_15S.id });
    achievementsUnlocked.push(GAME_CENTER_ACHIEVEMENTS.SPEED_DEMON_15S.id);
  }

  // Lightning Fast (< 10 seconds)
  if (elapsedTimeMs < 10000) {
    await unlockGameCenterAchievement({ achievementId: GAME_CENTER_ACHIEVEMENTS.LIGHTNING_10S.id });
    achievementsUnlocked.push(GAME_CENTER_ACHIEVEMENTS.LIGHTNING_10S.id);
  }

  // Hard Master
  if (String(difficulty).toLowerCase() === 'hard') {
    await unlockGameCenterAchievement({ achievementId: GAME_CENTER_ACHIEVEMENTS.HARD_MASTER.id });
    achievementsUnlocked.push(GAME_CENTER_ACHIEVEMENTS.HARD_MASTER.id);
  }

  return {
    mirrored: true,
    leaderboards: leaderboardsUpdated,
    achievements: achievementsUnlocked
  };
}

/**
 * Show the native Game Center Leaderboard overlay.
 * On native iOS, this presents the GKGameCenterViewController or prompts sign-in if unauthenticated.
 * @param {string} [leaderboardId] - Optional specific leaderboard to show.
 */
export async function openGameCenterLeaderboard(leaderboardId) {
  if (!isGameCenterSupported()) {
    return { success: false, reason: 'unsupported_platform' };
  }

  try {
    return await NativeGameCenter.showLeaderboard({ leaderboardId });
  } catch (err) {
    console.warn('Failed to display Game Center leaderboard:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Show the native Game Center Achievements overlay.
 * On native iOS, this presents the GKGameCenterViewController or prompts sign-in if unauthenticated.
 */
export async function openGameCenterAchievements() {
  if (!isGameCenterSupported()) {
    return { success: false, reason: 'unsupported_platform' };
  }

  try {
    return await NativeGameCenter.showAchievements();
  } catch (err) {
    console.warn('Failed to display Game Center achievements:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
