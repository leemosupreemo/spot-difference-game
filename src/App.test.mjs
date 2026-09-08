import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'App.jsx'
);

test('App.jsx defines essential state variables including view and incomingChallenge', () => {
  const source = fs.readFileSync(appPath, 'utf8');

  // Verify view state is properly declared
  assert.match(source, /const\s*\[\s*view\s*,\s*setView\s*\]\s*=\s*useState\(['"]menu['"]\)/);

  // Verify incomingChallenge state is properly declared
  assert.match(source, /const\s*\[\s*incomingChallenge\s*,\s*setIncomingChallenge\s*\]\s*=/);

  // Verify view transitions and routing exist
  assert.match(source, /view\s*===\s*['"]menu['"]/);
  assert.match(source, /view\s*===\s*['"]stats['"]/);
  assert.match(source, /view\s*===\s*['"]creator['"]/);
  assert.match(source, /view\s*===\s*['"]game['"]/);
});
