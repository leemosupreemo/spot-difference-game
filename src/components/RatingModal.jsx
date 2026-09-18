import React from 'react';
import { Star, X } from 'lucide-react';
import { sounds } from '../utils/audio';
import { trackRatingPromptAction } from '../services/analytics';
import { getAppStoreReviewUrl } from '../services/appConfig';
import { recordRatingPromptDismissed } from '../services/ratingPrompt';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';

export default function RatingModal({
  isOpen,
  onClose,
  attemptNumber = 1
}) {
  if (!isOpen) return null;

  const handleRate = () => {
    sounds.playWin();
    try {
      localStorage.setItem('diff_hunter_rating_handled', 'rated');
    } catch (_) {}

    trackRatingPromptAction({ action: 'rate', attemptNumber });

    const reviewUrl = getAppStoreReviewUrl();
    try {
      if (typeof window !== 'undefined') {
        window.open(reviewUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {}

    onClose();
  };

  const handleDismiss = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    sounds.playTap();
    try {
      localStorage.setItem('diff_hunter_rating_handled', 'dismissed');
    } catch (_) {}
    recordRatingPromptDismissed();

    trackRatingPromptAction({ action: 'dismiss', attemptNumber });
    onClose();
  };

  return (
    <div
      onClick={handleDismiss}
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
        padding: '32px 16px',
        paddingTop: 'max(env(safe-area-inset-top), 32px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 32px)',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="glass-panel modal-split-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '400px',
          width: '100%',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          padding: '24px 20px',
          position: 'relative',
          textAlign: 'center',
          borderRadius: '24px',
          border: '2px solid rgba(255, 183, 3, 0.4)',
          boxShadow: '0 0 45px rgba(255, 183, 3, 0.25), 0 20px 50px rgba(0, 0, 0, 0.7)',
          boxSizing: 'border-box',
          '--modal-accent': 'var(--accent-gold)'
        }}
      >
        <ModalAmbientParticles />
        {/* Close "X" Button */}
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Compact 5-star visual (decorative, not interactive) */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
          marginBottom: '14px'
        }} aria-hidden="true">
          {[1, 2, 3, 4, 5].map(star => (
            <Star
              key={star}
              size={24}
              color="var(--accent-gold)"
              fill="var(--accent-gold)"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255, 183, 3, 0.8))' }}
            />
          ))}
        </div>

        {/* Header Title */}
        <h2 style={{
          fontSize: '1.4rem',
          fontWeight: 900,
          letterSpacing: '0.5px',
          margin: '0 0 8px 0',
          background: 'linear-gradient(90deg, #ffffff, var(--accent-gold))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Enjoying the game?
        </h2>

        {/* Body Copy */}
        <p style={{
          margin: '0 0 22px 0',
          fontSize: '0.92rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          lineHeight: 1.4
        }}>
          A quick rating really helps us out.
        </p>

        {/* Primary CTA */}
        <button
          type="button"
          className="glass-btn glass-btn-primary"
          onClick={handleRate}
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: '0.95rem',
            fontWeight: 800,
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '10px'
          }}
        >
          Rate the Game
        </button>

        {/* Secondary CTA */}
        <button
          type="button"
          className="glass-btn"
          onClick={handleDismiss}
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: '0.88rem',
            fontWeight: 700,
            padding: '10px 16px',
            borderRadius: '12px',
            color: 'var(--text-muted)'
          }}
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
