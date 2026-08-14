#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePhotoPairManifest } from '../src/utils/photoPairManifest.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'public/levels/photo_pair_manifest.json');

function publicAssetPath(assetPath) {
  return path.join(repoRoot, 'public', assetPath.replace(/^\/+/, ''));
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest: ${manifestPath}`);
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

try {
  const entries = readManifest();
  const result = validatePhotoPairManifest(entries);
  const missingFiles = result.validEntries
    .flatMap(entry => [entry.baseImage, entry.variantImage])
    .filter(assetPath => !fs.existsSync(publicAssetPath(assetPath)));

  result.warnings.forEach(warning => {
    console.warn(`[photo-pairs] ${warning}`);
  });

  if (result.errors.length || missingFiles.length) {
    const messages = [
      ...result.errors,
      ...missingFiles.map(assetPath => `Missing asset: ${assetPath}`)
    ];
    console.error(messages.join('\n'));
    process.exit(1);
  }

  console.log(`Validated ${result.validEntries.length} photo pair level${result.validEntries.length === 1 ? '' : 's'}.`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
