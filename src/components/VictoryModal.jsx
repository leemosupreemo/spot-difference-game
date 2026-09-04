import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Star, Clock, Zap, ArrowRight, RotateCcw, X } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function VictoryModal({
  isOpen,
  level,
  levelTitle,
  elapsedTime = 0,
  missCount = 0,
  score = 0,
  stars = 3,
  onNextLevel,
  onRestart,
  onClose
}) {
  // Calculate Stars based on Points Obtained across stage (Score >= 1000 -> 3 Stars, Score >= 500 -> 2 Stars, Score > 0 -> 1 Star, or explicit stars prop)
  const displayStars = (score > 0)
    ? (score >= 1000 ? 3 : score >= 500 ? 2 : 1)
    : (typeof stars === 'number' ? stars : 3);

  useEffect(() => {
    if (isOpen) {
      if (typeof sounds.playFanfare === 'function') {
        sounds.playFanfare(displayStars);
      } else {
        sounds.playWin(displayStars);
      }

      // Trigger Confetti Fireworks
      const isThreeStars = displayStars === 3;
      const count = isThreeStars ? 280 : 200;

      // Golden color palette when 3 stars are achieved
      const goldenColors = ['#FFD700', '#FFA500', '#FFDF00', '#F7B731', '#FFEAA7', '#D4AF37', '#FFF380', '#00F0FF'];
      const standardColors = ['#00F0FF', '#7000FF', '#FF007F', '#00FF88', '#38EF7D', '#3A86FF', '#F12711'];
      const activeColors = isThreeStars ? goldenColors : standardColors;

      const defaults = { origin: { y: 0.7 }, colors: activeColors };

      function fire(particleRatio, opts) {
        try {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
          });
        } catch (error) {
          console.warn('Victory celebration unavailable:', error);
        }
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });

      if (isThreeStars) {
        // Extra golden side cannons for 3-star glorious victory
        const timer = setTimeout(() => {
          try {
            confetti({
              particleCount: 45,
              angle: 60,
              spread: 55,
              origin: { x: 0.05, y: 0.75 },
              colors: goldenColors
            });
            confetti({
              particleCount: 45,
              angle: 120,
              spread: 55,
              origin: { x: 0.95, y: 0.75 },
              colors: goldenColors
            });
          } catch (error) {
            console.warn('Victory celebration unavailable:', error);
          }
        }, 180);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, displayStars]);

  if (!isOpen) return null;

  const seconds = (elapsedTime / 1000).toFixed(2);
  const safeMisses = Number.isFinite(missCount) ? missCount : 0;
  const accuracy = Math.max(0, Math.min(100, Math.round(100 - safeMisses * 15)));
  const titleText = levelTitle || level?.title || 'Stage Set';

  return (
    <div
      onClick={() => { sounds.playTap(); onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
        maxWidth: '440px',
        width: '94%',
        maxHeight: '94vh',
        overflowY: 'auto',
        padding: '18px 20px',
        textAlign: 'center',
        border: '2px solid var(--accent-cyan)',
        boxShadow: '0 0 40px rgba(0, 240, 255, 0.45)',
        borderRadius: '20px',
        position: 'relative',
        animation: 'pageFadeIn 0.12s ease-out'
      }}>
        
        {/* Top Right Close "X" Button */}
        <button
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-muted)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Compact Trophy Icon */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-gold), #ff8800)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 8px auto',
          boxShadow: '0 0 20px var(--accent-gold)'
        }}>
          <Trophy size={26} color="#000" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '2px', background: 'linear-gradient(90deg, #fff, var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          STAGE CLEAR!
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          {titleText}
        </p>

        {/* Stars Earned (Populating based on Points Obtained) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '14px' }}>
          {[1, 2, 3].map(starNum => {
            const active = starNum <= displayStars;
            return (
              <div
                key={starNum}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: active ? 'scale(1.15)' : 'scale(0.88)',
                  transition: `transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${starNum * 0.15}s`
                }}
              >
                <Star
                  size={36}
                  fill={active ? 'var(--accent-gold)' : 'none'}
                  color={active ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.25)'}
                  style={{
                    filter: active ? 'drop-shadow(0 0 14px rgba(255, 183, 3, 0.95))' : 'none'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Performance Breakdown Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          background: 'rgba(0,0,0,0.4)',
          padding: '12px 14px',
          borderRadius: '14px',
          marginBottom: '16px',
          textAlign: 'left'
        }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="var(--accent-cyan)" /> TIME TAKEN
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
              {seconds}s
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} color="var(--accent-gold)" /> TOTAL PTS
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
              {score} PTS
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingRight: '8px' }}>ACCURACY</span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-green)' }}>
              {accuracy}%
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingRight: '8px' }}>MISSES</span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: safeMisses > 0 ? 'var(--accent-pink)' : 'var(--text-muted)' }}>
              {safeMisses}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            className="glass-btn"
            onClick={() => { sounds.playTap(); onRestart(); }}
            style={{ flex: 1, justifyContent: 'center', fontSize: '1rem', fontWeight: 800, padding: '10px 14px', borderRadius: '12px' }}
          >
            <RotateCcw size={18} /> Retry
          </button>

          <button
            className="glass-btn glass-btn-primary"
            onClick={() => { sounds.playTap(); onNextLevel(); }}
            style={{ flex: 1.4, justifyContent: 'center', fontSize: '1.05rem', fontWeight: 900, padding: '10px 16px', borderRadius: '12px' }}
          >
            Next Stage <ArrowRight size={18} />
          </button>
        </div>

      </div>
    </div>
  );
}
