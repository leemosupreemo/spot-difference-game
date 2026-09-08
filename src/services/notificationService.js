/**
 * Local Notification Service for Lifecycle Re-engagement & Retention
 *
 * Schedules:
 * 1. Welcome / Re-engagement (+2 Hours after first install / level completion)
 * 2. Retention Leaderboard Reminder (+5 Days later)
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { logApp } from '../utils/logger.js';
import {
  trackNotificationScheduled,
  trackNotificationPermissionResult,
  trackNotificationClicked
} from './analytics.js';

const STORAGE_KEY_NOTIFS_SCHEDULED = 'diff_hunter_notifications_scheduled';
const STORAGE_KEY_NOTIFS_REQUESTED = 'diff_hunter_notifications_requested';

export const NOTIFICATION_ID_WELCOME = 1001;
export const NOTIFICATION_ID_RETENTION = 1002;

let isListenerRegistered = false;

/**
 * Initializes notification action listeners (e.g. tracking when a player opens via notification).
 */
export async function initializeNotificationListeners() {
  if (isListenerRegistered) return;

  const isNative = Capacitor.isNativePlatform();
  if (!isNative) return;

  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const notif = action.notification;
      logApp('INFO', `[Notifications] Action performed on notification ${notif.id}:`, notif.title);
      trackNotificationClicked({
        notificationId: notif.id,
        title: notif.title || '',
        actionId: action.actionId
      });
    });

    isListenerRegistered = true;
    logApp('INFO', '[Notifications] Action listeners registered successfully.');
  } catch (err) {
    console.warn('[Notifications] Error initializing listeners:', err);
  }
}

/**
 * Checks if lifecycle notifications have already been scheduled.
 */
export function areInstallNotificationsScheduled() {
  try {
    if (typeof localStorage !== 'undefined') {
      return Boolean(localStorage.getItem(STORAGE_KEY_NOTIFS_SCHEDULED));
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Requests permission and schedules both the +2hr and +5day notifications.
 * Safe to call multiple times (idempotent).
 *
 * @param {boolean} force - If true, requests permissions even if previously prompted
 * @returns {Promise<boolean>} True if notifications were successfully scheduled
 */
export async function scheduleInstallNotifications(force = false) {
  if (areInstallNotificationsScheduled() && !force) {
    logApp('INFO', '[Notifications] Lifecycle notifications already scheduled.');
    return true;
  }

  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    logApp('INFO', '[Notifications] Non-native platform; skipping local notification scheduling.');
    return false;
  }

  try {
    // 1. Check existing permission status
    let permStatus = await LocalNotifications.checkPermissions();

    if (permStatus.display !== 'granted') {
      // Check if previously prompted
      const previouslyPrompted = localStorage.getItem(STORAGE_KEY_NOTIFS_REQUESTED);
      if (previouslyPrompted && !force) {
        return false;
      }

      localStorage.setItem(STORAGE_KEY_NOTIFS_REQUESTED, new Date().toISOString());
      permStatus = await LocalNotifications.requestPermissions();
    }

    const isGranted = permStatus.display === 'granted';
    trackNotificationPermissionResult({ status: permStatus.display, granted: isGranted });

    if (!isGranted) {
      logApp('INFO', `[Notifications] Permission denied or dismissed: ${permStatus.display}`);
      return false;
    }

    // 2. Compute Target Times
    const now = Date.now();
    const twoHoursLater = new Date(now + 2 * 60 * 60 * 1000); // +2 Hours
    const fiveDaysLater = new Date(now + 5 * 24 * 60 * 60 * 1000); // +5 Days

    // 3. Clear any existing lifecycle notifications to prevent duplicates
    try {
      await LocalNotifications.cancel({
        notifications: [
          { id: NOTIFICATION_ID_WELCOME },
          { id: NOTIFICATION_ID_RETENTION }
        ]
      });
    } catch {}

    // 4. Schedule Notifications
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID_WELCOME,
          title: '👀 Spot the difference?',
          body: 'Think you can beat your fastest time? Fresh photo pairs are waiting in Diff Hunter!',
          schedule: { at: twoHoursLater },
          sound: 'beep.wav',
          extra: { type: 'welcome_2hr' }
        },
        {
          id: NOTIFICATION_ID_RETENTION,
          title: '🎯 Leaderboard Challenge!',
          body: 'Players are climbing the ranks. Jump back in and see if you can reach the Top 5% speed!',
          schedule: { at: fiveDaysLater },
          sound: 'beep.wav',
          extra: { type: 'retention_5day' }
        }
      ]
    });

    localStorage.setItem(STORAGE_KEY_NOTIFS_SCHEDULED, new Date().toISOString());
    logApp('INFO', `[Notifications] Successfully scheduled +2hr (${twoHoursLater.toISOString()}) and +5day (${fiveDaysLater.toISOString()}) notifications.`);

    trackNotificationScheduled({
      welcomeAt: twoHoursLater.toISOString(),
      reminderAt: fiveDaysLater.toISOString(),
      granted: true
    });

    return true;
  } catch (err) {
    console.warn('[Notifications] Error scheduling notifications:', err);
    return false;
  }
}
