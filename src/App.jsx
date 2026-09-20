import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MainMenu from './components/MainMenu';
import Header from './components/Header';
import GameCanvas from './components/GameCanvas';
import TimerDisplay from './components/TimerDisplay';
import CustomLevelMaker from './components/CustomLevelMaker';
import VictoryModal from './components/VictoryModal';
import GameOverModal from './components/GameOverModal';
import ProgressModal from './components/ProgressModal';
import HelpModal from './components/HelpModal';
import RatingModal from './components/RatingModal';
import DiagnosticsModal from './components/DiagnosticsModal';
import ConfirmExitModal from './components/ConfirmExitModal';
import DebugLevelGeneratorModal from './components/DebugLevelGeneratorModal';
import DebugCuratorBar from './components/DebugCuratorBar';
import { initAuth } from './services/authService';
import { LEVELS as INITIAL_LEVELS } from './utils/canvasLevels';
import { generateProceduralLevelPair } from './utils/proceduralGenerator';
import { buildPhotoPairStage, getAllPhotoPairEntries, createPhotoPairLevel, removeManifestEntriesById } from './utils/photoPairLevelLoader';
import { getCompletePhotoSets } from './utils/photoSetCatalog';
import OfflineSetNotice from './components/OfflineSetNotice.jsx';
import { countsAsAttempt, selectableSetIds, isRemoteSetId } from './utils/remoteSetPolicy.js';
import { isOnline, subscribeNetworkStatus, setSimulatedOffline, isSimulatedOffline } from './services/networkService.js';
import { sounds, music } from './utils/audio';
import { calculateSpeedPoints } from './utils/scoring';
import { logApp } from './utils/logger';
import { getInitialDebugMode } from './utils/debugMode';
import { getCuratedStatusMap, setLevelCuratedStatus, setLevelCurationMeta, pruneDismissedStatuses, saveCuratedStatusMap, getLevelStatus, getEntryCurationStatus } from './utils/curationStore';
import { initAnalytics, trackGameStarted, trackImagePairCompleted, trackStageCleared, trackRatingPromptShown, trackChallengeReceived, trackChallengeMatchCompleted } from './services/analytics';
import { parseIncomingChallenge } from './utils/challengeMetrics';
import { refreshRemoteLevelPacks, syncRemoteLevelPacks, subscribeToRemoteLevels } from './services/remoteLevelSync';
import { syncRemoteAppConfig } from './services/appConfig';
import { initializeNotificationListeners, scheduleInstallNotifications } from './services/notificationService';
import { initGameCenter, mirrorRoundToGameCenter, onGameCenterAuthChange } from './services/gameCenter';
import SetOfTheDayBanner from './components/SetOfTheDayBanner';
import DailyVictoryModal from './components/DailyVictoryModal';
import {
  getDailySetForDate,
  recordDailyChallengeCompletion,
  recordDailyChallengeCompletionRemote,
  recordDailyChallengeFailureRemote,
  startDailyChallengeSession,
  canAttemptDaily,
  getDailyPlayerStatus,
  resetDailyPlayerStatus,
  syncRemoteDailyQueue
} from './services/dailyChallenge';
import { hasCompletedFirstSet, markFirstSetCompleted, saveImageProgress, restoreProgressFromCloud, clearAllLocalRecords } from './services/playerProgress';
import { incrementSuccessfulRounds, getSuccessfulRounds, getSessionsPlayed, shouldShowRatingPrompt, recordRatingPromptShown } from './services/ratingPrompt';
import { getSetNumber, checkAndUpdateDynamicSetRecord } from './utils/setLeaderboards.js';
import { submitLeaderboardScore } from './services/leaderboardService.js';
import ScreenshotHarness from './components/ScreenshotHarness.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { isMobileDevice } from './utils/mobileDevice.js';
import {
  isFirstAttemptForSet,
  recordSetAttemptStarted,
  clearActiveSetAttempt,
  getActiveSetAttempt,
  markSetFirstAttemptFailed
} from './utils/setAttemptTracker.js';

export default function App() {
  const screenshotModal = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('screenshotModal')
    : null;

  if (screenshotModal) {
    return <ScreenshotHarness modalId={screenshotModal} />;
  }

  const [showSplash, setShowSplash] = useState(() => isMobileDevice());

  const [levels, setLevels] = useState(() => {
    try {
      const allEntries = getAllPhotoPairEntries();
      const statusMap = getCuratedStatusMap();
      const unreviewed = allEntries.filter(entry => {
        const statusVal = getEntryCurationStatus(entry, statusMap)?.status;
        return !statusVal && statusVal !== 'dismissed';
      });
      if (unreviewed.length > 0) return unreviewed.slice(0, 5).map(createPhotoPairLevel);
      if (allEntries.length > 0) return allEntries.slice(0, 5).map(createPhotoPairLevel);
    } catch (_) {}
    return INITIAL_LEVELS;
  });

  const [currentLevelId, setCurrentLevelId] = useState(() => {
    try {
      const allEntries = getAllPhotoPairEntries();
      const statusMap = getCuratedStatusMap();
      const unreviewed = allEntries.filter(entry => {
        const statusVal = getEntryCurationStatus(entry, statusMap)?.status;
        return !statusVal && statusVal !== 'dismissed';
      });
      if (unreviewed.length > 0) return unreviewed[0].id;
      if (allEntries.length > 0) return allEntries[0].id;
    } catch (_) {}
    return INITIAL_LEVELS[0].id;
  });
  const [view, setView] = useState('menu'); // 'menu' | 'game' | 'creator' | 'stats'
  const [incomingChallenge] = useState(() => {
    try {
      return typeof window !== 'undefined' ? parseIncomingChallenge(window.location.search) : null;
    } catch (_) {
      return null;
    }
  });

  const [selectedDifficulty, setSelectedDifficulty] = useState(() => {
    try {
      const challenge = typeof window !== 'undefined' ? parseIncomingChallenge(window.location.search) : null;
      if (challenge?.difficulty && ['Easy', 'Medium', 'Hard'].includes(challenge.difficulty)) {
        return challenge.difficulty;
      }
    } catch (_) {}
    return 'Medium';
  }); // 'Easy' | 'Medium' | 'Hard'

  const [remoteLevelsRevision, setRemoteLevelsRevision] = useState(0);
  const [remotePackSync, setRemotePackSync] = useState({ status: 'idle', count: 0 });
  const [networkOnline, setNetworkOnline] = useState(() => isOnline());
  const [simulatedOffline, setSimulatedOfflineState] = useState(() => isSimulatedOffline());
  const handleToggleSimulatedOffline = useCallback((next) => {
    setSimulatedOfflineState(setSimulatedOffline(next));
    setNetworkOnline(isOnline());
  }, []);
  useEffect(() => subscribeNetworkStatus(setNetworkOnline), []);
  // Online-only sets are withheld while offline: their artwork lives on
  // Hosting, so offering them would start a set that cannot finish.
  const photoSetIds = useMemo(() => selectableSetIds(
    getCompletePhotoSets(
      getAllPhotoPairEntries({ online: networkOnline }).filter(entry => entry.packId === 'find_the_sniper')
    ).map(photoSet => photoSet.setId),
    { online: networkOnline }
  ), [remoteLevelsRevision, networkOnline]);
  const [photoSetId, setPhotoSetId] = useState(() => {
    try {
      const savedSetId = localStorage.getItem('diff_hunter_photo_set_id');
      if (savedSetId && photoSetIds.includes(savedSetId)) return savedSetId;
    } catch {}
    return photoSetIds[0] || '';
  });

  const [selectedTheme, setSelectedTheme] = useState(() => {
    try {
      const challenge = typeof window !== 'undefined' ? parseIncomingChallenge(window.location.search) : null;
      if (challenge?.themeId && ['find_the_sniper', 'abstract_animated'].includes(challenge.themeId)) {
        return challenge.themeId;
      }
    } catch (_) {}
    return 'find_the_sniper';
  }); // 'find_the_sniper' | 'abstract_animated'
  const [activeMode, setActiveMode] = useState('classic'); // 'classic' | 'blitz' | 'zen'
  const [gameMode, setGameMode] = useState('standard'); // 'standard' | 'daily'
  const [dailyVictoryData, setDailyVictoryData] = useState(null);
  const [statsInitialTab, setStatsInitialTab] = useState('leaderboards');
  
  // Gameplay State
  const [foundDiffs, setFoundDiffs] = useState([]);
  const [missCount, setMissCount] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [activeHintId, setActiveHintId] = useState(null);
  const [magnifierEnabled, setMagnifierEnabled] = useState(false);
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(false);

  // Timer State
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [missPenaltyTick, setMissPenaltyTick] = useState(0);
  const timerRef = useRef(null);

  // Modals
  const [victoryModalOpen, setVictoryModalOpen] = useState(false);
  const [gameOverModalOpen, setGameOverModalOpen] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingPromptAttemptNumber, setRatingPromptAttemptNumber] = useState(1);
  // Set true the instant a stage/set is actually won; consumed (and cleared) the next
  // time the player lands back on the menu, which is when the rating prompt may show.
  const justWonRoundRef = useRef(false);
  const activeSetAttemptRef = useRef(null);
  const [isCurrentRunFirstAttempt, setIsCurrentRunFirstAttempt] = useState(false);
  const [confirmExitModalOpen, setConfirmExitModalOpen] = useState(false);
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [selectedStatsSetId, setSelectedStatsSetId] = useState('');
  const [lastSetCompletionInfo, setLastSetCompletionInfo] = useState(null);

  // Debug Flag (Always enabled on dev branch/URLs unless explicitly specified otherwise)
  const [debugMode, setDebugMode] = useState(() => getInitialDebugMode());

  const [tutorialAnimationEnabled, setTutorialAnimationEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('diff_hunter_tutorial_animation');
      return saved !== 'false';
    } catch (_) {
      return true;
    }
  });

  const [skipKeptLevels, setSkipKeptLevels] = useState(() => {
    try {
      const saved = localStorage.getItem('diff_hunter_skip_kept');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  const handlePhotoSetChange = useCallback((nextSetId) => {
    if (!photoSetIds.includes(nextSetId)) return;
    setPhotoSetId(nextSetId);
    try {
      localStorage.setItem('diff_hunter_photo_set_id', nextSetId);
    } catch {}
  }, [photoSetIds]);

  useEffect(() => {
    initAnalytics();
    initGameCenter().catch(() => {});
    initializeNotificationListeners().catch(() => {});
    syncRemoteLevelPacks().catch(() => {});
    syncRemoteAppConfig().catch(() => {});
    syncRemoteDailyQueue().catch(() => {});
    music.start();

    // If launched via Challenge Link, track reception
    if (incomingChallenge) {
      trackChallengeReceived({
        challengerName: incomingChallenge.challengerName,
        targetTimeSec: incomingChallenge.targetTimeSec,
        difficulty: incomingChallenge.difficulty,
        themeId: incomingChallenge.themeId
      });
      logApp('INFO', `[ChallengeReceived] Challenger: ${incomingChallenge.challengerName}, Target: ${incomingChallenge.targetTimeSec}s`);
    }

    // Track session/launch count, used as the "sessionsPlayed" input to the rating prompt.
    try {
      const storedVisits = localStorage.getItem('diff_hunter_launch_count');
      const count = (parseInt(storedVisits, 10) || 0) + 1;
      localStorage.setItem('diff_hunter_launch_count', String(count));
    } catch (_) {}
  }, [incomingChallenge]);

  // Restore set progress and attempt history from Cloud / Game Center on startup
  useEffect(() => {
    // Interrupted 1st attempt recovery (e.g. app force quit / crash during 1st attempt)
    const interruptedAttempt = getActiveSetAttempt();
    if (interruptedAttempt) {
      setDifficultyStats(prev => markSetFirstAttemptFailed(prev, interruptedAttempt));
    }

    restoreProgressFromCloud(difficultyStats).then(syncedStats => {
      if (syncedStats && Object.keys(syncedStats).length > 0) {
        setDifficultyStats(syncedStats);
        setHasCompletedFirstSetState(hasCompletedFirstSet());
      }
    }).catch(() => {});

    // Listen for Game Center authentication updates (e.g. silent iOS background login)
    const unsubGc = onGameCenterAuthChange(authState => {
      if (authState?.isAuthenticated && authState?.player?.gamePlayerID) {
        restoreProgressFromCloud().then(syncedStats => {
          if (syncedStats && Object.keys(syncedStats).length > 0) {
            setDifficultyStats(syncedStats);
            setHasCompletedFirstSetState(hasCompletedFirstSet());
          }
        }).catch(() => {});
      }
    });

    return () => {
      if (typeof unsubGc === 'function') unsubGc();
    };
  }, []);

  // Listen for beforeunload / pagehide to mark an active first attempt as failed if player exits/closes app
  useEffect(() => {
    const handleAppExit = () => {
      const active = getActiveSetAttempt();
      if (active) {
        try {
          const raw = localStorage.getItem('diff_hunter_categorized_stats');
          const parsed = raw ? JSON.parse(raw) : {};
          markSetFirstAttemptFailed(parsed, active);
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleAppExit);
    window.addEventListener('pagehide', handleAppExit);
    return () => {
      window.removeEventListener('beforeunload', handleAppExit);
      window.removeEventListener('pagehide', handleAppExit);
    };
  }, []);

  // Initialize silent anonymous auth on launch
  useEffect(() => {
    const unsubAuth = initAuth();
    return () => {
      if (typeof unsubAuth === 'function') unsubAuth();
    };
  }, []);

  // Refresh derived Photo Set choices as soon as a remote pack arrives.
  useEffect(() => subscribeToRemoteLevels(() => setRemoteLevelsRevision(revision => revision + 1)), []);

  const handleRefreshRemotePacks = useCallback(async () => {
    setRemotePackSync({ status: 'refreshing', count: 0 });
    try {
      const remoteLevels = await refreshRemoteLevelPacks();
      setRemotePackSync({ status: 'success', count: remoteLevels.length });
    } catch (err) {
      setRemotePackSync({
        status: 'error',
        count: 0,
        message: err?.message || 'Remote refresh failed'
      });
    }
  }, []);

  const [switchedOffRemoteSet, setSwitchedOffRemoteSet] = useState(false);
  useEffect(() => {
    if (photoSetIds.length > 0 && !photoSetIds.includes(photoSetId)) {
      // Losing an online-only set to a dropped connection is the one case worth
      // explaining: the player had a set and it vanished. Any other correction
      // (a set pruned, a first run with nothing saved) needs no apology.
      if (isRemoteSetId(photoSetId) && !networkOnline) {
        logApp('INFO', `[PhotoSet:OfflineSwitch] ${photoSetId} unavailable offline -- moving to ${photoSetIds[0]}`);
        setSwitchedOffRemoteSet(true);
      }
      setPhotoSetId(photoSetIds[0]);
    }
  }, [photoSetIds, photoSetId, networkOnline]);

  // Reconnecting restores the sets, so the explanation retires itself.
  useEffect(() => {
    if (networkOnline) setSwitchedOffRemoteSet(false);
  }, [networkOnline]);

  const handleToggleSkipKept = (val) => {
    setSkipKeptLevels(val);
    try {
      localStorage.setItem('diff_hunter_skip_kept', String(val));
    } catch (e) {}
  };

  // Curated Image Decisions Store State
  const [curatedStatusMap, setCuratedStatusMap] = useState(() => getCuratedStatusMap());

  const isKeptStatus = (statusVal) => statusVal === 'approved' || statusVal === 'wrong_difficulty';

  const isLevelCategorized = (entry, mapToUse = curatedStatusMap) => {
    const statusObj = getEntryCurationStatus(entry, mapToUse);
    const statusVal = statusObj?.status;
    return Boolean(statusVal || statusObj?.packId || statusObj?.category || statusObj?.difficulty || statusObj?.suggestedDifficulty);
  };

  const getUnlabeledPremadeLevels = (mapToUse = curatedStatusMap, skipKept = skipKeptLevels) => {
    const allEntries = getAllPhotoPairEntries();
    const brandNew = [];

    for (const entry of allEntries) {
      const statusObj = getEntryCurationStatus(entry, mapToUse);
      const statusVal = statusObj?.status;
      if (statusVal === 'dismissed') continue;
      if (skipKept && isKeptStatus(statusVal)) continue;

      if (!isLevelCategorized(entry, mapToUse)) {
        brandNew.push(entry);
      }
    }

    return brandNew;
  };

  const getDebugCandidateEntries = (mapToUse = curatedStatusMap, skipKept = skipKeptLevels) => {
    const allEntries = getAllPhotoPairEntries();
    const unreviewed = [];
    const categorized = [];

    for (const entry of allEntries) {
      const statusObj = getEntryCurationStatus(entry, mapToUse);
      const statusVal = statusObj?.status;
      if (statusVal === 'dismissed') continue;
      if (skipKept && isKeptStatus(statusVal)) continue;

      if (!isLevelCategorized(entry, mapToUse)) {
        unreviewed.push(entry);
      } else {
        categorized.push(entry);
      }
    }

    // Non-categorized / brand new image sets prioritized strictly first
    return [...unreviewed, ...categorized];
  };

  const effectiveDebugPool = useMemo(() => {
    if (!debugMode) return [];
    const pool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
    return pool.length > 0 ? pool : getAllPhotoPairEntries();
  }, [debugMode, curatedStatusMap, skipKeptLevels]);

  const handleSetCuratedStatus = (levelId, status, meta) => {
    const updated = setLevelCuratedStatus(levelId, status, meta);
    setCuratedStatusMap({ ...updated });

    // Sync in real time to server and disk
    try {
      fetch('/api/curation/record-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelId, status, meta })
      }).catch(() => {});
    } catch (_) {}

    if (debugMode) {
      const newPool = getDebugCandidateEntries(updated, skipKeptLevels);
      const poolToUse = newPool.length > 0 ? newPool : getAllPhotoPairEntries().filter(e => getLevelStatus(updated[e.id])?.status !== 'dismissed');

      if (poolToUse.length > 0) {
        const oldPool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
        const oldIdx = oldPool.findIndex(e => e.id === levelId);
        const nextIdx = oldIdx >= 0 ? oldIdx % poolToUse.length : 0;
        const nextEntry = poolToUse[nextIdx];
        if (nextEntry) {
          const nextLevels = poolToUse.map(createPhotoPairLevel);
          setLevels(nextLevels);
          startLevel(nextEntry.id);
        }
      }
    }
  };

  const handleSetCuratedCategory = (levelId, packId) => {
    const updated = setLevelCurationMeta(levelId, { packId });
    setCuratedStatusMap({ ...updated });
  };

  const handlePruneDismissed = async () => {
    const current = getCuratedStatusMap();
    const dismissedIds = Object.entries(current)
      .filter(([, val]) => getLevelStatus(val)?.status === 'dismissed')
      .map(([id]) => id);

    if (dismissedIds.length === 0) {
      alert('No levels are currently marked as dismissed to delete.');
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete ${dismissedIds.length} dismissed level(s) and their image files from disk?\n\nThis will remove the image files from public/levels and update the manifest. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch('/api/curation/prune-dismissed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelIds: dismissedIds })
      });

      if (response.ok) {
        const result = await response.json();
        removeManifestEntriesById(dismissedIds);
        const pruned = pruneDismissedStatuses(current);
        saveCuratedStatusMap(pruned);
        setCuratedStatusMap({ ...pruned });

        sounds.playWin();
        alert(`Successfully deleted ${dismissedIds.length} level(s) (${result.deletedFiles?.length || 0} image files) from disk and manifest.`);

        if (dismissedIds.includes(currentLevelId)) {
          handleNextPair();
        }
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.warn('[PruneDismissed] Server endpoint unavailable or failed:', err);
      const pruned = pruneDismissedStatuses(current);
      saveCuratedStatusMap(pruned);
      setCuratedStatusMap({ ...pruned });
      alert(
        `Pruned ${dismissedIds.length} dismissed status(es) from local session.\n\nNote: If running standalone without the Vite dev server, run 'npm run prune:dismissed' in terminal to delete image files from disk.`
      );
    }
  };

  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('diff_hunter_debug', String(next));
      } catch (e) {}
      if (next) sounds.playWin();
      else sounds.playTap();
      return next;
    });
  }, []);

  const handleToggleTutorialAnimation = useCallback(() => {
    setTutorialAnimationEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('diff_hunter_tutorial_animation', String(next));
      } catch (_) {}
      sounds.playTap();
      return next;
    });
  }, []);

  const handleResetDailyChallenge = useCallback(() => {
    resetDailyPlayerStatus();
    setIsDailyCompleted(false);
    sounds.playWin();
    logApp('INFO', '[DailyChallenge] Player daily status reset via debug/test controls');
  }, []);

  const handleResetLocalRecords = useCallback(() => {
    const confirmed = window.confirm(
      'Clear all locally saved records and scores on this device? This wipes your category stats, best times, and daily challenge history. This cannot be undone.'
    );
    if (!confirmed) return;

    clearAllLocalRecords();
    setDifficultyStats({
      Easy: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} },
      Medium: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} },
      Hard: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} }
    });
    setIsDailyCompleted(false);
    sounds.playTap();
    logApp('INFO', '[LocalRecords] Cleared all locally saved records/scores via player-initiated reset');
  }, []);

  useEffect(() => {
    if (debugMode) {
      const pool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
      const effectivePool = pool.length > 0 ? pool : getAllPhotoPairEntries();
      if (effectivePool.length > 0) {
        const debugLevels = effectivePool.map(createPhotoPairLevel);
        setLevels(debugLevels);
        const isCurrentInPool = currentLevelId && effectivePool.some(e => e.id === currentLevelId);
        if (!isCurrentInPool) {
          setCurrentLevelId(effectivePool[0].id);
        }
      }
    }
  }, [debugMode, skipKeptLevels]);

  const handleNextPair = async () => {
    sounds.playTap();

    if (debugMode && gameMode === 'daily') {
      const currentIndex = levels.findIndex(l => l.id === currentLevelId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % levels.length : 0;
      const nextLevel = levels[nextIndex];
      if (nextLevel) {
        setCurrentStageIndex(nextIndex);
        startLevel(nextLevel.id);
      }
      return;
    }

    if (debugMode) {
      const pool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
      const effectivePool = pool.length > 0 ? pool : getAllPhotoPairEntries();
      if (effectivePool.length > 0) {
        const currentIndex = effectivePool.findIndex(e => e.id === currentLevelId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % effectivePool.length : 0;
        const nextEntry = effectivePool[nextIndex];
        const nextBatch = effectivePool.map(createPhotoPairLevel);
        setLevels(nextBatch);
        startLevel(nextEntry.id);
        return;
      }
    }

    const currentIndex = levels.findIndex(l => l.id === currentLevelId);
    if (currentIndex >= 0 && currentIndex < levels.length - 1) {
      startLevel(levels[currentIndex + 1].id);
    } else {
      await handleStartGame();
    }
  };

  const handlePrevPair = () => {
    sounds.playTap();

    if (debugMode && gameMode === 'daily') {
      const currentIndex = levels.findIndex(l => l.id === currentLevelId);
      const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + levels.length) % levels.length : 0;
      const prevLevel = levels[prevIndex];
      if (prevLevel) {
        setCurrentStageIndex(prevIndex);
        startLevel(prevLevel.id);
      }
      return;
    }

    if (debugMode) {
      const pool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
      const effectivePool = pool.length > 0 ? pool : getAllPhotoPairEntries();
      if (effectivePool.length > 0) {
        const currentIndex = effectivePool.findIndex(e => e.id === currentLevelId);
        const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + effectivePool.length) % effectivePool.length : 0;
        const prevEntry = effectivePool[prevIndex];
        const nextBatch = effectivePool.map(createPhotoPairLevel);
        setLevels(nextBatch);
        startLevel(prevEntry.id);
        return;
      }
    }

    const currentIndex = levels.findIndex(l => l.id === currentLevelId);
    if (currentIndex > 0) {
      startLevel(levels[currentIndex - 1].id);
    }
  };

  // Categorized Progress Stats (Easy, Medium, Hard)
  const [difficultyStats, setDifficultyStats] = useState(() => {
    try {
      const saved = localStorage.getItem('diff_hunter_categorized_stats');
      return saved ? JSON.parse(saved) : {
        Easy: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} },
        Medium: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} },
        Hard: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} }
      };
    } catch (e) {
      return {
        Easy: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} },
        Medium: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} },
        Hard: { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} }
      };
    }
  });

  const [hasCompletedFirstSetState, setHasCompletedFirstSetState] = useState(() => hasCompletedFirstSet());
  const [isDailyCompleted, setIsDailyCompleted] = useState(() => {
    try {
      const status = getDailyPlayerStatus();
      return Boolean(status?.completed || status?.attempted || status?.failed);
    } catch (_) {
      return false;
    }
  });

  const rawLevel = levels.find(l => l.id === currentLevelId) || levels[0];

  // Enforce 1 single difference per image pair with hit radius scaled by difficulty
  const currentLevel = React.useMemo(() => {
    const singleDiff = rawLevel?.diffs?.[0] || { id: 1, x: 50, y: 50, radius: 6, hint: 'Spot the difference!' };
    let radiusMultiplier = 1.0;

    if (selectedDifficulty === 'Easy') {
      radiusMultiplier = 1.4;
    } else if (selectedDifficulty === 'Medium') {
      radiusMultiplier = 1.0;
    } else if (selectedDifficulty === 'Hard') {
      radiusMultiplier = 0.7;
    }

    return {
      ...rawLevel,
      difficulty: selectedDifficulty,
      totalDifferences: 1,
      diffs: [{ ...singleDiff, radius: Math.round(singleDiff.radius * radiusMultiplier) }]
    };
  }, [rawLevel, selectedDifficulty]);

  // Start Level Timer Immediately upon pair load
  const startLevel = useCallback((levelId) => {
    logApp('INFO', `[StartLevel] Level: ${levelId} (Difficulty: ${selectedDifficulty})`);
    setCurrentLevelId(levelId);
    setFoundDiffs([]);
    setMissCount(0);
    setHintsLeft(selectedDifficulty === 'Easy' ? 4 : selectedDifficulty === 'Medium' ? 3 : 2);
    setActiveHintId(null);
    setMagnifierEnabled(false);
    setElapsedTime(0);
    setTimerRunning(true);
    setVictoryModalOpen(false);
    setGameOverModalOpen(false);
    setRevealAnswer(false);
  }, [selectedDifficulty]);

  // Reset magnifier zoom whenever player leaves or enters non-game views
  useEffect(() => {
    if (view !== 'game') {
      setMagnifierEnabled(false);
    }
  }, [view]);

  // Rating prompt: only ever considered the moment the player lands back on the menu
  // immediately after a win (never mid-game, never after a failure/GameOverModal).
  // Delayed so it doesn't fight with the menu's own entrance transition.
  useEffect(() => {
    if (view !== 'menu' || !justWonRoundRef.current) return;
    justWonRoundRef.current = false;

    const sessionsPlayed = getSessionsPlayed();
    if (!shouldShowRatingPrompt({ sessionsPlayed })) return;

    const timer = setTimeout(() => {
      const attemptNumber = recordRatingPromptShown({ sessionsPlayed });
      setRatingPromptAttemptNumber(attemptNumber);
      setRatingModalOpen(true);
      trackRatingPromptShown({ attemptNumber, successfulRounds: getSuccessfulRounds() });
    }, 1500);
    return () => clearTimeout(timer);
  }, [view]);

  // Timer Effect (millisecond precision)
  useEffect(() => {
    if (timerRunning && view === 'game') {
      const startTime = Date.now() - elapsedTime;
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 30);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning, elapsedTime, view]);

  // Stage Set Progression State (5 Images = 1 Single Stage)
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const stageTimesRef = useRef([]);
  const [totalStageTimeMs, setTotalStageTimeMs] = useState(0);

  // Handle Game Launch from Main Menu
  const handleStartGame = async () => {
    setVictoryModalOpen(false);
    logApp('INFO', `[StartGameClicked] Theme: ${selectedTheme}, Diff: ${selectedDifficulty}, DebugMode: ${debugMode}`);
    setGameMode('standard');
    setCurrentStageIndex(0);
    stageTimesRef.current = [];
    setTotalStageTimeMs(0);
    setScore(0);
    setMagnifierEnabled(false);

    // Track whether this is a 1st attempt on a deterministic set
    const isDeterministicPhotoSet = selectedTheme === 'find_the_sniper' && Boolean(photoSetId);
    const isFirst = isDeterministicPhotoSet
      ? isFirstAttemptForSet(difficultyStats, selectedDifficulty, photoSetId)
      : false;
    setIsCurrentRunFirstAttempt(isFirst);
    if (isDeterministicPhotoSet) {
      const attemptInfo = {
        difficulty: selectedDifficulty,
        themeId: selectedTheme,
        setId: photoSetId,
        stageKey: photoSetId,
        isFirstAttempt: isFirst
      };
      activeSetAttemptRef.current = attemptInfo;
      recordSetAttemptStarted(attemptInfo);
    } else {
      activeSetAttemptRef.current = null;
    }

    // 1. ABSTRACT CATEGORY: ALWAYS generates procedural art images across 12 distinct art worlds
    trackGameStarted({ themeId: selectedTheme, difficulty: selectedDifficulty, mode: activeMode });

    if (selectedTheme === 'abstract_animated') {
      const procLevels = [0, 1, 2, 3, 4].map(i => generateProceduralLevelPair('abstract_animated', selectedDifficulty, Date.now() + i * 1000));
      logApp('INFO', `[StartGame:AbstractProcedural] Launching 5 procedural levels: ${procLevels.map(l => l.id).join(', ')}`);
      setLevels(procLevels);
      startLevel(procLevels[0].id);
      setView('game');
      return;
    }

    // 2. PHOTOGRAPHY CATEGORY: ALWAYS uses curated premade real-world photo pairs
    try {
      if (debugMode) {
        const pool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
        const effectivePool = pool.length > 0 ? pool : getAllPhotoPairEntries();
        if (effectivePool.length > 0) {
          const debugLevels = effectivePool.map(createPhotoPairLevel);
          logApp('INFO', `[StartGame:Debug] Launching ${debugLevels.length} candidate levels for curation`);
          setLevels(debugLevels);
          const startId = (currentLevelId && effectivePool.some(e => e.id === currentLevelId))
            ? currentLevelId
            : effectivePool[0].id;
          startLevel(startId);
          setView('game');
          return;
        }
      }

      if (!photoSetId || !photoSetIds.includes(photoSetId)) {
        logApp('WARN', '[StartGame:PhotoSetUnavailable] No valid Photography set is selected');
        return;
      }

      const stageList = await buildPhotoPairStage({
        packId: 'find_the_sniper',
        setId: photoSetId,
        difficulty: selectedDifficulty,
        count: 5,
        seed: Date.now(),
        curatedStatusMap
      });
      if (stageList && stageList.length > 0) {
        logApp('INFO', `[StartGame:PhotoStageBuilt] Launching 5 photo levels: ${stageList.map(l => l.id).join(', ')}`);
        // A stage carrying a placeholder is not a fair run at the set's
        // content, so it must not consume the player's first attempt.
        if (!countsAsAttempt(stageList)) {
          logApp('INFO', `[StartGame:PlaceholderStage] ${photoSetId} has unavailable artwork -- not recording an attempt`);
          setIsCurrentRunFirstAttempt(false);
          activeSetAttemptRef.current = null;
          clearActiveSetAttempt();
        }
        setLevels(stageList);
        startLevel(stageList[0].id);
        setView('game');
        return;
      }
      logApp('WARN', `[StartGame:PhotoSetUnavailable] Photo set could not be loaded: ${photoSetId}`);
    } catch (err) {
      logApp('ERROR', `[StartGame:Error] ${err?.message || err}`);
    }
  };

  // Launch Set of the Day (3-image sequence from unrepeated daily queue)
  const handleStartDailyChallenge = () => {
    sounds.playTap();
    if (!canAttemptDaily() && !debugMode) {
      logApp('INFO', '[DailyChallenge] Daily challenge already attempted today');
      return;
    }
    // Ensure debug runs use the latest OTA/Firebase queue before resolving the set.
    if (debugMode) {
      syncRemoteDailyQueue().catch(() => {});
    }

    // Start session locally & remotely
    startDailyChallengeSession().then(session => {
      if (session && !session.allowed && !debugMode) {
        logApp('INFO', '[DailyChallenge] Remote attempt already exists for today');
        setIsDailyCompleted(true);
      }
    }).catch(() => {});

    if (!debugMode) {
      setIsDailyCompleted(true);
    }
    let dailyLevels;
    if (debugMode) {
      logApp('INFO', '[StartDailyChallenge:Debug] Requesting three-image daily queue set');
      dailyLevels = getDailySetForDate();
    } else {
      logApp('INFO', '[StartDailyChallenge] Requesting today\'s 3-image sequence');
      dailyLevels = getDailySetForDate();
    }

    if (!dailyLevels || dailyLevels.length === 0) {
      logApp('WARN', '[DailyChallenge] No daily levels found in catalog');
      return;
    }

    setGameMode('daily');
    setCurrentStageIndex(0);
    stageTimesRef.current = [];
    setTotalStageTimeMs(0);
    setScore(0);
    setMagnifierEnabled(false);
    setLevels(dailyLevels);
    startLevel(dailyLevels[0].id);
    setView('game');

    trackGameStarted({
      themeId: 'daily_challenge',
      difficulty: 'Medium',
      mode: activeMode,
      totalLevelsInStage: dailyLevels.length
    });
    logApp('INFO', `[DailyChallenge] Launching ${dailyLevels.length}-image daily sequence: ${dailyLevels.map(l => l.id).join(', ')}`);
  };

  // Difference Found Handler
  const handleDiffFound = (diffId) => {
    if (foundDiffs.includes(diffId)) return;

    const updatedFound = [...foundDiffs, diffId];
    setFoundDiffs(updatedFound);

    const pointsEarned = calculateSpeedPoints(elapsedTime);
    setScore(prev => prev + pointsEarned);

    if (activeHintId === diffId) {
      setActiveHintId(null);
    }

    // Single difference found on current image!
    if (updatedFound.length >= currentLevel.totalDifferences) {
      setTimerRunning(false);
      stageTimesRef.current[currentStageIndex] = elapsedTime;

      const totalHintsForDiff = selectedDifficulty === 'Easy' ? 4 : selectedDifficulty === 'Medium' ? 3 : 2;
      trackImagePairCompleted({
        result: 'win',
        level: currentLevel,
        selectedTheme,
        elapsedTimeMs: elapsedTime,
        missCount,
        hintsUsed: Math.max(0, totalHintsForDiff - hintsLeft),
        scoreEarned: pointsEarned,
        stageIndex: currentStageIndex
      });

      const nextIndex = currentStageIndex + 1;
      const totalStageImages = gameMode === 'daily' ? 3 : (levels.length > 0 ? levels.length : 5);

      if (nextIndex < totalStageImages) {
        setTimeout(() => {
          setCurrentStageIndex(nextIndex);
          const nextLevel = levels[nextIndex];
          if (nextLevel) {
            startLevel(nextLevel.id);
          }
        }, 350);
      } else {
        // FULL STAGE / SEQUENCE CLEAR!
        // A "successful round" for the rating-prompt cheatsheet: a full stage/set win,
        // the moment a results screen (VictoryModal / DailyVictoryModal) actually shows.
        incrementSuccessfulRounds();
        justWonRoundRef.current = true;
        clearActiveSetAttempt();
        activeSetAttemptRef.current = null;
        setIsCurrentRunFirstAttempt(false);

        const cumulativeTime = stageTimesRef.current.slice(0, totalStageImages).reduce((sum, t) => sum + (t || 0), 0);
        setTotalStageTimeMs(cumulativeTime);
        const stageTotalScore = score + pointsEarned;

        // Persist each completed photo entry with the identity of the fixed
        // set that supplied the ordered stage. The per-entry elapsed time is
        // retained for image history while the set metadata makes the record
        // suitable for set-scoped competition.
        if (gameMode !== 'daily' && selectedTheme === 'find_the_sniper' && photoSetId) {
          const entryIds = levels.slice(0, totalStageImages).map(level => level.id);
          const priorSet = difficultyStats[selectedDifficulty]?.sets?.[photoSetId];
          const isFirstSetCompletion = !priorSet?.firstTime && !priorSet?.firstFailed;
          levels.slice(0, totalStageImages).forEach((level, index) => {
            saveImageProgress({
              imageId: level.id,
              packId: selectedTheme,
              title: level.title,
              completionTimeMs: stageTimesRef.current[index] || 0,
              isFirstSeen: isFirstSetCompletion,
              clears: (priorSet?.clears || 0) + 1,
              setId: photoSetId,
              entryIds
            }).catch(() => {});
          });

          // Submit to durable photoSet and category leaderboards
          submitLeaderboardScore({
            boardType: 'photoSet',
            boardId: photoSetId,
            score: cumulativeTime,
            metric: 'elapsedMs'
          }).catch(() => {});

          submitLeaderboardScore({
            boardType: 'category',
            boardId: selectedTheme === 'find_the_sniper' ? 'photo' : 'abstract',
            score: cumulativeTime,
            metric: 'elapsedMs'
          }).catch(() => {});
        }

        // Daily Challenge Mode (3 Images Sequence) Completion
        if (gameMode === 'daily') {
          markFirstSetCompleted();
          setHasCompletedFirstSetState(true);
          setIsDailyCompleted(true);

          const dailyResult = recordDailyChallengeCompletion({
            dateStr: levels?.dateStr,
            totalTimeMs: cumulativeTime,
            setId: levels?.dailySetId,
            entryIds: levels?.entryIds || levels.slice(0, 3).map(level => level.id)
          });

          // Sync completion to Firestore live daily leaderboard asynchronously
          recordDailyChallengeCompletionRemote({
            dateStr: levels?.dateStr,
            setId: levels?.dailySetId,
            entryIds: levels?.entryIds || levels.slice(0, 3).map(level => level.id),
            totalTimeMs: cumulativeTime
          }).then(remoteResult => {
            if (remoteResult) {
              setDailyVictoryData(prev => prev ? {
                ...prev,
                position: remoteResult.position,
                totalPlayers: remoteResult.totalPlayers
              } : null);
            }
          }).catch(() => {});

          // Mirror to Game Center if signed in
          mirrorRoundToGameCenter({
            elapsedTimeMs: cumulativeTime,
            difficulty: 'Medium',
            isPersonalBest: dailyResult.isNewRecord,
            score: stageTotalScore,
            stars: dailyResult.stars
          }).catch(() => {});

          trackStageCleared({
            selectedTheme: 'daily_challenge',
            selectedDifficulty: 'Medium',
            totalStageTimeMs: cumulativeTime,
            totalStageScore: stageTotalScore,
            imagesInStageCount: 3
          });

          logApp('INFO', `[DailyChallengeCleared] Time: ${cumulativeTime}ms, Rank: #${dailyResult.position}, Stars: ${dailyResult.stars}`);

          const dailySetId = levels?.dailySetId || dailyResult?.setId || 'daily_set_1';
          const dailySetNum = getSetNumber(dailySetId) || 1;

          setTimeout(() => {
            setDailyVictoryData({
              isOpen: true,
              totalTimeMs: cumulativeTime,
              score: stageTotalScore || score,
              setId: dailySetId,
              setNumber: dailySetNum,
              position: dailyResult.position,
              totalPlayers: dailyResult.totalPlayers,
              stars: dailyResult.stars,
              isNewRecord: dailyResult.isNewRecord,
              isFailed: false,
              stageIndex: 2
            });
          }, 500);
          return;
        }

        markFirstSetCompleted();
        setHasCompletedFirstSetState(true);

        trackStageCleared({
          selectedTheme,
          selectedDifficulty,
          totalStageTimeMs: cumulativeTime,
          totalStageScore: stageTotalScore,
          imagesInStageCount: totalStageImages
        });

        // Trigger lifecycle notification scheduling (+2hr welcome, +5day retention).
        // Delayed 10s so the native permission prompt doesn't interrupt the victory celebration.
        setTimeout(() => {
          scheduleInstallNotifications().catch(() => {});
        }, 10000);

        if (incomingChallenge) {
          const playerSec = Number((cumulativeTime / 1000).toFixed(2));
          const targetSec = incomingChallenge.targetTimeSec;
          const playerWon = playerSec <= targetSec;
          trackChallengeMatchCompleted({
            challengerName: incomingChallenge.challengerName,
            targetTimeSec: targetSec,
            playerTimeSec: playerSec,
            playerWon,
            difficulty: selectedDifficulty,
            themeId: selectedTheme
          });
        }

        // Compute Categorized Stats for full 5-image stage
        setDifficultyStats(prev => {
          const diffCategory = selectedDifficulty;
          const categoryData = prev[diffCategory] || { setsCleared: 0, totalPoints: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} };
          // Curated Photo Mode stages are identified by their stable set ID so
          // repeat attempts update the same record. Procedural/legacy stages
          // retain their historical generated key behavior.
          const isDeterministicPhotoSet = selectedTheme === 'find_the_sniper' && Boolean(photoSetId);
          const stageKey = isDeterministicPhotoSet ? photoSetId : `stage_${selectedTheme}_${Date.now()}`;
          const stageEntryIds = levels.slice(0, totalStageImages).map(level => level.id);
          const setData = categoryData.sets[stageKey] || {
            title: `Stage Set`,
            firstTime: null,
            fastestRepeat: null,
            fastestTime: null,
            clears: 0,
            attempts: 0,
            firstFailed: false,
            totalPoints: 0,
            ...(isDeterministicPhotoSet ? { setId: photoSetId, entryIds: stageEntryIds } : {})
          };

          const isFirstTime = !setData.firstTime && !setData.firstFailed;
          const newFirstTime = isFirstTime ? cumulativeTime : (setData.firstTime || (setData.firstFailed ? 'failed' : null));
          const newFastestRepeat = isDeterministicPhotoSet
            ? (isFirstTime ? (setData.fastestRepeat || null) : (!setData.fastestRepeat || cumulativeTime < setData.fastestRepeat ? cumulativeTime : setData.fastestRepeat))
            : (!setData.fastestRepeat || cumulativeTime < setData.fastestRepeat ? cumulativeTime : setData.fastestRepeat);
          const newSetTotalPoints = (setData.totalPoints || 0) + stageTotalScore;

          const previousBest = isFirstTime ? null : (setData.fastestTime || Math.min(...[setData.firstTime, setData.fastestRepeat].filter(t => typeof t === 'number' && t > 0)));
          const isPb = isDeterministicPhotoSet
            ? (isFirstTime || cumulativeTime < previousBest)
            : checkAndUpdateDynamicSetRecord(cumulativeTime).isNewRecord;

          setLastSetCompletionInfo({
            setId: isDeterministicPhotoSet ? photoSetId : null,
            setNumber: isDeterministicPhotoSet ? getSetNumber(photoSetId) : null,
            attemptNumber: isDeterministicPhotoSet ? (Math.max(setData.attempts || 0, setData.clears || 0) + 1) : null,
            isPersonalBest: isPb
          });

          const updatedSetData = {
            title: `5-Image Stage (${selectedTheme === 'find_the_sniper' ? 'Photography' : 'Abstract'})`,
            packId: selectedTheme,
            ...(isDeterministicPhotoSet ? { setId: photoSetId, entryIds: stageEntryIds } : {}),
            firstFailed: Boolean(setData.firstFailed || setData.firstTime === 'failed'),
            firstTime: newFirstTime,
            fastestRepeat: newFastestRepeat,
            fastestTime: Math.min(...[newFirstTime, newFastestRepeat].filter(time => typeof time === 'number' && time > 0)),
            clears: (setData.clears || 0) + 1,
            attempts: (setData.attempts || 0) + 1,
            totalPoints: newSetTotalPoints,
            lastScore: stageTotalScore,
            bestScore: Math.max(setData.bestScore || 0, setData.lastScore || 0, stageTotalScore)
          };

          const updatedSets = { ...categoryData.sets, [stageKey]: updatedSetData };
          const setsClearedCount = Object.keys(updatedSets).length;

          const allFirstTimes = Object.values(updatedSets).map(s => s.firstTime).filter(t => typeof t === 'number' && t > 0);
          const allRepeats = Object.values(updatedSets).map(s => s.fastestRepeat).filter(t => typeof t === 'number' && t > 0);
          const overallFirstTime = allFirstTimes.length > 0 ? Math.min(...allFirstTimes) : null;
          const overallRepeat = allRepeats.length > 0 ? Math.min(...allRepeats) : null;

          const categoryTotalPoints = (categoryData.totalPoints || 0) + stageTotalScore;
          const totalClearsAcrossCategory = Object.values(updatedSets).reduce((sum, s) => sum + (s.clears || 1), 0);

          const newStats = {
            ...prev,
            [diffCategory]: {
              setsCleared: setsClearedCount,
              totalPoints: categoryTotalPoints,
              avgPointsPerSet: totalClearsAcrossCategory > 0 ? Math.round(categoryTotalPoints / totalClearsAcrossCategory) : 0,
              fastestFirstTimeOverall: overallFirstTime,
              fastestRepeatOverall: overallRepeat,
              sets: updatedSets
            }
          };

          try {
            localStorage.setItem('diff_hunter_categorized_stats', JSON.stringify(newStats));
            saveLeaderboardStats(newStats);
          } catch (e) {}

          return newStats;
        });

        setTimeout(() => {
          setVictoryModalOpen(true);
        }, 500);
      }
    }
  };

  // Handle Miss Tap (3 Strikes -> Game Over)
  const handleMissTap = () => {
    if (gameOverModalOpen || revealAnswer) return;
    setMissCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        try { sounds.playLose(); } catch (_) {}
        setTimerRunning(false);
        setRevealAnswer(true);

        if (gameMode !== 'daily' && activeSetAttemptRef.current?.isFirstAttempt) {
          const attempt = activeSetAttemptRef.current;
          setDifficultyStats(prev => markSetFirstAttemptFailed(prev, attempt));
          activeSetAttemptRef.current = null;
          clearActiveSetAttempt();
        }

        const totalHintsForDiff = selectedDifficulty === 'Easy' ? 4 : selectedDifficulty === 'Medium' ? 3 : 2;
        trackImagePairCompleted({
          result: 'lose',
          level: currentLevel,
          selectedTheme,
          elapsedTimeMs: elapsedTime,
          missCount: 3,
          hintsUsed: Math.max(0, totalHintsForDiff - hintsLeft),
          scoreEarned: 0,
          stageIndex: currentStageIndex
        });

        // Spotlight correct answer for 2.5s before opening modal
        setTimeout(() => {
          if (gameMode === 'daily') {
            recordDailyChallengeFailureRemote({
              stageIndex: currentStageIndex
            }).catch(() => {});
            setIsDailyCompleted(true);
            const cumulativeTime = stageTimesRef.current.slice(0, currentStageIndex).reduce((sum, t) => sum + (t || 0), 0) + elapsedTime;
            setDailyVictoryData({
              isOpen: true,
              totalTimeMs: cumulativeTime,
              position: null,
              totalPlayers: null,
              stars: 0,
              isNewRecord: false,
              isFailed: true,
              stageIndex: currentStageIndex
            });
          } else {
            setGameOverModalOpen(true);
          }
        }, 2500);
      }
      return next;
    });

    const penaltyMs = 5000;
    if (activeMode !== 'zen') {
      setElapsedTime(prev => prev + penaltyMs);
      setMissPenaltyTick(prev => prev + 1);
    }
  };

  // Hint Logic
  const handleUseHint = () => {
    if (hintsLeft <= 0) return;
    const unfound = currentLevel.diffs.filter(d => !foundDiffs.includes(d.id));
    if (unfound.length > 0) {
      const randomDiff = unfound[Math.floor(Math.random() * unfound.length)];
      setActiveHintId(randomDiff.id);
      setHintsLeft(prev => prev - 1);
    }
  };

  // Custom Level Saved
  const handleSaveCustomLevel = (customLevel) => {
    setLevels(prev => [...prev, customLevel]);
    setView('game');
    startLevel(customLevel.id);
  };

  // Back navigation with confirmation modal while in an active game
  const handleRequestBack = () => {
    if (view === 'game') {
      setConfirmExitModalOpen(true);
    } else {
      setView('menu');
    }
  };

  const handleConfirmExit = () => {
    setConfirmExitModalOpen(false);
    setTimerRunning(false);
    setMagnifierEnabled(false);
    if (gameMode === 'daily') {
      if (!debugMode) {
        recordDailyChallengeFailureRemote({ stageIndex: currentStageIndex }).catch(() => {});
        setIsDailyCompleted(true);
      }
      try { sounds.playLose(); } catch (_) {}
      const cumulativeTime = stageTimesRef.current.slice(0, currentStageIndex).reduce((sum, t) => sum + (t || 0), 0) + elapsedTime;
      setDailyVictoryData({
        isOpen: true,
        totalTimeMs: cumulativeTime,
        position: null,
        totalPlayers: null,
        stars: 0,
        isNewRecord: false,
        isFailed: true,
        isForfeit: true,
        stageIndex: currentStageIndex
      });
      return;
    }
    if (activeSetAttemptRef.current?.isFirstAttempt) {
      const attempt = activeSetAttemptRef.current;
      setDifficultyStats(prev => markSetFirstAttemptFailed(prev, attempt));
      activeSetAttemptRef.current = null;
      setIsCurrentRunFirstAttempt(false);
      clearActiveSetAttempt();
    }
    setView('menu');
  };

  const handleCancelExit = () => {
    setConfirmExitModalOpen(false);
    if (view === 'game') {
      setTimerRunning(true);
    }
  };

  // Sound Mute Toggle
  const handleToggleMute = (val) => {
    setMuted(val);
    sounds.setMuted(val);
  };

  // Custom Level Creator
  const handleOpenCreator = () => {
    sounds.playTap();
    setView('creator');
  };

  const handleOpenSetLeaderboard = (targetSetId = '') => {
    setSelectedStatsSetId(targetSetId || '');
    setStatsInitialTab('leaderboards');
    setView('stats');
  };

  const handleOpenLeaderboard = () => {
    setStatsInitialTab('leaderboards');
    setView('stats');
  };

  const handleOpenProgress = () => {
    setStatsInitialTab('progress');
    setView('stats');
  };

  const handleOpenDailyLeaderboard = () => {
    setStatsInitialTab('daily');
    setView('stats');
  };

  return (
    <div className="app-container">
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}
      <div className="app-content">
        {/* Persistent Top Header (Menu & Stats only; in game if debug) */}
        <Header
          view={view}
          onBack={handleRequestBack}
          muted={muted}
          setMuted={handleToggleMute}
          onOpenLeaderboard={handleOpenLeaderboard}
          onOpenProgress={handleOpenProgress}
          onOpenHelp={() => setHelpModalOpen(true)}
          onOpenDiagnostics={() => setDiagnosticsModalOpen(true)}
          onToggleDebug={toggleDebugMode}
          debugMode={debugMode}
        />

        {/* View Switcher */}
        <div key={view} className="screen-view-transition">
        {view === 'menu' ? (
          <MainMenu
            onStartGame={handleStartGame}
            selectedTheme={selectedTheme}
            setSelectedTheme={setSelectedTheme}
            photoSetIds={photoSetIds}
            photoSetId={photoSetId}
            onPhotoSetChange={handlePhotoSetChange}
            selectedDifficulty={selectedDifficulty}
            setSelectedDifficulty={setSelectedDifficulty}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            onOpenLeaderboard={handleOpenLeaderboard}
            onOpenStats={() => {
              setStatsInitialTab('leaderboards');
              setView('stats');
            }}
            onOpenCreator={handleOpenCreator}
            debugMode={debugMode}
            onToggleDebug={toggleDebugMode}
            onOpenHelp={() => setHelpModalOpen(true)}
            onOpenShareChallenge={() => setShareChallengeModalOpen(true)}
            hasCompletedFirstSet={hasCompletedFirstSetState}
            tutorialAnimationEnabled={tutorialAnimationEnabled}
            onToggleTutorialAnimation={handleToggleTutorialAnimation}
            onRefreshRemotePacks={handleRefreshRemotePacks}
            remotePackSync={remotePackSync}
            simulatedOffline={simulatedOffline}
            onToggleSimulatedOffline={handleToggleSimulatedOffline}
            noticeSlot={
              <OfflineSetNotice
                visible={switchedOffRemoteSet}
                onDismiss={() => setSwitchedOffRemoteSet(false)}
              />
            }
            bannerSlot={
              (!isDailyCompleted || debugMode) && (
                <SetOfTheDayBanner
                  onStartDaily={handleStartDailyChallenge}
                  onOpenDailyLeaderboard={handleOpenDailyLeaderboard}
                  onResetDaily={handleResetDailyChallenge}
                  forceShow={debugMode}
                  debugMode={debugMode}
                />
              )
            }
          />
        ) : view === 'stats' ? (
          <ProgressModal
            isOpen={true}
            onClose={() => setView('menu')}
            difficultyStats={difficultyStats}
            onStartDaily={handleStartDailyChallenge}
            onResetDaily={handleResetDailyChallenge}
            initialTab={statsInitialTab}
            initialSetId={selectedStatsSetId}
            debugMode={debugMode}
            onResetLocalRecords={handleResetLocalRecords}
          />
        ) : view === 'creator' ? (
          <CustomLevelMaker onSaveCustomLevel={handleSaveCustomLevel} />
        ) : (
          <main>
          {/* Debug Curator Bar */}
          {debugMode && (
            <DebugCuratorBar
              currentLevel={currentLevel}
              curatedStatusMap={curatedStatusMap}
              onSetStatus={handleSetCuratedStatus}
              onSetCategory={handleSetCuratedCategory}
              onPruneDismissed={handlePruneDismissed}
              onNextPair={handleNextPair}
              onPrevPair={handlePrevPair}
              onOpenDiagnostics={() => setDiagnosticsModalOpen(true)}
              skipKeptLevels={skipKeptLevels}
              onToggleSkipKept={handleToggleSkipKept}
              gameMode={gameMode}
            />
        )}
          {/* Clean Unified Game Timer & Controls Bar */}
          <TimerDisplay
            elapsedTime={elapsedTime}
            hintsLeft={hintsLeft}
            onUseHint={handleUseHint}
            magnifierEnabled={magnifierEnabled}
            setMagnifierEnabled={setMagnifierEnabled}
            score={score}
            mode={activeMode}
            missCount={missCount}
            currentStageIndex={gameMode === 'daily' ? (levels.findIndex(l => l.id === currentLevelId) >= 0 ? levels.findIndex(l => l.id === currentLevelId) : currentStageIndex) : (debugMode ? (effectiveDebugPool.findIndex(e => e.id === currentLevelId) >= 0 ? effectiveDebugPool.findIndex(e => e.id === currentLevelId) : currentStageIndex) : currentStageIndex)}
            totalStageImages={gameMode === 'daily' && !debugMode ? 3 : (gameMode === 'daily' ? levels.length : (debugMode ? effectiveDebugPool.length : (levels.length || 5)))}
            selectedDifficulty={selectedDifficulty}
            onBack={handleRequestBack}
            debugMode={debugMode}
            muted={muted}
            setMuted={handleToggleMute}
            missPenaltyTick={missPenaltyTick}
          />

          {/* Interactive Dual Viewport (IMAGES ONLY) */}
          <GameCanvas
            level={currentLevel}
            foundDiffs={foundDiffs}
            onDiffFound={handleDiffFound}
            onMissTap={handleMissTap}
            activeHintId={activeHintId}
            magnifierEnabled={magnifierEnabled}
            setMagnifierEnabled={setMagnifierEnabled}
            elapsedTime={elapsedTime}
            revealAnswer={revealAnswer}
            debugMode={debugMode}
          />
        </main>
      )}
      </div>
      </div>

      {/* Modals */}
      <VictoryModal
        isOpen={victoryModalOpen}
        level={currentLevel}
        elapsedTime={totalStageTimeMs || elapsedTime}
        score={score}
        difficulty={selectedDifficulty}
        themeId={selectedTheme}
        isStageSet={true}
        incomingChallenge={incomingChallenge}
        setId={lastSetCompletionInfo?.setId}
        setNumber={lastSetCompletionInfo?.setNumber}
        attemptNumber={lastSetCompletionInfo?.attemptNumber}
        isPersonalBestForSet={lastSetCompletionInfo?.isPersonalBest}
        onOpenLeaderboard={() => {
          const targetSetId = lastSetCompletionInfo?.setId;
          setVictoryModalOpen(false);
          if (targetSetId) {
            handleOpenSetLeaderboard(targetSetId);
          } else {
            handleOpenLeaderboard();
          }
        }}
        onNextLevel={handleStartGame}
        onRestart={handleStartGame}
        onReturnToMenu={() => {
          setVictoryModalOpen(false);
          setView('menu');
        }}
        onClose={() => setVictoryModalOpen(false)}
      />

      {/* Set of the Day Completion / Finish Modal */}
      {dailyVictoryData?.isOpen && (
        <DailyVictoryModal
          isOpen={Boolean(dailyVictoryData?.isOpen)}
          totalTimeMs={dailyVictoryData?.totalTimeMs}
          score={dailyVictoryData?.score}
          setId={dailyVictoryData?.setId}
          setNumber={dailyVictoryData?.setNumber}
          position={dailyVictoryData?.position}
          stars={dailyVictoryData?.stars}
          isNewRecord={dailyVictoryData?.isNewRecord}
          isFailed={dailyVictoryData?.isFailed}
          isForfeit={dailyVictoryData?.isForfeit}
          onOpenLeaderboard={() => {
            const targetSetId = dailyVictoryData?.setId;
            setDailyVictoryData(null);
            setRevealAnswer(false);
            setGameOverModalOpen(false);
            if (targetSetId) {
              handleOpenSetLeaderboard(targetSetId);
            } else {
              setStatsInitialTab('daily');
              setView('stats');
            }
          }}
          onClose={() => {
            setDailyVictoryData(null);
            setRevealAnswer(false);
            setGameOverModalOpen(false);
            setView('menu');
          }}
        />
      )}

      <GameOverModal
        isOpen={gameOverModalOpen}
        onClose={() => {
          setGameOverModalOpen(false);
          setRevealAnswer(false);
          setIsCurrentRunFirstAttempt(false);
          setView('menu');
        }}
        onRestart={() => {
          setGameOverModalOpen(false);
          setRevealAnswer(false);
          handleStartGame();
        }}
        elapsedTime={elapsedTime}
        missCount={missCount}
        levelTitle={currentLevel?.title || 'Stage Set'}
        setId={photoSetId}
        themeId={selectedTheme}
        isFirstAttempt={isCurrentRunFirstAttempt}
      />

      <HelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

      <ConfirmExitModal
        isOpen={confirmExitModalOpen}
        isDaily={gameMode === 'daily'}
        isFirstAttempt={gameMode !== 'daily' && isCurrentRunFirstAttempt}
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
      />

      <RatingModal
        isOpen={ratingModalOpen}
        onClose={() => setRatingModalOpen(false)}
        attemptNumber={ratingPromptAttemptNumber}
      />

      <DiagnosticsModal
        isOpen={diagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
        onPreviewSplash={() => {
          setDiagnosticsModalOpen(false);
          setShowSplash(true);
        }}
        currentLevel={currentLevel}
        selectedTheme={selectedTheme}
        selectedDifficulty={selectedDifficulty}
        activeMode={activeMode}
        debugMode={debugMode}
        levels={levels}
      />

      {debugModalOpen && (
        <DebugLevelGeneratorModal
          isOpen={debugModalOpen}
          onClose={() => setDebugModalOpen(false)}
        />
      )}
    </div>
  );
}
