/**
 * Challenge a Friend & PLG Virality Utility
 *
 * Implements percentile benchmarking, personal best triggers,
 * viral challenge copy generation, universal link creation, and canvas card rendering.
 */

import { getAppStoreReviewUrl } from '../services/appConfig.js';
import { getSavedPlayerName } from '../services/playerProgress.js';

const STORAGE_KEY_BEST_TIMES = 'diff_hunter_best_times';
const STORAGE_KEY_SHARE_STATS = 'diff_hunter_share_stats';

/**
 * Calculates percentile rank based on reaction time.
 * Calibrated for Diff Hunter timed spot-the-difference gameplay.
 *
 * @param {number} elapsedTimeMs - Completion time in milliseconds.
 * @param {string} difficulty - 'Easy' | 'Medium' | 'Hard'
 * @param {boolean} isStageSet - True if 5-image stage cumulative time, False if single pair
 * @returns {{ topPercentile: number, beatPercentile: number, rankLabel: string }}
 */
export function calculatePercentileRank(elapsedTimeMs, difficulty = 'Medium', isStageSet = false) {
  const safeMs = Math.max(100, Number.isFinite(elapsedTimeMs) ? elapsedTimeMs : 5000);

  // Difficulty adjustment factor (Hard takes longer, Easy is faster)
  const diffFactor = difficulty === 'Hard' ? 1.3 : difficulty === 'Easy' ? 0.8 : 1.0;
  const effectiveMs = safeMs / diffFactor;

  let topPercentile;

  if (isStageSet) {
    // 5-Image Stage Cumulative Time (Range: ~8s to 60s+)
    if (effectiveMs <= 10000) {
      topPercentile = 2;
    } else if (effectiveMs <= 14000) {
      topPercentile = 5;
    } else if (effectiveMs <= 18000) {
      topPercentile = 9;
    } else if (effectiveMs <= 23000) {
      topPercentile = 16;
    } else if (effectiveMs <= 30000) {
      topPercentile = 28;
    } else if (effectiveMs <= 40000) {
      topPercentile = 45;
    } else if (effectiveMs <= 55000) {
      topPercentile = 65;
    } else if (effectiveMs <= 75000) {
      topPercentile = 80;
    } else {
      topPercentile = Math.min(99, Math.round(80 + (effectiveMs - 75000) / 5000));
    }
  } else {
    // Single Image Pair Time (Range: ~1.2s to 25s+)
    if (effectiveMs <= 1500) {
      topPercentile = 1;
    } else if (effectiveMs <= 1900) {
      topPercentile = 3;
    } else if (effectiveMs <= 2400) {
      topPercentile = 6;
    } else if (effectiveMs <= 2800) {
      topPercentile = 10;
    } else if (effectiveMs <= 3500) {
      topPercentile = 18;
    } else if (effectiveMs <= 4500) {
      topPercentile = 29;
    } else if (effectiveMs <= 6000) {
      topPercentile = 42;
    } else if (effectiveMs <= 8000) {
      topPercentile = 58;
    } else if (effectiveMs <= 11000) {
      topPercentile = 74;
    } else if (effectiveMs <= 15000) {
      topPercentile = 85;
    } else {
      topPercentile = Math.min(99, Math.round(85 + (effectiveMs - 15000) / 2000));
    }
  }

  topPercentile = Math.max(1, Math.min(99, topPercentile));
  const beatPercentile = Math.max(1, 100 - topPercentile);

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
 * Checks if the elapsed time sets a new personal record and persists it.
 *
 * @param {number} elapsedTimeMs
 * @param {string} difficulty
 * @param {string} themeId
 * @param {boolean} isStage
 * @returns {{ isPersonalBest: boolean, previousBestMs: number | null }}
 */
export function checkAndUpdatePersonalBest(elapsedTimeMs, difficulty = 'Medium', themeId = 'find_the_sniper', isStage = false) {
  if (!elapsedTimeMs || elapsedTimeMs <= 0) {
    return { isPersonalBest: false, previousBestMs: null };
  }

  const key = `${isStage ? 'stage' : 'single'}_${difficulty}_${themeId}`;

  let bests = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_BEST_TIMES);
      if (stored) bests = JSON.parse(stored);
    }
  } catch {}

  const previousBestMs = bests[key] || null;
  const isPersonalBest = !previousBestMs || elapsedTimeMs < previousBestMs;

  if (isPersonalBest) {
    bests[key] = elapsedTimeMs;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_BEST_TIMES, JSON.stringify(bests));
      }
    } catch {}
  }

  return { isPersonalBest, previousBestMs };
}

/**
 * Retrieves local share statistics and share rate.
 */
export function getShareStats() {
  let stats = { resultViews: 0, shareTaps: 0, sharesCompleted: 0 };
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_SHARE_STATS);
      if (stored) stats = { ...stats, ...JSON.parse(stored) };
    }
  } catch {}

  const shareRate = stats.resultViews > 0
    ? Number((stats.sharesCompleted / stats.resultViews).toFixed(3))
    : 0;

  return { ...stats, shareRate };
}

/**
 * Records a share funnel event in local storage.
 *
 * @param {'view' | 'tap' | 'complete'} action
 */
export function recordLocalShareEvent(action) {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getShareStats();
    if (action === 'view') current.resultViews += 1;
    else if (action === 'tap') current.shareTaps += 1;
    else if (action === 'complete') current.sharesCompleted += 1;

    localStorage.setItem(STORAGE_KEY_SHARE_STATS, JSON.stringify({
      resultViews: current.resultViews,
      shareTaps: current.shareTaps,
      sharesCompleted: current.sharesCompleted
    }));
  } catch {}
}

/**
 * Generates universal challenge / deep link URL.
 */
export function generateChallengeUrl({ elapsedTimeMs, playerName, difficulty = 'Medium', themeId = 'find_the_sniper', levelId = '' }) {
  const seconds = (Math.max(0, elapsedTimeMs) / 1000).toFixed(2);
  const name = playerName || getSavedPlayerName() || 'Player';

  try {
    const candidate = new URL(typeof window !== 'undefined' ? window.location?.origin || 'https://diffhunter.web.app' : 'https://diffhunter.web.app');
    const publicHost = candidate.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(candidate.hostname) && !candidate.hostname.endsWith('.local');
    const url = new URL(publicHost ? candidate.origin : 'https://diffhunter.web.app');
    url.searchParams.set('challenge', '1');
    url.searchParams.set('challenger', name);
    url.searchParams.set('time', seconds);
    url.searchParams.set('diff', difficulty);
    url.searchParams.set('theme', themeId);
    if (levelId) url.searchParams.set('levelId', levelId);

    return url.toString();
  } catch {
    const url = new URL('https://diffhunter.web.app');
    url.search = new URLSearchParams({ challenge: '1', time: seconds, challenger: name, diff: difficulty, theme: themeId, ...(levelId ? { levelId } : {}) }).toString();
    return url.toString();
  }
}

/**
 * Generates viral challenge text copy for iMessage / SMS / Social.
 */
export function generateChallengeText({ elapsedTimeMs, beatPercentile = 93, topPercentile, isPersonalBest = false, playerName = '', challengeUrl = '' }) {
  const seconds = (Math.max(0, elapsedTimeMs) / 1000).toFixed(2);
  const name = playerName || getSavedPlayerName() || 'I';
  const url = challengeUrl || getAppStoreReviewUrl();
  const topPct = topPercentile || Math.max(1, 100 - beatPercentile);

  const pbLine = isPersonalBest ? '🏆 NEW PERSONAL BEST!\n' : '';

  return (
    `I spotted it in ${seconds} seconds.\n` +
    `Top ${topPct}%\n` +
    `${pbLine}` +
    `⚡ ${name === 'I' ? 'I' : name} beat ${beatPercentile}% of Diff Hunter players.\n` +
    `There is ONE difference. Spot it before time runs out!\n\n` +
    `👉 Play the challenge: ${url}`
  );
}

/**
 * Generates clean Result Card text copy:
 * "I spotted it in X.XX seconds.
 *  Top X%
 *  Ready to share."
 */
export function generateResultCardText({ elapsedTimeMs, topPercentile = 7, challengeUrl = '' }) {
  const seconds = (Math.max(0, elapsedTimeMs) / 1000).toFixed(2);
  const safeTop = typeof topPercentile === 'number' && !isNaN(topPercentile) ? topPercentile : 7;
  const urlSuffix = challengeUrl ? `\n\n👉 Challenge: ${challengeUrl}` : '';
  return `I spotted it in ${seconds} seconds.\nTop ${safeTop}%${urlSuffix}`;
}

/**
 * Direct platform sharing helper for:
 * text / TikTok / Instagram / etc.
 *
 * @param {object} options
 * @param {'text' | 'tiktok' | 'instagram' | 'more' | 'copy'} options.platform
 * @param {number} options.elapsedTimeMs
 * @param {number} options.topPercentile
 * @param {number} options.beatPercentile
 * @param {boolean} options.isPersonalBest
 * @param {Blob} [options.cardBlob]
 * @param {string} [options.challengeUrl]
 * @param {string} [options.playerName]
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function shareToPlatform({
  platform,
  elapsedTimeMs,
  topPercentile = 7,
  beatPercentile = 93,
  isPersonalBest = false,
  cardBlob = null,
  challengeUrl = '',
  playerName = ''
}) {
  const seconds = (Math.max(0, elapsedTimeMs) / 1000).toFixed(2);
  const url = challengeUrl || (typeof window !== 'undefined' ? window.location?.origin : '') || getAppStoreReviewUrl();
  const shareText = generateResultCardText({ elapsedTimeMs, topPercentile, challengeUrl: url });

  recordLocalShareEvent('tap');

  if (platform === 'text') {
    // 1. Mobile / Web SMS
    const encodedBody = encodeURIComponent(shareText);
    const smsUri = `sms:?&body=${encodedBody}`;

    if (typeof navigator !== 'undefined' && navigator.share && !cardBlob) {
      try {
        await navigator.share({
          title: `Diff Hunter Challenge (${seconds}s)`,
          text: shareText
        });
        recordLocalShareEvent('complete');
        return { success: true, message: 'Shared via text! 💬' };
      } catch (err) {
        if (err?.name === 'AbortError') return { success: false, message: 'Share cancelled' };
      }
    }

    try {
      if (typeof window !== 'undefined') {
        window.location.href = smsUri;
        recordLocalShareEvent('complete');
        return { success: true, message: 'Opening Messages... 💬' };
      }
    } catch (_) {}

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        recordLocalShareEvent('complete');
        return { success: true, message: 'Text copied to clipboard! 💬' };
      }
    } catch (_) {}

    return { success: true, message: 'Text ready to share! 💬' };
  }

  if (platform === 'tiktok') {
    // Copy text & try native file share or open TikTok
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      }
    } catch (_) {}

    if (cardBlob && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [new File([cardBlob], 'diff_hunter_result.png', { type: 'image/png' })] })) {
      try {
        const file = new File([cardBlob], 'diff_hunter_result.png', { type: 'image/png' });
        await navigator.share({
          title: 'Diff Hunter Result',
          text: shareText,
          files: [file]
        });
        recordLocalShareEvent('complete');
        return { success: true, message: 'Shared to TikTok! 🎵' };
      } catch (err) {
        if (err?.name === 'AbortError') return { success: false, message: 'Share cancelled' };
      }
    }

    if (typeof window !== 'undefined') {
      window.open('https://www.tiktok.com/', '_blank');
    }
    recordLocalShareEvent('complete');
    return { success: true, message: 'Result copied! Opening TikTok 🎵' };
  }

  if (platform === 'instagram') {
    // Copy text & try native file share or open Instagram
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      }
    } catch (_) {}

    if (cardBlob && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [new File([cardBlob], 'diff_hunter_result.png', { type: 'image/png' })] })) {
      try {
        const file = new File([cardBlob], 'diff_hunter_result.png', { type: 'image/png' });
        await navigator.share({
          title: 'Diff Hunter Result',
          files: [file]
        });
        recordLocalShareEvent('complete');
        return { success: true, message: 'Shared to Instagram! 📸' };
      } catch (err) {
        if (err?.name === 'AbortError') return { success: false, message: 'Share cancelled' };
      }
    }

    if (typeof window !== 'undefined') {
      window.open('https://www.instagram.com/', '_blank');
    }
    recordLocalShareEvent('complete');
    return { success: true, message: 'Result copied! Opening Instagram 📸' };
  }

  // etc. / more / system share sheet
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const sharePayload = {
        title: `Diff Hunter Result (${seconds}s)`,
        text: shareText,
        url: url
      };
      if (cardBlob && navigator.canShare && navigator.canShare({ files: [new File([cardBlob], 'diff_hunter_result.png', { type: 'image/png' })] })) {
        sharePayload.files = [new File([cardBlob], 'diff_hunter_result.png', { type: 'image/png' })];
      }
      await navigator.share(sharePayload);
      recordLocalShareEvent('complete');
      return { success: true, message: 'Shared successfully! 🚀' };
    } catch (err) {
      if (err?.name === 'AbortError') return { success: false, message: 'Share cancelled' };
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      recordLocalShareEvent('complete');
      return { success: true, message: 'Result copied to clipboard! 🚀' };
    }
  } catch (_) {}

  return { success: true, message: 'Result ready! 🚀' };
}

/**
 * Parses incoming challenge query params from URL.
 */
export function parseIncomingChallenge(searchParamsOrString) {
  try {
    let params;
    if (typeof searchParamsOrString === 'string') {
      params = new URLSearchParams(searchParamsOrString.startsWith('?') ? searchParamsOrString : `?${searchParamsOrString}`);
    } else if (searchParamsOrString instanceof URLSearchParams) {
      params = searchParamsOrString;
    } else if (typeof window !== 'undefined' && window.location?.search) {
      params = new URLSearchParams(window.location.search);
    } else {
      return null;
    }

    const hasChallenge = params.get('challenge') === '1' || params.has('challenger') || params.has('time');
    if (!hasChallenge) return null;

    const challengerName = params.get('challenger') || 'A Friend';
    const targetTimeSec = parseFloat(params.get('time')) || 3.0;
    const targetTimeMs = Math.round(targetTimeSec * 1000);
    const difficulty = params.get('diff') || 'Medium';
    const themeId = params.get('theme') || 'find_the_sniper';
    const levelId = params.get('levelId') || null;

    return {
      isChallenge: true,
      challengerName,
      targetTimeSec,
      targetTimeMs,
      difficulty,
      themeId,
      levelId
    };
  } catch {
    return null;
  }
}

/**
 * Renders a high-resolution 1080x1080 visual result card on an HTML5 canvas
 * and returns it as a PNG Blob.
 *
 * @returns {Promise<Blob | null>}
 */
export async function renderChallengeCardBlob({
  elapsedTimeMs = 2430,
  beatPercentile = 93,
  topPercentile = 7,
  isPersonalBest = false,
  playerName = 'SpeedHunter',
  levelTitle = 'Photography Stage'
}) {
  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const seconds = (Math.max(0, elapsedTimeMs) / 1000).toFixed(2);

    // 1. Dark Futuristic Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, '#0a0d14');
    bgGrad.addColorStop(0.5, '#05070b');
    bgGrad.addColorStop(1, '#020305');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // 2. Cyan & Gold Neon Ambient Circles
    const glow1 = ctx.createRadialGradient(240, 240, 10, 240, 240, 420);
    glow1.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
    glow1.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 1080, 1080);

    const glow2 = ctx.createRadialGradient(840, 840, 10, 840, 840, 480);
    glow2.addColorStop(0, 'rgba(255, 183, 3, 0.18)');
    glow2.addColorStop(1, 'rgba(255, 183, 3, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, 1080, 1080);

    // 3. Card Outer Border with Glass Panel
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 6;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    roundRect(ctx, 60, 60, 960, 960, 44);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 4. Header Badge / Game Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.letterSpacing = '4px';
    ctx.fillText('DIFF HUNTER • SPOT THE DIFFERENCE', 540, 150);

    // 5. Salient Achievement Banner
    if (isPersonalBest) {
      ctx.fillStyle = '#ffb703';
      ctx.font = '900 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('🏆 NEW PERSONAL BEST', 540, 230);
    } else {
      ctx.fillStyle = '#00f0ff';
      ctx.font = '800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(levelTitle.toUpperCase(), 540, 230);
    }

    // 6. Result Card Primary Lines:
    // Line 1: "I spotted it in X.XX seconds."
    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';
    ctx.shadowBlur = 20;
    ctx.fillText(`I spotted it in ${seconds} seconds.`, 540, 420);
    ctx.shadowBlur = 0;

    // Line 2: "Top X%" Pill Badge
    const pillWidth = 340;
    const pillHeight = 84;
    const pillX = 540 - pillWidth / 2;
    const pillY = 480;
    ctx.fillStyle = 'rgba(255, 183, 3, 0.22)';
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 4;
    roundRect(ctx, pillX, pillY, pillWidth, pillHeight, 42);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffb703';
    ctx.font = '900 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Top ${topPercentile}%`, 540, pillY + 58);

    // Additional viral prompt
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('There is ONE difference. Spot it before time runs out!', 540, 740);

    // 10. Player & App Store Branding Footer
    ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
    ctx.font = '700 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Challenger: ${playerName}`, 540, 890);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Coming Soon to iPhone • Diff Hunter', 540, 940);
    ctx.restore();

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  } catch (err) {
    console.warn('[renderChallengeCardBlob] Canvas generation error:', err);
    return null;
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
