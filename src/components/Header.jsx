import React, { useState } from 'react';
import { Volume2, VolumeX, Eye, Award, Info, ArrowLeft } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function Header({
  view = 'menu',
  onBack,
  muted,
  setMuted,
  onOpenLeaderboard,
  onOpenProgress,
  onOpenHelp,
  onLogoClick,
  debugMode
}) {
  const [tapCount, setTapCount] = useState(0);

  const toggleSound = () => {
    const isMuted = sounds.toggleMute();
    setMuted(isMuted);
  };

  const handleLogoClick = () => {
    const nextCount = tapCount + 1;
    setTapCount(nextCount);
    if (nextCount >= 5) {
      setTapCount(0);
      if (onLogoClick) onLogoClick();
    }
  };

  const handleOpenStats = () => {
    sounds.playTap();
    if (onOpenLeaderboard) onOpenLeaderboard();
    else if (onOpenProgress) onOpenProgress();
  };

  const maxHeaderWidth = view === 'menu' ? '850px' : view === 'stats' ? '900px' : '1300px';

  return (
    <header className="glass-panel" style={{
      padding: '10px 16px',
      margin: '0 auto 14px auto',
      maxWidth: maxHeaderWidth,
      borderRadius: '16px',
      transition: 'max-width 0.2s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        
        {/* Left Side: Logo on Main Menu, or Back Button on Stats / Game screens */}
        {view === 'menu' ? (
          <div
            onClick={handleLogoClick}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
              padding: '6px',
              borderRadius: '10px',
              display: 'flex',
              boxShadow: '0 0 12px rgba(0, 240, 255, 0.4)'
            }}>
              <Eye size={20} color="#000" strokeWidth={2.5} />
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.1, background: 'linear-gradient(90deg, #fff, var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              DIFF HUNTER {debugMode && <span style={{ fontSize: '0.65rem', color: 'var(--accent-pink)', padding: '2px 6px', background: 'rgba(255,0,127,0.2)', borderRadius: '6px', border: '1px solid var(--accent-pink)' }}>DEBUG</span>}
            </h1>
          </div>
        ) : (
          <button
            className="glass-btn glass-btn-primary"
            onClick={() => {
              sounds.playTap();
              if (onBack) onBack();
            }}
            style={{
              padding: '8px 16px',
              fontSize: '0.95rem',
              fontWeight: 800,
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {view === 'menu' && (
            <button
              className="glass-btn"
              onClick={handleOpenStats}
              title="Progress & Records"
              style={{
                padding: '8px 14px',
                fontSize: '0.9rem',
                fontWeight: 800,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Award size={18} color="var(--accent-gold)" />
              <span>Stats</span>
            </button>
          )}

          <button
            className="glass-btn"
            onClick={onOpenHelp}
            title="How to Play"
            style={{
              padding: '8px 14px',
              fontSize: '0.9rem',
              fontWeight: 800,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Info size={18} />
            <span>Help</span>
          </button>

          <button
            className="glass-btn"
            onClick={toggleSound}
            title={muted ? "Unmute Sound" : "Mute Sound"}
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {muted ? <VolumeX size={18} color="var(--accent-pink)" /> : <Volume2 size={18} color="var(--accent-cyan)" />}
          </button>
        </div>

      </div>
    </header>
  );
}
