import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const notice = fs.readFileSync(path.join(here, 'OfflineSetNotice.jsx'), 'utf8');
const app = fs.readFileSync(path.join(here, '../App.jsx'), 'utf8');
const menu = fs.readFileSync(path.join(here, 'MainMenu.jsx'), 'utf8');

test('the notice renders nothing until a switch actually happened', () => {
  assert.match(notice, /if \(!visible\) return null;/);
});

test('it is announced to assistive tech and can be dismissed', () => {
  assert.match(notice, /role="status"/);
  assert.match(notice, /aria-label="Dismiss offline notice"/);
});

test('it says why the set went away and that it comes back', () => {
  assert.match(notice, /offline/i);
  assert.match(notice, /switched you/i);
  assert.match(notice, /reconnect/i);
});

test('it only fires for an online-only set lost while offline', () => {
  // Not merely "the selection changed" -- a pruned set or a first run must not
  // apologise for something the player never had.
  assert.match(app, /isRemoteSetId\(photoSetId\) && !networkOnline/);
  assert.match(app, /setSwitchedOffRemoteSet\(true\)/);
});

test('reconnecting retires the notice on its own', () => {
  assert.match(app, /if \(networkOnline\) setSwitchedOffRemoteSet\(false\);/);
});

test('the notice is wired through MainMenu ahead of the banner', () => {
  assert.match(app, /noticeSlot=\{/);
  assert.match(app, /<OfflineSetNotice/);
  assert.match(menu, /noticeSlot = null,/);
  assert.match(menu, /\{noticeSlot\}\s*\n\s*\{bannerSlot\}/);
});

test('the switch is logged so it can be traced after the fact', () => {
  assert.match(app, /PhotoSet:OfflineSwitch/);
});
