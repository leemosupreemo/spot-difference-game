import React, { useState, useEffect, useRef } from 'react';
import { Share2, Copy, Download, Check, Sparkles, Trophy, X, Flame } from 'lucide-react';
import { sounds } from '../utils/audio';
import {
  generateChallengeUrl,
  generateChallengeText,
  renderChallengeCardBlob,
  recordLocalShareEvent
} from '../utils/challengeMetrics';
import {
  trackChallengeShareClicked,
  trackChallengeShareCompleted,
  trackChallengeShareCancelled
} from '../services/analytics';
import { getSavedPlayerName } from '../services/playerProgress';

export default function ShareChallengeModal({
  isOpen,
  onClose,
  elapsedTime = 2430,
  percentileBeat = 93,
  topPercentile = 7,
  isPersonalBest = false,
  difficulty = 'Medium',
  themeId = 'find_the_sniper',
  levelTitle = 'Photography Stage',
  levelId = ''
}) {
  const [copied, setCopied] = useState(false);
  const [cardBlob, setCardBlob] = useState(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const playerName = getSavedPlayerName() || 'SpeedHunter';

  const seconds = (Math.max(0, elapsedTime) / 1000).toFixed(2);
  const challengeUrl = generateChallengeUrl({
    elapsedTimeMs: elapsedTime,
    playerName,
    difficulty,
    themeId,
    levelId
  });

  const shareText = generateChallengeText({
    elapsedTimeMs: elapsedTime,
    beatPercentile: percentileBeat,
    isPersonalBest,
    playerName,
    challengeUrl
  });

  // Generate Canvas Card Blob on mount or open
  useEffect(() => {
    if (isOpen) {
      setIsGeneratingCard(true);
      renderChallengeCardBlob({
        elapsedTimeMs: elapsedTime,
        beatPercentile: percentileBeat,
        topPercentile,
        isPersonalBest,
        playerName,
        levelTitle
      })
        .then(blob => {
          setCardBlob(blob);
        })
        .catch(() => {})
        .finally(() => setIsGeneratingCard(false));
    } else {
      setCopied(false);
      setToastMessage(null);
    }
  }, [isOpen, elapsedTime, percentileBeat, topPercentile, isPersonalBest, playerName, levelTitle]);

  if (!isOpen) return null;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleNativeShare = async () => {
    sounds.playTap();
    trackChallengeShareClicked({
      source: 'share_modal_native',
      elapsedTimeMs: elapsedTime,
      percentileBeat,
      isPersonalBest,
      difficulty,
      themeId
    });
    recordLocalShareEvent('tap');

    const shareData = {
      title: `Diff Hunter Challenge: Can you beat ${seconds}s?`,
      text: shareText,
      url: challengeUrl
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        if (cardBlob && navigator.canShare && navigator.canShare({ files: [new File([cardBlob], 'diff_hunter_challenge.png', { type: 'image/png' })] })) {
          const file = new File([cardBlob], 'diff_hunter_challenge.png', { type: 'image/png' });
          await navigator.share({
            ...shareData,
            files: [file]
          });
        } else {
          await navigator.share(shareData);
        }

        trackChallengeShareCompleted({
          method: 'native_share',
          elapsedTimeMs: elapsedTime,
          percentileBeat,
          isPersonalBest,
          difficulty,
          themeId
        });
        recordLocalShareEvent('complete');
        showToast('Challenge shared successfully! 🚀');
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.warn('[ShareChallenge] Native share error, falling back to clipboard:', err);
          handleCopyText();
        } else {
          trackChallengeShareCancelled({ reason: 'user_cancelled', elapsedTimeMs: elapsedTime });
        }
      }
    } else {
      handleCopyText();
    }
  };

  const handleCopyText = async () => {
    sounds.playTap();
    trackChallengeShareClicked({
      source: 'share_modal_copy',
      elapsedTimeMs: elapsedTime,
      percentileBeat,
      isPersonalBest,
      difficulty,
      themeId
    });
    recordLocalShareEvent('tap');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        trackChallengeShareCompleted({
          method: 'clipboard',
          elapsedTimeMs: elapsedTime,
          percentileBeat,
          isPersonalBest,
          difficulty,
          themeId
        });
        recordLocalShareEvent('complete');
        showToast('Challenge copied to clipboard! Send to your friends 🚀');
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleDownloadCard = () => {
    sounds.playTap();
    trackChallengeShareClicked({
      source: 'share_modal_image_download',
      elapsedTimeMs: elapsedTime,
      percentileBeat,
      isPersonalBest,
      difficulty,
      themeId
    });
    recordLocalShareEvent('tap');

    if (!cardBlob) return;

    try {
      const url = URL.createObjectURL(cardBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DiffHunter_Challenge_${seconds}s.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      trackChallengeShareCompleted({
        method: 'image_download',
        elapsedTimeMs: elapsedTime,
        percentileBeat,
        isPersonalBest,
        difficulty,
        themeId
      });
      recordLocalShareEvent('complete');
      showToast('Challenge Card saved to photos/downloads! 📸');
    } catch (e) {
      console.warn('Download error:', e);
    }
  };

  return (
    <div
      onClick={() => { sounds.playTap(); onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'pageFadeIn 0.15s ease-out'
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '94%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '20px',
          textAlign: 'center',
          border: '2px solid var(--accent-gold)',
          boxShadow: '0 0 45px rgba(255, 183, 3, 0.4)',
          borderRadius: '24px',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => { sounds.playTap(); onClose(); }}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-muted)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Title / Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
          <Flame size={24} color="var(--accent-gold)" />
          <h2 style={{
            fontSize: '1.35rem',
            fontWeight: 900,
            margin: 0,
            background: 'linear-gradient(90deg, #fff, var(--accent-gold))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            CHALLENGE A FRIEND
          </h2>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Send your time to friends. See who has the fastest reaction!
        </p>

        {/* Challenge Preview Card */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(5, 7, 11, 0.98))',
          border: '1.5px solid rgba(0, 240, 255, 0.45)',
          borderRadius: '18px',
          padding: '16px 14px',
          marginBottom: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {isPersonalBest && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(255, 183, 3, 0.2)',
              border: '1px solid var(--accent-gold)',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '0.74rem',
              fontWeight: 900,
              color: 'var(--accent-gold)',
              marginBottom: '8px'
            }}>
              <Trophy size={13} /> NEW PERSONAL BEST
            </div>
          )}

          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            DIFF HUNTER • SPOT THE DIFFERENCE
          </div>

          <div style={{
            fontSize: '2.4rem',
            fontWeight: 900,
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            margin: '6px 0',
            textShadow: '0 0 20px rgba(0, 240, 255, 0.7)'
          }}>
            {seconds}s
          </div>

          <div style={{
            fontSize: '0.92rem',
            fontWeight: 800,
            color: 'var(--accent-green)',
            marginBottom: '6px'
          }}>
            BEAT {percentileBeat}% OF PLAYERS
          </div>

          <div style={{
            display: 'inline-block',
            background: 'rgba(255, 183, 3, 0.15)',
            border: '1px solid rgba(255, 183, 3, 0.5)',
            padding: '3px 12px',
            borderRadius: '12px',
            fontSize: '0.78rem',
            fontWeight: 800,
            color: 'var(--accent-gold)',
            marginBottom: '10px'
          }}>
            TOP {topPercentile}% SPEED
          </div>

          <div style={{
            fontSize: '0.82rem',
            color: 'rgba(255,255,255,0.85)',
            fontStyle: 'italic',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '8px'
          }}>
            "👀 Can you beat my {seconds}s? There's ONE difference."
          </div>
        </div>

        {/* Toast Banner */}
        {toastMessage && (
          <div style={{
            background: 'rgba(0, 255, 136, 0.2)',
            border: '1px solid var(--accent-green)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '0.82rem',
            fontWeight: 700,
            marginBottom: '12px',
            animation: 'pageFadeIn 0.2s ease-out'
          }}>
            {toastMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Primary Share Action */}
          <button
            className="glass-btn glass-btn-primary"
            onClick={handleNativeShare}
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 900,
              padding: '12px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--accent-gold), #ff8800)',
              color: '#000',
              border: 'none',
              boxShadow: '0 4px 18px rgba(255, 183, 3, 0.45)'
            }}
          >
            <Share2 size={20} /> Share Challenge Link
          </button>

          {/* Copy Link / Text Button */}
          <button
            className="glass-btn"
            onClick={handleCopyText}
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: '0.92rem',
              fontWeight: 800,
              padding: '10px',
              borderRadius: '12px'
            }}
          >
            {copied ? <Check size={18} color="var(--accent-green)" /> : <Copy size={18} />}
            {copied ? 'Copied to Clipboard!' : 'Copy Challenge Text & Link'}
          </button>

          {/* Download Graphic Card */}
          <button
            className="glass-btn"
            onClick={handleDownloadCard}
            disabled={!cardBlob || isGeneratingCard}
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: '0.86rem',
              fontWeight: 700,
              padding: '9px',
              borderRadius: '12px',
              opacity: cardBlob ? 1 : 0.6
            }}
          >
            <Download size={16} /> Save Branded Image Card
          </button>
        </div>

      </div>
    </div>
  );
}
