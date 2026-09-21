// App Rating Modal state & eligibility, per the product cheatsheet:
//
//   IF successfulRounds >= 5 AND ratingPromptAttempts == 0
//     -> show modal after the next successful result screen settles
//   IF user chooses "Maybe Later"
//     -> wait until 10-20 more successful rounds AND a new session
//   After the second attempt -> stop proactively prompting for a long time
//
// "Successful round" here means a full stage/set clear (the moment a results
// screen — VictoryModal or DailyVictoryModal on a win — is actually shown),
// not each individual image pair within a stage.

import { Capacitor } from '@capacitor/core';

const KEY_SUCCESSFUL_ROUNDS = 'diff_hunter_successful_rounds';
const KEY_SESSIONS_PLAYED = 'diff_hunter_launch_count';
const KEY_ATTEMPTS = 'diff_hunter_rating_prompt_attempts';
const KEY_HANDLED_TYPE = 'diff_hunter_rating_handled'; // 'rated' | 'dismissed'
const KEY_RETRY_AFTER_ROUNDS = 'diff_hunter_rating_prompt_retry_after_rounds';
const KEY_LAST_PROMPT_SESSION = 'diff_hunter_rating_prompt_last_session';
const KEY_LAST_PROMPT_DATE = 'diff_hunter_rating_prompt_last_date';

const MAX_ATTEMPTS = 2;
const FIRST_ATTEMPT_ROUND_THRESHOLD = 5;
const RETRY_BONUS_ROUNDS_MIN = 10;
const RETRY_BONUS_ROUNDS_MAX = 20;

function readInt(key, fallback = 0) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeValue(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(value));
    }
  } catch (_) {}
}

export function getSuccessfulRounds() {
  return readInt(KEY_SUCCESSFUL_ROUNDS, 0);
}

/** Called once per full stage/set clear (a "successful round"). */
export function incrementSuccessfulRounds() {
  const next = getSuccessfulRounds() + 1;
  writeValue(KEY_SUCCESSFUL_ROUNDS, next);
  return next;
}

export function getSessionsPlayed() {
  return readInt(KEY_SESSIONS_PLAYED, 0);
}

export function getRatingPromptAttempts() {
  return readInt(KEY_ATTEMPTS, 0);
}

function getHandledType() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_HANDLED_TYPE) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Returns true if the current environment is native iOS / iPadOS where App Store ratings apply.
 * Returns false on Web (desktop browsers, mobile Safari on web, etc.).
 */
export function isRatingPromptPlatformSupported() {
  try {
    if (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function') {
      return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
    }
  } catch (_) {}
  return false;
}

/**
 * Pure eligibility check against currently persisted rating-prompt state.
 * @param {{ successfulRounds?: number, sessionsPlayed?: number, isNative?: boolean, enforcePlatform?: boolean }} [overrides]
 */
export function shouldShowRatingPrompt(overrides = {}) {
  // If explicitly specified in overrides, respect native platform requirements
  if (overrides.isNative !== undefined && !overrides.isNative) return false;
  if (overrides.enforcePlatform && !isRatingPromptPlatformSupported()) return false;

  const rounds = overrides.successfulRounds ?? getSuccessfulRounds();
  const sessions = overrides.sessionsPlayed ?? getSessionsPlayed();
  const attempts = getRatingPromptAttempts();
  const handledType = getHandledType();

  // Already rated or submitted feedback: never proactively prompt again.
  if (handledType === 'rated' || handledType === 'feedback') return false;
  if (attempts >= MAX_ATTEMPTS) return false;

  if (attempts === 0) {
    return rounds >= FIRST_ATTEMPT_ROUND_THRESHOLD;
  }

  // Second (final) attempt: only follows a "Maybe Later" dismissal, needs
  // both the round bonus AND a new session since the first prompt.
  if (handledType !== 'dismissed') return false;
  const retryAfterRounds = readInt(KEY_RETRY_AFTER_ROUNDS, NaN);
  const lastPromptSession = readInt(KEY_LAST_PROMPT_SESSION, NaN);
  if (!Number.isFinite(retryAfterRounds) || !Number.isFinite(lastPromptSession)) return false;

  return rounds >= retryAfterRounds && sessions > lastPromptSession;
}

/** Call when the modal is actually displayed (marks an "attempt"). */
export function recordRatingPromptShown(overrides = {}) {
  const sessions = overrides.sessionsPlayed ?? getSessionsPlayed();
  const attempts = getRatingPromptAttempts() + 1;
  writeValue(KEY_ATTEMPTS, attempts);
  writeValue(KEY_LAST_PROMPT_SESSION, sessions);
  writeValue(KEY_LAST_PROMPT_DATE, new Date().toISOString());
  return attempts;
}

/** Call when the player picks "Maybe Later"; schedules the one retry window. */
export function recordRatingPromptDismissed(overrides = {}) {
  const rounds = overrides.successfulRounds ?? getSuccessfulRounds();
  const bonus = RETRY_BONUS_ROUNDS_MIN + Math.floor(Math.random() * (RETRY_BONUS_ROUNDS_MAX - RETRY_BONUS_ROUNDS_MIN + 1));
  writeValue(KEY_RETRY_AFTER_ROUNDS, rounds + bonus);
}

export function getLastRatingPromptDate() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_LAST_PROMPT_DATE) : null;
  } catch (_) {
    return null;
  }
}

/** Resets all rating prompt state (useful for debug/testing or account reset). */
export function resetRatingPromptState() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEY_SUCCESSFUL_ROUNDS);
      localStorage.removeItem(KEY_ATTEMPTS);
      localStorage.removeItem(KEY_HANDLED_TYPE);
      localStorage.removeItem(KEY_RETRY_AFTER_ROUNDS);
      localStorage.removeItem(KEY_LAST_PROMPT_SESSION);
      localStorage.removeItem(KEY_LAST_PROMPT_DATE);
    }
  } catch (_) {}
}

