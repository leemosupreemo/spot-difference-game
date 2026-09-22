/**
 * Remote Level Sync Service (Over-The-Air Level Packs via Firebase Firestore)
 *
 * Allows publishing new photo packs and levels to Firebase without requiring app rebuilds.
 * - Built-in levels (321 levels) ship with the build and work 100% offline.
 * - On startup/online, syncRemoteLevelPacks() fetches any additional level packs from Firestore.
 * - Validates remote entries against the strict single-difference manifest schema.
 * - Caches remote levels in localStorage so they persist offline once downloaded.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestoreClient } from './firestoreClient.js';
import { collection, getDocs, getDocsFromServer, query, where } from 'firebase/firestore';
import { validatePhotoPairManifest } from '../utils/photoPairManifest.js';
import { logApp } from '../utils/logger.js';
import { listCollection } from './firestoreRest.js';

const REMOTE_LEVELS_STORAGE_KEY = 'diff_hunter_remote_levels';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

const listeners = new Set();
let inMemoryRemoteEntries = [];

/**
 * Read the packs over plain HTTPS.
 *
 * Preferred over the SDK because this is a public, read-only fetch that needs
 * none of the SDK's machinery -- and because the SDK cannot reach the backend
 * from inside the app's WebView. When it cannot connect it does not fail; it
 * treats the backend as temporarily unreachable and retries indefinitely, so
 * the promise never settles and no timeout or transport setting helps. REST
 * returns in well under a second and reports a real error when it cannot.
 */
async function fetchPacksOverRest() {
  const docs = await listCollection('remote_level_packs', {
    projectId: firebaseConfig.projectId,
    apiKey: firebaseConfig.apiKey,
    timeoutMs: 10000
  });
  return docs.filter(doc => doc?.active === true);
}

async function fetchPacksOverSdk({ forceServer }) {
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const db = getFirestoreClient(app);
  const packsRef = collection(db, 'remote_level_packs');
  const q = query(packsRef, where('active', '==', true));
  const snapshot = await (forceServer ? getDocsFromServer(q) : getDocs(q));
  const packs = [];
  snapshot.forEach(docSnap => packs.push({ id: docSnap.id, ...docSnap.data() }));
  return packs;
}

async function fetchRemoteLevelPacks({ forceServer = false } = {}) {
  let packs;
  try {
    packs = await fetchPacksOverRest();
    logApp('INFO', `[RemoteLevelSyncQuery] REST returned ${packs.length} active pack doc(s).`);
  } catch (restErr) {
    // Fall back to the SDK: it may succeed where REST is blocked, and it can
    // answer from its offline cache.
    logApp('WARN', `[RemoteLevelSyncRestFailed] ${restErr?.message || restErr} -- trying the SDK.`);
    packs = await fetchPacksOverSdk({ forceServer });
  }

  const remoteEntries = [];
  for (const data of packs) {
    if (Array.isArray(data?.levels)) {
      remoteEntries.push(...data.levels);
    } else if (data?.id && data?.baseImage) {
      remoteEntries.push(data);
    }
  }

  if (remoteEntries.length > 0) {
    const updated = saveCachedRemoteLevels(remoteEntries);
    logApp('INFO', `[RemoteLevelSync] Successfully synced ${updated.length} remote levels from Firebase.`);
    return updated;
  }

  logApp('INFO', '[RemoteLevelSyncEmpty] Query matched 0 packs or 0 levels -- using cached levels.');
  return getCachedRemoteLevels();
}

/*
 * A deadline whose timer can be cancelled once the race is over.
 *
 * Promise.race settles on the winner but does nothing about the loser's timer,
 * which goes on to fire regardless. In syncRemoteLevelPacks that meant a sync
 * finishing in under a second still logged "[RemoteLevelSyncTimeout] Exceeded
 * 12000ms" twelve seconds later -- in every session, whatever had happened. The
 * warning read as evidence of a slow connection while actually being evidence of
 * nothing at all.
 */
function deadline(timeoutMs, onElapsed) {
  let timer;
  const promise = new Promise((resolve, reject) => {
    timer = setTimeout(() => onElapsed(resolve, reject), timeoutMs);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

/**
 * Loads cached remote levels synchronously from localStorage.
 */
export function getCachedRemoteLevels() {
  if (inMemoryRemoteEntries.length > 0) {
    return inMemoryRemoteEntries;
  }

  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      const raw = localStorage.getItem(REMOTE_LEVELS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const { validEntries } = validatePhotoPairManifest(parsed);
        inMemoryRemoteEntries = validEntries || [];
        return inMemoryRemoteEntries;
      }
    }
  } catch (err) {
    logApp('WARN', '[RemoteLevelLoadError] Failed to read cached remote levels:', err?.message || err);
  }

  return inMemoryRemoteEntries;
}

/**
 * Saves validated remote levels to localStorage and notifies listeners.
 */
export function saveCachedRemoteLevels(entries = []) {
  const { validEntries } = validatePhotoPairManifest(entries);
  inMemoryRemoteEntries = validEntries || [];

  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(REMOTE_LEVELS_STORAGE_KEY, JSON.stringify(inMemoryRemoteEntries));
    }
  } catch (err) {
    logApp('WARN', '[RemoteLevelSaveError] Failed to cache remote levels:', err?.message || err);
  }

  listeners.forEach(fn => {
    try { fn(inMemoryRemoteEntries); } catch (_) {}
  });

  return inMemoryRemoteEntries;
}

/**
 * Clears cached remote levels.
 */
export function clearCachedRemoteLevels() {
  inMemoryRemoteEntries = [];
  try {
    if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
      localStorage.removeItem(REMOTE_LEVELS_STORAGE_KEY);
    }
  } catch (_) {}

  listeners.forEach(fn => {
    try { fn([]); } catch (_) {}
  });
}

/**
 * Subscribes a listener to be notified when remote levels are synced or updated.
 */
export function subscribeToRemoteLevels(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Asynchronously fetches and syncs published level packs from Firebase Firestore.
 * Collection: 'remote_level_packs'
 */
// Long polling needs longer to establish than a WebChannel stream, and the old
// 3s budget expired before a device sync could ever finish.
export async function syncRemoteLevelPacks(timeoutMs = 12000) {
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    logApp('WARN', '[RemoteLevelSyncSkipped] No Firebase config -- returning cached levels only.');
    return getCachedRemoteLevels();
  }

  // In Node test / offline environments without emulator, return cached levels immediately
  if (typeof window === 'undefined' && !process.env?.FIRESTORE_EMULATOR_HOST) {
    return getCachedRemoteLevels();
  }

  logApp('INFO', '[RemoteLevelSyncStart] Querying remote_level_packs...');

  const timeout = deadline(timeoutMs, resolve => {
    logApp('WARN', `[RemoteLevelSyncTimeout] Exceeded ${timeoutMs}ms -- using cached levels for now (fetch keeps running in the background).`);
    resolve(getCachedRemoteLevels());
  });

  try {
    const fetchPromise = fetchRemoteLevelPacks();
    // The race hides the request's own outcome, so a real failure looks
    // identical to a slow one. Report it either way, even after the timeout.
    fetchPromise.then(
      levels => logApp('INFO', `[RemoteLevelSyncSettled] Server returned ${levels?.length ?? 0} level(s).`),
      err => logApp('WARN', `[RemoteLevelSyncFailed] ${err?.code || ''} ${err?.message || err}`)
    );
    return await Promise.race([fetchPromise, timeout.promise]);
  } catch (err) {
    logApp('INFO', '[RemoteLevelSyncOffline] Offline or no remote packs:', err?.message || err);
  } finally {
    timeout.cancel();
  }

  return getCachedRemoteLevels();
}

/**
 * Forces a fresh server read for the Debug curator UI.
 * Unlike startup sync, failures reject so the UI can report them clearly.
 */
export async function refreshRemoteLevelPacks(timeoutMs = 45000) {
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    throw new Error('Firebase configuration is unavailable.');
  }

  logApp('INFO', '[RemoteLevelRefreshStart] Forcing server refresh of remote_level_packs...');
  try {
    const serverFetch = fetchRemoteLevelPacks({ forceServer: true });
    serverFetch.catch(err =>
      logApp('WARN', `[RemoteLevelRefreshRejected] ${err?.code || ''} ${err?.message || err}`));
    const timeout = deadline(timeoutMs, (_resolve, reject) =>
      reject(new Error(`Remote pack refresh exceeded ${timeoutMs}ms.`)));
    try {
      const levels = await Promise.race([serverFetch, timeout.promise]);
      logApp('INFO', `[RemoteLevelRefreshComplete] ${levels.length} remote levels available.`);
      return levels;
    } finally {
      timeout.cancel();
    }
  } catch (err) {
    logApp('WARN', '[RemoteLevelRefreshError]', err?.message || err);
    throw err;
  }
}
