import React, { useState } from 'react';
import { Award, Trophy, Clock, Zap, CheckCircle2, X, Star, Flame, RotateCcw } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function ProgressModal({ isOpen, onClose, difficultyStats }) {
  const [selectedTab, setSelectedTab] = useState('Easy'); // Easy | Medium | Hard

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
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(14px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '650px',
        width: '100%',
        padding: '32px',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        
        {/* Close Button */}
        <button
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-glass)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Trophy size={28} color="var(--accent-gold)" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>PROGRESS & RECORDS</h2>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Track your fastest first-time and repeat records categorized by difficulty.
        </p>

        {/* Difficulty Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '10px',
          background: 'rgba(0,0,0,0.5)',
          padding: '6px',
          borderRadius: '14px',
          marginBottom: '24px'
        }}>
          {['Easy', 'Medium', 'Hard'].map((diff) => (
            <button
              key={diff}
              onClick={() => { sounds.playTap(); setSelectedTab(diff); }}
              className={`glass-btn ${selectedTab === diff ? 'glass-btn-primary' : ''}`}
              style={{
                justifyContent: 'center',
                padding: '10px',
                fontSize: '0.9rem',
                fontWeight: 700
              }}
            >
              {diff === 'Easy' && '🟢 '}
              {diff === 'Medium' && '🟡 '}
              {diff === 'Hard' && '🔴 '}
              {diff}
            </button>
          ))}
        </div>

        {/* Difficulty Overview Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: 'rgba(0, 240, 255, 0.08)',
            border: '1px solid rgba(0, 240, 255, 0.2)',
            borderRadius: '14px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              SETS CLEARED
            </span>
            <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
              {currentStats.setsCleared} Sets
            </span>
          </div>

          <div style={{
            background: 'rgba(255, 183, 3, 0.08)',
            border: '1px solid rgba(255, 183, 3, 0.2)',
            borderRadius: '14px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              FASTEST FIRST-TIME
            </span>
            <span style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
              {formatMs(currentStats.fastestFirstTimeOverall)}
            </span>
          </div>

          <div style={{
            background: 'rgba(0, 255, 135, 0.08)',
            border: '1px solid rgba(0, 255, 135, 0.2)',
            borderRadius: '14px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              FASTEST REPEAT (PB)
            </span>
            <span style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
              {formatMs(currentStats.fastestRepeatOverall)}
            </span>
          </div>
        </div>

        {/* Categorized Set Records Table */}
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flame size={16} color="var(--accent-pink)" /> {selectedTab.toUpperCase()} STAGE SET RECORDS
        </h4>

        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
          {setEntries.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
              No completed sets in {selectedTab} mode yet. Play a set in {selectedTab} difficulty to record your speed!
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '12px 14px' }}>SET TITLE</th>
                  <th style={{ padding: '12px 14px' }}>FIRST TIME</th>
                  <th style={{ padding: '12px 14px' }}>BEST REPEAT</th>
                  <th style={{ padding: '12px 14px' }}>CLEARS</th>
                </tr>
              </thead>
              <tbody>
                {setEntries.map(([setId, setObj]) => (
                  <tr key={setId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#fff' }}>
                      {setObj.title || setId.toUpperCase()}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
                      {formatMs(setObj.firstTime)}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 700 }}>
                      {formatMs(setObj.fastestRepeat)}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {setObj.clears || 1}x
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
          style={{ width: '100%', justifyContent: 'center', marginTop: '24px' }}
        >
          Return to Menu
        </button>

      </div>
    </div>
  );
}
