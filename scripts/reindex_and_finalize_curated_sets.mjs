#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const manifestPath = path.join(projectRoot, 'public/levels/photo_pair_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const photoLevels = manifest.filter(m => m.setId && m.setId.startsWith('photo_set_'));
const dailyLevels = manifest.filter(m => !m.setId || !m.setId.startsWith('photo_set_'));

const setGroups = new Map();
for (const entry of photoLevels) {
  if (!setGroups.has(entry.setId)) setGroups.set(entry.setId, []);
  setGroups.get(entry.setId).push(entry);
}

const fullSetKeys = [];
const partialSetKeys = [];
for (const [k, v] of setGroups) {
  if (v.length === 5) fullSetKeys.push(k);
  else partialSetKeys.push(k);
}

const orderedSets = [];
for (const k of fullSetKeys) orderedSets.push(setGroups.get(k));
const partialEntries = [];
for (const k of partialSetKeys) partialEntries.push(...setGroups.get(k));
for (let i = 0; i < partialEntries.length; i += 5) {
  orderedSets.push(partialEntries.slice(i, i + 5));
}

const oldToNew = {};
const newToOld = {};
const newManifest = [];

orderedSets.forEach((set, sIdx) => {
  const setNum = sIdx + 1;
  const setId = 'photo_set_' + String(setNum).padStart(3, '0');
  set.forEach((entry, eIdx) => {
    const seq = eIdx + 1;
    const newId = setId + '_' + String(seq).padStart(2, '0');
    oldToNew[entry.id] = newId;
    newToOld[newId] = entry.id;
    newManifest.push({
      ...entry,
      id: newId,
      setId: setId,
      sequence: seq
    });
  });
});

dailyLevels.forEach(d => {
  newManifest.push({
    ...d,
    setId: null,
    sequence: null
  });
  oldToNew[d.id] = d.id;
  newToOld[d.id] = d.id;
});

// Write updated manifest
fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n', 'utf8');
console.log(`✅ Updated ${manifestPath} with ${newManifest.length} entries (${orderedSets.length} sets of 5 + ${dailyLevels.length} daily levels).`);

// Save mapping file
const mapPath = path.join(projectRoot, 'scripts/id_standardization_map.json');
fs.writeFileSync(mapPath, JSON.stringify(oldToNew, null, 2) + '\n', 'utf8');
console.log(`✅ Saved ID mapping to ${mapPath}`);

// Update official_curated_levels.json
const officialPath = path.join(projectRoot, 'official_curated_levels.json');
let officialData = {};
if (fs.existsSync(officialPath)) {
  officialData = JSON.parse(fs.readFileSync(officialPath, 'utf8'));
}

const approvedIds = newManifest.map(e => e.id);
const rawStatusMap = { ...(officialData.rawStatusMap || {}) };

approvedIds.forEach(id => {
  rawStatusMap[id] = 'approved';
});

const updatedOfficialData = {
  exportedAt: new Date().toISOString(),
  summary: {
    totalCurated: approvedIds.length + (officialData.dismissedLevelIds?.length || 0),
    approvedCount: approvedIds.length,
    dismissedCount: officialData.dismissedLevelIds?.length || 284,
    wrongDifficultyCount: 0
  },
  approvedLevelIds: approvedIds,
  dismissedLevelIds: officialData.dismissedLevelIds || [],
  rawStatusMap
};

fs.writeFileSync(officialPath, JSON.stringify(updatedOfficialData, null, 2) + '\n', 'utf8');
console.log(`✅ Updated ${officialPath} with ${approvedIds.length} approved levels.`);

// Update public/daily-queue.json
const dailyPath = path.join(projectRoot, 'public/daily-queue.json');
const dailyData = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));

const remapId = (id) => oldToNew[id] || id;

const updatedSchedule = {};
for (const [date, ids] of Object.entries(dailyData.schedule || {})) {
  const remapped = ids.map(remapId).filter(id => approvedIds.includes(id));
  if (remapped.length === 3) {
    updatedSchedule[date] = remapped;
  }
}
// Ensure 2026-09-10 has a valid set
if (!updatedSchedule['2026-09-10']) {
  updatedSchedule['2026-09-10'] = ['photo_set_001_01', 'photo_set_001_02', 'photo_set_001_03'];
}

const updatedQueue = [];
// Add modern curator set first
const modernDailyIds = ['daily_set_01_01', 'daily_set_06_01', 'daily_set_06_03'];
updatedQueue.push({
  setId: 'set_daily_modern_01',
  label: 'Curator Highlights',
  isLegacy: false,
  levels: modernDailyIds
});

for (const q of (dailyData.queue || [])) {
  if (q.setId.startsWith('set_daily_modern_')) continue; // Already replaced with approved set
  const remappedLevels = q.levels.map(remapId).filter(id => approvedIds.includes(id));
  if (remappedLevels.length === 3) {
    updatedQueue.push({
      ...q,
      levels: remappedLevels
    });
  }
}

const updatedDailyData = {
  updatedAt: new Date().toISOString(),
  schedule: updatedSchedule,
  queue: updatedQueue,
  customLevels: []
};

fs.writeFileSync(dailyPath, JSON.stringify(updatedDailyData, null, 2) + '\n', 'utf8');
console.log(`✅ Updated ${dailyPath} with ${updatedQueue.length} daily sets.`);
