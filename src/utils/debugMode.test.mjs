/*
 * Debug mode exposes the curator bar, the level pool internals and the
 * diagnostics export. Every runtime route in is reachable by anyone holding the
 * app -- three taps on the logo, ?debug=1, or a localStorage key -- so the only
 * gate that actually holds is the build-time one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

test('getInitialDebugMode refuses before consulting URL or localStorage', () => {
  const source = read('src/utils/debugMode.js');
  const body = source.slice(source.indexOf('export function getInitialDebugMode'));

  const gate = body.indexOf('debugFeaturesEnabled()');
  const urlParam = body.indexOf('URLSearchParams');
  const storage = body.indexOf('diff_hunter_debug');

  assert.ok(gate > -1, 'getInitialDebugMode must consult debugFeaturesEnabled');
  assert.ok(gate < urlParam, '?debug=1 must not be read before the build gate');
  assert.ok(gate < storage, 'localStorage must not be read before the build gate');
});

test('the debug toggle is not handed to the header in a locked build', () => {
  const app = read('src/App.jsx');

  assert.ok(!/onToggleDebug=\{toggleDebugMode\}/.test(app),
    'onToggleDebug must be gated, not passed unconditionally');
  assert.match(app, /onToggleDebug=\{debugFeaturesEnabled\(\) \? toggleDebugMode : null\}/);
});

test('toggleDebugMode refuses in a locked build even if something calls it', () => {
  const app = read('src/App.jsx');
  const fn = app.slice(app.indexOf('const toggleDebugMode'), app.indexOf('const handleToggleTutorialAnimation'));

  assert.match(fn, /if \(!debugFeaturesEnabled\(\)\) return;/);
});

test('the App Store build does not enable debug features', () => {
  const appstore = read('scripts/distribute_appstore.sh');

  assert.ok(!appstore.includes('VITE_ENABLE_DEBUG'),
    'the public build must not opt into debug features');
  assert.ok(!appstore.includes('VITE_FORCE_DEBUG=true'));
});

test('internal tester builds keep their way in', () => {
  const internal = read('scripts/distribute_ios.sh');

  assert.match(internal, /VITE_ENABLE_DEBUG="\$\{VITE_ENABLE_DEBUG:-true\}"/);
});
