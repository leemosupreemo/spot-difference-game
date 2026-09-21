/**
 * Which photograph a level was built from, independent of how it is shown.
 *
 * Set composition must never put two shots of the same photograph in one set,
 * and both `group_remote_sets.mjs` and the `repeated-photo` audit check used to
 * answer "which photograph is this?" by looking at the base image's filename.
 * That works only while the base slot always holds the shared, content
 * addressed photograph.
 *
 * It stops working the moment a pair is flipped. Flipping swaps the two images
 * so an `add` reads as a `remove` (see scripts/flip_pair_orientation.mjs), which
 * moves a unique variant file into the base slot. The level would then group
 * with nothing, and a later batch generating more variants of that same photo
 * could land one beside it in a set with no check noticing -- an invariant that
 * held at write time and quietly stopped holding afterwards.
 *
 * So identity is recorded, not inferred: `photoKey` travels with the entry and
 * survives any number of flips, and new variants of a photo inherit the same
 * key at generation time.
 */

const EXTENSION = /\.(jpe?g|png|webp)$/i;
// Two naming schemes for the same idea. Modern pairs suffix a shared stem
// ("<digest>_base.webp"); legacy pairs put the role in its own filename inside
// a per-scene folder ("<scene>/base.jpg"). Both must reduce to the scene.
const ROLE_SUFFIX = /_(base|variant)$/i;
const ROLE_SEGMENT = /\/(base|variant)$/i;

/**
 * A stable key for an image path, keeping its directory.
 *
 * The directory matters: legacy pairs live in per-scene folders and are all
 * named base.jpg / variant.jpg, so a filename-only key collapses every one of
 * them onto "base" and makes unrelated photographs look identical.
 */
export function imagePathKey(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  let clean = pathOrUrl.split('?')[0].split('#')[0];
  const protocol = clean.indexOf('://');
  if (protocol !== -1) {
    const afterHost = clean.indexOf('/', protocol + 3);
    clean = afterHost === -1 ? '' : clean.slice(afterHost);
  }
  return clean
    .replace(/^\/+/, '')
    .replace(/^\.\//, '')
    .toLowerCase()
    .replace(EXTENSION, '')
    .replace(ROLE_SUFFIX, '')
    .replace(ROLE_SEGMENT, '');
}

/** True when this level's two images have been swapped for presentation. */
export function isFlipped(entry) {
  return entry?.flipped === true;
}

/**
 * The photograph this level is built from.
 *
 * A stamped `photoKey` wins. Without one the entry predates the field, and an
 * unstamped entry has never been flipped, so its base image still holds the
 * photograph -- except that a flipped entry without a key would answer wrongly,
 * so that case reads the variant slot instead.
 */
export function photoKeyOf(entry) {
  if (!entry) return '';
  if (typeof entry.photoKey === 'string' && entry.photoKey) return entry.photoKey;
  return imagePathKey(isFlipped(entry) ? entry.variantImage : entry.baseImage);
}

/** The key to stamp on an entry that has not been flipped. */
export function derivePhotoKey(entry) {
  return imagePathKey(isFlipped(entry) ? entry?.variantImage : entry?.baseImage);
}

/** Group levels by the photograph behind them. */
export function groupByPhoto(entries = []) {
  const groups = new Map();
  for (const entry of entries) {
    const key = photoKeyOf(entry);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return groups;
}
