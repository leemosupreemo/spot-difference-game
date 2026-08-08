import React from 'react';
import { Eye, Play, Award, Zap, ShieldAlert, Sparkles, CheckCircle2, Trophy } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function MainMenu({
  selectedDifficulty,
  setSelectedDifficulty,
  onStartGame,
  onOpenProgress,
  onOpenCreator
}) {
  const difficulties = [
    {
      id: 'Easy',
      name: 'EASY',
      color: 'var(--accent-green)',
      icon: '🟢',
      diffCount: '3 Differences',
      targetSize: 'Generous Hit Area',
      multiplier: '1.0x Score',
      desc: 'Relaxed speed hunting, ideal for warmups & beginners.'
    },
    {
      id: 'Medium',
      name: 'MEDIUM',
      color: 'var(--accent-gold)',
      icon: '🟡',
      diffCount: '5 Differences',
      targetSize: 'Balanced Precision',
      multiplier: '1.5x Score',
      desc: 'Standard speedrun mode with tricky hidden details.'
    },
    {
      id: 'Hard',
      name: 'HARD',
      color: 'var(--accent-pink)',
      icon: '🔴',
      diffCount: '7 Differences',
      targetSize: 'Pixel-Tight Precision',
      multiplier: '2.5x Score',
      desc: 'Extreme speed test! 2s miss penalties and micro-differences.'
    }
  ];

  return (
    <div style={{
      maxWidth: '900px',
      margin: '40px auto',
      padding: '0 20px',
      textAlign: 'center',
      animation: 'hitPulse 0.4s ease-out'
    }}>
      
      {/* Main Logo & Title Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          boxShadow: '0 0 30px rgba(0, 240, 255, 0.5)'
        }}>
          <Eye size={42} color="#000" strokeWidth={2.5} />
        </div>

        <h1 style={{
          fontSize: '2.8rem',
          fontWeight: 900,
          letterSpacing: '-0.5px',
          background: 'linear-gradient(90deg, #fff, var(--accent-cyan), var(--accent-gold))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          DIFF HUNTER
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto' }}>
          Select your difficulty and hit <strong>Start Game</strong>. The millisecond timer starts the exact moment your first pair appears!
        </p>
      </div>

      {/* 3 Difficulty Selection Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '36px'
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
                padding: '24px 20px',
                borderRadius: '20px',
                cursor: 'pointer',
                border: isSelected ? `2px solid ${diff.color}` : '1px solid var(--border-glass)',
                boxShadow: isSelected ? `0 0 25px ${diff.color}55` : 'none',
                transform: isSelected ? 'translateY(-4px)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                textAlign: 'left',
                position: 'relative'
              }}
            >
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
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

              <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>
                {diff.icon}
              </div>

              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: diff.color, marginBottom: '6px' }}>
                {diff.name}
              </h3>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.4 }}>
                {diff.desc}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                <span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color={diff.color} /> {diff.diffCount}
                </span>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="var(--accent-gold)" /> {diff.multiplier}
                </span>
              </div>

            </div>
          );
        })}
      </div>

      {/* Primary Actions Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '420px', margin: '0 auto' }}>
        
        {/* START GAME BUTTON */}
        <button
          className="glass-btn glass-btn-primary"
          onClick={() => {
            sounds.playWin();
            onStartGame();
          }}
          style={{
            padding: '16px 28px',
            fontSize: '1.25rem',
            justifyContent: 'center',
            borderRadius: '16px',
            boxShadow: '0 6px 30px rgba(0, 240, 255, 0.5)'
          }}
        >
          <Play size={24} fill="#000" /> START GAME NOW
        </button>

        {/* PROGRESS & STATS BUTTON */}
        <button
          className="glass-btn"
          onClick={() => {
            sounds.playTap();
            onOpenProgress();
          }}
          style={{
            padding: '14px 24px',
            fontSize: '1rem',
            justifyContent: 'center',
            borderColor: 'var(--accent-gold)',
            color: 'var(--accent-gold)',
            borderRadius: '14px'
          }}
        >
          <Trophy size={20} /> View Progress & Speed Records
        </button>

        {/* CUSTOM LEVEL MAKER BUTTON */}
        <button
          className="glass-btn"
          onClick={() => {
            sounds.playTap();
            onOpenCreator();
          }}
          style={{
            padding: '12px 20px',
            fontSize: '0.9rem',
            justifyContent: 'center',
            borderRadius: '14px'
          }}
        >
          <Sparkles size={18} /> Custom Level Maker
        </button>

      </div>

    </div>
  );
}
