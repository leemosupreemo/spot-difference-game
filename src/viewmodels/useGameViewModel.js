import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LEVELS as INITIAL_LEVELS } from '../utils/canvasLevels.js';
import { buildPhotoPairStage } from '../utils/photoPairLevelLoader.js';
import { calculateSpeedPoints } from '../utils/scoring.js';
import { saveImageProgress, saveLeaderboardStats, syncProgressFromFirestore } from '../services/playerProgress.js';
import { sounds } from '../utils/audio.js';
import { logApp, auditDOMState } from '../utils/logger.js';
import {
  getCuratedStatusMap,
  setLevelCurationMeta,
  pruneDismissedStatuses,
  resetCuratedStatusMap,
  saveCuratedStatusMap,
  setLevelCuratedStatus
} from '../utils/curationStore.js';

const STAGE_PAIR_COUNT = 5;

export function useGameViewModel() {
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [currentLevelId, setCurrentLevelId] = useState(INITIAL_LEVELS[0].id);
  const [view, setView] = useState('menu'); // 'menu' | 'game' | 'creator' | 'stats'
  const [selectedTheme, setSelectedTheme] = useState('find_the_sniper');
  const [activeMode, setActiveMode] = useState('classic'); // 'classic' | 'blitz' | 'zen'
  
  // Gameplay State
  const [foundDiffs, setFoundDiffs] = useState([]);
  const [missCount, setMissCount] = useState(0);
  const [magnifierEnabled, setMagnifierEnabled] = useState(false);
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(false);

  // Timer State
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);
  const timerBaselineRef = useRef(0);

  // Modals
  const [victoryModalOpen, setVictoryModalOpen] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [leaderboardModalOpen, setLeaderboardModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);

  // Stage Pair State
  const [stagePairs, setStagePairs] = useState([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const stagePairCount = stagePairs.length || STAGE_PAIR_COUNT;

  // Debug Flag
  const [debugMode, setDebugMode] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === '1' || urlParams.get('debug') === 'true') return true;
      return localStorage.getItem('diff_hunter_debug') === 'true';
    } catch (_) {
      return false;
    }
  });

  // Curation State
  const [curatedStatusMap, setCuratedStatusMap] = useState(() => {
    const cleanedStatuses = pruneDismissedStatuses(getCuratedStatusMap());
    saveCuratedStatusMap(cleanedStatuses);
    return cleanedStatuses;
  });

  // Categorized Progress Stats
  const [difficultyStats, setDifficultyStats] = useState(() => {
    try {
      const saved = localStorage.getItem('diff_hunter_categorized_stats');
      return saved ? JSON.parse(saved) : {
        All: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, fastestCleanOverall: null, fastestFaultedOverall: null, sets: {} }
      };
    } catch (_) {
      return {
        All: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, fastestCleanOverall: null, fastestFaultedOverall: null, sets: {} }
      };
    }
  });

  // Restore seen image history from Firestore on startup
  useEffect(() => {
    syncProgressFromFirestore(difficultyStats).then(syncedStats => {
      if (syncedStats && Object.keys(syncedStats).length > 0) {
        setDifficultyStats(syncedStats);
      }
    });
  }, []);

  const handleSetCuratedStatus = useCallback((levelId, status, meta) => {
    const updated = setLevelCuratedStatus(levelId, status, meta);
    setCuratedStatusMap({ ...updated });
  }, []);

  const handleSetCuratedCategory = useCallback((levelId, packId) => {
    const updated = setLevelCurationMeta(levelId, {
      packId,
      pack: packId === 'abstract_animated' ? 'Fantastical' : 'Photography'
    });
    setCuratedStatusMap({ ...updated });
  }, []);

  const handleResetCuratedStatuses = useCallback(() => {
    setCuratedStatusMap(resetCuratedStatusMap());
  }, []);

  const handleAdvanceToNextPair = useCallback(() => {
    sounds.playTap();
    setStagePairs(pairs => {
      if (pairs.length > 0) {
        setCurrentPairIndex(idx => (idx + 1 < pairs.length ? idx + 1 : 0));
      }
      return pairs;
    });
  }, []);

  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('diff_hunter_debug', String(next));
      } catch (_) {}
      if (next) sounds.playWin();
      else sounds.playTap();
      return next;
    });
  }, []);

  const rawCurrentLevel = stagePairs.length > 0 ? stagePairs[currentPairIndex] : (levels.find(l => l.id === currentLevelId) || levels[0]);

  // Adjust level properties (single difference per pair)
  const currentLevel = useMemo(() => {
    try {
      if (!rawCurrentLevel) return levels[0];
      const diffsArray = Array.isArray(rawCurrentLevel.diffs) && rawCurrentLevel.diffs.length > 0
        ? rawCurrentLevel.diffs
        : [{ id: 1, x: 50, y: 50, radius: 25 }];

      const singleDiff = diffsArray[0] || { id: 1, x: 50, y: 50, radius: 25 };
      const safeRadius = typeof singleDiff.radius === 'number' && !isNaN(singleDiff.radius)
        ? Math.round(singleDiff.radius)
        : 25;

      return {
        ...rawCurrentLevel,
        totalDifferences: 1,
        diffs: [{
          ...singleDiff,
          id: singleDiff.id || 1,
          x: typeof singleDiff.x === 'number' ? singleDiff.x : 50,
          y: typeof singleDiff.y === 'number' ? singleDiff.y : 50,
          radius: safeRadius
        }]
      };
    } catch (err) {
      logApp('ERROR', '[currentLevelMemoError]', err?.message || err);
      return levels[0];
    }
  }, [rawCurrentLevel, levels]);

  // Restart 5-Pair Stage
  const handleRestartStage = useCallback(() => {
    setCurrentPairIndex(0);
    setFoundDiffs([]);
    setMissCount(0);
    setScore(0);
    setElapsedTime(0);
    setTimerRunning(true);
    setVictoryModalOpen(false);
    setGameOver(false);
  }, []);

  // Timer Effect
  useEffect(() => {
    if (timerRunning && view === 'game') {
      timerBaselineRef.current = Date.now() - elapsedTime;
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - timerBaselineRef.current);
      }, 30);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning, elapsedTime, view]);

  // Sync on Resume
  useEffect(() => {
    if (!timerRunning || view !== 'game') return;
    const syncOnResume = () => setElapsedTime(Date.now() - timerBaselineRef.current);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncOnResume();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', syncOnResume);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', syncOnResume);
    };
  }, [timerRunning, view]);

  const startStageWithLevels = useCallback((stageList) => {
    if (!stageList || stageList.length === 0) {
      logApp('WARN', '[StageStartFailed] Empty or invalid stageList');
      return;
    }
    logApp('INFO', `[StageStartSuccess] Starting stage with ${stageList.length} levels. Level 1: ${stageList[0]?.id}`);
    setStagePairs(stageList);
    setCurrentPairIndex(0);
    setFoundDiffs([]);
    setMissCount(0);
    setScore(0);
    setElapsedTime(0);
    setTimerRunning(true);
    setVictoryModalOpen(false);
    setGameOver(false);
    setView('game');

    // DOM Telemetry Audit triggers right after view transition
    setTimeout(() => auditDOMState('GameViewMounted_50ms'), 50);
    setTimeout(() => auditDOMState('GameViewMounted_250ms'), 250);
    setTimeout(() => auditDOMState('GameViewMounted_800ms'), 800);
  }, []);

  const handleStartGame = useCallback(async () => {
    logApp('INFO', `[StartGameClicked] Selected theme: ${selectedTheme}`);
    try {
      const stageList = await buildPhotoPairStage({
        packId: selectedTheme,
        difficulty: 'Medium',
        count: STAGE_PAIR_COUNT,
        curatedStatusMap
      });
      logApp('INFO', `[BuildStageDone] Stage levels count: ${stageList?.length}`);
      startStageWithLevels(stageList);
    } catch (error) {
      logApp('ERROR', `[BuildStageError] ${error?.message || error}`);
    }
  }, [selectedTheme, curatedStatusMap, startStageWithLevels]);

  const handleDiffFound = (diffId) => {
    if (!foundDiffs.includes(diffId)) {
      const newFound = [...foundDiffs, diffId];
      setFoundDiffs(newFound);
      const pointsEarned = calculateSpeedPoints(elapsedTime);
      setScore(prev => prev + pointsEarned);

      if (currentPairIndex + 1 < stagePairs.length) {
        setTimeout(() => {
          setCurrentPairIndex(prev => prev + 1);
          setFoundDiffs([]);
        }, 450);
      } else {
        setTimerRunning(false);
        
        setDifficultyStats(prev => {
          const cat = 'All';
          const categoryData = prev[cat] || { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, fastestCleanOverall: null, fastestFaultedOverall: null, sets: {} };
          const setData = categoryData.sets[currentLevel.id] || { title: currentLevel.title, firstTime: null, fastestRepeat: null, bestCleanTime: null, bestFaultedTime: null, clears: 0 };

          const isFirstTime = !setData.firstTime;
          const newFirstTime = isFirstTime ? elapsedTime : setData.firstTime;
          const newFastestRepeat = !setData.fastestRepeat || elapsedTime < setData.fastestRepeat ? elapsedTime : setData.fastestRepeat;

          const isClean = missCount === 0;
          const newBestClean = isClean
            ? (!setData.bestCleanTime || elapsedTime < setData.bestCleanTime ? elapsedTime : setData.bestCleanTime)
            : setData.bestCleanTime;
          const newBestFaulted = !isClean
            ? (!setData.bestFaultedTime || elapsedTime < setData.bestFaultedTime ? elapsedTime : setData.bestFaultedTime)
            : setData.bestFaultedTime;

          const updatedSetData = {
            title: currentLevel.title,
            packId: currentLevel.packId || selectedTheme,
            firstTime: newFirstTime,
            fastestRepeat: newFastestRepeat,
            bestCleanTime: newBestClean,
            bestFaultedTime: newBestFaulted,
            clears: setData.clears + 1
          };

          const updatedSets = { ...categoryData.sets, [currentLevel.id]: updatedSetData };
          const setsClearedCount = Object.keys(updatedSets).length;

          const allFirstTimes = Object.values(updatedSets).map(s => s.firstTime).filter(Boolean);
          const allRepeats = Object.values(updatedSets).map(s => s.fastestRepeat).filter(Boolean);
          const overallFirstTime = allFirstTimes.length > 0 ? Math.min(...allFirstTimes) : null;
          const overallRepeat = allRepeats.length > 0 ? Math.min(...allRepeats) : null;

          const allClean = Object.values(updatedSets).map(s => s.bestCleanTime).filter(Boolean);
          const allFaulted = Object.values(updatedSets).map(s => s.bestFaultedTime).filter(Boolean);
          const overallClean = allClean.length > 0 ? Math.min(...allClean) : null;
          const overallFaulted = allFaulted.length > 0 ? Math.min(...allFaulted) : null;

          const newStats = {
            ...prev,
            [cat]: {
              setsCleared: setsClearedCount,
              fastestFirstTimeOverall: overallFirstTime,
              fastestRepeatOverall: overallRepeat,
              fastestCleanOverall: overallClean,
              fastestFaultedOverall: overallFaulted,
              sets: updatedSets
            }
          };

          try {
            localStorage.setItem('diff_hunter_categorized_stats', JSON.stringify(newStats));
          } catch (_) {}

          saveImageProgress({
            imageId: currentLevel.id,
            packId: currentLevel.packId || selectedTheme,
            title: currentLevel.title,
            completionTimeMs: isFirstTime ? newFirstTime : newFastestRepeat,
            isFirstSeen: isFirstTime,
            clears: updatedSetData.clears
          }).catch(() => {});

          saveLeaderboardStats(newStats).catch(() => {});

          return newStats;
        });

        setTimeout(() => {
          setVictoryModalOpen(true);
        }, 400);
      }
    }
  };

  const handleMissTap = () => {
    if (gameOver) return;
    const nextMisses = missCount + 1;
    setMissCount(nextMisses);
    if (activeMode !== 'zen') {
      setElapsedTime(prev => prev + 2000);
    }

    if (nextMisses >= 3) {
      sounds.playLose();
      setTimerRunning(false);
      setGameOver(true);
    }
  };

  const handleSaveCustomLevel = (customLevel) => {
    setLevels(prev => [customLevel, ...prev]);
    setCurrentLevelId(customLevel.id);
    setView('menu');
  };

  return {
    levels,
    setLevels,
    currentLevelId,
    setCurrentLevelId,
    view,
    setView,
    selectedTheme,
    setSelectedTheme,
    activeMode,
    setActiveMode,
    foundDiffs,
    missCount,
    magnifierEnabled,
    setMagnifierEnabled,
    score,
    muted,
    setMuted,
    elapsedTime,
    timerRunning,
    victoryModalOpen,
    setVictoryModalOpen,
    gameOver,
    setGameOver,
    progressModalOpen,
    setProgressModalOpen,
    leaderboardModalOpen,
    setLeaderboardModalOpen,
    helpModalOpen,
    setHelpModalOpen,
    debugModalOpen,
    setDebugModalOpen,
    STAGE_PAIR_COUNT,
    stagePairCount,
    stagePairs,
    currentPairIndex,
    debugMode,
    curatedStatusMap,
    difficultyStats,
    currentLevel,
    handleSetCuratedStatus,
    handleSetCuratedCategory,
    handleResetCuratedStatuses,
    handleAdvanceToNextPair,
    toggleDebugMode,
    handleRestartStage,
    startStageWithLevels,
    handleStartGame,
    handleDiffFound,
    handleMissTap,
    handleSaveCustomLevel
  };
}
