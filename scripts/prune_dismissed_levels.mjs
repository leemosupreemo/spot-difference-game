#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { deleteLevelAssetsAndManifestEntries } from './curationLevelPruner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

let idsToPrune = [];
let sourceDescription = '';

function extractDismissedIds(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(data.dismissedLevelIds) && data.dismissedLevelIds.length > 0) {
      return data.dismissedLevelIds;
    }
    if (data.rawStatusMap) {
      return Object.entries(data.rawStatusMap)
        .filter(([, v]) => (typeof v === 'string' ? v : v?.status) === 'dismissed')
        .map(([k]) => k);
    }
  } catch (err) {
    console.error(`Failed to parse export file ${filePath}:`, err.message);
  }
  return [];
}

const exportArgIdx = args.indexOf('--from-export');
if (exportArgIdx !== -1 && args[exportArgIdx + 1]) {
  const exportPath = path.resolve(process.cwd(), args[exportArgIdx + 1]);
  if (!fs.existsSync(exportPath)) {
    console.error(`Export file not found: ${exportPath}`);
    process.exit(1);
  }
  idsToPrune = extractDismissedIds(exportPath);
  sourceDescription = `from specified export file (${path.basename(exportPath)})`;
} else if (args.length > 0) {
  idsToPrune = args.filter(a => !a.startsWith('--'));
  sourceDescription = `from CLI arguments`;
} else {
  // Try to find recent export files in project root or ~/Downloads
  const searchDirs = [process.cwd(), path.join(os.homedir(), 'Downloads')];
  const candidates = [];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir).filter(f => f.startsWith('official_curated_levels') && f.endsWith('.json'));
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          candidates.push({ fullPath, mtimeMs: stat.mtimeMs, file });
        }
      } catch (_) {}
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const latest = candidates[0];
    const extracted = extractDismissedIds(latest.fullPath);
    if (extracted.length > 0) {
      idsToPrune = extracted;
      sourceDescription = `from auto-detected export file (${latest.file})`;
    }
  }
}

if (idsToPrune.length === 0) {
  console.log(`
Usage:
  npm run prune:dismissed <level_id_1> <level_id_2> ...
  npm run prune:dismissed -- --from-export <path-to-curated-export.json>

Or export your curation decisions using the Export button in the app, and run:
  npm run prune:dismissed

(No dismissed level IDs were provided or found in recent export files).
`);
  process.exit(0);
}

console.log(`Found ${idsToPrune.length} dismissed level ID(s) ${sourceDescription}.`);
console.log(`Deleting image files and updating manifests...`);

const result = deleteLevelAssetsAndManifestEntries(idsToPrune, { projectRoot });

console.log(`\n✅ Prune complete!`);
console.log(`- Deleted ${result.deletedFiles.length} image files.`);
console.log(`- Removed ${result.deletedDirs.length} level folders.`);
result.manifestUpdates.forEach(u => {
  console.log(`- Updated ${u.file}: removed ${u.removed} entries (${u.remaining} remaining).`);
});
