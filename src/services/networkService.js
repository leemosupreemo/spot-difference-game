/**
 * Network Service
 * Handles online/offline detection, network event subscriptions,
 * and offline leaderboard submission queuing so no player record is lost.
 */

export const STORAGE_KEY_PENDING_QUEUE = 'diff_hunter_pending_leaderboard_queue';

let mockOnlineState = null;
let currentConfirmedOnline = null;
const activeListeners = new Set();

/**
 * For unit testing: override online status.
 */
export function _setMockOnlineStateForTesting(state) {
  mockOnlineState = state;
}

/**
 * Records that a network call succeeded (e.g. Firebase, API, image fetch),
 * confirming the device is actively online.
 */
export function recordNetworkSuccess() {
  if (mockOnlineState !== null) return;
  currentConfirmedOnline = true;
  for (const cb of activeListeners) {
    try { cb(true); } catch (_) {}
  }
}

/**
 * Actively tests network reachability.
 * Useful for WebViews where navigator.onLine can be falsely reported.
 */
export async function checkConnectivity() {
  if (mockOnlineState !== null) return mockOnlineState;
  if (typeof fetch !== 'function') return isOnline();

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;
    await fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller?.signal
    });
    if (timeoutId) clearTimeout(timeoutId);
    recordNetworkSuccess();
    return true;
  } catch (_) {
    return isOnline();
  }
}

/**
 * Checks if the current client is online.
 * Safe for SSR, Node test environments, and Capacitor WebViews.
 */
export function isOnline() {
  if (mockOnlineState !== null) return mockOnlineState;
  if (currentConfirmedOnline !== null) return currentConfirmedOnline;
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Subscribes to network status changes ('online' and 'offline' events).
 * Returns an unsubscribe cleanup function.
 */
export function subscribeNetworkStatus(callback) {
  if (typeof callback === 'function') {
    activeListeners.add(callback);
  }

  // Active check if navigator reports false or unknown on startup
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    checkConnectivity().catch(() => {});
  }

  if (typeof window === 'undefined') {
    return () => {
      activeListeners.delete(callback);
    };
  }

  const handleOnline = () => {
    currentConfirmedOnline = true;
    callback(true);
  };
  const handleOffline = () => {
    currentConfirmedOnline = false;
    callback(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    activeListeners.delete(callback);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

let inMemoryQueue = [];

/**
 * Retrieves all pending leaderboard submissions from storage.
 */
export function getPendingSubmissions() {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PENDING_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
  }
  return inMemoryQueue;
}

/**
 * Saves a list of pending submissions to storage and memory.
 */
function savePendingSubmissions(queue) {
  inMemoryQueue = [...queue];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(queue));
    } catch (_) {}
  }
}

/**
 * Clears all pending leaderboard submissions.
 */
export function clearPendingSubmissions() {
  inMemoryQueue = [];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY_PENDING_QUEUE);
    } catch (_) {}
  }
}

/**
 * Queues a leaderboard submission when offline or when a remote write fails.
 * Deduplicates by boardType + boardId + playerId, keeping the best score.
 * 
 * @param {Object} submission
 * @param {'photoSet'|'daily'|'category'} submission.boardType
 * @param {string} submission.boardId
 * @param {number} submission.score
 * @param {'elapsedMs'|'points'} [submission.metric='elapsedMs']
 * @param {string} [submission.displayName]
 * @param {string} [submission.playerId]
 */
export function queuePendingSubmission(submission) {
  if (!submission || typeof submission.score !== 'number' || submission.score <= 0) return;

  const queue = getPendingSubmissions();
  const subKey = `${submission.boardType}_${submission.boardId}_${submission.playerId || 'self'}`;
  const isLowerBetter = submission.metric !== 'points';

  const existingIdx = queue.findIndex(item => {
    const key = `${item.boardType}_${item.boardId}_${item.playerId || 'self'}`;
    return key === subKey;
  });

  if (existingIdx >= 0) {
    const existing = queue[existingIdx];
    const isImprovement = isLowerBetter ? submission.score < existing.score : submission.score > existing.score;
    if (isImprovement) {
      queue[existingIdx] = {
        ...existing,
        ...submission,
        queuedAt: new Date().toISOString()
      };
    }
  } else {
    queue.push({
      ...submission,
      queuedAt: new Date().toISOString()
    });
  }

  savePendingSubmissions(queue);
}

/**
 * Synchronizes pending submissions to the cloud once back online.
 * 
 * @param {Function} submitFn - Callable submitLeaderboardScore function
 * @returns {Promise<{ synced: number, remaining: number }>}
 */
export async function syncPendingSubmissions(submitFn) {
  if (!isOnline() || typeof submitFn !== 'function') {
    return { synced: 0, remaining: getPendingSubmissions().length };
  }

  const queue = getPendingSubmissions();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const res = await submitFn(item);
      if (res && res.remoteSynced !== false) {
        synced += 1;
      } else {
        remaining.push(item);
      }
    } catch (_) {
      remaining.push(item);
    }
  }

  savePendingSubmissions(remaining);
  return { synced, remaining: remaining.length };
}

let syncRunner = null;
export function registerSyncRunner(runner) {
  syncRunner = runner;
}

// Auto-sync pending submissions whenever the browser/device detects network recovery
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    if (typeof syncRunner === 'function') {
      try {
        await syncRunner();
      } catch (_) {}
    }
  });
}

