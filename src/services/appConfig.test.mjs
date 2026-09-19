import test from 'node:test';
import assert from 'node:assert/strict';
import { isGameCenterEnabled, setGameCenterEnabled } from './appConfig.js';

test('Game Center feature flag defaults to disabled', () => {
  assert.equal(isGameCenterEnabled(), false);
});

test('setGameCenterEnabled(true) enables the flag', () => {
  setGameCenterEnabled(true);
  assert.equal(isGameCenterEnabled(), true);
  setGameCenterEnabled(false); // restore default for other tests
});

test('setGameCenterEnabled(false) disables the flag', () => {
  setGameCenterEnabled(true);
  setGameCenterEnabled(false);
  assert.equal(isGameCenterEnabled(), false);
});
