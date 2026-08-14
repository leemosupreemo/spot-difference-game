import React from 'react';
import { Timer, Lightbulb, Search, Zap } from 'lucide-react';
import { sounds } from '../utils/audio';
import { calculateSpeedPoints } from '../utils/scoring';

export default function TimerDisplay({
  elapsedTime,
  foundCount,
  hintsLeft,
  onUseHint,
  magnifierEnabled,
  setMagnifierEnabled,
  score,
  mode,
  missCount = 0
}) {
  const potentialPoints = calculateSpeedPoints(elapsedTime);

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

  return (
    <div className="glass-panel" style={{ padding: '10px 18px', margin: '10px auto 14px auto', maxWidth: '1300px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* Clock, Total Score, Live Speed Bonus & Fails Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Live Millisecond Clock */}
          <div style={{
            background: 'rgba(0, 240, 255, 0.1)',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            borderRadius: '14px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Timer size={22} color="var(--accent-cyan)" />
            <div className="timer-badge" style={{ fontSize: '1.6rem' }}>
              {formatTime(elapsedTime)}
            </div>
          </div>

          {/* Live Speed Bonus Badge (Counts down 500 -> 25 PTS) */}
          <div style={{
            background: 'rgba(255, 183, 3, 0.15)',
            border: '1px solid rgba(255, 183, 3, 0.5)',
            borderRadius: '14px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Zap size={18} color="var(--accent-gold)" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-gold)', letterSpacing: '0.5px' }}>SCORE</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                +{potentialPoints} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PTS</span>
              </span>
            </div>
          </div>



          {/* 3-Strike Fails Badge */}
          <div style={{
            background: missCount >= 2 ? 'rgba(255, 0, 127, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            border: missCount >= 2 ? '1px solid var(--accent-pink)' : '1px solid var(--border-glass)',
            borderRadius: '14px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)' }}>FAILS:</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 900, color: missCount >= 2 ? 'var(--accent-pink)' : '#fff', fontFamily: 'var(--font-mono)' }}>
              {missCount} / 3
            </span>
          </div>
        </div>

        {/* Game Controls (Hint & Zoom) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Hint Button */}
          <button
            className={`glass-btn ${hintsLeft > 0 ? '' : 'disabled'}`}
            onClick={handleHintClick}
            disabled={hintsLeft <= 0}
            style={{
              borderColor: hintsLeft > 0 ? 'var(--accent-gold)' : 'transparent',
              color: hintsLeft > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
              opacity: hintsLeft > 0 ? 1 : 0.4,
              padding: '10px 16px',
              borderRadius: '12px',
              fontSize: '0.92rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <Lightbulb size={19} />
            <span>Hint ({hintsLeft})</span>
          </button>

          {/* Magnifier Toggle */}
          <button
            className={`glass-btn ${magnifierEnabled ? 'glass-btn-primary' : ''}`}
            onClick={toggleMagnifier}
            title="Toggle Magnifier Lens"
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              fontSize: '0.92rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <Search size={19} />
            <span>Zoom</span>
          </button>
        </div>

      </div>
    </div>
  );
}
