import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentDirectory = path.dirname(fileURLToPath(import.meta.url));
const timerSource = fs.readFileSync(path.join(componentDirectory, 'TimerDisplay.jsx'), 'utf8');
const viewModelSource = fs.readFileSync(path.join(componentDirectory, '..', 'viewmodels', 'useGameViewModel.js'), 'utf8');

test('renders the live potential speed points in the game HUD', () => {
  assert.match(timerSource, /calculateSpeedPoints/);
  assert.match(timerSource, /potentialPoints/);
});

test('delegates stage creation to buildPhotoPairStage in useGameViewModel', () => {
  assert.match(
    viewModelSource,
    /buildPhotoPairStage/
  );
});
