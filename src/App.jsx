import React, { useState, useEffect, useRef, useCallback } from 'react';
import MainMenu from './components/MainMenu';
import Header from './components/Header';
import GameCanvas from './components/GameCanvas';
import TimerDisplay from './components/TimerDisplay';
import LevelSelector from './components/LevelSelector';
import CustomLevelMaker from './components/CustomLevelMaker';
import VictoryModal from './components/VictoryModal';
import ProgressModal from './components/ProgressModal';
import HelpModal from './components/HelpModal';
import DebugLevelGeneratorModal from './components/DebugLevelGeneratorModal';
import { LEVELS as INITIAL_LEVELS } from './utils/canvasLevels';
import { generateProceduralLevelPair, SCENE_THEMES } from './utils/proceduralGenerator';
import { sounds } from './utils/audio';

export default function App() {
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [currentLevelId, setCurrentLevelId] = useState(INITIAL_LEVELS[0].id);
  const [view, setView] = useState('menu'); // 'menu' | 'game' | 'creator'
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
    const singleDiff = rawLevel.diffs[0] || { id: 1, x: 50, y: 50, radius: 6, hint: 'Spot the difference!' };
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

  // Handle Game Launch from Main Menu
  const handleStartGame = () => {
    const newLevel = generateProceduralLevelPair(selectedTheme, selectedDifficulty, Date.now());
    setLevels(prev => [...prev, newLevel]);
    setCurrentLevelId(newLevel.id);
    setFoundDiffs([]);
    setMissCount(0);
    setHintsLeft(1);
    setActiveHintId(null);
    setElapsedTime(0);
    setTimerRunning(true);
    setVictoryModalOpen(false);
    setView('game');
  };

  // Difference Found Handler
  const handleDiffFound = (diffId) => {
    if (foundDiffs.includes(diffId)) return;

    const updatedFound = [...foundDiffs, diffId];
    setFoundDiffs(updatedFound);

    // Score multiplier by difficulty
    const diffMultiplier = selectedDifficulty === 'Hard' ? 2.5 : selectedDifficulty === 'Medium' ? 1.5 : 1.0;
    const speedBonus = Math.round(Math.max(100, 500 - Math.floor(elapsedTime / 100)) * diffMultiplier);
    setScore(prev => prev + speedBonus);

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
        } catch (e) {}

        return newStats;
      });

      // Show Victory Modal
      setTimeout(() => {
        setVictoryModalOpen(true);
      }, 500);
    }
  };

  // Handle Miss Tap
  const handleMissTap = () => {
    setMissCount(prev => prev + 1);
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

  // Next Level Handler
  const handleNextLevel = () => {
    const currentIndex = levels.findIndex(l => l.id === currentLevelId);
    const nextIndex = (currentIndex + 1) % levels.length;
    startLevel(levels[nextIndex].id);
  };

  // Custom Level Saved
  const handleSaveCustomLevel = (customLevel) => {
    setLevels(prev => [...prev, customLevel]);
    setView('game');
    startLevel(customLevel.id);
  };

  // Generate Procedural Pair On The Fly
  const handleGenerateProceduralPair = () => {
    const randomTheme = SCENE_THEMES[Math.floor(Math.random() * SCENE_THEMES.length)].id;
    const newLevel = generateProceduralLevelPair(randomTheme, selectedDifficulty, Date.now());
    setLevels(prev => [...prev, newLevel]);
    startLevel(newLevel.id);
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '50px' }}>
      
      {/* Header Bar */}
      {view !== 'stats' && (
        <Header
          muted={muted}
          setMuted={setMuted}
          onOpenLeaderboard={() => setView('stats')}
          onOpenHelp={() => setHelpModalOpen(true)}
          onRestartLevel={() => {
            if (view === 'game') startLevel(currentLevelId);
            else setView('menu');
          }}
          onToggleDebug={toggleDebugMode}
          debugMode={debugMode}
        />
      )}

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
        <main>
          {/* Top Return to Menu Bar */}
          <div style={{ maxWidth: '1300px', margin: '0 auto 10px auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="glass-btn"
              onClick={() => { sounds.playTap(); setView('menu'); }}
              style={{ fontSize: '0.85rem' }}
            >
              ← Main Menu
            </button>

            <span style={{
              fontSize: '1.2rem',
              fontWeight: 900,
              padding: '6px 18px',
              borderRadius: '14px',
              background: selectedDifficulty === 'Easy' ? 'rgba(0,255,135,0.2)' : selectedDifficulty === 'Medium' ? 'rgba(255,183,3,0.2)' : 'rgba(255,0,127,0.2)',
              color: selectedDifficulty === 'Easy' ? 'var(--accent-green)' : selectedDifficulty === 'Medium' ? 'var(--accent-gold)' : 'var(--accent-pink)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              letterSpacing: '0.5px'
            }}>
              {selectedDifficulty.toUpperCase()} MODE
            </span>
          </div>

          {/* Live Millisecond Timer Display */}
          <TimerDisplay
            elapsedTime={elapsedTime}
            totalDiffs={currentLevel.totalDifferences}
            foundCount={foundDiffs.length}
            hintsLeft={hintsLeft}
            onUseHint={handleUseHint}
            magnifierEnabled={magnifierEnabled}
            setMagnifierEnabled={setMagnifierEnabled}
            score={score}
            mode={activeMode}
          />

          {/* Interactive Dual Viewport (IMAGES ONLY) */}
          <GameCanvas
            level={currentLevel}
            foundDiffs={foundDiffs}
            onDiffFound={handleDiffFound}
            onMissTap={handleMissTap}
            activeHintId={activeHintId}
            magnifierEnabled={magnifierEnabled}
          />
        </main>
      )}

      {/* Modals */}
      <VictoryModal
        isOpen={victoryModalOpen}
        levelTitle={currentLevel.title}
        elapsedTime={elapsedTime}
        missCount={missCount}
        score={score}
        stars={1 + (elapsedTime < 25000 ? 1 : 0) + (missCount === 0 ? 1 : 0)}
        onNextLevel={handleNextLevel}
        onRestart={() => startLevel(currentLevelId)}
        onClose={() => setVictoryModalOpen(false)}
      />

      <ProgressModal
        isOpen={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        difficultyStats={difficultyStats}
      />

      <HelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

      <DebugLevelGeneratorModal
        isOpen={debugModalOpen}
        onClose={() => setDebugModalOpen(false)}
        onInjectLevels={(pack) => {
          setLevels(prev => [...prev, ...pack]);
          setCurrentLevelId(pack[0].id);
          startLevel(pack[0].id);
          setView('game');
        }}
      />

    </div>
  );
}
