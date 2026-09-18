/**
 * Set Leaderboards & Ranking Utility
 * 
 * Provides deterministic baseline top times for all photo sets,
 * set ranking calculation (world 1st/2nd/3rd), and set search matching.
 */

export const ALL_PHOTO_SET_IDS = Array.from({ length: 26 }, (_, i) => (
  `photo_set_${String(i + 1).padStart(3, '0')}`
));

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Extracts a numeric set index (1-based) from a setId string.
 * e.g. "photo_set_005" -> 5, "set_1" -> 1.
 */
export function getSetNumber(setId) {
  if (typeof setId === 'number') return setId;
  if (!setId || typeof setId !== 'string') return 1;
  const match = setId.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  const idx = ALL_PHOTO_SET_IDS.indexOf(setId);
  return idx >= 0 ? idx + 1 : 1;
}

/**
 * Returns deterministic baseline top leaderboard times for any set.
 * Guarantees every set has at least top 3 competitive times.
 */
export function getDeterministicSetBaseline(setId) {
  const cleanId = String(setId || 'photo_set_001');
  const seed = hashString(cleanId);
  // Realistic base completion times for 5-image set: ~16.5s to 22.5s
  const baseTimeMs = 16500 + (seed % 6000);

  return [
    {
      uid: `bot_1_${cleanId}`,
      playerName: 'PixelSniper_Pro',
      firstTime: baseTimeMs + 1400,
      repeatTime: baseTimeMs,
      fastestTime: baseTimeMs,
      mostPoints: 2450 + (seed % 45),
      stars: 3,
      isCurrentPlayer: false
    },
    {
      uid: `bot_2_${cleanId}`,
      playerName: 'VortexEagle',
      firstTime: baseTimeMs + 2900,
      repeatTime: baseTimeMs + 1650,
      fastestTime: baseTimeMs + 1650,
      mostPoints: 2380 + (seed % 40),
      stars: 3,
      isCurrentPlayer: false
    },
    {
      uid: `bot_3_${cleanId}`,
      playerName: 'ChronoMaster',
      firstTime: baseTimeMs + 4800,
      repeatTime: baseTimeMs + 3300,
      fastestTime: baseTimeMs + 3300,
      mostPoints: 2260 + (seed % 35),
      stars: 2,
      isCurrentPlayer: false
    },
    {
      uid: `bot_4_${cleanId}`,
      playerName: 'ApexHawk_X',
      firstTime: baseTimeMs + 7100,
      repeatTime: baseTimeMs + 5100,
      fastestTime: baseTimeMs + 5100,
      mostPoints: 2090 + (seed % 30),
      stars: 2,
      isCurrentPlayer: false
    },
    {
      uid: `bot_5_${cleanId}`,
      playerName: 'NovaSeeker',
      firstTime: baseTimeMs + 9600,
      repeatTime: baseTimeMs + 7200,
      fastestTime: baseTimeMs + 7200,
      mostPoints: 1920 + (seed % 25),
      stars: 1,
      isCurrentPlayer: false
    }
  ];
}

/**
 * Calculates world rank (1, 2, 3 or null) for a given set and time.
 * Compares against the top 3 leaderboard times for that set.
 */
export function calculateSetWorldRank(setId, playerTimeMs, existingSetLeaderboard = null) {
  if (!setId || typeof playerTimeMs !== 'number' || playerTimeMs <= 0) return null;

  const baseline = existingSetLeaderboard && existingSetLeaderboard.length >= 3
    ? existingSetLeaderboard
    : getDeterministicSetBaseline(setId);

  const opponents = baseline.filter(e => !e.isCurrentPlayer);
  if (opponents.length < 3) return null;

  const getBest = (e) => e.fastestTime || e.repeatTime || e.firstTime || 999999;

  const t1 = getBest(opponents[0]);
  const t2 = getBest(opponents[1]);
  const t3 = getBest(opponents[2]);

  if (playerTimeMs <= t1) return 1;
  if (playerTimeMs <= t2) return 2;
  if (playerTimeMs <= t3) return 3;
  return null;
}

const STORAGE_KEY_DYNAMIC_BEST = 'diff_hunter_fastest_dynamic_time';

/**
 * Checks and updates the fastest overall time for a dynamic/abstract set.
 * In abstract/generative mode, set records are dropped and this tracks the fastest overall time.
 */
export function checkAndUpdateDynamicSetRecord(elapsedTimeMs) {
  if (typeof elapsedTimeMs !== 'number' || elapsedTimeMs <= 0) {
    return { isNewRecord: false, previousBestMs: null };
  }

  let previousBestMs = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(STORAGE_KEY_DYNAMIC_BEST);
      if (val) previousBestMs = parseInt(val, 10);
    }
  } catch (_) {}

  const isNewRecord = !previousBestMs || elapsedTimeMs < previousBestMs;
  if (isNewRecord) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DYNAMIC_BEST, String(elapsedTimeMs));
      }
    } catch (_) {}
  }

  return { isNewRecord, previousBestMs };
}

/**
 * Parses user search query for Set # in scores menu.
 * Matches inputs like "1", "Set 1", "#1", "photo_set_001", "35".
 */
export function parseSetSearch(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().toLowerCase();
  if (!clean) return null;

  if (ALL_PHOTO_SET_IDS.includes(clean)) {
    return clean;
  }

  const numMatch = clean.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    if (num >= 1 && num <= ALL_PHOTO_SET_IDS.length) {
      return `photo_set_${String(num).padStart(3, '0')}`;
    }
  }

  return null;
}
