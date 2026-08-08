import React from 'react';
import { Timer, Lightbulb, Search, CheckCircle, Crosshair, Star } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function TimerDisplay({
  elapsedTime,
  totalDiffs,
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
    <div className="glass-panel" style={{ padding: '14px 24px', margin: '20px auto', maxWidth: '1300px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Timer Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(0, 240, 255, 0.1)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            borderRadius: '14px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Timer size={24} color="var(--accent-cyan)" />
            <div className="timer-badge">
              {formatTime(elapsedTime)}
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {mode === 'blitz' ? 'BLITZ TIMER' : 'SPEEDRUN CLOCK'}
          </span>
        </div>

        {/* Differences Progress Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
              DIFFERENCES FOUND
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {Array.from({ length: totalDiffs }).map((_, index) => {
                const isFound = index < foundCount;
                return (
                  <div
                    key={index}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: isFound ? 'linear-gradient(135deg, var(--accent-green), #00b4d8)' : 'rgba(255,255,255,0.08)',
                      border: isFound ? '1px solid var(--accent-green)' : '1px solid rgba(255,255,255,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isFound ? '0 0 12px var(--accent-green)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {isFound ? (
                      <CheckCircle size={16} color="#000" strokeWidth={3} />
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{index + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Score & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Score Badge */}
          <div style={{
            background: 'rgba(255, 183, 3, 0.1)',
            border: '1px solid rgba(255, 183, 3, 0.3)',
            borderRadius: '12px',
            padding: '6px 14px',
            textAlign: 'right'
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 700, display: 'block' }}>SCORE</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
              {score} PTS
            </span>
          </div>

          {/* Hint Button */}
          <button
            className={`glass-btn ${hintsLeft > 0 ? '' : 'disabled'}`}
            onClick={handleHintClick}
            disabled={hintsLeft <= 0}
            style={{
              borderColor: hintsLeft > 0 ? 'var(--accent-gold)' : 'transparent',
              color: hintsLeft > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
              opacity: hintsLeft > 0 ? 1 : 0.4
            }}
          >
            <Lightbulb size={18} />
            <span>Hint ({hintsLeft})</span>
          </button>

          {/* Magnifier Toggle */}
          <button
            className={`glass-btn ${magnifierEnabled ? 'glass-btn-primary' : ''}`}
            onClick={toggleMagnifier}
            title="Toggle Magnifier Lens"
          >
            <Search size={18} />
            <span>Zoom</span>
          </button>
        </div>

      </div>
    </div>
  );
}
