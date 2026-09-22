import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateQualification,
  validateSubmissionInput,
  containsProfanity,
  buildFeedbackDoc,
  dispatchFeedbackEmail,
  FEEDBACK_PRIMARY_TARGET,
  FEEDBACK_FALLBACK_TARGET,
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

test('containsProfanity mirrors the client-side filter behavior', () => {
  assert.equal(containsProfanity('SpeedHunter'), false);
  assert.equal(containsProfanity('Classic'), false);
  assert.equal(containsProfanity('fuckboy'), true);
  assert.equal(containsProfanity('sh1t'), true);
});

test('validateSubmissionInput rejects profane display names server-side, even if the client bypassed its own check', () => {
  const auth = { uid: 'anon_1234' };

  assert.throws(() => {
    validateSubmissionInput(auth, {
      boardType: 'photoSet',
      boardId: 'set_1',
      score: 5000,
      displayName: 'fuckboy'
    });
  }, /isn't allowed/i);

  assert.throws(() => {
    validateSubmissionInput(auth, {
      boardType: 'photoSet',
      boardId: 'set_1',
      score: 5000,
      displayName: 'sh1thead'
    });
  }, /isn't allowed/i);

  // Clean names and the server-generated default still pass through untouched
  const res = validateSubmissionInput(auth, {
    boardType: 'photoSet',
    boardId: 'set_1',
    score: 5000,
    displayName: 'PixelSniper'
  });
  assert.equal(res.displayName, 'PixelSniper');
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

test('submitFeedback is exported as a Cloud Function', async () => {
  const { submitFeedback } = await import('./index.js');
  assert.equal(typeof submitFeedback, 'function');
});


/*
 * Email dispatch moved out of the submitFeedback callable and onto a Firestore
 * trigger. The callable was the only thing that sent mail, so whenever the client
 * could not reach it and fell back to writing the document directly, the feedback
 * was stored and silently never emailed.
 */
const FEEDBACK = {
  playerName: 'SpeedHunter',
  platform: 'iOS Native',
  appVersion: '1.1.0',
  attemptNumber: 2,
  feedbackText: 'the timer felt fast',
  createdAtIso: '2026-09-22T06:30:31.000Z'
};

function stubFetch(responses) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    const next = responses.shift();
    return {
      ok: next.ok,
      status: next.status ?? (next.ok ? 200 : 500),
      json: async () => next.json ?? {},
      text: async () => next.text ?? ''
    };
  };
  return { calls, restore: () => { globalThis.fetch = originalFetch; } };
}

test('dispatchFeedbackEmail sends to the support address and reports the target', async (t) => {
  process.env.RESEND_API_KEY = 'test-key';
  const { calls, restore } = stubFetch([{ ok: true }]);
  t.after(restore);

  const result = await dispatchFeedbackEmail(FEEDBACK);

  assert.equal(result.emailSent, true);
  assert.equal(result.emailError, null);
  assert.equal(result.target, FEEDBACK_PRIMARY_TARGET);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.to, [FEEDBACK_PRIMARY_TARGET]);
  // The body has to carry enough to triage without opening Firestore.
  assert.match(calls[0].body.text, /the timer felt fast/);
  assert.match(calls[0].body.text, /1\.1\.0/);
});

test('dispatchFeedbackEmail retries to the account owner when the domain is unverified', async (t) => {
  process.env.RESEND_API_KEY = 'test-key';
  const { calls, restore } = stubFetch([
    { ok: false, status: 403, json: { message: 'You can only send testing emails to your own email address' } },
    { ok: true }
  ]);
  t.after(restore);

  const result = await dispatchFeedbackEmail(FEEDBACK);

  assert.equal(result.emailSent, true);
  assert.equal(result.target, FEEDBACK_FALLBACK_TARGET);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].body.to, [FEEDBACK_FALLBACK_TARGET]);
});

test('dispatchFeedbackEmail reports a genuine failure rather than claiming success', async (t) => {
  process.env.RESEND_API_KEY = 'test-key';
  const { restore } = stubFetch([{ ok: false, status: 500, text: 'upstream exploded' }]);
  t.after(restore);

  const result = await dispatchFeedbackEmail(FEEDBACK);

  assert.equal(result.emailSent, false);
  assert.equal(result.emailError, 'upstream exploded');
});

test('dispatchFeedbackEmail reports a missing API key instead of throwing', async (t) => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  t.after(() => { if (previous !== undefined) process.env.RESEND_API_KEY = previous; });

  const result = await dispatchFeedbackEmail(FEEDBACK);

  assert.equal(result.emailSent, false);
  assert.match(result.emailError, /RESEND_API_KEY/);
});

/*
 * submitFeedbackForm takes a form-encoded body so the request needs no CORS
 * preflight; in Capacitor the preflight never completes and the request is never
 * sent at all. Both routes have to produce the same document, because
 * sendFeedbackEmail reads these fields to build the email.
 */
test('buildFeedbackDoc requires actual feedback text', () => {
  assert.equal(buildFeedbackDoc({ feedbackText: '' }), null);
  assert.equal(buildFeedbackDoc({ feedbackText: '   \n ' }), null);
  assert.equal(buildFeedbackDoc({}), null);
});

test('buildFeedbackDoc fills defaults and carries what the email needs', () => {
  const doc = buildFeedbackDoc({ feedbackText: '  the timer felt fast  ' });

  assert.equal(doc.feedbackText, 'the timer felt fast');
  assert.equal(doc.playerId, 'anonymous');
  assert.equal(doc.playerName, 'Hunter');
  assert.equal(doc.platform, 'unknown');
  assert.equal(doc.attemptNumber, 1);
  assert.equal(doc.status, 'new');
  assert.equal(doc.targetEmail, FEEDBACK_PRIMARY_TARGET);
});

test('buildFeedbackDoc coerces form-encoded strings and caps runaway input', () => {
  // A form body arrives as strings, so attemptNumber must not stay "3".
  const doc = buildFeedbackDoc({
    feedbackText: 'x'.repeat(5000),
    playerName: 'y'.repeat(100),
    attemptNumber: '3'
  });

  assert.equal(doc.attemptNumber, 3);
  assert.equal(doc.feedbackText.length, 3000);
  assert.equal(doc.playerName.length, 32);
});
