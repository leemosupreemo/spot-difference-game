import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'MainMenu.jsx'
);

test('MainMenu supports Photography and Abstract categories and Start Game CTA', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /SCENE_THEMES/);
  assert.match(source, /find_the_sniper/);
  assert.match(source, /abstract_animated/);
  assert.match(source, /START GAME/);
  assert.match(source, /trackCategorySelected/);
  assert.match(source, /onStartGame/);
});
