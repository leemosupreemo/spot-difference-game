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

test('MainMenu conditionally displays TutorialBanner only until first image set is completed', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /hasCompletedFirstSet/);
  assert.match(source, /isSetCompleted/);
  assert.match(source, /\{!isSetCompleted && <TutorialBanner \/>\}/);
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



