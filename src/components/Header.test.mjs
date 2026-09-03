import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'Header.jsx'
);

test('Header renders the app icon next to DIFF HUNTER title', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /src="\/app-icon\.png"/);
  assert.match(source, /DIFF HUNTER/);
  assert.doesNotMatch(source, /<Eye/);
  assert.match(source, /<span>Scores<\/span>/);
  assert.doesNotMatch(source, /<span>Stats<\/span>/);
  assert.match(source, /\{debugMode && \(/);
});

