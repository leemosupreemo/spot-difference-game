import { initializeApp, getApps } from 'firebase/app';
import { getFirestoreClient } from './firestoreClient.js';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, getDoc, query, where, limit } from 'firebase/firestore';
import { ALL_PHOTO_SET_IDS, getDeterministicSetBaseline } from '../utils/setLeaderboards.js';
import { getGameCenterPlayer } from './gameCenter.js';
import { submitLeaderboardScore } from './leaderboardService.js';
import { recordNetworkSuccess } from './networkService.js';
import { isScreenshotHarnessMode } from '../utils/screenshotMode.js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

function isConfigured() {
  if (typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT)) {
    return false;
  }
  return Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
}

let playerPromise;

async function getPlayer() {
  if (!isConfigured() || isScreenshotHarnessMode()) return null;
  if (!playerPromise) {
    playerPromise = (async () => {
      try {
        const app = getApps()[0] || initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
        return { uid: credential.user.uid, db: getFirestoreClient(app) };
      } catch (err) {
        console.warn('Firebase initialization warning:', err?.message || err);
        return null;
      }
    })();
  }
  return playerPromise;
}

let inMemoryPlayerName = 'SpeedHunter';

export const STORAGE_KEY_HAS_COMPLETED_SET = 'diff_hunter_has_completed_first_set';
let inMemoryHasCompletedFirstSet = false;

export function hasCompletedFirstSet() {
  if (inMemoryHasCompletedFirstSet) return true;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      if (localStorage.getItem(STORAGE_KEY_HAS_COMPLETED_SET) === 'true') {
        return true;
      }
      // Backward-compatibility: Check if player already completed standard sets
      const statsRaw = localStorage.getItem('diff_hunter_categorized_stats');
      if (statsRaw) {
        const stats = JSON.parse(statsRaw);
        for (const cat of Object.values(stats)) {
          if (cat && (cat.setsCleared > 0 || (cat.sets && Object.keys(cat.sets).length > 0))) {
            return true;
          }
        }
      }
      // Backward-compatibility: Check if player already completed a daily challenge set
      const dailyRaw = localStorage.getItem('diff_hunter_daily_sets');
      if (dailyRaw && dailyRaw !== '{}') {
        return true;
      }
    }
  } catch (_) {}
  return inMemoryHasCompletedFirstSet;
}

export function markFirstSetCompleted() {
  inMemoryHasCompletedFirstSet = true;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(STORAGE_KEY_HAS_COMPLETED_SET, 'true');
    }
  } catch (_) {}
}

export function _resetFirstSetCompletedForTesting() {
  inMemoryHasCompletedFirstSet = false;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
      localStorage.removeItem(STORAGE_KEY_HAS_COMPLETED_SET);
    }
  } catch (_) {}
}

// Fixed keys for locally stored progress/scores (not identity, settings, or debug/simulator state).
const LOCAL_RECORD_KEYS = [
  'diff_hunter_categorized_stats',
  STORAGE_KEY_HAS_COMPLETED_SET,
  'diff_hunter_local_leaderboard',
  'diff_hunter_best_times',
  'diff_hunter_share_stats',
  'diff_hunter_fastest_dynamic_time',
  'diff_hunter_pending_leaderboard_queue',
  'diff_hunter_daily_sets',
  'diff_hunter_daily_queue_used',
  'diff_hunter_daily_remote_queue'
];

// Per-day/dynamic prefixes for locally stored progress/scores.
const LOCAL_RECORD_KEY_PREFIXES = [
  'diff_hunter_daily_leaderboard_',
  'diff_hunter_daily_player_',
  'diff_hunter_lb_'
];

/**
 * Wipes locally stored gameplay records/scores (categorized stats, daily challenge
 * history, cached leaderboards). Leaves identity (player name, anonymous uid) and
 * app/debug settings untouched.
 */
export function clearAllLocalRecords() {
  inMemoryHasCompletedFirstSet = false;
  try {
    if (typeof localStorage === 'undefined') return;

    LOCAL_RECORD_KEYS.forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && LOCAL_RECORD_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
  } catch (_) {}
}

export const DEFAULT_HUNTER_PREFIXES = [
  'SpeedHunter',
  'PixelSniper',
  'CyberSeeker',
  'NeonHunter',
  'ApexScout',
  'ChronoHunter',
  'ShadowSeeker',
  'VortexSniper',
  'NovaSpotter'
];

/**
 * Generates a memorable, arcade-themed default Hunter Tag (e.g. "PixelSniper_4821").
 */
export function generateDefaultPlayerName() {
  const prefix = DEFAULT_HUNTER_PREFIXES[Math.floor(Math.random() * DEFAULT_HUNTER_PREFIXES.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}_${num}`;
}

/**
 * Retrieves the persistent default name for the user, or creates and saves one.
 */
export function getDefaultPlayerName() {
  return getSavedPlayerName();
}

export function getSavedPlayerName() {
  try {
    let name = null;
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      name = localStorage.getItem('diff_hunter_player_name');
    }
    if (!name && inMemoryPlayerName) {
      name = inMemoryPlayerName;
    }
    if (name && name.trim()) {
      return name.trim();
    }

    // Generate a default name and persist it so the player always has a consistent identity
    const defaultName = generateDefaultPlayerName();
    return savePlayerName(defaultName);
  } catch (_) {
    return inMemoryPlayerName || 'SpeedHunter';
  }
}

export function savePlayerName(name) {
  const trimmed = name ? name.trim() : '';
  const finalName = trimmed || 'SpeedHunter';
  inMemoryPlayerName = finalName;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem('diff_hunter_player_name', finalName);
    }
  } catch (_) {}
  return finalName;
}

export function computeLeaderboardPayload(difficultyStats, playerName) {
  const avgFirstTimeByDifficulty = {};
  const avgRepeatTimeByDifficulty = {};

  const avgFirstTimeByPack = {};
  const avgRepeatTimeByPack = {};

  let totalSetsCleared = 0;

  const packFirstSums = {};
  const packFirstCounts = {};
  const packRepeatSums = {};
  const packRepeatCounts = {};
  const fastestTimeByPack = {};
  const bySetFirst = {};
  const bySetRepeat = {};
  const bySetPoints = {};
  const fastestTimeBySet = {};

  const categoryKeys = Object.keys(difficultyStats || {});
  const categories = categoryKeys.length > 0 ? categoryKeys : ['Easy', 'Medium', 'Hard', 'All'];

  categories.forEach(diff => {
    const sets = difficultyStats?.[diff]?.sets || {};
    const setEntries = Object.values(sets);

    let firstSum = 0;
    let firstCount = 0;
    let repeatSum = 0;
    let repeatCount = 0;

    setEntries.forEach(setRecord => {
      const packId = setRecord.packId || 'find_the_sniper';
      const setId = typeof setRecord.setId === 'string' && setRecord.setId.trim()
        ? setRecord.setId.trim()
        : null;
      let setCleared = false;

      if (typeof setRecord.firstTime === 'number' && setRecord.firstTime > 0) {
        firstSum += setRecord.firstTime;
        firstCount += 1;
        setCleared = true;

        if (!packFirstSums[packId]) { packFirstSums[packId] = 0; packFirstCounts[packId] = 0; }
        packFirstSums[packId] += setRecord.firstTime;
        packFirstCounts[packId] += 1;
        if (setId && (!bySetFirst[setId] || setRecord.firstTime < bySetFirst[setId])) bySetFirst[setId] = setRecord.firstTime;
      } else if (setRecord.firstFailed || setRecord.firstTime === 'failed') {
        if (setId && !bySetFirst[setId]) {
          bySetFirst[setId] = 'failed';
        }
      }

      const repeatTime = typeof setRecord.fastestRepeat === 'number' && setRecord.fastestRepeat > 0
        ? setRecord.fastestRepeat
        : (typeof setRecord.bestCleanTime === 'number' && setRecord.bestCleanTime > 0
          ? setRecord.bestCleanTime
          : (typeof setRecord.firstTime === 'number' && setRecord.firstTime > 0 ? setRecord.firstTime : null));
      if (typeof repeatTime === 'number' && repeatTime > 0) {
        repeatSum += repeatTime;
        repeatCount += 1;
        setCleared = true;

        if (!packRepeatSums[packId]) { packRepeatSums[packId] = 0; packRepeatCounts[packId] = 0; }
        packRepeatSums[packId] += repeatTime;
        packRepeatCounts[packId] += 1;
        if (setId && (!bySetRepeat[setId] || repeatTime < bySetRepeat[setId])) bySetRepeat[setId] = repeatTime;
      }

      const validTimes = [setRecord.firstTime, setRecord.fastestRepeat, setRecord.bestCleanTime, setRecord.bestFaultedTime]
        .filter(t => typeof t === 'number' && t > 0);
      if (validTimes.length > 0) {
        const minTime = Math.min(...validTimes);
        if (!fastestTimeByPack[packId] || minTime < fastestTimeByPack[packId]) {
          fastestTimeByPack[packId] = minTime;
        }
        if (setId && (!fastestTimeBySet[setId] || minTime < fastestTimeBySet[setId])) fastestTimeBySet[setId] = minTime;
      }

      const setPoints = Math.max(
        setRecord.bestScore || 0,
        setRecord.lastScore || 0,
        setRecord.totalPoints && setRecord.clears ? Math.round(setRecord.totalPoints / setRecord.clears) : 0
      );
      if (setId && typeof setPoints === 'number' && setPoints > 0) {
        if (!bySetPoints[setId] || setPoints > bySetPoints[setId]) bySetPoints[setId] = setPoints;
      }

      if (setCleared) {
        totalSetsCleared += 1;
      }
    });

    avgFirstTimeByDifficulty[diff] = firstCount > 0 ? Math.round(firstSum / firstCount) : null;
    avgRepeatTimeByDifficulty[diff] = repeatCount > 0 ? Math.round(repeatSum / repeatCount) : null;
  });

  const allPacks = new Set([...Object.keys(packFirstSums), ...Object.keys(packRepeatSums), ...Object.keys(fastestTimeByPack)]);
  allPacks.forEach(packId => {
    avgFirstTimeByPack[packId] = packFirstCounts[packId] > 0 ? Math.round(packFirstSums[packId] / packFirstCounts[packId]) : null;
    avgRepeatTimeByPack[packId] = packRepeatCounts[packId] > 0 ? Math.round(packRepeatSums[packId] / packRepeatCounts[packId]) : null;
  });

  return {
    playerName: playerName || getSavedPlayerName(),
    avgFirstTimeByDifficulty,
    avgRepeatTimeByDifficulty,
    avgFirstTimeByPack,
    avgRepeatTimeByPack,
    fastestTimeByPack,
    bySetFirst,
    bySetRepeat,
    bySetPoints,
    fastestTimeBySet,
    // Backwards-compatible aliases
    avgTimesByDifficulty: avgRepeatTimeByDifficulty,
    avgTimesByPack: avgRepeatTimeByPack,
    totalSetsCleared,
    updatedAt: new Date().toISOString()
  };
}

export async function fetchPlayerImageHistory() {
  const player = await getPlayer();
  if (!player) return {};

  try {
    const snap = await getDocs(collection(player.db, 'players', player.uid, 'images'));
    const history = {};
    snap.forEach(docSnap => {
      history[docSnap.id] = docSnap.data();
    });
    return history;
  } catch (e) {
    console.warn('Could not fetch Firestore image history:', e);
    return {};
  }
}

export async function isImageSeenInFirestore(imageId) {
  const player = await getPlayer();
  if (!player) return false;

  try {
    const docSnap = await getDoc(doc(player.db, 'players', player.uid, 'images', imageId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return !!(data.firstSeenTimeMs || (data.clears && data.clears > 0));
    }
    return false;
  } catch (_) {
    return false;
  }
}

export async function syncProgressFromFirestore(localStats = {}) {
  const history = await fetchPlayerImageHistory();
  const imageIds = Object.keys(history);

  if (imageIds.length === 0) return localStats;

  const mergedStats = { ...localStats };

  ['Easy', 'Medium', 'Hard', 'All'].forEach(diff => {
    if (!mergedStats[diff]) {
      mergedStats[diff] = { setsCleared: 0, sets: {} };
    }
    const currentSets = { ...mergedStats[diff].sets };

    imageIds.forEach(imageId => {
      const remoteData = history[imageId];
      const existing = currentSets[imageId] || {};

      const firstTime = existing.firstTime || remoteData.firstSeenTimeMs || null;
      const fastestRepeat = existing.fastestRepeat || remoteData.bestRepeatTimeMs || firstTime;

      currentSets[imageId] = {
        title: existing.title || remoteData.title || imageId,
        packId: existing.packId || remoteData.packId || 'find_the_sniper',
        firstTime,
        fastestRepeat,
        bestCleanTime: existing.bestCleanTime || null,
        bestFaultedTime: existing.bestFaultedTime || null,
        clears: Math.max(existing.clears || 0, remoteData.clears || 1)
      };
    });

    const setEntries = Object.values(currentSets);
    const allFirstTimes = setEntries.map(s => s.firstTime).filter(Boolean);
    const allRepeats = setEntries.map(s => s.fastestRepeat).filter(Boolean);

    mergedStats[diff] = {
      ...mergedStats[diff],
      setsCleared: setEntries.length,
      fastestFirstTimeOverall: allFirstTimes.length > 0 ? Math.min(...allFirstTimes) : null,
      fastestRepeatOverall: allRepeats.length > 0 ? Math.min(...allRepeats) : null,
      sets: currentSets
    };
  });

  try {
    localStorage.setItem('diff_hunter_categorized_stats', JSON.stringify(mergedStats));
  } catch (_) {}

  return mergedStats;
}

export function mergeDifficultyStats(localStats = {}, cloudStats = {}) {
  const merged = { ...localStats };
  const categories = ['Easy', 'Medium', 'Hard', 'All'];

  categories.forEach(diff => {
    const localCat = merged[diff] || { setsCleared: 0, sets: {} };
    const cloudCat = cloudStats?.[diff] || { setsCleared: 0, sets: {} };

    const mergedSets = { ...(localCat.sets || {}) };
    const cloudSets = cloudCat.sets || {};

    Object.entries(cloudSets).forEach(([stageKey, cloudSet]) => {
      const localSet = mergedSets[stageKey];
      if (!localSet) {
        mergedSets[stageKey] = { ...cloudSet };
      } else {
        const firstTimes = [localSet.firstTime, cloudSet.firstTime].filter(t => typeof t === 'number' && t > 0);
        const repeatTimes = [localSet.fastestRepeat, cloudSet.fastestRepeat].filter(t => typeof t === 'number' && t > 0);
        const fastestTimes = [localSet.fastestTime, cloudSet.fastestTime, ...firstTimes, ...repeatTimes].filter(t => typeof t === 'number' && t > 0);
        const isFirstFailed = Boolean(
          localSet.firstFailed || cloudSet.firstFailed ||
          localSet.firstTime === 'failed' || cloudSet.firstTime === 'failed'
        );

        mergedSets[stageKey] = {
          ...cloudSet,
          ...localSet,
          clears: Math.max(localSet.clears || 0, cloudSet.clears || 0),
          attempts: Math.max(localSet.attempts || 0, cloudSet.attempts || 0),
          totalPoints: Math.max(localSet.totalPoints || 0, cloudSet.totalPoints || 0),
          firstFailed: isFirstFailed,
          firstTime: firstTimes.length > 0 ? Math.min(...firstTimes) : (isFirstFailed ? 'failed' : null),
          fastestRepeat: repeatTimes.length > 0 ? Math.min(...repeatTimes) : null,
          fastestTime: fastestTimes.length > 0 ? Math.min(...fastestTimes) : null,
          lastScore: localSet.lastScore || cloudSet.lastScore || 0
        };
      }
    });

    const setEntries = Object.values(mergedSets);
    const allFirstTimes = setEntries.map(s => s.firstTime).filter(Boolean);
    const allRepeats = setEntries.map(s => s.fastestRepeat).filter(Boolean);
    const categoryTotalPoints = setEntries.reduce((sum, s) => sum + (s.totalPoints || 0), 0);
    const totalClearsAcrossCategory = setEntries.reduce((sum, s) => sum + (s.clears || 1), 0);

    merged[diff] = {
      ...localCat,
      ...cloudCat,
      setsCleared: setEntries.length,
      totalPoints: Math.max(localCat.totalPoints || 0, categoryTotalPoints),
      avgPointsPerSet: totalClearsAcrossCategory > 0 ? Math.round(categoryTotalPoints / totalClearsAcrossCategory) : 0,
      fastestFirstTimeOverall: allFirstTimes.length > 0 ? Math.min(...allFirstTimes) : null,
      fastestRepeatOverall: allRepeats.length > 0 ? Math.min(...allRepeats) : null,
      sets: mergedSets
    };
  });

  return merged;
}

export async function restoreProgressFromCloud(localStats = {}) {
  const effectiveLocalStats = (localStats && Object.keys(localStats).length > 0)
    ? localStats
    : (() => {
        try {
          const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('diff_hunter_categorized_stats') : null;
          return saved ? JSON.parse(saved) : {};
        } catch (_) {
          return {};
        }
      })();

  const player = await getPlayer();
  if (!player) return effectiveLocalStats;

  let cloudDifficultyStats = null;

  // 1. Check if current auth UID has a leaderboard doc with difficultyStats
  try {
    const userDoc = await getDoc(doc(player.db, 'leaderboards', player.uid));
    if (userDoc.exists() && userDoc.data()?.difficultyStats) {
      cloudDifficultyStats = userDoc.data().difficultyStats;
    }
  } catch (e) {
    console.warn('Could not fetch user leaderboard doc:', e);
  }

  // 2. If no stats on current auth UID, query by Game Center ID if available
  if (!cloudDifficultyStats) {
    const gcPlayer = getGameCenterPlayer();
    const gameCenterId = gcPlayer?.gamePlayerID || gcPlayer?.teamPlayerID || null;
    if (gameCenterId) {
      try {
        const q = query(
          collection(player.db, 'leaderboards'),
          where('gameCenterId', '==', gameCenterId),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const matchedDoc = snap.docs[0].data();
          if (matchedDoc?.difficultyStats) {
            cloudDifficultyStats = matchedDoc.difficultyStats;
          }
        }
      } catch (e) {
        console.warn('Could not query leaderboards by gameCenterId:', e);
      }
    }
  }

  if (!cloudDifficultyStats) {
    // Fallback to image-level history sync if no categorizedStats doc exists
    return syncProgressFromFirestore(effectiveLocalStats);
  }

  const mergedStats = mergeDifficultyStats(effectiveLocalStats, cloudDifficultyStats);

  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem('diff_hunter_categorized_stats', JSON.stringify(mergedStats));
    }
  } catch (_) {}

  const hasAnyClears = Object.values(mergedStats).some(cat =>
    cat?.setsCleared > 0 || (cat?.sets && Object.keys(cat.sets).length > 0)
  );
  if (hasAnyClears) {
    markFirstSetCompleted();
  }

  // Re-save under current player's auth UID so their current session is updated
  saveLeaderboardStats(mergedStats).catch(() => {});

  return mergedStats;
}

/**
 * Build the progress document for an image completion.
 * Set-scoped records keep their stable identity and aggregate timing fields;
 * callers without set metadata retain the original image-history schema.
 */
export function buildImageProgressPayload({
  imageId,
  packId,
  title,
  completionTimeMs,
  isFirstSeen,
  clears,
  setId,
  entryIds,
  existingData = {}
}) {
  const existing = existingData || {};
  const hasSetIdentity = typeof setId === 'string' && setId.trim().length > 0;
  const existingFirstTime = typeof existing.firstTime === 'number'
    ? existing.firstTime
    : (typeof existing.firstSeenTimeMs === 'number' ? existing.firstSeenTimeMs : null);
  const existingRepeat = typeof existing.fastestRepeat === 'number'
    ? existing.fastestRepeat
    : (typeof existing.bestRepeatTimeMs === 'number' ? existing.bestRepeatTimeMs : null);
  const effectiveIsFirstSeen = Boolean(isFirstSeen) && !existingFirstTime;

  const payload = {
    imageId,
    packId,
    title,
    clears: Math.max(clears || 1, (existing.clears || 0) + 1),
    updatedAt: new Date().toISOString()
  };

  if (hasSetIdentity) {
    payload.setId = setId.trim();
    if (Array.isArray(entryIds)) payload.entryIds = [...entryIds];

    const firstTime = effectiveIsFirstSeen ? completionTimeMs : existingFirstTime;
    const fastestRepeat = effectiveIsFirstSeen
      ? null
      : (existingRepeat ? Math.min(existingRepeat, completionTimeMs) : completionTimeMs);
    const validTimes = [firstTime, fastestRepeat].filter(time => typeof time === 'number' && time > 0);
    payload.firstTime = firstTime;
    payload.fastestRepeat = fastestRepeat;
    payload.fastestTime = validTimes.length > 0 ? Math.min(...validTimes) : null;
    return payload;
  }

  // Legacy image history fields remain unchanged for records without setId.
  if (effectiveIsFirstSeen) {
    payload.firstSeenTimeMs = completionTimeMs;
  } else {
    payload.bestRepeatTimeMs = existingRepeat ? Math.min(existingRepeat, completionTimeMs) : completionTimeMs;
  }
  return payload;
}

export async function saveImageProgress({ imageId, packId, title, completionTimeMs, isFirstSeen, clears, setId, entryIds }) {
  const player = await getPlayer();
  if (!player) return false;

  const docRef = doc(player.db, 'players', player.uid, 'images', imageId);

  try {
    const existingDoc = await getDoc(docRef);
    const alreadySeenInCloud = existingDoc.exists() && !!existingDoc.data()?.firstSeenTimeMs;

    // Anti-tamper protection is applied by the payload builder from cloud data.
    const payload = buildImageProgressPayload({
      imageId,
      packId,
      title,
      completionTimeMs,
      isFirstSeen: isFirstSeen && !alreadySeenInCloud,
      clears,
      setId,
      entryIds,
      existingData: existingDoc.exists() ? existingDoc.data() : {}
    });

    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (_) {
    return false;
  }
}

export async function saveLeaderboardStats(difficultyStats) {
  const player = await getPlayer();
  const name = getSavedPlayerName();
  const payload = computeLeaderboardPayload(difficultyStats, name);

  const gcPlayer = getGameCenterPlayer();
  const gameCenterId = gcPlayer?.gamePlayerID || gcPlayer?.teamPlayerID || null;

  if (!player) {
    try {
      localStorage.setItem('diff_hunter_local_leaderboard', JSON.stringify({ ...payload, uid: 'local_player' }));
    } catch (_) {}
    return false;
  }

  try {
    const dataToSave = {
      ...payload,
      uid: player.uid,
      difficultyStats: difficultyStats || null
    };
    if (gameCenterId) {
      dataToSave.gameCenterId = gameCenterId;
    }
    await setDoc(doc(player.db, 'leaderboards', player.uid), dataToSave, { merge: true });
    recordNetworkSuccess();

    // Mirror qualifying scores into durable central leaderboards
    try {
      if (payload.fastestTimeByPack?.find_the_sniper) {
        submitLeaderboardScore({
          boardType: 'category',
          boardId: 'photo',
          score: payload.fastestTimeByPack.find_the_sniper,
          metric: 'elapsedMs'
        }).catch(() => {});
      }
      if (payload.fastestTimeByPack?.abstract_animated) {
        submitLeaderboardScore({
          boardType: 'category',
          boardId: 'abstract',
          score: payload.fastestTimeByPack.abstract_animated,
          metric: 'elapsedMs'
        }).catch(() => {});
      }
      if (payload.bySetFirst) {
        Object.entries(payload.bySetFirst).forEach(([setId, timeMs]) => {
          if (timeMs && typeof timeMs === 'number' && timeMs > 0) {
            submitLeaderboardScore({
              boardType: 'photoSet',
              boardId: setId,
              score: timeMs,
              metric: 'elapsedMs'
            }).catch(() => {});
          }
        });
      }
    } catch (_) {}

    return true;
  } catch (err) {
    console.warn('Firestore saveLeaderboardStats error:', err);
    return false;
  }
}

const fallbackEntries = [
  { uid: 'demo_1', playerName: 'PixelSniper_Pro', avgFirstTimeByPack: { find_the_sniper: 11200, abstract_animated: 14500 }, avgRepeatTimeByPack: { find_the_sniper: 8900, abstract_animated: 11400 }, fastestTimeByPack: { find_the_sniper: 2450, abstract_animated: 3100 }, totalSetsCleared: 24, isCurrentPlayer: false },
  { uid: 'demo_2', playerName: 'VortexEagle', avgFirstTimeByPack: { find_the_sniper: 12800, abstract_animated: 16200 }, avgRepeatTimeByPack: { find_the_sniper: 10400, abstract_animated: 13100 }, fastestTimeByPack: { find_the_sniper: 2890, abstract_animated: 3650 }, totalSetsCleared: 18, isCurrentPlayer: false },
  { uid: 'demo_3', playerName: 'ChronoMaster', avgFirstTimeByPack: { find_the_sniper: 14200, abstract_animated: 18100 }, avgRepeatTimeByPack: { find_the_sniper: 11800, abstract_animated: 14900 }, fastestTimeByPack: { find_the_sniper: 3420, abstract_animated: 4100 }, totalSetsCleared: 15, isCurrentPlayer: false },
  { uid: 'demo_4', playerName: 'ApexHawk_X', avgFirstTimeByPack: { find_the_sniper: 15900, abstract_animated: 19800 }, avgRepeatTimeByPack: { find_the_sniper: 13200, abstract_animated: 16800 }, fastestTimeByPack: { find_the_sniper: 3950, abstract_animated: 4850 }, totalSetsCleared: 12, isCurrentPlayer: false },
  { uid: 'demo_5', playerName: 'NovaSeeker', avgFirstTimeByPack: { find_the_sniper: 17400, abstract_animated: 21900 }, avgRepeatTimeByPack: { find_the_sniper: 14600, abstract_animated: 18500 }, fastestTimeByPack: { find_the_sniper: 4600, abstract_animated: 5500 }, totalSetsCleared: 9, isCurrentPlayer: false },
  { uid: 'demo_6', playerName: 'ShadowGlint', avgFirstTimeByPack: { find_the_sniper: 18800, abstract_animated: 23200 }, avgRepeatTimeByPack: { find_the_sniper: 15800, abstract_animated: 19700 }, fastestTimeByPack: { find_the_sniper: 4950, abstract_animated: 5900 }, totalSetsCleared: 8, isCurrentPlayer: false },
  { uid: 'demo_7', playerName: 'NeonStalker', avgFirstTimeByPack: { find_the_sniper: 20100, abstract_animated: 24800 }, avgRepeatTimeByPack: { find_the_sniper: 17100, abstract_animated: 21200 }, fastestTimeByPack: { find_the_sniper: 5300, abstract_animated: 6400 }, totalSetsCleared: 7, isCurrentPlayer: false },
  { uid: 'demo_8', playerName: 'SwiftRetina', avgFirstTimeByPack: { find_the_sniper: 21600, abstract_animated: 26500 }, avgRepeatTimeByPack: { find_the_sniper: 18400, abstract_animated: 22800 }, fastestTimeByPack: { find_the_sniper: 5750, abstract_animated: 6900 }, totalSetsCleared: 6, isCurrentPlayer: false },
  { uid: 'demo_9', playerName: 'AeroGaze', avgFirstTimeByPack: { find_the_sniper: 23000, abstract_animated: 28100 }, avgRepeatTimeByPack: { find_the_sniper: 19800, abstract_animated: 24300 }, fastestTimeByPack: { find_the_sniper: 6200, abstract_animated: 7400 }, totalSetsCleared: 6, isCurrentPlayer: false },
  { uid: 'demo_10', playerName: 'QuantumRider', avgFirstTimeByPack: { find_the_sniper: 24500, abstract_animated: 29800 }, avgRepeatTimeByPack: { find_the_sniper: 21200, abstract_animated: 25900 }, fastestTimeByPack: { find_the_sniper: 6700, abstract_animated: 7950 }, totalSetsCleared: 5, isCurrentPlayer: false },
  { uid: 'demo_11', playerName: 'PrismRanger', avgFirstTimeByPack: { find_the_sniper: 26000, abstract_animated: 31500 }, avgRepeatTimeByPack: { find_the_sniper: 22600, abstract_animated: 27500 }, fastestTimeByPack: { find_the_sniper: 7200, abstract_animated: 8500 }, totalSetsCleared: 5, isCurrentPlayer: false },
  { uid: 'demo_12', playerName: 'SpecterPulse', avgFirstTimeByPack: { find_the_sniper: 27600, abstract_animated: 33200 }, avgRepeatTimeByPack: { find_the_sniper: 24100, abstract_animated: 29100 }, fastestTimeByPack: { find_the_sniper: 7750, abstract_animated: 9100 }, totalSetsCleared: 4, isCurrentPlayer: false },
  { uid: 'demo_13', playerName: 'HyperSight', avgFirstTimeByPack: { find_the_sniper: 29200, abstract_animated: 35000 }, avgRepeatTimeByPack: { find_the_sniper: 25700, abstract_animated: 30800 }, fastestTimeByPack: { find_the_sniper: 8300, abstract_animated: 9750 }, totalSetsCleared: 4, isCurrentPlayer: false },
  { uid: 'demo_14', playerName: 'FalconTrace', avgFirstTimeByPack: { find_the_sniper: 30900, abstract_animated: 36900 }, avgRepeatTimeByPack: { find_the_sniper: 27300, abstract_animated: 32600 }, fastestTimeByPack: { find_the_sniper: 8900, abstract_animated: 10400 }, totalSetsCleared: 3, isCurrentPlayer: false },
  { uid: 'demo_15', playerName: 'ZenithVector', avgFirstTimeByPack: { find_the_sniper: 32700, abstract_animated: 38800 }, avgRepeatTimeByPack: { find_the_sniper: 29000, abstract_animated: 34500 }, fastestTimeByPack: { find_the_sniper: 9550, abstract_animated: 11100 }, totalSetsCleared: 3, isCurrentPlayer: false },
  { uid: 'demo_16', playerName: 'MirageOptic', avgFirstTimeByPack: { find_the_sniper: 34600, abstract_animated: 40800 }, avgRepeatTimeByPack: { find_the_sniper: 30800, abstract_animated: 36500 }, fastestTimeByPack: { find_the_sniper: 10200, abstract_animated: 11850 }, totalSetsCleared: 2, isCurrentPlayer: false },
  { uid: 'demo_17', playerName: 'OmegaLens', avgFirstTimeByPack: { find_the_sniper: 36600, abstract_animated: 42900 }, avgRepeatTimeByPack: { find_the_sniper: 32700, abstract_animated: 38600 }, fastestTimeByPack: { find_the_sniper: 10900, abstract_animated: 12650 }, totalSetsCleared: 2, isCurrentPlayer: false },
  { uid: 'demo_18', playerName: 'ApexScout', avgFirstTimeByPack: { find_the_sniper: 38700, abstract_animated: 45100 }, avgRepeatTimeByPack: { find_the_sniper: 34700, abstract_animated: 40800 }, fastestTimeByPack: { find_the_sniper: 11650, abstract_animated: 13500 }, totalSetsCleared: 1, isCurrentPlayer: false },
  { uid: 'demo_19', playerName: 'VividRacer', avgFirstTimeByPack: { find_the_sniper: 41000, abstract_animated: 47400 }, avgRepeatTimeByPack: { find_the_sniper: 36800, abstract_animated: 43100 }, fastestTimeByPack: { find_the_sniper: 12450, abstract_animated: 14400 }, totalSetsCleared: 1, isCurrentPlayer: false },
  { uid: 'demo_20', playerName: 'CobaltShift', avgFirstTimeByPack: { find_the_sniper: 43500, abstract_animated: 49800 }, avgRepeatTimeByPack: { find_the_sniper: 39100, abstract_animated: 45400 }, fastestTimeByPack: { find_the_sniper: 13300, abstract_animated: 15300 }, totalSetsCleared: 1, isCurrentPlayer: false },
  { uid: 'demo_21', playerName: 'SolarFlare', avgFirstTimeByPack: { find_the_sniper: 46200, abstract_animated: 52400 }, avgRepeatTimeByPack: { find_the_sniper: 41500, abstract_animated: 47900 }, fastestTimeByPack: { find_the_sniper: 14200, abstract_animated: 16300 }, totalSetsCleared: 1, isCurrentPlayer: false },
  { uid: 'demo_22', playerName: 'LunarPulse', avgFirstTimeByPack: { find_the_sniper: 49000, abstract_animated: 55200 }, avgRepeatTimeByPack: { find_the_sniper: 44100, abstract_animated: 50600 }, fastestTimeByPack: { find_the_sniper: 15200, abstract_animated: 17400 }, totalSetsCleared: 1, isCurrentPlayer: false },
  { uid: 'demo_23', playerName: 'TitanGaze', avgFirstTimeByPack: { find_the_sniper: 52000, abstract_animated: 58100 }, avgRepeatTimeByPack: { find_the_sniper: 46900, abstract_animated: 53500 }, fastestTimeByPack: { find_the_sniper: 16300, abstract_animated: 18600 }, totalSetsCleared: 1, isCurrentPlayer: false },
  { uid: 'demo_24', playerName: 'EchoStrike', avgFirstTimeByPack: { find_the_sniper: 55200, abstract_animated: 61200 }, avgRepeatTimeByPack: { find_the_sniper: 49800, abstract_animated: 56600 }, fastestTimeByPack: { find_the_sniper: 17500, abstract_animated: 19900 }, totalSetsCleared: 1, isCurrentPlayer: false }
];

export async function fetchLeaderboards(localDifficultyStats = {}) {
  const fetchPromise = (async () => {
    const localPayload = computeLeaderboardPayload(localDifficultyStats, getSavedPlayerName());
    const localPlayerEntry = {
      uid: 'local_player',
      ...localPayload,
      isCurrentPlayer: true
    };

    const firestoreEntries = [];
    let isCloud = false;

    try {
      const player = await getPlayer();
      if (player) {
        recordNetworkSuccess();
        isCloud = true;
        const snap = await getDocs(collection(player.db, 'leaderboards'));
        recordNetworkSuccess();
        snap.forEach(docSnap => {
          const data = docSnap.data();
          const isMe = data.uid === player.uid;
          firestoreEntries.push({
            ...data,
            isCurrentPlayer: isMe
          });
        });
      }
    } catch (e) {
      console.warn('Could not fetch Firestore leaderboards:', e);
    }

    const allEntriesMap = new Map();

  fallbackEntries.forEach(entry => allEntriesMap.set(entry.uid, entry));
  firestoreEntries.forEach(entry => allEntriesMap.set(entry.uid, entry));
  allEntriesMap.set('local_player', localPlayerEntry);

  const combinedList = Array.from(allEntriesMap.values());

  const getTop20ForPack = (packId) => {
    return combinedList
      .map(p => {
        let firstTime = p.avgFirstTimeByPack?.[packId];
        let repeatTime = p.avgRepeatTimeByPack?.[packId] || p.avgTimesByPack?.[packId];
        let fastestTime = p.fastestTimeByPack?.[packId];

        if (!firstTime && p.avgFirstTimeByDifficulty) {
          const diffs = Object.values(p.avgFirstTimeByDifficulty).filter(t => typeof t === 'number' && t > 0);
          if (diffs.length > 0) firstTime = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
        }

        if (!repeatTime && p.avgRepeatTimeByDifficulty) {
          const diffs = Object.values(p.avgRepeatTimeByDifficulty).filter(t => typeof t === 'number' && t > 0);
          if (diffs.length > 0) repeatTime = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
        }

        if (!fastestTime && repeatTime) {
          fastestTime = Math.round(repeatTime * 0.32);
        }

        if (!p.isCurrentPlayer) {
          if (!firstTime) firstTime = packId === 'abstract_animated' ? 16500 : 13800;
          if (!repeatTime) repeatTime = packId === 'abstract_animated' ? 14200 : 12500;
          if (!fastestTime) fastestTime = packId === 'abstract_animated' ? 4200 : 3500;
        }

        // Placement is combination of all 3 metrics
        const validMetrics = [firstTime, repeatTime, fastestTime].filter(t => typeof t === 'number' && t > 0);
        const compositeScore = validMetrics.length > 0
          ? Math.round(validMetrics.reduce((a, b) => a + b, 0) / validMetrics.length)
          : 999999;

        return {
          ...p,
          firstTime,
          repeatTime,
          fastestTime,
          effectiveTime: firstTime || repeatTime || 999999,
          compositeScore
        };
      })
      .sort((a, b) => {
        const timeA = a.firstTime || (a.repeatTime ? a.repeatTime * 1.25 : 999999);
        const timeB = b.firstTime || (b.repeatTime ? b.repeatTime * 1.25 : 999999);
        if (timeA !== timeB) return timeA - timeB;
        const repeatA = a.repeatTime || 999999;
        const repeatB = b.repeatTime || 999999;
        if (repeatA !== repeatB) return repeatA - repeatB;
        const fastA = a.fastestTime || 999999;
        const fastB = b.fastestTime || 999999;
        return fastA - fastB;
      })
      .slice(0, 25);
  };

  const getTop20ForSet = (setId, metric = 'firstTime') => {
    const realPlayers = combinedList
      .map(player => {
        const firstTime = player.bySetFirst?.[setId];
        const repeatTime = player.bySetRepeat?.[setId];
        const fastestTime = player.fastestTimeBySet?.[setId];
        const mostPoints = player.bySetPoints?.[setId]
          || (fastestTime ? Math.max(1200, Math.round(2500 - (fastestTime / 1000) * 35)) : null);
        const isFirstFailed = player.bySetFirst?.[setId] === 'failed' || Boolean(player.firstFailed);
        return {
          ...player,
          firstTime,
          repeatTime,
          fastestTime,
          mostPoints,
          firstFailed: isFirstFailed,
          effectiveTime: (typeof firstTime === 'number' && firstTime > 0) ? firstTime : (repeatTime || 999999)
        };
      })
      .filter(player => typeof player.firstTime === 'number' || typeof player.repeatTime === 'number' || player.firstTime === 'failed' || player.firstFailed);

    const baseline = getDeterministicSetBaseline(setId);
    const existingUids = new Set(realPlayers.map(p => p.uid));
    const merged = [...realPlayers];
    for (const b of baseline) {
      if (!existingUids.has(b.uid)) {
        merged.push(b);
      }
    }

    return merged
      .sort((a, b) => {
        const getSortVal = (p) => {
          if (metric === 'firstTime') {
            if (p.firstTime === 'failed' || p.firstFailed) return 999990;
            return typeof p.firstTime === 'number' ? p.firstTime : 999999;
          }
          const val = p[metric] ?? p.fastestTime;
          return typeof val === 'number' ? val : 999999;
        };
        return getSortVal(a) - getSortVal(b);
      })
      .slice(0, 25);
  };

  const setIds = [...new Set([
    ...ALL_PHOTO_SET_IDS,
    ...combinedList.flatMap(player => Object.keys(player.bySetFirst || {}))
  ])];

    return {
      isCloud,
      byPackFirst: {
        find_the_sniper: getTop20ForPack('find_the_sniper'),
        abstract_animated: getTop20ForPack('abstract_animated')
      },
      byPackRepeat: {
        find_the_sniper: getTop20ForPack('find_the_sniper'),
        abstract_animated: getTop20ForPack('abstract_animated')
      },
      bySetFirst: Object.fromEntries(setIds.map(setId => [setId, getTop20ForSet(setId, 'firstTime')])),
      bySetRepeat: Object.fromEntries(setIds.map(setId => [setId, getTop20ForSet(setId, 'repeatTime')])),
      bySetFastest: Object.fromEntries(setIds.map(setId => [setId, getTop20ForSet(setId, 'fastestTime')])),
      fastestTimeBySet: localPlayerEntry.fastestTimeBySet,
      localPlayer: localPlayerEntry
    };
  })();

  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => {
      const localPayload = computeLeaderboardPayload(localDifficultyStats, getSavedPlayerName());
      const localPlayerEntry = {
        uid: 'local_player',
        ...localPayload,
        isCurrentPlayer: true
      };

      const getFallbackListForPack = (packId) => {
        return [localPlayerEntry, ...fallbackEntries].map(p => {
          let firstTime = p.avgFirstTimeByPack?.[packId];
          let repeatTime = p.avgRepeatTimeByPack?.[packId] || p.avgTimesByPack?.[packId];
          let fastestTime = p.fastestTimeByPack?.[packId];

          if (!p.isCurrentPlayer) {
            if (!firstTime) firstTime = packId === 'abstract_animated' ? 16500 : 13800;
            if (!repeatTime) repeatTime = packId === 'abstract_animated' ? 14200 : 12500;
            if (!fastestTime) fastestTime = packId === 'abstract_animated' ? 4200 : 3500;
          }

          const validMetrics = [firstTime, repeatTime, fastestTime].filter(t => typeof t === 'number' && t > 0);
          const compositeScore = validMetrics.length > 0
            ? Math.round(validMetrics.reduce((a, b) => a + b, 0) / validMetrics.length)
            : 999999;

          return {
            ...p,
            firstTime,
            repeatTime,
            fastestTime,
            effectiveTime: firstTime || repeatTime || 999999,
            compositeScore
          };
        }).sort((a, b) => {
          const timeA = a.firstTime || (a.repeatTime ? a.repeatTime * 1.25 : 999999);
          const timeB = b.firstTime || (b.repeatTime ? b.repeatTime * 1.25 : 999999);
          if (timeA !== timeB) return timeA - timeB;
          return (a.repeatTime || 999999) - (b.repeatTime || 999999);
        }).slice(0, 25);
      };

      const setIds = [...new Set([
        ...ALL_PHOTO_SET_IDS,
        ...(localPayload.bySetFirst ? Object.keys(localPayload.bySetFirst) : [])
      ])];
      const getFallbackListForSet = (setId) => {
        const local = [localPlayerEntry, ...fallbackEntries]
          .map(player => ({
            ...player,
            firstTime: player.bySetFirst?.[setId],
            repeatTime: player.bySetRepeat?.[setId],
            fastestTime: player.fastestTimeBySet?.[setId],
            firstFailed: player.bySetFirst?.[setId] === 'failed' || Boolean(player.firstFailed)
          }))
          .filter(player => typeof player.firstTime === 'number' || typeof player.repeatTime === 'number' || player.firstTime === 'failed' || player.firstFailed);

        const baseline = getDeterministicSetBaseline(setId);
        const existingUids = new Set(local.map(p => p.uid));
        const merged = [...local];
        for (const b of baseline) {
          if (!existingUids.has(b.uid)) {
            merged.push(b);
          }
        }
        return merged;
      };

      resolve({
        isCloud: false,
        byPackFirst: {
          find_the_sniper: getFallbackListForPack('find_the_sniper'),
          abstract_animated: getFallbackListForPack('abstract_animated')
        },
        byPackRepeat: {
          find_the_sniper: getFallbackListForPack('find_the_sniper'),
          abstract_animated: getFallbackListForPack('abstract_animated')
        },
        bySetFirst: Object.fromEntries(setIds.map(setId => [
          setId,
          getFallbackListForSet(setId).sort((a, b) => {
            const valA = (a.firstTime === 'failed' || a.firstFailed) ? 999990 : (typeof a.firstTime === 'number' ? a.firstTime : 999999);
            const valB = (b.firstTime === 'failed' || b.firstFailed) ? 999990 : (typeof b.firstTime === 'number' ? b.firstTime : 999999);
            return valA - valB;
          }).slice(0, 25)
        ])),
        bySetRepeat: Object.fromEntries(setIds.map(setId => [setId, getFallbackListForSet(setId).sort((a, b) => (a.repeatTime || 999999) - (b.repeatTime || 999999)).slice(0, 25)])),
        bySetFastest: Object.fromEntries(setIds.map(setId => [setId, getFallbackListForSet(setId).sort((a, b) => (a.fastestTime || 999999) - (b.fastestTime || 999999)).slice(0, 25)])),
        fastestTimeBySet: localPlayerEntry.fastestTimeBySet,
        localPlayer: localPlayerEntry
      });
    }, 6500);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}
