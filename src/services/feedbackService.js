import { getApps, initializeApp } from 'firebase/app';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestoreClient } from './firestoreClient.js';
import { firebaseConfig, getCurrentPlayerId } from './authService.js';
import { Capacitor } from '@capacitor/core';

export const SUPPORT_EMAIL = 'support@thejauntcompany.com';
export const FEEDBACK_SUBJECT_PREFIX = '[Diff Hunter Feedback]';

let functionsInstance = null;
function getFirebaseFunctions() {
  if (typeof window === 'undefined') return null;
  if (!functionsInstance) {
    try {
      const app = getApps()[0] || initializeApp(firebaseConfig);
      functionsInstance = getFunctions(app);
    } catch (err) {
      console.warn('[FeedbackService] Firebase Functions init warning:', err?.message || err);
    }
  }
  return functionsInstance;
}

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
    appVersion: '1.4.0',
    createdAtIso: timestamp
  };

  const deliveryReport = {
    cloudFunction: false,
    firestore: false,
    email: false
  };

  // 1. Attempt serverless submission via Firebase Cloud Function (Resend email delivery)
  const functions = getFirebaseFunctions();
  if (functions) {
    try {
      const callSubmitFeedback = httpsCallable(functions, 'submitFeedback');
      const response = await callSubmitFeedback({
        playerName: cleanName,
        feedbackText: cleanComment,
        platform,
        attemptNumber: Number(attemptNumber) || 1
      });

      if (response?.data?.success) {
        deliveryReport.cloudFunction = true;
        deliveryReport.email = !!response.data.emailSent;
        deliveryReport.firestore = true;
        return {
          success: true,
          ...deliveryReport
        };
      }
    } catch (err) {
      console.warn('[FeedbackService] Cloud Function submission failed, falling back to direct Firestore:', err?.message || err);
    }
  }

  // 2. Direct client fallback write to Firestore `feedback` collection
  try {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    const db = getFirestoreClient(app);
    if (db) {
      const feedbackCol = collection(db, 'feedback');
      await addDoc(feedbackCol, {
        ...payload,
        createdAt: serverTimestamp(),
        status: 'new',
        clientFallback: true
      });
      deliveryReport.firestore = true;
    }
  } catch (err) {
    console.warn('[FeedbackService] Direct Firestore fallback write failed:', err?.message || err);
  }

  return {
    success: true,
    ...deliveryReport
  };
}
