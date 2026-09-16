import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(here, '../index.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');

test('index.css provides split-meet animations for modals and screen transitions', () => {
  // Keyframe animations
  assert.match(cssSource, /@keyframes splitDoorSlideLeft/);
  assert.match(cssSource, /@keyframes splitDoorSlideRight/);
  assert.match(cssSource, /@keyframes splitMeetReveal/);
  assert.match(cssSource, /@keyframes pageFadeIn/);

  // Split-meet clip path polygon dual-half coverage
  assert.match(cssSource, /clip-path:\s*polygon\(/);
  assert.match(cssSource, /-webkit-clip-path:\s*polygon\(/);

  // Left and right shutter doors on .screen-view-transition
  assert.match(cssSource, /\.screen-view-transition::before\s*\{[\s\S]*?splitDoorSlideLeft/);
  assert.match(cssSource, /\.screen-view-transition::after\s*\{[\s\S]*?splitDoorSlideRight/);

  // Left and right shutter doors on .modal-split-card
  assert.match(cssSource, /\.modal-split-card::before\s*\{[\s\S]*?splitDoorSlideLeft/);
  assert.match(cssSource, /\.modal-split-card::after\s*\{[\s\S]*?splitDoorSlideRight/);

  // Accessibility reduced motion check
  assert.match(cssSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.screen-view-transition[\s\S]*?\.modal-split-card/);
});

test('dialog modals adopt the modal-split-card entrance contract', () => {
  const modalFiles = [
    'VictoryModal.jsx',
    'DailyVictoryModal.jsx',
    'GameOverModal.jsx',
    'ConfirmExitModal.jsx',
    'RatingModal.jsx',
    'HelpModal.jsx',
    'DiagnosticsModal.jsx',
    'ProgressModal.jsx'
  ];

  for (const fileName of modalFiles) {
    const fileSource = fs.readFileSync(path.join(here, fileName), 'utf8');
    assert.match(
      fileSource,
      /modal-split-card/,
      `Expected ${fileName} to include modal-split-card class`
    );
  }
});
