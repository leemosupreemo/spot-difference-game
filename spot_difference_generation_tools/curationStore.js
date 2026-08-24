// Curation & Debug Image Approval Store
// Handles 3-way curation decisions:
// 1. 'approved' (👍 Keep in Official Set)
// 2. 'dismissed' (👎 Dismiss / Exclude)
// 3. 'wrong_difficulty' (⚠️ Keep, but wrong difficulty)

import officialCuratedData from '../../official_curated_levels.json' with { type: 'json' };

const STORAGE_KEY = 'diff_hunter_curated_status';
const BASE_OFFICIAL_STATUS_MAP = officialCuratedData?.rawStatusMap || {};

export function getCuratedStatusMap() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
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
 * Set status for a level ID.
 * status can be 'approved' | 'dismissed' | 'wrong_difficulty' | null (or object)
 */
export function setLevelCuratedStatus(levelId, status, meta = {}) {
  const current = getCuratedStatusMap();
  const existing = getLevelStatus(current[levelId]) || {};

  if (!status) {
    const { status: _status, ...existingMeta } = existing;
    if (Object.keys(existingMeta).length > 0) current[levelId] = existingMeta;
    else delete current[levelId];
  } else if (typeof status === 'object') {
    current[levelId] = { ...existing, ...status };
  } else {
    current[levelId] = {
      ...existing,
      status, // 'approved' | 'dismissed' | 'wrong_difficulty'
      ...meta,
      updatedAt: new Date().toISOString()
    };
  }
  saveCuratedStatusMap(current);
  return current;
}

export function applyLevelCurationMeta(statusMap = {}, levelId, meta = {}) {
  const existing = getLevelStatus(statusMap[levelId]) || {};
  return {
    ...statusMap,
    [levelId]: {
      ...existing,
      ...meta,
      updatedAt: new Date().toISOString()
    }
  };
}

export function setLevelCurationMeta(levelId, meta = {}) {
  const updated = applyLevelCurationMeta(getCuratedStatusMap(), levelId, meta);
  saveCuratedStatusMap(updated);
  return updated;
}

export function getLevelStatus(statusVal) {
  if (!statusVal) return null;
  if (typeof statusVal === 'string') return { status: statusVal };
  return statusVal;
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
