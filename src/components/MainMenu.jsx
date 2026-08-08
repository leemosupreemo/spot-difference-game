import React, { useState } from 'react';
import { Play, Award, Zap, Sparkles, CheckCircle2, Trophy, Flame, Layers } from 'lucide-react';
import { sounds } from '../utils/audio';
import { SCENE_THEMES } from '../utils/proceduralGenerator';

export default function MainMenu({
  selectedTheme,
  setSelectedTheme,
  selectedDifficulty,
  setSelectedDifficulty,
  onStartGame,
  onOpenProgress,
  onOpenDebug
}) {
  const themeIcons = {
    find_the_sniper: '🎯',
    lego_kingdom: '🧱',
    dense_landscape: '🌲',
    antique_shop: '🔮',
    cyber_arcade: '🌆'
  };

  const difficulties = [
    {
      id: 'Easy',
      name: 'EASY',
      color: 'var(--accent-green)',
      icon: '🟢',
      targetSize: 'Generous Target Radius',
      desc: 'Larger change area on a clean scene.'
    },
    {
      id: 'Medium',
      name: 'MEDIUM',
      color: 'var(--accent-gold)',
      icon: '🟡',
      targetSize: 'Standard Target Radius',
      desc: 'Subtle single difference in dense object clutter.'
    },
    {
      id: 'Hard',
      name: 'HARD / SNIPER',
      color: 'var(--accent-pink)',
      icon: '🔴',
      targetSize: 'Pixel-Tight Radius',
      desc: 'Micro difference hidden inside hyper-cluttered noise!'
    }
  ];

  return (
    <div style={{
      maxWidth: '950px',
      margin: '10px auto 40px auto',
      padding: '0 20px',
      textAlign: 'center',
      animation: 'hitPulse 0.4s ease-out'
    }}>

      {/* Section 1: SELECT LEVEL PACK */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          <Layers size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            1. SELECT LEVEL PACK
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {SCENE_THEMES.map(theme => {
            const isSelected = selectedTheme === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => {
                  sounds.playTap();
                  setSelectedTheme(theme.id);
                }}
                className="glass-panel"
                style={{
                  padding: '20px 18px',
                  borderRadius: '18px',
                  cursor: 'pointer',
                  border: isSelected ? '2.5px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  boxShadow: isSelected ? '0 0 25px rgba(0, 240, 255, 0.45)' : 'none',
                  transform: isSelected ? 'scale(1.03)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  textAlign: 'left',
                  position: 'relative'
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'var(--accent-cyan)',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle2 size={16} color="#000" strokeWidth={3} />
                  </div>
                )}

                <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>
                  {themeIcons[theme.id] || '📷'}
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: isSelected ? '#fff' : 'var(--text-main)', marginBottom: '4px', lineHeight: 1.2 }}>
                  {theme.title}
                </h3>

                <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {theme.category}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: SELECT DIFFICULTY */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          <Flame size={22} color="var(--accent-pink)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            2. SELECT DIFFICULTY
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px'
        }}>
          {difficulties.map(diff => {
            const isSelected = selectedDifficulty === diff.id;
            return (
              <div
                key={diff.id}
                onClick={() => {
                  sounds.playTap();
                  setSelectedDifficulty(diff.id);
                }}
                className="glass-panel"
                style={{
                  padding: '20px 18px',
                  borderRadius: '18px',
                  cursor: 'pointer',
                  border: isSelected ? `2.5px solid ${diff.color}` : '1px solid var(--border-glass)',
                  boxShadow: isSelected ? `0 0 25px ${diff.color}44` : 'none',
                  transform: isSelected ? 'scale(1.03)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  textAlign: 'left',
                  position: 'relative'
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: diff.color,
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle2 size={16} color="#000" strokeWidth={3} />
                  </div>
                )}

                <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>
                  {diff.icon}
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: diff.color, marginBottom: '4px' }}>
                  {diff.name}
                </h3>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                  {diff.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '440px', margin: '0 auto' }}>
        
        {/* START GAME BUTTON */}
        <button
          className="glass-btn glass-btn-primary"
          onClick={() => {
            sounds.playWin();
            onStartGame();
          }}
          style={{
            padding: '18px 32px',
            fontSize: '1.3rem',
            justifyContent: 'center',
            borderRadius: '18px',
            boxShadow: '0 6px 35px rgba(0, 240, 255, 0.55)'
          }}
        >
          <Play size={24} fill="#000" /> START SPEEDRUN
        </button>

        {/* PROGRESS & STATS BUTTON */}
        <button
          className="glass-btn"
          onClick={() => {
            sounds.playTap();
            onOpenProgress();
          }}
          style={{
            padding: '13px 24px',
            fontSize: '1rem',
            justifyContent: 'center',
            borderColor: 'var(--accent-gold)',
            color: 'var(--accent-gold)',
            borderRadius: '14px'
          }}
        >
          <Trophy size={18} /> View Speed Records & Progress
        </button>

        {/* DEV DEBUG LEVEL GENERATOR PIPELINE */}
        {onOpenDebug && (
          <button
            className="glass-btn"
            onClick={() => {
              sounds.playTap();
              onOpenDebug();
            }}
            style={{
              padding: '10px 18px',
              fontSize: '0.82rem',
              justifyContent: 'center',
              borderRadius: '12px',
              opacity: 0.8
            }}
          >
            🛠️ Dev Debug Level Generator Pipeline
          </button>
        )}

      </div>

    </div>
  );
}
