/**
 * Publish Level Pack to Firebase Firestore CLI Utility
 * ================================================================================
 * Usage:
 *   node scripts/publish_pack_to_firebase.mjs --packId "autumn_forest" --title "Autumn Forest Expansion" --file ./new_pack.json
 *
 * Entries in --file must already carry absolute https:// image URLs -- remote
 * pack entries aren't bundled into the native app, so a relative "levels/..."
 * path (which only resolves inside the app bundle) will never load on a device
 * that hasn't rebuilt. Deploy the web build first so the same files public/levels/
 * ships to the live hosting site, then point entries at that URL.
 * ================================================================================
 */

import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

import { validatePhotoPairManifest } from '../src/utils/photoPairManifest.js';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'diff-hunter-progress-20260810.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:169569618752:web:4151f5708b21afaaac48a5'
};

/**
 * Pure validation + document-shaping logic, kept separate from Firebase I/O so
 * it can be unit tested without a network call. Throws with every validation
 * error joined into the message if any entry is invalid -- a remote pack is a
 * manual, infrequent publish, so refusing the whole batch on any bad entry is
 * safer than silently dropping it (the client-side loader also validates on
 * read, but a bad entry there just vanishes with no operator-visible signal).
 */
export function buildPackDocument({ packId, title, levels }) {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error('levels must be a non-empty array of manifest-shaped level objects.');
  }

  const isRelative = value => typeof value === 'string' && !/^https?:\/\//i.test(value);
  const relativeImagePaths = levels.filter(entry => isRelative(entry?.baseImage) || isRelative(entry?.variantImage));
  if (relativeImagePaths.length > 0) {
    throw new Error(
      `${relativeImagePaths.length} entr${relativeImagePaths.length === 1 ? 'y has' : 'ies have'} a relative ` +
        `baseImage/variantImage path. Remote pack entries must use an absolute https:// URL: ` +
        relativeImagePaths.map(e => e.id || '(missing id)').join(', ')
    );
  }

  const { validEntries, errors } = validatePhotoPairManifest(levels);
  if (errors.length > 0 || validEntries.length !== levels.length) {
    throw new Error(`Refusing to publish -- invalid manifest entries:\n${errors.join('\n')}`);
  }

  return {
    packId,
    title,
    active: true,
    publishedAt: new Date().toISOString(),
    levelCount: validEntries.length,
    levels: validEntries
  };
}

async function getFirestoreDb() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.warn('Anonymous sign-in failed (continuing, write may be rejected by rules):', err?.message || err);
  }
  return getFirestore(app);
}

async function main() {
  const args = process.argv.slice(2);
  let packId = 'expansion_pack_1';
  let title = 'New Expansion Pack';
  let jsonFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--packId' && args[i + 1]) packId = args[++i];
    if (args[i] === '--title' && args[i + 1]) title = args[++i];
    if (args[i] === '--file' && args[i + 1]) jsonFile = args[++i];
  }

  if (!jsonFile || !fs.existsSync(jsonFile)) {
    console.log('No --file provided (or file not found). Specify a JSON file containing a level entries array.');
    process.exit(1);
  }

  const levels = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

  let packDocument;
  try {
    packDocument = buildPackDocument({ packId, title, levels });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  console.log(`Publishing pack: ${packId} ("${title}") to Firebase Project: ${firebaseConfig.projectId}...`);

  try {
    const db = await getFirestoreDb();
    const packDocRef = doc(db, 'remote_level_packs', packId);
    await setDoc(packDocRef, packDocument);

    console.log(`Successfully published ${packDocument.levelCount} levels to remote_level_packs/${packId}.`);
    console.log('Players will automatically receive this pack on next app launch with network access.');
    process.exit(0); // the Firestore SDK keeps an open connection; exit explicitly so the process doesn't hang
  } catch (err) {
    console.error('Firebase publish error:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
