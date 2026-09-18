import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.join(here, 'TronLightcycleField.jsx');
const mainMenuPath = path.join(here, 'MainMenu.jsx');

test('TronLightcycleField renders decorative, varied horizontal and vertical trails', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /tron-lightcycle-field/);
  assert.match(source, /tron-lightcycle-\$\{trail\.axis\}/);

  // Trails vary by index rather than sharing one fixed speed/length/offset.
  assert.match(source, /duration: 6 \+ /);
  assert.match(source, /delay: -\(/);
  assert.match(source, /length: 120 \+ /);
});

test('MainMenu mounts the lightcycle field ahead of ModalAmbientParticles so the shared z-index sibling rule does not break its own absolute positioning', () => {
  const source = fs.readFileSync(mainMenuPath, 'utf8');

  assert.match(source, /import TronLightcycleField from '\.\/TronLightcycleField\.jsx';/);
  const fieldIndex = source.indexOf('<TronLightcycleField />');
  const particlesIndex = source.indexOf('<ModalAmbientParticles />');
  assert.ok(fieldIndex !== -1 && particlesIndex !== -1, 'both layers render in MainMenu');
  assert.ok(fieldIndex < particlesIndex, 'TronLightcycleField must render before ModalAmbientParticles');
});

test('index.css defines right-angle-only trail sweeps that respect reduced motion', () => {
  const cssPath = path.join(here, '..', 'index.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /@keyframes tronTrailMoveX/);
  assert.match(css, /@keyframes tronTrailMoveY/);
  assert.match(css, /\.tron-lightcycle-field \{[\s\S]*?position: absolute;[\s\S]*?z-index: 0;/);
  assert.match(css, /\.tron-lightcycle-trail \{[\s\S]*?animation: none;[\s\S]*?display: none;/);
});
