import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, setDoc, collection, getDocs, getDoc } from 'firebase/firestore';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSy_thirteen_a5760_web_key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'thirteen-a5760.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'thirteen-a5760',
  appId: env.VITE_FIREBASE_APP_ID || '1:396835359318:web:diffhunter'
};

function isConfigured() {
  return Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
}

let playerPromise;

async function getPlayer() {
  if (!isConfigured()) return null;
  if (!playerPromise) {
    playerPromise = (async () => {
      try {
        const app = getApps()[0] || initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
        return { uid: credential.user.uid, db: getFirestore(app) };
      } catch (err) {
        console.warn('Firebase initialization warning:', err?.message || err);
        return null;
      }
    })();
  }
  return playerPromise;
}

let inMemoryPlayerName = 'SpeedHunter';

export function getSavedPlayerName() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      return localStorage.getItem('diff_hunter_player_name') || inMemoryPlayerName;
    }
    return inMemoryPlayerName;
  } catch (_) {
    return inMemoryPlayerName;
  }
}

export function savePlayerName(name) {
  const trimmed = name ? name.trim() : '';
  const finalName = trimmed || 'SpeedHunter';
  inMemoryPlayerName = finalName;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem('diff_hunter_player_name', finalName);
    }
  } catch (_) {}
  return finalName;
}

export function computeLeaderboardPayload(difficultyStats, playerName) {
  const avgFirstTimeByDifficulty = {};
  const avgRepeatTimeByDifficulty = {};

  const avgFirstTimeByPack = {};
  const avgRepeatTimeByPack = {};

  let totalSetsCleared = 0;

  const packFirstSums = {};
  const packFirstCounts = {};
  const packRepeatSums = {};
  const packRepeatCounts = {};

  const categoryKeys = Object.keys(difficultyStats || {});
  const categories = categoryKeys.length > 0 ? categoryKeys : ['Easy', 'Medium', 'Hard', 'All'];

  categories.forEach(diff => {
    const sets = difficultyStats?.[diff]?.sets || {};
    const setEntries = Object.values(sets);

    let firstSum = 0;
    let firstCount = 0;
    let repeatSum = 0;
    let repeatCount = 0;

    setEntries.forEach(setRecord => {
      const packId = setRecord.packId || 'find_the_sniper';
      let setCleared = false;

      if (typeof setRecord.firstTime === 'number' && setRecord.firstTime > 0) {
        firstSum += setRecord.firstTime;
        firstCount += 1;
        setCleared = true;

        if (!packFirstSums[packId]) { packFirstSums[packId] = 0; packFirstCounts[packId] = 0; }
        packFirstSums[packId] += setRecord.firstTime;
        packFirstCounts[packId] += 1;
      }

      const repeatTime = setRecord.fastestRepeat || setRecord.bestCleanTime || setRecord.firstTime;
      if (typeof repeatTime === 'number' && repeatTime > 0) {
        repeatSum += repeatTime;
        repeatCount += 1;
        setCleared = true;

        if (!packRepeatSums[packId]) { packRepeatSums[packId] = 0; packRepeatCounts[packId] = 0; }
        packRepeatSums[packId] += repeatTime;
        packRepeatCounts[packId] += 1;
      }

      if (setCleared) {
        totalSetsCleared += 1;
      }
    });

    avgFirstTimeByDifficulty[diff] = firstCount > 0 ? Math.round(firstSum / firstCount) : null;
    avgRepeatTimeByDifficulty[diff] = repeatCount > 0 ? Math.round(repeatSum / repeatCount) : null;
  });

  const allPacks = new Set([...Object.keys(packFirstSums), ...Object.keys(packRepeatSums)]);
  allPacks.forEach(packId => {
    avgFirstTimeByPack[packId] = packFirstCounts[packId] > 0 ? Math.round(packFirstSums[packId] / packFirstCounts[packId]) : null;
    avgRepeatTimeByPack[packId] = packRepeatCounts[packId] > 0 ? Math.round(packRepeatSums[packId] / packRepeatCounts[packId]) : null;
  });

  return {
    playerName: playerName || getSavedPlayerName(),
    avgFirstTimeByDifficulty,
    avgRepeatTimeByDifficulty,
    avgFirstTimeByPack,
    avgRepeatTimeByPack,
    // Backwards-compatible aliases
    avgTimesByDifficulty: avgRepeatTimeByDifficulty,
    avgTimesByPack: avgRepeatTimeByPack,
    totalSetsCleared,
    updatedAt: new Date().toISOString()
  };
}

export async function fetchPlayerImageHistory() {
  const player = await getPlayer();
  if (!player) return {};

  try {
    const snap = await getDocs(collection(player.db, 'players', player.uid, 'images'));
    const history = {};
    snap.forEach(docSnap => {
      history[docSnap.id] = docSnap.data();
    });
    return history;
  } catch (e) {
    console.warn('Could not fetch Firestore image history:', e);
    return {};
  }
}

export async function isImageSeenInFirestore(imageId) {
  const player = await getPlayer();
  if (!player) return false;

  try {
    const docSnap = await getDoc(doc(player.db, 'players', player.uid, 'images', imageId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return !!(data.firstSeenTimeMs || (data.clears && data.clears > 0));
    }
    return false;
  } catch (_) {
    return false;
  }
}

export async function syncProgressFromFirestore(localStats = {}) {
  const history = await fetchPlayerImageHistory();
  const imageIds = Object.keys(history);

  if (imageIds.length === 0) return localStats;

  const mergedStats = { ...localStats };

  ['Easy', 'Medium', 'Hard', 'All'].forEach(diff => {
    if (!mergedStats[diff]) {
      mergedStats[diff] = { setsCleared: 0, sets: {} };
    }
    const currentSets = { ...mergedStats[diff].sets };

    imageIds.forEach(imageId => {
      const remoteData = history[imageId];
      const existing = currentSets[imageId] || {};

      const firstTime = existing.firstTime || remoteData.firstSeenTimeMs || null;
      const fastestRepeat = existing.fastestRepeat || remoteData.bestRepeatTimeMs || firstTime;

      currentSets[imageId] = {
        title: existing.title || remoteData.title || imageId,
        packId: existing.packId || remoteData.packId || 'find_the_sniper',
        firstTime,
        fastestRepeat,
        bestCleanTime: existing.bestCleanTime || null,
        bestFaultedTime: existing.bestFaultedTime || null,
        clears: Math.max(existing.clears || 0, remoteData.clears || 1)
      };
    });

    const setEntries = Object.values(currentSets);
    const allFirstTimes = setEntries.map(s => s.firstTime).filter(Boolean);
    const allRepeats = setEntries.map(s => s.fastestRepeat).filter(Boolean);

    mergedStats[diff] = {
      ...mergedStats[diff],
      setsCleared: setEntries.length,
      fastestFirstTimeOverall: allFirstTimes.length > 0 ? Math.min(...allFirstTimes) : null,
      fastestRepeatOverall: allRepeats.length > 0 ? Math.min(...allRepeats) : null,
      sets: currentSets
    };
  });

  try {
    localStorage.setItem('diff_hunter_categorized_stats', JSON.stringify(mergedStats));
  } catch (_) {}

  return mergedStats;
}

export async function saveImageProgress({ imageId, packId, title, completionTimeMs, isFirstSeen, clears }) {
  const player = await getPlayer();
  if (!player) return false;

  const docRef = doc(player.db, 'players', player.uid, 'images', imageId);

  try {
    const existingDoc = await getDoc(docRef);
    const alreadySeenInCloud = existingDoc.exists() && !!existingDoc.data()?.firstSeenTimeMs;

    // Anti-Tamper Protection: If image record exists in Firestore, never mark as firstSeen!
    const effectiveIsFirstSeen = isFirstSeen && !alreadySeenInCloud;

    const payload = {
      imageId,
      packId,
      title,
      clears: Math.max(clears || 1, (existingDoc.data()?.clears || 0) + 1),
      updatedAt: new Date().toISOString()
    };

    if (effectiveIsFirstSeen) {
      payload.firstSeenTimeMs = completionTimeMs;
    } else {
      const existingBestRepeat = existingDoc.data()?.bestRepeatTimeMs;
      payload.bestRepeatTimeMs = existingBestRepeat ? Math.min(existingBestRepeat, completionTimeMs) : completionTimeMs;
    }

    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (_) {
    return false;
  }
}

export async function saveLeaderboardStats(difficultyStats) {
  const player = await getPlayer();
  const name = getSavedPlayerName();
  const payload = computeLeaderboardPayload(difficultyStats, name);

  if (!player) {
    try {
      localStorage.setItem('diff_hunter_local_leaderboard', JSON.stringify({ ...payload, uid: 'local_player' }));
    } catch (_) {}
    return false;
  }

  try {
    await setDoc(doc(player.db, 'leaderboards', player.uid), {
      ...payload,
      uid: player.uid
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firestore saveLeaderboardStats error:', err);
    return false;
  }
}

export async function fetchLeaderboards(localDifficultyStats = {}) {
  const localPayload = computeLeaderboardPayload(localDifficultyStats, getSavedPlayerName());
  const localPlayerEntry = {
    uid: 'local_player',
    ...localPayload,
    isCurrentPlayer: true
  };

  const firestoreEntries = [];
  const player = await getPlayer();

  if (player) {
    try {
      const snap = await getDocs(collection(player.db, 'leaderboards'));
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const isMe = data.uid === player.uid;
        firestoreEntries.push({
          ...data,
          isCurrentPlayer: isMe
        });
      });
    } catch (e) {
      console.warn('Could not fetch Firestore leaderboards:', e);
    }
  }

  const allEntriesMap = new Map();

  const fallbackEntries = [
    {
      uid: 'demo_1',
      playerName: 'PixelSniper_Pro',
      avgFirstTimeByDifficulty: { Easy: 8200, Medium: 12400, Hard: 18500 },
      avgRepeatTimeByDifficulty: { Easy: 6420, Medium: 9850, Hard: 14200 },
      avgFirstTimeByPack: { find_the_sniper: 11200, abstract_animated: 14500 },
      avgRepeatTimeByPack: { find_the_sniper: 8900, abstract_animated: 11400 },
      avgTimesByDifficulty: { Easy: 6420, Medium: 9850, Hard: 14200 },
      avgTimesByPack: { find_the_sniper: 8900, abstract_animated: 11400 },
      totalSetsCleared: 24,
      isCurrentPlayer: false
    },
    {
      uid: 'demo_2',
      playerName: 'VortexEagle',
      avgFirstTimeByDifficulty: { Easy: 9800, Medium: 14200, Hard: 20100 },
      avgRepeatTimeByDifficulty: { Easy: 7890, Medium: 11200, Hard: 16500 },
      avgFirstTimeByPack: { find_the_sniper: 12800, abstract_animated: 16200 },
      avgRepeatTimeByPack: { find_the_sniper: 10400, abstract_animated: 13100 },
      avgTimesByDifficulty: { Easy: 7890, Medium: 11200, Hard: 16500 },
      avgTimesByPack: { find_the_sniper: 10400, abstract_animated: 13100 },
      totalSetsCleared: 18,
      isCurrentPlayer: false
    },
    {
      uid: 'demo_3',
      playerName: 'ChronoMaster',
      avgFirstTimeByDifficulty: { Easy: 11500, Medium: 15900, Hard: 22800 },
      avgRepeatTimeByDifficulty: { Easy: 9150, Medium: 12800, Hard: 18900 },
      avgFirstTimeByPack: { find_the_sniper: 14200, abstract_animated: 18100 },
      avgRepeatTimeByPack: { find_the_sniper: 11800, abstract_animated: 14900 },
      avgTimesByDifficulty: { Easy: 9150, Medium: 12800, Hard: 18900 },
      avgTimesByPack: { find_the_sniper: 11800, abstract_animated: 14900 },
      totalSetsCleared: 15,
      isCurrentPlayer: false
    },
    {
      uid: 'demo_4',
      playerName: 'ApexHawk_X',
      avgFirstTimeByDifficulty: { Easy: 12900, Medium: 17400, Hard: 25600 },
      avgRepeatTimeByDifficulty: { Easy: 10400, Medium: 14100, Hard: 21300 },
      avgFirstTimeByPack: { find_the_sniper: 15900, abstract_animated: 19800 },
      avgRepeatTimeByPack: { find_the_sniper: 13200, abstract_animated: 16800 },
      avgTimesByDifficulty: { Easy: 10400, Medium: 14100, Hard: 21300 },
      avgTimesByPack: { find_the_sniper: 13200, abstract_animated: 16800 },
      totalSetsCleared: 12,
      isCurrentPlayer: false
    },
    {
      uid: 'demo_5',
      playerName: 'NovaSeeker',
      avgFirstTimeByDifficulty: { Easy: 14200, Medium: 19100, Hard: 28400 },
      avgRepeatTimeByDifficulty: { Easy: 11800, Medium: 15900, Hard: 23800 },
      avgFirstTimeByPack: { find_the_sniper: 17400, abstract_animated: 21900 },
      avgRepeatTimeByPack: { find_the_sniper: 14600, abstract_animated: 18500 },
      avgTimesByDifficulty: { Easy: 11800, Medium: 15900, Hard: 23800 },
      avgTimesByPack: { find_the_sniper: 14600, abstract_animated: 18500 },
      totalSetsCleared: 9,
      isCurrentPlayer: false
    }
  ];

  fallbackEntries.forEach(entry => allEntriesMap.set(entry.uid, entry));
  firestoreEntries.forEach(entry => allEntriesMap.set(entry.uid, entry));
  allEntriesMap.set('local_player', localPlayerEntry);

  const combinedList = Array.from(allEntriesMap.values());

  const getTop5ForPack = (packId, mode = 'repeat') => {
    const key = mode === 'first' ? 'avgFirstTimeByPack' : 'avgRepeatTimeByPack';
    return combinedList
      .map(p => {
        const time = p[key]?.[packId] || p.avgTimesByPack?.[packId] || (p.isCurrentPlayer ? 10800 : 13500);
        return {
          ...p,
          effectiveTime: time
        };
      })
      .sort((a, b) => a.effectiveTime - b.effectiveTime)
      .slice(0, 10);
  };

  return {
    isCloud: !!player,
    byPackFirst: {
      find_the_sniper: getTop5ForPack('find_the_sniper', 'first'),
      abstract_animated: getTop5ForPack('abstract_animated', 'first')
    },
    byPackRepeat: {
      find_the_sniper: getTop5ForPack('find_the_sniper', 'repeat'),
      abstract_animated: getTop5ForPack('abstract_animated', 'repeat')
    },
    localPlayer: localPlayerEntry
  };
}

