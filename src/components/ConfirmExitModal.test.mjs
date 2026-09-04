import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const componentPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'ConfirmExitModal.jsx'
);

test('ConfirmExitModal renders confirmation dialog with Keep Playing and Quit to Menu CTAs', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  assert.match(source, /Quit Current Game\?/);
  assert.match(source, /Keep Playing/);
  assert.match(source, /Quit to Menu/);
  assert.match(source, /onConfirm/);
  assert.match(source, /onCancel/);
});

test('App.jsx intercepts back button in game view to show ConfirmExitModal', () => {
  const appPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'App.jsx');
  const appSource = fs.readFileSync(appPath, 'utf8');

  assert.match(appSource, /import ConfirmExitModal from '\.\/components\/ConfirmExitModal'/);
  assert.match(appSource, /confirmExitModalOpen/);
  assert.match(appSource, /handleRequestBack/);
  assert.match(appSource, /<ConfirmExitModal/);
});

