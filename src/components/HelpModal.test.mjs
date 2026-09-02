import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'HelpModal.jsx'
);

test('HelpModal How to Play rules focus on tap the difference without original/modified or hints', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Must not have "Original (left) and Modified (right)"
  assert.doesNotMatch(source, /Original \(left\)/);
  assert.doesNotMatch(source, /Modified \(right\)/);

  // Must not have Hints rule section
  assert.doesNotMatch(source, /Hints & Dual Magnifier Loupe/);
  assert.doesNotMatch(source, /golden radar pulse/);

  // Must contain direct "Tap the Difference" instructions
  assert.match(source, /Tap the Difference/);
  assert.match(source, /plain and simple/);
  assert.match(source, /Speedrun Timer/);
});
