import React, { useState } from 'react';
import { Play, Award, Sparkles, CheckCircle2, Trophy, Flame, Layers, ArrowRight, ArrowLeft } from 'lucide-react';
import { sounds } from '../utils/audio';
import { SCENE_THEMES } from '../utils/proceduralGenerator';

export default function MainMenu({
  selectedTheme,
  setSelectedTheme,
  selectedDifficulty,
  setSelectedDifficulty,
  onStartGame,
  onOpenProgress,
  onOpenDebug,
  debugMode
}) {
  // Step Wizard State: 'difficulty' (Step 1) -> 'pack' (Step 2)
  const [step, setStep] = useState('difficulty');

  const themeIcons = {
    find_the_sniper: '🎯',
    lego_kingdom: '🧱',
    dense_landscape: '🌲',
    antique_shop: '🔮',
    cyber_arcade: '🌆'
  };

  const difficulties = [
    {
      id: 'Easy',
      name: 'EASY',
      color: 'var(--accent-green)',
      icon: '🟢',
      targetSize: 'Generous Target Radius',
      desc: 'Larger change area on a clean scene.'
    },
    {
      id: 'Medium',
      name: 'MEDIUM',
      color: 'var(--accent-gold)',
      icon: '🟡',
      targetSize: 'Standard Target Radius',
      desc: 'Subtle single difference in dense object clutter.'
    },
    {
      id: 'Hard',
      name: 'HARD / SNIPER',
      color: 'var(--accent-pink)',
      icon: '🔴',
      targetSize: 'Pixel-Tight Radius',
      desc: 'Micro difference hidden inside hyper-cluttered noise!'
    }
  ];

  return (
    <div style={{
      maxWidth: '950px',
      margin: '10px auto 40px auto',
      padding: '0 20px',
      textAlign: 'center',
      animation: 'hitPulse 0.35s ease-out'
    }}>

      {step === 'difficulty' ? (
        /* STEP 1: SELECT DIFFICULTY FIRST */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <Flame size={26} color="var(--accent-pink)" />
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1. SELECT DIFFICULTY
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '18px',
            marginBottom: '32px'
          }}>
            {difficulties.map(diff => {
              const isSelected = selectedDifficulty === diff.id;
              return (
                <div
                  key={diff.id}
                  onClick={() => {
                    sounds.playTap();
                    setSelectedDifficulty(diff.id);
                  }}
                  className="glass-panel"
                  style={{
                    padding: '24px 20px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    border: isSelected ? `3px solid ${diff.color}` : '1px solid var(--border-glass)',
                    boxShadow: isSelected ? `0 0 30px ${diff.color}55` : 'none',
                    transform: isSelected ? 'scale(1.03)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                    position: 'relative'
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      background: diff.color,
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckCircle2 size={18} color="#000" strokeWidth={3} />
                    </div>
                  )}

                  <div style={{ fontSize: '2.8rem', marginBottom: '10px' }}>
                    {diff.icon}
                  </div>

                  <h3 style={{ fontSize: '2.4rem', fontWeight: 900, color: diff.color, marginBottom: '8px', letterSpacing: '-0.5px' }}>
                    {diff.name}
                  </h3>

                  <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.45, fontWeight: 600 }}>
                    {diff.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Step 1 Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '440px', margin: '0 auto' }}>
            <button
              className="glass-btn glass-btn-primary"
              onClick={() => {
                sounds.playTap();
                setStep('pack');
              }}
              style={{
                padding: '16px 32px',
                fontSize: '1.25rem',
                fontWeight: 900,
                justifyContent: 'center',
                borderRadius: '16px',
                boxShadow: '0 6px 35px rgba(0, 240, 255, 0.55)'
              }}
            >
              Next: Select Level Pack <ArrowRight size={22} />
            </button>

            <button
              className="glass-btn"
              onClick={() => {
                sounds.playTap();
                onOpenProgress();
              }}
              style={{
                padding: '13px 24px',
                fontSize: '1rem',
                justifyContent: 'center',
                borderColor: 'var(--accent-gold)',
                color: 'var(--accent-gold)',
                borderRadius: '14px'
              }}
            >
              <Trophy size={18} /> View Speed Records & Progress
            </button>

            {debugMode && onOpenDebug && (
              <button
                className="glass-btn"
                onClick={() => {
                  sounds.playTap();
                  onOpenDebug();
                }}
                style={{
                  padding: '10px 18px',
                  fontSize: '0.82rem',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  borderColor: 'var(--accent-pink)',
                  color: 'var(--accent-pink)'
                }}
              >
                🛠️ Dev Debug Level Generator Pipeline
              </button>
            )}
          </div>
        </div>
      ) : (
        /* STEP 2: SELECT LEVEL PACK NEXT */
        <div>
          {/* Top Return to Step 1 Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button
              className="glass-btn"
              onClick={() => {
                sounds.playTap();
                setStep('difficulty');
              }}
              style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '12px' }}
            >
              <ArrowLeft size={18} /> Back to Difficulty
            </button>

            <span style={{
              fontSize: '0.9rem',
              fontWeight: 900,
              padding: '6px 16px',
              borderRadius: '12px',
              background: selectedDifficulty === 'Easy' ? 'rgba(0,255,135,0.2)' : selectedDifficulty === 'Medium' ? 'rgba(255,183,3,0.2)' : 'rgba(255,0,127,0.2)',
              color: selectedDifficulty === 'Easy' ? 'var(--accent-green)' : selectedDifficulty === 'Medium' ? 'var(--accent-gold)' : 'var(--accent-pink)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              MODE: {selectedDifficulty.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <Layers size={26} color="var(--accent-cyan)" />
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              2. SELECT LEVEL PACK
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            {SCENE_THEMES.map(theme => {
              const isSelected = selectedTheme === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => {
                    sounds.playTap();
                    setSelectedTheme(theme.id);
                  }}
                  className="glass-panel"
                  style={{
                    padding: '20px 18px',
                    borderRadius: '18px',
                    cursor: 'pointer',
                    border: isSelected ? '3px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                    boxShadow: isSelected ? '0 0 25px rgba(0, 240, 255, 0.45)' : 'none',
                    transform: isSelected ? 'scale(1.03)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                    position: 'relative'
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: 'var(--accent-cyan)',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckCircle2 size={16} color="#000" strokeWidth={3} />
                    </div>
                  )}

                  <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>
                    {themeIcons[theme.id] || '📷'}
                  </div>

                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: isSelected ? '#fff' : 'var(--text-main)', marginBottom: '4px', lineHeight: 1.2 }}>
                    {theme.title}
                  </h3>

                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {theme.category}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step 2 Start Action */}
          <div style={{ maxWidth: '440px', margin: '0 auto' }}>
            <button
              className="glass-btn glass-btn-primary"
              onClick={() => {
                sounds.playWin();
                onStartGame();
              }}
              style={{
                width: '100%',
                padding: '18px 32px',
                fontSize: '1.3rem',
                fontWeight: 900,
                justifyContent: 'center',
                borderRadius: '18px',
                boxShadow: '0 6px 35px rgba(0, 240, 255, 0.55)'
              }}
            >
              <Play size={24} fill="#000" /> START SPEEDRUN
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
