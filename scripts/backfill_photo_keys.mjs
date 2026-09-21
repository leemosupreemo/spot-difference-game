#!/usr/bin/env node
/**
 * Stamp `photoKey` on every published level.
 *
 * Purely additive and idempotent: an entry that already carries a key is left
 * exactly as it is. Nothing is guessed -- the key is derived from whichever
 * image slot currently holds the photograph, which for an unflipped entry is
 * the base. Run once before flipping anything, and again after any publish that
 * predates the field.
 *
 * Usage:
 *   node scripts/backfill_photo_keys.mjs            # report
 *   node scripts/backfill_photo_keys.mjs --apply    # write manifest + packs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { isPlaceholderEntry } from '../src/utils/remoteSetPolicy.js';
import { derivePhotoKey } from '../src/utils/photoIdentity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

/** Returns {entry, stamped} -- stamped is false when it already had a key. */
export function stampPhotoKey(entry) {
  if (!entry || isPlaceholderEntry(entry)) return { entry, stamped: false };
  if (typeof entry.photoKey === 'string' && entry.photoKey) return { entry, stamped: false };
  const key = derivePhotoKey(entry);
  if (!key) return { entry, stamped: false };
  return { entry: { ...entry, photoKey: key }, stamped: true };
}

export function stampAll(entries = []) {
  let stamped = 0;
  const out = entries.map(entry => {
    const result = stampPhotoKey(entry);
    if (result.stamped) stamped++;
    return result.entry;
  });
  return { entries: out, stamped };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manifestPath = path.join(ROOT, 'public/levels/photo_pair_manifest.json');

  const bundled = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bundledResult = stampAll(bundled);
  console.log(`bundled : ${bundledResult.stamped} stamped of ${bundled.length}`);

  const app = initializeApp(firebaseConfig);
  try { await signInAnonymously(getAuth(app)); } catch (err) {
    console.warn('Anonymous sign-in failed (write may be rejected):', err?.message || err);
  }
  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, 'remote_level_packs'));

  const touched = [];
  let remoteStamped = 0, remoteTotal = 0;
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.active !== true) return;
    remoteTotal += (data.levels || []).length;
    const result = stampAll(data.levels || []);
    remoteStamped += result.stamped;
    if (result.stamped > 0) touched.push({ id: docSnap.id, data: { ...data, levels: result.entries } });
  });
  console.log(`remote  : ${remoteStamped} stamped of ${remoteTotal} across ${touched.length} pack(s)`);

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }
  if (bundledResult.stamped > 0) {
    fs.writeFileSync(manifestPath, JSON.stringify(bundledResult.entries, null, 2) + '\n');
    console.log(`wrote ${path.relative(ROOT, manifestPath)}`);
  }
  for (const pack of touched) {
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
