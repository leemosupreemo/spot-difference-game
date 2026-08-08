import React from 'react';
import { Volume2, VolumeX, Eye, Zap, Smile, Edit3, Award, Info, RefreshCw } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function Header({
  activeMode,
  setActiveMode,
  muted,
  setMuted,
  onOpenLeaderboard,
  onOpenHelp,
  onRestartLevel
}) {
  const toggleSound = () => {
    const isMuted = sounds.toggleMute();
    setMuted(isMuted);
  };

  return (
    <header className="glass-panel" style={{ padding: '16px 24px', margin: '16px 20px 24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
            padding: '10px',
            borderRadius: '14px',
            display: 'flex',
            boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)'
          }}>
            <Eye size={26} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff, var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              DIFF HUNTER
            </h1>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 600, letterSpacing: '0.5px' }}>
              SPOT THE DIFFERENCE
            </span>
          </div>
        </div>

        {/* Game Mode Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '6px', borderRadius: '14px' }}>
          <button
            className={`glass-btn ${activeMode === 'classic' ? 'glass-btn-primary' : ''}`}
            onClick={() => { sounds.playTap(); setActiveMode('classic'); }}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Eye size={16} /> Classic
          </button>

          <button
            className={`glass-btn ${activeMode === 'blitz' ? 'glass-btn-primary' : ''}`}
            onClick={() => { sounds.playTap(); setActiveMode('blitz'); }}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Zap size={16} /> Time Blitz
          </button>

          <button
            className={`glass-btn ${activeMode === 'zen' ? 'glass-btn-primary' : ''}`}
            onClick={() => { sounds.playTap(); setActiveMode('zen'); }}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Smile size={16} /> Zen Mode
          </button>

          <button
            className={`glass-btn ${activeMode === 'creator' ? 'glass-btn-primary' : ''}`}
            onClick={() => { sounds.playTap(); setActiveMode('creator'); }}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Edit3 size={16} /> Level Maker
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="glass-btn"
            onClick={onRestartLevel}
            title="Restart Level"
            style={{ padding: '10px' }}
          >
            <RefreshCw size={18} />
          </button>

          <button
            className="glass-btn"
            onClick={onOpenLeaderboard}
            title="Leaderboard & Stats"
            style={{ padding: '10px' }}
          >
            <Award size={18} color="var(--accent-gold)" />
          </button>

          <button
            className="glass-btn"
            onClick={onOpenHelp}
            title="How to Play"
            style={{ padding: '10px' }}
          >
            <Info size={18} />
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
