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
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { validatePhotoPairManifest } from '../utils/photoPairManifest.js';
import { logApp } from '../utils/logger.js';

const REMOTE_LEVELS_STORAGE_KEY = 'diff_hunter_remote_levels';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSy_thirteen_a5760_web_key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'thirteen-a5760.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'thirteen-a5760',
  appId: env.VITE_FIREBASE_APP_ID || '1:396835359318:web:diffhunter'
};

const listeners = new Set();
let inMemoryRemoteEntries = [];

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
export async function syncRemoteLevelPacks() {
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    return getCachedRemoteLevels();
  }

  try {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    const auth = getAuth(app);

    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        logApp('WARN', '[RemoteLevelAuthWarn]', authErr?.message || authErr);
      }
    }

    const db = getFirestore(app);
    const packsRef = collection(db, 'remote_level_packs');
    // Fetch active published packs
    const q = query(packsRef, where('active', '==', true));
    const snapshot = await getDocs(q);

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
  } catch (err) {
    logApp('INFO', '[RemoteLevelSyncOffline] Offline or no remote packs:', err?.message || err);
  }

  return getCachedRemoteLevels();
}
