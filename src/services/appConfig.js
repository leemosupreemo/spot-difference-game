/**
 * App Configuration & Remote Over-the-Air Settings Service
 *
 * Allows updating dynamic settings (like the App Store review URL) post-launch
 * without needing to submit a new app build to Apple.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { logApp } from '../utils/logger.js';

export const DEFAULT_APP_STORE_URL = 'https://apps.apple.com/app/id6740888200?action=write-review';
const STORAGE_KEY_APP_STORE_URL = 'diff_hunter_app_store_url';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSy_thirteen_a5760_web_key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'thirteen-a5760.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'thirteen-a5760',
  appId: env.VITE_FIREBASE_APP_ID || '1:396835359318:web:diffhunter'
};

let inMemoryAppStoreUrl = null;

/**
 * Returns current App Store Review URL (from in-memory cache, localStorage, or fallback).
 */
export function getAppStoreReviewUrl() {
  if (inMemoryAppStoreUrl) {
    return inMemoryAppStoreUrl;
  }

  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      const stored = localStorage.getItem(STORAGE_KEY_APP_STORE_URL);
      if (stored && stored.startsWith('http')) {
        inMemoryAppStoreUrl = stored;
        return stored;
      }
    }
  } catch (_) {}

  return DEFAULT_APP_STORE_URL;
}

/**
 * Updates the stored App Store review URL.
 */
export function setAppStoreReviewUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return;
  inMemoryAppStoreUrl = url;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(STORAGE_KEY_APP_STORE_URL, url);
    }
  } catch (_) {}
}

/**
 * Asynchronously syncs remote app configuration from Firestore or static CDN endpoint.
 */
export async function syncRemoteAppConfig() {
  // 1. Try static JSON config endpoint (fast CDN fallback)
  try {
    const staticRes = await fetch('/app-config.json', { cache: 'no-cache' });
    if (staticRes.ok) {
      const config = await staticRes.json();
      if (config?.appStoreUrl) {
        setAppStoreReviewUrl(config.appStoreUrl);
        logApp('INFO', '[AppConfigSync] Loaded App Store URL from static config:', config.appStoreUrl);
      }
    }
  } catch (_) {}

  // 2. Try Firebase Firestore document 'app_config/global'
  try {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const configDocRef = doc(db, 'app_config', 'global');
    const docSnap = await getDoc(configDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const remoteUrl = data?.appStoreUrl || data?.app_store_url || data?.reviewUrl || data?.review_url;
      if (remoteUrl && typeof remoteUrl === 'string' && remoteUrl.startsWith('http')) {
        setAppStoreReviewUrl(remoteUrl);
        logApp('INFO', '[AppConfigSync] Synced remote App Store URL from Firestore:', remoteUrl);
        return remoteUrl;
      }
    }
  } catch (err) {
    logApp('INFO', '[AppConfigSyncOffline] Using cached App Store URL:', err?.message || err);
  }

  return getAppStoreReviewUrl();
}
