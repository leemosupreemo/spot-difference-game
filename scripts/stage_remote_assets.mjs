#!/usr/bin/env node
/**
 * Copy remote-only level assets into the built site, for hosting only.
 *
 * Firebase Hosting serves `dist/`, and Capacitor bundles that same directory
 * into the native app. Anything under `public/` therefore ships inside the
 * binary whether the app references it or not.
 *
 * Assets that exist solely to back a Firestore remote pack live in
 * `remote-levels/` instead, outside `public/`. `vite build` never sees them, so
 * `npx cap sync` cannot bundle them; this script stages them into `dist` after
 * the build and before `firebase deploy`, so Hosting still serves them at the
 * absolute URLs the packs point at.
 *
 * Run order matters:
 *   web    : vite build -> stage_remote_assets -> firebase deploy
 *   native : vite build -> cap sync            (no staging: keeps them out)
 *
 * Usage: node scripts/stage_remote_assets.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'remote-levels');
const DIST = path.join(ROOT, 'dist');

/** Every file under `dir`, as paths relative to it. */
export function collectFiles(dir, base = dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(abs, base, found);
    else found.push(path.relative(base, abs));
  }
  return found;
}

/**
 * Staging must never shadow a file the app itself ships -- that would let a
 * remote-only copy silently replace bundled artwork.
 */
export function findCollisions(relativeFiles, exists) {
  return relativeFiles.filter(rel => exists(rel));
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const files = collectFiles(SOURCE);

  if (!fs.existsSync(DIST)) {
    console.error('dist/ not found -- run `vite build` first.');
    process.exit(1);
  }
  if (files.length === 0) {
    console.log('No remote-only assets to stage.');
    return;
  }

  const collisions = findCollisions(files, rel => fs.existsSync(path.join(DIST, rel)));
  if (collisions.length > 0) {
    console.error(`Refusing to stage: ${collisions.length} file(s) already exist in dist/ and would be overwritten:`);
    collisions.slice(0, 10).forEach(c => console.error(`  ${c}`));
    process.exit(1);
  }

  if (checkOnly) {
    console.log(`${files.length} remote-only asset(s) ready to stage; no collisions.`);
    return;
  }

  let bytes = 0;
  for (const rel of files) {
    const dest = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(SOURCE, rel), dest);
    bytes += fs.statSync(dest).size;
  }
  console.log(`Staged ${files.length} remote-only asset(s) into dist/ (${(bytes / 1e6).toFixed(1)} MB).`);
  console.log('These are served by Hosting and are NOT in the native bundle.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
