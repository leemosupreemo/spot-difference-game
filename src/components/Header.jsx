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
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
      paddingBottom: '14px',
      paddingLeft: '24px',
      paddingRight: '24px',
      margin: '0 20px 20px 20px',
      borderRadius: '0 0 20px 20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        
        {/* Top Header Title & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
            padding: '8px',
            borderRadius: '12px',
            display: 'flex',
            boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)'
          }}>
            <Eye size={24} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff, var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              DIFF HUNTER
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, letterSpacing: '0.5px' }}>
              SPOT THE DIFFERENCE SPEEDRUN
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="glass-btn"
            onClick={onOpenLeaderboard}
            title="Progress & Records"
            style={{ padding: '10px 14px' }}
          >
            <Award size={18} color="var(--accent-gold)" />
            <span style={{ fontSize: '0.85rem' }}>Stats</span>
          </button>

          <button
            className="glass-btn"
            onClick={onOpenHelp}
            title="How to Play"
            style={{ padding: '10px 14px' }}
          >
            <Info size={18} />
            <span style={{ fontSize: '0.85rem' }}>Help</span>
          </button>

          <button
            className="glass-btn"
            onClick={toggleSound}
            title={muted ? "Unmute Sound" : "Mute Sound"}
            style={{ padding: '10px' }}
          >
            {muted ? <VolumeX size={18} color="var(--accent-pink)" /> : <Volume2 size={18} color="var(--accent-cyan)" />}
          </button>
        </div>

      </div>
    </header>
  );
}
