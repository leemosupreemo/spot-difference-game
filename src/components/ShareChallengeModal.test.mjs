import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'ShareChallengeModal.jsx'
);

test('ShareChallengeModal includes viral challenge actions, card generation, and analytics', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  // Confirms Challenge a Friend modal header and copy
  assert.match(source, /CHALLENGE A FRIEND/);
  assert.match(source, /Share Challenge Link/);
  assert.match(source, /Copy Challenge Text & Link/);
  assert.match(source, /Save Branded Image Card/);

  // Confirms canvas image card rendering
  assert.match(source, /renderChallengeCardBlob/);

  // Confirms analytics integration
  assert.match(source, /trackChallengeShareClicked/);
  assert.match(source, /trackChallengeShareCompleted/);
  assert.match(source, /recordLocalShareEvent/);
});
