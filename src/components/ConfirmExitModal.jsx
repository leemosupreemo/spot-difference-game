import React from 'react';
import { AlertCircle, X, Play } from 'lucide-react';
import { sounds } from '../utils/audio';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';

export default function ConfirmExitModal({ isOpen, onConfirm, onCancel, isDaily = false, isFirstAttempt = false }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={() => { sounds.playTap(); onCancel(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'transparent',
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
          maxWidth: '420px',
          width: '94%',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          padding: '24px 20px',
          boxSizing: 'border-box',
          textAlign: 'center',
          border: (isDaily || isFirstAttempt) ? '1.5px solid rgba(255, 0, 127, 0.6)' : '1.5px solid rgba(0, 240, 255, 0.4)',
          boxShadow: (isDaily || isFirstAttempt) ? '0 0 35px rgba(255, 0, 127, 0.35)' : '0 0 35px rgba(0, 240, 255, 0.25)',
          borderRadius: '20px',
          position: 'relative',
          '--modal-accent': (isDaily || isFirstAttempt) ? 'var(--accent-pink)' : 'var(--accent-cyan)'
        }}
      >
        <ModalAmbientParticles />
        {/* Top Right Close "X" Button */}
        <button
          onClick={() => { sounds.playTap(); onCancel(); }}
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
          title="Resume Game"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Warning / Exit Icon Badge */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: (isDaily || isFirstAttempt) ? 'rgba(255, 0, 127, 0.15)' : 'rgba(0, 240, 255, 0.15)',
          border: (isDaily || isFirstAttempt) ? '1.5px solid var(--accent-pink)' : '1.5px solid var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto',
          boxShadow: (isDaily || isFirstAttempt) ? '0 0 20px rgba(255, 0, 127, 0.4)' : '0 0 20px rgba(0, 240, 255, 0.35)'
        }}>
          <AlertCircle size={28} color={(isDaily || isFirstAttempt) ? 'var(--accent-pink)' : 'var(--accent-cyan)'} />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '8px', color: (isDaily || isFirstAttempt) ? 'var(--accent-pink)' : '#fff', letterSpacing: '0.5px' }}>
          {isDaily ? 'Forfeit Set of the Day?' : (isFirstAttempt ? 'Abandon 1st Attempt?' : 'Quit Current Game?')}
        </h2>
        <p style={{ fontSize: '0.88rem', color: isFirstAttempt ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.45 }}>
          {isDaily
            ? "This will mark today's set as a failure."
            : isFirstAttempt
              ? "Quitting now counts as a failed 1st attempt and will be recorded as 'Failed' in records."
              : "Your current stage progress will be lost."}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            className="glass-btn glass-btn-primary"
            onClick={() => { sounds.playTap(); onCancel(); }}
            style={{
              flex: 1,
              justifyContent: 'center',
              fontSize: '0.98rem',
              fontWeight: 800,
              padding: '12px 14px',
              borderRadius: '12px'
            }}
          >
            <Play size={17} fill="#000" /> Keep Playing
          </button>

          <button
            className="glass-btn"
            onClick={() => { sounds.playTap(); onConfirm(); }}
            style={{
              flex: 1,
              justifyContent: 'center',
              fontSize: '0.95rem',
              fontWeight: 800,
              padding: '12px 14px',
              borderRadius: '12px',
              borderColor: 'rgba(255, 0, 127, 0.4)',
              color: 'var(--accent-pink)',
              background: 'rgba(255, 0, 127, 0.08)'
            }}
          >
            {isDaily ? 'Forfeit' : 'Quit to Menu'}
          </button>
        </div>
      </div>
    </div>
  );
}
