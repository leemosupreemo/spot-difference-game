import React from 'react';
import { Volume2, VolumeX, Eye, Award, Info } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function Header({
  muted,
  setMuted,
  onOpenLeaderboard,
  onOpenHelp
}) {
  const toggleSound = () => {
    const isMuted = sounds.toggleMute();
    setMuted(isMuted);
  };

  return (
    <header className="glass-panel" style={{
      padding: '12px 18px',
      margin: '0 auto 16px auto',
      maxWidth: '1300px',
      borderRadius: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        
        {/* Top Header Title & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
            padding: '6px',
            borderRadius: '10px',
            display: 'flex',
            boxShadow: '0 0 12px rgba(0, 240, 255, 0.4)'
          }}>
            <Eye size={20} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, lineHeight: 1.1, background: 'linear-gradient(90deg, #fff, var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              DIFF HUNTER
            </h1>
            <span style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '0.5px' }}>
              SPEEDRUN
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="glass-btn"
            onClick={onOpenLeaderboard}
            title="Progress & Records"
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          >
            <Award size={16} color="var(--accent-gold)" />
            <span>Stats</span>
          </button>

          <button
            className="glass-btn"
            onClick={onOpenHelp}
            title="How to Play"
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          >
            <Info size={16} />
            <span>Help</span>
          </button>

          <button
            className="glass-btn"
            onClick={toggleSound}
            title={muted ? "Unmute Sound" : "Mute Sound"}
            style={{ padding: '8px 10px' }}
          >
            {muted ? <VolumeX size={16} color="var(--accent-pink)" /> : <Volume2 size={16} color="var(--accent-cyan)" />}
          </button>
        </div>

      </div>
    </header>
  );
}
