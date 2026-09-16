import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'TimerDisplay.jsx'
);

test('TimerDisplay formats millisecond precision timer and live speed points', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /formatTime/);
  assert.match(source, /calculateSpeedPoints/);
  assert.match(source, /potentialPoints/);
  assert.match(source, /hintsLeft/);
  assert.match(source, /magnifierEnabled/);
  assert.match(source, /livesRemaining/);
  assert.match(source, /Math\.max\(0, 3 - missCount\)/);
  assert.match(source, /Search size=\{20\} color="var\(--accent-cyan\)"/);
  assert.match(source, /<span style=\{\{ color: 'var\(--accent-cyan\)'/);
});

test('TimerDisplay places the sound toggle beside Zoom', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /Volume2|VolumeX/);
  assert.match(source, /muted/);
  assert.match(source, /data-zoom-button="true"[\s\S]*?data-sound-button="true"/);
});
