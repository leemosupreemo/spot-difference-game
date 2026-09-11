import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

test('expired particle layer is scoped to failed daily runs and respects reduced motion', () => {
  const particleSource = fs.readFileSync(path.join(here, 'TronExpiredParticles.jsx'), 'utf8');
  const modalSource = fs.readFileSync(path.join(here, 'DailyVictoryModal.jsx'), 'utf8');
  const styles = fs.readFileSync(path.join(here, '..', 'index.css'), 'utf8');

  assert.match(modalSource, /isFailed && <TronExpiredParticles/);
  assert.match(particleSource, /aria-hidden="true"/);
  assert.match(particleSource, /tron-expired-particles/);
  assert.match(styles, /@keyframes tronParticleDrift/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /tron-expired-particles/);
});
