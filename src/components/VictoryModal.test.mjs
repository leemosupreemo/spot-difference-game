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
