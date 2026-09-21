import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentDirectory = path.dirname(fileURLToPath(import.meta.url));
const canvasSource = fs.readFileSync(path.join(componentDirectory, 'GameCanvas.jsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(componentDirectory, '..', 'index.css'), 'utf8');

test('GameCanvas applies image-refresh-blink to both base and variant image viewports', () => {
  // Left Base image must include image-refresh-blink class and be keyed by level.id
  assert.match(
    canvasSource,
    /key=\{`\$\{level\.id\}-base`\}[\s\S]*?className="canvas-element image-refresh-blink"/,
    'Left image must carry key with level.id and image-refresh-blink class'
  );

  // Right Variant image must include image-refresh-blink class and be keyed by level.id
  assert.match(
    canvasSource,
    /key=\{`\$\{level\.id\}-variant`\}[\s\S]*?className="canvas-element image-refresh-blink"/,
    'Right image must carry key with level.id and image-refresh-blink class'
  );
});

test('index.css defines imageRefreshBlink keyframes and class with reduced-motion support', () => {
  // Keyframe animation for shutter refresh blink
  assert.match(cssSource, /@keyframes imageRefreshBlink\s*\{[\s\S]*?0%\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?100%\s*\{[\s\S]*?opacity:\s*1;/);
  assert.match(cssSource, /@-webkit-keyframes imageRefreshBlink/);

  // Class applying the animation with forwards fill mode
  assert.match(
    cssSource,
    /\.image-refresh-blink\s*\{[\s\S]*?animation:\s*imageRefreshBlink\s+0\.18s/
  );

  // Reduced motion media query disables the animation
  assert.match(
    cssSource,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.image-refresh-blink\s*\{[\s\S]*?animation:\s*none\s*!important/
  );
});
