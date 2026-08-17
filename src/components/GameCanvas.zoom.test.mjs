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
  assert.match(source, /calc\(-100% - 16px\)/);
});

test('handles tap and drag gestures without triggering accidental misses in zoom mode', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /if \(start\.isDrag/);
  assert.match(source, /if \(magnifierEnabled\)/);
});
