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

/** Split approved levels into fives, padding the last set with placeholders. */
export function buildRemoteSets(approved, setSize = SET_SIZE, makePlaceholder = createPlaceholderEntry) {
  const sets = [];
  for (let i = 0; i < approved.length; i += setSize) {
    const setId = `${REMOTE_SET_PREFIX}${String(sets.length + 1).padStart(3, '0')}`;
    const slice = approved.slice(i, i + setSize);
    const levels = slice.map((level, index) => ({ ...level, setId, sequence: index + 1 }));
    while (levels.length < setSize) {
      levels.push(makePlaceholder({ setId, sequence: levels.length + 1 }));
    }
    sets.push({ setId, levels, realCount: slice.length });
  }
  return sets;
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
  snapshot.forEach(docSnap => {
    existingPackIds.push(docSnap.id);
    for (const level of docSnap.data().levels || []) all.push(level);
  });

  const approved = all.filter(l => statusOf(official[l.id]) === 'approved');
  const dropped = all.filter(l => statusOf(official[l.id]) !== 'approved');
  const sets = buildRemoteSets(approved);

  console.log(`published levels : ${all.length}`);
  console.log(`  approved       : ${approved.length}`);
  console.log(`  dropped        : ${dropped.length} (not approved)`);
  console.log(`sets of ${SET_SIZE}       : ${sets.length}`);
  for (const set of sets) {
    const pad = SET_SIZE - set.realCount;
    console.log(`  ${set.setId}: ${set.realCount} real${pad ? ` + ${pad} placeholder` : ''}`);
  }
  console.log(`replacing packs  : ${existingPackIds.join(', ')}`);

  if (!apply) { console.log('\nDry run. Re-run with --apply to write.'); process.exit(0); }

  for (const set of sets) {
    const packId = `${PACK_PREFIX}${set.setId.slice(REMOTE_SET_PREFIX.length)}`;
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
  for (const packId of existingPackIds) {
    if (packId.startsWith(PACK_PREFIX)) continue;
    await deleteDoc(doc(db, 'remote_level_packs', packId));
    console.log(`removed superseded pack ${packId}`);
  }
  console.log('\nDone.');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
