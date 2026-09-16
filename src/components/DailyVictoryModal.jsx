import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Star, Trophy, ArrowRight, Share2, X, Edit3, Check, WifiOff } from 'lucide-react';
import { sounds } from '../utils/audio.js';
import { getDailyLeaderboard, fetchDailyLeaderboard, updateDailyPlayerName, getDailyTimeToBeat } from '../services/dailyChallenge.js';
import { getSavedPlayerName, savePlayerName } from '../services/playerProgress.js';
import { isOnline, subscribeNetworkStatus } from '../services/networkService.js';
import {
  trackResultScreenViewed,
  identifyPlayer
} from '../services/analytics.js';
import { recordLocalShareEvent } from '../utils/challengeMetrics.js';
import { getSetNumber } from '../utils/setLeaderboards.js';
import ShareChallengeModal from './ShareChallengeModal.jsx';
import TronExpiredParticles from './TronExpiredParticles.jsx';

export default function DailyVictoryModal({
  isOpen,
  totalTimeMs = 0,
  position = 1,
  totalPlayers = 1,
  percentile = 95,
  stars = 3,
  score = 0,
  isNewRecord = false,
  isFailed = false,
  isForfeit = false,
  stageIndex = 0,
  debugMode = false,
  setId = 'set_1',
  setNumber = null,
  initialEditingName = false,
  forceOffline = false,
  onRestart,
  onOpenLeaderboard,
  onClose
}) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);
  const [timeToBeatMs, setTimeToBeatMs] = useState(null);

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

  const isDebug = Boolean(
    debugMode ||
    (typeof window !== 'undefined' && (() => {
      try {
        const p = new URLSearchParams(window.location.search);
        return p.get('debug') === '1' || p.get('debug') === 'true' || localStorage.getItem('diff_hunter_debug') === 'true';
      } catch (_) {
        return false;
      }
    })())
  );

  const [isEditingName, setIsEditingName] = useState(initialEditingName);
  const [customPlayerName, setCustomPlayerName] = useState(() => getSavedPlayerName() || 'SpeedHunter');
  const [networkOnline, setNetworkOnline] = useState(() => forceOffline ? false : isOnline());

  useEffect(() => {
    return subscribeNetworkStatus(online => {
      if (!forceOffline) setNetworkOnline(online);
    });
  }, [forceOffline]);

  const handleSaveName = async () => {
    const trimmed = customPlayerName.trim();
    if (!trimmed) return;
    try { sounds.playTap(); } catch (_) {}
    setIsEditingName(false);
    savePlayerName(trimmed);
    await updateDailyPlayerName(trimmed);
    identifyPlayer(trimmed, {
      "Hunter Tag": trimmed,
      "Player Name": trimmed
    });
    const updated = getDailyLeaderboard();
    setLeaderboardEntries(updated);
  };

  useEffect(() => {
    if (isOpen) {
      setCustomPlayerName(getSavedPlayerName() || 'SpeedHunter');
      try {
        const entries = getDailyLeaderboard();
        setLeaderboardEntries(entries || []);
        const target = getDailyTimeToBeat();
        setTimeToBeatMs(typeof target === 'number' ? target : null);
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
        percentileBeat: percentile || 0,
        topPercentile: Math.max(1, 100 - (percentile || 95)),
        isPersonalBest: Boolean(isNewRecord),
        score: 0,
        stars: stars || 0,
        difficulty: 'Daily',
        themeId: 'daily_challenge',
        isStageSet: true,
        isChallengeMode: false
      });

      if (!isFailed) {
        const isLeaderboardRecord = Boolean(position && position <= 3);
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
              particleCount: 110,
              spread: 360,
              startVelocity: 42,
              ticks: 130,
              origin: { x: 0.5, y: 0.35 },
              colors: goldenFireworksColors,
              scalar: 1.25
            });
            setTimeout(() => {
              try {
                confetti({
                  particleCount: 80,
                  spread: 360,
                  startVelocity: 38,
                  ticks: 110,
                  origin: { x: 0.22, y: 0.45 },
                  colors: goldenFireworksColors,
                  scalar: 1.15
                });
              } catch (_) {}
            }, 140);
            setTimeout(() => {
              try {
                confetti({
                  particleCount: 80,
                  spread: 360,
                  startVelocity: 38,
                  ticks: 110,
                  origin: { x: 0.78, y: 0.45 },
                  colors: goldenFireworksColors,
                  scalar: 1.15
                });
              } catch (_) {}
            }, 280);
          } else if (isPb) {
            // Vibrant Fireworks Variant for Personal Best
            confetti({
              particleCount: 100,
              spread: 360,
              startVelocity: 40,
              ticks: 120,
              origin: { x: 0.5, y: 0.38 },
              colors: pbFireworksColors,
              scalar: 1.2
            });
            setTimeout(() => {
              try {
                confetti({
                  particleCount: 75,
                  spread: 360,
                  startVelocity: 36,
                  ticks: 100,
                  origin: { x: 0.28, y: 0.42 },
                  colors: pbFireworksColors,
                  scalar: 1.1
                });
              } catch (_) {}
            }, 140);
            setTimeout(() => {
              try {
                confetti({
                  particleCount: 75,
                  spread: 360,
                  startVelocity: 36,
                  ticks: 100,
                  origin: { x: 0.72, y: 0.42 },
                  colors: pbFireworksColors,
                  scalar: 1.1
                });
              } catch (_) {}
            }, 280);
          } else if (stars === 3) {
            // More for 3 stars
            confetti({
              particleCount: 180,
              spread: 90,
              origin: { y: 0.65 },
              colors: ['#FFD700', '#FFA500', '#FFDF00', '#F7B731', '#FFEAA7', '#00F0FF']
            });
          } else if (stars === 2) {
            // Some for 2 stars
            confetti({
              particleCount: 75,
              spread: 60,
              origin: { y: 0.65 },
              colors: standardColors
            });
          }
          // None for 1 star (no confetti)
        } catch (_) {}
      }
    }
  }, [isOpen, stars, isFailed, totalTimeMs, percentile, isNewRecord, position]);

  if (!isOpen) return null;

  const totalSecStr = (totalTimeMs / 1000).toFixed(2);

  const handleShare = () => {
    sounds.playTap();
    setShareModalOpen(true);
  };

  return (
    <>
    <div
      onClick={() => {
        try { sounds.playTap(); } catch (_) {}
        if (onClose) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
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
        {isFailed && <TronExpiredParticles />}
        {/* Top Left Actions on Failure */}
        {isFailed && (
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: '8px', zIndex: 10 }}>
            <button
              onClick={handleShare}
              aria-label="Share daily result"
              title="Share result"
              className="glass-btn"
              style={{ width: '40px', height: '40px', padding: 0, justifyContent: 'center', borderRadius: '12px' }}
            >
              <Share2 size={20} />
            </button>
            <button
              onClick={() => { sounds.playTap(); if (onOpenLeaderboard) onOpenLeaderboard(); }}
              aria-label="View daily leaderboard"
              title="View daily leaderboard"
              className="glass-btn"
              style={{ width: '40px', height: '40px', padding: 0, justifyContent: 'center', borderRadius: '12px' }}
            >
              <Trophy size={20} color="var(--accent-gold)" />
            </button>
          </div>
        )}
        <button
          onClick={() => {
            try { sounds.playTap(); } catch (_) {}
            if (onClose) onClose();
          }}
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
              onClick={() => { sounds.playTap(); if (onOpenLeaderboard) onOpenLeaderboard(); }}
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
              gap: '8px'
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
          <h2
            style={{
              fontSize: '1.4rem',
              fontWeight: 900,
              color: 'var(--accent-pink)',
              letterSpacing: '0.5px',
              margin: '30px 0 14px 0',
              textAlign: 'center',
              lineHeight: 1.2
            }}
          >
            {isForfeit ? 'DAILY CHALLENGE FORFEITED' : 'DAILY CHALLENGE RUN ENDED'}
          </h2>
        )}

        {/* Stars Awarded (Only on Success) */}
        {!isFailed && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            {[1, 2, 3].map((starIndex) => {
              const isEarned = starIndex <= stars;
              return (
                <div
                  key={starIndex}
                  style={{
                    transform: isEarned ? 'scale(1.15)' : 'scale(0.9)',
                    transition: 'transform 0.3s ease'
                  }}
                >
                  <Star
                    size={36}
                    color={isEarned ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.2)'}
                    fill={isEarned ? 'var(--accent-gold)' : 'none'}
                    style={{
                      filter: isEarned ? 'drop-shadow(0 0 12px rgba(255, 183, 3, 0.7))' : 'none'
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Underneath centered: Pts */}
        {!isFailed && (
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
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Set #</span>
              <span style={{ fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>{displaySetNumber}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Percentile</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>Top {Math.max(1, Math.round(100 - percentile))}%</span>
            </div>
          </div>
        )}

        {/* Success links to the full leaderboard; failures retain a compact top-three reference. */}
        <div className="daily-victory-results-grid" style={{ display: 'grid', gap: '10px', alignItems: 'start' }}>
        {!isFailed && null}
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

            {/* Player Tag / Display Name Strip (Only on Success) */}
            {!isFailed && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isLeaderboardRecord ? '8px 12px' : '6px 10px',
                  background: isLeaderboardRecord
                    ? 'linear-gradient(135deg, rgba(255, 183, 3, 0.16), rgba(0, 0, 0, 0.6))'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isLeaderboardRecord
                    ? '1.5px solid var(--accent-gold)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isLeaderboardRecord
                    ? '0 0 16px rgba(255, 183, 3, 0.25)'
                    : 'none',
                  borderRadius: isLeaderboardRecord ? '10px' : '8px',
                  marginBottom: '10px',
                  fontSize: '0.78rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isLeaderboardRecord && <Trophy size={14} color="var(--accent-gold)" />}
                  <span style={{
                    color: isLeaderboardRecord ? 'var(--accent-gold)' : 'var(--text-muted)',
                    fontWeight: isLeaderboardRecord ? 800 : 600,
                    letterSpacing: isLeaderboardRecord ? '0.3px' : 'normal'
                  }}>
                    {isLeaderboardRecord ? 'LEADERBOARD QUALIFIED! Your Hunter Tag:' : 'Your Hunter Tag:'}
                  </span>
                  {!networkOnline && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <WifiOff size={11} /> (offline, syncs online)
                    </span>
                  )}
                </div>
                {isEditingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="text"
                      value={customPlayerName}
                      onChange={(e) => setCustomPlayerName(e.target.value)}
                      maxLength={18}
                      autoFocus
                      style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        border: isLeaderboardRecord ? '1px solid var(--accent-gold)' : '1px solid var(--accent-cyan)',
                        color: '#fff',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.78rem',
                        outline: 'none',
                        width: '120px',
                        fontFamily: 'inherit'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                    />
                    <button
                      onClick={handleSaveName}
                      style={{
                        background: isLeaderboardRecord
                          ? 'linear-gradient(135deg, var(--accent-gold), #FFA500)'
                          : 'var(--accent-cyan)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '5px',
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <Check size={12} /> Save
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: isLeaderboardRecord ? 'var(--accent-gold)' : 'var(--accent-cyan)', fontWeight: 800 }}>
                      {customPlayerName}
                    </span>
                    <button
                      onClick={() => setIsEditingName(true)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.72rem'
                      }}
                      title="Change your public leaderboard name"
                    >
                      <Edit3 size={11} /> Edit
                    </button>
                  </div>
                )}
              </div>
            )}

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
          {isFailed && !isForfeit && (
          <button
            onClick={() => {
              sounds.playTap();
              if (onOpenLeaderboard) onOpenLeaderboard();
            }}
            className="glass-btn"
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: '10px',
              fontSize: '0.92rem',
              fontWeight: 800,
              borderRadius: '12px'
            }}
          >
            <Trophy size={16} color="var(--accent-gold)" /> Daily Board
          </button>
          )}

          <button
            onClick={() => {
              sounds.playTap();
              if (onClose) onClose();
            }}
            className="glass-btn glass-btn-primary"
            style={{
              flex: (isFailed && !isForfeit) ? 1.2 : 1,
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
      percentileBeat={percentile}
      topPercentile={Math.max(1, 100 - percentile)}
      isPersonalBest={isNewRecord}
      difficulty="Daily"
      themeId="daily_challenge"
      levelTitle="Set of the Day"
    />}
    </>
  );
}
