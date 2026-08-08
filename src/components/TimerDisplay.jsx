import React from 'react';
import { Timer, Lightbulb, Search, Zap } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function TimerDisplay({
  elapsedTime,
  foundCount,
  hintsLeft,
  onUseHint,
  magnifierEnabled,
  setMagnifierEnabled,
  score,
  mode
}) {
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
        
        {/* Clock & PTS Score (Positioned Right Next to Each Other) */}
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

          {/* PTS Score Badge Directly Adjacent */}
          <div style={{
            background: 'rgba(255, 183, 3, 0.12)',
            border: '1px solid rgba(255, 183, 3, 0.35)',
            borderRadius: '14px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Zap size={18} color="var(--accent-gold)" />
            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
              {score} <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>PTS</span>
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
              padding: '8px 14px'
            }}
          >
            <Lightbulb size={18} />
            <span style={{ fontSize: '0.88rem' }}>Hint ({hintsLeft})</span>
          </button>

          {/* Magnifier Toggle */}
          <button
            className={`glass-btn ${magnifierEnabled ? 'glass-btn-primary' : ''}`}
            onClick={toggleMagnifier}
            title="Toggle Magnifier Lens"
            style={{ padding: '8px 14px' }}
          >
            <Search size={18} />
            <span style={{ fontSize: '0.88rem' }}>Zoom</span>
          </button>
        </div>

      </div>
    </div>
  );
}
