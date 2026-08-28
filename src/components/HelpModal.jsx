import React, { useState } from 'react';
import { Eye, Timer, Lightbulb, X, Shield, ExternalLink, HelpCircle, CheckCircle2 } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function HelpModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'privacy'

  if (!isOpen) return null;

  return (
    <div
      onClick={() => { sounds.playTap(); onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '24px',
          position: 'relative',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        
        {/* Close Button */}
        <button
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px'
          }}
          aria-label="Close"
        >
          <X size={22} />
        </button>

        {/* Tab Selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <button
            onClick={() => { sounds.playTap(); setActiveTab('rules'); }}
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '10px',
              border: activeTab === 'rules' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
              background: activeTab === 'rules' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'rules' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <HelpCircle size={16} /> How to Play
          </button>

          <button
            onClick={() => { sounds.playTap(); setActiveTab('privacy'); }}
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '10px',
              border: activeTab === 'privacy' ? '1px solid var(--accent-pink)' : '1px solid var(--border-glass)',
              background: activeTab === 'privacy' ? 'rgba(255, 0, 127, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'privacy' ? 'var(--accent-pink)' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Shield size={16} /> Privacy & Data
          </button>
        </div>

        {/* Tab Content Area */}
        <div style={{ overflowY: 'auto', paddingRight: '4px', marginBottom: '18px' }}>
          {activeTab === 'rules' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem', color: 'var(--text-main)' }}>
              
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
                  <strong style={{ color: '#fff', display: 'block' }}>3. Hints & Dual Magnifier Loupe</strong>
                  Stuck on a tricky detail? Use the Hint button to trigger a golden radar pulse around the difference, or toggle Zoom for a dual magnifying glass lens.
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              
              <div style={{ background: 'rgba(0, 240, 255, 0.06)', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                  <CheckCircle2 size={16} /> Privacy-First Architecture
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  Diff Hunter does not collect names, emails, phone numbers, or physical locations. Zero cross-app advertising tracking or IDFA data brokers.
                </p>
              </div>

              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Anonymous Analytics & Cloud Saves</strong>
                <p style={{ margin: 0, lineHeight: 1.4 }}>
                  We collect aggregate gameplay metrics (levels played, clear speed, category choices) via Mixpanel and optional leaderboard scores via Firebase anonymous authentication to ensure balance and performance.
                </p>
              </div>

              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Local Data & Reset</strong>
                <p style={{ margin: 0, lineHeight: 1.4 }}>
                  Your game preferences and audio settings are saved locally on your device. You can reset your data anytime in device settings.
                </p>
              </div>

              <div style={{ paddingTop: '6px' }}>
                <a
                  href="/privacy-policy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: '0.85rem'
                  }}
                >
                  View Full Privacy Policy <ExternalLink size={14} />
                </a>
              </div>

            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          className="glass-btn glass-btn-primary"
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{ width: '100%', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 900, padding: '12px', borderRadius: '14px' }}
        >
          Got It!
        </button>

      </div>
    </div>
  );
}
