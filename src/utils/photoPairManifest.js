export const PUBLIC_LEVEL_PREFIX = '/levels/photo-pairs/';

const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFinitePercent(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function isPositiveRadius(value) {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

function isAssetPath(value) {
  return isNonEmptyString(value)
    && (value.startsWith('/levels/photo-pairs/') || value.startsWith('levels/photo-pairs/'))
    && /\.(avif|jpe?g|png|webp)$/i.test(value);
}

function isValidDiff(diff) {
  if (!diff || typeof diff !== 'object') return false;
  if (!isNonEmptyString(String(diff.id))) return false;
  if (!isFinitePercent(diff.x) || !isFinitePercent(diff.y)) return false;
  return isPositiveRadius(diff.radius);
}

export function isValidPhotoPairEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!isNonEmptyString(entry.id)) return false;
  if (!isNonEmptyString(entry.title)) return false;
  if (!isNonEmptyString(entry.pack)) return false;
  if (!isNonEmptyString(entry.packId)) return false;
  if (!DIFFICULTIES.has(entry.difficulty)) return false;
  if (!isAssetPath(entry.baseImage) || !isAssetPath(entry.variantImage)) return false;
  if (!Array.isArray(entry.diffs) || entry.diffs.length !== 1) return false;
  return isValidDiff(entry.diffs[0]);
}

export function validatePhotoPairManifest(entries) {
  const validEntries = [];
  const errors = [];
  const warnings = [];

  if (!Array.isArray(entries)) {
    return { validEntries, errors: ['Manifest must be an array.'], warnings };
  }

  const seenIds = new Set();

  entries.forEach((entry, index) => {
    const entryLabel = `Entry ${index + 1}`;

    if (!isValidPhotoPairEntry(entry)) {
      errors.push(`${entryLabel} is not a valid photo pair level.`);
      return;
    }

    if (seenIds.has(entry.id)) {
      errors.push(`${entryLabel} duplicates level id "${entry.id}".`);
      return;
    }

    seenIds.add(entry.id);
    validEntries.push(entry);
  });

  const counts = new Map();
  validEntries.forEach(entry => {
    const key = entry.packId;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  counts.forEach((count, key) => {
    if (count < 5) {
      warnings.push(`${key} has ${count} level${count === 1 ? '' : 's'}; five are needed for a full photo-only stage.`);
    }
  });

  return { validEntries, errors, warnings };
}
