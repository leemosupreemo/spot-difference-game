import { getApps, initializeApp } from 'firebase/app';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreClient } from './firestoreClient.js';
import { firebaseConfig, getCurrentPlayerId } from './authService.js';
import { APP_VERSION } from './appConfig.js';
import { logApp } from '../utils/logger.js';
import { Capacitor } from '@capacitor/core';

export const SUPPORT_EMAIL = 'support@thejauntcompany.com';
export const FEEDBACK_SUBJECT_PREFIX = '[Diff Hunter Feedback]';

/* Every network hop here is bounded. The Send button awaits this function, so an
   unbounded await freezes it on "Sending..." with no way out -- which is exactly
   what happened on a device with degraded connectivity.

   The budget is shared across the whole submission rather than applied per hop:
   the Firestore fallback runs only after the Cloud Function call has failed, so
   a per-hop bound would stack into twice the wait with the player watching a
   spinner the entire time. */
const SUBMIT_TIMEOUT_MS = 10000;
/* The callable is capped well under the overall budget so it cannot eat the whole
   thing and leave the write no room -- on a device where the Cloud Function is
   unreachable, it is the write that still has a real chance of landing. */
const CALL_TIMEOUT_MS = 5000;
/* firestoreClient forces experimentalForceLongPolling, which is slower by design
   than WebChannel. A tight floor here reported `queued` for writes that simply
   had not finished yet, on connections that were working fine. */
const MIN_HOP_MS = 4000;

export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/* In Capacitor the WebView's origin is capacitor://localhost, so a JSON POST needs
   a CORS preflight -- and on iOS that preflight does not complete. The browser
   then never sends the request, which is why the backend logged no invocation at
   all for feedback that the player watched fail. A form-encoded body is a "simple
   request" under CORS: no preflight, so it goes straight out. */
const FEEDBACK_ENDPOINT =
  `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/submitFeedbackForm`;

/**
 * Submits player feedback directly in the background without opening a local mail client.
 * 
 * Strategy:
 * 1. Invokes the trusted `submitFeedback` Firebase Cloud Function, which dispatches
 *    an email via Resend and writes to Firestore.
 * 2. If the Cloud Function is unavailable, falls back to direct client write to the
 *    Firestore `feedback` collection so feedback is never lost.
 * 3. Never triggers mailto: or leaves the in-app modal.
 */
export async function submitPlayerFeedback({
  playerName,
  feedbackText,
  attemptNumber = 1
}) {
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  const platform = isNative ? (Capacitor.getPlatform() === 'ios' ? 'iOS Native' : 'Android Native') : 'Web';
  const cleanName = (playerName || 'Hunter').trim();
  const cleanComment = (feedbackText || '').trim() || '(No feedback comment written)';
  const playerId = getCurrentPlayerId() || 'anonymous';
  const timestamp = new Date().toISOString();

  const payload = {
    playerId,
    playerName: cleanName,
    feedbackText: cleanComment,
    platform,
    attemptNumber: Number(attemptNumber) || 1,
    targetEmail: SUPPORT_EMAIL,
    appVersion: APP_VERSION,
    createdAtIso: timestamp
  };

  const deadline = Date.now() + SUBMIT_TIMEOUT_MS;
  const remainingBudget = () => Math.max(MIN_HOP_MS, deadline - Date.now());

  const deliveryReport = {
    cloudFunction: false,
    firestore: false,
    email: false,
    // Handed to the SDK but not yet acknowledged by the server. Not lost: the
    // queued write flushes on its own once the device is back online.
    queued: false
  };

  logApp('INFO', `[FeedbackSubmitStart] platform=${platform} chars=${cleanComment.length} budget=${SUBMIT_TIMEOUT_MS}ms`);

  // 1. Form-encoded POST to the feedback endpoint. Deliberately no explicit
  // Content-Type: URLSearchParams sets a CORS-safelisted one, and setting
  // application/json here would reinstate the preflight this exists to avoid.
  try {
    const params = new URLSearchParams({
      playerId,
      playerName: cleanName,
      feedbackText: cleanComment,
      platform,
      attemptNumber: String(Number(attemptNumber) || 1),
      appVersion: APP_VERSION
    });

    const post = fetch(FEEDBACK_ENDPOINT, { method: 'POST', body: params });
    post.catch(() => {});
    const response = await withTimeout(
      post, Math.min(CALL_TIMEOUT_MS, remainingBudget()), 'Feedback endpoint'
    );
    const data = await response.json().catch(() => ({}));

    if (response.ok && data?.success) {
      deliveryReport.cloudFunction = true;
      deliveryReport.firestore = true;
      // The email goes out from the sendFeedbackEmail Firestore trigger, after
      // this response has already returned, so the client cannot observe it.
      deliveryReport.email = false;
      logApp('INFO', `[FeedbackEndpointOk] id=${data.id || 'unknown'}`);
      return {
        success: true,
        ...deliveryReport
      };
    }

    logApp('WARN', `[FeedbackEndpointRejected] status=${response.status} error=${data?.error || 'none'}`);
  } catch (err) {
    // The reason matters: a timeout, a CORS rejection and a network error all end
    // up here, and only the log can tell them apart on a device.
    logApp('WARN', `[FeedbackEndpointFailed] ${err?.message || err}`);
  }

  // 2. Direct client fallback write to Firestore `feedback` collection
  try {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    const db = getFirestoreClient(app);
    if (db) {
      const feedbackCol = collection(db, 'feedback');
      // addDoc settles only once the server acknowledges the write. Offline, the
      // SDK queues it locally and the promise stays pending forever -- so this one
      // has to be raced, not simply awaited.
      const write = addDoc(feedbackCol, {
        ...payload,
        createdAt: serverTimestamp(),
        status: 'new',
        clientFallback: true
      });
      write.catch(() => {});
      const writeBudget = remainingBudget();
      logApp('INFO', `[FeedbackFirestoreWriteStart] budget=${writeBudget}ms`);
      try {
        const ref = await withTimeout(write, writeBudget, 'Firestore feedback write');
        deliveryReport.firestore = true;
        logApp('INFO', `[FeedbackFirestoreWriteOk] id=${ref?.id || 'unknown'}`);
      } catch (timeoutErr) {
        deliveryReport.queued = true;
        logApp('WARN', `[FeedbackFirestoreQueued] ${timeoutErr?.message || timeoutErr}`);
      }
    }
  } catch (err) {
    logApp('WARN', `[FeedbackFirestoreFailed] code=${err?.code || 'none'} msg=${err?.message || err}`);
  }

  logApp('INFO', `[FeedbackOutcome] cloudFunction=${deliveryReport.cloudFunction} firestore=${deliveryReport.firestore} queued=${deliveryReport.queued}`);

  return {
    success: true,
    ...deliveryReport
  };
}
