import React from 'react';
import { Trophy, Play, CheckCircle, Sparkles } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function LevelSelector({
  levels,
  currentLevelId,
  onSelectLevel,
  levelStats,
  onGenerateProceduralPair
}) {
  return (
    <div style={{ maxWidth: '1300px', margin: '30px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={20} color="var(--accent-gold)" /> SELECT LEVEL PACK
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="glass-btn glass-btn-primary"
            onClick={() => {
              sounds.playWin();
              onGenerateProceduralPair();
            }}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Sparkles size={16} /> Generate Procedural Stage
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {levels.map((lvl) => {
          const stats = levelStats[lvl.id] || { completed: false };
          const isSelected = lvl.id === currentLevelId;

          return (
            <div
              key={lvl.id}
              onClick={() => {
                sounds.playTap();
                onSelectLevel(lvl.id);
              }}
              className="glass-panel"
              style={{
                padding: '16px',
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                boxShadow: isSelected ? '0 0 20px rgba(0, 240, 255, 0.3)' : 'none',
                transition: 'all 0.25s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Category & Difficulty Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '10px',
                  background: 'rgba(0, 240, 255, 0.1)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(0, 240, 255, 0.2)'
                }}>
                  {lvl.category}
                </span>

                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '10px',
                  background: lvl.difficulty === 'Easy' ? 'rgba(0,255,135,0.1)' : lvl.difficulty === 'Medium' ? 'rgba(255,183,3,0.1)' : 'rgba(255,0,127,0.1)',
                  color: lvl.difficulty === 'Easy' ? 'var(--accent-green)' : lvl.difficulty === 'Medium' ? 'var(--accent-gold)' : 'var(--accent-pink)'
                }}>
                  {lvl.difficulty}
                </span>
              </div>

              {/* Title */}
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px', color: '#fff' }}>
                {lvl.title}
              </h3>

              {/* Status */}
              <div style={{
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-main)',
                padding: '8px',
                borderRadius: '8px',
                background: isSelected ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.04)'
              }}>
                {stats.completed ? (
                  <>
                    <CheckCircle size={16} color="var(--accent-green)" /> Completed
                  </>
                ) : (
                  <>
                    <Play size={15} /> Play Stage
                  </>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
