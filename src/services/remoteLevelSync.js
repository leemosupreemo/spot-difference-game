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

async function fetchRemoteLevelPacks({ forceServer = false } = {}) {
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const db = getFirestoreClient(app);
  const packsRef = collection(db, 'remote_level_packs');
  const q = query(packsRef, where('active', '==', true));
  const snapshot = await (forceServer ? getDocsFromServer(q) : getDocs(q));
  logApp('INFO', `[RemoteLevelSyncQuery] ${snapshot.size} active pack doc(s) matched.`);

  const remoteEntries = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (Array.isArray(data?.levels)) {
      remoteEntries.push(...data.levels);
    } else if (data?.id && data?.baseImage) {
      remoteEntries.push(data);
    }
  });

  if (remoteEntries.length > 0) {
    const updated = saveCachedRemoteLevels(remoteEntries);
    logApp('INFO', `[RemoteLevelSync] Successfully synced ${updated.length} remote levels from Firebase.`);
    return updated;
  }

  logApp('INFO', '[RemoteLevelSyncEmpty] Query matched 0 packs or 0 levels -- using cached levels.');
  return getCachedRemoteLevels();
}

function rejectAfter(timeoutMs, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  });
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
export async function syncRemoteLevelPacks(timeoutMs = 3000) {
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    logApp('WARN', '[RemoteLevelSyncSkipped] No Firebase config -- returning cached levels only.');
    return getCachedRemoteLevels();
  }

  // In Node test / offline environments without emulator, return cached levels immediately
  if (typeof window === 'undefined' && !process.env?.FIRESTORE_EMULATOR_HOST) {
    return getCachedRemoteLevels();
  }

  logApp('INFO', '[RemoteLevelSyncStart] Querying remote_level_packs...');

  try {
    const timeoutPromise = new Promise(resolve => setTimeout(() => {
      logApp('WARN', `[RemoteLevelSyncTimeout] Exceeded ${timeoutMs}ms -- using cached levels for now (fetch keeps running in the background).`);
      resolve(getCachedRemoteLevels());
    }, timeoutMs));
    return await Promise.race([fetchRemoteLevelPacks(), timeoutPromise]);
  } catch (err) {
    logApp('INFO', '[RemoteLevelSyncOffline] Offline or no remote packs:', err?.message || err);
  }

  return getCachedRemoteLevels();
}

/**
 * Forces a fresh server read for the Debug curator UI.
 * Unlike startup sync, failures reject so the UI can report them clearly.
 */
export async function refreshRemoteLevelPacks(timeoutMs = 15000) {
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    throw new Error('Firebase configuration is unavailable.');
  }

  logApp('INFO', '[RemoteLevelRefreshStart] Forcing server refresh of remote_level_packs...');
  try {
    const levels = await Promise.race([
      fetchRemoteLevelPacks({ forceServer: true }),
      rejectAfter(timeoutMs, `Remote pack refresh exceeded ${timeoutMs}ms.`)
    ]);
    logApp('INFO', `[RemoteLevelRefreshComplete] ${levels.length} remote levels available.`);
    return levels;
  } catch (err) {
    logApp('WARN', '[RemoteLevelRefreshError]', err?.message || err);
    throw err;
  }
}
