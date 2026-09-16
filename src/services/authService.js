import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { isGameCenterSupported, isGameCenterAuthenticated } from './gameCenter.js';
import { restoreProgressFromCloud, savePlayerName, getSavedPlayerName } from './playerProgress.js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

function getFirebaseApp() {
  return getApps()[0] || initializeApp(firebaseConfig);
}

let authInstance = null;
function getFirebaseAuth() {
  if (typeof window === 'undefined') return null;
  if (!authInstance) {
    try {
      const app = getFirebaseApp();
      authInstance = getAuth(app);
    } catch (e) {
      console.warn('Firebase Auth init error:', e);
    }
  }
  return authInstance;
}

let currentAuthUser = null;
const listeners = new Set();

export function onAuthChange(callback) {
  listeners.add(callback);
  callback(currentAuthUser);
  return () => listeners.delete(callback);
}

function notifyAuthListeners(user) {
  currentAuthUser = user;
  listeners.forEach(cb => {
    try {
      cb(user);
    } catch (err) {
      console.warn('Auth listener callback error:', err);
    }
  });
}

export const STORAGE_KEY_ANON_UID = 'diff_hunter_anonymous_uid';

/**
 * Initializes auth listener for silent anonymous authentication and persistent state.
 */
export function initAuth() {
  const auth = getFirebaseAuth();
  if (!auth) return () => {};

  // Silently authenticate on launch with zero UI prompts
  if (!auth.currentUser) {
    signInAnonymously(auth).catch(err => {
      console.warn('Silent anonymous sign-in error:', err?.message || err);
    });
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_ANON_UID, user.uid);
        }
      } catch (_) {}

      let displayName = user.displayName || getSavedPlayerName();
      if (!displayName || displayName === 'SpeedHunter' || displayName === 'Guest') {
        const suffix = user.uid.slice(-4).toUpperCase();
        displayName = `Player ${suffix}`;
        savePlayerName(displayName);
      }

      notifyAuthListeners({
        uid: user.uid,
        email: user.email || null,
        displayName,
        photoURL: user.photoURL || null,
        isAnonymous: user.isAnonymous,
        providerId: user.isAnonymous ? 'anonymous' : (user.providerData?.[0]?.providerId || 'email')
      });

      // Automatically restore cloud progress onto this device
      try {
        await restoreProgressFromCloud();
      } catch (_) {}
    } else {
      // Keep session alive anonymously
      signInAnonymously(auth).catch(() => {});
    }
  });
}

/**
 * Checks if the current session is verified (either via Game Center on iOS or authenticated session on Web).
 */
export function isUserVerified() {
  if (isGameCenterSupported() && isGameCenterAuthenticated()) {
    return true;
  }
  return Boolean(currentAuthUser);
}

export function getCurrentAuthUser() {
  return currentAuthUser;
}

export function getCurrentPlayerId() {
  if (currentAuthUser?.uid) return currentAuthUser.uid;
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_ANON_UID) || 'anonymous_player';
    }
  } catch (_) {}
  return 'anonymous_player';
}

export function isFirestoreSynced() {
  return Boolean(currentAuthUser?.uid);
}

/**
 * One-tap Google Sign-In
 */
export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth not available');

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // If user was anonymous, attempt to link the account so existing progress is seamlessly kept
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    try {
      const res = await linkWithPopup(auth.currentUser, provider);
      return res.user;
    } catch (err) {
      // If credential already in use by existing account, fall back to normal sign-in
      if (err.code === 'auth/credential-already-in-use') {
        const res = await signInWithPopup(auth, provider);
        return res.user;
      }
      throw err;
    }
  }

  const res = await signInWithPopup(auth, provider);
  return res.user;
}

/**
 * One-tap Apple Sign-In (Web)
 */
export async function signInWithApple() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth not available');

  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');

  if (auth.currentUser && auth.currentUser.isAnonymous) {
    try {
      const res = await linkWithPopup(auth.currentUser, provider);
      return res.user;
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use') {
        const res = await signInWithPopup(auth, provider);
        return res.user;
      }
      throw err;
    }
  }

  const res = await signInWithPopup(auth, provider);
  return res.user;
}

/**
 * Email & Password Sign-In
 */
export async function signInWithEmail(email, password) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth not available');

  const cleanEmail = (email || '').trim();
  const res = await signInWithEmailAndPassword(auth, cleanEmail, password);
  return res.user;
}

/**
 * Email & Password Registration
 */
export async function signUpWithEmail(email, password, displayName = '') {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth not available');

  const cleanEmail = (email || '').trim();
  const cleanName = (displayName || '').trim();

  // If user was anonymous, try linking email credential first
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    try {
      const credential = EmailAuthProvider.credential(cleanEmail, password);
      const res = await linkWithCredential(auth.currentUser, credential);
      if (cleanName) {
        await updateProfile(res.user, { displayName: cleanName });
        savePlayerName(cleanName);
      }
      return res.user;
    } catch (err) {
      if (err.code !== 'auth/credential-already-in-use') {
        throw err;
      }
    }
  }

  const res = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  if (cleanName) {
    try {
      await updateProfile(res.user, { displayName: cleanName });
      savePlayerName(cleanName);
    } catch (_) {}
  }
  return res.user;
}

/**
 * Sign out current user
 */
export async function signOutUser() {
  const auth = getFirebaseAuth();
  if (!auth) return;

  await signOut(auth);
  // Re-sign in anonymously so game services stay functional
  try {
    await signInAnonymously(auth);
  } catch (_) {}
}
