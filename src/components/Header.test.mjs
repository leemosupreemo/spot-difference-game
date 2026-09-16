import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'Header.jsx'
);

test('Header renders the app icon next to DIFF HUNTER title', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /src="\/app-icon\.png"/);
  assert.match(source, /DIFF HUNTER/);
  assert.doesNotMatch(source, /<Eye/);
  assert.match(source, /<span>Scores<\/span>/);
  assert.doesNotMatch(source, /<span>Stats<\/span>/);
  assert.match(source, /\{debugMode && \(/);
});

test('Header leaves gameplay controls to the in-game HUD', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /if \(view === 'game'\) return null;/);
});

test('Header stays clean with navigation controls and no login/status buttons', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // No auth or status buttons in top bar
  assert.doesNotMatch(source, /auth-status-btn/);
  assert.doesNotMatch(source, /AuthProviderIcon/);
  assert.doesNotMatch(source, /Not Logged In/);
  assert.doesNotMatch(source, /Tap to Sign In/);

  // Focuses on core navigation and controls
  assert.match(source, /handleOpenStats/);
  assert.match(source, /toggleSound/);
  assert.match(source, /onOpenHelp/);
});
