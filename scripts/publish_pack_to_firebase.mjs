/**
 * Publish Level Pack to Firebase Firestore CLI Utility
 * ================================================================================
 * Usage:
 *   node scripts/publish_pack_to_firebase.mjs --packId "autumn_forest" --title "Autumn Forest Expansion" --file ./new_pack.json
 * ================================================================================
 */

import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSy_thirteen_a5760_web_key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'thirteen-a5760.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'thirteen-a5760',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:396835359318:web:diffhunter'
};

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

  console.log(`Publishing pack: ${packId} ("${title}") to Firebase Project: ${firebaseConfig.projectId}...`);

  let levels = [];
  if (jsonFile && fs.existsSync(jsonFile)) {
    levels = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  } else {
    console.log('No --file provided. Specify a JSON file containing level entries array to publish.');
    return;
  }

  if (!Array.isArray(levels) || levels.length === 0) {
    console.error('Error: Levels must be a non-empty array of valid manifest level objects.');
    process.exit(1);
  }

  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const packDocRef = doc(db, 'remote_level_packs', packId);
    await setDoc(packDocRef, {
      packId,
      title,
      active: true,
      publishedAt: new Date().toISOString(),
      levelCount: levels.length,
      levels
    });

    console.log(`🎉 Successfully published ${levels.length} levels to Firebase remote_level_packs/${packId}!`);
    console.log('Players will automatically receive this pack upon next app launch.');
  } catch (err) {
    console.error('Firebase publish error:', err);
    process.exit(1);
  }
}

main();
