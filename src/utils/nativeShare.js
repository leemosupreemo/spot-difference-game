import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import {
  generateChallengeUrl,
  generateChallengeText,
  renderChallengeCardBlob,
  recordLocalShareEvent
} from './challengeMetrics.js';
import {
  trackChallengeShareClicked,
  trackChallengeShareCompleted,
  trackChallengeShareCancelled
} from '../services/analytics.js';
import { getSavedPlayerName } from '../services/playerProgress.js';

export const isNativeSharing = () => Capacitor.isNativePlatform();

export async function shareNativeResult({ title, text, url, cardBlob }) {
  let path;
  try {
    const options = { title, text, url, dialogTitle: 'Share result' };
    if (cardBlob) {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(cardBlob);
      });
      path = `diff-hunter-result-${Date.now()}.png`;
      const file = await Filesystem.writeFile({ path, directory: Directory.Cache, data });
      options.files = [file.uri];
    }
    await Share.share(options);
    return { success: true, message: 'Shared successfully.' };
  } catch (error) {
    if (error?.name === 'AbortError' || /cancel/i.test(error?.message || '')) {
      return { success: false, cancelled: true, message: 'Share cancelled.' };
    }
    throw error;
  } finally {
    if (path) await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
  }
}

export async function shareChallengeResultDirectly({
  elapsedTime = 0,
  isPersonalBest = false,
  difficulty = 'Medium',
  themeId = 'find_the_sniper',
  levelTitle = 'Stage Set',
  levelId = ''
}) {
  const playerName = getSavedPlayerName() || 'SpeedHunter';
  const challengeUrl = generateChallengeUrl({ elapsedTimeMs: elapsedTime, playerName, difficulty, themeId, levelId });
  const shareText = generateChallengeText({ elapsedTimeMs: elapsedTime, isPersonalBest, playerName, challengeUrl });

  recordLocalShareEvent('tap');
  trackChallengeShareClicked({
    source: isPersonalBest ? 'victory_modal_pb_cta' : 'victory_modal_cta',
    elapsedTimeMs: elapsedTime,
    isPersonalBest,
    difficulty,
    themeId
  });

  let cardBlob = null;
  try {
    cardBlob = await renderChallengeCardBlob({
      elapsedTimeMs: elapsedTime,
      isPersonalBest,
      playerName,
      levelTitle
    });
  } catch (err) {
    console.warn('[shareChallengeResultDirectly] Card image render error, sharing text/link only:', err);
  }

  const result = await shareNativeResult({
    title: 'Diff Hunter Result',
    text: shareText,
    url: challengeUrl,
    cardBlob
  });

  if (result.success) {
    trackChallengeShareCompleted({
      method: 'native_share_sheet',
      elapsedTimeMs: elapsedTime,
      isPersonalBest,
      difficulty,
      themeId
    });
    recordLocalShareEvent('complete');
  } else if (result.cancelled) {
    trackChallengeShareCancelled({
      reason: 'user_cancelled',
      elapsedTimeMs: elapsedTime
    });
  }

  return result;
}
