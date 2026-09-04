import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'VictoryModal.jsx'
);

test('contains a fail-safe around the native victory celebration effect', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /try \{[\s\S]*confetti\(/);
  assert.match(source, /catch \(error\) \{[\s\S]*Victory celebration unavailable/);
});

test('triggers fanfare and golden confetti when an image set is completed with 3 stars', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Confirms fanfare sound invocation
  assert.match(source, /sounds\.playFanfare\(/);

  // Confirms golden color palette for 3-star completion
  assert.match(source, /goldenColors\s*=\s*\[/);
  assert.match(source, /#FFD700/);
  assert.match(source, /#FFA500/);
  assert.match(source, /isThreeStars\s*\?\s*goldenColors\s*:\s*standardColors/);
});

test('adds right padding to ACCURACY and MISSES labels and displays Next Stage button', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /paddingRight:\s*['"]8px['"][\s\S]*ACCURACY/);
  assert.match(source, /paddingRight:\s*['"]8px['"][\s\S]*MISSES/);
  assert.match(source, /Next Stage/);
  assert.doesNotMatch(source, /Next Pair/);
});
