import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(here, '../index.css');
const sceneDelegatePath = path.join(here, '../../ios/App/App/SceneDelegate.swift');

test('index.css locks horizontal scrolling universally across html, body, and app containers', () => {
  const css = fs.readFileSync(cssPath, 'utf8');

  // html rules
  assert.match(css, /html\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /html\s*\{[\s\S]*?overscroll-behavior-x:\s*none/);
  assert.match(css, /html\s*\{[\s\S]*?touch-action:\s*pan-y/);

  // body rules
  assert.match(css, /body\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /body\s*\{[\s\S]*?overscroll-behavior-x:\s*none/);
  assert.match(css, /body\s*\{[\s\S]*?touch-action:\s*pan-y/);

  // #root rules
  assert.match(css, /#root\s*\{[\s\S]*?overflow-x:\s*clip/);
  assert.match(css, /#root\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(css, /#root\s*\{[\s\S]*?touch-action:\s*pan-y/);

  // .app-container & .app-content rules
  assert.match(css, /\.app-container\s*\{[\s\S]*?overflow-x:\s*clip/);
  assert.match(css, /\.app-content\s*\{[\s\S]*?overflow-x:\s*clip/);

  // main rules for play screen
  assert.match(css, /main\s*\{[\s\S]*?overflow-x:\s*clip/);

  // menu-container for main screen
  assert.match(css, /\.menu-container\s*\{[\s\S]*?overflow-x:\s*clip/);

  // curtain peel keyframes reset to translateX(0) at 100% so they do not hold open scroll width
  assert.match(css, /@keyframes curtainPeelOutRight\s*\{[\s\S]*?100%\s*\{[\s\S]*?translateX\(0\)/);
  assert.match(css, /@keyframes curtainPeelOutLeft\s*\{[\s\S]*?100%\s*\{[\s\S]*?translateX\(0\)/);
});

test('SceneDelegate.swift disables horizontal bouncing on iOS WKWebView scrollView', () => {
  const swift = fs.readFileSync(sceneDelegatePath, 'utf8');

  assert.match(swift, /webView\?\.scrollView\.alwaysBounceHorizontal\s*=\s*false/);
  assert.match(swift, /webView\?\.scrollView\.showsHorizontalScrollIndicator\s*=\s*false/);
});
