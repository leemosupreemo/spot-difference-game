import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NOTIFICATION_ID_WELCOME,
  NOTIFICATION_ID_RETENTION,
  areInstallNotificationsScheduled,
  scheduleInstallNotifications,
  initializeNotificationListeners
} from './notificationService.js';

test('notificationService exports valid lifecycle notification constants', () => {
  assert.equal(NOTIFICATION_ID_WELCOME, 1001);
  assert.equal(NOTIFICATION_ID_RETENTION, 1002);
});

test('areInstallNotificationsScheduled returns boolean without throwing', () => {
  const result = areInstallNotificationsScheduled();
  assert.equal(typeof result, 'boolean');
});

test('scheduleInstallNotifications runs safely in non-native environment without throwing', async () => {
  const result = await scheduleInstallNotifications();
  assert.equal(typeof result, 'boolean');
});

test('initializeNotificationListeners executes safely without throwing', async () => {
  await assert.doesNotReject(async () => {
    await initializeNotificationListeners();
  });
});
