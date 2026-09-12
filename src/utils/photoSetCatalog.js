function isAssignedEntry(entry) {
  return entry
    && typeof entry === 'object'
    && typeof entry.setId === 'string'
    && entry.setId.trim().length > 0
    && Number.isInteger(entry.sequence)
    && entry.sequence > 0;
}

function assertValidSetSize(setSize) {
  if (!Number.isInteger(setSize) || setSize < 1) {
    throw new RangeError('setSize must be a positive integer.');
  }
}

export function getPhotoSetCatalog(entries, { setSize = 5 } = {}) {
  assertValidSetSize(setSize);

  const groupedEntries = new Map();
  const unassigned = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!isAssignedEntry(entry)) {
      unassigned.push(entry);
      continue;
    }

    const setEntries = groupedEntries.get(entry.setId) || [];
    setEntries.push(entry);
    groupedEntries.set(entry.setId, setEntries);
  }

  const sets = Array.from(groupedEntries, ([setId, setEntries]) => ({
    setId,
    entries: [...setEntries].sort((left, right) => (
      left.sequence - right.sequence
      || String(left.id || '').localeCompare(String(right.id || ''))
    ))
  }));

  return { sets, unassigned };
}

export function getCompletePhotoSets(entries, setSize = 5) {
  const { sets } = getPhotoSetCatalog(entries, { setSize });
  return sets.filter(set => set.entries.length === setSize);
}
