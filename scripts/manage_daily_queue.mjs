/**
 * Daily Image Pair Queue & Schedule Management Tool
 * ================================================================================
 * Allows adding, inspecting, scheduling, and pushing daily challenge image pairs
 * over-the-air to mobile and web without requiring a new app submission or rebuild.
 *
 * Usage:
 *   # View current daily schedule and queue:
 *   node scripts/manage_daily_queue.mjs list
 *
 *   # Schedule specific level IDs for a specific date:
 *   node scripts/manage_daily_queue.mjs schedule --date 2026-09-12 --levels "id1,id2,id3" [--push]
 *
 *   # Append 3 level IDs to the sequential unrepeated queue:
 *   node scripts/manage_daily_queue.mjs add --levels "id1,id2,id3" [--push]
 *
 *   # Push local queue (public/daily-queue.json) directly to Firebase Firestore:
 *   node scripts/manage_daily_queue.mjs push
 *
 *   # Pull latest queue from Firebase Firestore:
 *   node scripts/manage_daily_queue.mjs pull
 * ================================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const QUEUE_FILE = path.join(rootDir, 'public', 'daily-queue.json');
const MANIFEST_FILE = path.join(rootDir, 'public', 'levels', 'photo_pair_manifest.json');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSy_thirteen_a5760_web_key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'thirteen-a5760.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'thirteen-a5760',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:396835359318:web:diffhunter'
};

function loadManifestMap() {
  if (!fs.existsSync(MANIFEST_FILE)) return new Map();
  try {
    const raw = fs.readFileSync(MANIFEST_FILE, 'utf8');
    const list = JSON.parse(raw);
    return new Map(list.map(entry => [entry.id, entry]));
  } catch (_) {
    return new Map();
  }
}

function loadLocalQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    return { updatedAt: new Date().toISOString(), schedule: {}, queue: [], customLevels: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch (_) {
    return { updatedAt: new Date().toISOString(), schedule: {}, queue: [], customLevels: [] };
  }
}

function saveLocalQueue(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`💾 Saved updated queue to: ${QUEUE_FILE}`);
}

async function getFirestoreDb() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  try {
    await signInAnonymously(auth);
  } catch (_) {}
  return getFirestore(app);
}

async function pushToFirebase(queueData) {
  console.log(`🚀 Pushing daily queue to Firebase Firestore (project: ${firebaseConfig.projectId})...`);
  try {
    const db = await getFirestoreDb();
    const queueDocRef = doc(db, 'daily_challenge', 'queue');

    const normalizedQueue = (queueData.queue || []).map((item, idx) => {
      if (Array.isArray(item)) {
        return { setId: `set_${idx + 1}`, levels: item };
      }
      return item;
    });

    await setDoc(queueDocRef, {
      schedule: queueData.schedule || {},
      queue: normalizedQueue,
      customLevels: queueData.customLevels || [],
      updatedAt: new Date().toISOString()
    });
    console.log('✅ Successfully published daily queue to Firebase doc daily_challenge/queue!');
    console.log('📱 Mobile iOS and Android devices will now pull this queue OTA without a rebuild.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to push to Firebase:', err?.message || err);
    process.exit(1);
  }
}

async function pullFromFirebase() {
  console.log(`📥 Pulling daily queue from Firebase Firestore (project: ${firebaseConfig.projectId})...`);
  try {
    const db = await getFirestoreDb();
    const queueDocRef = doc(db, 'daily_challenge', 'queue');
    const snap = await getDoc(queueDocRef);
    if (snap.exists()) {
      const data = snap.data();
      saveLocalQueue(data);
      console.log('✅ Successfully pulled and updated public/daily-queue.json from Firebase!');
      process.exit(0);
    } else {
      console.log('ℹ️ No remote queue doc found in Firebase. Initializing from local...');
      const local = loadLocalQueue();
      await pushToFirebase(local);
    }
  } catch (err) {
    console.error('❌ Failed to pull from Firebase:', err?.message || err);
    process.exit(1);
  }
}

function parseLevelsArg(raw) {
  if (!raw) return [];
  return raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}

function validateLevels(levelIds, manifestMap) {
  const missing = [];
  for (const id of levelIds) {
    if (!manifestMap.has(id)) missing.push(id);
  }
  return missing;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';
  const manifestMap = loadManifestMap();
  const queueData = loadLocalQueue();

  if (command === 'list' || command === '--list') {
    console.log('\n📅 Diff Hunter — Daily Challenge Queue & Schedule');
    console.log('===============================================================');
    console.log(`Updated At: ${queueData.updatedAt || 'N/A'}\n`);

    console.log('🗓️  SCHEDULED DATES:');
    const dates = Object.keys(queueData.schedule || {}).sort();
    if (dates.length === 0) {
      console.log('  (No specific dates scheduled)');
    } else {
      for (const d of dates) {
        const ids = queueData.schedule[d];
        const titles = ids.map(id => manifestMap.get(id)?.title || id).join(', ');
        console.log(`  • ${d}: [${ids.join(', ')}] (${titles})`);
      }
    }

    console.log('\n📋 SEQUENTIAL QUEUE:');
    const q = queueData.queue || [];
    if (q.length === 0) {
      console.log('  (Sequential queue empty - falls back to deterministic unrepeated catalog generator)');
    } else {
      q.forEach((set, idx) => {
        const ids = Array.isArray(set) ? set : (set?.levels || []);
        const titles = ids.map(id => manifestMap.get(id)?.title || id).join(', ');
        const label = set?.setId || `Set #${idx + 1}`;
        const tag = set?.isLegacy ? ' [OLD / LEGACY]' : (set?.label ? ` [${set.label}]` : '');
        console.log(`  [${label}${tag}]: [${ids.join(', ')}] (${titles})`);
      });
    }

    console.log(`\n📦 Custom OTA Levels: ${(queueData.customLevels || []).length} registered`);
    console.log('===============================================================\n');
    return;
  }

  if (command === 'schedule') {
    let date = null;
    let levelsRaw = null;
    let push = false;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--date' && args[i + 1]) date = args[++i];
      if (args[i] === '--levels' && args[i + 1]) levelsRaw = args[++i];
      if (args[i] === '--push') push = true;
    }

    if (!date || !levelsRaw) {
      console.error('Usage: node scripts/manage_daily_queue.mjs schedule --date YYYY-MM-DD --levels "id1,id2,id3" [--push]');
      process.exit(1);
    }

    const levelIds = parseLevelsArg(levelsRaw);
    if (levelIds.length !== 3) {
      console.error(`Error: Exactly 3 levels must be provided for a daily set (got ${levelIds.length}).`);
      process.exit(1);
    }

    const missing = validateLevels(levelIds, manifestMap);
    if (missing.length > 0) {
      console.warn(`⚠️ Warning: Levels not found in local manifest: ${missing.join(', ')}`);
    }

    queueData.schedule = queueData.schedule || {};
    queueData.schedule[date] = levelIds;
    saveLocalQueue(queueData);

    console.log(`✨ Scheduled date ${date} with levels: [${levelIds.join(', ')}]`);
    if (push) {
      await pushToFirebase(queueData);
    }
    return;
  }

  if (command === 'add') {
    let levelsRaw = null;
    let push = false;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--levels' && args[i + 1]) levelsRaw = args[++i];
      if (args[i] === '--push') push = true;
    }

    if (!levelsRaw) {
      console.error('Usage: node scripts/manage_daily_queue.mjs add --levels "id1,id2,id3" [--push]');
      process.exit(1);
    }

    const levelIds = parseLevelsArg(levelsRaw);
    if (levelIds.length !== 3) {
      console.error(`Error: Exactly 3 levels must be provided for a daily set (got ${levelIds.length}).`);
      process.exit(1);
    }

    queueData.queue = queueData.queue || [];
    const setId = `set_${queueData.queue.length + 1}`;
    queueData.queue.push({
      setId,
      levels: levelIds
    });
    saveLocalQueue(queueData);

    console.log(`✨ Added ${setId} to queue: [${levelIds.join(', ')}]`);
    if (push) {
      await pushToFirebase(queueData);
    }
    return;
  }

  if (command === 'push') {
    await pushToFirebase(queueData);
    return;
  }

  if (command === 'pull') {
    await pullFromFirebase();
    return;
  }

  console.log(`Unknown command "${command}". Available commands: list, schedule, add, push, pull`);
}

main();
