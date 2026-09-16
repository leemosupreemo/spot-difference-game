import assert from 'node:assert/strict';
import test from 'node:test';
import {
  firebaseConfig,
  initAuth,
  onAuthChange,
  isUserVerified,
  getCurrentAuthUser,
  getCurrentPlayerId,
  isFirestoreSynced,
  STORAGE_KEY_ANON_UID,
  signInWithGoogle,
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
  signOutUser
} from './authService.js';

test('authService exports required Firebase Auth configuration and methods', () => {
  assert.ok(firebaseConfig.projectId);
  assert.ok(firebaseConfig.authDomain);
  assert.equal(typeof initAuth, 'function');
  assert.equal(typeof onAuthChange, 'function');
  assert.equal(typeof isUserVerified, 'function');
  assert.equal(typeof getCurrentAuthUser, 'function');
  assert.equal(typeof getCurrentPlayerId, 'function');
  assert.equal(typeof isFirestoreSynced, 'function');
  assert.equal(typeof STORAGE_KEY_ANON_UID, 'string');
  assert.equal(typeof signInWithGoogle, 'function');
  assert.equal(typeof signInWithApple, 'function');
  assert.equal(typeof signInWithEmail, 'function');
  assert.equal(typeof signUpWithEmail, 'function');
  assert.equal(typeof signOutUser, 'function');
});

test('onAuthChange registers callbacks and triggers with current user state', () => {
  let receivedUser = 'UNSET';
  const unsubscribe = onAuthChange((user) => {
    receivedUser = user;
  });

  assert.equal(receivedUser, getCurrentAuthUser());
  assert.equal(typeof unsubscribe, 'function');
  unsubscribe();
});

test('isUserVerified correctly identifies unverified guest sessions', () => {
  // In node testing without active credentials, current user should be unverified
  const verified = isUserVerified();
  assert.equal(verified, false);
});

test('getCurrentPlayerId returns stored anonymous UID or fallback', () => {
  const playerId = getCurrentPlayerId();
  assert.ok(typeof playerId === 'string');
  assert.ok(playerId.length > 0);
});

test('isFirestoreSynced indicates sync readiness based on auth user', () => {
  // Initially false without an active cloud user
  const synced = isFirestoreSynced();
  assert.equal(typeof synced, 'boolean');
});

test('initAuth handles SSR/non-browser environment cleanly', () => {
  const unsub = initAuth();
  assert.equal(typeof unsub, 'function');
  unsub();
});
