import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initSentry,
  captureError,
  captureMessage,
  setSentryUser,
  addBreadcrumb,
  Sentry,
  SentryReact
} from './sentry.js';

test('sentry exports core monitoring utilities and SDK references', () => {
  assert.equal(typeof initSentry, 'function');
  assert.equal(typeof captureError, 'function');
  assert.equal(typeof captureMessage, 'function');
  assert.equal(typeof setSentryUser, 'function');
  assert.equal(typeof addBreadcrumb, 'function');
  assert.ok(Sentry, 'Sentry Capacitor reference is exported');
  assert.ok(SentryReact, 'Sentry React reference is exported');
});

test('initSentry runs safely in non-browser/test environments without throwing', () => {
  assert.doesNotThrow(() => {
    initSentry();
  });
});

test('captureError safely processes errors and context without throwing', () => {
  assert.doesNotThrow(() => {
    captureError(new Error('Test game error'), { levelId: 'photo_set_001_01', mode: 'photo' });
  });
});

test('captureMessage safely processes diagnostic strings without throwing', () => {
  assert.doesNotThrow(() => {
    captureMessage('Test diagnostic log', 'warning', { component: 'GameCanvas' });
  });
});

test('setSentryUser and addBreadcrumb operate safely', () => {
  assert.doesNotThrow(() => {
    setSentryUser('anon_player_123', { role: 'player' });
    addBreadcrumb({ category: 'gameplay', message: 'Level started', level: 'info' });
    setSentryUser(null);
  });
});
