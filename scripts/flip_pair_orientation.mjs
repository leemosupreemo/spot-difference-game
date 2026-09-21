#!/usr/bin/env node
/**
 * Flip a pair's orientation so an `add` reads to the player as a `remove`.
 * ================================================================================
 * GameCanvas always draws `baseImage` in the left panel and `variantImage` in
 * the right (GameCanvas.jsx:156/166). An `add` therefore shows an object that
 * is absent on the left and present on the right, which reads as "something was
 * added". Swapping the two references puts the object on the left and takes it
 * away on the right -- the same puzzle in the same place, now reading as a
 * removal. No pixels are touched and no new artwork is generated.
 *
 * How a photograph stays identifiable
 * -----------------------------------
 * Base images are content-addressed and shared by every variant of one
 * photograph, and set composition must never seat two shots of one photograph
 * together. Identifying a photograph by its base FILENAME cannot survive a
 * flip, because the flip moves a unique variant file into that slot -- so the
 * level would stop grouping with its own siblings, and a later batch adding
 * variants of that photo could land one beside it with nothing noticing.
 *
 * Identity therefore lives in the recorded `photoKey` (src/utils/photoIdentity.js),
 * which travels with the entry and survives any number of flips. Run
 * `backfill_photo_keys.mjs` before flipping anything.
 *
 * The one remaining limit is that a photograph may be flipped ONCE: two flipped
 * siblings would both serve the shared base as their variant, repeating the
 * right-hand panel. That is enforced here and re-checked by the audit.
 *
 * Usage:
 *   node scripts/flip_pair_orientation.mjs            # report what it would do
 *   node scripts/flip_pair_orientation.mjs --apply    # write manifest + packs
 *   node scripts/flip_pair_orientation.mjs --limit 12 --apply
 * ================================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { isPlaceholderEntry } from '../src/utils/remoteSetPolicy.js';
import { photoKeyOf, isFlipped } from '../src/utils/photoIdentity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

/** Only these two operations are each other's mirror image. */
const MIRROR = { add: 'remove', remove: 'add' };

export const fileName = (ref) => String(ref || '').split('?')[0].split('/').pop() || '';

export function operationOf(entry) {
  return entry?.operation || entry?.diffs?.[0]?.operation || null;
}

/** How many levels are ALREADY flipped, per photograph. */
export function flipsPerPhoto(entries) {
  const counts = new Map();
  for (const entry of entries) {
    if (isPlaceholderEntry(entry) || !isFlipped(entry)) continue;
    const key = photoKeyOf(entry);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/** Why this level may or may not be flipped. */
export function flipEligibility(entry, alreadyFlipped = new Map()) {
  if (!entry || isPlaceholderEntry(entry)) return { ok: false, reason: 'placeholder' };
  if (!entry.baseImage || !entry.variantImage) return { ok: false, reason: 'missing an image' };
  const op = operationOf(entry);
  if (!MIRROR[op]) return { ok: false, reason: `operation "${op || 'none'}" has no mirror` };
  const key = photoKeyOf(entry);
  if (!key) return { ok: false, reason: 'no photoKey -- run backfill_photo_keys.mjs first' };
  if (isFlipped(entry)) return { ok: false, reason: 'already flipped' };
  if ((alreadyFlipped.get(key) || 0) > 0) {
    return { ok: false, reason: 'another level of this photograph is already flipped' };
  }
  return { ok: true, reason: `${op} -> ${MIRROR[op]}` };
}

/** Swap the wording an operation name appears in, leaving other text alone. */
function retext(value, from, to) {
  if (typeof value !== 'string') return value;
  return value.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
}

/**
 * Return the entry with its two images swapped and every field that names the
 * operation brought with them. Flipping twice returns the original, which is
 * what makes this safe to re-run and easy to undo.
 */
export function flipEntry(entry) {
  const from = operationOf(entry);
  const to = MIRROR[from];
  if (!to) throw new Error(`Cannot flip operation "${from}" on ${entry?.id}`);

  const flipped = {
    ...entry,
    baseImage: entry.variantImage,
    variantImage: entry.baseImage,
    // photoKey is deliberately untouched: the photograph is the same one, which
    // is the entire reason it is recorded rather than read off the base slot.
    flipped: !isFlipped(entry)
  };
  if (!flipped.flipped) delete flipped.flipped;
  if (entry.operation) flipped.operation = to;
  if (Array.isArray(entry.diffs)) {
    flipped.diffs = entry.diffs.map(diff => {
      const next = { ...diff };
      if (diff.operation === from) next.operation = to;
      // Coordinates are the object's position and do not move; only wording
      // that names the operation changes.
      next.description = retext(diff.description, from, to);
      next.hint = retext(diff.hint, from, to);
      return next;
    });
  }
  // variantCode is derived from `operation` (see scripts/variant_code.py) and
  // must never contradict it.
  if (typeof entry.variantCode === 'string') {
    const code = { add: 'ADD', remove: 'REM' };
    flipped.variantCode = entry.variantCode.replace(code[from], code[to]);
  }
  return flipped;
}

/**
 * Choose which levels to flip, at most one per photograph.
 *
 * The running tally counts picks made in this pass as well as flips already
 * published, so a single run can never select two variants of one photograph.
 */
export function selectFlips(entries, { limit = Infinity, from = 'add' } = {}) {
  const tally = flipsPerPhoto(entries);
  const chosen = [];
  for (const entry of entries) {
    if (chosen.length >= limit) break;
    // Only flip the operation asked for. `flipEligibility` is deliberately
    // symmetric so a flip can be undone, but selecting symmetrically would turn
    // genuine removes into adds -- undoing the very thing being asked for.
    if (from && operationOf(entry) !== from) continue;
    if (!flipEligibility(entry, tally).ok) continue;
    chosen.push(entry.id);
    const key = photoKeyOf(entry);
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  return chosen;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity;
  const fromArg = process.argv.indexOf('--from');
  const from = fromArg !== -1 ? process.argv[fromArg + 1] : 'add';

  const manifestPath = path.join(ROOT, 'public/levels/photo_pair_manifest.json');
  const bundled = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const app = initializeApp(firebaseConfig);
  try { await signInAnonymously(getAuth(app)); } catch (err) {
    console.warn('Anonymous sign-in failed (write may be rejected):', err?.message || err);
  }
  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, 'remote_level_packs'));
  const packs = [];
  snapshot.forEach(d => packs.push({ id: d.id, data: d.data() }));
  const remote = packs.filter(p => p.data.active === true).flatMap(p => p.data.levels || []);

  // Eligibility is judged against EVERYTHING published, because a base photo
  // can be shared across the bundled/remote boundary.
  const all = [...bundled, ...remote];
  const ids = new Set(selectFlips(all, { limit, from }));

  console.log(`published levels : ${all.length}`);
  console.log(`flipping         : ${ids.size}  (${from} -> ${MIRROR[from]})`);

  let bundledFlips = 0;
  const nextBundled = bundled.map(entry => {
    if (!ids.has(entry.id)) return entry;
    bundledFlips++;
    return flipEntry(entry);
  });

  let remoteFlips = 0;
  const touchedPacks = [];
  for (const pack of packs) {
    if (pack.data.active !== true) continue;
    let changed = false;
    const levels = (pack.data.levels || []).map(level => {
      if (!ids.has(level.id)) return level;
      changed = true; remoteFlips++;
      return flipEntry(level);
    });
    if (changed) touchedPacks.push({ id: pack.id, data: { ...pack.data, levels } });
  }

  console.log(`  bundled        : ${bundledFlips}`);
  console.log(`  remote         : ${remoteFlips} across ${touchedPacks.length} pack(s)`);

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(nextBundled, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, manifestPath)}`);
  for (const pack of touchedPacks) {
    await setDoc(doc(db, 'remote_level_packs', pack.id), pack.data);
    console.log(`wrote ${pack.id}`);
  }
  console.log('\nDone.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // The Firestore SDK keeps handles open, so returning from main() is not
  // enough to end the process.
  main().then(() => process.exit(0), err => { console.error(err); process.exit(1); });
}
