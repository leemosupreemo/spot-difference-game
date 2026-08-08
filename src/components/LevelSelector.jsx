import React, { useEffect, useRef } from 'react';
import { Star, Clock, Trophy, Play, CheckCircle } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function LevelSelector({
  levels,
  currentLevelId,
  onSelectLevel,
  levelStats
}) {
  return (
    <div style={{ maxWidth: '1300px', margin: '30px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={20} color="var(--accent-gold)" /> SELECT LEVEL PACK
        </h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {levels.length} Photo Stage Pairs Available
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {levels.map((lvl) => {
          const stats = levelStats[lvl.id] || { stars: 0, bestTime: null, completed: false };
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                {lvl.title}
              </h3>

              {/* Stats Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {/* Star rating */}
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[1, 2, 3].map(starNum => (
                    <Star
                      key={starNum}
                      size={16}
                      className={starNum <= stats.stars ? 'star-icon' : 'star-icon empty'}
                      fill={starNum <= stats.stars ? 'var(--accent-gold)' : 'none'}
                    />
                  ))}
                </div>

                {/* Best Time */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                  <Clock size={13} color="var(--accent-cyan)" />
                  {stats.bestTime ? `${(stats.bestTime / 1000).toFixed(2)}s` : '--'}
                </div>
              </div>

              {/* Play / Completed Status */}
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
