import React, { useState } from 'react';
import { Volume2, VolumeX, Eye, Award, Info } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function Header({
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

  return (
    <header className="glass-panel" style={{
      padding: '12px 18px',
      margin: '0 auto 16px auto',
      maxWidth: '1300px',
      borderRadius: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        
        {/* Top Header Title & Logo (Tap 5 times to toggle debug mode) */}
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

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="glass-btn"
            onClick={handleOpenStats}
            title="Progress & Records"
            style={{
              padding: '10px 16px',
              fontSize: '0.92rem',
              fontWeight: 800,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <Award size={19} color="var(--accent-gold)" />
            <span>Stats & Leaderboards</span>
          </button>

          <button
            className="glass-btn"
            onClick={onOpenHelp}
            title="How to Play"
            style={{
              padding: '10px 16px',
              fontSize: '0.92rem',
              fontWeight: 800,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <Info size={19} />
            <span>Help</span>
          </button>

          <button
            className="glass-btn"
            onClick={toggleSound}
            title={muted ? "Unmute Sound" : "Mute Sound"}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {muted ? <VolumeX size={19} color="var(--accent-pink)" /> : <Volume2 size={19} color="var(--accent-cyan)" />}
          </button>
        </div>

      </div>
    </header>
  );
}
