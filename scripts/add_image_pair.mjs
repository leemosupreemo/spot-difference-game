#!/usr/bin/env node

/**
 * Unified Streamlined Image Pair Ingestion & Publishing CLI
 * ================================================================================
 * Usage Examples:
 *   # 1. Ingest a local pair, auto-detect diff centroid/radius, optimize, and save:
 *   node scripts/add_image_pair.mjs --base ./base.jpg --variant ./variant.jpg --title "Antique Clocks" --pack "Timepieces"
 *
 *   # 2. Ingest and immediately publish Over-The-Air to Firebase Firestore:
 *   node scripts/add_image_pair.mjs --base https://img.com/b.jpg --variant https://img.com/v.jpg --title "Tokyo Market" --pack "Urban" --publish
 *
 *   # 3. Batch ingest all pairs in a folder:
 *   node scripts/add_image_pair.mjs --batch ./my_new_pairs/ --pack "Nature Pack" --publish
 * ================================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_LEVELS_DIR = path.join(ROOT_DIR, 'public/levels');
const MANIFEST_PATH = path.join(DEFAULT_LEVELS_DIR, 'photo_pair_manifest.json');
const OFFICIAL_PATH = path.join(ROOT_DIR, 'official_curated_levels.json');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSy_thirteen_a5760_web_key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'thirteen-a5760.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'thirteen-a5760',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:396835359318:web:diffhunter'
};

function printHelp() {
  console.log(`
🔍 Spot The Difference - Streamlined Image Pair Ingestion CLI
================================================================================
Usage:
  npm run add:pair -- --base <path|url> --variant <path|url> [options]
  npm run add:pair -- --batch <dir> [options]

Options:
  --base <path|url>        Base image source path or URL (Required for single pair)
  --variant <path|url>     Variant image source path or URL (Required for single pair)
  --batch <dir>            Directory containing pairs (matches *_base.* and *_variant.*)
  --title <string>         Puzzle title (e.g. "Vintage Horology Desk")
  --pack <string>          Pack title (e.g. "Mechanical Wonders", default: "Community Pack")
  --packId <string>        Pack identifier slug (default: auto-slugified from pack)
  --id <string>            Unique level ID (default: auto-generated from pack/title)
  --difficulty <string>    "Easy", "Medium", or "Hard" (default: auto-calculated)
  --category <string>      Category name (default: "Photography")
  --operation <string>     "remove", "add", "color_shift", or "mutation" (default: auto)
  --x <number>             Manual X% coordinate override [5.0 - 95.0]
  --y <number>             Manual Y% coordinate override [5.0 - 95.0]
  --radius <number>        Manual radius% override [3.0 - 10.0]
  --publish                Upload level directly to Firebase Firestore remote_level_packs
  --no-local               Do not write to local public/levels/ or local manifest
  --dry-run                Analyze differences and print manifest entry without writing
  --help                   Show this help menu
================================================================================
`);
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '');
}

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.length === 0) {
    printHelp();
    process.exit(0);
  }

  const args = {
    base: null,
    variant: null,
    batch: null,
    title: null,
    pack: 'Community Pack',
    packId: null,
    id: null,
    difficulty: null,
    category: 'Photography',
    operation: null,
    x: null,
    y: null,
    radius: null,
    publish: false,
    noLocal: false,
    dryRun: false
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--base' && rawArgs[i + 1]) args.base = rawArgs[++i];
    else if (arg === '--variant' && rawArgs[i + 1]) args.variant = rawArgs[++i];
    else if (arg === '--batch' && rawArgs[i + 1]) args.batch = rawArgs[++i];
    else if (arg === '--title' && rawArgs[i + 1]) args.title = rawArgs[++i];
    else if (arg === '--pack' && rawArgs[i + 1]) args.pack = rawArgs[++i];
    else if (arg === '--packId' && rawArgs[i + 1]) args.packId = rawArgs[++i];
    else if (arg === '--id' && rawArgs[i + 1]) args.id = rawArgs[++i];
    else if (arg === '--difficulty' && rawArgs[i + 1]) args.difficulty = rawArgs[++i];
    else if (arg === '--category' && rawArgs[i + 1]) args.category = rawArgs[++i];
    else if (arg === '--operation' && rawArgs[i + 1]) args.operation = rawArgs[++i];
    else if (arg === '--x' && rawArgs[i + 1]) args.x = parseFloat(rawArgs[++i]);
    else if (arg === '--y' && rawArgs[i + 1]) args.y = parseFloat(rawArgs[++i]);
    else if (arg === '--radius' && rawArgs[i + 1]) args.radius = parseFloat(rawArgs[++i]);
    else if (arg === '--publish') args.publish = true;
    else if (arg === '--no-local') args.noLocal = true;
    else if (arg === '--dry-run') args.dryRun = true;
  }

  if (!args.packId && args.pack) {
    args.packId = slugify(args.pack);
  }

  return args;
}

async function fetchImageBuffer(source) {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP error fetching image from ${source}: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  const resolved = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Image file not found: ${resolved}`);
  }
  return fs.readFileSync(resolved);
}

/**
 * High precision pixel difference analyzer with spatial clustering & outlier rejection
 */
async function detectDifference(baseBuffer, variantBuffer, manualCoords = {}) {
  const bMeta = await sharp(baseBuffer).metadata();
  const vMeta = await sharp(variantBuffer).metadata();

  const targetW = Math.min(1024, bMeta.width || 1024);
  const targetH = Math.round((bMeta.height || 1024) * (targetW / (bMeta.width || 1024)));

  // Resize both using identical dimensions and fill to avoid subpixel shifts
  const { data: bRaw } = await sharp(baseBuffer)
    .resize(targetW, targetH, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: vRaw } = await sharp(variantBuffer)
    .resize(targetW, targetH, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = targetW;
  const height = targetH;
  const rawDiffs = [];
  const DELTA_THRESH = 35;

  let baseLumSum = 0;
  let varLumSum = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const bR = bRaw[idx], bG = bRaw[idx + 1], bB = bRaw[idx + 2];
      const vR = vRaw[idx], vG = vRaw[idx + 1], vB = vRaw[idx + 2];

      const delta = Math.abs(bR - vR) + Math.abs(bG - vG) + Math.abs(bB - vB);

      if (delta > DELTA_THRESH) {
        rawDiffs.push({ x, y, delta, bR, bG, bB, vR, vG, vB });
      }
    }
  }

  if (rawDiffs.length === 0) {
    throw new Error('No visual difference detected between base and variant images! (Check files)');
  }

  // Noise filter: reject isolated pixels (must have at least 1 neighbor in 5x5 window)
  const diffGrid = new Uint8Array(width * height);
  for (const p of rawDiffs) {
    diffGrid[p.y * width + p.x] = 1;
  }

  const filteredDiffs = [];
  let sumX = 0, sumY = 0, totalDelta = 0;

  for (const p of rawDiffs) {
    let neighbors = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const ny = p.y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = p.x + dx;
        if (nx < 0 || nx >= width) continue;
        if (diffGrid[ny * width + nx] === 1) neighbors++;
      }
    }

    if (neighbors >= 2) {
      filteredDiffs.push(p);
      sumX += p.x * p.delta;
      sumY += p.y * p.delta;
      totalDelta += p.delta;
      baseLumSum += (p.bR + p.bG + p.bB);
      varLumSum += (p.vR + p.vG + p.vB);
    }
  }

  const activePoints = filteredDiffs.length > 0 ? filteredDiffs : rawDiffs;
  const activeTotalDelta = totalDelta > 0 ? totalDelta : 1;

  // Calculate centroid
  let xPct = manualCoords.x ?? ((sumX / activeTotalDelta) / width) * 100;
  let yPct = manualCoords.y ?? ((sumY / activeTotalDelta) / height) * 100;

  // Clamp within playable bounds
  xPct = Math.min(95, Math.max(5, xPct));
  yPct = Math.min(95, Math.max(5, yPct));

  // Compute radius based on 95th percentile distance
  let rPct = manualCoords.radius;
  if (rPct == null) {
    const avgX = (xPct / 100) * width;
    const avgY = (yPct / 100) * height;
    const dists = activePoints.map(p => Math.hypot(p.x - avgX, p.y - avgY)).sort((a, b) => a - b);
    const p95Dist = dists[Math.floor(dists.length * 0.95)] || dists[dists.length - 1];
    const maxDim = Math.max(width, height);
    // Add hit tolerance margin
    rPct = Math.min(9.0, Math.max(3.8, (p95Dist / maxDim) * 100 + 1.5));
  }

  // Auto detect operation
  let detectedOperation = 'color_shift';
  const lumDiff = Math.abs(varLumSum - baseLumSum) / (activePoints.length * 3 || 1);
  if (lumDiff > 25) {
    detectedOperation = varLumSum > baseLumSum ? 'add' : 'remove';
  }

  // Difficulty estimation based on radius & changed pixel count
  let estimatedDifficulty = 'Medium';
  if (rPct <= 4.2 || activePoints.length < 800) {
    estimatedDifficulty = 'Hard';
  } else if (rPct >= 6.5 || activePoints.length > 3500) {
    estimatedDifficulty = 'Easy';
  }

  return {
    x: parseFloat(xPct.toFixed(1)),
    y: parseFloat(yPct.toFixed(1)),
    radius: parseFloat(rPct.toFixed(1)),
    diffPixelCount: activePoints.length,
    estimatedDifficulty,
    detectedOperation
  };
}

async function optimizeImages({ baseBuffer, variantBuffer, id, outputDir }) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseFileName = `${id}_base.jpg`;
  const varFileName = `${id}_variant.jpg`;
  const baseOutPath = path.join(outputDir, baseFileName);
  const varOutPath = path.join(outputDir, varFileName);

  // Resize and compress cleanly to 1200px max dimensions with JPEG quality 85
  await sharp(baseBuffer)
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(baseOutPath);

  await sharp(variantBuffer)
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(varOutPath);

  return {
    baseImage: `levels/${baseFileName}`,
    variantImage: `levels/${varFileName}`
  };
}

function updateLocalManifests(entry) {
  let manifest = [];
  if (fs.existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  }

  const existingIdx = manifest.findIndex(e => e.id === entry.id);
  if (existingIdx >= 0) {
    manifest[existingIdx] = entry;
    console.log(`  🔄 Updated existing entry in photo_pair_manifest.json: "${entry.id}"`);
  } else {
    manifest.push(entry);
    console.log(`  ➕ Appended new entry to photo_pair_manifest.json: "${entry.id}"`);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Also record to official curated approved list
  if (fs.existsSync(OFFICIAL_PATH)) {
    const official = JSON.parse(fs.readFileSync(OFFICIAL_PATH, 'utf-8'));
    const approved = new Set(official.approvedLevelIds || []);
    const dismissed = new Set(official.dismissedLevelIds || []);

    approved.add(entry.id);
    dismissed.delete(entry.id);

    official.approvedLevelIds = Array.from(approved);
    official.dismissedLevelIds = Array.from(dismissed);
    if (official.summary) {
      official.summary.approvedCount = official.approvedLevelIds.length;
      official.summary.dismissedCount = official.dismissedLevelIds.length;
    }

    fs.writeFileSync(OFFICIAL_PATH, JSON.stringify(official, null, 2));
  }
}

async function publishPackToFirestore(packId, packTitle, levelEntries) {
  console.log(`\n🚀 Publishing pack "${packTitle}" (${packId}) with ${levelEntries.length} level(s) to Firebase Firestore...`);
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const packRef = doc(db, 'remote_level_packs', packId);
  const existingSnap = await getDoc(packRef);

  let mergedLevels = [...levelEntries];
  if (existingSnap.exists()) {
    const data = existingSnap.data();
    if (Array.isArray(data.levels)) {
      const incomingIds = new Set(levelEntries.map(e => e.id));
      const kept = data.levels.filter(l => !incomingIds.has(l.id));
      mergedLevels = [...kept, ...levelEntries];
    }
  }

  await setDoc(packRef, {
    packId,
    title: packTitle,
    active: true,
    publishedAt: new Date().toISOString(),
    levelCount: mergedLevels.length,
    levels: mergedLevels
  });

  console.log(`  ✅ Successfully published to Firestore: remote_level_packs/${packId} (${mergedLevels.length} total levels)`);
}

async function processSinglePair(config) {
  console.log(`\n📸 Processing Image Pair:`);
  console.log(`  Base Source    : ${config.base}`);
  console.log(`  Variant Source : ${config.variant}`);

  const [baseBuf, varBuf] = await Promise.all([
    fetchImageBuffer(config.base),
    fetchImageBuffer(config.variant)
  ]);

  const diffResult = await detectDifference(baseBuf, varBuf, {
    x: config.x,
    y: config.y,
    radius: config.radius
  });

  const levelId = config.id || `${config.packId}_${slugify(config.title || 'level')}_${Date.now().toString().slice(-4)}`;
  const title = config.title || `Puzzle: ${levelId.replace(/_/g, ' ')}`;
  const difficulty = config.difficulty || diffResult.estimatedDifficulty;
  const operation = config.operation || diffResult.detectedOperation;

  console.log(`  🎯 Detected Diff  : X=${diffResult.x}%, Y=${diffResult.y}%, Radius=${diffResult.radius}% (${diffResult.diffPixelCount} delta px)`);
  console.log(`  ⭐ Auto Difficulty: ${difficulty} (Operation: ${operation})`);

  let baseImagePath = /^https?:\/\//i.test(config.base) ? config.base : `levels/${levelId}_base.jpg`;
  let variantImagePath = /^https?:\/\//i.test(config.variant) ? config.variant : `levels/${levelId}_variant.jpg`;

  if (!config.noLocal && !config.dryRun) {
    const saved = await optimizeImages({
      baseBuffer: baseBuf,
      variantBuffer: varBuf,
      id: levelId,
      outputDir: DEFAULT_LEVELS_DIR
    });
    baseImagePath = saved.baseImage;
    variantImagePath = saved.variantImage;
    console.log(`  💾 Saved assets to: ${DEFAULT_LEVELS_DIR}/${levelId}_{base,variant}.jpg`);
  }

  const levelEntry = {
    id: levelId,
    title,
    category: config.category,
    pack: config.pack,
    packId: config.packId,
    difficulty,
    baseImage: baseImagePath,
    variantImage: variantImagePath,
    operation,
    diffs: [
      {
        id: 1,
        x: diffResult.x,
        y: diffResult.y,
        radius: diffResult.radius,
        description: `Single ${operation} difference`,
        hint: `Look closely near coordinates (${Math.round(diffResult.x)}%, ${Math.round(diffResult.y)}%)`,
        operation
      }
    ]
  };

  if (config.dryRun) {
    console.log('\n[DRY RUN] Generated Level Manifest Entry:');
    console.log(JSON.stringify(levelEntry, null, 2));
    return levelEntry;
  }

  if (!config.noLocal) {
    updateLocalManifests(levelEntry);
  }

  if (config.publish) {
    await publishPackToFirestore(config.packId, config.pack, [levelEntry]);
  }

  return levelEntry;
}

async function processBatchDirectory(config) {
  const dir = path.isAbsolute(config.batch) ? config.batch : path.resolve(process.cwd(), config.batch);
  if (!fs.existsSync(dir)) {
    throw new Error(`Batch directory does not exist: ${dir}`);
  }

  const files = fs.readdirSync(dir);
  const baseFiles = files.filter(f => /_base\.(jpe?g|png|webp)$/i.test(f));

  if (baseFiles.length === 0) {
    throw new Error(`No "*_base.<ext>" files found in directory: ${dir}`);
  }

  console.log(`\n📂 Found ${baseFiles.length} candidate pair(s) in ${dir}...`);
  const ingestedEntries = [];

  for (const baseFile of baseFiles) {
    const basePrefix = baseFile.replace(/_base\.(jpe?g|png|webp)$/i, '');
    const varFile = files.find(f => f.startsWith(basePrefix) && /_variant\.(jpe?g|png|webp)$/i.test(f));

    if (!varFile) {
      console.warn(`  ⚠️ Skipping "${baseFile}": matching "_variant" image not found.`);
      continue;
    }

    const pairConfig = {
      ...config,
      base: path.join(dir, baseFile),
      variant: path.join(dir, varFile),
      id: `${config.packId}_${slugify(basePrefix)}`,
      title: basePrefix.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      publish: false // Will publish in single batch at end
    };

    try {
      const entry = await processSinglePair(pairConfig);
      ingestedEntries.push(entry);
    } catch (err) {
      console.error(`  ❌ Error processing "${basePrefix}":`, err.message);
    }
  }

  if (config.publish && ingestedEntries.length > 0) {
    await publishPackToFirestore(config.packId, config.pack, ingestedEntries);
  }

  console.log(`\n🎉 Batch ingestion complete! Ingested ${ingestedEntries.length} level pair(s).`);
}

async function main() {
  const args = parseArgs();

  console.log('================================================================================');
  console.log('⚡ SPOT THE DIFFERENCE - STREAMLINED INGESTION & PUBLISHING');
  console.log('================================================================================');

  try {
    if (args.batch) {
      await processBatchDirectory(args);
    } else if (args.base && args.variant) {
      const entry = await processSinglePair(args);
      console.log('\n🎉 Successfully processed level: ' + entry.id);
    } else {
      console.error('Error: Please provide either --base and --variant paths, or a --batch directory.');
      printHelp();
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Ingestion Failed:', err.message);
    process.exit(1);
  }
}

main();
