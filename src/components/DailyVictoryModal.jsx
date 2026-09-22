import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Star, Trophy, ArrowRight, Share2, X, Check, WifiOff } from 'lucide-react';
import { sounds } from '../utils/audio.js';
import { getDailyLeaderboard, fetchDailyLeaderboard, updateDailyPlayerName } from '../services/dailyChallenge.js';
import { savePlayerName, generateDefaultPlayerName } from '../services/playerProgress.js';
import { containsProfanity } from '../utils/profanityFilter.js';
import { isOnline, subscribeNetworkStatus } from '../services/networkService.js';
import {
  trackResultScreenViewed,
  identifyPlayer
} from '../services/analytics.js';
import { recordLocalShareEvent } from '../utils/challengeMetrics.js';
import { getSetNumber } from '../utils/setLeaderboards.js';
import ShareChallengeModal from './ShareChallengeModal.jsx';
import { isNativeSharing, shareChallengeResultDirectly } from '../utils/nativeShare.js';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';
import HunterTagRejectionNotice from './HunterTagRejectionNotice.jsx';

export default function DailyVictoryModal({
  isOpen,
  totalTimeMs = 0,
  position = 1,
  stars = 3,
  score = 0,
  isNewRecord = false,
  isFailed = false,
  isForfeit = false,
  setId = 'set_1',
  setNumber = null,
  forceOffline = false,
  onOpenLeaderboard,
  onClose
}) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);

  const displaySetNumber = setNumber || getSetNumber(setId) || 1;
  const isLeaderboardRecord = Boolean(!isFailed && (position === 1 || position === 2 || position === 3));

  const worldTitleConfig = React.useMemo(() => {
    if (!isFailed) {
      if (position === 1) {
        return {
          title: 'World 1st!',
          trophyColor: '#FFD700',
          trophyGlow: 'rgba(255, 215, 0, 0.65)',
          gradient: 'linear-gradient(90deg, #FFFFFF 0%, #FFD700 60%, #FFA500 100%)'
        };
      }
      if (position === 2) {
        return {
          title: 'World 2nd!',
          trophyColor: '#E0E0E0',
          trophyGlow: 'rgba(224, 224, 224, 0.65)',
          gradient: 'linear-gradient(90deg, #FFFFFF 0%, #E0E0E0 60%, #A0A0A0 100%)'
        };
      }
      if (position === 3) {
        return {
          title: 'World 3rd!',
          trophyColor: '#CD7F32',
          trophyGlow: 'rgba(205, 127, 50, 0.65)',
          gradient: 'linear-gradient(90deg, #FFFFFF 0%, #CD7F32 60%, #B87333 100%)'
        };
      }
    }
    return {
      title: 'Set Complete!',
      trophyColor: null,
      trophyGlow: null,
      gradient: 'linear-gradient(90deg, #fff, var(--accent-gold))'
    };
  }, [isFailed, position]);

  const recordBadgeText = React.useMemo(() => {
    if (isFailed) return null;
    // World 1st, 2nd, and 3rd are prominently displayed as the modal title with the trophy
    if (position === 1 || position === 2 || position === 3) return null;
    if (isNewRecord) return '(personal best!)';
    return null;
  }, [isFailed, position, isNewRecord]);

  const hasRecord = Boolean(isLeaderboardRecord || isNewRecord);

  // Player Hunter Tag / Leaderboard Name Entry — arcade style: only surfaces on a fresh record.
  // Starts blank so the placeholder shows; if the player quits without saving, a random name
  // is generated so the record still gets submitted instead of silently dropped.
  const [customPlayerName, setCustomPlayerName] = useState('');
  // 'form' (enter name) -> 'saved' ("Xth Place Saved!") -> 'collapsing' (animating shut) -> 'hidden'
  const [bannerPhase, setBannerPhase] = useState('form');
  const [nameRejected, setNameRejected] = useState(false);
  const [nameRejectReason, setNameRejectReason] = useState('profanity');
  const [networkOnline, setNetworkOnline] = useState(() => forceOffline ? false : isOnline());
  const bannerTimers = useRef([]);

  useEffect(() => {
    return subscribeNetworkStatus(online => {
      if (!forceOffline) setNetworkOnline(online);
    });
  }, [forceOffline]);

  useEffect(() => {
    if (isOpen) {
      setCustomPlayerName('');
      setBannerPhase('form');
      setNameRejected(false);
    }
    return () => {
      bannerTimers.current.forEach(clearTimeout);
      bannerTimers.current = [];
    };
  }, [isOpen]);

  const ordinalPlace = position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`;

  const submitRecordName = finalName => {
    savePlayerName(finalName);
    setCustomPlayerName(finalName);

    try {
      identifyPlayer(finalName, {
        "Hunter Tag": finalName,
        "Player Name": finalName
      });
    } catch (_) {}

    updateDailyPlayerName(finalName).then(() => {
      const updated = getDailyLeaderboard();
      setLeaderboardEntries(updated);
    }).catch(() => {});
  };

  const handleSaveName = () => {
    const trimmed = (customPlayerName || '').trim();
    if (!trimmed) {
      try { sounds.playError(); } catch (_) {}
      setNameRejectReason('empty');
      setNameRejected(true);
      return;
    }

    if (containsProfanity(trimmed)) {
      try { sounds.playError(); } catch (_) {}
      setNameRejectReason('profanity');
      setNameRejected(true);
      return;
    }
    setNameRejected(false);

    try { sounds.playTap(); } catch (_) {}
    submitRecordName(trimmed);
    setBannerPhase('saved');

    bannerTimers.current.push(setTimeout(() => setBannerPhase('collapsing'), 1600));
    bannerTimers.current.push(setTimeout(() => setBannerPhase('hidden'), 2000));
  };

  // If the player quits out of a fresh leaderboard record without saving a name,
  // fall back to their typed text (if valid) or a random generated name so the
  // record is still submitted rather than lost.
  const commitAbandonedRecordName = () => {
    if (!isLeaderboardRecord || bannerPhase !== 'form') return;
    const trimmed = (customPlayerName || '').trim();
    const finalName = (trimmed && !containsProfanity(trimmed)) ? trimmed : generateDefaultPlayerName();
    submitRecordName(finalName);
  };

  useEffect(() => {
    if (isOpen) {
      try {
        const entries = getDailyLeaderboard();
        setLeaderboardEntries(entries || []);
      } catch (_) {}

      // Fetch live global leaderboard from Firestore asynchronously
      fetchDailyLeaderboard().then(remoteEntries => {
        if (remoteEntries && remoteEntries.length > 0) {
          setLeaderboardEntries(remoteEntries);
        }
      }).catch(() => {});

      // Record result screen view for share rate conversion funnel
      recordLocalShareEvent('view');
      trackResultScreenViewed({
        elapsedTimeMs: totalTimeMs,
        isPersonalBest: Boolean(isNewRecord),
        score: 0,
        stars: stars || 0,
        difficulty: 'Daily',
        themeId: 'daily_challenge',
        isStageSet: true,
        isChallengeMode: false
      });

      if (!isFailed) {
        const isPb = Boolean(isNewRecord && !isLeaderboardRecord);

        if (typeof sounds.playFanfare === 'function') {
          sounds.playFanfare(stars, { isLeaderboardRecord, isPersonalBest: isPb });
        } else {
          sounds.playWin(stars, { isLeaderboardRecord, isPersonalBest: isPb });
        }

        const goldenFireworksColors = ['#FFD700', '#FFA500', '#FFDF00', '#FFEAA7', '#D4AF37', '#FFF380', '#DAA520', '#FFFFFF', '#F39C12'];
        const pbFireworksColors = ['#00F0FF', '#FF007F', '#00FF88', '#9D4EDD', '#FFB703', '#3A86FF', '#FFFFFF'];
        const standardColors = ['#00F0FF', '#7000FF', '#FF007F', '#00FF88', '#38EF7D', '#3A86FF', '#F12711'];

        try {
          if (isLeaderboardRecord) {
            // Golden Fireworks for New Daily Leaderboard Record (Top 3)
            confetti({
              particleCount: 150,
              spread: 360,
              startVelocity: 52,
              ticks: 150,
              origin: { x: 0.5, y: 0.35 },
              colors: goldenFireworksColors,
              scalar: 1.45
            });
            setTimeout(() => {
              try {
                confetti({
                  particleCount: 110,
                  spread: 360,
                  startVelocity: 48,
                  ticks: 130,
                  origin: { x: 0.22, y: 0.45 },
                  colors: goldenFireworksColors,
                  scalar: 1.35
                });
              } catch (_) {}
            }, 140);
            setTimeout(() => {
              try {
                confetti({
                  particleCount: 110,
                  spread: 360,
                  startVelocity: 48,
                  ticks: 130,
                  origin: { x: 0.78, y: 0.45 },
                  colors: goldenFireworksColors,
                  scalar: 1.35
                });
              } catch (_) {}
            }, 280);
          } else if (isPb) {
            // Vibrant Fireworks Variant for Personal Best
            confetti({
              particleCount: 135,
              spread: 360,
              startVelocity: 50,
              ticks: 140,
              origin: { x: 0.5, y: 0.38 },
              colors: pbFireworksColors,
              scalar: 1.4
            });
            setTimeout(() => {
              try {
                confetti({
                  particleCount: 100,
                  spread: 360,
                  startVelocity: 46,
                  ticks: 120,
                  origin: { x: 0.28, y: 0.42 },
                  colors: pbFireworksColors,
                  scalar: 1.3
                });
              } catch (_) {}
            }, 140);
            setTimeout(() => {
              try {
                confetti({
                  particleCount: 100,
                  spread: 360,
                  startVelocity: 46,
                  ticks: 120,
                  origin: { x: 0.72, y: 0.42 },
                  colors: pbFireworksColors,
                  scalar: 1.3
                });
              } catch (_) {}
            }, 280);
          } else if (stars === 3) {
            // More for 3 stars
            confetti({
              particleCount: 240,
              spread: 100,
              startVelocity: 48,
              origin: { y: 0.65 },
              colors: ['#FFD700', '#FFA500', '#FFDF00', '#F7B731', '#FFEAA7', '#00F0FF']
            });
          } else if (stars === 2) {
            // Some for 2 stars
            confetti({
              particleCount: 100,
              spread: 68,
              startVelocity: 42,
              origin: { y: 0.65 },
              colors: standardColors
            });
          }
          // None for 1 star (no confetti)
        } catch (_) {}
      }
    }
  }, [isOpen, stars, isFailed, totalTimeMs, isNewRecord, position]);

  if (!isOpen) return null;

  const totalSecStr = (totalTimeMs / 1000).toFixed(2);

  const handleShare = async () => {
    sounds.playTap();
    if (isNativeSharing()) {
      try {
        await shareChallengeResultDirectly({
          elapsedTime: totalTimeMs,
          isPersonalBest: isNewRecord,
          difficulty: 'Daily',
          themeId: 'daily_challenge',
          levelTitle: 'Set of the Day'
        });
      } catch (err) {
        console.warn('[DailyVictoryModal] Direct native share failed, falling back to modal:', err);
        setShareModalOpen(true);
      }
    } else {
      setShareModalOpen(true);
    }
  };

  const handleClose = () => {
    try { sounds.playTap(); } catch (_) {}
    commitAbandonedRecordName();
    if (onClose) onClose();
  };

  return (
    <>
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div
        className="glass-panel modal-split-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          borderRadius: '24px',
          padding: '24px 20px',
          background: isFailed
            ? 'linear-gradient(135deg, rgba(38, 12, 28, 0.96), rgba(16, 18, 30, 0.98))'
            : 'linear-gradient(135deg, rgba(26, 11, 46, 0.95), rgba(13, 17, 30, 0.98))',
          border: isFailed
            ? '2px solid rgba(255, 0, 127, 0.65)'
            : isNewRecord
            ? '2px solid var(--accent-gold)'
            : '2px solid rgba(0, 240, 255, 0.55)',
          boxShadow: isFailed
            ? '0 0 45px rgba(255, 0, 127, 0.4)'
            : isNewRecord
            ? '0 0 50px rgba(255, 183, 3, 0.45)'
            : '0 0 45px rgba(0, 240, 255, 0.35)',
          textAlign: 'center',
          boxSizing: 'border-box',
          position: 'relative',
          '--modal-accent': isFailed ? 'var(--accent-pink)' : isNewRecord ? 'var(--accent-gold)' : 'var(--accent-cyan)'
        }}
      >
        <ModalAmbientParticles />
        <button
          onClick={handleClose}
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
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Header: "Set Complete!" with Leaderboard button on left for success, or failure text title */}
        {!isFailed ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40px', marginBottom: '8px', padding: '0 48px' }}>
            <button
              onClick={() => { sounds.playTap(); commitAbandonedRecordName(); if (onOpenLeaderboard) onOpenLeaderboard(); }}
              aria-label="View daily leaderboard"
              title="View daily leaderboard"
              className="glass-btn"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '40px',
                height: '40px',
                padding: 0,
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-glass)',
                cursor: 'pointer',
                zIndex: 5
              }}
            >
              <Trophy size={20} color="var(--accent-gold)" />
            </button>

            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: 900,
              margin: 0,
              letterSpacing: '0.5px',
              textAlign: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--modal-gap-sm)'
            }}>
              {worldTitleConfig.trophyColor && (
                <Trophy
                  size={22}
                  color={worldTitleConfig.trophyColor}
                  fill={worldTitleConfig.trophyColor}
                  style={{
                    filter: `drop-shadow(0 0 10px ${worldTitleConfig.trophyGlow})`,
                    flexShrink: 0
                  }}
                />
              )}
              <span style={{
                background: worldTitleConfig.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                {worldTitleConfig.title}
              </span>
            </h2>
          </div>
        ) : (
          // Three columns with equal outer tracks centre the title on the modal
          // rather than on the space left over beside the icons. The icon track
          // keeps its content width when the modal is narrow, so the title
          // shifts instead of wrapping.
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 'var(--modal-gap-sm)', margin: '-12px 0 14px 0', minHeight: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--modal-gap-sm)' }}>
              <button
                onClick={handleShare}
                aria-label="Share daily result"
                title="Share result"
                className="glass-btn"
                style={{ width: '40px', height: '40px', padding: 0, justifyContent: 'center', borderRadius: '12px', flexShrink: 0 }}
              >
                <Share2 size={20} />
              </button>
              <button
                onClick={() => { sounds.playTap(); commitAbandonedRecordName(); if (onOpenLeaderboard) onOpenLeaderboard(); }}
                aria-label="View daily leaderboard"
                title="View daily leaderboard"
                className="glass-btn"
                style={{ width: '40px', height: '40px', padding: 0, justifyContent: 'center', borderRadius: '12px', flexShrink: 0 }}
              >
                <Trophy size={20} color="var(--accent-gold)" />
              </button>
            </div>
            <h2
              style={{
                fontSize: '0.92rem',
                fontWeight: 900,
                color: 'var(--accent-pink)',
                letterSpacing: '0.4px',
                margin: 0,
                lineHeight: 1.2,
                textAlign: 'center'
              }}
            >
              {isForfeit ? 'DAILY CHALLENGE FORFEITED' : 'DAILY CHALLENGE RUN ENDED'}
            </h2>
            <div aria-hidden="true" />
          </div>
        )}

        {/* Stars Awarded (Only on Success). Outline stays static; only the gold fill pops in, per star. */}
        {!isFailed && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--modal-gap-sm)', marginBottom: '8px', padding: '6px 0', overflow: 'visible' }}>
            {[1, 2, 3].map((starIndex) => {
              const isEarned = starIndex <= stars;
              return (
                <div key={starIndex} style={{ position: 'relative', width: '36px', height: '36px', overflow: 'visible' }}>
                  <Star size={36} color="rgba(255, 255, 255, 0.2)" fill="none" />
                  {isEarned && (
                    <div style={{ position: 'absolute', inset: '-16px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', overflow: 'visible' }}>
                      <Star
                        size={36}
                        color="var(--accent-gold)"
                        fill="var(--accent-gold)"
                        style={{
                          filter: 'drop-shadow(0 0 6px rgba(255, 183, 3, 0.85))',
                          animation: `starFillPopIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${(starIndex - 1) * 0.65}s both`,
                          overflow: 'visible'
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Underneath centered: Pts (World 1st/2nd/3rd already headlines the trophy title, so points are folded into the detail list instead) */}
        {!isFailed && !isLeaderboardRecord && (
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 900,
            color: 'var(--accent-gold)',
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            marginBottom: '4px'
          }}>
            {score.toLocaleString()} PTS
          </div>
        )}

        {/* Hero Completion Time (Only on Success) */}
        {!isFailed && (
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--modal-gap-sm)', flexWrap: 'wrap' }}>
            {hasRecord && (
              <button
                onClick={handleShare}
                aria-label="Share daily result"
                title="Share daily result"
                className="glass-btn"
                style={{ width: '40px', height: '40px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.9), rgba(255, 110, 0, 0.95))', color: '#000', border: 'none', cursor: 'pointer' }}
              >
                <Share2 size={20} />
              </button>
            )}
            <span
              style={{
                fontSize: '2.4rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                color: '#ffffff',
                textShadow: '0 0 24px rgba(0, 240, 255, 0.65)',
                lineHeight: 1.1
              }}
            >
              {totalSecStr}s
            </span>
            {recordBadgeText && (
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 900,
                  color: 'var(--accent-gold)',
                  textShadow: '0 0 10px rgba(255, 183, 3, 0.8)'
                }}
              >
                {recordBadgeText}
              </span>
            )}
          </div>
        )}

        {/* Details Subsection: Left-aligned details with right-aligned values (no attempt # for daily) */}
        {!isFailed && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid var(--border-glass)',
            borderRadius: '14px',
            padding: '10px 16px',
            marginBottom: '14px',
            fontSize: '0.95rem',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', ...(isLeaderboardRecord ? { borderBottom: '1px solid rgba(255, 255, 255, 0.06)' } : {}) }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Set #</span>
              <span style={{ fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>{displaySetNumber}</span>
            </div>
            {/* World 1st/2nd/3rd already headlines the trophy title, so the standalone Pts line under
                the stars is hidden for records; points move here instead of disappearing entirely. */}
            {isLeaderboardRecord && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Points</span>
                <span style={{ fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>{score.toLocaleString()} PTS</span>
              </div>
            )}
          </div>
        )}

        {/* Success links to the full leaderboard; failures retain a compact top-three reference. */}
        <div className="daily-victory-results-grid" style={{ display: 'grid', gap: '10px', alignItems: 'start' }}>
        {/* Leaderboard Record Name Entry Banner: form -> "Xth Place Saved!" -> smoothly collapses away */}
        {isLeaderboardRecord && bannerPhase !== 'hidden' && (
          <div
            style={{
              display: 'grid',
              gridTemplateRows: bannerPhase === 'collapsing' ? '0fr' : '1fr',
              marginBottom: bannerPhase === 'collapsing' ? '0' : '10px',
              transition: 'grid-template-rows 0.4s ease, margin-bottom 0.4s ease'
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.16), rgba(0, 0, 0, 0.6))',
                  border: '1.5px solid var(--accent-gold)',
                  boxShadow: '0 0 24px rgba(255, 183, 3, 0.3)',
                  borderRadius: '14px',
                  padding: '10px 14px',
                  textAlign: 'left'
                }}
              >
                {bannerPhase === 'saved' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--modal-gap-sm)', padding: '4px 0' }}>
                    <Trophy size={18} color="var(--accent-gold)" />
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent-gold)', letterSpacing: '0.3px' }}>
                      {ordinalPlace} Place Saved!
                    </span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Trophy size={16} color="var(--accent-gold)" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--accent-gold)', letterSpacing: '0.5px' }}>
                          LEADERBOARD QUALIFIED!
                        </span>
                      </div>
                      {!networkOnline && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-gold)' }}>
                          📡 Offline — saved locally, syncs online:
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={customPlayerName}
                        onChange={(e) => { setCustomPlayerName(e.target.value); setNameRejected(false); }}
                        maxLength={18}
                        placeholder="Enter name"
                        style={{
                          flex: 1,
                          background: 'rgba(0, 0, 0, 0.65)',
                          border: nameRejected ? '1px solid var(--accent-pink)' : '1px solid rgba(255, 183, 3, 0.5)',
                          color: '#fff',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName();
                        }}
                      />
                      <button
                        onClick={handleSaveName}
                        style={{
                          background: 'linear-gradient(135deg, var(--accent-cyan), #0072ff)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          boxShadow: '0 4px 20px rgba(0, 240, 255, 0.4)'
                        }}
                      >
                        <Check size={14} /> Save
                      </button>
                    </div>

                    <HunterTagRejectionNotice visible={nameRejected} reason={nameRejectReason} />

                    {!networkOnline && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '0.72rem', color: 'rgba(255, 183, 3, 0.95)' }}>
                        <WifiOff size={12} />
                        <span>Offline mode: Record is cached locally and will sync automatically when reconnected.</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {isFailed && (
          <>
          {/* Embedded Top Times List */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '12px 14px',
              marginBottom: '14px',
              textAlign: 'left'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trophy size={14} color="var(--accent-gold)" />
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    color: 'var(--accent-gold)',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase'
                  }}
                >
                  Today's Top 3
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isFailed ? 'Top 3 to Beat' : 'Live Top 3'}
              </span>
            </div>

          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              paddingRight: '2px'
            }}
          >
            {leaderboardEntries.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Loading top times...
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <tbody>
                  {leaderboardEntries.slice(0, 3).map((entry, index) => {
                    const isMe = entry.isLocalPlayer;
                    const rankNum = entry.rank || (index + 1);
                    const timeStr = typeof entry.totalTimeMs === 'number'
                      ? `${(entry.totalTimeMs / 1000).toFixed(2)}s`
                      : '--';
                    const displayName = isMe
                      ? `${entry.playerName || 'YOU'} (YOU)`
                      : entry.playerName || `Runner #${rankNum}`;

                    return (
                      <tr
                        key={index}
                        style={{
                          background: isMe ? 'rgba(0, 240, 255, 0.18)' : index % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
                        }}
                      >
                        <td
                          style={{
                            padding: '6px 8px',
                            fontWeight: 800,
                            color: isMe ? 'var(--accent-cyan)' : '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px'
                          }}
                        >
                          <span
                            style={{
                              color: rankNum === 1
                                ? 'var(--accent-gold)'
                                : rankNum === 2
                                ? '#c0c0c0'
                                : rankNum === 3
                                ? '#cd7f32'
                                : 'var(--text-muted)',
                              marginRight: '6px',
                              fontWeight: 900
                            }}
                          >
                            {rankNum === 1 ? '🥇 #1' : rankNum === 2 ? '🥈 #2' : rankNum === 3 ? '🥉 #3' : `#${rankNum}`}
                          </span>
                          {displayName}
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--accent-gold)', fontSize: '0.72rem' }}>
                            {'★'.repeat(Math.max(1, entry.stars || 1))}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 900,
                            color: isMe ? 'var(--accent-gold)' : '#fff',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {timeStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          </div>
          </>
        )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleClose}
            className="glass-btn glass-btn-primary"
            style={{
              flex: 1,
              width: '100%',
              justifyContent: 'center',
              padding: '10px',
              fontSize: '0.95rem',
              fontWeight: 900,
              borderRadius: '12px'
            }}
          >
            Main Menu <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
    {shareModalOpen && <ShareChallengeModal
      isOpen={shareModalOpen}
      onClose={() => setShareModalOpen(false)}
      elapsedTime={totalTimeMs}
      isPersonalBest={isNewRecord}
      difficulty="Daily"
      themeId="daily_challenge"
      levelTitle="Set of the Day"
    />}
    </>
  );
}
