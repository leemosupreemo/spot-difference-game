// @vitest-environment jsdom
// Exercises the httpsCallable failure branch of submitLeaderboardScore, which the plain
// node:test suite in leaderboardService.test.mjs can't reach (it runs without `window`,
// so getFirebaseFunctions() short-circuits to null and the Cloud Function is never called).
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const httpsCallableMock = vi.fn();

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => [{}]) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getFirestore: vi.fn(() => ({})),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn()
}));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => httpsCallableMock)
}));
vi.mock('./authService.js', () => ({
  firebaseConfig: {},
  getCurrentPlayerId: () => 'test_uid',
  getCurrentAuthUser: () => ({ uid: 'test_uid' })
}));
vi.mock('./gameCenter.js', () => ({
  isGameCenterSupported: () => false,
  isGameCenterAuthenticated: () => false,
  submitGameCenterScore: vi.fn()
}));
vi.mock('./dailyChallenge.js', () => ({ generateDefaultDailyBaseline: () => [] }));
vi.mock('../utils/setLeaderboards.js', () => ({ getDeterministicSetBaseline: () => [] }));
vi.mock('../utils/screenshotMode.js', () => ({ isScreenshotHarnessMode: () => false }));
vi.mock('./playerProgress.js', () => ({ getSavedPlayerName: () => 'TestHunter' }));

const queuePendingSubmission = vi.fn();
vi.mock('./networkService.js', () => ({
  isOnline: () => true,
  queuePendingSubmission: (...args) => queuePendingSubmission(...args),
  syncPendingSubmissions: vi.fn(),
  registerSyncRunner: vi.fn(),
  recordNetworkSuccess: vi.fn()
}));

const { submitLeaderboardScore } = await import('./leaderboardService.js');

beforeEach(() => {
  httpsCallableMock.mockReset();
  queuePendingSubmission.mockClear();
  const storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear()
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

test('a permanent server rejection (e.g. profanity) is surfaced and never queued for retry', async () => {
  httpsCallableMock.mockRejectedValueOnce({
    code: 'functions/invalid-argument',
    message: "That name isn't allowed. Please choose another name."
  });

  const result = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId: 'test_set_rejected',
    score: 5000,
    displayName: 'fuckboy'
  });

  expect(result.qualified).toBe(false);
  expect(result.rejected).toBe(true);
  expect(result.reason).toMatch(/isn't allowed/i);
  // A permanent rejection must not be queued for offline retry - the same bad name would
  // just be rejected again on every retry attempt.
  expect(queuePendingSubmission).not.toHaveBeenCalled();
});

test('a transient Cloud Function failure (network/unavailable) still falls back to local evaluation and queues for sync', async () => {
  httpsCallableMock.mockRejectedValueOnce({ code: 'functions/unavailable', message: 'network error' });

  const result = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId: 'test_set_transient_fallback',
    score: 5000,
    displayName: 'CleanName'
  });

  // Falls through to the client-side fallback rather than being treated as a rejection
  expect(result.rejected).toBeUndefined();
  expect(result.qualified).toBe(true);
});

test('a clean name submitted successfully never trips the rejection path', async () => {
  httpsCallableMock.mockResolvedValueOnce({
    data: {
      qualified: true,
      rank: 1,
      entries: [{ playerId: 'test_uid', displayName: 'CleanName', score: 5000, rank: 1 }]
    }
  });

  const result = await submitLeaderboardScore({
    boardType: 'photoSet',
    boardId: 'test_set_clean_success',
    score: 5000,
    displayName: 'CleanName'
  });

  expect(result.rejected).toBeUndefined();
  expect(result.qualified).toBe(true);
  expect(queuePendingSubmission).not.toHaveBeenCalled();
});
