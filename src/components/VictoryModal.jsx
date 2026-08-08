import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Star, Clock, Zap, ArrowRight, RotateCcw, Award } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function VictoryModal({
  isOpen,
  levelTitle,
  elapsedTime,
  missCount,
  score,
  stars,
  onNextLevel,
  onRestart,
  onClose
}) {
  useEffect(() => {
    if (isOpen) {
      sounds.playWin();

      // Trigger Confetti Fireworks
      const count = 200;
      const defaults = { origin: { y: 0.7 } };

      function fire(particleRatio, opts) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        });
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const seconds = (elapsedTime / 1000).toFixed(2);
  const accuracy = Math.max(0, Math.round(100 - missCount * 15));

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '32px',
        textAlign: 'center',
        border: '2px solid var(--accent-cyan)',
        boxShadow: '0 0 40px rgba(0, 240, 255, 0.4)',
        animation: 'hitPulse 0.4s ease-out'
      }}>
        
        {/* Trophy Icon */}
        <div style={{
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-gold), #ff8800)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: '0 0 25px var(--accent-gold)'
        }}>
          <Trophy size={36} color="#000" />
        </div>

        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '6px', background: 'linear-gradient(90deg, #fff, var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          STAGE CLEAR!
        </h2>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          {levelTitle}
        </p>

        {/* Stars Earned */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
          {[1, 2, 3].map(starNum => (
            <Star
              key={starNum}
              size={36}
              className={starNum <= stars ? 'star-icon' : 'star-icon empty'}
              fill={starNum <= stars ? 'var(--accent-gold)' : 'none'}
              style={{ transition: `all 0.3s ease ${starNum * 0.15}s` }}
            />
          ))}
        </div>

        {/* Performance Breakdown Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          background: 'rgba(0,0,0,0.4)',
          padding: '16px',
          borderRadius: '14px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} color="var(--accent-cyan)" /> TIME TAKEN
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
              {seconds}s
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={14} color="var(--accent-gold)" /> TOTAL SCORE
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
              {score} PTS
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACCURACY</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-green)' }}>
              {accuracy}%
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MISSES</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: missCount > 0 ? 'var(--accent-pink)' : 'var(--text-muted)' }}>
              {missCount}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            className="glass-btn"
            onClick={() => { sounds.playTap(); onRestart(); }}
            style={{ flex: 1, justifyContent: 'center', fontSize: '1.15rem', fontWeight: 800, padding: '14px' }}
          >
            <RotateCcw size={20} /> Retry
          </button>

          <button
            className="glass-btn glass-btn-primary"
            onClick={() => { sounds.playTap(); onNextLevel(); }}
            style={{ flex: 1.4, justifyContent: 'center', fontSize: '1.25rem', fontWeight: 900, padding: '14px' }}
          >
            Next Pair <ArrowRight size={20} />
          </button>
        </div>

      </div>
    </div>
  );
}
