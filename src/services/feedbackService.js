import { getApps, initializeApp } from 'firebase/app';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreClient } from './firestoreClient.js';
import { firebaseConfig, getCurrentPlayerId } from './authService.js';
import { Capacitor } from '@capacitor/core';

export const SUPPORT_EMAIL = 'support@thejauntcompany.com';
export const FEEDBACK_SUBJECT_PREFIX = '[Diff Hunter Feedback]';

/**
 * Submits player feedback directly in the background without opening a local mail client.
 * 
 * Multi-tier delivery:
 * 1. Persists the feedback document directly to Firebase Firestore (`feedback` collection).
 * 2. Dispatches a direct HTTP background email delivery request to FormSubmit / configured endpoint
 *    targeting support@thejauntcompany.com.
 * 3. Never triggers mailto: or leaves the app.
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

  const feedbackData = {
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
    firestore: false,
    email: false
  };

  // 1. Direct write to Firebase Firestore collection 'feedback'
  try {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    const db = getFirestoreClient(app);
    if (db) {
      const feedbackCol = collection(db, 'feedback');
      await addDoc(feedbackCol, {
        ...feedbackData,
        createdAt: serverTimestamp(),
        status: 'new'
      });
      deliveryReport.firestore = true;
    }
  } catch (err) {
    console.warn('[FeedbackService] Firestore save warning:', err?.message || err);
  }

  // 2. Direct HTTP email dispatch (FormSubmit.co or custom webhook)
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  const endpoint = env.VITE_FEEDBACK_ENDPOINT || `https://formsubmit.co/ajax/${SUPPORT_EMAIL}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: `${FEEDBACK_SUBJECT_PREFIX} Player Feedback - ${cleanName}`,
        name: cleanName,
        message: cleanComment,
        platform,
        attempt: attemptNumber,
        playerId,
        date: timestamp,
        _template: 'table'
      })
    });

    if (response && response.ok) {
      deliveryReport.email = true;
    }
  } catch (err) {
    console.warn('[FeedbackService] Background email dispatch warning:', err?.message || err);
  }

  return {
    success: true,
    ...deliveryReport
  };
}
