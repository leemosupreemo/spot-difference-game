import { generateProceduralLevelPair } from './proceduralGenerator.js';
import { validatePhotoPairManifest } from './photoPairManifest.js';
import photoPairManifestData from '../../public/levels/photo_pair_manifest.json';
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

export function getAllPhotoPairEntries() {
  return loadManifest();
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

export function createPhotoPairLevel(entry) {
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
    render: (ctx, width, height, isModified) => {}
  };
}

export function selectPhotoPairEntries(entries, {
  packId,
  difficulty,
  count = DEFAULT_STAGE_COUNT,
  seed = Date.now()
} = {}) {
  let matchingEntries = entries.filter(entry => {
    const packMatches = !packId || entry.packId === packId;
    const difficultyMatches = !difficulty || entry.difficulty === difficulty;
    return packMatches && difficultyMatches;
  });

  if (matchingEntries.length < count && packId) {
    matchingEntries = entries.filter(entry => !packId || entry.packId === packId);
  }

  if (matchingEntries.length === 0) {
    matchingEntries = entries;
  }

  return shuffleEntries(matchingEntries, seed).slice(0, count);
}

export async function buildPhotoPairStage({
  packId = 'find_the_sniper',
  difficulty = 'Medium',
  count = DEFAULT_STAGE_COUNT,
  seed = Date.now()
} = {}) {
  logApp('INFO', `[BuildStage] Pack: ${packId} Difficulty: ${difficulty} Seed: ${seed}`);
  try {
    const entries = loadManifest();
    if (entries && entries.length > 0) {
      const candidates = selectPhotoPairEntries(entries, { packId, difficulty, count, seed });
      const stage = [];

      for (const entry of candidates) {
        if (stage.length >= count) break;
        stage.push(createPhotoPairLevel(entry));
      }

      while (stage.length < count) {
        const procSeed = seed + stage.length * 1000;
        stage.push(generateProceduralLevelPair(packId, difficulty, procSeed));
      }

      logApp('INFO', `[BuildStageComplete] Premade levels included: ${stage.filter(s => s.baseImage).length} Total stage: ${stage.length}`);
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

export function clearPhotoPairManifestCache() {
  cachedManifestEntries = null;
}
