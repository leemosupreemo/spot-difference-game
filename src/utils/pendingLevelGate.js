/**
 * Pending Level Gate
 * ================================================================================
 * Machine-generated levels enter the manifest with `curationStatus: 'pending'`.
 * Pending means "eligible for a human to look at", never "ready to play".
 *
 * The curation store is opt-OUT: it only excludes levels explicitly marked
 * 'dismissed', so anything unrated is playable. That is the right default for
 * levels a human authored, and the wrong one for levels a script produced. This
 * gate inverts the default for pending entries only:
 *
 *   - non-debug (production): a pending entry is hidden until it is approved.
 *   - debug: a pending entry is shown so it can be reviewed and approved.
 *
 * Entries with no `curationStatus` are untouched -- every level that shipped
 * before this gate existed keeps its current behavior.
 *
 * Fail-closed by design: anything that is not a recognized approval keeps a
 * pending entry out of production, including a malformed status map, a thrown
 * lookup, or an unknown status string.
 * ================================================================================
 */

import { getLevelStatus } from './curationStore.js';

/** Statuses that promote a pending entry into production. */
const APPROVED_STATUSES = new Set(['approved', 'wrong_difficulty']);

/**
 * True when the manifest marks this entry as awaiting human review.
 * Absent status means a pre-gate level, which is not pending.
 */
export function isPendingEntry(entry) {
  const status = entry?.curationStatus;
  return typeof status === 'string' && status.toLowerCase() === 'pending';
}

/**
 * True when a human decision has promoted this entry out of pending.
 * 'wrong_difficulty' counts: the curator kept the level and only disagreed
 * about its difficulty, which is the same keep decision 'approved' makes.
 */
export function isApprovedForProduction(entry, statusMap) {
  try {
    const id = typeof entry === 'string' ? entry : entry?.id;
    if (!id || !statusMap) return false;
    const status = getLevelStatus(statusMap[id])?.status;
    return typeof status === 'string' && APPROVED_STATUSES.has(status.toLowerCase());
  } catch (_) {
    // A broken status map must never promote an unreviewed level.
    return false;
  }
}

/**
 * Should this entry be playable right now?
 *
 * @param entry     manifest entry
 * @param statusMap curation status map (level id -> status)
 * @param debugMode whether the reviewer is in debug mode
 */
export function isEntryPlayable(entry, statusMap, debugMode = false) {
  if (!isPendingEntry(entry)) return true;
  if (debugMode) return true;
  return isApprovedForProduction(entry, statusMap);
}

/**
 * Drop every pending entry that has not been approved, unless in debug mode.
 * Returns the array unchanged when nothing is filtered, so existing manifests
 * pay nothing for this.
 */
export function filterPendingEntries(entries, statusMap, debugMode = false) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(entry => isEntryPlayable(entry, statusMap, debugMode));
}

/** Counts for logging, so a hidden level is never silently hidden. */
export function describePendingFilter(entries, statusMap, debugMode = false) {
  const all = Array.isArray(entries) ? entries : [];
  const pending = all.filter(isPendingEntry);
  const approved = pending.filter(entry => isApprovedForProduction(entry, statusMap));
  return {
    total: all.length,
    pending: pending.length,
    pendingApproved: approved.length,
    pendingHidden: debugMode ? 0 : pending.length - approved.length,
    debugMode: Boolean(debugMode)
  };
}
