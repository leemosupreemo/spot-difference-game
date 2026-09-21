/**
 * What this device's curation queue actually contains.
 *
 * Twice now a level has been published, reachable by every check run against
 * the live data, and still never offered for review on the device. Reasoning
 * about it from outside has failed both times: the published state, the status
 * map exported from the device and the pool ordering all said the level should
 * be served first. The missing piece is what the DEVICE sees -- its cached
 * remote levels, its own flags -- which no amount of inspecting Firestore can
 * recover.
 *
 * So the export carries it. Pure over its inputs, so it is testable and cannot
 * itself be the thing that breaks.
 */

/** A compact picture of the queue, small enough to ride along in the export. */
export function buildPoolDiagnostics({
  entries = [],
  statusMap = {},
  resolveStatus = null,
  remoteCachedCount = 0,
  bundledCount = 0,
  online = true,
  debugMode = false,
  skipKeptLevels = false,
  reviewDismissedLevels = false,
  isPlaceholder = () => false,
  sampleSize = 30
} = {}) {
  const statusOf = (entry) => {
    const resolved = resolveStatus ? resolveStatus(entry) : statusMap[entry.id];
    return typeof resolved === 'string' ? resolved : resolved?.status;
  };

  const unreviewed = [];
  const bySet = {};
  const pending = [];
  let dismissed = 0;
  let placeholders = 0;

  for (const entry of entries) {
    const setId = entry.setId || '(none)';
    bySet[setId] = (bySet[setId] || 0) + 1;
    if (isPlaceholder(entry)) { placeholders++; continue; }

    const status = statusOf(entry);
    if (status === 'dismissed') dismissed++;
    else if (!status) unreviewed.push(entry.id);

    // Levels awaiting review are the ones that keep going missing, so they are
    // listed individually rather than counted.
    if (entry.curationStatus === 'pending') {
      pending.push({ id: entry.id, setId: entry.setId || null, status: status || null });
    }
  }

  return {
    flags: { online, debugMode, skipKeptLevels, reviewDismissedLevels },
    counts: {
      entriesInPool: entries.length,
      bundledManifest: bundledCount,
      remoteCached: remoteCachedCount,
      placeholders,
      dismissed,
      unreviewed: unreviewed.length
    },
    // If a level is missing from the queue it is missing from here too, which
    // is the whole point: this is the device's answer, not the server's.
    unreviewedIds: unreviewed.slice(0, sampleSize),
    unreviewedTruncated: Math.max(0, unreviewed.length - sampleSize),
    pendingLevels: pending,
    entriesPerSet: bySet
  };
}
