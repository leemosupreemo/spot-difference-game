import { onCall, HttpsError } from 'firebase-functions/v2/https';
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

    // 2. Dispatch email via Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    let emailSent = false;
    let emailError = null;

    if (resendApiKey) {
      const primaryTarget = 'support@thejauntcompany.com';
      const fallbackTarget = 'enmeskin@gmail.com';

      const emailPayload = {
        from: 'Diff Hunter <onboarding@resend.dev>',
        to: [primaryTarget],
        subject: `[Diff Hunter Feedback] Player Feedback - ${cleanName}`,
        text: `Player: ${cleanName}\nPlatform: ${cleanPlatform}\nAttempt: ${attemptNumber || 1}\nDate: ${dateStr}\n\nFeedback:\n${cleanText}`
      };

      try {
        let res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          // If Resend trial only permits sending to account owner email, fallback
          if (res.status === 403 && errData.message && errData.message.includes('own email address')) {
            console.log('[submitFeedback] Domain unverified on Resend, falling back to account owner email:', fallbackTarget);
            emailPayload.to = [fallbackTarget];
            emailPayload.subject = `[Diff Hunter Feedback] (Forward to Support) - ${cleanName}`;
            res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(emailPayload)
            });
          }
        }

        if (res.ok) {
          emailSent = true;
        } else {
          emailError = await res.text();
          console.warn('[submitFeedback] Resend API error:', emailError);
        }
      } catch (err) {
        emailError = err?.message || String(err);
        console.warn('[submitFeedback] Resend fetch error:', emailError);
      }
    }

    return {
      success: true,
      id: docRef.id,
      emailSent,
      emailError
    };
  }
);
