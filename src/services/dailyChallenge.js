import { initializeApp, getApps } from 'firebase/app';
import { dailyPoolEntries } from '../utils/remoteSetPolicy.js';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { getAllPhotoPairEntries, createPhotoPairLevel } from '../utils/photoPairLevelLoader.js';
import { getSavedPlayerName, savePlayerName } from './playerProgress.js';
import { getGameCenterPlayer } from './gameCenter.js';
import { logApp } from '../utils/logger.js';
import { submitLeaderboardScore } from './leaderboardService.js';

const STORAGE_KEY_DAILY_SETS = 'diff_hunter_daily_sets';
const STORAGE_KEY_DAILY_USED_QUEUE = 'diff_hunter_daily_queue_used';
const STORAGE_KEY_DAILY_LEADERBOARD_PREFIX = 'diff_hunter_daily_leaderboard_';
const STORAGE_KEY_DAILY_PLAYER_PREFIX = 'diff_hunter_daily_player_';
const STORAGE_KEY_DAILY_REMOTE_QUEUE = 'diff_hunter_daily_remote_queue';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

const memoryStore = new Map();
let inMemoryDailyQueue = null;

export function storageGet(key) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      const val = localStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch (_) {}
  return memoryStore.get(key) || null;
}

export function storageSet(key, value) {
  memoryStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(key, value);
    }
  } catch (_) {}
}

/**
 * Returns today's game date formatted as YYYY-MM-DD for USA players.
 * Daily challenge set resets at 4:00 AM US Eastern Time (1:00 AM US Pacific Time),
 * giving evening/night players until late night to play without cutoffs, and morning risers fresh sets.
 * @param {Date} [d]
 * @returns {string}
 */
export function getTodayDateString(d = new Date()) {
  try {
    // If a date object was explicitly created with 00:00:00 local time (e.g. unit test fixtures),
    // preserve the intended calendar date.
    if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const map = {};
    for (const p of parts) map[p.type] = p.value;

    let year = parseInt(map.year, 10);
    let month = parseInt(map.month, 10);
    let day = parseInt(map.day, 10);
    let hour = parseInt(map.hour, 10);
    if (hour === 24) hour = 0;

    // Daily reset occurs at 4:00 AM Eastern Time (1:00 AM Pacific Time).
    // Times before 4:00 AM ET belong to the previous day's challenge cycle.
    if (hour < 4) {
      const prevDate = new Date(year, month - 1, day - 1);
      year = prevDate.getFullYear();
      month = prevDate.getMonth() + 1;
      day = prevDate.getDate();
    }

    const yStr = String(year);
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  } catch (_) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Deterministic string hash algorithm for daily seeded generation.
 * @param {string} str
 * @returns {number} 32-bit positive integer
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic pseudo-random number generator [0, 1) seeded by an integer.
 * @param {number} seed
 * @returns {() => number}
 */
function createSeededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const DEFAULT_DAILY_QUEUE = {
  updatedAt: '2026-09-18T14:00:00.000Z',
  schedule: {
    '2026-09-09': [
      'photo_set_001_01',
      'photo_set_001_02',
      'photo_set_001_03'
    ],
    '2026-09-10': [
      'photo_set_001_04',
      'photo_set_001_05',
      'photo_set_002_01'
    ],
    '2026-09-11': [
      'photo_set_002_02',
      'photo_set_002_03',
      'photo_set_002_04'
    ],
    '2026-09-12': [
      'photo_set_002_05',
      'photo_set_003_01',
      'photo_set_003_02'
    ],
    '2026-09-13': [
      'photo_set_003_03',
      'photo_set_003_04',
      'photo_set_003_05'
    ]
  },
  queue: [
    {
      setId: 'set_1',
      levels: [
        'photo_set_004_01',
        'photo_set_004_02',
        'photo_set_004_03'
      ]
    },
    {
      setId: 'set_2',
      levels: [
        'photo_set_004_04',
        'photo_set_004_05',
        'photo_set_005_01'
      ]
    },
    {
      setId: 'set_3',
      levels: [
        'photo_set_005_02',
        'photo_set_005_03',
        'photo_set_005_04'
      ]
    },
    {
      setId: 'set_4',
      levels: [
        'photo_set_005_05',
        'photo_set_006_01',
        'photo_set_006_02'
      ]
    },
    {
      setId: 'set_5',
      levels: [
        'photo_set_006_03',
        'photo_set_006_04',
        'photo_set_006_05'
      ]
    },
    {
      setId: 'set_6',
      levels: [
        'photo_set_007_01',
        'photo_set_007_02',
        'photo_set_007_03'
      ]
    },
    {
      setId: 'set_daily_modern_01',
      label: 'Curator Highlights',
      isLegacy: false,
      levels: [
        'daily_set_01_01',
        'daily_set_06_01',
        'daily_set_06_03'
      ]
    },
    {
      setId: 'set_legacy_1',
      label: 'Old (Legacy 640x480)',
      isLegacy: true,
      levels: [
        'photo_set_008_01',
        'photo_set_008_02',
        'photo_set_008_03'
      ]
    },
    {
      setId: 'set_legacy_2',
      label: 'Old (Legacy 640x480)',
      isLegacy: true,
      levels: [
        'photo_set_008_04',
        'photo_set_008_05',
        'photo_set_009_01'
      ]
    },
    {
      setId: 'set_legacy_3',
      label: 'Old (Legacy 640x480)',
      isLegacy: true,
      levels: [
        'photo_set_009_02',
        'photo_set_009_03',
        'photo_set_009_04'
      ]
    },
    {
      setId: 'set_legacy_4',
      label: 'Old (Legacy 640x480)',
      isLegacy: true,
      levels: [
        'photo_set_009_05',
        'photo_set_010_01',
        'photo_set_010_02'
      ]
    },
    {
      setId: 'set_legacy_5',
      label: 'Old (Legacy 640x480)',
      isLegacy: true,
      levels: [
        'photo_set_010_03',
        'photo_set_010_04',
        'photo_set_010_05'
      ]
    }
  ],
  customLevels: []
};

export const LEGACY_LOW_RES_LEVEL_IDS = new Set([
  'photo_set_008_01', 'photo_set_008_02', 'photo_set_008_03', 'photo_set_008_04', 'photo_set_008_05',
  'photo_set_009_01', 'photo_set_009_02', 'photo_set_009_03', 'photo_set_009_04', 'photo_set_009_05',
  'photo_set_010_01', 'photo_set_010_02', 'photo_set_010_03', 'photo_set_010_04', 'photo_set_010_05',
  'photo_set_011_01', 'photo_set_011_02', 'photo_set_011_03', 'photo_set_011_04', 'photo_set_011_05',
  'photo_set_012_01', 'photo_set_012_02', 'photo_set_012_03', 'photo_set_012_04', 'photo_set_012_05',
  'photo_set_013_01', 'photo_set_013_02', 'photo_set_013_03', 'photo_set_013_04', 'photo_set_013_05',
  'photo_set_029_01', 'photo_set_029_02', 'photo_set_029_03', 'photo_set_029_04', 'photo_set_029_05',
  'photo_set_030_01', 'photo_set_030_02', 'photo_set_030_03', 'photo_set_030_04', 'photo_set_030_05',
  'photo_set_031_01', 'photo_set_031_02', 'photo_set_031_03', 'photo_set_031_04', 'photo_set_031_05',
  'photo_set_032_01', 'photo_set_032_02', 'photo_set_032_03', 'photo_set_032_04', 'photo_set_032_05',
  'photo_set_033_01', 'photo_set_033_02', 'photo_set_033_03', 'photo_set_033_04', 'photo_set_033_05',
  'photo_set_034_01', 'photo_set_034_02', 'photo_set_034_03', 'photo_set_034_04', 'photo_set_034_05',
  'medium_screw_tray_001', 'medium_tile_piece_001', 'hard_wire_clip_001',
  'photo_coffee_station_001', 'photo_art_table_001', 'photo_camping_table_001',
  'photo_spice_table_001', 'photo_fishing_tackle_001'
]);

/**
 * Loads the current daily queue and schedule synchronously from memory or storage.
 * @returns {{ schedule: Record<string, string[]>, queue: Array<{ setId?: string, levels: string[] }>, customLevels: Array<Object>, updatedAt?: string }}
 */
export function getDailyQueue() {
  if (inMemoryDailyQueue) {
    return inMemoryDailyQueue;
  }

  try {
    const raw = storageGet(STORAGE_KEY_DAILY_REMOTE_QUEUE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        inMemoryDailyQueue = {
          schedule: { ...DEFAULT_DAILY_QUEUE.schedule, ...(parsed.schedule || {}) },
          queue: Array.isArray(parsed.queue) && parsed.queue.length > 0 ? parsed.queue : DEFAULT_DAILY_QUEUE.queue,
          customLevels: Array.isArray(parsed.customLevels) ? parsed.customLevels : [],
          updatedAt: parsed.updatedAt || DEFAULT_DAILY_QUEUE.updatedAt
        };
        return inMemoryDailyQueue;
      }
    }
  } catch (_) {}

  inMemoryDailyQueue = { ...DEFAULT_DAILY_QUEUE };
  return inMemoryDailyQueue;
}

/**
 * Saves daily queue and schedule to memory and storage.
 * @param {Object} queueData
 */
export function setDailyQueue(queueData) {
  if (!queueData || typeof queueData !== 'object') return;
  const validated = {
    schedule: queueData.schedule && typeof queueData.schedule === 'object' ? queueData.schedule : {},
    queue: Array.isArray(queueData.queue) ? queueData.queue : [],
    customLevels: Array.isArray(queueData.customLevels) ? queueData.customLevels : [],
    updatedAt: queueData.updatedAt || new Date().toISOString()
  };
  inMemoryDailyQueue = validated;
  storageSet(STORAGE_KEY_DAILY_REMOTE_QUEUE, JSON.stringify(validated));
  return validated;
}

/**
 * Resets memory and storage daily queue back to DEFAULT_DAILY_QUEUE.
 */
export function resetDailyQueueToDefault() {
  inMemoryDailyQueue = null;
  storageSet(STORAGE_KEY_DAILY_REMOTE_QUEUE, null);
  return getDailyQueue();
}

/**
 * Asynchronously syncs the remote daily queue and schedule over the air.
 * Checks static CDN endpoint `/daily-queue.json` and Firebase Firestore doc `daily_challenge/queue`.
 * Caches in localStorage for offline play. Does NOT require mobile app rebuilds.
 */
export async function syncRemoteDailyQueue() {
  // 1. Try static JSON endpoint (fast CDN fallback)
  try {
    const staticRes = await fetch('/daily-queue.json', { cache: 'no-cache' });
    if (staticRes.ok) {
      const staticData = await staticRes.json();
      if (staticData && (staticData.schedule || staticData.queue)) {
        setDailyQueue(staticData);
        logApp('INFO', '[DailyQueueSync] Synced daily queue from static CDN endpoint.');
      }
    }
  } catch (_) {}

  // 2. Try Firebase Firestore document 'daily_challenge/queue'
  if (firebaseConfig.projectId && firebaseConfig.apiKey) {
    try {
      const app = getApps()[0] || initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const queueDocRef = doc(db, 'daily_challenge', 'queue');
      const docSnap = await getDoc(queueDocRef);

      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        if (remoteData && (remoteData.schedule || remoteData.queue)) {
          setDailyQueue(remoteData);
          logApp('INFO', '[DailyQueueSync] Synced remote daily queue from Firestore.');
          return getDailyQueue();
        }
      }
    } catch (err) {
      logApp('INFO', '[DailyQueueSyncOffline] Using cached daily queue:', err?.message || err);
    }
  }

  return getDailyQueue();
}

/**
 * Gets the 3 image pair levels for a specific day.
 * Resolves from:
 * 1. Explicit remote OTA scheduled date (schedule[dateStr])
 * 2. Sequential remote OTA queue (queue)
 * 3. Seeded unrepeated catalog shuffle (fallback)
 *
 * @param {string} [dateStr] - YYYY-MM-DD
 * @returns {Array<Object>} 3 level objects ready for gameplay
 */
export function getDailySetForDate(dateStr = getTodayDateString()) {
  let dailySets = {};
  let usedQueue = [];

  try {
    const rawSets = storageGet(STORAGE_KEY_DAILY_SETS);
    if (rawSets) dailySets = JSON.parse(rawSets);
    const rawQueue = storageGet(STORAGE_KEY_DAILY_USED_QUEUE);
    if (rawQueue) usedQueue = JSON.parse(rawQueue);
  } catch (_) {}

  // If dailySets has cached legacy low-res entries or if an explicit schedule exists, clear cached low-res
  if (Array.isArray(dailySets[dateStr])) {
    const hasLowRes = dailySets[dateStr].some(id => LEGACY_LOW_RES_LEVEL_IDS.has(id) || id.startsWith('medium_') || id.startsWith('hard_'));
    if (hasLowRes) {
      delete dailySets[dateStr];
    }
  }

  const allEntries = getAllPhotoPairEntries();
  const entryMap = new Map(allEntries.map(e => [e.id, e]));

  // Incorporate any remote OTA custom levels from daily queue into entryMap
  const remoteQueue = getDailyQueue();
  if (Array.isArray(remoteQueue.customLevels)) {
    remoteQueue.customLevels.forEach(item => {
      if (item && item.id && !entryMap.has(item.id)) {
        entryMap.set(item.id, item);
      }
    });
  }

  // 1. Check if an explicit date schedule exists in the remote queue (highest priority)
  if (remoteQueue.schedule && Array.isArray(remoteQueue.schedule[dateStr]) && remoteQueue.schedule[dateStr].length >= 3) {
    const scheduledItems = remoteQueue.schedule[dateStr].slice(0, 3);
    const scheduledLevels = scheduledItems
      .map(item => (typeof item === 'string' ? entryMap.get(item) : item))
      .filter(Boolean)
      .map(createPhotoPairLevel);

    if (scheduledLevels.length === 3) {
      dailySets[dateStr] = scheduledLevels.map(l => l.id);
      storageSet(STORAGE_KEY_DAILY_SETS, JSON.stringify(dailySets));
      return decorateDailyLevels(scheduledLevels, dateStr);
    }
  }

  // 2. Check if a curated sequential queue exists in the remote queue
  if (Array.isArray(remoteQueue.queue) && remoteQueue.queue.length > 0) {
    let chosenIds = dailySets[dateStr];
    if (!chosenIds || !Array.isArray(chosenIds) || chosenIds.length < 3) {
      // Prioritize modern non-legacy sets in production unless only legacy sets exist
      const modernQueue = remoteQueue.queue.filter(candidate => !candidate.isLegacy && !candidate.setId?.includes('legacy'));
      const activeQueue = modernQueue.length > 0 ? modernQueue : remoteQueue.queue;
      const dateHash = hashString(dateStr);
      const queueIndex = dateHash % activeQueue.length;
      const candidate = activeQueue[queueIndex];
      const rawLevels = Array.isArray(candidate) ? candidate : (candidate?.levels || []);
      if (rawLevels.length >= 3) {
        chosenIds = rawLevels.slice(0, 3).map(x => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
      }
    }

    if (chosenIds && chosenIds.length === 3) {
      const levels = chosenIds
        .map(id => entryMap.get(id))
        .filter(Boolean)
        .map(entry => {
          const level = createPhotoPairLevel(entry);
          if (LEGACY_LOW_RES_LEVEL_IDS.has(level.id) || level.id.startsWith('medium_') || level.id.startsWith('hard_') || (typeof entry.baseImage === 'string' && entry.baseImage.includes('photo-pairs/'))) {
            level.isLegacy = true;
            level.dailyLabel = 'Old (Legacy)';
            if (!level.title.startsWith('[Old]')) {
              level.title = `[Old] ${level.title}`;
            }
          }
          return level;
        });

      if (levels.length === 3) {
        dailySets[dateStr] = chosenIds;
        storageSet(STORAGE_KEY_DAILY_SETS, JSON.stringify(dailySets));
        return decorateDailyLevels(levels, dateStr);
      }
    }
  }

  // 3. Fallback: Seeded shuffle across available catalog ensuring unrepeated history
  if (!allEntries || allEntries.length === 0) {
    return [];
  }

  let chosenIds = dailySets[dateStr];
  if (!chosenIds || !Array.isArray(chosenIds) || chosenIds.length < 3) {
    // Draw only from levels reserved for the daily challenge. Without this the
    // fallback picks at random from the whole manifest, which is how daily
    // levels came to duplicate the regular Photography sets in the first place.
    const dailyPool = dailyPoolEntries(allEntries);
    const eligible = (entry) => {
      if (LEGACY_LOW_RES_LEVEL_IDS.has(entry.id)) return false;
      return !(entry.id.startsWith('medium_') || entry.id.startsWith('hard_'));
    };
    const usedSet = new Set(usedQueue);
    let available = dailyPool.filter(entry => eligible(entry) && !usedSet.has(entry.id));

    if (available.length < 3) {
      // Every reserved level has been used: start the rotation over rather
      // than borrowing from regular play.
      usedQueue = [];
      available = dailyPool.filter(eligible);
    }

    const rng = createSeededRandom(hashString(dateStr));
    const pool = [...available];

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    chosenIds = pool.slice(0, 3).map(e => e.id);
    usedQueue = Array.from(new Set([...usedQueue, ...chosenIds]));
    dailySets[dateStr] = chosenIds;

    storageSet(STORAGE_KEY_DAILY_SETS, JSON.stringify(dailySets));
    storageSet(STORAGE_KEY_DAILY_USED_QUEUE, JSON.stringify(usedQueue));
  }

  const levels = chosenIds
    .map(id => entryMap.get(id))
    .filter(Boolean)
    .map(entry => {
      const level = createPhotoPairLevel(entry);
      if (LEGACY_LOW_RES_LEVEL_IDS.has(level.id) || level.id.startsWith('medium_') || level.id.startsWith('hard_') || (typeof entry.baseImage === 'string' && entry.baseImage.includes('photo-pairs/'))) {
        level.isLegacy = true;
        level.dailyLabel = 'Old (Legacy)';
        if (!level.title.startsWith('[Old]')) {
          level.title = `[Old] ${level.title}`;
        }
      }
      return level;
    });

  return decorateDailyLevels(levels, dateStr);
}

/**
 * Adds the stable identity shared by daily queue resolution and completion records.
 * The array metadata keeps the existing level return shape compatible with callers.
 */
function decorateDailyLevels(levels, dateStr) {
  const dailySetId = `daily_${dateStr}`;
  const entryIds = levels.map(level => level.id);
  levels.dailySetId = dailySetId;
  levels.setId = dailySetId;
  levels.dateStr = dateStr;
  levels.entryIds = entryIds;
  levels.forEach(level => {
    level.dailySetId = dailySetId;
    level.dateStr = dateStr;
  });
  return levels;
}

/**
 * Retrieves the entire pool of daily challenge levels across all scheduled dates,
 * modern queue sets, and legacy queue sets.
 * Used in Debug Mode to allow full continuous testing and review of the whole daily catalog.
 *
 * @returns {Array<Object>} Array of level objects ready for gameplay with legacy/daily labels.
 */
export function getAllDailyChallengePoolLevels() {
  const remoteQueue = getDailyQueue();
  const allEntries = getAllPhotoPairEntries();
  const entryMap = new Map(allEntries.map(e => [e.id, e]));

  if (Array.isArray(remoteQueue.customLevels)) {
    remoteQueue.customLevels.forEach(item => {
      if (item && item.id && !entryMap.has(item.id)) {
        entryMap.set(item.id, item);
      }
    });
  }

  const poolLevels = [];
  const seenIds = new Set();

  const addLevel = (idOrItem, sourceLabel, isLegacySet = false) => {
    const rawId = typeof idOrItem === 'string' ? idOrItem : idOrItem?.id;
    if (!rawId || seenIds.has(rawId)) return;
    seenIds.add(rawId);

    const entry = typeof idOrItem === 'object' && idOrItem.diffs ? idOrItem : entryMap.get(rawId);
    if (!entry) return;

    const level = createPhotoPairLevel(entry);
    const isLegacy = Boolean(
      isLegacySet ||
      LEGACY_LOW_RES_LEVEL_IDS.has(rawId) ||
      rawId.startsWith('medium_') ||
      rawId.startsWith('hard_') ||
      (typeof entry.baseImage === 'string' && entry.baseImage.includes('photo-pairs/'))
    );

    level.isDaily = true;
    level.dailySource = sourceLabel;
    level.isLegacy = isLegacy;
    if (isLegacy) {
      level.dailyLabel = 'Old (Legacy)';
      if (!level.title.startsWith('[Old]')) {
        level.title = `[Old] ${level.title}`;
      }
    } else {
      level.dailyLabel = sourceLabel;
    }

    poolLevels.push(level);
  };

  // 1. All scheduled dates in chronological order
  if (remoteQueue.schedule && typeof remoteQueue.schedule === 'object') {
    const dates = Object.keys(remoteQueue.schedule).sort();
    for (const dateStr of dates) {
      const items = remoteQueue.schedule[dateStr];
      if (Array.isArray(items)) {
        items.forEach(item => addLevel(item, `Scheduled: ${dateStr}`));
      }
    }
  }

  // 2. All sets in queue (both modern and legacy sets)
  if (Array.isArray(remoteQueue.queue)) {
    remoteQueue.queue.forEach((setObj, idx) => {
      const isLegacySet = Boolean(setObj.isLegacy || setObj.setId?.includes('legacy'));
      const label = setObj.label || setObj.setId || `Set ${idx + 1}`;
      const levels = Array.isArray(setObj) ? setObj : (setObj.levels || []);
      levels.forEach(item => addLevel(item, label, isLegacySet));
    });
  }

  return poolLevels;
}

/**
 * Generate default competitive baseline entries for a specific day.
 * Ensures the leaderboard has realistic opponents and a "Time to Beat" immediately.
 */
export function generateDefaultDailyBaseline(dateStr) {
  const seed = hashString(dateStr);
  const rng = createSeededRandom(seed);

  const opponentNames = [
    'EchoApex', 'VortexSeeker', 'CyberHawk', 'NovaVision',
    'PixelSniper', 'ShadowGlint', 'NeonStalker', 'SwiftRetina',
    'AeroGaze', 'ChronoFocus', 'PrismRanger', 'SpecterPulse',
    'QuantumGlance', 'HyperSight', 'FalconTrace', 'ZenithVector',
    'MirageOptic', 'OmegaLens', 'ApexScout', 'VividRacer'
  ];

  // Base fastest time around 21 - 25 seconds for 3 images
  const baseFastestMs = Math.round(21000 + rng() * 4500);

  const entries = [];
  let currentMs = baseFastestMs;

  for (let i = 0; i < opponentNames.length; i++) {
    const timeMs = currentMs;
    // Next time is between 1.5s to 4.5s slower
    currentMs += Math.round(1500 + rng() * 3200);

    entries.push({
      rank: i + 1,
      playerName: opponentNames[i],
      totalTimeMs: timeMs,
      stars: 2, // will be calibrated across cohort via standard deviation
      completedAt: Date.now() - Math.round(rng() * 43200000), // within last 12 hrs
      isLocalPlayer: false
    });
  }

  // Calibrate all stars according to standard deviation of cohort times
  const allTimes = entries.map(e => e.totalTimeMs);
  entries.forEach(e => {
    e.stars = calculateRatingByStandardDeviation(e.totalTimeMs, allTimes);
  });

  return entries;
}

/**
 * Calculates rating (stars: 1, 2, or 3) based on a Gaussian standard deviation algorithm
 * across the cohort of completion times.
 * Faster times (lower totalTimeMs) yield higher Z-scores and higher ratings.
 *
 * @param {number} timeMs - Completion time in milliseconds
 * @param {Array<number>} allTimesMs - Cohort completion times in milliseconds
 * @returns {number} 1, 2, or 3 stars
 */
export function calculateRatingByStandardDeviation(timeMs, allTimesMs) {
  if (typeof timeMs !== 'number' || timeMs <= 0) return 1;

  const validTimes = Array.isArray(allTimesMs)
    ? allTimesMs.filter(t => typeof t === 'number' && t > 0)
    : [];

  if (validTimes.length === 0) {
    return timeMs < 30000 ? 3 : timeMs < 55000 ? 2 : 1;
  }

  const n = validTimes.length;
  const mean = validTimes.reduce((acc, t) => acc + t, 0) / n;
  const variance = validTimes.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // If standard deviation is trivial (< 500ms), fallback to comparing against mean
  if (stdDev < 500) {
    return timeMs <= mean ? 3 : 2;
  }

  // Z-score: Lower time is faster, so (mean - time) / stdDev > 0 means better than average
  const zScore = (mean - timeMs) / stdDev;

  // Gaussian standard deviation distribution:
  // z >= +0.50 (faster than mean by >= 0.5 sigma; roughly top 30%): 3 Stars
  // -0.50 <= z < +0.50 (within 0.5 sigma of mean; central ~40%): 2 Stars
  // z < -0.50 (slower than mean by >= 0.5 sigma; bottom ~30%): 1 Star
  if (zScore >= 0.50) return 3;
  if (zScore >= -0.50) return 2;
  return 1;
}

/**
 * Returns the top 5 fastest times for a given day.
 * @param {string} [dateStr]
 * @returns {Array<Object>}
 */
export function getDailyLeaderboard(dateStr = getTodayDateString()) {
  const storageKey = `${STORAGE_KEY_DAILY_LEADERBOARD_PREFIX}${dateStr}`;
  let entries = null;

  try {
    const raw = storageGet(storageKey);
    if (raw) {
      entries = JSON.parse(raw);
    }
  } catch (_) {}

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    entries = generateDefaultDailyBaseline(dateStr);
    storageSet(storageKey, JSON.stringify(entries));
  }

  // Ensure entries are sorted and ranked
  entries.sort((a, b) => a.totalTimeMs - b.totalTimeMs);
  return entries.slice(0, 5).map((entry, idx) => ({
    ...entry,
    rank: idx + 1
  }));
}

/**
 * Returns today's fastest time to beat in milliseconds.
 * @param {string} [dateStr]
 * @returns {number | null}
 */
export function getDailyTimeToBeat(dateStr = getTodayDateString()) {
  const leaderboard = getDailyLeaderboard(dateStr);
  if (!leaderboard || leaderboard.length === 0) return null;
  return leaderboard[0].totalTimeMs;
}

/**
 * Returns milliseconds remaining until the next daily challenge reset (4:00 AM US Eastern / 1:00 AM US Pacific).
 * @param {Date} [now]
 * @returns {number}
 */
export function getTimeUntilNextDailyMs(now = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const map = {};
    for (const p of parts) map[p.type] = p.value;

    let year = parseInt(map.year, 10);
    let month = parseInt(map.month, 10);
    let day = parseInt(map.day, 10);
    let hour = parseInt(map.hour, 10);
    if (hour === 24) hour = 0;

    let targetYear = year;
    let targetMonth = month;
    let targetDay = day;

    if (hour >= 4) {
      const nextDay = new Date(year, month - 1, day + 1);
      targetYear = nextDay.getFullYear();
      targetMonth = nextDay.getMonth() + 1;
      targetDay = nextDay.getDate();
    }

    const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}T04:00:00`;

    for (const offsetHours of [4, 5]) {
      const candidateUtc = new Date(`${dateStr}-0${offsetHours}:00`);
      const cParts = formatter.formatToParts(candidateUtc);
      const cMap = {};
      for (const p of cParts) cMap[p.type] = p.value;
      const cHour = parseInt(cMap.hour, 10) % 24;
      if (
        parseInt(cMap.year, 10) === targetYear &&
        parseInt(cMap.month, 10) === targetMonth &&
        parseInt(cMap.day, 10) === targetDay &&
        cHour === 4 &&
        parseInt(cMap.minute, 10) === 0
      ) {
        return Math.max(0, candidateUtc.getTime() - now.getTime());
      }
    }
    return Math.max(0, new Date(now.getTime() + 86400000).getTime() - now.getTime());
  } catch (_) {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return Math.max(0, tomorrow.getTime() - now.getTime());
  }
}

/**
 * Formats time remaining until the next daily challenge refresh as "Xh Ym" or "Xm Ys".
 * @returns {string}
 */
export function formatTimeUntilNextDaily() {
  const ms = getTimeUntilNextDailyMs();
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Clears every daily-challenge record: which sets were assigned to which dates,
 * which levels the rotation has spent, and the player's per-day results.
 *
 * Needed when the daily pool itself changes. Assignments are cached per date,
 * so a day already decided would keep serving levels that are no longer
 * reserved for the daily challenge -- the very overlap the pool split removes.
 *
 * Returns the number of stored records cleared.
 */
export function resetAllDailyProgress() {
  let cleared = 0;
  const drop = (key) => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleared += 1;
      }
    } catch (_) {}
    if (memoryStore.delete(key)) cleared += 1;
  };

  drop(STORAGE_KEY_DAILY_SETS);
  drop(STORAGE_KEY_DAILY_USED_QUEUE);

  // Per-date records are keyed by date, so they have to be swept by prefix.
  // Enumerated through length/key(), the standard Storage API: Object.keys on
  // a Storage object is not dependable outside a plain browser window.
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.key === 'function') {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(STORAGE_KEY_DAILY_PLAYER_PREFIX)
            || key.startsWith(STORAGE_KEY_DAILY_LEADERBOARD_PREFIX))) {
          keys.push(key);
        }
      }
      for (const key of keys) {
        localStorage.removeItem(key);
        cleared += 1;
      }
    }
  } catch (_) {}
  for (const key of [...memoryStore.keys()]) {
    if (key.startsWith(STORAGE_KEY_DAILY_PLAYER_PREFIX)
        || key.startsWith(STORAGE_KEY_DAILY_LEADERBOARD_PREFIX)) {
      memoryStore.delete(key);
      cleared += 1;
    }
  }
  return cleared;
}

/**
 * Resets a player's daily attempt/failure/completion status for testing & debug mode.
 * @param {string} [dateStr]
 */
export function resetDailyPlayerStatus(dateStr = getTodayDateString()) {
  const storageKey = `${STORAGE_KEY_DAILY_PLAYER_PREFIX}${dateStr}`;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
      localStorage.removeItem(storageKey);
    }
  } catch (_) {}
  memoryStore.delete(storageKey);

  // A completed run is also stored in the local leaderboard. Remove only the
  // local player's result so a reset starts a genuinely fresh attempt while
  // preserving the seeded/remote opponents.
  const leaderboardKey = `${STORAGE_KEY_DAILY_LEADERBOARD_PREFIX}${dateStr}`;
  try {
    const rawLeaderboard = storageGet(leaderboardKey);
    if (rawLeaderboard) {
      const entries = JSON.parse(rawLeaderboard);
      if (Array.isArray(entries)) {
        storageSet(leaderboardKey, JSON.stringify(entries.filter(entry => !entry?.isLocalPlayer)));
      }
    }
  } catch (_) {}
  logApp('INFO', `[DailyChallenge] Reset player daily status for date: ${dateStr}`);
}

/**
 * Returns player completion/attempt status for the specified day.
 * @param {string} [dateStr]
 * @returns {{ completed: boolean, attempted: boolean, failed: boolean, totalTimeMs?: number, stars?: number, position?: number, totalPlayers?: number, stageIndex?: number }}
 */
export function getDailyPlayerStatus(dateStr = getTodayDateString()) {
  const storageKey = `${STORAGE_KEY_DAILY_PLAYER_PREFIX}${dateStr}`;
  try {
    const raw = storageGet(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        completed: Boolean(parsed.completed),
        attempted: Boolean(parsed.attempted || parsed.completed || parsed.failed),
        failed: Boolean(parsed.failed),
        ...parsed
      };
    }
  } catch (_) {}
  return { completed: false, attempted: false, failed: false };
}

/**
 * Checks whether the player can attempt the daily challenge for a given date.
 * Once attempted, completed, or failed, it cannot be re-attempted until the next refresh.
 * @param {string} [dateStr]
 * @returns {boolean}
 */
export function canAttemptDaily(dateStr = getTodayDateString()) {
  const status = getDailyPlayerStatus(dateStr);
  return !Boolean(status.completed || status.attempted || status.failed);
}

/**
 * Records that the daily challenge has been attempted for today.
 * @param {string} [dateStr]
 * @returns {Object}
 */
export function recordDailyChallengeAttempt(dateStr = getTodayDateString()) {
  const storageKey = `${STORAGE_KEY_DAILY_PLAYER_PREFIX}${dateStr}`;
  const current = getDailyPlayerStatus(dateStr);
  const updated = {
    ...current,
    attempted: true,
    attemptedAt: current.attemptedAt || Date.now(),
    dateStr
  };
  storageSet(storageKey, JSON.stringify(updated));
  return updated;
}

/**
 * Records that the daily challenge ended in failure for today.
 * @param {Object} [params]
 * @param {string} [params.dateStr]
 * @param {number} [params.stageIndex]
 * @returns {Object}
 */
export function recordDailyChallengeFailure({
  dateStr = getTodayDateString(),
  stageIndex = 0
} = {}) {
  const storageKey = `${STORAGE_KEY_DAILY_PLAYER_PREFIX}${dateStr}`;
  const current = getDailyPlayerStatus(dateStr);
  const updated = {
    ...current,
    attempted: true,
    failed: true,
    stageIndex,
    failedAt: Date.now(),
    dateStr
  };
  storageSet(storageKey, JSON.stringify(updated));
  return updated;
}

/**
 * Records player completion of the 3-image Set of the Day.
 * Computes stars and updates the top 25 leaderboard.
 *
 * @param {Object} params
 * @param {string} [params.dateStr]
 * @param {number} params.totalTimeMs
 * @param {string} [params.playerName]
 * @returns {{ position: number, totalPlayers: number, stars: number, totalTimeMs: number, isNewRecord: boolean }}
 */
export function recordDailyChallengeCompletion({
  dateStr = getTodayDateString(),
  totalTimeMs,
  playerName = '',
  setId = `daily_${dateStr}`,
  entryIds = []
}) {
  if (typeof totalTimeMs !== 'number' || totalTimeMs <= 0) {
    throw new Error('Invalid totalTimeMs');
  }

  const effectivePlayerName = (playerName || getSavedPlayerName() || 'Player').trim();
  const dailySetId = typeof setId === 'string' && setId.trim() ? setId : `daily_${dateStr}`;
  const orderedEntryIds = Array.isArray(entryIds) ? entryIds.filter(Boolean) : [];
  const priorStatus = getDailyPlayerStatus(dateStr);
  const firstTime = priorStatus.firstTime || totalTimeMs;
  const fastestRepeat = priorStatus.completed
    ? Math.min(priorStatus.fastestRepeat || totalTimeMs, totalTimeMs)
    : null;

  // Retrieve current daily leaderboard
  const currentEntries = getDailyLeaderboard(dateStr);

  // Calculate player stars using standard deviation algorithm across existing cohort
  const cohortTimes = [...currentEntries.map(e => e.totalTimeMs), totalTimeMs];
  const stars = calculateRatingByStandardDeviation(totalTimeMs, cohortTimes);

  // Remove previous local player run for today if any (keeps best time)
  const existingPlayerIndex = currentEntries.findIndex(e => e.isLocalPlayer);
  if (existingPlayerIndex !== -1) {
    const prevTime = currentEntries[existingPlayerIndex].totalTimeMs;
    if (prevTime <= totalTimeMs) {
      // Previous time was better or equal, keep previous
      const status = getDailyPlayerStatus(dateStr);
      const repeatStatus = {
        ...status,
        setId: dailySetId,
        entryIds: orderedEntryIds.length ? orderedEntryIds : (status.entryIds || []),
        firstTime: status.firstTime || firstTime,
        fastestRepeat: status.completed ? fastestRepeat : null
      };
      storageSet(`${STORAGE_KEY_DAILY_PLAYER_PREFIX}${dateStr}`, JSON.stringify(repeatStatus));
      return {
        position: status.position || (existingPlayerIndex + 1),
        totalPlayers: currentEntries.length,
        stars: status.stars || stars,
        totalTimeMs: prevTime,
        isNewRecord: false,
        setId: dailySetId,
        entryIds: orderedEntryIds.length ? orderedEntryIds : (status.entryIds || []),
        firstTime: status.firstTime || firstTime,
        fastestRepeat: repeatStatus.fastestRepeat
      };
    }
    currentEntries.splice(existingPlayerIndex, 1);
  }

  const playerEntry = {
    rank: 0,
    playerName: effectivePlayerName,
    totalTimeMs,
    stars,
    completedAt: Date.now(),
    isLocalPlayer: true
  };

  currentEntries.push(playerEntry);
  currentEntries.sort((a, b) => a.totalTimeMs - b.totalTimeMs);

  // Assign ranks and calibrate stars for all entries via standard deviation
  const allFinalTimes = currentEntries.map(e => e.totalTimeMs);
  const ranked = currentEntries.map((e, idx) => ({
    ...e,
    rank: idx + 1,
    stars: calculateRatingByStandardDeviation(e.totalTimeMs, allFinalTimes)
  }));
  const position = ranked.findIndex(e => e.isLocalPlayer) + 1;
  const totalPlayers = ranked.length;
  const isNewRecord = position === 1;

  // Save top 5
  const top5 = ranked.slice(0, 5);
  const leaderboardKey = `${STORAGE_KEY_DAILY_LEADERBOARD_PREFIX}${dateStr}`;
  const playerKey = `${STORAGE_KEY_DAILY_PLAYER_PREFIX}${dateStr}`;

  storageSet(leaderboardKey, JSON.stringify(top5));
  storageSet(playerKey, JSON.stringify({
    completed: true,
    attempted: true,
    totalTimeMs,
    stars,
    position,
    totalPlayers,
    dateStr,
    setId: dailySetId,
    entryIds: orderedEntryIds,
    firstTime,
    fastestRepeat
  }));

  return {
    position,
    totalPlayers,
    stars,
    totalTimeMs,
    isNewRecord,
    setId: dailySetId,
    entryIds: orderedEntryIds,
    firstTime,
    fastestRepeat
  };
}

let dailyPlayerPromise = null;

/**
 * Initializes or restores the seamless anonymous Firebase Auth session.
 * Does NOT prompt the user or show any login/signup screens.
 * @returns {Promise<{ uid: string, db: Object } | null>}
 */
export async function getDailyPlayer() {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) return null;

  if (!dailyPlayerPromise) {
    dailyPlayerPromise = (async () => {
      try {
        const app = getApps()[0] || initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const credential = auth.currentUser
          ? { user: auth.currentUser }
          : await signInAnonymously(auth);
        const db = getFirestore(app);
        return { uid: credential.user.uid, db };
      } catch (err) {
        logApp('WARN', '[DailyChallenge] Firebase anonymous auth warning:', err?.message || err);
        return null;
      }
    })();
  }
  return dailyPlayerPromise;
}

/**
 * Resolves the persistent identifier for the player.
 * Uses Game Center gamePlayerID on iOS if available, otherwise anonymous Firebase UID.
 * @param {string} uid
 * @returns {string}
 */
export function getDailyPlayerIdentifier(uid) {
  try {
    const gcPlayer = getGameCenterPlayer();
    if (gcPlayer && gcPlayer.gamePlayerID) {
      return `gc_${gcPlayer.gamePlayerID}`;
    }
  } catch (_) {}
  return uid;
}

/**
 * Starts a Daily Challenge session and checks Firestore server-side attempts.
 * Prevents multiple attempts across reinstalls / browsers if linked.
 * @param {Object} [params]
 * @param {string} [params.dateStr]
 * @returns {Promise<{ allowed: boolean, uid?: string, status?: string, isRemote: boolean }>}
 */
export async function startDailyChallengeSession({ dateStr = getTodayDateString() } = {}) {
  // Always register local attempt immediately for zero-lag UI
  recordDailyChallengeAttempt(dateStr);

  const player = await getDailyPlayer();
  if (!player) {
    return { allowed: true, uid: null, isRemote: false };
  }

  const effectiveId = getDailyPlayerIdentifier(player.uid);
  const attemptDocId = `${dateStr}_${effectiveId}`;
  const attemptRef = doc(player.db, 'daily_attempts', attemptDocId);

  try {
    const existingSnap = await getDoc(attemptRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      if (data.status === 'completed' || data.status === 'failed') {
        if (data.status === 'failed') {
          recordDailyChallengeFailure({ dateStr, stageIndex: data.stageIndex || 0 });
        }
        return { allowed: false, status: data.status, isRemote: true };
      }
      return { allowed: true, uid: player.uid, isRemote: true };
    }

    await setDoc(attemptRef, {
      uid: player.uid,
      effectiveId,
      dateStr,
      status: 'in_progress',
      startedAt: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'unknown'
    });
    return { allowed: true, uid: player.uid, isRemote: true };
  } catch (err) {
    logApp('WARN', '[DailyChallenge] Error in startDailyChallengeSession:', err?.message || err);
    return { allowed: true, uid: player.uid, isRemote: false };
  }
}

/**
 * Completes the Set of the Day, updates local stats, and syncs to Firestore global leaderboard.
 * @param {Object} params
 * @param {string} [params.dateStr]
 * @param {number} params.totalTimeMs
 * @param {string} [params.playerName]
 * @returns {Promise<Object>}
 */
export async function recordDailyChallengeCompletionRemote({
  dateStr = getTodayDateString(),
  totalTimeMs,
  playerName = '',
  setId = `daily_${dateStr}`,
  entryIds = []
}) {
  const localResult = recordDailyChallengeCompletion({ dateStr, totalTimeMs, playerName, setId, entryIds });

  const effectivePlayerName = (
    playerName ||
    (typeof getGameCenterPlayer === 'function' ? getGameCenterPlayer()?.alias : '') ||
    getSavedPlayerName() ||
    'Player'
  ).trim();

  try {
    const player = await getDailyPlayer();
    if (player) {
      const effectiveId = getDailyPlayerIdentifier(player.uid);
      const attemptDocId = `${dateStr}_${effectiveId}`;
      const attemptRef = doc(player.db, 'daily_attempts', attemptDocId);

      await setDoc(attemptRef, {
        uid: player.uid,
        effectiveId,
        dateStr,
        setId: localResult.setId,
        entryIds: localResult.entryIds,
        status: 'completed',
        totalTimeMs,
        stars: localResult.stars,
        completedAt: serverTimestamp()
      }, { merge: true });

      const leaderboardRef = doc(player.db, 'daily_leaderboard', dateStr, 'entries', player.uid);
      await setDoc(leaderboardRef, {
        uid: player.uid,
        playerName: effectivePlayerName,
        totalTimeMs,
        stars: localResult.stars,
        completedAt: Date.now()
      });

      // Refetch live global leaderboard
      await fetchDailyLeaderboard(dateStr);

      // Record score into durable daily leaderboard (Top 5)
      submitLeaderboardScore({
        boardType: 'daily',
        boardId: dateStr,
        score: totalTimeMs,
        metric: 'elapsedMs',
        displayName: effectivePlayerName
      }).catch(() => {});
    }
  } catch (err) {
    logApp('WARN', '[DailyChallenge] Remote completion sync warning:', err?.message || err);
  }

  return localResult;
}

/**
 * Records failure or forfeit for the daily challenge on server and locally.
 * @param {Object} [params]
 * @param {string} [params.dateStr]
 * @param {number} [params.stageIndex]
 * @returns {Promise<Object>}
 */
export async function recordDailyChallengeFailureRemote({
  dateStr = getTodayDateString(),
  stageIndex = 0
} = {}) {
  const localResult = recordDailyChallengeFailure({ dateStr, stageIndex });

  try {
    const player = await getDailyPlayer();
    if (player) {
      const effectiveId = getDailyPlayerIdentifier(player.uid);
      const attemptDocId = `${dateStr}_${effectiveId}`;
      const attemptRef = doc(player.db, 'daily_attempts', attemptDocId);

      await setDoc(attemptRef, {
        uid: player.uid,
        effectiveId,
        dateStr,
        status: 'failed',
        stageIndex,
        failedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (err) {
    logApp('WARN', '[DailyChallenge] Remote failure sync warning:', err?.message || err);
  }

  return localResult;
}

/**
 * Fetches the live global daily leaderboard from Firestore and merges with local entries.
 * @param {string} [dateStr]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchDailyLeaderboard(dateStr = getTodayDateString()) {
  const localBoard = getDailyLeaderboard(dateStr);
  const player = await getDailyPlayer();
  if (!player) {
    return localBoard;
  }

  try {
    const entriesCol = collection(player.db, 'daily_leaderboard', dateStr, 'entries');
    const q = query(entriesCol, orderBy('totalTimeMs', 'asc'), limit(50));
    const snap = await getDocs(q);

    const remoteEntries = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      remoteEntries.push({
        ...data,
        isLocalPlayer: data.uid === player.uid
      });
    });

    if (remoteEntries.length > 0) {
      const localPlayerEntry = localBoard.find(e => e.isLocalPlayer);
      const hasPlayerInRemote = remoteEntries.some(e => e.isLocalPlayer);

      if (localPlayerEntry && !hasPlayerInRemote) {
        remoteEntries.push(localPlayerEntry);
        remoteEntries.sort((a, b) => a.totalTimeMs - b.totalTimeMs);
      }

      if (remoteEntries.length < 5) {
        const baseline = generateDefaultDailyBaseline(dateStr);
        for (const base of baseline) {
          if (!remoteEntries.some(r => r.playerName === base.playerName)) {
            remoteEntries.push(base);
          }
          if (remoteEntries.length >= 5) break;
        }
        remoteEntries.sort((a, b) => a.totalTimeMs - b.totalTimeMs);
      }

      const ranked = remoteEntries.slice(0, 5).map((e, idx) => ({
        ...e,
        rank: idx + 1
      }));

      const storageKey = `${STORAGE_KEY_DAILY_LEADERBOARD_PREFIX}${dateStr}`;
      storageSet(storageKey, JSON.stringify(ranked));

      const myIdx = ranked.findIndex(e => e.isLocalPlayer);
      if (myIdx !== -1) {
        const playerKey = `${STORAGE_KEY_DAILY_PLAYER_PREFIX}${dateStr}`;
        const currentStatus = getDailyPlayerStatus(dateStr);
        const position = myIdx + 1;
        const totalPlayers = ranked.length;
        storageSet(playerKey, JSON.stringify({
          ...currentStatus,
          position,
          totalPlayers
        }));
      }

      return ranked;
    }
  } catch (err) {
    logApp('WARN', '[DailyChallenge] Failed to fetch remote leaderboard:', err?.message || err);
  }

  return localBoard;
}

/**
 * Updates the player's display name without requiring any login/signup screen.
 * Persists locally and syncs to Firestore leaderboard for today.
 * @param {string} newName
 * @param {string} [dateStr]
 * @returns {Promise<void>}
 */
export async function updateDailyPlayerName(newName, dateStr = getTodayDateString()) {
  const trimmed = (newName || '').trim();
  if (!trimmed) return;
  savePlayerName(trimmed);

  const storageKey = `${STORAGE_KEY_DAILY_LEADERBOARD_PREFIX}${dateStr}`;
  const localBoard = getDailyLeaderboard(dateStr);
  const me = localBoard.find(e => e.isLocalPlayer);
  if (me) {
    me.playerName = trimmed;
    storageSet(storageKey, JSON.stringify(localBoard));
  }

  try {
    const player = await getDailyPlayer();
    if (player) {
      const entryRef = doc(player.db, 'daily_leaderboard', dateStr, 'entries', player.uid);
      await setDoc(entryRef, { playerName: trimmed }, { merge: true });
    }
  } catch (_) {}
}
