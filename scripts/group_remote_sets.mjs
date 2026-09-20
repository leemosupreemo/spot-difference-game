#!/usr/bin/env node
/**
 * Regroup published remote levels into `remote_set_NNN` sets of five.
 *
 * Remote levels need a connection, so they are withheld offline as whole sets.
 * That only works if they ARE sets: a loose remote level would still be picked
 * by the non-set selection path and fail to load.
 *
 * Dismissed levels are dropped -- they are downloaded and cached by every
 * client today only to be discarded by the curation filter. The final set is
 * padded with placeholders when there is not enough approved artwork for five.
 *
 * Usage: node scripts/group_remote_sets.mjs [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createPlaceholderEntry, REMOTE_SET_PREFIX } from '../src/utils/remoteSetPolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SET_SIZE = 5;
const PACK_PREFIX = 'remote_set_pack_';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

const statusOf = (value) => (typeof value === 'string' ? value : value?.status);

/** The base image a level is built on -- two levels sharing one are near-twins. */
export function baseKey(level) {
  return String(level?.baseImage || '').split('?')[0].split('/').pop() || level?.id || '';
}

/**
 * Deal levels into sets so no set shows the same photo twice.
 *
 * Chunking the approved list in order groups a photo's variants together,
 * because that is the order they were generated in -- four views of one
 * starfield landed in a single set. A player then sees the same picture four
 * times out of five, and no amount of reordering within the set can fix it.
 *
 * Largest photo groups are placed first, each into the emptiest set that does
 * not already hold that photo. A group can only be spread this way while it is
 * no larger than the number of sets, so that condition is checked and reported
 * rather than silently producing a repetitive set.
 */
export function allocateSets(approved, setSize = SET_SIZE) {
  if (approved.length === 0) return [];
  const setCount = Math.ceil(approved.length / setSize);

  const groups = new Map();
  for (const level of approved) {
    const key = baseKey(level);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(level);
  }
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length);

  // Packing fullest-first keeps the shortfall in one trailing set, which is
  // what an incomplete set should look like. But it can dead-end: a large group
  // arrives to find every set that could take it already full. Spreading avoids
  // that and costs a tidy tail, so try packing first and fall back only when it
  // actually produces a repeat.
  const attempt = (preferFullest) => {
    const buckets = Array.from({ length: setCount }, () => ({ levels: [], bases: new Set() }));
    const overflow = [];
    for (const group of ordered) {
      for (const level of group) {
        const key = baseKey(level);
        const open = buckets.filter(b => b.levels.length < setSize && !b.bases.has(key));
        open.sort((a, b) => preferFullest
          ? b.levels.length - a.levels.length
          : a.levels.length - b.levels.length);
        const target = open[0];
        if (!target) { overflow.push(level); continue; }
        target.levels.push(level);
        target.bases.add(key);
      }
    }
    for (const level of overflow) {
      const target = buckets.filter(b => b.levels.length < setSize)
        .sort((a, b) => b.levels.length - a.levels.length)[0];
      if (target) { target.levels.push(level); target.bases.add(baseKey(level)); }
    }
    const sets = buckets.map(b => b.levels).filter(levels => levels.length > 0);
    const repeats = sets.reduce((total, levels) =>
      total + (levels.length - new Set(levels.map(baseKey)).size), 0);
    return { sets, repeats };
  };

  const packed = attempt(true);
  if (packed.repeats === 0) return packed.sets;
  const spread = attempt(false);
  return spread.repeats < packed.repeats ? spread.sets : packed.sets;
}

/** Split approved levels into fives, padding the last set with placeholders. */
export function buildRemoteSets(approved, setSize = SET_SIZE, makePlaceholder = createPlaceholderEntry) {
  const allocated = allocateSets(approved, setSize);
  // Fullest sets first, so the padded one is last and keeps the highest number.
  allocated.sort((a, b) => b.length - a.length);
  return allocated.map((slice, index) => {
    const setId = `${REMOTE_SET_PREFIX}${String(index + 1).padStart(3, '0')}`;
    const levels = slice.map((level, i) => ({ ...level, setId, sequence: i + 1 }));
    while (levels.length < setSize) {
      levels.push(makePlaceholder({ setId, sequence: levels.length + 1 }));
    }
    const repeats = levels.length - new Set(levels.filter(l => !l.isPlaceholder).map(baseKey)).size
                    - levels.filter(l => l.isPlaceholder).length;
    return { setId, levels, realCount: slice.length, repeatedBases: repeats };
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const official = JSON.parse(fs.readFileSync(path.join(ROOT, 'official_curated_levels.json'), 'utf8')).rawStatusMap;

  const app = initializeApp(firebaseConfig);
  try { await signInAnonymously(getAuth(app)); } catch (err) {
    console.warn('Anonymous sign-in failed (write may be rejected):', err?.message || err);
  }
  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, 'remote_level_packs'));

  const existingPackIds = [];
  const all = [];
  // Collect by id. A level can legitimately appear in more than one pack --
  // a superseded pack that has not been deleted yet, or an overlapping publish
  // -- and reading it twice would allocate the same level into two sets, which
  // publishes it twice under one id.
  const seenIds = new Set();
  snapshot.forEach(docSnap => {
    existingPackIds.push(docSnap.id);
    for (const level of docSnap.data().levels || []) {
      if (!level?.id || seenIds.has(level.id)) continue;
      seenIds.add(level.id);
      all.push(level);
    }
  });

  // Keep anything not rejected, and stamp each level with the decision the
  // curation record actually holds.
  //
  // Keeping only approved levels would delete a review batch that is still
  // being judged -- the candidates are deliberately unreviewed, so a regroup
  // would treat them as unwanted and remove them mid-review.
  //
  // Stamping matters because the gate reads the level's own curationStatus, not
  // the record. A level approved in the record but still carrying 'pending'
  // from when it was published for review stays invisible in production for
  // good, which is exactly what happened to the one duplicate keeper.
  const decide = (level) => {
    const recorded = statusOf(official[level.id]);
    if (recorded === 'dismissed') return null;
    if (recorded === 'approved' || recorded === 'wrong_difficulty') {
      return { ...level, curationStatus: 'approved' };
    }
    return { ...level, curationStatus: 'pending' };
  };
  const approved = all.map(decide).filter(Boolean);
  const dropped = all.filter(l => statusOf(official[l.id]) === 'dismissed');
  const sets = buildRemoteSets(approved);

  console.log(`published levels : ${all.length}`);
  console.log(`  kept           : ${approved.length} (approved or awaiting review)`);
  console.log(`  dropped        : ${dropped.length} (dismissed)`);
  console.log(`sets of ${SET_SIZE}       : ${sets.length}`);
  for (const set of sets) {
    const pad = SET_SIZE - set.realCount;
    const warn = set.repeatedBases > 0 ? `  ** ${set.repeatedBases} repeated base image(s)` : '';
    console.log(`  ${set.setId}: ${set.realCount} real${pad ? ` + ${pad} placeholder` : ''}${warn}`);
  }
  console.log(`replacing packs  : ${existingPackIds.join(', ')}`);

  if (!apply) { console.log('\nDry run. Re-run with --apply to write.'); process.exit(0); }

  const writtenPackIds = new Set();
  for (const set of sets) {
    const packId = `${PACK_PREFIX}${set.setId.slice(REMOTE_SET_PREFIX.length)}`;
    writtenPackIds.add(packId);
    await setDoc(doc(db, 'remote_level_packs', packId), {
      packId,
      title: `Remote Set ${set.setId.slice(REMOTE_SET_PREFIX.length)}`,
      active: true,
      publishedAt: new Date().toISOString(),
      setId: set.setId,
      levelCount: set.levels.length,
      levels: set.levels
    });
    console.log(`wrote ${packId} (${set.levels.length} levels)`);
  }
  // Remove every pack this run did not just write, including higher-numbered
  // ones from a previous, larger allocation. Skipping same-prefix packs assumed
  // they would be overwritten, which is only true while the set count grows --
  // when it shrinks the leftovers keep serving levels that were just dismissed.
  for (const packId of existingPackIds) {
    if (writtenPackIds.has(packId)) continue;
    await deleteDoc(doc(db, 'remote_level_packs', packId));
    console.log(`removed superseded pack ${packId}`);
  }
  console.log('\nDone.');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
