import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(here, '../index.css');
const sceneDelegatePath = path.join(here, '../../ios/App/App/SceneDelegate.swift');
const splashPath = path.join(here, 'SplashScreen.jsx');
const helpModalPath = path.join(here, 'HelpModal.jsx');
const exitModalPath = path.join(here, 'ConfirmExitModal.jsx');
const gameOverModalPath = path.join(here, 'GameOverModal.jsx');
const victoryModalPath = path.join(here, 'VictoryModal.jsx');
const dailyVictoryModalPath = path.join(here, 'DailyVictoryModal.jsx');
const ratingModalPath = path.join(here, 'RatingModal.jsx');

test('index.css locks horizontal scrolling universally without clipping fixed overlays', () => {
  const css = fs.readFileSync(cssPath, 'utf8');

  // html rules
  assert.match(css, /html\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /html\s*\{[^}]*overscroll-behavior-x:\s*none/);
  assert.match(css, /html\s*\{[^}]*touch-action:\s*pan-y/);

  // body rules
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /body\s*\{[^}]*overscroll-behavior-x:\s*none/);
  assert.match(css, /body\s*\{[^}]*touch-action:\s*pan-y/);

  // #root and .app-container touch actions (without overflow-x: clip so fixed overlays stretch edge-to-edge)
  assert.match(css, /#root\s*\{[^}]*touch-action:\s*pan-y/);
  assert.doesNotMatch(css, /#root\s*\{[^}]*overflow-x:\s*clip/);
  assert.doesNotMatch(css, /\.app-container\s*\{[^}]*overflow-x:\s*clip/);

  // .app-content rules lock all page content
  assert.match(css, /\.app-content\s*\{[^}]*overflow-x:\s*clip/);

  // main rules for play screen
  assert.match(css, /main\s*\{[^}]*overflow-x:\s*clip/);

  // menu-container for main screen
  assert.match(css, /\.menu-container\s*\{[^}]*overflow-x:\s*clip/);

  // curtain peel keyframes reset to translateX(0) at 100% so they do not hold open scroll width
  assert.match(css, /@keyframes curtainPeelOutRight\s*\{[\s\S]*?100%\s*\{[\s\S]*?translateX\(0\)/);
  assert.match(css, /@keyframes curtainPeelOutLeft\s*\{[\s\S]*?100%\s*\{[\s\S]*?translateX\(0\)/);
});

test('SceneDelegate.swift disables horizontal bouncing on iOS WKWebView scrollView', () => {
  const swift = fs.readFileSync(sceneDelegatePath, 'utf8');

  assert.match(swift, /webView\?\.scrollView\.alwaysBounceHorizontal\s*=\s*false/);
  assert.match(swift, /webView\?\.scrollView\.showsHorizontalScrollIndicator\s*=\s*false/);
});

test('SplashScreen has edge-to-edge dimensions and portals to document.body', () => {
  const splashCode = fs.readFileSync(splashPath, 'utf8');

  assert.match(splashCode, /width:\s*'100vw'/);
  assert.match(splashCode, /height:\s*'100dvh'/);
  assert.match(splashCode, /createPortal\(splashContent,\s*document\.body\)/);
  assert.match(splashCode, /backgroundColor:\s*'#090a10'/);
});

test('all modal backdrop overlays use transparent background so natural background shows through', () => {
  const helpCode = fs.readFileSync(helpModalPath, 'utf8');
  const exitCode = fs.readFileSync(exitModalPath, 'utf8');
  const gameOverCode = fs.readFileSync(gameOverModalPath, 'utf8');
  const victoryCode = fs.readFileSync(victoryModalPath, 'utf8');
  const dailyCode = fs.readFileSync(dailyVictoryModalPath, 'utf8');
  const ratingCode = fs.readFileSync(ratingModalPath, 'utf8');

  // HelpModal
  assert.match(helpCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'transparent'/);
  assert.doesNotMatch(helpCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'rgba\(0/);

  // ConfirmExitModal
  assert.match(exitCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'transparent'/);
  assert.doesNotMatch(exitCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'rgba\(0/);

  // GameOverModal
  assert.match(gameOverCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'transparent'/);
  assert.doesNotMatch(gameOverCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'rgba\(0/);

  // VictoryModal
  assert.match(victoryCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'transparent'/);
  assert.doesNotMatch(victoryCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'rgba\(0/);

  // DailyVictoryModal
  assert.match(dailyCode, /backgroundColor:\s*'transparent',\s*backdropFilter:\s*'blur\(12px\)'/);
  assert.doesNotMatch(dailyCode, /backgroundColor:\s*'rgba\(0,\s*0,\s*0/);

  // RatingModal
  assert.match(ratingCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'transparent'/);
  assert.doesNotMatch(ratingCode, /inset:\s*0,\s*zIndex:\s*100,\s*background:\s*'rgba\(0/);
});
