import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const MODAL_FILES = [
  'VictoryModal.jsx',
  'DailyVictoryModal.jsx',
  'LeaderboardModal.jsx',
  'GameOverModal.jsx',
  'ConfirmExitModal.jsx',
  'RatingModal.jsx',
  'DiagnosticsModal.jsx',
  'CuratedExportModal.jsx',
  'HelpModal.jsx',
  'DebugLevelGeneratorModal.jsx',
  'ShareChallengeModal.jsx'
];

test('ambient particle layer renders as a child of every standard modal card', () => {
  for (const file of MODAL_FILES) {
    const source = fs.readFileSync(path.join(here, file), 'utf8');
    assert.match(source, /import ModalAmbientParticles from '\.\/ModalAmbientParticles\.jsx';/, `${file} imports ModalAmbientParticles`);
    assert.match(source, /<ModalAmbientParticles\s*\/>/, `${file} renders <ModalAmbientParticles />`);
  }
});

test('ambient particle layer also renders behind the main menu screen', () => {
  const source = fs.readFileSync(path.join(here, 'MainMenu.jsx'), 'utf8');
  assert.match(source, /import ModalAmbientParticles from '\.\/ModalAmbientParticles\.jsx';/);
  assert.match(source, /<ModalAmbientParticles\s*\/>/);

  const styles = fs.readFileSync(path.join(here, '..', 'index.css'), 'utf8');
  assert.match(styles, /\.menu-container\s*\{[^}]*position:\s*relative;/);
});

test('ambient particle layer respects reduced motion and stays decorative', () => {
  const particleSource = fs.readFileSync(path.join(here, 'ModalAmbientParticles.jsx'), 'utf8');
  const styles = fs.readFileSync(path.join(here, '..', 'index.css'), 'utf8');

  assert.match(particleSource, /aria-hidden="true"/);
  assert.match(particleSource, /modal-ambient-particles/);
  assert.match(styles, /@keyframes ambientParticleDrift/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.modal-ambient-scanline,\s*\n\s*\.modal-ambient-particle\s*\{\s*\n\s*animation: none;/);
});
