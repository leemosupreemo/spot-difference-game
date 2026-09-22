/**
 * Keep near-identical levels apart within a stage.
 *
 * Two levels built from the same base image are the same photograph with a
 * different difference in it. Played back to back they read as a repeat, and
 * the player suspects a bug rather than enjoying the round. This spaces them so
 * at least one other level always sits between them.
 *
 * Remote sets are now composed so a set never holds the same photo twice, which
 * makes this a safety net rather than the primary fix: it covers the non-set
 * selection path, packs published in future, and any pool this code does not
 * control. A pool that cannot satisfy the rule -- more than ceil(n/2) levels
 * from one photo -- is placed as well as it can be rather than rejected.
 */

import { photoKeyOf, imagePathKey } from './photoIdentity.js';

/** The base image behind a level; two levels sharing one are near-twins. */
export function baseImageKey(level) {
  if (!level) return '';
  const photoKey = photoKeyOf(level);
  if (photoKey) return photoKey;
  const source = level?.baseImage || level?.id || '';
  return imagePathKey(source) || String(source).split('?')[0].split('/').pop() || '';
}

/** Is any pair of neighbours built on the same base image? */
export function hasAdjacentRepeat(levels) {
  if (!Array.isArray(levels)) return false;
  for (let i = 1; i < levels.length; i++) {
    if (baseImageKey(levels[i]) === baseImageKey(levels[i - 1])) return true;
  }
  return false;
}

/**
 * Can this pool be arranged with no two same-base levels adjacent?
 * In n slots the most one photo can occupy with a gap between each is
 * ceil(n/2) -- positions 1, 3, 5 in a five-level stage.
 */
export function canSeparate(levels) {
  if (!Array.isArray(levels) || levels.length === 0) return true;
  const counts = new Map();
  for (const level of levels) {
    const key = baseImageKey(level);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Math.max(...counts.values()) <= Math.ceil(levels.length / 2);
}

/**
 * Reorder so no two neighbours share a base image, preserving the original
 * order wherever the rule does not force a change.
 *
 * Greedy: at each slot take the earliest level whose photo differs from the one
 * just placed, preferring photos with the most copies still waiting so a large
 * group cannot be left stranded at the end.
 */
export function separateAdjacentDuplicates(levels) {
  if (!Array.isArray(levels) || levels.length < 3) return Array.isArray(levels) ? [...levels] : [];

  const remaining = [...levels];
  const remainingCount = new Map();
  for (const level of remaining) {
    const key = baseImageKey(level);
    remainingCount.set(key, (remainingCount.get(key) || 0) + 1);
  }

  const ordered = [];
  let previousKey = null;
  while (remaining.length > 0) {
    let chosen = -1;
    let bestCount = -1;
    for (let i = 0; i < remaining.length; i++) {
      const key = baseImageKey(remaining[i]);
      if (key === previousKey) continue;
      const count = remainingCount.get(key) || 0;
      if (count > bestCount) { bestCount = count; chosen = i; }
    }
    // Every level left repeats the previous one: the pool cannot be separated,
    // so place in order rather than dropping anything.
    if (chosen === -1) chosen = 0;

    const [level] = remaining.splice(chosen, 1);
    const key = baseImageKey(level);
    remainingCount.set(key, (remainingCount.get(key) || 0) - 1);
    ordered.push(level);
    previousKey = key;
  }
  return ordered;
}
