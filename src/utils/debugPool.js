/**
 * The order the debug curation screen offers levels in.
 *
 * This ordering has been the source of three separate faults in one session:
 * a resume that stranded unjudged levels behind the cursor, a pool built with
 * the wrong debug flag that hid every level awaiting review, and an empty
 * placeholder offered up for a curation decision that means nothing. Each was
 * a few lines living inline inside a component, where nothing could reach them
 * except by running the app.
 *
 * So the rule is a function. The caller still decides what the pool is drawn
 * from and how a level's status resolves; this owns only what gets a seat and
 * in what order.
 */

/** Statuses that mean the curator kept the level. */
export function isKeptStatus(statusVal) {
  return statusVal === 'approved' || statusVal === 'wrong_difficulty';
}

/** Any recorded judgement or metadata counts as having been looked at. */
export function isCategorized(statusObj) {
  return Boolean(
    statusObj?.status || statusObj?.packId || statusObj?.category
    || statusObj?.difficulty || statusObj?.suggestedDifficulty
  );
}

/**
 * Order the candidates a curator should be shown.
 *
 * Levels never judged come strictly first, so a session always starts on real
 * work; everything already judged follows, so a decision can still be revisited
 * by walking on.
 *
 * `dismissedOnly` inverts the screen into reviewing rejections: only dismissed
 * levels appear, because a pool mixing them with live ones makes it impossible
 * to tell what is being reconsidered.
 */
export function buildDebugPool({
  entries = [],
  resolveStatus = () => null,
  skipKept = false,
  dismissedOnly = false,
  isPlaceholder = () => false
} = {}) {
  const unreviewed = [];
  const categorized = [];

  for (const entry of entries) {
    // A placeholder is an empty slot, not artwork. With no curation status it
    // reads as unreviewed and would be offered for a decision that means
    // nothing -- and dismissing one would shorten its set.
    if (isPlaceholder(entry)) continue;

    const statusObj = resolveStatus(entry);
    const statusVal = statusObj?.status;

    if (dismissedOnly) {
      if (statusVal === 'dismissed') categorized.push(entry);
      continue;
    }
    if (statusVal === 'dismissed') continue;
    if (skipKept && isKeptStatus(statusVal)) continue;

    (isCategorized(statusObj) ? categorized : unreviewed).push(entry);
  }

  return [...unreviewed, ...categorized];
}
