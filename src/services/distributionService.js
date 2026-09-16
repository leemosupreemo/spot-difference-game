/**
 * Live Bucketed Distribution & Percentile Tracking Service
 *
 * Implements atomic bucketed histogram recording in Firestore,
 * statistical log-normal CDF calibration per photo set & daily challenge,
 * linear interpolation percentile extraction, and graceful offline fallback.
 */

import { initializeApp, getApps } from 'firebase/app';
import { doc, getFirestore, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from './authService.js';
import { getDeterministicSetBaseline } from '../utils/setLeaderboards.js';
import { isScreenshotHarnessMode } from '../utils/screenshotMode.js';

/**
 * Standard histogram bucket boundaries (in milliseconds)
 * Bins:
 *   b0:  0 - 8s
 *   b1:  8 - 12s
 *   b2:  12 - 16s
 *   b3:  16 - 20s
 *   b4:  20 - 25s
 *   b5:  25 - 30s
 *   b6:  30 - 40s
 *   b7:  40 - 55s
 *   b8:  55 - 75s
 *   b9:  75 - 100s
 *   b10: 100s+
 */
export const DISTRIBUTION_BOUNDS = [
  { key: 'b0', min: 0, max: 8000, label: '0-8s' },
  { key: 'b1', min: 8000, max: 12000, label: '8-12s' },
  { key: 'b2', min: 12000, max: 16000, label: '12-16s' },
  { key: 'b3', min: 16000, max: 20000, label: '16-20s' },
  { key: 'b4', min: 20000, max: 25000, label: '20-25s' },
  { key: 'b5', min: 25000, max: 30000, label: '25-30s' },
  { key: 'b6', min: 30000, max: 40000, label: '30-40s' },
  { key: 'b7', min: 40000, max: 55000, label: '40-55s' },
  { key: 'b8', min: 55000, max: 75000, label: '55-75s' },
  { key: 'b9', min: 75000, max: 100000, label: '75-100s' },
  { key: 'b10', min: 100000, max: Infinity, label: '100s+' }
];

const STORAGE_PREFIX = 'diff_hunter_dist_';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
const memoryCache = new Map();

function getDb() {
  if (typeof window === 'undefined') return null;
  try {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    return getFirestore(app);
  } catch (err) {
    return null;
  }
}

/**
 * Returns bucket key for a given completion time.
 *
 * @param {number} elapsedTimeMs
 * @returns {string} e.g. 'b0', 'b1', ..., 'b10'
 */
export function getBucketKey(elapsedTimeMs) {
  const t = Math.max(0, Number(elapsedTimeMs) || 0);
  for (let i = 0; i < DISTRIBUTION_BOUNDS.length; i++) {
    if (t < DISTRIBUTION_BOUNDS[i].max) {
      return DISTRIBUTION_BOUNDS[i].key;
    }
  }
  return 'b10';
}

/**
 * High-precision error function approximation (Abramowitz & Stegun 7.1.26).
 * Max error < 1.5e-7.
 */
export function erf(x) {
  if (x === 0) return 0;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Normal cumulative distribution function (CDF).
 */
export function normalCdf(x, mean = 0, stdDev = 1) {
  if (stdDev <= 0) return x >= mean ? 1 : 0;
  if (x === mean) return 0.5;
  return 0.5 * (1 + erf((x - mean) / (stdDev * Math.SQRT2)));
}

/**
 * Log-Normal cumulative distribution function (CDF).
 * T ~ LogNormal(mu, sigma^2) where mu = ln(median).
 */
export function logNormalCdf(t, medianMs, sigma = 0.45) {
  if (!t || t <= 0) return 0;
  if (!medianMs || medianMs <= 0) return 0.5;
  const mu = Math.log(medianMs);
  const lnT = Math.log(t);
  return normalCdf(lnT, mu, sigma);
}

/**
 * Generates an accurate calibrated baseline percentile for a given set and time.
 * Uses the set's deterministic complexity seed and difficulty modifier.
 *
 * @param {string|null} setId
 * @param {number} elapsedTimeMs
 * @param {string} difficulty - 'Easy' | 'Medium' | 'Hard'
 * @param {boolean} isStageSet
 * @param {boolean} isDaily
 * @returns {{ topPercentile: number, beatPercentile: number, rankLabel: string }}
 */
export function getCalibratedSetPercentile(setId, elapsedTimeMs, difficulty = 'Medium', isStageSet = true, isDaily = false) {
  const safeMs = Math.max(100, Number.isFinite(elapsedTimeMs) ? elapsedTimeMs : 15000);
  const diffFactor = difficulty === 'Hard' ? 1.25 : difficulty === 'Easy' ? 0.85 : 1.0;

  let medianMs;
  let sigma;

  if (isDaily) {
    // Daily Challenge: 3 images (~12s per image median for general population)
    medianMs = 36000;
    sigma = 0.45;
  } else if (!isStageSet) {
    // Single image pair: ~5.5s median
    medianMs = 5500 * diffFactor;
    sigma = 0.55;
  } else {
    // 5-image photo set: determine median from set baseline if available
    let baseTime = 18000;
    if (setId) {
      try {
        const baseline = getDeterministicSetBaseline(setId);
        if (baseline && baseline[0]?.fastestTime) {
          baseTime = baseline[0].fastestTime;
        }
      } catch {}
    }
    // Median human time for standard players is baseTime + 5.5s
    medianMs = (baseTime + 5500) * diffFactor;
    sigma = 0.45;
  }

  const cdf = logNormalCdf(safeMs, medianMs, sigma);
  const topPercentile = Math.max(1, Math.min(99, Math.round(cdf * 100)));
  const beatPercentile = Math.max(1, Math.min(99, 100 - topPercentile));

  let rankLabel = `TOP ${topPercentile}%`;
  if (topPercentile <= 5) {
    rankLabel = `TOP ${topPercentile}% ELITE SPEED`;
  } else if (topPercentile <= 15) {
    rankLabel = `TOP ${topPercentile}% SPEED`;
  }

  return {
    topPercentile,
    beatPercentile,
    rankLabel
  };
}

/**
 * Calculates percentile from a live bucketed histogram document.
 * Uses linear interpolation across the candidate's bucket and applies
 * empirical Bayesian smoothing for small sample sizes (< 25 completions).
 *
 * @param {Object} distribution - { count: number, b0: number, ... b10: number }
 * @param {number} elapsedTimeMs
 * @param {Object|null} baselinePercentile - Fallback/prior percentile
 * @returns {{ topPercentile: number, beatPercentile: number, rankLabel: string, isLiveDistribution: boolean, sampleCount: number }}
 */
export function calculateHistogramPercentile(distribution, elapsedTimeMs, baselinePercentile = null) {
  if (!distribution || typeof distribution.count !== 'number' || distribution.count <= 0) {
    return baselinePercentile ? {
      ...baselinePercentile,
      isLiveDistribution: false,
      sampleCount: 0
    } : {
      topPercentile: 50,
      beatPercentile: 50,
      rankLabel: 'TOP 50%',
      isLiveDistribution: false,
      sampleCount: 0
    };
  }

  const count = distribution.count;
  const t = Math.max(100, Number(elapsedTimeMs) || 0);

  // Find bucket index
  let bucketIndex = DISTRIBUTION_BOUNDS.length - 1;
  for (let i = 0; i < DISTRIBUTION_BOUNDS.length; i++) {
    if (t < DISTRIBUTION_BOUNDS[i].max) {
      bucketIndex = i;
      break;
    }
  }

  // Count players strictly slower (all buckets strictly greater than current)
  let slowerCount = 0;
  for (let i = bucketIndex + 1; i < DISTRIBUTION_BOUNDS.length; i++) {
    const k = DISTRIBUTION_BOUNDS[i].key;
    slowerCount += (distribution[k] || 0);
  }

  // Linear interpolation within player's current bucket
  const currentBound = DISTRIBUTION_BOUNDS[bucketIndex];
  const bucketKey = currentBound.key;
  const bucketCount = distribution[bucketKey] || 0;
  const maxBound = Number.isFinite(currentBound.max) ? currentBound.max : currentBound.min + 60000;
  const span = Math.max(1000, maxBound - currentBound.min);
  const fracSlower = Math.max(0, Math.min(1, (maxBound - t) / span));
  slowerCount += (bucketCount * fracSlower);

  const rawBeatPercentile = Math.max(0, Math.min(100, (slowerCount / count) * 100));

  // Empirical Bayesian blending for small sample sizes to avoid erratic spikes
  let finalBeat;
  if (baselinePercentile && count < 25) {
    const alpha = Math.max(0, Math.min(1, count / 25));
    finalBeat = (1 - alpha) * baselinePercentile.beatPercentile + alpha * rawBeatPercentile;
  } else {
    finalBeat = rawBeatPercentile;
  }

  const beatPercentile = Math.max(1, Math.min(99, Math.round(finalBeat)));
  const topPercentile = Math.max(1, Math.min(99, 100 - beatPercentile));

  let rankLabel = `TOP ${topPercentile}%`;
  if (topPercentile <= 5) {
    rankLabel = `TOP ${topPercentile}% ELITE SPEED`;
  } else if (topPercentile <= 15) {
    rankLabel = `TOP ${topPercentile}% SPEED`;
  }

  return {
    topPercentile,
    beatPercentile,
    rankLabel,
    isLiveDistribution: true,
    sampleCount: count
  };
}

/**
 * Retrieves cached distribution from memory or localStorage.
 */
export function getCachedDistribution(id) {
  if (!id) return null;
  const mem = memoryCache.get(id);
  if (mem && (Date.now() - mem.timestamp < CACHE_TTL_MS)) {
    return mem.data;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
          memoryCache.set(id, parsed);
          return parsed.data;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Updates cache for a distribution.
 */
export function setCachedDistribution(id, data) {
  if (!id || !data) return;
  const entry = { data, timestamp: Date.now() };
  memoryCache.set(id, entry);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(entry));
    } catch {}
  }
}

/**
 * Fetches distribution document from Firestore with client caching.
 */
export async function fetchDistribution(collectionName, id) {
  if (!id || isScreenshotHarnessMode()) return null;
  const cached = getCachedDistribution(id);
  if (cached) return cached;

  const db = getDb();
  if (!db) return null;

  try {
    const ref = doc(db, collectionName, id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      setCachedDistribution(id, data);
      return data;
    }
  } catch (err) {
    // Graceful offline fallback
  }
  return null;
}

/**
 * Records a completion by atomically incrementing total count and corresponding bucket in Firestore.
 * Also optimistically updates the local cache.
 */
export async function recordDistributionIncrement(collectionName, id, elapsedTimeMs) {
  if (!id || typeof elapsedTimeMs !== 'number' || elapsedTimeMs <= 0 || isScreenshotHarnessMode()) return null;
  const bucketKey = getBucketKey(elapsedTimeMs);

  // Optimistic local update
  const existing = getCachedDistribution(id) || { count: 0 };
  const updated = {
    ...existing,
    count: (existing.count || 0) + 1,
    [bucketKey]: (existing[bucketKey] || 0) + 1
  };
  setCachedDistribution(id, updated);

  const db = getDb();
  if (!db) return updated;

  try {
    const ref = doc(db, collectionName, id);
    await setDoc(ref, {
      count: increment(1),
      [bucketKey]: increment(1),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return updated;
  } catch (err) {
    // Non-blocking fail silent for offline resilience
    return updated;
  }
}

/**
 * Records completion into 'set_distributions' collection.
 */
export async function recordSetCompletionDistribution(setId, elapsedTimeMs) {
  if (!setId) return null;
  return recordDistributionIncrement('set_distributions', setId, elapsedTimeMs);
}

/**
 * Fetches distribution for a photo set.
 */
export async function fetchSetDistribution(setId) {
  if (!setId) return null;
  return fetchDistribution('set_distributions', setId);
}

/**
 * Records completion into 'daily_distributions' collection.
 */
export async function recordDailyChallengeDistribution(dateStr, elapsedTimeMs) {
  if (!dateStr) return null;
  return recordDistributionIncrement('daily_distributions', dateStr, elapsedTimeMs);
}

/**
 * Fetches distribution for a daily challenge date.
 */
export async function fetchDailyDistribution(dateStr) {
  if (!dateStr) return null;
  return fetchDistribution('daily_distributions', dateStr);
}

/**
 * Unified synchronous percentile query.
 * Checks for cached live distribution first, otherwise provides calibrated baseline.
 *
 * @param {string|null} setId
 * @param {number} elapsedTimeMs
 * @param {Object} options
 * @returns {{ topPercentile: number, beatPercentile: number, rankLabel: string, isLiveDistribution: boolean, sampleCount: number }}
 */
export function getSetPercentile(setId, elapsedTimeMs, options = {}) {
  const { difficulty = 'Medium', isStageSet = true, isDaily = false } = options;
  const baseline = getCalibratedSetPercentile(setId, elapsedTimeMs, difficulty, isStageSet, isDaily);

  const dist = options.distribution || (setId ? getCachedDistribution(setId) : null);
  if (dist && dist.count > 0) {
    return calculateHistogramPercentile(dist, elapsedTimeMs, baseline);
  }

  return {
    ...baseline,
    isLiveDistribution: false,
    sampleCount: 0
  };
}
