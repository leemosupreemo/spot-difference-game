import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  logApp,
  getAppLogs,
  clearAppLogs,
  subscribeAppLogs
} from './logger.js';

test('logger logs messages with level, timestamp, and arguments', () => {
  clearAppLogs();
  assert.equal(getAppLogs().length, 0);

  logApp('INFO', 'Game started', { score: 100 });
  const logs = getAppLogs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].level, 'INFO');
  assert.ok(logs[0].message.includes('Game started'));
  assert.ok(logs[0].message.includes('"score":100'));
});

test('logger enforces max 100 log entries cap', () => {
  clearAppLogs();
  for (let i = 0; i < 110; i++) {
    logApp('DEBUG', `Message ${i}`);
  }

  const logs = getAppLogs();
  assert.equal(logs.length, 100);
  assert.ok(logs[0].message.includes('Message 10'));
  assert.ok(logs[logs.length - 1].message.includes('Message 109'));
});

test('subscribeAppLogs notifies listeners on new log entries and on clear', () => {
  clearAppLogs();
  const notifications = [];
  const unsubscribe = subscribeAppLogs(currentLogs => {
    notifications.push(currentLogs.length);
  });

  logApp('WARN', 'Warning 1');
  logApp('ERROR', 'Error 2');
  clearAppLogs();

  assert.ok(notifications.length >= 3);
  assert.equal(notifications[notifications.length - 1], 0);

  if (typeof unsubscribe === 'function') {
    unsubscribe();
  }
});
