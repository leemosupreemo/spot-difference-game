import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const modalPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'ConfirmExitModal.jsx'
);

test('ConfirmExitModal shows daily challenge forfeit warning when isDaily is true', () => {
  const source = fs.readFileSync(modalPath, 'utf8');

  // Prop verification
  assert.match(source, /isDaily\s*=\s*false/);

  // Daily forfeit warning copy
  assert.match(source, /Forfeit Set of the Day\?/);
  assert.match(source, /This will mark today's set as a failure\./);
  assert.doesNotMatch(source, /You will not be able to re-attempt until tomorrow's daily refresh/);
  assert.match(source, /\{isDaily \? 'Forfeit' : 'Quit to Menu'\}/);

  // Standard quit copy
  assert.match(source, /Quit Current Game\?/);
  assert.match(source, /Your current stage progress will be lost/);
  assert.doesNotMatch(source, /Are you sure you want to return to the menu/);
  assert.match(source, /Quit to Menu/);
});
