import { saveLeaderboardStats } from '../services/playerProgress.js';

export const STORAGE_KEY_ACTIVE_FIRST_ATTEMPT = 'diff_hunter_active_first_attempt';

/**
 * Checks if the upcoming or current playthrough is the player's first attempt on a set.
 * Returns true only if the set has never been completed, never attempted, and never marked failed.
 *
 * @param {object} difficultyStats - Current categorized difficulty stats
 * @param {string} difficulty - e.g. 'Easy', 'Medium', 'Hard'
 * @param {string} stageKey - Set ID or stage key (e.g. 'photo_set_001')
 * @returns {boolean}
 */
export function isFirstAttemptForSet(difficultyStats, difficulty, stageKey) {
  if (!difficulty || !stageKey) return false;
  const setRecord = difficultyStats?.[difficulty]?.sets?.[stageKey];
  if (!setRecord) return true;

  if (setRecord.firstFailed || setRecord.firstTime === 'failed') return false;
  if (typeof setRecord.firstTime === 'number' && setRecord.firstTime > 0) return false;
  if ((setRecord.clears || 0) > 0) return false;
  if ((setRecord.attempts || 0) > 0) return false;

  return true;
}

/**
 * Records that an active set playthrough has started.
 * If this is the player's first attempt, writes a pending marker to localStorage
 * so that app termination or crashes count as a failed first attempt.
 */
export function recordSetAttemptStarted({ difficulty, themeId, setId, stageKey, isFirstAttempt }) {
  if (!isFirstAttempt || typeof window === 'undefined') return;
  try {
    const payload = {
      difficulty: difficulty || 'Medium',
      themeId: themeId || 'find_the_sniper',
      setId: setId || stageKey,
      stageKey: stageKey || setId,
      startedAt: Date.now()
    };
    window.localStorage?.setItem(STORAGE_KEY_ACTIVE_FIRST_ATTEMPT, JSON.stringify(payload));
  } catch {}
}

/**
 * Clears the active set attempt marker from localStorage (e.g. upon stage completion).
 */
export function clearActiveSetAttempt() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(STORAGE_KEY_ACTIVE_FIRST_ATTEMPT);
  } catch {}
}

/**
 * Retrieves the pending active first attempt record if any.
 */
export function getActiveSetAttempt() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY_ACTIVE_FIRST_ATTEMPT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Marks a set's first attempt as permanently failed in difficultyStats and local storage.
 *
 * Updates:
 *   - firstFailed: true
 *   - firstTime: 'failed'
 *   - attempts: (existing.attempts || 0) + 1
 *
 * Preserves any existing or future repeat times, clears, and scores.
 *
 * @param {object} prevStats - Existing categorized stats
 * @param {object} setInfo - { difficulty, themeId, setId, stageKey }
 * @returns {object} Updated difficulty stats
 */
export function markSetFirstAttemptFailed(prevStats = {}, { difficulty, themeId, setId, stageKey }) {
  const diff = difficulty || 'Medium';
  const packId = themeId || 'find_the_sniper';
  const key = stageKey || setId;
  if (!key) return prevStats;

  const currentCat = prevStats[diff] || { setsCleared: 0, totalPoints: 0, sets: {} };
  const currentSets = { ...(currentCat.sets || {}) };
  const existing = currentSets[key] || {
    title: `5-Image Stage (${packId === 'find_the_sniper' ? 'Photography' : 'Abstract'})`,
    packId,
    setId: setId || key,
    clears: 0,
    totalPoints: 0
  };

  // If the first attempt was already recorded with a valid time in the past, do not overwrite it.
  if (typeof existing.firstTime === 'number' && existing.firstTime > 0) {
    clearActiveSetAttempt();
    return prevStats;
  }

  const updatedSet = {
    ...existing,
    packId: existing.packId || packId,
    setId: existing.setId || setId || key,
    title: existing.title || `5-Image Stage (${packId === 'find_the_sniper' ? 'Photography' : 'Abstract'})`,
    firstFailed: true,
    firstTime: 'failed',
    attempts: (existing.attempts || 0) + 1,
    clears: existing.clears || 0,
    fastestRepeat: existing.fastestRepeat || null,
    fastestTime: existing.fastestTime || null,
    totalPoints: existing.totalPoints || 0
  };

  currentSets[key] = updatedSet;

  const setEntries = Object.values(currentSets);
  const allFirstTimes = setEntries.map(s => s.firstTime).filter(t => typeof t === 'number' && t > 0);
  const allRepeats = setEntries.map(s => s.fastestRepeat).filter(t => typeof t === 'number' && t > 0);

  const updatedStats = {
    ...prevStats,
    [diff]: {
      ...currentCat,
      sets: currentSets,
      fastestFirstTimeOverall: allFirstTimes.length > 0 ? Math.min(...allFirstTimes) : null,
      fastestRepeatOverall: allRepeats.length > 0 ? Math.min(...allRepeats) : null
    }
  };

  clearActiveSetAttempt();

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('diff_hunter_categorized_stats', JSON.stringify(updatedStats));
    }
    saveLeaderboardStats(updatedStats).catch(() => {});
  } catch {}

  return updatedStats;
}
