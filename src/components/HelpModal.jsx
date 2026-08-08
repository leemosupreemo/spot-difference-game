import React from 'react';
import { Eye, Timer, Lightbulb, Search, X, Zap } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

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
        maxWidth: '500px',
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

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '16px', color: 'var(--accent-cyan)' }}>
          HOW TO PLAY
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '24px' }}>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(0, 240, 255, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <Eye size={20} color="var(--accent-cyan)" />
            </div>
            <div>
              <strong style={{ color: '#fff', display: 'block' }}>1. Compare Image Pairs Side-by-Side</strong>
              Look closely at the Original (left) and Modified (right) images to spot subtle differences (recolored items, missing objects, rotated details).
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(255, 0, 127, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <Timer size={20} color="var(--accent-pink)" />
            </div>
            <div>
              <strong style={{ color: '#fff', display: 'block' }}>2. Instant Millisecond Speedrun Timer</strong>
              The timer starts automatically the instant a new pair appears! Tap as fast as possible for high speed bonuses.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(255, 183, 3, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <Lightbulb size={20} color="var(--accent-gold)" />
            </div>
            <div>
              <strong style={{ color: '#fff', display: 'block' }}>3. Hints & Magnifier Lens</strong>
              Stuck on a tricky detail? Use the Hint button to trigger a golden radar pulse around a missing difference, or toggle Zoom for a dual magnifying glass lens.
            </div>
          </div>

        </div>

        <button
          className="glass-btn glass-btn-primary"
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{ width: '100%', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 900, padding: '16px', borderRadius: '16px' }}
        >
          Got It!
        </button>

      </div>
    </div>
  );
}
