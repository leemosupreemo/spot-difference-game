import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'GameCanvas.jsx'
);

test('provides synchronized dual magnifier loupe with offset above touch', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /magnifierEnabled && cursorPos\.visible/);
  assert.match(source, /magnifier-lens/);
  assert.match(source, /calc\(-100% \+ 4px\)/);
  // Ensure no flipping behavior exists near top edge
  assert.doesNotMatch(source, /cursorPos\.y > 22/);
  // Ensure center-locked backgroundPosition calculation for edge visibility
  assert.match(source, /calc\(77px - /);
});

test('handles tap and drag gestures without triggering accidental misses in zoom mode', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /if \(start\.isDrag/);
  assert.match(source, /if \(magnifierEnabled\)/);
});

test('App.jsx resets magnifier zoom when leaving game view or starting a new game', () => {
  const appPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'App.jsx');
  const appSource = fs.readFileSync(appPath, 'utf8');

  assert.match(appSource, /if \(view !== 'game'\)\s*\{\s*setMagnifierEnabled\(false\)/);
  assert.match(appSource, /startLevel = useCallback\(\(levelId\) => \{[\s\S]*setMagnifierEnabled\(false\)/);
});

test('GameCanvas renders identical miss markers on both left and right canvases', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Both sides must use identical miss-marker structure with -1 heart inside
  assert.doesNotMatch(source, /className="miss-heart-popup"/);
  assert.match(source, /key=\{`left-miss-group-\$\{miss\.id\}`\}[\s\S]*className="miss-marker"[\s\S]*-1 ❤️/);
  assert.match(source, /key=\{`right-miss-group-\$\{miss\.id\}`\}[\s\S]*className="miss-marker"[\s\S]*-1 ❤️/);
});

test('game-viewport includes thin vertical divider line without altering layout spacing', () => {
  const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.css');
  const cssSource = fs.readFileSync(cssPath, 'utf8');

  assert.match(cssSource, /\.game-viewport::after\s*\{[^}]*position:\s*absolute/);
  assert.match(cssSource, /\.game-viewport::after\s*\{[^}]*left:\s*50%/);
  assert.match(cssSource, /\.game-viewport::after\s*\{[^}]*width:\s*1px/);
  assert.match(cssSource, /\.game-viewport::after\s*\{[^}]*pointer-events:\s*none/);
});

test('quick one tap outside either left or right image bounds toggles zoom mode off', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Verify setMagnifierEnabled is accepted and called on quick tap outside
  assert.match(source, /setMagnifierEnabled/);
  assert.match(source, /containerRefLeft\.current\?\.contains\(e\.target\)/);
  assert.match(source, /containerRefRight\.current\?\.contains\(e\.target\)/);
  assert.match(source, /setMagnifierEnabled\(false\)/);
  assert.match(source, /sounds\.playTap\(\)/);
});




