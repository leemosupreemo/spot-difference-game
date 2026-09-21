import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'MainMenu.jsx'
);

test('MainMenu supports Photography and Abstract categories and Start Game CTA', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /SCENE_THEMES/);
  assert.match(source, /find_the_sniper/);
  assert.match(source, /INFINITE WORLDS/);
  assert.match(source, /START GAME/);
  assert.match(source, /trackCategorySelected/);
  assert.match(source, /onStartGame/);
});

test('MainMenu supports incoming challenge banner for viral link reception', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /incomingChallenge/);
  assert.match(source, /CHALLENGE RECEIVED/);
  assert.match(source, /Can you beat/);
});

test('MainMenu exposes a controlled Photo Set selector only in debug mode for Photography mode', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /photoSetIds/);
  assert.match(source, /photoSetId/);
  assert.match(source, /onPhotoSetChange/);
  assert.match(source, /debugMode && selectedTheme === 'find_the_sniper'/);
  assert.match(source, /<select/);
  assert.match(source, /PHOTO SET/);
});

test('MainMenu conditionally displays TutorialBanner only until first image set is completed', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /hasCompletedFirstSet/);
  assert.match(source, /isSetCompleted/);
  assert.match(source, /\(!isSetCompleted \|\| debugMode\)/);
  assert.match(source, /tutorialAnimationEnabled &&/);
});

test('MainMenu exposes debug-only tutorial animation toggle and daily banner slot', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /bannerSlot/);
  assert.match(source, /Tutorial Animation: ON/);
  assert.match(source, /Tutorial Animation: OFF/);
});

test('MainMenu enforces max length on Start Game button with periodic sheen and ripples removed', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /start-game-outer-container/);
  assert.match(source, /start-game-btn-wrapper/);
  assert.doesNotMatch(source, /pond-ripple-container/);
  assert.doesNotMatch(source, /pond-ripple/);
  assert.match(source, /maxWidth:\s*'360px'/);
  assert.doesNotMatch(source, /isRipplingBlue/);
});

test('index.css defines periodic sheen shimmer on start game button with ripples removed', () => {
  const cssPath = path.join(path.dirname(componentPath), '../index.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /startBtnPeriodicSheen/);
  assert.match(css, /\.start-game-btn::after/);
  assert.doesNotMatch(css, /@keyframes pondPropagateAndBounce/);
  assert.doesNotMatch(css, /startBtnWavePulse/);
});

test('Each Game Mode card shows its own dim, zoom/fade background hint, not the whole container', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // A real photo for Photography and a procedurally generated scene for Abstract,
  // neither pulled from the playable rotation.
  assert.match(source, /generateProceduralLevelPair\('abstract_animated', 'Medium', GAME_MODE_ABSTRACT_SEED\)/);
  assert.match(source, /resolveAssetUrl\(GAME_MODE_PHOTO_BG\)/);
  assert.match(source, /find_the_sniper: photoModeBg,\s*\n\s*abstract_animated: abstractModeBg/);

  // Each card tracks and replays its own animation independently on tap.
  assert.match(source, /setGameModeBgTicks\(prev => \(\{ \.\.\.prev, \[theme\.id\]: \(prev\[theme\.id\] \|\| 0\) \+ 1 \}\)\)/);
  assert.match(source, /key=\{`\$\{theme\.id\}-\$\{cardBgTick\}`\}/);

  // The bg layer renders inside each mode-card-item, not the outer Game Mode panel.
  assert.match(source, /className="glass-panel mode-card-item"[\s\S]*?\{cardBgImage && \([\s\S]*?className="game-mode-bg"/);

  const cssPath = path.join(path.dirname(componentPath), '../index.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /@keyframes gameModeBgZoomFadeIn/);
  assert.match(css, /to \{ opacity: 0\.22; transform: scale\(1\); \}/);
  assert.match(css, /\.game-mode-bg-image \{[\s\S]*?animation: none;[\s\S]*?\}/);
});

test('the debug set picker names sets by id, not list position', () => {
  const source = fs.readFileSync(new URL('./MainMenu.jsx', import.meta.url), 'utf8');
  assert.match(source, /formatSetLabel\(availableSetId\)/);
  // A positional label renames every set after an offline-filtered gap, and
  // makes remote_set_001 indistinguishable from photo_set_001.
  assert.doesNotMatch(source, /Photo Set \$\{index \+ 1\}/);
});

test('defines subtle pressed shrink state for mode cards, start game button, and set of the day banner', () => {
  const cssPath = path.join(path.dirname(componentPath), '../index.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Mode cards (Photo and Abstract) have tactile pressed shrink state
  assert.match(css, /\.mode-card-item:active\s*\{[\s\S]*?transform:\s*scale\(0\.975\)\s*!important/);

  // Start game button has subtle pressed shrink state
  assert.match(css, /\.start-game-btn:active\s*\{[\s\S]*?transform:\s*scale\(0\.975\)\s*!important/);

  // Set of the Day banner has subtle pressed state matching help button feel
  assert.match(css, /\.set-of-day-banner-card:active[\s\S]*?transform:\s*scale\(0\.985\)\s*!important/);

  // MainMenu mode cards have role="button"
  const menuSource = fs.readFileSync(new URL('./MainMenu.jsx', import.meta.url), 'utf8');
  assert.match(menuSource, /className="glass-panel mode-card-item"[\s\S]*?role="button"/);
});

test('MainMenu exposes a debug button to test local notifications when debugMode is active', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /triggerTestNotification/);
  assert.match(source, /debugMode && \(/);
  assert.match(source, /TEST NOTIFICATION/);
});
