import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.join(here, '../../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

test('firestore.rules enforces public read and blocks direct client write for leaderboards', () => {
  // Leaderboards allow public read
  assert.match(rulesContent, /match \/leaderboards\/\{document=\*\*\}/);
  assert.match(rulesContent, /allow read:\s*if true;/);

  // Leaderboards block client-side write to enforce Cloud Function processing
  assert.match(rulesContent, /allow write:\s*if false;/);
});

test('firestore.rules enforces strict owner-only access for player documents', () => {
  assert.match(rulesContent, /match \/players\/\{playerId\}\/\{document=\*\*\}/);
  assert.match(rulesContent, /allow read, write:\s*if request\.auth != null && request\.auth\.uid == playerId;/);
});

test('firestore.rules protects daily attempts and remote levels', () => {
  assert.match(rulesContent, /match \/daily_attempts\/\{attemptId\}/);
  assert.match(rulesContent, /match \/remote_level_packs\/\{packId\}/);
  assert.match(rulesContent, /match \/app_config\/\{docId\}/);
});

test('firestore.rules no longer defines percentile distribution collections', () => {
  assert.doesNotMatch(rulesContent, /set_distributions/);
  assert.doesNotMatch(rulesContent, /daily_distributions/);
});
