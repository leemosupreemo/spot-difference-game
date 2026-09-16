import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateQualification,
  validateSubmissionInput,
  LEADERBOARD_LIMITS
} from './index.js';

test('functions LEADERBOARD_LIMITS aligns with spec', () => {
  assert.equal(LEADERBOARD_LIMITS.daily, 5);
  assert.equal(LEADERBOARD_LIMITS.category, 25);
  assert.equal(LEADERBOARD_LIMITS.photoSet, 3);
});

test('validateSubmissionInput rejects unauthenticated callers', () => {
  assert.throws(() => {
    validateSubmissionInput(null, { boardType: 'photoSet', boardId: 'set_1', score: 5000 });
  }, /Authentication required/i);

  assert.throws(() => {
    validateSubmissionInput({}, { boardType: 'photoSet', boardId: 'set_1', score: 5000 });
  }, /Authentication required/i);
});

test('validateSubmissionInput rejects invalid board types and missing IDs', () => {
  const auth = { uid: 'anon_1234' };

  assert.throws(() => {
    validateSubmissionInput(auth, { boardType: 'unsupported_mode', boardId: 'set_1', score: 5000 });
  }, /invalid boardType/i);

  assert.throws(() => {
    validateSubmissionInput(auth, { boardType: 'photoSet', boardId: '   ', score: 5000 });
  }, /Missing or invalid boardId/i);
});

test('validateSubmissionInput rejects invalid scores and anti-cheat sub-threshold times', () => {
  const auth = { uid: 'anon_1234' };

  assert.throws(() => {
    validateSubmissionInput(auth, { boardType: 'photoSet', boardId: 'set_1', score: -50 });
  }, /positive finite number/i);

  assert.throws(() => {
    validateSubmissionInput(auth, { boardType: 'photoSet', boardId: 'set_1', score: NaN });
  }, /positive finite number/i);

  // Anti-cheat: completion time under 1000ms is physically impossible
  assert.throws(() => {
    validateSubmissionInput(auth, { boardType: 'photoSet', boardId: 'set_1', score: 250 });
  }, /below physical threshold/i);
});

test('validateSubmissionInput sanitizes display name and sets defaults', () => {
  const auth = { uid: 'anon_user_9999' };

  // Defaults to Player + last 4 chars of UID
  const res1 = validateSubmissionInput(auth, {
    boardType: 'photoSet',
    boardId: 'photo_set_001',
    score: 8500
  });
  assert.equal(res1.displayName, 'Player 9999');
  assert.equal(res1.playerId, 'anon_user_9999');

  // Truncates extra long names
  const res2 = validateSubmissionInput(auth, {
    boardType: 'photoSet',
    boardId: 'photo_set_001',
    score: 8500,
    displayName: 'SuperDuperLongPlayerNameThatExceedsLimit'
  });
  assert.equal(res2.displayName.length <= 24, true);
});

test('evaluateQualification accepts candidate into empty board and calculates rank 1', () => {
  const candidate = { playerId: 'uid_1', score: 8500 };
  const res = evaluateQualification([], candidate, 3, 'elapsedMs');

  assert.equal(res.qualifies, true);
  assert.equal(res.rank, 1);
  assert.equal(res.updatedEntries.length, 1);
  assert.equal(res.updatedEntries[0].rank, 1);
  assert.equal(res.updatedEntries[0].playerId, 'uid_1');
});

test('evaluateQualification evicts 4th entry on Top 3 photo set leaderboard', () => {
  const currentEntries = [
    { playerId: 'bot_1', score: 9000, rank: 1 },
    { playerId: 'bot_2', score: 11000, rank: 2 },
    { playerId: 'bot_3', score: 14000, rank: 3 }
  ];
  const candidate = { playerId: 'new_player', score: 10500 };
  const res = evaluateQualification(currentEntries, candidate, 3, 'elapsedMs');

  assert.equal(res.qualifies, true);
  assert.equal(res.rank, 2);
  assert.equal(res.updatedEntries.length, 3);
  assert.equal(res.updatedEntries[0].playerId, 'bot_1');
  assert.equal(res.updatedEntries[1].playerId, 'new_player');
  assert.equal(res.updatedEntries[2].playerId, 'bot_2');
  assert.equal(res.updatedEntries.some(e => e.playerId === 'bot_3'), false);
});

test('evaluateQualification deduplicates player and preserves only their fastest attempt', () => {
  const currentEntries = [
    { playerId: 'hero_uid', score: 12000, rank: 1 },
    { playerId: 'bot_2', score: 13000, rank: 2 },
    { playerId: 'bot_3', score: 14000, rank: 3 }
  ];

  // Slower attempt by same player should not qualify
  const slowerAttempt = { playerId: 'hero_uid', score: 12500 };
  const slowRes = evaluateQualification(currentEntries, slowerAttempt, 3, 'elapsedMs');
  assert.equal(slowRes.qualifies, false);

  // Faster attempt by same player qualifies and replaces old record
  const fasterAttempt = { playerId: 'hero_uid', score: 10000 };
  const fastRes = evaluateQualification(currentEntries, fasterAttempt, 3, 'elapsedMs');
  assert.equal(fastRes.qualifies, true);
  assert.equal(fastRes.rank, 1);
  assert.equal(fastRes.updatedEntries.filter(e => e.playerId === 'hero_uid').length, 1);
  assert.equal(fastRes.updatedEntries[0].score, 10000);
});
