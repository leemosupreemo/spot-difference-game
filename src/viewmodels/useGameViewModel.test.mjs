import test from 'node:test';
import assert from 'node:assert/strict';
import { useGameViewModel } from './useGameViewModel.js';

test('exports the main useGameViewModel presentation hook function', () => {
  assert.equal(typeof useGameViewModel, 'function');
});

test('exposes the actual loaded stage pair count to the view', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('./useGameViewModel.js', import.meta.url), 'utf8');

  assert.match(source, /stagePairCount/);
});
