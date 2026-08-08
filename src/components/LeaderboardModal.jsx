import React from 'react';
import { Award, Trophy, Clock, Target, CheckCircle, X } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function LeaderboardModal({ isOpen, onClose, levelStats, totalScore }) {
  if (!isOpen) return null;

  const entries = Object.entries(levelStats);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '520px',
        width: '100%',
        padding: '28px',
        position: 'relative'
      }}>
        
        <button
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Trophy size={28} color="var(--accent-gold)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>MY SPEEDRUN RECORDS</h2>
        </div>

        {/* Total Score Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,183,3,0.15), rgba(255,0,127,0.15))',
          border: '1px solid rgba(255,183,3,0.3)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700 }}>CAREER HIGH SCORE</span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)' }}>
              {totalScore} PTS
            </h3>
          </div>
          <Award size={36} color="var(--accent-gold)" />
        </div>

        {/* Stage Records Table */}
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
              No stage records yet! Complete level pairs to log speed records.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>STAGE</th>
                  <th style={{ padding: '8px' }}>STARS</th>
                  <th style={{ padding: '8px' }}>BEST TIME</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([id, stat]) => (
                  <tr key={id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{id.toUpperCase()}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--accent-gold)' }}>
                      {'★'.repeat(stat.stars)}{'☆'.repeat(3 - stat.stars)}
                    </td>
                    <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      {stat.bestTime ? `${(stat.bestTime / 1000).toFixed(2)}s` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button
          className="glass-btn glass-btn-primary"
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}
        >
          Close Dashboard
        </button>

      </div>
    </div>
  );
}
