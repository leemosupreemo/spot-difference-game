import React from 'react';
import { AlertCircle, X, Play } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function ConfirmExitModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={() => { sounds.playTap(); onCancel(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '420px',
          width: '94%',
          padding: '24px 20px',
          textAlign: 'center',
          border: '1.5px solid rgba(0, 240, 255, 0.4)',
          boxShadow: '0 0 35px rgba(0, 240, 255, 0.25)',
          borderRadius: '20px',
          position: 'relative',
          animation: 'pageFadeIn 0.12s ease-out'
        }}
      >
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
          background: 'rgba(0, 240, 255, 0.15)',
          border: '1.5px solid var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto',
          boxShadow: '0 0 20px rgba(0, 240, 255, 0.35)'
        }}>
          <AlertCircle size={30} color="var(--accent-cyan)" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '8px', color: '#fff', letterSpacing: '0.5px' }}>
          Quit Current Game?
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.45 }}>
          Your current stage progress will be lost. Are you sure you want to return to the menu?
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
            Quit to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
