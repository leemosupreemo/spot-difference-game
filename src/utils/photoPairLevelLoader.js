import { generateProceduralLevelPair } from './proceduralGenerator.js';
import { validatePhotoPairManifest } from './photoPairManifest.js';
import photoPairManifestData from '../../public/levels/photo_pair_manifest.json' with { type: 'json' };
import { logApp } from './logger.js';

const DEFAULT_STAGE_COUNT = 5;

let cachedManifestEntries = null;

export function resolveAssetUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  const cleanPath = url.replace(/^\/+/, '');
  return `./${cleanPath}`;
}

function makeSeededRandom(seed) {
  let state = Math.abs(Math.floor(seed || 1)) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function shuffleEntries(entries, seed) {
  const shuffled = [...entries];
  const random = makeSeededRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

import { getCuratedStatusMap, getLevelStatus } from './curationStore.js';

export function getAllPhotoPairEntries() {
  const entries = loadManifest();
  const statusMap = getCuratedStatusMap();
  return entries.filter(entry => {
    const statusVal = getLevelStatus(statusMap[entry.id])?.status;
    return statusVal !== 'dismissed';
  });
}

function loadManifest() {
  if (cachedManifestEntries) return cachedManifestEntries;

  try {
    const result = validatePhotoPairManifest(photoPairManifestData);
    if (result?.validEntries?.length > 0) {
      cachedManifestEntries = result.validEntries;
      logApp('INFO', `[ManifestLoaded] Total premade levels loaded: ${cachedManifestEntries.length}`);
      return cachedManifestEntries;
    }
  } catch (err) {
    logApp('ERROR', '[ManifestLoadError]', err?.message || err);
  }

  return [];
}

export function clearPhotoPairManifestCache() {
  cachedManifestEntries = null;
}

export function removeManifestEntriesById(ids = []) {
  const idSet = new Set(ids);
  if (cachedManifestEntries) {
    cachedManifestEntries = cachedManifestEntries.filter(entry => !idSet.has(entry.id));
  }
}

export function applyCuratedPackOverrides(entries, statusMap = {}) {
  return entries.map(entry => {
    const statusVal = getLevelStatus(statusMap[entry.id]);
    if (!statusVal) return entry;
    return {
      ...entry,
      packId: statusVal.packId || entry.packId,
      pack: statusVal.pack || entry.pack,
      category: statusVal.category || entry.category,
      difficulty: statusVal.difficulty || entry.difficulty
    };
  });
}

export function createPhotoPairLevel(entry, preloadedImages = null) {
  return {
    id: entry.id,
    title: entry.title,
    packId: entry.packId,
    category: entry.category || entry.pack,
    difficulty: entry.difficulty,
    totalDifferences: 1,
    bgGradient: ['#0b091a', '#1e1035'],
    accentColor: entry.difficulty === 'Hard' ? '#ff007f' : '#00f0ff',
    baseImage: entry.baseImage,
    variantImage: entry.variantImage,
    diffs: entry.diffs,
    render: (ctx, width, height, isModified) => {
      if (preloadedImages) {
        const img = isModified ? preloadedImages.variant : preloadedImages.base;
        if (img) ctx.drawImage(img, 0, 0, width, height);
      }
    }
  };
}

export function selectPhotoPairEntries(entries, {
  packId,
  difficulty,
  count = DEFAULT_STAGE_COUNT,
  seed = Date.now(),
  statusMap = {}
} = {}) {
  const effectiveEntries = applyCuratedPackOverrides(entries, statusMap);

  // Separate into unreviewed vs approved categories
  const unreviewedBrandNew = [];
  const unreviewedOther = [];
  const approvedMatching = [];
  const approvedOther = [];
  const otherCategorized = [];

  for (const entry of effectiveEntries) {
    const statusVal = getLevelStatus(statusMap[entry.id]);
    if (statusVal?.status === 'dismissed') continue;

    const packMatches = !packId || entry.packId === packId;
    if (!packMatches) continue;

    const isCategorized = Boolean(statusVal?.status || statusVal?.packId || statusVal?.category || statusVal?.difficulty || statusVal?.suggestedDifficulty);

    if (!isCategorized) {
      if (entry.id?.startsWith('ai_macro_') || entry.id?.includes('stock_')) {
        unreviewedBrandNew.push(entry);
      } else {
        unreviewedOther.push(entry);
      }
    } else if (statusVal?.status === 'approved') {
      const difficultyMatches = !difficulty || entry.difficulty === difficulty;
      if (difficultyMatches) {
        approvedMatching.push(entry);
      } else {
        approvedOther.push(entry);
      }
    } else if (statusVal?.status !== 'dismissed') {
      otherCategorized.push(entry);
    }
  }

  const prioritized = [
    ...unreviewedBrandNew,
    ...unreviewedOther,
    ...approvedMatching,
    ...approvedOther,
    ...otherCategorized
  ];

  return prioritized.slice(0, count);
}

export async function buildPhotoPairStage({
  packId = 'find_the_sniper',
  difficulty = 'Medium',
  count = DEFAULT_STAGE_COUNT,
  seed = Date.now(),
  fetchImpl = null,
  imageFactory = null,
  curatedStatusMap = null
} = {}) {
  logApp('INFO', `[BuildStageStart] Pack: ${packId} Difficulty: ${difficulty} Seed: ${seed}`);
  try {
    let allEntries = null;
    if (fetchImpl) {
      const resp = await fetchImpl();
      if (resp?.ok) {
        const raw = await resp.json();
        const validation = validatePhotoPairManifest(raw);
        allEntries = validation.validEntries;
      }
    }
    if (!allEntries) {
      allEntries = loadManifest();
    }
    const statusMap = curatedStatusMap || getCuratedStatusMap();
    const activeEntries = allEntries.filter(entry => {
      const statusVal = getLevelStatus(statusMap[entry.id])?.status;
      return statusVal !== 'dismissed';
    });

    logApp('INFO', `[BuildStage] Total active manifest entries: ${activeEntries.length} (from ${allEntries.length} raw entries)`);

    if (activeEntries && activeEntries.length > 0) {
      const candidates = selectPhotoPairEntries(activeEntries, { packId, difficulty, count: activeEntries.length, seed, statusMap });
      const stage = [];

      for (const entry of candidates) {
        if (stage.length >= count) break;
        if (imageFactory) {
          try {
            const baseImg = imageFactory();
            const varImg = imageFactory();
            await new Promise((resolve, reject) => {
              let loaded = 0;
              const onLoad = () => { loaded++; if (loaded === 2) resolve(); };
              baseImg.onload = onLoad;
              varImg.onload = onLoad;
              baseImg.onerror = reject;
              varImg.onerror = reject;
              baseImg.src = entry.baseImage;
              varImg.src = entry.variantImage;
            });
            stage.push(createPhotoPairLevel(entry, { base: baseImg, variant: varImg }));
          } catch (e) {
            logApp('WARN', `[BuildStage] Failed to preload images for ${entry.id}: ${e?.message}`);
            continue;
          }
        } else {
          stage.push(createPhotoPairLevel(entry));
        }
      }

      while (stage.length < count) {
        const procSeed = seed + stage.length * 1000;
        stage.push(generateProceduralLevelPair(packId, difficulty, procSeed));
      }

      logApp('INFO', `[BuildStageComplete] Stage built successfully: ${stage.map((s, idx) => `[${idx+1}]${s.id}`).join(' → ')}`);
      return stage;
    }
  } catch (err) {
    logApp('ERROR', '[buildPhotoPairStageError]', err?.message || err);
  }

  // Safe procedural fallback
  const fallbackStage = [];
  for (let i = 0; i < count; i++) {
    fallbackStage.push(generateProceduralLevelPair(packId, difficulty, seed + i * 1000));
  }
  return fallbackStage;
}
