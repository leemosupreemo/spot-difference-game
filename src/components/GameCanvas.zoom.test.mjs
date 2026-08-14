import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'GameCanvas.jsx'
);

test('ignores canvas guesses while magnifier mode is active', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(
    source,
    /const handleCanvasTap = \(e, containerRef\) => \{\s*if \(magnifierEnabled\) return;/
  );
});

test('shows the magnifier only when the Zoom button enables it', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.doesNotMatch(source, /setIsHoldZooming\(true\)/);
  assert.match(source, /const isLensVisible = magnifierEnabled && cursorPos\.visible;/);
});
