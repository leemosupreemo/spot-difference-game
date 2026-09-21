import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NOTIFICATION_ID_WELCOME,
  NOTIFICATION_ID_RETENTION,
  NOTIFICATION_ID_TEST,
  areInstallNotificationsScheduled,
  scheduleInstallNotifications,
  initializeNotificationListeners,
  triggerTestNotification
} from './notificationService.js';

test('notificationService exports valid lifecycle notification constants', () => {
  assert.equal(NOTIFICATION_ID_WELCOME, 1001);
  assert.equal(NOTIFICATION_ID_RETENTION, 1002);
  assert.equal(NOTIFICATION_ID_TEST, 9999);
});

test('areInstallNotificationsScheduled returns boolean without throwing', () => {
  const result = areInstallNotificationsScheduled();
  assert.equal(typeof result, 'boolean');
});

test('scheduleInstallNotifications runs safely in non-native environment without throwing', async () => {
  const result = await scheduleInstallNotifications();
  assert.equal(typeof result, 'boolean');
});

test('triggerTestNotification runs safely in non-native environment without throwing', async () => {
  const result = await triggerTestNotification({ delaySeconds: 1 });
  assert.equal(typeof result, 'object');
  assert.equal(result.success, true);
  assert.equal(result.native, false);
});

test('initializeNotificationListeners executes safely without throwing', async () => {
  await assert.doesNotReject(async () => {
    await initializeNotificationListeners();
  });
});
