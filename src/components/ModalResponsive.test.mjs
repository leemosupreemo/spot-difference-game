import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

test('records and victory overlays cap their cards to the phone viewport', () => {
  const leaderboard = fs.readFileSync(path.join(here, 'LeaderboardModal.jsx'), 'utf8');
  const victory = fs.readFileSync(path.join(here, 'VictoryModal.jsx'), 'utf8');

  for (const source of [leaderboard, victory]) {
    assert.match(source, /maxHeight:\s*['"]calc\(100dvh - 32px\)['"]/);
    assert.match(source, /overflowY:\s*['"]auto['"]/);
    assert.match(source, /boxSizing:\s*['"]border-box['"]/);
  }
});

test('centered utility dialogs use the same dynamic viewport cap', () => {
  const files = [
    'ConfirmExitModal.jsx',
    'GameOverModal.jsx',
    'HelpModal.jsx',
    'CuratedExportModal.jsx',
    'DebugLevelGeneratorModal.jsx',
    'DiagnosticsModal.jsx',
    'DailyVictoryModal.jsx'
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(here, file), 'utf8');
    assert.match(source, /maxHeight:\s*['"]calc\(100dvh - 32px\)['"]/);
    assert.match(source, /boxSizing:\s*['"]border-box['"]/);
  }
});

test('modals adhere to standardized 1.4rem title font size and weight', () => {
  const modalFiles = [
    'VictoryModal.jsx',
    'DailyVictoryModal.jsx',
    'LeaderboardModal.jsx',
    'GameOverModal.jsx',
    'ConfirmExitModal.jsx',
    'RatingModal.jsx',
    'DiagnosticsModal.jsx',
    'CuratedExportModal.jsx',
    'HelpModal.jsx'
  ];

  for (const file of modalFiles) {
    const source = fs.readFileSync(path.join(here, file), 'utf8');
    assert.match(source, /fontSize:\s*['"]1\.4rem['"]/);
    assert.match(source, /fontWeight:\s*900/);
  }
});
