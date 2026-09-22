import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const LEADERBOARD_LIMITS = {
  daily: 5,
  category: 25,
  photoSet: 3
};

const VALID_BOARD_TYPES = ['daily', 'category', 'photoSet'];
const VALID_METRICS = ['elapsedMs', 'points'];
const MINIMUM_TIME_MS = 1000; // Anti-cheat baseline: impossible to spot 5 diffs in under 1s

// Server-side mirror of src/utils/profanityFilter.js — the client-side check is a UX nicety,
// this is the actual enforcement boundary since a modified client could skip it entirely.
const WHOLE_WORD_BLOCKED = ['ass', 'sex', 'tit', 'fag', 'cum', 'hoe', 'coon'];
const SUBSTRING_BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'whore', 'pussy', 'dick',
  'asshole', 'bastard', 'slut', 'twat', 'wank', 'dildo', 'rape', 'faggot',
  'retard', 'kike', 'spic', 'chink', 'tranny', 'motherfucker', 'jizz'
];
const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function deleetify(text) {
  return text.split('').map(ch => LEET_MAP[ch] || ch).join('');
}

export function containsProfanity(name) {
  const lower = deleetify(String(name || '').toLowerCase());

  const words = lower.split(/[^a-z]+/).filter(Boolean);
  if (words.some(word => WHOLE_WORD_BLOCKED.includes(word))) return true;

  const collapsed = lower.replace(/[^a-z]/g, '');
  return SUBSTRING_BLOCKED.some(term => collapsed.includes(term));
}

/**
 * Pure evaluation logic for leaderboard qualification and re-ranking.
 * 
 * Rules:
 * - Photo Set: Top 3
 * - Daily: Top 5
 * - Category: Top 25
 * - Single-player deduplication: keep only best score per board
 * - Lower elapsedMs is better; higher points is better
 */
export function evaluateQualification(currentEntries = [], candidate, limit = 10, metric = 'elapsedMs') {
  const isLowerBetter = metric === 'elapsedMs';
  const isBetter = (a, b) => isLowerBetter ? a < b : a > b;

  const entries = currentEntries.map(e => ({ ...e }));

  // Deduplicate existing player entry
  const existingPlayerIdx = entries.findIndex(e => e.playerId === candidate.playerId);
  if (existingPlayerIdx >= 0) {
    const existingScore = entries[existingPlayerIdx].score;
    if (!isBetter(candidate.score, existingScore)) {
      return {
        qualifies: false,
        updatedEntries: entries,
        rank: entries[existingPlayerIdx].rank || (existingPlayerIdx + 1),
        replacedEntry: null
      };
    }
    entries.splice(existingPlayerIdx, 1);
  }

  // Check if candidate qualifies
  const hasSpace = entries.length < limit;
  const worstEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const beatsWorst = worstEntry ? isBetter(candidate.score, worstEntry.score) : true;

  if (!hasSpace && !beatsWorst) {
    return { qualifies: false, updatedEntries: entries, rank: null, replacedEntry: null };
  }

  // Insert candidate
  entries.push({ ...candidate });

  // Sort entries
  entries.sort((a, b) => isLowerBetter ? a.score - b.score : b.score - a.score);

  // Slice to limit
  const trimmed = entries.slice(0, limit);

  // Recalculate ranks (1..N)
  const ranked = trimmed.map((entry, idx) => ({
    ...entry,
    rank: idx + 1
  }));

  const playerRankIdx = ranked.findIndex(e => e.playerId === candidate.playerId);
  const rank = playerRankIdx >= 0 ? playerRankIdx + 1 : null;

  return {
    qualifies: rank !== null,
    updatedEntries: ranked,
    rank,
    replacedEntry: worstEntry && !hasSpace ? worstEntry : null
  };
}

/**
 * Trusted HTTPS Callable Cloud Function for score submission.
 * Clients cannot directly mutate leaderboard documents.
 * 
 * Flow:
 * 1. Validate caller authentication (anonymous or permanent UID).
 * 2. Validate parameters and anti-cheat constraints.
 * 3. Run transactional read -> qualification check -> atomic write.
 * 4. Return result with rank and updated entries.
 */
/**
 * Validates caller credentials, input parameters, and anti-cheat constraints.
 */
export function validateSubmissionInput(auth, data = {}) {
  if (!auth || !auth.uid) {
    throw new HttpsError(
      'unauthenticated',
      'Authentication required. Silent anonymous authentication is supported.'
    );
  }

  const {
    boardType,
    boardId,
    score,
    metric = 'elapsedMs',
    displayName,
    platform = 'web',
    appVersion = '1.4.0'
  } = data;

  if (!VALID_BOARD_TYPES.includes(boardType)) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid boardType. Must be one of: ${VALID_BOARD_TYPES.join(', ')}`
    );
  }

  if (!boardId || typeof boardId !== 'string' || boardId.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid boardId.');
  }

  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
    throw new HttpsError('invalid-argument', 'Score must be a positive finite number.');
  }

  if (!VALID_METRICS.includes(metric)) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid metric. Must be one of: ${VALID_METRICS.join(', ')}`
    );
  }

  if (metric === 'elapsedMs' && score < MINIMUM_TIME_MS) {
    throw new HttpsError(
      'invalid-argument',
      `Score rejected: completion time of ${score}ms is below physical threshold.`
    );
  }

  const trimmedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';

  if (trimmedDisplayName && containsProfanity(trimmedDisplayName)) {
    throw new HttpsError('invalid-argument', "That name isn't allowed. Please choose another name.");
  }

  const cleanName = trimmedDisplayName
    ? trimmedDisplayName.slice(0, 24)
    : `Player ${auth.uid.slice(-4).toUpperCase()}`;

  return {
    playerId: auth.uid,
    displayName: cleanName,
    boardType,
    boardId: boardId.trim(),
    score,
    metric,
    submittedAt: new Date().toISOString(),
    platform: String(platform).slice(0, 16),
    appVersion: String(appVersion).slice(0, 16)
  };
}

/**
 * Trusted HTTPS Callable Cloud Function for score submission.
 * Clients cannot directly mutate leaderboard documents.
 * 
 * Flow:
 * 1. Validate caller authentication (anonymous or permanent UID).
 * 2. Validate parameters and anti-cheat constraints.
 * 3. Run transactional read -> qualification check -> atomic write.
 * 4. Return result with rank and updated entries.
 */
export const submitLeaderboardScore = onCall(
  { cors: true },
  async (request) => {
    const candidate = validateSubmissionInput(request.auth, request.data);

    const limit = LEADERBOARD_LIMITS[candidate.boardType] || 10;
    const docKey = `${candidate.boardType}_${candidate.boardId}`;
    const docRef = db.collection('leaderboards').doc(docKey);

    // Transactional update
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      const currentEntries = (snap.exists && Array.isArray(snap.data()?.entries))
        ? snap.data().entries
        : [];

      const evalResult = evaluateQualification(currentEntries, candidate, limit, candidate.metric);

      if (!evalResult.qualifies) {
        return {
          qualified: false,
          rank: evalResult.rank,
          entries: evalResult.updatedEntries
        };
      }

      transaction.set(docRef, {
        boardType: candidate.boardType,
        boardId: candidate.boardId,
        metric: candidate.metric,
        entries: evalResult.updatedEntries,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        qualified: true,
        rank: evalResult.rank,
        entries: evalResult.updatedEntries
      };
    });
  }
);

/**
 * Trusted HTTPS Callable Cloud Function for player feedback submission.
 * Saves to Firestore collection 'feedback' and dispatches email via Resend.
 */
/*
 * Shared shape for a feedback document, whatever route it arrived by. The
 * sendFeedbackEmail trigger reads these fields, so they have to match.
 */
export function buildFeedbackDoc({ playerId, playerName, feedbackText, platform, attemptNumber, appVersion }) {
  const cleanText = String(feedbackText || '').trim();
  if (!cleanText) return null;

  return {
    playerId: playerId || 'anonymous',
    playerName: String(playerName || 'Hunter').slice(0, 32),
    feedbackText: cleanText.slice(0, 3000),
    platform: String(platform || 'unknown').slice(0, 32),
    appVersion: String(appVersion || 'unknown').slice(0, 16),
    attemptNumber: Number(attemptNumber) || 1,
    targetEmail: FEEDBACK_PRIMARY_TARGET,
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
    status: 'new'
  };
}

/*
 * A form-encoded sibling of the callable below, and the route the app actually
 * uses. In Capacitor the WebView's origin is capacitor://localhost, so a JSON
 * POST needs a CORS preflight -- and on iOS that preflight does not complete, so
 * the browser never sends the request and the server sees nothing at all. A
 * form-encoded body is a "simple request" under CORS: no preflight, so it goes
 * straight out. The callable is kept because builds already in testers' hands
 * still call it.
 */
export const submitFeedbackForm = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'POST required' });
    return;
  }

  // firebase-functions body-parses form encoding for us; guard anyway so a JSON
  // caller is not silently dropped.
  const body = (typeof req.body === 'object' && req.body) || {};
  const doc = buildFeedbackDoc({
    playerId: body.playerId,
    playerName: body.playerName,
    feedbackText: body.feedbackText,
    platform: body.platform,
    attemptNumber: body.attemptNumber,
    appVersion: body.appVersion
  });

  if (!doc) {
    res.status(400).json({ success: false, error: 'Feedback text is required' });
    return;
  }

  try {
    const ref = await db.collection('feedback').add(doc);
    console.log('[submitFeedbackForm] stored', ref.id, 'platform', doc.platform);
    // sendFeedbackEmail fires on the document and does the mailing.
    res.status(200).json({ success: true, id: ref.id, emailDeferred: true });
  } catch (err) {
    console.error('[submitFeedbackForm] write failed:', err?.message || err);
    res.status(500).json({ success: false, error: 'Could not store feedback' });
  }
});

export const submitFeedback = onCall(
  { cors: true },
  async (request) => {
    const auth = request.auth;
    const { playerName, feedbackText, platform, attemptNumber } = request.data || {};

    const cleanText = String(feedbackText || '').trim();
    if (!cleanText) {
      throw new HttpsError('invalid-argument', 'Feedback text is required');
    }

    const cleanName = String(playerName || 'Hunter').slice(0, 32);
    const cleanPlatform = String(platform || 'unknown').slice(0, 32);
    const dateStr = new Date().toISOString();

    // 1. Record in Firestore 'feedback' collection
    const docRef = await db.collection('feedback').add({
      playerId: auth?.uid || 'anonymous',
      playerName: cleanName,
      feedbackText: cleanText.slice(0, 3000),
      platform: cleanPlatform,
      attemptNumber: Number(attemptNumber) || 1,
      targetEmail: 'support@thejauntcompany.com',
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: dateStr,
      status: 'new'
    });

    // The email is not sent from here. sendFeedbackEmail below fires on the
    // document itself, so feedback that reaches Firestore by any route gets
    // mailed -- including the client's direct-write fallback, which used to
    // store feedback and silently never email it.
    return {
      success: true,
      id: docRef.id,
      emailDeferred: true
    };
  }
);

export const FEEDBACK_PRIMARY_TARGET = 'support@thejauntcompany.com';
/* Resend refuses arbitrary recipients until the sending domain is verified, so
   until thejauntcompany.com is set up the mail is redirected to the account
   owner rather than dropped. */
export const FEEDBACK_FALLBACK_TARGET = 'enmeskin@gmail.com';

async function postToResend(apiKey, payload) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export async function dispatchFeedbackEmail(feedback) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { emailSent: false, emailError: 'RESEND_API_KEY is not configured', target: null };
  }

  const name = String(feedback.playerName || 'Hunter');
  const payload = {
    from: 'Diff Hunter <onboarding@resend.dev>',
    to: [FEEDBACK_PRIMARY_TARGET],
    subject: `[Diff Hunter Feedback] Player Feedback - ${name}`,
    text: [
      `Player: ${name}`,
      `Platform: ${feedback.platform || 'unknown'}`,
      `App version: ${feedback.appVersion || 'unknown'}`,
      `Attempt: ${feedback.attemptNumber || 1}`,
      `Date: ${feedback.createdAtIso || new Date().toISOString()}`,
      '',
      'Feedback:',
      String(feedback.feedbackText || '')
    ].join('\n')
  };

  try {
    let res = await postToResend(apiKey, payload);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 403 && errData.message && errData.message.includes('own email address')) {
        console.log('[feedbackEmail] Domain unverified on Resend, falling back to account owner email:', FEEDBACK_FALLBACK_TARGET);
        payload.to = [FEEDBACK_FALLBACK_TARGET];
        payload.subject = `[Diff Hunter Feedback] (Forward to Support) - ${name}`;
        res = await postToResend(apiKey, payload);
      }
    }

    if (res.ok) {
      return { emailSent: true, emailError: null, target: payload.to[0] };
    }

    const emailError = await res.text();
    console.warn('[feedbackEmail] Resend API error:', emailError);
    return { emailSent: false, emailError, target: payload.to[0] };
  } catch (err) {
    const emailError = err?.message || String(err);
    console.warn('[feedbackEmail] Resend fetch error:', emailError);
    return { emailSent: false, emailError, target: payload.to[0] };
  }
}

/* Triggering on the document rather than on the request is the point: the client
   falls back to writing `feedback` directly whenever the callable cannot be
   reached, and a queued offline write can land long after the app has closed.
   Both now get mailed. */
export const sendFeedbackEmail = onDocumentCreated('feedback/{feedbackId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const feedback = snapshot.data() || {};
  // Trigger delivery is at-least-once, so a retry must not send twice.
  if (feedback.emailStatus) {
    console.log('[feedbackEmail] Already handled, skipping:', snapshot.id);
    return;
  }

  const result = await dispatchFeedbackEmail(feedback);

  await snapshot.ref.update({
    emailStatus: result.emailSent ? 'sent' : 'failed',
    emailTarget: result.target,
    emailError: result.emailError,
    emailProcessedAt: FieldValue.serverTimestamp()
  });
});
