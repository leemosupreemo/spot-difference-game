import React, { useState } from 'react';
import { Star, X, Heart } from 'lucide-react';
import { sounds } from '../utils/audio';
import { trackRatingPromptAction } from '../services/analytics';
import { getAppStoreReviewUrl } from '../services/appConfig';

export default function RatingModal({
  isOpen,
  onClose,
  onOpenSupport,
  visitNumber = 2
}) {
  const [hoverRating, setHoverRating] = useState(null);
  const [selectedRating, setSelectedRating] = useState(5);

  if (!isOpen) return null;

  const currentDisplayRating = hoverRating !== null ? hoverRating : selectedRating;

  const handleSelectRating = (rating) => {
    setSelectedRating(rating);

    if (rating >= 4.0) {
      sounds.playWin();
      try {
        localStorage.setItem('diff_hunter_rating_handled', 'rated');
        localStorage.setItem('diff_hunter_rating_score', String(rating));
      } catch (_) {}

      trackRatingPromptAction({ action: 'rate', rating, visitNumber });

      const reviewUrl = getAppStoreReviewUrl();
      try {
        if (typeof window !== 'undefined') {
          window.open(reviewUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (_) {}

      onClose();
    } else {
      sounds.playTap();
      try {
        localStorage.setItem('diff_hunter_rating_handled', 'feedback');
        localStorage.setItem('diff_hunter_rating_score', String(rating));
      } catch (_) {}

      trackRatingPromptAction({ action: 'feedback', rating, visitNumber });
      onClose();

      if (typeof onOpenSupport === 'function') {
        onOpenSupport(rating);
      }
    }
  };

  const handleDismiss = () => {
    sounds.playTap();
    try {
      localStorage.setItem('diff_hunter_rating_handled', 'dismissed');
    } catch (_) {}

    trackRatingPromptAction({ action: 'dismiss', visitNumber });
    onClose();
  };

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
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
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '400px',
          width: '100%',
          maxHeight: 'min(90vh, 380px)',
          overflowY: 'auto',
          padding: '24px 20px',
          position: 'relative',
          textAlign: 'center',
          borderRadius: '24px',
          border: '2px solid rgba(255, 183, 3, 0.4)',
          boxShadow: '0 0 45px rgba(255, 183, 3, 0.25), 0 20px 50px rgba(0, 0, 0, 0.7)',
          animation: 'pageFadeIn 0.15s ease-out',
          boxSizing: 'border-box'
        }}
      >
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

        {/* Top Floating Heart Icon */}
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255, 0, 127, 0.25), rgba(255, 183, 3, 0.3))',
          border: '2px solid var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '4px auto 14px auto',
          boxShadow: '0 0 22px rgba(255, 183, 3, 0.45)'
        }}>
          <Heart size={26} color="var(--accent-pink)" fill="var(--accent-pink)" />
        </div>

        {/* Header Title */}
        <h2 style={{
          fontSize: '1.45rem',
          fontWeight: 900,
          margin: '0 0 18px 0',
          background: 'linear-gradient(90deg, #ffffff, var(--accent-gold))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Enjoying Diff Hunter?
        </h2>

        {/* Interactive 5-Star Row with Half-Star Selection */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '22px',
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '14px 12px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {[1, 2, 3, 4, 5].map((star) => {
            const isFull = currentDisplayRating >= star;
            const isHalf = !isFull && currentDisplayRating >= star - 0.5;

            return (
              <div
                key={star}
                style={{
                  position: 'relative',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {/* Background Empty Star */}
                <Star
                  size={34}
                  color="rgba(255, 255, 255, 0.25)"
                  fill="none"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Filled Star Overlay (Full or Half via clipPath) */}
                {(isFull || isHalf) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: 2,
                      width: '34px',
                      height: '34px',
                      clipPath: isHalf ? 'inset(0 50% 0 0)' : 'none',
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Star
                      size={34}
                      color="var(--accent-gold)"
                      fill="var(--accent-gold)"
                      style={{
                        filter: 'drop-shadow(0 0 10px rgba(255, 183, 3, 0.9))'
                      }}
                    />
                  </div>
                )}

                {/* Left Half Click Target (star - 0.5) */}
                <button
                  type="button"
                  onClick={() => handleSelectRating(star - 0.5)}
                  onMouseEnter={() => setHoverRating(star - 0.5)}
                  onMouseLeave={() => setHoverRating(null)}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '50%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    zIndex: 2,
                    padding: 0
                  }}
                  aria-label={`${star - 0.5} Stars`}
                />

                {/* Right Half Click Target (star) */}
                <button
                  type="button"
                  onClick={() => handleSelectRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '50%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    zIndex: 2,
                    padding: 0
                  }}
                  aria-label={`${star} Stars`}
                />
              </div>
            );
          })}
        </div>

        {/* Action Button: Maybe Later only */}
        <div>
          <button
            type="button"
            className="glass-btn"
            onClick={handleDismiss}
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: '0.92rem',
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
    </div>
  );
}
