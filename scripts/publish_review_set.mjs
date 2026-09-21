#!/usr/bin/env node
/**
 * Publish a batch of unreviewed candidates as one remote review set.
 *
 * The candidates go out as `curationStatus: 'pending'`, so the pending gate
 * keeps them out of regular play and shows them only in debug -- which is where
 * they are meant to be judged. The set is padded to five with placeholders so it
 * is well-formed and can actually be started.
 *
 * It takes the next free `remote_set_NNN` rather than filling gaps in an
 * existing set: a review batch should be reviewable as a batch, and folding it
 * into a live set would mix judged and unjudged levels. Once reviewed, running
 * group_remote_sets reallocates everything approved into tidy sets.
 *
 * Usage: node scripts/publish_review_set.mjs --file <manifest.json> --host <url> [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { createPlaceholderEntry, REMOTE_SET_PREFIX } from '../src/utils/remoteSetPolicy.js';
import { allocateSets, baseKey } from './group_remote_sets.mjs';
import { derivePhotoKey } from '../src/utils/photoIdentity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SET_SIZE = 5;
const DEFAULT_HOST = 'https://diff-hunter-progress-20260810.web.app/';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

export function nextSetId(existingSetIds) {
  const used = new Set(existingSetIds.filter(Boolean));
  for (let n = 1; n < 1000; n++) {
    const id = `${REMOTE_SET_PREFIX}${String(n).padStart(3, '0')}`;
    if (!used.has(id)) return id;
  }
  throw new Error('No free remote set id');
}

/**
 * Level ids must be unique across everything published.
 * validatePhotoPairManifest keeps the first entry with a given id and silently
 * drops the rest, so a collision does not surface as an error -- the set simply
 * arrives short, fails the complete-set check, and never appears in the picker.
 * Catch it here, where it can still be explained.
 */
export function findIdCollisions(entries, existingIds) {
  const taken = new Set(existingIds);
  return entries.map(e => e.id).filter(id => taken.has(id));
}

/**
 * Split a batch into review sets, spreading each photograph across them.
 *
 * A batch is usually several variants of the same few photographs, so chunking
 * it in order would put one picture five times in a single set. The same
 * allocator the live regroup uses keeps a photo to at most one slot per set.
 */
export function buildReviewSets(entries, firstSetNumber, host, makePlaceholder = createPlaceholderEntry) {
  const ids = entries.map(e => e.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Review batch contains repeated level ids');
  }
  const absolute = (ref) => `${host.replace(/\/+$/, '')}/${String(ref).split('?')[0].replace(/^\/+/, '')}`;

  const groups = allocateSets(entries, SET_SIZE).sort((a, b) => b.length - a.length);
  return groups.map((group, index) => {
    const setId = `${REMOTE_SET_PREFIX}${String(firstSetNumber + index).padStart(3, '0')}`;
    const levels = group.map((entry, i) => ({
      ...entry,
      setId,
      sequence: i + 1,
      curationStatus: 'pending',
      // Stamped at publish rather than left to a later backfill: set composition
      // and the flip tool both identify a photograph by this key, and a level
      // published without one is an error the audit has to catch after the fact.
      // Derived before the paths are made absolute -- the key ignores the host
      // either way, but this keeps it identical to the bundled form.
      photoKey: entry.photoKey || derivePhotoKey(entry),
      baseImage: absolute(entry.baseImage),
      variantImage: absolute(entry.variantImage)
    }));
    while (levels.length < SET_SIZE) {
      levels.push(makePlaceholder({ setId, sequence: levels.length + 1 }));
    }
    const bases = levels.filter(l => !l.isPlaceholder).map(baseKey);
    return { setId, levels, realCount: group.length, repeats: bases.length - new Set(bases).size };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const read = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  const file = read('--file', 'build/dup-review/manifest.json');
  const host = read('--host', DEFAULT_HOST);
  const apply = args.includes('--apply');

  const entries = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'));
  if (entries.length === 0) { console.log('Nothing to publish.'); process.exit(0); }

  const app = initializeApp(firebaseConfig);
  try { await signInAnonymously(getAuth(app)); } catch (err) {
    console.warn('Anonymous sign-in failed (write may be rejected):', err?.message || err);
  }
  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, 'remote_level_packs'));
  const existing = [];
  const publishedIds = [];
  snapshot.forEach(d => {
    for (const l of (d.data().levels || [])) {
      if (l.setId !== undefined) existing.push(l.setId);
      if (l.id) publishedIds.push(l.id);
    }
  });
  // Bundled levels share the id space with remote ones.
  const bundled = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../public/levels/photo_pair_manifest.json'), 'utf8'));
  const collisions = findIdCollisions(entries, [...publishedIds, ...bundled.map(e => e.id)]);
  if (collisions.length > 0) {
    console.error(`Refusing to publish: ${collisions.length} level id(s) already exist.`);
    collisions.forEach(id => console.error(`  ${id}`));
    console.error('A duplicate id is dropped by manifest validation, leaving the set incomplete and invisible.');
    process.exit(1);
  }

  const firstNumber = Number(nextSetId(existing).slice(REMOTE_SET_PREFIX.length));
  const sets = buildReviewSets(entries, firstNumber, host);

  console.log(`candidates : ${entries.length}`);
  console.log(`review sets: ${sets.length}`);
  for (const set of sets) {
    const pad = SET_SIZE - set.realCount;
    console.log(`  ${set.setId}: ${set.realCount} real${pad ? ` + ${pad} placeholder` : ''}`
      + (set.repeats ? `  ** ${set.repeats} repeated photo(s)` : ''));
  }

  if (!apply) { console.log('\nDry run. Re-run with --apply to write.'); process.exit(0); }

  for (const set of sets) {
    const packId = `remote_set_pack_${set.setId.slice(REMOTE_SET_PREFIX.length)}`;
    await setDoc(doc(db, 'remote_level_packs', packId), {
      packId,
      title: `Review Batch ${set.setId.slice(REMOTE_SET_PREFIX.length)}`,
      active: true,
      publishedAt: new Date().toISOString(),
      setId: set.setId,
      levelCount: set.levels.length,
      levels: set.levels
    });
    console.log(`published ${packId} (${set.realCount} real)`);
  }
  console.log('\nPending levels are visible in debug mode only.');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
