import React from 'react';
import { Eye, Play, Award, Zap, ShieldAlert, Sparkles, CheckCircle2, Trophy, Flame } from 'lucide-react';
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
      diffType: '1 Larger Difference',
      sceneNoise: 'Moderate Visual Detail',
      targetSize: 'Generous Target Radius',
      multiplier: '1.0x Score',
      desc: 'Larger change area on a moderately clear scene. Perfect for warmups.'
    },
    {
      id: 'Medium',
      name: 'MEDIUM',
      color: 'var(--accent-gold)',
      icon: '🟡',
      diffType: '1 Subtle Difference',
      sceneNoise: 'Dense Object Clutter',
      targetSize: 'Standard Target Radius',
      multiplier: '1.5x Score',
      desc: 'Subtle single difference hidden in dense object scenes.'
    },
    {
      id: 'Hard',
      name: 'HARD / SNIPER',
      color: 'var(--accent-pink)',
      icon: '🔴',
      diffType: '1 Micro Difference',
      sceneNoise: 'Extreme Visual Noise',
      targetSize: 'Pixel-Tight Target Radius',
      multiplier: '2.5x Score',
      desc: 'Micro-tiny difference hidden inside hyper-cluttered grounds & camouflage!'
    }
  ];

  return (
    <div style={{
      maxWidth: '900px',
      margin: '35px auto',
      padding: '0 20px',
      textAlign: 'center',
      animation: 'hitPulse 0.4s ease-out'
    }}>
      
      {/* Main Logo & Title Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-pink))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: '0 0 30px rgba(0, 240, 255, 0.5)'
        }}>
          <Eye size={42} color="#000" strokeWidth={2.5} />
        </div>

        <h1 style={{
          fontSize: '2.6rem',
          fontWeight: 900,
          letterSpacing: '-0.5px',
          background: 'linear-gradient(90deg, #fff, var(--accent-cyan), var(--accent-gold))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '6px'
        }}>
          DIFF HUNTER
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto' }}>
          Select your difficulty below. Each stage features <strong>1 single difference</strong>—difficulty determines image clutter & change scale!
        </p>
      </div>

      {/* 3 Difficulty Selection Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '18px',
        marginBottom: '32px'
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
                padding: '22px 18px',
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

              <div style={{ fontSize: '1.7rem', marginBottom: '8px' }}>
                {diff.icon}
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: diff.color, marginBottom: '6px' }}>
                {diff.name}
              </h3>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
                {diff.desc}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 700 }}>
                <span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Flame size={14} color={diff.color} /> {diff.diffType}
                </span>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color="var(--accent-cyan)" /> {diff.sceneNoise}
                </span>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="var(--accent-gold)" /> {diff.multiplier}
                </span>
              </div>

            </div>
          );
        })}
      </div>

      {/* Primary Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px', margin: '0 auto' }}>
        
        {/* START GAME BUTTON */}
        <button
          className="glass-btn glass-btn-primary"
          onClick={() => {
            sounds.playWin();
            onStartGame();
          }}
          style={{
            padding: '16px 28px',
            fontSize: '1.2rem',
            justifyContent: 'center',
            borderRadius: '16px',
            boxShadow: '0 6px 30px rgba(0, 240, 255, 0.5)'
          }}
        >
          <Play size={22} fill="#000" /> START SPEEDRUN
        </button>

        {/* PROGRESS & STATS BUTTON */}
        <button
          className="glass-btn"
          onClick={() => {
            sounds.playTap();
            onOpenProgress();
          }}
          style={{
            padding: '12px 22px',
            fontSize: '0.95rem',
            justifyContent: 'center',
            borderColor: 'var(--accent-gold)',
            color: 'var(--accent-gold)',
            borderRadius: '14px'
          }}
        >
          <Trophy size={18} /> View Progress & Speed Records
        </button>

        {/* CUSTOM LEVEL MAKER BUTTON */}
        <button
          className="glass-btn"
          onClick={() => {
            sounds.playTap();
            onOpenCreator();
          }}
          style={{
            padding: '10px 18px',
            fontSize: '0.85rem',
            justifyContent: 'center',
            borderRadius: '14px'
          }}
        >
          <Sparkles size={16} /> Custom Level Maker
        </button>

      </div>

    </div>
  );
}
