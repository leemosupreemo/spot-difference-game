#!/usr/bin/env node
/**
 * Post-publish audit of everything players can actually reach.
 * ================================================================================
 * The publishing scripts each verify their own step, and that has repeatedly not
 * been enough: a superseded pack kept serving dismissed levels, a dismissed
 * placeholder silently shortened its set, and a level read from two packs was
 * allocated into two sets at once. None of those were visible in the output of
 * the script that caused them -- only in the live result afterwards.
 *
 * So this checks the published state itself, from the outside, and exits
 * non-zero when something is wrong. Run it after any publish.
 *
 *   npm run audit:levels
 *
 * The checks are pure functions over the fetched data, so they are tested
 * without a network.
 * ================================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { listCollection } from '../src/services/firestoreRest.js';
import { isPlaceholderEntry, isDailyOnlyEntry } from '../src/utils/remoteSetPolicy.js';
import { photoKeyOf, isFlipped } from '../src/utils/photoIdentity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SET_SIZE = 5;

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbX3ZqIQvcNYyI8Uy_fwN1mXtV14jt3pA',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'diff-hunter-progress-20260810'
};

const fileName = (ref) => String(ref || '').split('?')[0].split('/').pop() || '';

/** Findings are {level, check, detail}; level is 'error' or 'warning'. */
export function auditLevels({ bundled = [], remote = [], dismissedIds = new Set(),
                              hashes = new Map(), assetFiles = [] }) {
  const findings = [];
  const fail = (check, detail) => findings.push({ level: 'error', check, detail });
  const warn = (check, detail) => findings.push({ level: 'warning', check, detail });

  const all = [
    ...bundled.map(entry => ({ ...entry, pool: 'bundled' })),
    ...remote.map(entry => ({ ...entry, pool: 'remote' }))
  ];
  const playable = all.filter(entry => !isPlaceholderEntry(entry));

  // 1. One id, one level. A repeat means manifest validation silently drops
  //    entries and a set arrives short.
  const idCounts = new Map();
  for (const entry of all) idCounts.set(entry.id, (idCounts.get(entry.id) || 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) fail('duplicate-id', `${id} appears ${count} times`);
  }

  // 2. The same picture must not be published twice under different ids.
  const byVariant = new Map();
  for (const entry of playable) {
    const hash = hashes.get(fileName(entry.variantImage));
    if (!hash) continue;
    if (!byVariant.has(hash)) byVariant.set(hash, []);
    byVariant.get(hash).push(entry);
  }
  for (const group of byVariant.values()) {
    if (group.length > 1) {
      fail('duplicate-variant-image',
        `${group.length} levels share one variant image: ${group.map(e => e.id).join(', ')}`);
    }
  }

  // 3. A variant identical to its base is a puzzle with nothing to find.
  for (const entry of playable) {
    const base = hashes.get(fileName(entry.baseImage));
    const variant = hashes.get(fileName(entry.variantImage));
    if (base && variant && base === variant) {
      fail('no-difference', `${entry.id} variant is byte-identical to its base`);
    }
  }

  // 4. Dismissed levels must not be reachable.
  for (const entry of playable) {
    if (dismissedIds.has(entry.id)) {
      fail('dismissed-still-live', `${entry.id} was dismissed but is still published (${entry.pool})`);
    }
  }

  // 5. Sets must be complete, sequenced, and free of repeated photographs.
  const sets = new Map();
  for (const entry of all) {
    if (!entry.setId) continue;
    if (!sets.has(entry.setId)) sets.set(entry.setId, []);
    sets.get(entry.setId).push(entry);
  }
  for (const [setId, entries] of sets) {
    if (entries.length !== SET_SIZE) {
      fail('incomplete-set', `${setId} holds ${entries.length} entries, needs ${SET_SIZE}`);
    }
    const sequences = entries.map(e => e.sequence).sort((a, b) => a - b);
    const expected = Array.from({ length: entries.length }, (_, i) => i + 1);
    if (JSON.stringify(sequences) !== JSON.stringify(expected)) {
      fail('bad-sequence', `${setId} sequences are ${sequences.join(',')}`);
    }
    // Identity comes from the recorded photoKey, not the base slot: a flipped
    // pair holds a unique variant file there and would look like a photograph
    // of its own.
    const photos = entries.filter(e => !isPlaceholderEntry(e)).map(e => photoKeyOf(e));
    if (new Set(photos).size !== photos.length) {
      fail('repeated-photo', `${setId} shows the same photograph more than once`);
    }
  }

  // 5b. A photograph may be flipped at most once.
  //
  // Flipping swaps a pair so an `add` reads as a `remove`, which puts the
  // shared base photograph into the variant slot. Flip two levels built on one
  // photograph and both end up serving that same picture as their variant --
  // different puzzles, but the right-hand panel repeats. Capping it at one keeps
  // the duplicate-variant-image check below meaningful instead of forcing it to
  // make an exception.
  const flipsPerPhoto = new Map();
  for (const entry of playable) {
    if (!isFlipped(entry)) continue;
    const key = photoKeyOf(entry);
    if (!flipsPerPhoto.has(key)) flipsPerPhoto.set(key, []);
    flipsPerPhoto.get(key).push(entry.id);
  }
  for (const [key, ids] of flipsPerPhoto) {
    if (ids.length > 1) {
      fail('photo-flipped-twice', `${key} is flipped on ${ids.length} levels: ${ids.join(', ')}`);
    }
  }

  // 5c. Every level needs a photograph identity, or set composition is blind.
  for (const entry of playable) {
    if (!photoKeyOf(entry)) {
      fail('missing-photo-key', `${entry.id} has no photoKey and none can be derived`);
    }
  }

  // 6. A placeholder must carry no artwork, or something will try to load it.
  for (const entry of all) {
    if (!isPlaceholderEntry(entry)) continue;
    if (entry.baseImage || entry.variantImage) {
      fail('placeholder-has-artwork', `${entry.id} is a placeholder but references an image`);
    }
  }

  // 7. Daily-reserved levels must not be reachable in regular play.
  for (const entry of all) {
    if (isDailyOnlyEntry(entry) && entry.pool === 'remote') {
      warn('daily-in-remote', `${entry.id} is daily-reserved but published as a remote level`);
    }
  }

  // 8. Every playable level needs both images.
  for (const entry of playable) {
    if (!entry.baseImage || !entry.variantImage) {
      fail('missing-image-reference', `${entry.id} is missing a base or variant image`);
    }
  }

  // 9. Artwork nothing points at.
  //
  // Newly generated base images keep being dropped straight into the assets
  // directory, where they are deployed to Hosting and bundled into the app
  // without any level referencing them -- 22.6MB one batch, 11MB the one
  // before. Every other check here looks at levels that exist, so none of them
  // can see a file that belongs to no level. A warning rather than an error:
  // it is waste, not breakage, and a deploy should not fail over it.
  const referenced = new Set();
  for (const entry of all) {
    for (const ref of [entry.baseImage, entry.variantImage]) {
      const name = fileName(ref);
      if (name) referenced.add(name);
    }
  }
  const strays = assetFiles.filter(file => !referenced.has(fileName(file.name)));
  if (strays.length > 0) {
    const megabytes = strays.reduce((total, file) => total + (file.bytes || 0), 0) / 1e6;
    warn('unreferenced-asset',
      `${strays.length} file(s) in the asset directories belong to no level`
      + ` (${megabytes.toFixed(1)} MB): ${strays.slice(0, 5).map(f => f.name).join(', ')}`
      + (strays.length > 5 ? ', …' : ''));
  }

  return findings;
}

const IMAGE_SUFFIX = /\.(jpe?g|png|webp)$/i;

/** Image files present in the asset directories, with sizes. */
function listAssetFiles() {
  const files = [];
  for (const dir of [path.join(ROOT, 'public/levels'), path.join(ROOT, 'remote-levels/levels')]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      // Only artwork: the manifest and other bookkeeping live here too.
      if (!stat.isFile() || !IMAGE_SUFFIX.test(name)) continue;
      files.push({ name: path.relative(ROOT, file), bytes: stat.size });
    }
  }
  return files;
}

function hashLocalAssets() {
  const hashes = new Map();
  for (const dir of [path.join(ROOT, 'public/levels'), path.join(ROOT, 'remote-levels/levels')]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (!fs.statSync(file).isFile()) continue;
      hashes.set(name, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16));
    }
  }
  return hashes;
}

async function main() {
  const bundled = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/levels/photo_pair_manifest.json'), 'utf8'));
  const packs = await listCollection('remote_level_packs', firebaseConfig);
  const remote = packs.filter(p => p.active === true).flatMap(p => p.levels || []);

  const curated = JSON.parse(fs.readFileSync(path.join(ROOT, 'official_curated_levels.json'), 'utf8'));
  const statusOf = (value) => (typeof value === 'string' ? value : value?.status);
  const dismissedIds = new Set(Object.entries(curated.rawStatusMap || {})
    .filter(([, value]) => statusOf(value) === 'dismissed').map(([key]) => key));

  const findings = auditLevels({
    bundled, remote, dismissedIds,
    hashes: hashLocalAssets(),
    assetFiles: listAssetFiles()
  });

  console.log(`bundled ${bundled.length} · remote ${remote.length} · dismissed on record ${dismissedIds.size}`);
  const errors = findings.filter(f => f.level === 'error');
  const warnings = findings.filter(f => f.level === 'warning');
  for (const finding of [...errors, ...warnings]) {
    console.log(`  ${finding.level === 'error' ? '✗' : '!'} [${finding.check}] ${finding.detail}`);
  }
  if (errors.length === 0 && warnings.length === 0) console.log('  ✓ no problems found');
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
