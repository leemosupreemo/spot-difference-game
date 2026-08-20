import React, { useState, useEffect, useRef, useCallback } from 'react';
import MainMenu from './components/MainMenu';
import Header from './components/Header';
import GameCanvas from './components/GameCanvas';
import TimerDisplay from './components/TimerDisplay';
import LevelSelector from './components/LevelSelector';
import CustomLevelMaker from './components/CustomLevelMaker';
import VictoryModal from './components/VictoryModal';
import GameOverModal from './components/GameOverModal';
import ProgressModal from './components/ProgressModal';
import HelpModal from './components/HelpModal';
import DebugLevelGeneratorModal from './components/DebugLevelGeneratorModal';
import DebugCuratorBar from './components/DebugCuratorBar';
import { LEVELS as INITIAL_LEVELS } from './utils/canvasLevels';
import { generateProceduralLevelPair, SCENE_THEMES } from './utils/proceduralGenerator';
import { buildPhotoPairStage, getAllPhotoPairEntries, createPhotoPairLevel, removeManifestEntriesById } from './utils/photoPairLevelLoader';
import { sounds } from './utils/audio';
import { calculateSpeedPoints } from './utils/scoring';
import { saveLeaderboardStats } from './services/playerProgress';
import { getCuratedStatusMap, setLevelCuratedStatus, setLevelCurationMeta, resetCuratedStatusMap, pruneDismissedStatuses, saveCuratedStatusMap, getLevelStatus } from './utils/curationStore';

export default function App() {
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [currentLevelId, setCurrentLevelId] = useState(INITIAL_LEVELS[0].id);
  const [view, setView] = useState('menu'); // 'menu' | 'game' | 'creator' | 'stats'
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium'); // 'Easy' | 'Medium' | 'Hard'
  const [selectedTheme, setSelectedTheme] = useState('find_the_sniper'); // 'find_the_sniper' | 'abstract_animated'
  const [activeMode, setActiveMode] = useState('classic'); // 'classic' | 'blitz' | 'zen'
  
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
  const timerRef = useRef(null);

  // Modals
  const [victoryModalOpen, setVictoryModalOpen] = useState(false);
  const [gameOverModalOpen, setGameOverModalOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [debugModalOpen, setDebugModalOpen] = useState(false);

  // Debug Flag (Hidden by default; enabled via URL ?debug=1 or secret logo tap)
  const [debugMode, setDebugMode] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === '1' || urlParams.get('debug') === 'true') return true;
      return localStorage.getItem('diff_hunter_debug') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [debugSourceMode, setDebugSourceMode] = useState('premade'); // 'premade' | 'procedural'
  const [skipKeptLevels, setSkipKeptLevels] = useState(() => {
    try {
      const saved = localStorage.getItem('diff_hunter_skip_kept');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  const visitedDebugLevelIdsRef = useRef(new Set());
  const debugHistoryStackRef = useRef([]);

  const handleToggleSkipKept = (val) => {
    setSkipKeptLevels(val);
    try {
      localStorage.setItem('diff_hunter_skip_kept', String(val));
    } catch (e) {}
  };

  // Curated Image Decisions Store State
  const [curatedStatusMap, setCuratedStatusMap] = useState(() => getCuratedStatusMap());

  const handleSetCuratedStatus = (levelId, status, meta) => {
    const updated = setLevelCuratedStatus(levelId, status, meta);
    setCuratedStatusMap({ ...updated });

    // Auto-advance to next image pair when approving or dismissing in debug mode
    if (status === 'dismissed' || status === 'approved') {
      setTimeout(() => {
        handleNextPair();
      }, 120);
    }
  };

  const handleSetCuratedCategory = (levelId, packId) => {
    const updated = setLevelCurationMeta(levelId, { packId });
    setCuratedStatusMap({ ...updated });
  };

  const handleResetAllCurated = () => {
    const updated = resetCuratedStatusMap();
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

  const isKeptStatus = (statusVal) => statusVal === 'approved' || statusVal === 'wrong_difficulty';

  const isLevelCategorized = (entry, mapToUse = curatedStatusMap) => {
    const statusObj = getLevelStatus(mapToUse[entry.id]);
    const statusVal = statusObj?.status;
    return Boolean(statusVal || statusObj?.packId || statusObj?.category || statusObj?.difficulty || statusObj?.suggestedDifficulty);
  };

  const getUnlabeledPremadeLevels = (mapToUse = curatedStatusMap, skipKept = skipKeptLevels) => {
    const allEntries = getAllPhotoPairEntries();
    const brandNew = [];
    const otherUnlabeled = [];

    for (const entry of allEntries) {
      const statusObj = getLevelStatus(mapToUse[entry.id]);
      const statusVal = statusObj?.status;
      if (statusVal === 'dismissed') continue;
      if (skipKept && isKeptStatus(statusVal)) continue;

      if (!isLevelCategorized(entry, mapToUse)) {
        if (entry.id?.includes('stock_') || entry.id?.startsWith('ai_macro_')) {
          brandNew.push(entry);
        } else {
          otherUnlabeled.push(entry);
        }
      }
    }

    return [...brandNew, ...otherUnlabeled];
  };

  const getDebugCandidateEntries = (mapToUse = curatedStatusMap, skipKept = skipKeptLevels) => {
    const allEntries = getAllPhotoPairEntries();
    const unreviewedBrandNew = [];
    const unreviewedOther = [];
    const categorized = [];

    for (const entry of allEntries) {
      const statusObj = getLevelStatus(mapToUse[entry.id]);
      const statusVal = statusObj?.status;
      if (statusVal === 'dismissed') continue;
      if (skipKept && isKeptStatus(statusVal)) continue;

      if (!isLevelCategorized(entry, mapToUse)) {
        if (entry.id?.includes('stock_') || entry.id?.startsWith('ai_macro_')) {
          unreviewedBrandNew.push(entry);
        } else {
          unreviewedOther.push(entry);
        }
      } else {
        categorized.push(entry);
      }
    }

    // Non-categorized / brand new image sets prioritized strictly first
    return [...unreviewedBrandNew, ...unreviewedOther, ...categorized];
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

  const handleNextPair = async () => {
    sounds.playTap();

    if (currentLevelId) {
      debugHistoryStackRef.current.push(currentLevelId);
      visitedDebugLevelIdsRef.current.add(currentLevelId);
    }

    if (debugMode && debugSourceMode === 'procedural') {
      const procLevel = generateProceduralLevelPair(selectedTheme, selectedDifficulty, Date.now());
      setLevels([procLevel]);
      startLevel(procLevel.id);
      return;
    }

    if (debugMode) {
      const unreviewed = getUnlabeledPremadeLevels(curatedStatusMap, skipKeptLevels);
      const unvisitedUnreviewed = unreviewed.filter(entry => !visitedDebugLevelIdsRef.current.has(entry.id));

      const fallbackPool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
      const unvisitedFallback = fallbackPool.filter(entry => !visitedDebugLevelIdsRef.current.has(entry.id));

      const candidateEntries = unvisitedUnreviewed.length > 0
        ? unvisitedUnreviewed
        : unreviewed.length > 0
          ? unreviewed
          : unvisitedFallback.length > 0
            ? unvisitedFallback
            : fallbackPool;

      if (candidateEntries.length > 0) {
        const nextBatch = candidateEntries.map(createPhotoPairLevel);
        setLevels(nextBatch);
        startLevel(nextBatch[0].id);
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

    if (debugHistoryStackRef.current.length > 0) {
      const prevId = debugHistoryStackRef.current.pop();
      const allEntries = getAllPhotoPairEntries();
      const prevEntry = allEntries.find(e => e.id === prevId);
      if (prevEntry) {
        const prevLevel = createPhotoPairLevel(prevEntry);
        setLevels([prevLevel]);
        startLevel(prevLevel.id);
        return;
      }
    }

    const currentIndex = levels.findIndex(l => l.id === currentLevelId);
    if (currentIndex > 0) {
      startLevel(levels[currentIndex - 1].id);
    }
  };

  const handleToggleDebugSourceMode = (newMode) => {
    setDebugSourceMode(newMode);
    if (newMode === 'procedural') {
      const procLevel = generateProceduralLevelPair(selectedTheme, selectedDifficulty, Date.now());
      setLevels([procLevel]);
      startLevel(procLevel.id);
    } else {
      const unreviewed = getUnlabeledPremadeLevels(curatedStatusMap, skipKeptLevels);
      const fallbackPool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
      const candidateEntries = unreviewed.length > 0 ? unreviewed : fallbackPool;
      if (candidateEntries.length > 0) {
        const debugLevels = candidateEntries.map(createPhotoPairLevel);
        setLevels(debugLevels);
        startLevel(debugLevels[0].id);
      }
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
    setCurrentLevelId(levelId);
    setFoundDiffs([]);
    setMissCount(0);
    setHintsLeft(selectedDifficulty === 'Easy' ? 4 : selectedDifficulty === 'Medium' ? 3 : 2);
    setActiveHintId(null);
    setElapsedTime(0);
    setTimerRunning(true);
    setVictoryModalOpen(false);
  }, [selectedDifficulty]);

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
  const [stageToastMessage, setStageToastMessage] = useState(null);
  const [totalStageTimeMs, setTotalStageTimeMs] = useState(0);

  // Handle Game Launch from Main Menu (Loads Real-World Photo Pairs!)
  const handleStartGame = async () => {
    setCurrentStageIndex(0);
    stageTimesRef.current = [];
    setTotalStageTimeMs(0);
    setScore(0);

    try {
      if (debugMode && debugSourceMode === 'premade') {
        const unreviewed = getUnlabeledPremadeLevels(curatedStatusMap, skipKeptLevels);
        const fallbackPool = getDebugCandidateEntries(curatedStatusMap, skipKeptLevels);
        const candidateEntries = unreviewed.length > 0 ? unreviewed : fallbackPool;
        if (candidateEntries.length > 0) {
          const debugLevels = candidateEntries.slice(0, 5).map(createPhotoPairLevel);
          setLevels(debugLevels);
          startLevel(debugLevels[0].id);
          setView('game');
          return;
        }
      }

      const stageList = await buildPhotoPairStage({
        packId: selectedTheme,
        difficulty: selectedDifficulty,
        count: 5,
        seed: Date.now(),
        curatedStatusMap
      });
      if (stageList && stageList.length > 0) {
        setLevels(stageList);
        startLevel(stageList[0].id);
        setView('game');
        return;
      }
    } catch (err) {
      console.error('Failed to build photo stage:', err);
    }

    const procLevels = [0, 1, 2, 3, 4].map(i => generateProceduralLevelPair(selectedTheme, selectedDifficulty, Date.now() + i));
    setLevels(procLevels);
    startLevel(procLevels[0].id);
    setView('game');
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

      const nextIndex = currentStageIndex + 1;
      const totalStageImages = levels.length > 0 ? levels.length : 5;

      if (nextIndex < totalStageImages) {
        // IMAGES 1..4 CLEARED! Show Toast and advance automatically after 1.2s!
        setStageToastMessage(`IMAGE ${nextIndex} OF ${totalStageImages} CLEARED! 🎯`);

        setTimeout(() => {
          setStageToastMessage(null);
          setCurrentStageIndex(nextIndex);
          const nextLevel = levels[nextIndex];
          if (nextLevel) {
            setCurrentLevelId(nextLevel.id);
            setFoundDiffs([]);
            setHintsLeft(selectedDifficulty === 'Easy' ? 4 : selectedDifficulty === 'Medium' ? 3 : 2);
            setActiveHintId(null);
            setElapsedTime(0);
            setTimerRunning(true);
          }
        }, 1200);
      } else {
        // ALL 5 IMAGES CLEARED! FULL STAGE CLEAR!
        const cumulativeTime = stageTimesRef.current.reduce((sum, t) => sum + (t || 0), 0);
        setTotalStageTimeMs(cumulativeTime);
        const stageTotalScore = score + pointsEarned;

        // Compute Categorized Stats for full 5-image stage
        setDifficultyStats(prev => {
          const diffCategory = selectedDifficulty;
          const categoryData = prev[diffCategory] || { setsCleared: 0, totalPoints: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} };
          const stageKey = `stage_${selectedTheme}_${Date.now()}`;
          const setData = categoryData.sets[stageKey] || { title: `Stage Set`, firstTime: null, fastestRepeat: null, clears: 0, totalPoints: 0 };

          const isFirstTime = !setData.firstTime;
          const newFirstTime = isFirstTime ? cumulativeTime : setData.firstTime;
          const newFastestRepeat = !setData.fastestRepeat || cumulativeTime < setData.fastestRepeat ? cumulativeTime : setData.fastestRepeat;
          const newSetTotalPoints = (setData.totalPoints || 0) + stageTotalScore;

          const updatedSetData = {
            title: `5-Image Stage (${selectedTheme === 'find_the_sniper' ? 'Photography' : 'Fantastical'})`,
            packId: selectedTheme,
            firstTime: newFirstTime,
            fastestRepeat: newFastestRepeat,
            clears: setData.clears + 1,
            totalPoints: newSetTotalPoints,
            lastScore: stageTotalScore
          };

          const updatedSets = { ...categoryData.sets, [stageKey]: updatedSetData };
          const setsClearedCount = Object.keys(updatedSets).length;

          const allFirstTimes = Object.values(updatedSets).map(s => s.firstTime).filter(Boolean);
          const allRepeats = Object.values(updatedSets).map(s => s.fastestRepeat).filter(Boolean);
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
    if (gameOverModalOpen) return;
    setMissCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        try { sounds.playLose(); } catch (_) {}
        setTimerRunning(false);
        setGameOverModalOpen(true);
      }
      return next;
    });

    const penaltyMs = selectedDifficulty === 'Hard' ? 3000 : 2000;
    if (activeMode !== 'zen') {
      setElapsedTime(prev => prev + penaltyMs);
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

  return (
    <div className="app-container">
      {/* Universal Top Header */}
      <Header
        view={view}
        onBack={() => setView('menu')}
        onOpenLeaderboard={() => setView('stats')}
        onOpenProgress={() => setView('stats')}
        onOpenHelp={() => setHelpModalOpen(true)}
        muted={muted}
        setMuted={setMuted}
        onLogoClick={toggleDebugMode}
        onToggleDebug={toggleDebugMode}
        debugMode={debugMode}
      />

      {/* Main Navigation Routing */}
      <div key={view} className="page-fade-in">
        {view === 'menu' ? (
          <MainMenu
            selectedTheme={selectedTheme}
            setSelectedTheme={setSelectedTheme}
            selectedDifficulty={selectedDifficulty}
            setSelectedDifficulty={setSelectedDifficulty}
            onStartGame={handleStartGame}
            onOpenProgress={() => setView('stats')}
            onOpenDebug={() => setDebugModalOpen(true)}
            debugMode={debugMode}
          />
        ) : view === 'stats' ? (
          <ProgressModal
            isOpen={true}
            onClose={() => setView('menu')}
            difficultyStats={difficultyStats}
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
              onResetAll={handleResetAllCurated}
              onPruneDismissed={handlePruneDismissed}
              onNextPair={handleNextPair}
              onPrevPair={handlePrevPair}
              debugSourceMode={debugSourceMode}
              onToggleSourceMode={handleToggleDebugSourceMode}
              skipKeptLevels={skipKeptLevels}
              onToggleSkipKept={handleToggleSkipKept}
              currentStageIndex={currentStageIndex}
              totalStageImages={levels.length || 5}
            />
          )}

          {/* Floating Stage Transition Toast */}
          {stageToastMessage && (
            <div style={{
              position: 'fixed',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 90,
              background: 'linear-gradient(135deg, var(--accent-green), #00b0ff)',
              color: '#000',
              fontWeight: 900,
              fontSize: '1.2rem',
              padding: '12px 28px',
              borderRadius: '30px',
              boxShadow: '0 0 30px rgba(0, 255, 135, 0.8)',
              animation: 'pageFadeIn 0.2s ease-out'
            }}>
              {stageToastMessage}
            </div>
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
            currentStageIndex={currentStageIndex}
            totalStageImages={levels.length || 5}
            selectedDifficulty={selectedDifficulty}
          />

          {/* Interactive Dual Viewport (IMAGES ONLY) */}
          <GameCanvas
            level={currentLevel}
            foundDiffs={foundDiffs}
            onDiffFound={handleDiffFound}
            onMissTap={handleMissTap}
            activeHintId={activeHintId}
            magnifierEnabled={magnifierEnabled}
            elapsedTime={elapsedTime}
            debugMode={debugMode}
          />
        </main>
      )}
      </div>

      {/* Modals */}
      <VictoryModal
        isOpen={victoryModalOpen}
        level={currentLevel}
        elapsedTime={totalStageTimeMs || elapsedTime}
        score={score}
        onNextLevel={handleStartGame}
        onRestart={handleStartGame}
        onClose={() => setVictoryModalOpen(false)}
      />

      <GameOverModal
        isOpen={gameOverModalOpen}
        onClose={() => {
          setGameOverModalOpen(false);
          setView('menu');
        }}
        onRestart={() => {
          setGameOverModalOpen(false);
          handleStartGame();
        }}
        elapsedTime={elapsedTime}
        missCount={missCount}
        levelTitle={currentLevel?.title || 'Stage Set'}
      />

      <HelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        debugMode={debugMode}
        onToggleDebug={toggleDebugMode}
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
