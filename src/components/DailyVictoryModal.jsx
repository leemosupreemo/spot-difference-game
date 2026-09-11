import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Flame, Star, Trophy, ArrowRight, Share2, X, Edit3, Check } from 'lucide-react';
import { sounds } from '../utils/audio.js';
import { getDailyLeaderboard, fetchDailyLeaderboard, updateDailyPlayerName } from '../services/dailyChallenge.js';
import { getSavedPlayerName } from '../services/playerProgress.js';
import {
  trackResultScreenViewed,
  identifyPlayer
} from '../services/analytics.js';
import { recordLocalShareEvent } from '../utils/challengeMetrics.js';
import ResultCard from './ResultCard.jsx';
import ShareChallengeModal from './ShareChallengeModal.jsx';
import TronExpiredParticles from './TronExpiredParticles.jsx';

export default function DailyVictoryModal({
  isOpen,
  totalTimeMs = 0,
  position = 1,
  totalPlayers = 1,
  percentile = 95,
  stars = 3,
  isNewRecord = false,
  isFailed = false,
  isForfeit = false,
  stageIndex = 0,
  debugMode = false,
  onRestart,
  onOpenLeaderboard,
  onClose
}) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);

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

  const [isEditingName, setIsEditingName] = useState(false);
  const [customPlayerName, setCustomPlayerName] = useState(() => getSavedPlayerName() || 'SpeedHunter');

  const handleSaveName = async () => {
    const trimmed = customPlayerName.trim();
    if (!trimmed) return;
    try { sounds.playTap(); } catch (_) {}
    setIsEditingName(false);
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
        if (typeof sounds.playFanfare === 'function') {
          sounds.playFanfare(stars);
        } else {
          sounds.playWin(stars);
        }

        // Fire festive confetti
        const colors = ['#FFD700', '#FF007F', '#00F0FF', '#00FF87', '#FFA500'];
        confetti({
          particleCount: 160,
          spread: 90,
          origin: { y: 0.65 },
          colors
        });
      }
    }
  }, [isOpen, stars, isFailed, totalTimeMs, percentile, isNewRecord]);

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
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
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
          position: 'relative'
        }}
      >
        {isFailed && <TronExpiredParticles />}
        {/* Top Right Close "X" Button */}
        <button
          onClick={() => {
            try { sounds.playTap(); } catch (_) {}
            if (onClose) onClose();
          }}
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
            cursor: 'pointer',
            zIndex: 10
          }}
          title="Close"
        >
          <X size={18} />
        </button>
        {/* Header Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: isFailed
              ? 'linear-gradient(135deg, rgba(255, 0, 127, 0.25), rgba(255, 80, 0, 0.25))'
              : 'linear-gradient(135deg, rgba(255, 0, 127, 0.25), rgba(255, 183, 3, 0.25))',
            border: isFailed
              ? '1px solid rgba(255, 0, 127, 0.5)'
              : '1px solid rgba(255, 183, 3, 0.4)',
            marginBottom: '12px'
          }}
        >
          <Flame size={18} color={isFailed ? 'var(--accent-pink)' : 'var(--accent-gold)'} />
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 900,
              color: isFailed ? 'var(--accent-pink)' : 'var(--accent-gold)',
              letterSpacing: '1px'
            }}
          >
            {isFailed
              ? (isForfeit ? 'DAILY CHALLENGE FORFEITED' : 'DAILY CHALLENGE RUN ENDED')
              : 'SET OF THE DAY COMPLETE!'}
          </span>
        </div>

        {/* Stars Awarded (Only on Success) */}
        {!isFailed && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
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

        {/* Hero Completion Time (Only on Success) */}
        {!isFailed && (
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              Total 3-Image Time
            </div>
            <div
              style={{
                fontSize: '2.9rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                color: '#ffffff',
                textShadow: '0 0 24px rgba(0, 240, 255, 0.65)',
                lineHeight: 1.1
              }}
            >
              {totalSecStr}s
            </div>
            {isNewRecord && (
              <div
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 900,
                  color: 'var(--accent-gold)',
                  marginTop: '4px',
                  textShadow: '0 0 10px rgba(255, 183, 3, 0.8)'
                }}
              >
                👑 NEW #1 FASTEST TIME FOR TODAY!
              </div>
            )}
          </div>
        )}

        {/* Compact result summary */}
        {!isFailed && (
          <ResultCard
            elapsedTimeMs={totalTimeMs}
            topPercentile={Math.max(1, 100 - percentile)}
            beatPercentile={percentile}
            isNewRecord={isNewRecord}
            isDaily={true}
            isDailyCompleted={!isFailed}
            playerName={customPlayerName}
          />
        )}

        {/* Metrics Grid (Position & Percentile) for Success */}
        {!isFailed && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '14px'
            }}
          >
            <div
              style={{
                padding: '10px 8px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>
                TODAY'S RANK
              </div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: position <= 3 ? 'var(--accent-gold)' : 'var(--accent-cyan)'
                }}
              >
                #{position} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ {totalPlayers}</span>
              </div>
            </div>

            <div
              style={{
                padding: '10px 8px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>
                PERCENTILE
              </div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: 'var(--accent-green)'
                }}
              >
                Top {Math.max(1, 100 - percentile)}%
              </div>
            </div>
          </div>
        )}

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
                  {isFailed ? "Today's Top 3" : "Today's Top Times"}
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isFailed ? 'Top 3 to Beat' : 'Live Leaderboard'}
              </span>
            </div>

            {/* Player Tag / Display Name Strip (Only on Success) */}
            {!isFailed && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  fontSize: '0.78rem'
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Your Hunter Tag:</span>
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
                        border: '1px solid var(--accent-cyan)',
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
                        background: 'var(--accent-cyan)',
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
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>
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
                  {(isFailed || isForfeit ? leaderboardEntries.slice(0, 3) : leaderboardEntries).map((entry, index) => {
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

        {/* Share Button (When Success) */}
        {!isFailed && (
          <button
            onClick={handleShare}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '12px',
              marginBottom: '10px',
              fontSize: '0.92rem',
              fontWeight: 900,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.95), rgba(255, 110, 0, 0.95))',
              color: '#000',
              border: 'none',
              boxShadow: '0 4px 16px rgba(255, 183, 3, 0.4)'
            }}
          >
            <Share2 size={16} /> Share
          </button>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
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

          <button
            onClick={() => {
              sounds.playTap();
              if (onClose) onClose();
            }}
            className="glass-btn glass-btn-primary"
            style={{
              flex: 1.2,
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
