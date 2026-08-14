import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentDirectory = path.dirname(fileURLToPath(import.meta.url));
const timerSource = fs.readFileSync(path.join(componentDirectory, 'TimerDisplay.jsx'), 'utf8');
const appSource = fs.readFileSync(path.join(componentDirectory, '..', 'App.jsx'), 'utf8');
const viewModelSource = fs.readFileSync(path.join(componentDirectory, '..', 'viewmodels', 'useGameViewModel.js'), 'utf8');

test('renders the live 500-to-25 speed award in the game HUD', () => {
  assert.match(timerSource, /availablePoints/);
  assert.match(timerSource, /\{availablePoints\}/);
  assert.match(appSource, /availablePoints=\{calculateSpeedPoints\(elapsedTime\)\}/);
});

test('does not use procedural fallback pairs in the photorealistic stage', () => {
  assert.match(
    viewModelSource,
    /buildPhotoPairStage\(\{[\s\S]*packId: selectedTheme/
  );
  assert.doesNotMatch(viewModelSource, /generateProceduralLevelPair/);
});
