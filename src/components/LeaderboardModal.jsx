import React from 'react';
import { Award, Trophy, X } from 'lucide-react';
import { sounds } from '../utils/audio';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';

export default function LeaderboardModal({ isOpen, onClose, levelStats, totalScore }) {
  if (!isOpen) return null;

  const entries = Object.entries(levelStats);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'transparent',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel modal-split-card" style={{
        maxWidth: '520px',
        width: '100%',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
        padding: '28px',
        boxSizing: 'border-box',
        position: 'relative',
        '--modal-accent': 'var(--accent-gold)'
      }}>
        <ModalAmbientParticles />
        <button
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-muted)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--modal-gap-sm)', marginBottom: '16px', paddingRight: '40px' }}>
          <Trophy size={22} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, letterSpacing: '0.5px', color: '#fff' }}>
            MY SPEEDRUN RECORDS
          </h2>
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
