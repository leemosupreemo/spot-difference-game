// Curation & Debug Image Approval Store
// Handles 3-way curation decisions:
// 1. 'approved' (👍 Keep in Official Set)
// 2. 'dismissed' (👎 Dismiss / Exclude)
// 3. 'wrong_difficulty' (⚠️ Keep, but wrong difficulty)

import officialCuratedData from '../../official_curated_levels.json' with { type: 'json' };
import photoPairManifestData from '../../public/levels/photo_pair_manifest.json' with { type: 'json' };
import { NEWLY_CROPPED_LEVEL_IDS } from '../data/newlyCroppedIds.js';

export function normalizeImageKey(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  const clean = pathOrUrl.split('?')[0].split('#')[0];
  const filename = clean.split('/').pop() || '';
  return filename.toLowerCase().replace(/(_base|_variant)?\.(jpe?g|png|webp)$/i, '');
}

// Build bidirectional indexes: level ID <-> image base key and image base key <-> level IDs
const ID_TO_IMAGE_KEY = new Map();
const IMAGE_KEY_TO_IDS = new Map();

if (Array.isArray(photoPairManifestData)) {
  for (const item of photoPairManifestData) {
    if (!item?.id) continue;
    const imgKey = normalizeImageKey(item.baseImage || item.variantImage || item.id);
    if (imgKey) {
      ID_TO_IMAGE_KEY.set(item.id, imgKey);
      if (!IMAGE_KEY_TO_IDS.has(imgKey)) {
        IMAGE_KEY_TO_IDS.set(imgKey, []);
      }
      IMAGE_KEY_TO_IDS.get(imgKey).push(item.id);
    }
  }
}

export function getImageKeyForLevel(levelOrId) {
  if (!levelOrId) return '';
  if (typeof levelOrId === 'string') {
    return ID_TO_IMAGE_KEY.get(levelOrId) || normalizeImageKey(levelOrId);
  }
  const fromObj = levelOrId.baseImage || levelOrId.variantImage;
  return normalizeImageKey(fromObj) || ID_TO_IMAGE_KEY.get(levelOrId.id) || normalizeImageKey(levelOrId.id);
}

export function getSiblingLevelIdsForLevel(levelOrId) {
  const key = getImageKeyForLevel(levelOrId);
  return key && IMAGE_KEY_TO_IDS.has(key) ? IMAGE_KEY_TO_IDS.get(key) : [];
}

const STORAGE_KEY = 'diff_hunter_curated_status';
const CROPPED_RESET_KEY = 'diff_hunter_cropped_43_reset_applied_v1';
const BASE_OFFICIAL_STATUS_MAP = officialCuratedData?.rawStatusMap || {};

export function getCuratedStatusMap() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    let parsed = saved ? JSON.parse(saved) : {};

    // Auto-migrate any legacy keys in parsed (e.g. from pre-photo_set naming or base image keys)
    // to match current manifest level IDs so previous ratings/categories are never lost across updates.
    let migrated = false;
    for (const [key, val] of Object.entries(parsed)) {
      const normKey = normalizeImageKey(key);
      const currentIds = IMAGE_KEY_TO_IDS.get(normKey);
      if (currentIds && currentIds.length > 0) {
        for (const currentId of currentIds) {
          if (!parsed[currentId]) {
            parsed[currentId] = val;
            migrated = true;
          }
        }
      }
    }
    if (migrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch (_) {}
    }

    return { ...BASE_OFFICIAL_STATUS_MAP, ...parsed };
  } catch (e) {
    return { ...BASE_OFFICIAL_STATUS_MAP };
  }
}

export function saveCuratedStatusMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {}
}

export function resetCuratedStatusMap() {
  const emptyMap = {};
  saveCuratedStatusMap(emptyMap);
  return emptyMap;
}

export function pruneDismissedStatuses(statusMap = {}) {
  return Object.fromEntries(
    Object.entries(statusMap).filter(([, value]) => getLevelStatus(value)?.status !== 'dismissed')
  );
}

/**
 * Set status for a level ID or entry.
 * status can be 'approved' | 'dismissed' | 'wrong_difficulty' | null (or object)
 * Syncs the status to any sibling levels sharing the same base image as well.
 */
export function setLevelCuratedStatus(levelOrId, status, meta = {}) {
  const levelId = typeof levelOrId === 'string' ? levelOrId : levelOrId?.id;
  if (!levelId) return getCuratedStatusMap();

  const current = getCuratedStatusMap();
  const existing = getLevelStatus(current[levelId]) || {};
  const siblings = getSiblingLevelIdsForLevel(levelOrId);
  const targetIds = Array.from(new Set([levelId, ...siblings]));

  for (const tid of targetIds) {
    const tidExisting = getLevelStatus(current[tid]) || existing;
    if (!status) {
      const { status: _status, ...existingMeta } = tidExisting;
      if (Object.keys(existingMeta).length > 0) current[tid] = existingMeta;
      else delete current[tid];
    } else if (typeof status === 'object') {
      current[tid] = { ...tidExisting, ...status };
    } else {
      current[tid] = {
        ...tidExisting,
        status, // 'approved' | 'dismissed' | 'wrong_difficulty'
        ...meta,
        updatedAt: new Date().toISOString()
      };
    }
  }

  saveCuratedStatusMap(current);
  return current;
}

export function applyLevelCurationMeta(statusMap = {}, levelOrId, meta = {}) {
  const levelId = typeof levelOrId === 'string' ? levelOrId : levelOrId?.id;
  if (!levelId) return statusMap;

  const existing = getLevelStatus(statusMap[levelId]) || {};
  const siblings = getSiblingLevelIdsForLevel(levelOrId);
  const targetIds = Array.from(new Set([levelId, ...siblings]));

  const updated = { ...statusMap };
  for (const tid of targetIds) {
    const tidExisting = getLevelStatus(updated[tid]) || existing;
    updated[tid] = {
      ...tidExisting,
      ...meta,
      updatedAt: new Date().toISOString()
    };
  }
  return updated;
}

export function setLevelCurationMeta(levelOrId, meta = {}) {
  const updated = applyLevelCurationMeta(getCuratedStatusMap(), levelOrId, meta);
  saveCuratedStatusMap(updated);
  return updated;
}

export function getLevelStatus(statusVal) {
  if (!statusVal) return null;
  if (typeof statusVal === 'string') return { status: statusVal };
  return statusVal;
}

/**
 * Image-aware curation status resolver.
 * Looks up direct level ID first, then falls back to any sibling sharing the same base image.
 */
export function getEntryCurationStatus(levelOrId, statusMap = getCuratedStatusMap()) {
  if (!levelOrId || !statusMap) return null;
  const levelId = typeof levelOrId === 'string' ? levelOrId : levelOrId?.id;
  
  // 1. Direct ID lookup
  if (levelId && statusMap[levelId]) {
    const direct = getLevelStatus(statusMap[levelId]);
    if (direct?.status || direct?.packId || direct?.category || direct?.difficulty || direct?.suggestedDifficulty) {
      return direct;
    }
  }

  // 2. Direct image key lookup
  const imgKey = getImageKeyForLevel(levelOrId);
  if (imgKey && statusMap[imgKey]) {
    const byKey = getLevelStatus(statusMap[imgKey]);
    if (byKey?.status || byKey?.packId || byKey?.category || byKey?.difficulty || byKey?.suggestedDifficulty) {
      return byKey;
    }
  }

  // 3. Sibling level lookup sharing the same base scene
  const siblings = getSiblingLevelIdsForLevel(levelOrId);
  for (const siblingId of siblings) {
    if (siblingId !== levelId && statusMap[siblingId]) {
      const siblingStatus = getLevelStatus(statusMap[siblingId]);
      if (siblingStatus?.status || siblingStatus?.packId || siblingStatus?.category || siblingStatus?.difficulty || siblingStatus?.suggestedDifficulty) {
        return siblingStatus;
      }
    }
  }

  // 4. Scan statusMap keys matching normalized image key (legacy IDs or variant filenames)
  if (imgKey) {
    for (const [key, val] of Object.entries(statusMap)) {
      if (key !== levelId && normalizeImageKey(key) === imgKey) {
        const legacyStatus = getLevelStatus(val);
        if (legacyStatus?.status || legacyStatus?.packId || legacyStatus?.category || legacyStatus?.difficulty || legacyStatus?.suggestedDifficulty) {
          return legacyStatus;
        }
      }
    }
  }

  return null;
}

export function createCuratedDataset(statusMap = {}, allPacks = [], exportedAt = new Date().toISOString()) {
  const approved = [];
  const dismissed = [];
  const wrongDifficulty = [];

  Object.entries(statusMap).forEach(([id, val]) => {
    const itemStatus = getLevelStatus(val);
    if (!itemStatus?.status) return;

    const match = allPacks.find(p => p.id === id);
    const itemData = {
      ...(match || { id }),
      curationMeta: itemStatus
    };

    if (itemStatus.status === 'approved') {
      approved.push(itemData);
    } else if (itemStatus.status === 'dismissed') {
      dismissed.push(itemData);
    } else if (itemStatus.status === 'wrong_difficulty') {
      wrongDifficulty.push(itemData);
    }
  });

  return {
    exportedAt,
    summary: {
      totalCurated: Object.keys(statusMap).length,
      approvedCount: approved.length,
      dismissedCount: dismissed.length,
      wrongDifficultyCount: wrongDifficulty.length
    },
    approvedLevelIds: approved.map(item => item.id),
    wrongDifficultyLevelIds: wrongDifficulty.map(item => item.id),
    dismissedLevelIds: dismissed.map(item => item.id),
    approvedLevels: approved,
    wrongDifficultyLevels: wrongDifficulty,
    dismissedLevels: dismissed,
    rawStatusMap: statusMap
  };
}

export function exportCuratedDataset(allPacks = []) {
  return createCuratedDataset(getCuratedStatusMap(), allPacks);
}

export function serializeCuratedDataset(dataset) {
  return JSON.stringify(dataset, null, 2);
}

export function downloadCuratedJSON(allPacks = [], dataset = exportCuratedDataset(allPacks)) {
  const jsonStr = serializeCuratedDataset(dataset);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `official_curated_levels_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
