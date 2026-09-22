import React, { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { sounds } from '../utils/audio';
import { trackRatingPromptAction } from '../services/analytics';
import { getAppStoreReviewUrl } from '../services/appConfig';
import { recordRatingPromptDismissed } from '../services/ratingPrompt';
import { getSavedPlayerName } from '../services/playerProgress';
import { submitPlayerFeedback } from '../services/feedbackService';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';

export const SUPPORT_EMAIL = 'support@thejauntcompany.com';
export const FEEDBACK_SUBJECT_PREFIX = '[Diff Hunter Feedback]';

export default function RatingModal({
  isOpen,
  onClose,
  attemptNumber = 1,
  playerName: propPlayerName,
  initialStep = 'prompt'
}) {
  const [step, setStep] = useState(initialStep); // 'prompt' | 'feedback' | 'thankyou'
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setFeedbackText('');
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  const rawName = propPlayerName || getSavedPlayerName();
  const playerName = rawName && rawName.trim() ? rawName.trim() : 'Hunter';

  const handleEnjoyingIt = () => {
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

  const handleCouldBeBetter = () => {
    sounds.playTap();
    setStep('feedback');
  };

  const handleSendFeedback = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sounds.playTap();

    try {
      localStorage.setItem('diff_hunter_rating_handled', 'feedback');
    } catch (_) {}

    trackRatingPromptAction({ action: 'feedback', attemptNumber, feedback: feedbackText });

    try {
      await submitPlayerFeedback({
        playerName,
        feedbackText,
        attemptNumber
      });
    } catch (err) {
      console.warn('Feedback submission warning:', err);
    } finally {
      sounds.playWin();
      setIsSubmitting(false);
      setStep('thankyou');
      setTimeout(() => {
        onClose();
      }, 2200);
    }
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
          border: '2px solid rgba(0, 240, 255, 0.35)',
          boxShadow: '0 0 45px rgba(0, 240, 255, 0.2), 0 20px 50px rgba(0, 0, 0, 0.7)',
          boxSizing: 'border-box',
          '--modal-accent': 'var(--accent-cyan)'
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

        {step === 'prompt' && (
          <div>
            {/* Header Title */}
            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: 900,
              letterSpacing: '0.5px',
              margin: '6px 0 10px 0',
              background: 'linear-gradient(90deg, #ffffff, var(--accent-cyan))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Enjoying Diff Hunter?
            </h2>

            {/* Body Copy */}
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '0.94rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              lineHeight: 1.45,
              padding: '0 8px'
            }}>
              {playerName ? `${playerName}, we'd love to know if you're enjoying Diff Hunter!` : "We'd love to know if you're enjoying Diff Hunter!"}
            </p>

            {/* 2-Column Split: Could be better vs Enjoying it */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              margin: '0 -20px -24px -20px',
              borderRadius: '0 0 24px 24px',
              overflow: 'hidden'
            }}>
              <button
                type="button"
                className="rating-choice-btn rating-choice-left"
                onClick={handleCouldBeBetter}
                style={{
                  borderRight: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '24px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
                aria-label="Could be better"
              >
                <span style={{ fontSize: '2.5rem', lineHeight: 1 }} role="img" aria-label="Unhappy face">🙁</span>
                <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                  Could be better
                </span>
              </button>

              <button
                type="button"
                className="rating-choice-btn rating-choice-right"
                onClick={handleEnjoyingIt}
                style={{
                  padding: '24px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
                aria-label="Enjoying it"
              >
                <span style={{ fontSize: '2.5rem', lineHeight: 1 }} role="img" aria-label="Heart eyes face">😍</span>
                <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  Enjoying it
                </span>
              </button>
            </div>
          </div>
        )}

        {step === 'feedback' && (
          <div>
            {/* Centered Header Title aligned with close 'X' button */}
            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: 900,
              letterSpacing: '0.5px',
              margin: '-6px 36px 12px 36px',
              textAlign: 'center',
              background: 'linear-gradient(90deg, #ffffff, var(--accent-cyan))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              How can we improve?
            </h2>

            <p style={{
              margin: '0 0 16px 0',
              fontSize: '0.88rem',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
              textAlign: 'left',
              padding: '0 4px'
            }}>
              Tell us what felt off or share any ideas. Your feedback gets sent directly to our team at <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{SUPPORT_EMAIL}</span>.
            </p>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell us what could be better, report a puzzle issue, or share any suggestions..."
              style={{
                width: '100%',
                minHeight: '110px',
                padding: '12px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: '0.88rem',
                lineHeight: 1.45,
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: '16px',
                fontFamily: 'inherit'
              }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="glass-btn glass-btn-primary"
                onClick={handleSendFeedback}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  padding: '12px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isSubmitting ? 0.75 : 1,
                  cursor: isSubmitting ? 'default' : 'pointer'
                }}
              >
                <Send size={16} style={{ animation: isSubmitting ? 'pulse 1s infinite' : 'none' }} />
                {isSubmitting ? 'Sending…' : 'Send Feedback'}
              </button>
              <button
                type="button"
                className="glass-btn"
                onClick={handleDismiss}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === 'thankyou' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '10px' }} role="img" aria-label="Mailbox">💌</div>
            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: 900,
              color: '#fff',
              margin: '0 0 8px 0',
              letterSpacing: '0.5px'
            }}>
              Thank You!
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 16px 0', lineHeight: 1.45 }}>
              We appreciate your input. It helps us make Diff Hunter better for everyone!
            </p>
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={onClose}
              style={{
                padding: '8px 24px',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: 800,
                margin: '0 auto'
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
