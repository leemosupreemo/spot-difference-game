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
  assert.match(source, /Quitting now will forfeit today's Set of the Day run as a failed attempt/);
  assert.match(source, /You will not be able to re-attempt until tomorrow's daily refresh/);
  assert.match(source, /\{isDaily \? 'Forfeit' : 'Quit to Menu'\}/);

  // Standard quit copy
  assert.match(source, /Quit Current Game\?/);
  assert.match(source, /Your current stage progress will be lost/);
  assert.match(source, /Quit to Menu/);
});
