import React from 'react';
import { Sparkles } from 'lucide-react';
import { hasCompletedFirstSet } from '../services/playerProgress';
import CompareDemoAnimation from './CompareDemoAnimation';

export default function TutorialBanner({ forceShow = false, animationEnabled = true }) {
  const isCompleted = !forceShow && hasCompletedFirstSet();

  if (isCompleted) {
    return null;
  }

  return (
    <div className="glass-panel tutorial-banner" style={{
      padding: '12px 16px 14px 16px',
      borderRadius: '18px',
      marginBottom: '14px',
      background: 'linear-gradient(135deg, rgba(16, 20, 32, 0.9), rgba(8, 10, 16, 0.98))',
      border: '1px solid rgba(0, 240, 255, 0.3)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
      boxSizing: 'border-box'
    }}>
      {/* 1. Full-Width Top Header: SPOT & TAP + Tagline across whole length of container */}
      <div style={{
        textAlign: 'center',
        marginBottom: '10px'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <Sparkles size={18} color="var(--accent-cyan)" />
          <h3 className="tutorial-header-title" style={{
            fontSize: '1.05rem',
            fontWeight: 900,
            color: '#fff',
            margin: 0,
            letterSpacing: '0.6px',
            textTransform: 'uppercase'
          }}>
            SPOT & TAP
          </h3>
        </div>
        <p className="tutorial-header-desc" style={{
          fontSize: '0.76rem',
          color: 'var(--text-muted)',
          margin: 0,
          lineHeight: '1.3'
        }}>
          Compare images and <strong style={{ color: 'var(--accent-cyan)' }}>tap the difference</strong> as fast as you can!
        </p>
      </div>

      {/* 2. Larger Tutorial Animation Side-by-Side */}
      <CompareDemoAnimation animationEnabled={animationEnabled} isCompleted={isCompleted} />
    </div>
  );
}
