#!/usr/bin/env node
/**
 * Repoint existing remote packs at content-addressed base images.
 *
 * Base images used to be stored once per variant as
 * `<sceneId>_<digest>_base.<ext>`. They are now deduplicated to a single
 * `<digest>_base.<ext>`, so absolute URLs already published in Firestore point
 * at filenames that no longer exist. The digest is present in both spellings,
 * so the rewrite is mechanical.
 *
 * Only baseImage is touched -- variant images were never deduplicated. A URL
 * whose target is not present locally is left alone and reported rather than
 * rewritten to a guess.
 *
 * Usage: node scripts/repair_remote_pack_base_urls.mjs [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEVELS_DIR = path.resolve(__dirname, '../public/levels');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

/** Rewrite one base URL, or return null when it needs no change / cannot be resolved. */
export function canonicalBaseUrl(url, exists = (f) => fs.existsSync(path.join(LEVELS_DIR, f))) {
  if (typeof url !== 'string') return null;
  const [withoutQuery] = url.split('?');
  const filename = withoutQuery.split('/').pop() || '';
  if (exists(filename)) return null;                       // already canonical
  const match = filename.match(/([0-9a-f]{12})_base(\.\w+)$/);
  if (!match) return null;
  const canonical = `${match[1]}_base${match[2]}`;
  if (!exists(canonical)) return null;                     // never guess
  return withoutQuery.slice(0, withoutQuery.length - filename.length) + canonical;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const app = initializeApp(firebaseConfig);
  try { await signInAnonymously(getAuth(app)); } catch (err) {
    console.warn('Anonymous sign-in failed (write may be rejected):', err?.message || err);
  }
  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, 'remote_level_packs'));

  let rewritten = 0, untouched = 0;
  const updates = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (!Array.isArray(data.levels)) return;
    let changed = 0;
    const levels = data.levels.map(level => {
      const next = canonicalBaseUrl(level.baseImage);
      if (!next) { untouched++; return level; }
      changed++; rewritten++;
      return { ...level, baseImage: next };
    });
    if (changed > 0) updates.push({ id: docSnap.id, levels, changed });
  });

  for (const update of updates) {
    console.log(`${update.id}: ${update.changed} base URL(s) repointed`);
    if (apply) await updateDoc(doc(db, 'remote_level_packs', update.id), { levels: update.levels });
  }
  console.log(`\nrewritten: ${rewritten} | left as-is: ${untouched} | packs touched: ${updates.length}`);
  console.log(apply ? 'Applied.' : 'Dry run. Re-run with --apply to write.');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
