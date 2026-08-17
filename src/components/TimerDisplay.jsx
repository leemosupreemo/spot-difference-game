import React from 'react';
import { Timer, Lightbulb, Search, Zap, Heart } from 'lucide-react';
import { sounds } from '../utils/audio';
import { calculateSpeedPoints } from '../utils/scoring';

export default function TimerDisplay({
  elapsedTime,
  hintsLeft,
  onUseHint,
  magnifierEnabled,
  setMagnifierEnabled,
  missCount = 0,
  currentStageIndex = 0,
  totalStageImages = 5,
  selectedDifficulty = 'Medium'
}) {
  const potentialPoints = calculateSpeedPoints(elapsedTime);
  const livesRemaining = Math.max(0, 3 - missCount);

  // Format elapsed milliseconds as MM:SS.ms
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((ms % 1000) / 10);

    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
  };

  const handleHintClick = () => {
    if (hintsLeft > 0) {
      sounds.playHint();
      onUseHint();
    }
  };

  const toggleMagnifier = () => {
    sounds.playTap();
    setMagnifierEnabled(!magnifierEnabled);
  };

  const difficultyColor =
    selectedDifficulty === 'Hard'
      ? 'var(--accent-pink)'
      : selectedDifficulty === 'Medium'
      ? 'var(--accent-gold)'
      : 'var(--accent-green)';

  return (
    <div style={{
      width: '100%',
      maxWidth: '1300px',
      margin: '0 auto 10px auto',
      padding: '0 16px',
      boxSizing: 'border-box'
    }}>
      <div className="glass-panel" style={{
        padding: '8px 14px',
        width: '100%',
        borderRadius: '16px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          
          {/* Left Side: Combined Timer + Points, Stage Index, Difficulty, and Lives */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            
            {/* Combined Timer & Live Score Badge */}
            <div style={{
              background: 'rgba(0, 240, 255, 0.08)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              borderRadius: '12px',
              padding: '0 12px',
              height: '36px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Timer size={18} color="var(--accent-cyan)" />
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  textShadow: '0 0 8px rgba(0, 240, 255, 0.4)',
                  lineHeight: 1
                }}>
                  {formatTime(elapsedTime)}
                </span>
              </div>

              <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.2)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={15} color="var(--accent-gold)" />
                <span style={{
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  color: 'var(--accent-gold)',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1
                }}>
                  +{potentialPoints} <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PTS</span>
                </span>
              </div>
            </div>

            {/* Difficulty Badge */}
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              color: difficultyColor,
              background: 'rgba(0, 0, 0, 0.45)',
              padding: '0 11px',
              height: '36px',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              letterSpacing: '0.4px',
              lineHeight: 1
            }}>
              {selectedDifficulty.toUpperCase()}
            </span>

            {/* 3-Heart LIVES Badge */}
            <div style={{
              background: livesRemaining <= 1 ? 'rgba(255, 0, 127, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: livesRemaining <= 1 ? '1px solid var(--accent-pink)' : '1px solid var(--border-glass)',
              borderRadius: '12px',
              padding: '0 10px',
              height: '36px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-pink)', letterSpacing: '0.4px' }}>LIVES</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {[1, 2, 3].map(i => {
                  const active = i <= livesRemaining;
                  return (
                    <Heart
                      key={i}
                      size={16}
                      fill={active ? 'var(--accent-pink)' : 'transparent'}
                      color={active ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.25)'}
                      style={{
                        filter: active ? 'drop-shadow(0 0 5px rgba(255, 0, 127, 0.8))' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Game Controls (Hint & Zoom) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Hint Button */}
            <button
              className={`glass-btn ${hintsLeft > 0 ? '' : 'disabled'}`}
              onClick={handleHintClick}
              disabled={hintsLeft <= 0}
              style={{
                borderColor: hintsLeft > 0 ? 'var(--accent-gold)' : 'transparent',
                color: hintsLeft > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
                opacity: hintsLeft > 0 ? 1 : 0.4,
                padding: '7px 13px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Lightbulb size={17} />
              <span>Hint ({hintsLeft})</span>
            </button>

            {/* Magnifier Toggle */}
            <button
              className={`glass-btn ${magnifierEnabled ? 'glass-btn-primary' : ''}`}
              onClick={toggleMagnifier}
              title="Toggle Magnifier Lens"
              style={{
                padding: '7px 13px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Search size={17} />
              <span>Zoom</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
