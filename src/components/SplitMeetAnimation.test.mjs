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
  assert.match(cssSource, /@keyframes curtainPeelOutLeft/);
  assert.match(cssSource, /@keyframes curtainPeelOutRight/);
  assert.match(cssSource, /@keyframes splitMeetReveal/);
  assert.match(cssSource, /@keyframes pageFadeIn/);

  // The old outside-in modal shutter keyframes are gone - modals now peel the same
  // direction as the screen transition (see below), so there's only one pair of keyframes.
  assert.doesNotMatch(cssSource, /@keyframes splitDoorSlideLeft/);
  assert.doesNotMatch(cssSource, /@keyframes splitDoorSlideRight/);

  // Split-meet clip path grows from a centered zero-width seam outward via inset() -
  // not polygon(): a polygon needs points that trace two independent growing rectangles,
  // but CSS interpolates each vertex in a straight line, which draws diagonal edges
  // across the middle (a visible hourglass artifact) instead of a clean reveal.
  assert.match(cssSource, /clip-path:\s*inset\(0 50% 0 50%\)/);
  assert.match(cssSource, /-webkit-clip-path:\s*inset\(0 50% 0 50%\)/);
  assert.doesNotMatch(cssSource, /clip-path:\s*polygon\(/);

  // Full-screen curtains peel outward...
  assert.match(cssSource, /\.screen-view-transition::before\s*\{[\s\S]*?curtainPeelOutLeft/);
  assert.match(cssSource, /\.screen-view-transition::after\s*\{[\s\S]*?curtainPeelOutRight/);

  // ...and modal shutters now peel the same direction (in to out), not the reverse
  assert.match(cssSource, /\.modal-split-card::before\s*\{[\s\S]*?curtainPeelOutLeft/);
  assert.match(cssSource, /\.modal-split-card::after\s*\{[\s\S]*?curtainPeelOutRight/);

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
