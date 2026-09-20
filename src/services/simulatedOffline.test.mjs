import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function freshStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  return store;
}

// Debug mode is read via getInitialDebugMode, which consults the URL and
// localStorage. Force it on for these tests.
function mockWindow(hostname, search) {
  globalThis.window = {
    location: { hostname, search },
    addEventListener() {},
    removeEventListener() {}
  };
  // Node exposes navigator as a getter-only global; redefine rather than assign.
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true }, configurable: true, writable: true
  });
}
function enableDebug() { mockWindow('localhost', ''); }
function disableDebug() { mockWindow('diffhunter.app', '?debug=0'); }

test('simulating offline forces isOnline false and persists', async () => {
  freshStorage();
  enableDebug();
  const net = await import('./networkService.js?case=1');
  assert.equal(net.isOnline(), true);

  net.setSimulatedOffline(true);
  assert.equal(net.isSimulatedOffline(), true);
  assert.equal(net.isOnline(), false);
  assert.equal(globalThis.localStorage.getItem(net.STORAGE_KEY_SIMULATED_OFFLINE), 'true');

  net.setSimulatedOffline(false);
  assert.equal(net.isOnline(), true);
  assert.equal(globalThis.localStorage.getItem(net.STORAGE_KEY_SIMULATED_OFFLINE), null);
});

test('a real request succeeding cannot cancel the simulation', async () => {
  freshStorage();
  enableDebug();
  const net = await import('./networkService.js?case=2');
  net.setSimulatedOffline(true);
  net.recordNetworkSuccess();
  assert.equal(net.isOnline(), false, 'network success must not undo a deliberate simulation');
  assert.equal(await net.checkConnectivity(), false, 'the active probe must not undo it either');
});

test('subscribers are notified when the simulation is toggled', async () => {
  freshStorage();
  enableDebug();
  const net = await import('./networkService.js?case=3');
  const seen = [];
  net.subscribeNetworkStatus(v => seen.push(v));
  net.setSimulatedOffline(true);
  net.setSimulatedOffline(false);
  assert.deepEqual(seen, [false, true]);
});

test('the flag is ignored outside debug mode, so it cannot strand a player', async () => {
  freshStorage();
  enableDebug();
  const net = await import('./networkService.js?case=4');
  net.setSimulatedOffline(true);
  assert.equal(net.isOnline(), false);

  disableDebug();
  assert.equal(net.isSimulatedOffline(), false, 'a stale flag must not apply in a release build');
  assert.equal(net.isOnline(), true);
});

test('the toggle is exposed in the menu only under debug', () => {
  const menu = fs.readFileSync(new URL('../components/MainMenu.jsx', import.meta.url), 'utf8');
  assert.match(menu, /aria-label="Simulate Offline"/);
  assert.match(menu, /aria-pressed=\{simulatedOffline\}/);
  assert.match(menu, /\{debugMode && \(\s*\n\s*<button[\s\S]*?Simulate Offline/);

  const app = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(app, /onToggleSimulatedOffline=\{handleToggleSimulatedOffline\}/);
  assert.match(app, /setNetworkOnline\(isOnline\(\)\)/);
});
