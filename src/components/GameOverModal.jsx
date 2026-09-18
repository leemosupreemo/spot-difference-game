import React from 'react';
import { RefreshCw, Skull, X } from 'lucide-react';
import { sounds } from '../utils/audio';
import { getSetNumber } from '../utils/setLeaderboards.js';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';

export default function GameOverModal({ isOpen, onClose, onRestart, elapsedTime, levelTitle, setId = null, themeId = 'find_the_sniper', isFirstAttempt = false }) {
  if (!isOpen) return null;

  const seconds = (elapsedTime / 1000).toFixed(2);
  const isAbstract = themeId === 'abstract_animated';
  const stageNumber = getSetNumber(setId);

  return (
    <div
      onClick={() => { sounds.playTap(); onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-panel modal-split-card"
        onClick={(e) => e.stopPropagation()}
        style={{
        maxWidth: '440px',
        width: '94%',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
        padding: '20px 18px',
        boxSizing: 'border-box',
        textAlign: 'center',
        border: '2px solid var(--accent-pink)',
        boxShadow: '0 0 40px rgba(255, 0, 127, 0.45)',
        borderRadius: '20px',
        position: 'relative',
        '--modal-accent': 'var(--accent-pink)'
      }}>
        <ModalAmbientParticles />

        {/* Top Right Close "X" Button */}
        <button
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(255,255,255,0.08)',
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
          title="Return to Main Menu"
        >
          <X size={18} />
        </button>

        {/* Skull Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-pink), #8a004f)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto',
          boxShadow: '0 0 24px var(--accent-pink)'
        }}>
          <Skull size={28} color="#000" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '8px', color: 'var(--accent-pink)', letterSpacing: '0.5px' }}>
          STAGE FAILED
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: isFirstAttempt ? '8px' : '16px', fontWeight: 600 }}>
          {isAbstract ? levelTitle : `Stage #${stageNumber}`}
        </p>

        {isFirstAttempt && (
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--accent-pink)',
            background: 'rgba(255, 0, 127, 0.1)',
            border: '1px solid rgba(255, 0, 127, 0.35)',
            borderRadius: '10px',
            padding: '7px 12px',
            marginBottom: '16px',
            letterSpacing: '0.3px'
          }}>
            1st Attempt marked as 'Failed' in records
          </div>
        )}

        {/* Performance Breakdown */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--modal-gap-md)',
          background: 'rgba(0,0,0,0.45)',
          padding: '14px 16px',
          borderRadius: '16px',
          marginBottom: '20px',
          textAlign: 'left',
          border: '1px solid var(--border-glass)'
        }}>
          <div style={{ padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              TIME REACHED
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)' }}>
              {seconds}s
            </span>
          </div>

          <div style={{ padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              LIVES REMAINING
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent-pink)', fontFamily: 'var(--font-mono)' }}>
              0 / 3 ❤️
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 'var(--modal-gap-md)', justifyContent: 'center' }}>
          <button
            className="glass-btn glass-btn-primary"
            onClick={() => { sounds.playTap(); onRestart(); }}
            style={{ flex: 1, justifyContent: 'center', fontSize: '1.1rem', fontWeight: 900, padding: '12px', borderRadius: '14px' }}
          >
            <RefreshCw size={18} /> Try Again
          </button>

          <button
            className="glass-btn"
            onClick={() => { sounds.playTap(); onClose(); }}
            style={{ flex: 1, justifyContent: 'center', fontSize: '1rem', fontWeight: 800, padding: '12px', borderRadius: '14px' }}
          >
            Main Menu
          </button>
        </div>

      </div>
    </div>
  );
}
