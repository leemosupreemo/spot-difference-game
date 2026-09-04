import React, { useState } from 'react';
import { Eye, Timer, X, Shield, ExternalLink, HelpCircle, CheckCircle2, FileText, ArrowLeft } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function HelpModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'privacy'
  const [showFullPolicy, setShowFullPolicy] = useState(false);

  if (!isOpen) return null;

  const handleOpenExternal = () => {
    sounds.playTap();
    const url = 'https://thirteen-a5760.web.app/privacy-policy.html';
    try {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {}
  };

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
          maxWidth: '560px',
          width: '100%',
          padding: '24px',
          position: 'relative',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Right Close "X" Button */}
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

        {/* Tab Selector (only when not in full policy sub-view) */}
        {!showFullPolicy ? (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', paddingRight: '36px' }}>
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingRight: '36px' }}>
            <button
              onClick={() => { sounds.playTap(); setShowFullPolicy(false); }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-glass)',
                color: 'var(--accent-cyan)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={16} /> Back to Summary
            </button>

            <button
              onClick={handleOpenExternal}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Open in external browser"
            >
              Web Browser <ExternalLink size={13} />
            </button>
          </div>
        )}

        {/* Tab Content Area */}
        <div style={{ overflowY: 'auto', paddingRight: '4px', marginBottom: '18px', flex: 1 }}>
          {showFullPolicy ? (
            /* FULL IN-APP PRIVACY POLICY DOCUMENT */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--accent-cyan)',
                  background: 'rgba(0, 240, 255, 0.12)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  marginBottom: '6px'
                }}>
                  Legal & Privacy
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '4px 0 2px 0', color: '#fff' }}>
                  Diff Hunter Privacy Policy
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Effective Date: August 27, 2026 | Version 1.0
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Thank you for playing <strong style={{ color: '#fff' }}>Diff Hunter</strong>. We are committed to protecting your privacy. This policy explains what information is collected, how it is used, and how your privacy is safeguarded.
                </p>
              </div>

              <div style={{ background: 'rgba(0, 240, 255, 0.08)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(0, 240, 255, 0.25)' }}>
                <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '3px', fontSize: '0.84rem' }}>
                  🔒 Privacy-First Commitment
                </strong>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                  Diff Hunter does not require an account, does not collect personal identifiers (name, email, phone, location), and never sells your data or shares it with advertising data brokers.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-pink)', margin: '0 0 6px 0' }}>
                  1. Information We Collect
                </h3>
                <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  We only collect anonymous technical and gameplay data to ensure the game works reliably:
                </p>
                <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <li><strong>Gameplay Statistics:</strong> Levels played, puzzle completion times, victory/loss counts, hints used, and game mode selections.</li>
                  <li><strong>Device Diagnostics:</strong> Device type, screen resolution, OS version, and crash logs.</li>
                  <li><strong>Anonymous Identifier:</strong> An auto-generated random ID stored locally for high scores and optional leaderboards.</li>
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-pink)', margin: '0 0 6px 0' }}>
                  2. Information We Do NOT Collect
                </h3>
                <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <li>No names, email addresses, phone numbers, or personal contacts.</li>
                  <li>No GPS location data.</li>
                  <li>No camera, microphone, or photo library access.</li>
                  <li>No payment card or financial details.</li>
                  <li>Zero advertising tracking identifiers (IDFA).</li>
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-pink)', margin: '0 0 6px 0' }}>
                  3. Analytics & Infrastructure
                </h3>
                <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <li><strong>Mixpanel:</strong> Pseudonymized aggregate analytics for difficulty balancing.</li>
                  <li><strong>Firebase:</strong> Anonymous authentication for cloud scores and leaderboard rankings.</li>
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-pink)', margin: '0 0 6px 0' }}>
                  4. Children's Privacy (COPPA Compliant)
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Diff Hunter is designed for all ages (rated 4+). We do not knowingly collect any personally identifiable information from children under the age of 13.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-pink)', margin: '0 0 6px 0' }}>
                  5. Contact Us
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Support Email: <span style={{ color: 'var(--accent-cyan)' }}>support@thejauntcompany.com</span>
                </p>
              </div>
            </div>
          ) : activeTab === 'rules' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem', color: 'var(--text-main)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(0, 240, 255, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                  <Eye size={20} color="var(--accent-cyan)" />
                </div>
                <div>
                  <strong style={{ color: '#fff', display: 'block' }}>Tap the Difference</strong>
                  Look closely at the two images. As soon as you spot what's different, tap it directly on either image — plain and simple!
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(255, 0, 127, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                  <Timer size={20} color="var(--accent-pink)" />
                </div>
                <div>
                  <strong style={{ color: '#fff', display: 'block' }}>Speedrun Timer</strong>
                  The timer starts the moment the images appear. Find the difference as fast as possible to maximize your speed score and clear the stage!
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

              <div style={{ paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => { sounds.playTap(); setShowFullPolicy(true); }}
                  style={{
                    background: 'rgba(0, 240, 255, 0.12)',
                    border: '1px solid rgba(0, 240, 255, 0.35)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: 'var(--accent-cyan)',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%'
                  }}
                >
                  <FileText size={16} /> View Full Privacy Policy Document
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          className="glass-btn glass-btn-primary"
          onClick={() => {
            sounds.playTap();
            if (showFullPolicy) setShowFullPolicy(false);
            else onClose();
          }}
          style={{ width: '100%', justifyContent: 'center', fontSize: '1.05rem', fontWeight: 900, padding: '12px', borderRadius: '14px' }}
        >
          {showFullPolicy ? 'Done Reading' : 'Got It!'}
        </button>
      </div>
    </div>
  );
}
