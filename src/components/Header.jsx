import React, { useState } from 'react';
import { Volume2, VolumeX, Eye, Award, Info, ArrowLeft, Wrench, Terminal } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function Header({
  view = 'menu',
  onBack,
  muted,
  setMuted,
  onOpenLeaderboard,
  onOpenProgress,
  onOpenHelp,
  onOpenDiagnostics,
  onLogoClick,
  onToggleDebug,
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
    if (nextCount >= 3) {
      setTapCount(0);
      if (onToggleDebug) onToggleDebug();
      else if (onLogoClick) onLogoClick();
    }
  };

  const handleOpenStats = () => {
    sounds.playTap();
    if (onOpenLeaderboard) onOpenLeaderboard();
    else if (onOpenProgress) onOpenProgress();
  };

  const maxHeaderWidth = view === 'menu' ? '850px' : view === 'stats' ? '900px' : '1300px';

  return (
    <div style={{
      width: '100%',
      maxWidth: maxHeaderWidth,
      margin: '0 auto 12px auto',
      padding: '0 16px',
      boxSizing: 'border-box',
      transition: 'max-width 0.2s ease'
    }}>
      <header className="glass-panel" style={{
        padding: '10px 16px',
        width: '100%',
        borderRadius: '16px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          
          {/* Left Side: Logo on Main Menu, or Back Button on Stats / Game screens */}
          {view === 'menu' ? (
            <div
              onClick={handleLogoClick}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
              title="Tap to toggle debug tools"
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
                DIFF HUNTER
              </h1>
              {debugMode && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleDebug) onToggleDebug();
                  }}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: 'var(--accent-pink)',
                    padding: '3px 8px',
                    background: 'rgba(255,0,127,0.2)',
                    borderRadius: '8px',
                    border: '1px solid var(--accent-pink)',
                    cursor: 'pointer'
                  }}
                  title="Tap to toggle debug mode off"
                >
                  DEBUG ON
                </span>
              )}
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
            {/* Live Diagnostics & System Logs Button */}
            <button
              className="glass-btn"
              onClick={() => {
                sounds.playTap();
                if (onOpenDiagnostics) onOpenDiagnostics();
              }}
              title="Live Diagnostics & System Logs"
              style={{
                padding: '8px 10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
                borderColor: 'rgba(0, 240, 255, 0.4)',
                background: 'rgba(0, 240, 255, 0.1)'
              }}
            >
              <Terminal size={17} />
            </button>

            {/* Quick Debug Toggle in Header */}
            <button
              className="glass-btn"
              onClick={() => {
                sounds.playTap();
                if (onToggleDebug) onToggleDebug();
              }}
              title={debugMode ? "Debug Mode Active (Tap to disable)" : "Enable Debug Curator Tools"}
              style={{
                padding: '8px 10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: debugMode ? 'var(--accent-pink)' : 'var(--text-muted)',
                borderColor: debugMode ? 'var(--accent-pink)' : 'var(--border-glass)',
                background: debugMode ? 'rgba(255, 0, 127, 0.15)' : 'rgba(255, 255, 255, 0.05)'
              }}
            >
              <Wrench size={17} color={debugMode ? "var(--accent-pink)" : "currentColor"} />
            </button>

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
              title="How to Play & Options"
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
    </div>
  );
}
