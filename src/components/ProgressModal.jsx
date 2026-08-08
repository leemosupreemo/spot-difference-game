import React, { useState } from 'react';
import { Award, Trophy, Clock, Zap, CheckCircle2, ArrowLeft, Star, Flame, RotateCcw, ChevronRight } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function ProgressModal({ isOpen, onClose, difficultyStats }) {
  const [selectedTab, setSelectedTab] = useState('Easy'); // Easy | Medium | Hard

  // If not open / active view, return null
  if (!isOpen) return null;

  const currentStats = difficultyStats[selectedTab] || {
    setsCleared: 0,
    fastestFirstTimeOverall: null,
    fastestRepeatOverall: null,
    sets: {}
  };

  const setEntries = Object.entries(currentStats.sets || {});

  const formatMs = (ms) => {
    if (!ms) return '--';
    const totalSeconds = (ms / 1000).toFixed(2);
    return `${totalSeconds}s`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'var(--bg-dark)',
      backgroundImage: `
        radial-gradient(at 10% 20%, rgba(255, 0, 127, 0.15) 0px, transparent 50%),
        radial-gradient(at 90% 80%, rgba(0, 240, 255, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(18, 9, 36, 0.8) 0px, transparent 100%)
      `,
      backgroundAttachment: 'fixed',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-main)',
      paddingTop: 'max(env(safe-area-inset-top), 20px)',
      paddingBottom: 'max(env(safe-area-inset-bottom), 40px)',
      paddingLeft: '20px',
      paddingRight: '20px',
      boxSizing: 'border-box',
      animation: 'hitPulse 0.3s ease-out'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Full Screen Top Exit Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button
            onClick={() => {
              sounds.playTap();
              onClose();
            }}
            className="glass-btn glass-btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <ArrowLeft size={20} /> Back to Menu
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={26} color="var(--accent-gold)" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(90deg, #fff, var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SPEED RECORDS & STATS
            </h1>
          </div>
        </div>

        {/* Difficulty Tab Selector */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          background: 'rgba(0,0,0,0.5)',
          padding: '8px',
          borderRadius: '18px',
          marginBottom: '28px',
          border: '1px solid var(--border-glass)'
        }}>
          {['Easy', 'Medium', 'Hard'].map((diff) => {
            const isSelected = selectedTab === diff;
            return (
              <button
                key={diff}
                onClick={() => { sounds.playTap(); setSelectedTab(diff); }}
                className={`glass-btn ${isSelected ? 'glass-btn-primary' : ''}`}
                style={{
                  justifyContent: 'center',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '14px'
                }}
              >
                {diff === 'Easy' && '🟢 '}
                {diff === 'Medium' && '🟡 '}
                {diff === 'Hard' && '🔴 '}
                {diff.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Difficulty Highlights Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 800, letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
              TOTAL SETS CLEARED
            </span>
            <span style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff' }}>
              {currentStats.setsCleared}
            </span>
          </div>

          <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center', borderColor: 'rgba(255, 183, 3, 0.4)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 800, letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
              FASTEST FIRST-TIME
            </span>
            <span style={{ fontSize: '1.9rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
              {formatMs(currentStats.fastestFirstTimeOverall)}
            </span>
          </div>

          <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center', borderColor: 'rgba(0, 255, 135, 0.4)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-green)', fontWeight: 800, letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
              FASTEST REPEAT (PB)
            </span>
            <span style={{ fontSize: '1.9rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
              {formatMs(currentStats.fastestRepeatOverall)}
            </span>
          </div>
        </div>

        {/* Detailed Stage Records Table */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="var(--accent-pink)" /> {selectedTab.toUpperCase()} STAGE SPEED RECORDS
          </h3>

          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
            {setEntries.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px', fontSize: '0.95rem' }}>
                No completed stages in {selectedTab} mode yet. Complete a stage in {selectedTab} difficulty to record your speed!
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '14px 16px' }}>STAGE TITLE</th>
                    <th style={{ padding: '14px 16px' }}>FIRST TIME</th>
                    <th style={{ padding: '14px 16px' }}>BEST REPEAT</th>
                    <th style={{ padding: '14px 16px' }}>CLEARS</th>
                  </tr>
                </thead>
                <tbody>
                  {setEntries.map(([setId, setObj]) => (
                    <tr key={setId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#fff' }}>
                        {setObj.title || setId.toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
                        {formatMs(setObj.firstTime)}
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 800 }}>
                        {formatMs(setObj.fastestRepeat)}
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {setObj.clears || 1}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
