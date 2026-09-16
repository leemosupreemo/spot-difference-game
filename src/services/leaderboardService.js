import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getFirestore, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfig, getCurrentPlayerId, getCurrentAuthUser } from './authService.js';
import { getSavedPlayerName } from './playerProgress.js';
import { getDeterministicSetBaseline } from '../utils/setLeaderboards.js';
import { generateDefaultDailyBaseline } from './dailyChallenge.js';
import {
  isGameCenterSupported,
  isGameCenterAuthenticated,
  submitGameCenterScore
} from './gameCenter.js';
import { isOnline, queuePendingSubmission, syncPendingSubmissions, registerSyncRunner, recordNetworkSuccess } from './networkService.js';
import { isScreenshotHarnessMode } from '../utils/screenshotMode.js';

registerSyncRunner(() => syncPendingSubmissions(submitLeaderboardScore));

export const LEADERBOARD_LIMITS = {
  daily: 5,
  category: 25,
  photoSet: 3
};

const STORAGE_PREFIX = 'diff_hunter_lb_';
const APP_VERSION = '1.4.0';

function getPlatform() {
  if (typeof window === 'undefined') return 'web';
  if (window.Capacitor?.isNativePlatform?.()) {
    return window.Capacitor.getPlatform?.() || 'mobile';
  }
  return 'web';
}

function getLeaderboardDb() {
  if (typeof window === 'undefined' || isScreenshotHarnessMode()) return null;
  try {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    return getFirestore(app);
  } catch (err) {
    console.warn('Leaderboard Firestore init error:', err?.message || err);
    return null;
  }
}

let functionsInstance = null;
function getFirebaseFunctions() {
  if (typeof window === 'undefined') return null;
  if (!functionsInstance) {
    try {
      const app = getApps()[0] || initializeApp(firebaseConfig);
      functionsInstance = getFunctions(app);
    } catch (err) {
      console.warn('Firebase Functions init warning:', err?.message || err);
    }
  }
  return functionsInstance;
}

/**
 * Pure evaluation function for qualification rules.
 * 
 * Rules:
 * - Photo Set: Top 3
 * - Daily: Top 5
 * - Category: Top 25
 * - For metric 'elapsedMs': lower is better.
 * - For metric 'points' or 'score': higher is better.
 * - Single player deduplication: keep only their best result.
 * 
 * @param {Array<Object>} currentEntries
 * @param {Object} candidate
 * @param {number} limit
 * @param {'elapsedMs'|'points'} metric
 * @returns {{ qualifies: boolean, updatedEntries: Array<Object>, rank: number|null, replacedEntry: Object|null }}
 */
export function evaluateLeaderboardQualification(
  currentEntries = [],
  candidate,
  limit = 10,
  metric = 'elapsedMs'
) {
  if (!candidate || typeof candidate.score !== 'number' || candidate.score <= 0) {
    return { qualifies: false, updatedEntries: currentEntries, rank: null, replacedEntry: null };
  }

  const isLowerBetter = metric === 'elapsedMs';
  const isBetter = (a, b) => isLowerBetter ? a < b : a > b;

  // Clone entries to avoid mutating inputs
  const entries = currentEntries.map(e => ({ ...e }));

  // Check if player already exists on this leaderboard
  const existingPlayerIndex = entries.findIndex(e => e.playerId === candidate.playerId);
  if (existingPlayerIndex >= 0) {
    const existingScore = entries[existingPlayerIndex].score;
    // If new score is not an improvement over the player's existing record, reject
    if (!isBetter(candidate.score, existingScore)) {
      return {
        qualifies: false,
        updatedEntries: entries,
        rank: entries[existingPlayerIndex].rank || (existingPlayerIndex + 1),
        replacedEntry: null
      };
    }
    // Remove player's existing entry so they only hold their best position
    entries.splice(existingPlayerIndex, 1);
  }

  // Check qualification against current entries and limit
  const hasSpace = entries.length < limit;
  const worstEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const beatsWorst = worstEntry ? isBetter(candidate.score, worstEntry.score) : true;

  if (!hasSpace && !beatsWorst) {
    return { qualifies: false, updatedEntries: currentEntries, rank: null, replacedEntry: null };
  }

  // Insert candidate
  entries.push({ ...candidate });

  // Sort entries: ascending for time, descending for points
  entries.sort((a, b) => isLowerBetter ? a.score - b.score : b.score - a.score);

  // Slice to limit
  const trimmed = entries.slice(0, limit);

  // Re-rank 1..N
  const ranked = trimmed.map((e, index) => ({
    ...e,
    rank: index + 1
  }));

  const playerRankIndex = ranked.findIndex(e => e.playerId === candidate.playerId);
  const rank = playerRankIndex >= 0 ? playerRankIndex + 1 : null;

  return {
    qualifies: rank !== null,
    updatedEntries: ranked,
    rank,
    replacedEntry: worstEntry && !hasSpace ? worstEntry : null
  };
}

/**
 * Returns deterministic baseline entries for boards that have not filled up yet.
 */
export function getBaselineEntries(boardType, boardId) {
  if (boardType === 'photoSet') {
    const raw = getDeterministicSetBaseline(boardId);
    return raw.slice(0, 3).map((b, idx) => ({
      playerId: b.uid,
      displayName: b.playerName,
      boardType: 'photoSet',
      boardId,
      score: b.fastestTime || b.repeatTime || b.firstTime,
      metric: 'elapsedMs',
      rank: idx + 1,
      submittedAt: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
      platform: 'web',
      appVersion: APP_VERSION,
      isCurrentPlayer: false
    }));
  }

  if (boardType === 'daily') {
    const raw = generateDefaultDailyBaseline(boardId);
    return raw.slice(0, 5).map((b, idx) => ({
      playerId: b.uid || `bot_${idx}`,
      displayName: b.playerName,
      boardType: 'daily',
      boardId,
      score: b.totalTimeMs,
      metric: 'elapsedMs',
      rank: idx + 1,
      submittedAt: new Date(Date.now() - (idx + 1) * 1800000).toISOString(),
      platform: 'web',
      appVersion: APP_VERSION,
      isCurrentPlayer: false
    }));
  }

  if (boardType === 'category') {
    const baseTime = boardId === 'abstract' ? 14500 : 11500;
    const names = [
      'PixelSniper_Pro', 'VortexEagle', 'ChronoMaster', 'ApexHawk_X', 'NovaSeeker',
      'ShadowGlint', 'NeonStalker', 'SwiftRetina', 'AeroGaze', 'QuantumRider',
      'PrismRanger', 'SpecterPulse', 'HyperSight', 'FalconTrace', 'ZenithVector',
      'MirageOptic', 'OmegaLens', 'ApexScout', 'VividRacer', 'CobaltShift',
      'SolarFlare', 'LunarPulse', 'TitanGaze', 'EchoStrike', 'NeonVanguard'
    ];
    return names.slice(0, 25).map((name, idx) => ({
      playerId: `bot_cat_${idx}`,
      displayName: name,
      boardType: 'category',
      boardId,
      score: baseTime + (idx * 1400),
      metric: 'elapsedMs',
      rank: idx + 1,
      submittedAt: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
      platform: 'web',
      appVersion: APP_VERSION,
      isCurrentPlayer: false
    }));
  }

  return [];
}

const inMemoryCache = new Map();

/**
 * Gets cached leaderboard entries from memory/local storage or returns baseline.
 */
export function getCachedLeaderboard(boardType, boardId) {
  const currentUid = getCurrentPlayerId();
  const storageKey = `${STORAGE_PREFIX}${boardType}_${boardId}`;
  let entries = inMemoryCache.get(storageKey) || null;

  if (!entries) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem) {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          entries = JSON.parse(raw);
        }
      }
    } catch (_) {}
  }

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    entries = getBaselineEntries(boardType, boardId);
  }

  return entries.map(e => ({
    ...e,
    isCurrentPlayer: Boolean(e.playerId && e.playerId === currentUid)
  }));
}

/**
 * Saves leaderboard entries to local storage and memory cache.
 */
export function cacheLeaderboard(boardType, boardId, entries) {
  const storageKey = `${STORAGE_PREFIX}${boardType}_${boardId}`;
  inMemoryCache.set(storageKey, entries);
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    }
  } catch (_) {}
}

/**
 * Submits a score to a durable Firestore leaderboard.
 * 
 * Flow:
 * 1. Checks qualification against current leaderboard & limit (Top 3 for sets, Top 5 for daily, Top 25 for category).
 * 2. If qualifies, updates Firestore atomically/transactionally.
 * 3. Updates local storage cache.
 * 4. Optionally mirrors to Apple Game Center in the background as an extension if connected.
 * 
 * @param {Object} params
 * @param {'daily'|'category'|'photoSet'} params.boardType
 * @param {string} params.boardId
 * @param {number} params.score
 * @param {'elapsedMs'|'points'} [params.metric='elapsedMs']
 * @param {string} [params.displayName]
 * @param {string} [params.platform]
 * @param {string} [params.appVersion]
 * @returns {Promise<{ qualified: boolean, rank: number|null, entries: Array<Object> }>}
 */
export async function submitLeaderboardScore({
  boardType,
  boardId,
  score,
  metric = 'elapsedMs',
  displayName = null,
  platform = null,
  appVersion = APP_VERSION
}) {
  const currentUid = getCurrentPlayerId();
  const effectiveName = displayName || getSavedPlayerName() || `Player ${currentUid.slice(-4).toUpperCase()}`;
  const effectivePlatform = platform || getPlatform();
  const limit = LEADERBOARD_LIMITS[boardType] || 10;

  const candidate = {
    playerId: currentUid,
    displayName: effectiveName,
    boardType,
    boardId,
    score,
    metric,
    submittedAt: new Date().toISOString(),
    platform: effectivePlatform,
    appVersion
  };

  let remoteSynced = false;

  // 1. Attempt submission via trusted Firebase Cloud Function
  const functions = getFirebaseFunctions();
  if (functions && isOnline()) {
    try {
      const submitFn = httpsCallable(functions, 'submitLeaderboardScore');
      const response = await submitFn({
        boardType,
        boardId,
        score,
        metric,
        displayName: effectiveName,
        platform: effectivePlatform,
        appVersion
      });

      if (response?.data && Array.isArray(response.data.entries)) {
        const { qualified, rank, entries } = response.data;
        cacheLeaderboard(boardType, boardId, entries);

        // Optional Game Center mirror
        try {
          if (isGameCenterSupported() && isGameCenterAuthenticated()) {
            submitGameCenterScore({
              leaderboardId: GAME_CENTER_LEADERBOARDS.GLOBAL_FASTEST,
              score: Math.round(score)
            }).catch(() => {});
          }
        } catch (_) {}

        return {
          qualified,
          rank,
          entries: entries.map(e => ({
            ...e,
            isCurrentPlayer: e.playerId === currentUid
          })),
          remoteSynced: true,
          isOffline: false
        };
      }
    } catch (cloudErr) {
      console.warn('Cloud Function invocation bypassed/failed (falling back to client evaluation):', cloudErr?.message || cloudErr);
    }
  }

  // 2. Client-side local evaluation fallback (for offline or local testing)
  let currentEntries = getCachedLeaderboard(boardType, boardId);
  const db = getLeaderboardDb();
  const docKey = `${boardType}_${boardId}`;

  if (db && isOnline()) {
    try {
      const docRef = doc(db, 'leaderboards', docKey);
      const snap = await getDoc(docRef);
      if (snap.exists() && Array.isArray(snap.data()?.entries)) {
        currentEntries = snap.data().entries;
      }
    } catch (err) {
      console.warn('Could not read remote leaderboard before submit:', err?.message || err);
    }
  }

  // 3. Evaluate qualification
  const evalResult = evaluateLeaderboardQualification(currentEntries, candidate, limit, metric);

  if (!evalResult.qualifies) {
    return {
      qualified: false,
      rank: evalResult.rank,
      entries: evalResult.updatedEntries.map(e => ({
        ...e,
        isCurrentPlayer: e.playerId === currentUid
      })),
      remoteSynced: false,
      isOffline: !isOnline()
    };
  }

  const updatedEntries = evalResult.updatedEntries;

  // 4. Persist to Firestore if available and online
  if (db && isOnline()) {
    try {
      const docRef = doc(db, 'leaderboards', docKey);
      await setDoc(docRef, {
        boardType,
        boardId,
        metric,
        entries: updatedEntries,
        updatedAt: serverTimestamp()
      }, { merge: true });
      remoteSynced = true;
      recordNetworkSuccess();
    } catch (err) {
      console.warn('Firestore write failed, falling back to local leaderboard cache:', err?.message || err);
    }
  }

  // If remote write could not be performed, queue for sync once connection is restored
  if (!remoteSynced) {
    queuePendingSubmission(candidate);
  }

  // 5. Update local cache
  cacheLeaderboard(boardType, boardId, updatedEntries);

  // 6. Optional Game Center Mirroring (Purely as an extension, never an auth gate)
  try {
    if (isGameCenterSupported() && isGameCenterAuthenticated()) {
      submitGameCenterScore({
        leaderboardId: GAME_CENTER_LEADERBOARDS.GLOBAL_FASTEST,
        score: Math.round(score)
      }).catch(() => {});
    }
  } catch (_) {}

  return {
    qualified: true,
    rank: evalResult.rank,
    entries: updatedEntries.map(e => ({
      ...e,
      isCurrentPlayer: e.playerId === currentUid
    })),
    remoteSynced,
    isOffline: !isOnline()
  };
}

/**
 * Synchronous read for Daily Leaderboard.
 */
export function getDailyLeaderboard(dateStr) {
  return getCachedLeaderboard('daily', dateStr);
}

/**
 * Asynchronous fetch for Daily Leaderboard from Firestore.
 */
export async function fetchDailyLeaderboard(dateStr) {
  const currentUid = getCurrentPlayerId();
  if (isOnline()) {
    syncPendingSubmissions(submitLeaderboardScore).catch(() => {});
  }
  const db = getLeaderboardDb();
  if (!db) return getDailyLeaderboard(dateStr);

  try {
    const docRef = doc(db, 'leaderboards', `daily_${dateStr}`);
    const snap = await getDoc(docRef);
    if (snap.exists() && Array.isArray(snap.data()?.entries)) {
      recordNetworkSuccess();
      const entries = snap.data().entries;
      cacheLeaderboard('daily', dateStr, entries);
      return entries.map(e => ({
        ...e,
        isCurrentPlayer: e.playerId === currentUid
      }));
    }
  } catch (e) {
    console.warn('Failed to fetch remote daily leaderboard:', e?.message || e);
  }

  return getDailyLeaderboard(dateStr);
}

/**
 * Synchronous read for Category Leaderboard ('photo' | 'abstract').
 */
export function getCategoryLeaderboard(category) {
  return getCachedLeaderboard('category', category);
}

/**
 * Asynchronous fetch for Category Leaderboard from Firestore.
 */
export async function fetchCategoryLeaderboard(category) {
  const currentUid = getCurrentPlayerId();
  if (isOnline()) {
    syncPendingSubmissions(submitLeaderboardScore).catch(() => {});
  }
  const db = getLeaderboardDb();
  if (!db) return getCategoryLeaderboard(category);

  try {
    const docRef = doc(db, 'leaderboards', `category_${category}`);
    const snap = await getDoc(docRef);
    if (snap.exists() && Array.isArray(snap.data()?.entries)) {
      const entries = snap.data().entries;
      cacheLeaderboard('category', category, entries);
      return entries.map(e => ({
        ...e,
        isCurrentPlayer: e.playerId === currentUid
      }));
    }
  } catch (e) {
    console.warn('Failed to fetch remote category leaderboard:', e?.message || e);
  }

  return getCategoryLeaderboard(category);
}

/**
 * Synchronous read for Photo Set Leaderboard (Top 3).
 */
export function getPhotoSetLeaderboard(setId) {
  return getCachedLeaderboard('photoSet', setId);
}

/**
 * Asynchronous fetch for Photo Set Leaderboard from Firestore.
 */
export async function fetchPhotoSetLeaderboard(setId) {
  const currentUid = getCurrentPlayerId();
  if (isOnline()) {
    syncPendingSubmissions(submitLeaderboardScore).catch(() => {});
  }
  const db = getLeaderboardDb();
  if (!db) return getPhotoSetLeaderboard(setId);

  try {
    const docRef = doc(db, 'leaderboards', `photoSet_${setId}`);
    const snap = await getDoc(docRef);
    if (snap.exists() && Array.isArray(snap.data()?.entries)) {
      recordNetworkSuccess();
      const entries = snap.data().entries;
      cacheLeaderboard('photoSet', setId, entries);
      return entries.map(e => ({
        ...e,
        isCurrentPlayer: e.playerId === currentUid
      }));
    }
  } catch (e) {
    console.warn('Failed to fetch remote photoSet leaderboard:', e?.message || e);
  }

  return getPhotoSetLeaderboard(setId);
}
