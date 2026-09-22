/*
 * APP_VERSION, the iOS marketing version and the Android versionName have to be
 * changed by hand in three separate files, so they drift silently: the feedback
 * payload reported 1.4.0 for a build that shipped as 1.0, which would have
 * misled anyone triaging feedback by version.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION } from './appConfig.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => readFileSync(path.join(ROOT, rel), 'utf8');

test('APP_VERSION looks like a version', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
});

test('the iOS marketing version matches APP_VERSION on every build configuration', () => {
  const found = [...read('ios/App/App.xcodeproj/project.pbxproj')
    .matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(m => m[1].trim());

  assert.ok(found.length > 0, 'expected MARKETING_VERSION in the Xcode project');
  for (const version of found) {
    assert.equal(version, APP_VERSION,
      'ios/App/App.xcodeproj/project.pbxproj is out of step with APP_VERSION in appConfig.js');
  }
});

test('the Android versionName matches APP_VERSION', () => {
  const match = read('android/app/build.gradle').match(/versionName\s+"([^"]+)"/);

  assert.ok(match, 'expected versionName in android/app/build.gradle');
  assert.equal(match[1], APP_VERSION,
    'android/app/build.gradle is out of step with APP_VERSION in appConfig.js');
});
