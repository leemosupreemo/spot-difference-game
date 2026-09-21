/**
 * Where the debug curation flow should resume.
 *
 * The pool is ordered uncategorized-first, then everything already judged
 * (`getDebugCandidateEntries` returns `[...unreviewed, ...categorized]`). With
 * "skip kept levels" off, approved levels stay in the pool, so the categorized
 * tail is by far the larger part of it -- 159 of 213 entries when this was
 * found.
 *
 * Entering debug mode used to resume on whatever level was last open, as long
 * as it was still somewhere in the pool, and "next pair" walks forward from
 * there by index. Resume on a level in the categorized tail and the remaining
 * uncategorized entries sit *behind* the cursor, so walking forward never
 * reaches them: a curator works through already-judged levels instead and
 * concludes there is nothing new left. That is exactly how 12 freshly published
 * candidates went unreviewed while sitting at the front of the queue.
 *
 * So resume only onto a level still worth judging. Anything else starts at the
 * front, which is where the unjudged levels are.
 */
export function chooseDebugStartId(pool, currentLevelId, isCategorized) {
  if (!Array.isArray(pool) || pool.length === 0) return null;

  const current = currentLevelId
    ? pool.find(entry => entry?.id === currentLevelId)
    : null;
  // Staying put is only right while the current level still needs a decision.
  if (current && !isCategorized(current)) return current.id;

  const firstUnjudged = pool.find(entry => !isCategorized(entry));
  if (firstUnjudged) return firstUnjudged.id;

  // Everything is judged: resuming in place beats jumping to the front, so a
  // curator reviewing past decisions does not lose their position.
  return current ? current.id : pool[0].id;
}
