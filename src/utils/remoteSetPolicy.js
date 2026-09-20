/**
 * Online-only level sets, and the placeholder that stands in for a level whose
 * artwork cannot be shown.
 * ================================================================================
 * Levels delivered by a Firestore remote pack keep their artwork on Hosting
 * rather than in the app bundle, so they need a network connection the first
 * time they are played. They are grouped into their own sets under the
 * `remote_set_` namespace, which makes "is this set online-only?" a property of
 * the data rather than a lookup against the current pack list.
 *
 * Offline, those sets are withheld entirely -- a player never starts a set that
 * cannot finish. A placeholder exists for the two cases that survive that rule:
 *
 *   1. A set that is not yet full. More artwork is coming, and the empty slots
 *      hold a placeholder so the set is still a well-formed five.
 *   2. Artwork that fails to load despite the player being online -- a 404, a
 *      dropped connection mid-stage, a corrupt asset.
 *
 * A placeholder says so plainly instead of rendering as two blank frames the
 * player would hunt through, and a run containing one is never recorded as a
 * real attempt at the set.
 * ================================================================================
 */

/** Sets whose artwork lives on Hosting rather than in the app bundle. */
export const REMOTE_SET_PREFIX = 'remote_set_';

export const PLACEHOLDER_MESSAGE = 'Sorry, this image could not be loaded.';
export const PLACEHOLDER_HINT = 'It needs an internet connection, or is still on its way.';

export function isRemoteSetId(setId) {
  return typeof setId === 'string' && setId.startsWith(REMOTE_SET_PREFIX);
}

/** True for an entry belonging to an online-only set. */
export function isRemoteEntry(entry) {
  return isRemoteSetId(entry?.setId);
}

/** True for a slot with no artwork behind it, whatever the reason. */
export function isPlaceholderEntry(entry) {
  return Boolean(entry?.isPlaceholder);
}

/**
 * Build the stand-in for one slot. It keeps the set metadata so the set is
 * still complete, and carries no image paths -- nothing should attempt a fetch.
 */
export function createPlaceholderEntry({ setId, sequence, packId = 'find_the_sniper', difficulty = 'Medium' }) {
  if (!setId || !Number.isInteger(sequence) || sequence < 1) {
    throw new Error('A placeholder needs a setId and a positive integer sequence');
  }
  return {
    id: `${setId}_placeholder_${String(sequence).padStart(2, '0')}`,
    title: 'Coming soon',
    category: 'Photography',
    pack: 'Find the Sniper',
    packId,
    difficulty,
    setId,
    sequence,
    isPlaceholder: true,
    placeholderMessage: PLACEHOLDER_MESSAGE,
    // No baseImage/variantImage: there is deliberately nothing to request.
    diffs: []
  };
}

/**
 * Turn a real entry into a placeholder after its artwork failed to load, so a
 * broken asset degrades into an explanation rather than two blank frames.
 */
export function toPlaceholder(entry, reason = 'unavailable') {
  return {
    ...entry,
    isPlaceholder: true,
    placeholderReason: reason,
    placeholderMessage: PLACEHOLDER_MESSAGE,
    baseImage: undefined,
    variantImage: undefined,
    diffs: []
  };
}

/**
 * Entries a player may be served right now.
 * Offline, everything from an online-only set is withheld; a placeholder from
 * such a set goes with it, since the set as a whole is unplayable.
 */
export function selectableEntries(entries, { online = true } = {}) {
  if (!Array.isArray(entries)) return [];
  if (online) return entries;
  return entries.filter(entry => !isRemoteEntry(entry));
}

/** Set ids a player may choose right now. */
export function selectableSetIds(setIds, { online = true } = {}) {
  if (!Array.isArray(setIds)) return [];
  return online ? setIds : setIds.filter(setId => !isRemoteSetId(setId));
}

/**
 * Whether this run should count as a real attempt at the set.
 * A stage carrying a placeholder is not a fair run at the set's content, so it
 * never consumes the player's first attempt.
 */
export function countsAsAttempt(stageLevels) {
  if (!Array.isArray(stageLevels) || stageLevels.length === 0) return false;
  return !stageLevels.some(isPlaceholderEntry);
}

/**
 * Human label for a set id.
 *
 * Derived from the id rather than a list position: offline filtering removes
 * online-only sets, so a positional label like `Set ${index + 1}` renames every
 * set after the gap and makes two different sets share a name. `remote_set_001`
 * and `photo_set_001` both contain "1", so the namespace has to appear too.
 */
export function formatSetLabel(setId) {
  if (typeof setId !== 'string' || !setId) return 'Photo Set';
  const digits = setId.match(/(\d+)/);
  const number = digits ? parseInt(digits[1], 10) : null;
  if (isRemoteSetId(setId)) {
    return number ? `Remote Set ${number}` : 'Remote Set';
  }
  if (setId.startsWith('photo_set_')) {
    return number ? `Photo Set ${number}` : 'Photo Set';
  }
  return number ? `Set ${number}` : setId;
}

/**
 * Daily-challenge-only levels.
 *
 * The daily challenge must never serve a level the player can also meet in
 * regular Photography, or "today's challenge" is something they may already
 * have solved. Reserving them by set id keeps the rule in the data, the same
 * way `remote_set_` marks online-only content.
 *
 * Both halves matter. Regular play must exclude these, AND the daily picker
 * must draw only from them -- its fallback otherwise chooses at random from the
 * whole manifest, which puts the overlap straight back.
 */
export const DAILY_SET_PREFIX = 'daily_set_';

export function isDailySetId(setId) {
  return typeof setId === 'string' && setId.startsWith(DAILY_SET_PREFIX);
}

/** A level reserved for the daily challenge, by set or by explicit flag. */
export function isDailyOnlyEntry(entry) {
  if (!entry) return false;
  if (entry.dailyOnly === true) return true;
  if (isDailySetId(entry.setId)) return true;
  // Levels named for the daily challenge but never given a set predate the
  // namespace; honour their intent rather than leaking them into regular play.
  return typeof entry.id === 'string' && entry.id.startsWith(DAILY_SET_PREFIX) && !entry.setId;
}

/** Levels regular Photography may serve. */
export function regularPlayEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(entry => !isDailyOnlyEntry(entry));
}

/** Levels the daily challenge may serve. */
export function dailyPoolEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(isDailyOnlyEntry);
}
