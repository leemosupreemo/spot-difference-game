import test from 'node:test';
import assert from 'node:assert/strict';
import { getInitialDebugMode, isDevEnvironment } from './debugMode.js';
import fs from 'node:fs';

test('isDevEnvironment recognizes dev hosts and flags', () => {
  // Mock window for dev channel URL
  globalThis.window = {
    location: {
      hostname: 'diffhunter--dev-4ewdey4c.web.app',
      search: ''
    }
  };
  globalThis.localStorage = { getItem: () => null };

  assert.equal(isDevEnvironment(), true);
  assert.equal(getInitialDebugMode(), true);

  // Mock localhost
  globalThis.window.location.hostname = 'localhost';
  assert.equal(isDevEnvironment(), true);
  assert.equal(getInitialDebugMode(), true);
});

test('getInitialDebugMode respects "unless specified otherwise" overrides on dev URL', () => {
  // ?debug=0 on dev channel URL disables debug mode
  globalThis.window = {
    location: {
      hostname: 'diffhunter--dev-4ewdey4c.web.app',
      search: '?debug=0'
    }
  };
  globalThis.localStorage = { getItem: () => null };
  assert.equal(getInitialDebugMode(), false);

  // ?debug=false on dev channel URL disables debug mode
  globalThis.window.location.search = '?debug=false';
  assert.equal(getInitialDebugMode(), false);

  // localStorage diff_hunter_debug='false' on dev channel URL disables debug mode
  globalThis.window.location.search = '';
  globalThis.localStorage = {
    getItem: (k) => (k === 'diff_hunter_debug' ? 'false' : null)
  };
  assert.equal(getInitialDebugMode(), false);
});

test('getInitialDebugMode defaults to false on production URL unless specified', () => {
  globalThis.window = {
    location: {
      hostname: 'diffhunter.web.app',
      search: ''
    }
  };
  globalThis.localStorage = { getItem: () => null };

  assert.equal(getInitialDebugMode(), false);

  // Explicit ?debug=1 on production enables debug mode
  globalThis.window.location.search = '?debug=1';
  assert.equal(getInitialDebugMode(), true);
});

test('debug builds force debug on even when an old opt-out is persisted', () => {
  const source = fs.readFileSync(new URL('./debugMode.js', import.meta.url), 'utf8');
  assert.match(source, /VITE_FORCE_DEBUG\s*===\s*['"]true['"]/);
});
