import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'DebugCuratorBar.jsx'
);

test('imports every icon used by the wrong-difficulty status view', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /import \{[^}]*AlertTriangle[^}]*\} from 'lucide-react';/s);
  assert.match(source, /currentStatus === 'wrong_difficulty'/);
  assert.match(source, /<AlertTriangle size=\{14\}/);
});

test('provides explicit Photography and Fantastical category controls', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /onSetCategory/);
  assert.match(source, /Photography/);
  assert.match(source, /Fantastical/);
});
