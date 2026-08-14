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
import { buildPhotoPairStage, getAllPhotoPairEntries, createPhotoPairLevel } from './utils/photoPairLevelLoader';
import { sounds } from './utils/audio';
import { calculateSpeedPoints } from './utils/scoring';
import { saveLeaderboardStats } from './services/playerProgress';
import { getCuratedStatusMap, setLevelCuratedStatus, setLevelCurationMeta, resetCuratedStatusMap, getLevelStatus } from './utils/curationStore';

export default function App() {
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [currentLevelId, setCurrentLevelId] = useState(INITIAL_LEVELS[0].id);
  const [view, setView] = useState('menu'); // 'menu' | 'game' | 'creator' | 'stats'
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium'); // 'Easy' | 'Medium' | 'Hard'
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
  const visitedDebugLevelIdsRef = useRef(new Set());

  // Curated Image Decisions Store State
  const [curatedStatusMap, setCuratedStatusMap] = useState(() => getCuratedStatusMap());

  const handleSetCuratedStatus = (levelId, status, meta) => {
    const updated = setLevelCuratedStatus(levelId, status, meta);
    setCuratedStatusMap({ ...updated });
  };

  const handleSetCuratedCategory = (levelId, packId) => {
    const updated = setLevelCurationMeta(levelId, { packId });
    setCuratedStatusMap({ ...updated });
  };

  const handleResetAllCurated = () => {
    const updated = resetCuratedStatusMap();
    setCuratedStatusMap({ ...updated });
  };

  const getUnlabeledPremadeLevels = (mapToUse = curatedStatusMap) => {
    const allEntries = getAllPhotoPairEntries();
    return allEntries.filter(entry => {
      const statusVal = getLevelStatus(mapToUse[entry.id])?.status;
      return !statusVal; // Only return levels pending review (unlabeled)
    });
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

    if (debugMode && debugSourceMode === 'procedural') {
      const procLevel = generateProceduralLevelPair(selectedTheme, selectedDifficulty, Date.now());
      setLevels([procLevel]);
      startLevel(procLevel.id);
      return;
    }

    if (currentLevelId) {
      visitedDebugLevelIdsRef.current.add(currentLevelId);
    }

    if (debugMode) {
      const unlabeledEntries = getUnlabeledPremadeLevels();
      const unvisitedUnlabeled = unlabeledEntries.filter(entry => !visitedDebugLevelIdsRef.current.has(entry.id));

      const candidateEntries = unvisitedUnlabeled.length > 0
        ? unvisitedUnlabeled
        : unlabeledEntries.length > 0
          ? unlabeledEntries
          : getAllPhotoPairEntries();

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

  const handleToggleDebugSourceMode = (newMode) => {
    setDebugSourceMode(newMode);
    if (newMode === 'procedural') {
      const procLevel = generateProceduralLevelPair(selectedTheme, selectedDifficulty, Date.now());
      setLevels([procLevel]);
      startLevel(procLevel.id);
    } else {
      const unlabeledEntries = getUnlabeledPremadeLevels();
      const candidateEntries = unlabeledEntries.length > 0 ? unlabeledEntries : getAllPhotoPairEntries();
      const debugLevels = candidateEntries.map(createPhotoPairLevel);
      setLevels(debugLevels);
      startLevel(debugLevels[0].id);
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

  const [selectedTheme, setSelectedTheme] = useState('find_the_sniper');

  // Handle Game Launch from Main Menu (Loads Real-World Photo Pairs!)
  const handleStartGame = async () => {
    try {
      if (debugMode && debugSourceMode === 'premade') {
        const unlabeledEntries = getUnlabeledPremadeLevels();
        const candidateEntries = unlabeledEntries.length > 0 ? unlabeledEntries : getAllPhotoPairEntries();
        if (candidateEntries.length > 0) {
          const debugLevels = candidateEntries.map(createPhotoPairLevel);
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
        seed: Date.now()
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

    const newLevel = generateProceduralLevelPair(selectedTheme, selectedDifficulty, Date.now());
    setLevels([newLevel]);
    startLevel(newLevel.id);
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

    // Check Stage Victory
    if (updatedFound.length >= currentLevel.totalDifferences) {
      setTimerRunning(false);
      
      // Compute Categorized Stats (First Time vs Repeat PB)
      setDifficultyStats(prev => {
        const diffCategory = selectedDifficulty;
        const categoryData = prev[diffCategory] || { setsCleared: 0, fastestFirstTimeOverall: null, fastestRepeatOverall: null, sets: {} };
        const setData = categoryData.sets[currentLevel.id] || { title: currentLevel.title, firstTime: null, fastestRepeat: null, clears: 0 };

        const isFirstTime = !setData.firstTime;
        const newFirstTime = isFirstTime ? elapsedTime : setData.firstTime;
        const newFastestRepeat = !setData.fastestRepeat || elapsedTime < setData.fastestRepeat ? elapsedTime : setData.fastestRepeat;

        const updatedSetData = {
          title: currentLevel.title,
          firstTime: newFirstTime,
          fastestRepeat: newFastestRepeat,
          clears: setData.clears + 1
        };

        const updatedSets = { ...categoryData.sets, [currentLevel.id]: updatedSetData };
        const setsClearedCount = Object.keys(updatedSets).length;

        // Overall fastest first-time and repeat across all sets in this difficulty
        const allFirstTimes = Object.values(updatedSets).map(s => s.firstTime).filter(Boolean);
        const allRepeats = Object.values(updatedSets).map(s => s.fastestRepeat).filter(Boolean);
        const overallFirstTime = allFirstTimes.length > 0 ? Math.min(...allFirstTimes) : null;
        const overallRepeat = allRepeats.length > 0 ? Math.min(...allRepeats) : null;

        const newStats = {
          ...prev,
          [diffCategory]: {
            setsCleared: setsClearedCount,
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

      // Show Victory Modal
      setTimeout(() => {
        setVictoryModalOpen(true);
      }, 500);
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
        onOpenProgress={() => setView('stats')}
        onOpenHelp={() => setHelpModalOpen(true)}
        muted={muted}
        setMuted={setMuted}
        onLogoClick={toggleDebugMode}
        debugMode={debugMode}
      />

      {/* Main Navigation Routing */}
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
        <main className="page-fade-in">
          {/* Debug Curator Bar */}
          {debugMode && (
            <DebugCuratorBar
              currentLevel={currentLevel}
              curatedStatusMap={curatedStatusMap}
              onSetStatus={handleSetCuratedStatus}
              onSetCategory={handleSetCuratedCategory}
              onResetAll={handleResetAllCurated}
              onNextPair={handleNextPair}
              debugSourceMode={debugSourceMode}
              onToggleSourceMode={handleToggleDebugSourceMode}
            />
          )}

          {/* Top Return to Menu Bar */}
          <div style={{ maxWidth: '1300px', margin: '0 auto 10px auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="glass-btn"
              onClick={() => { sounds.playTap(); setView('menu'); }}
              style={{
                padding: '10px 16px',
                fontSize: '0.92rem',
                fontWeight: 800,
                borderRadius: '12px'
              }}
            >
              ← Main Menu
            </button>

            <span style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              color: selectedDifficulty === 'Hard' ? 'var(--accent-pink)' : selectedDifficulty === 'Medium' ? 'var(--accent-gold)' : 'var(--accent-green)',
              background: 'rgba(0,0,0,0.4)',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1.5px solid rgba(255,255,255,0.2)',
              letterSpacing: '0.5px'
            }}>
              {selectedDifficulty.toUpperCase()}
            </span>
          </div>

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
          />

          {/* Interactive Dual Viewport (IMAGES ONLY) */}
          <GameCanvas
            level={currentLevel}
            foundDiffs={foundDiffs}
            onDiffFound={handleDiffFound}
            onMissTap={handleMissTap}
            activeHintId={activeHintId}
            magnifierEnabled={magnifierEnabled}
            debugMode={debugMode}
          />
        </main>
      )}

      {/* Modals */}
      <VictoryModal
        isOpen={victoryModalOpen}
        level={currentLevel}
        elapsedTime={elapsedTime}
        score={score}
        onNextLevel={handleNextPair}
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
