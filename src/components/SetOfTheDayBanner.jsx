import React, { useState, useEffect } from 'react';
import { Flame, Trophy, ChevronRight, Star } from 'lucide-react';
import { sounds } from '../utils/audio.js';
import { isSetOfTheDayEnabled } from '../services/appConfig.js';
import {
  getDailyTimeToBeat,
  getDailyPlayerStatus,
  getTodayDateString,
  getDailyLeaderboard,
  fetchDailyLeaderboard
} from '../services/dailyChallenge.js';
import {
  trackDailyChallengeImpression,
  trackDailyChallengeClicked
} from '../services/analytics.js';

export default function SetOfTheDayBanner({ onStartDaily, onOpenDailyLeaderboard, forceShow = false, debugMode = false, onResetDaily = null }) {
  const [enabled, setEnabled] = useState(isSetOfTheDayEnabled());
  const [timeToBeatMs, setTimeToBeatMs] = useState(null);
  const [topTimes, setTopTimes] = useState([]);
  const [playerStatus, setPlayerStatus] = useState(() => {
    try {
      return getDailyPlayerStatus();
    } catch (_) {
      return { completed: false };
    }
  });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const isFeatEnabled = isSetOfTheDayEnabled();
    setEnabled(isFeatEnabled);
    if (!isFeatEnabled) return;

    const today = getTodayDateString();
    const ttb = getDailyTimeToBeat(today);
    setTimeToBeatMs(ttb);

    const status = getDailyPlayerStatus(today);
    setPlayerStatus(status);

    const localTopTimes = getDailyLeaderboard(today).slice(0, 3);
    setTopTimes(localTopTimes);
    fetchDailyLeaderboard(today).then(remoteEntries => {
      if (remoteEntries?.length) setTopTimes(remoteEntries.slice(0, 3));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const isAtt = Boolean(playerStatus.completed || playerStatus.attempted || playerStatus.failed);
    if (!forceShow && !debugMode && !playerStatus.completed && isAtt) return;

    trackDailyChallengeImpression({
      date: getTodayDateString(),
      timeToBeatSec: timeToBeatMs ? Number((timeToBeatMs / 1000).toFixed(1)) : null,
      hasAttempted: isAtt,
      isCompleted: Boolean(playerStatus.completed)
    });
  }, [enabled, forceShow, debugMode, playerStatus.completed, playerStatus.attempted, playerStatus.failed, timeToBeatMs]);

  // Do not continue showing after a player attempts or completes it (always show in debug mode)
  const isAttempted = Boolean(playerStatus.completed || playerStatus.attempted || playerStatus.failed);
  if (!enabled || (!forceShow && !debugMode && !playerStatus.completed && isAttempted)) return null;

  const timeToBeatSec = timeToBeatMs ? (timeToBeatMs / 1000).toFixed(1) : '--.-';
  const topTimeMs = topTimes[0]?.totalTimeMs ?? timeToBeatMs;
  const topTimeSec = typeof topTimeMs === 'number'
    ? (topTimeMs / 1000).toFixed(1)
    : timeToBeatSec;

  const handleResetClick = (e) => {
    e.stopPropagation();
    sounds.playWin();
    if (onResetDaily) onResetDaily();
    setPlayerStatus({ completed: false, attempted: false, failed: false });
  };

  const handleClick = (e) => {
    e.stopPropagation();
    trackDailyChallengeClicked({
      source: 'main_banner',
      date: getTodayDateString(),
      isAttempted
    });
    if (isAttempted && !debugMode) {
      sounds.playTap();
      if (onOpenDailyLeaderboard) onOpenDailyLeaderboard();
      return;
    }
    sounds.playTap();
    if (onStartDaily) onStartDaily();
  };

  return (
    <>
      <style>{`@keyframes setOfTheDayBorderShift {
        0%, 100% { border-color: rgba(255, 0, 127, 0.72); }
        33% { border-color: rgba(0, 240, 255, 0.72); }
        66% { border-color: rgba(255, 183, 3, 0.78); }
      }`}</style>
    <div
      className="set-of-day-banner-container"
      style={{
        width: '100%',
        maxWidth: '850px',
        margin: '0 auto 12px auto',
        boxSizing: 'border-box',
        transition: 'max-width 0.2s ease'
      }}
    >
      <div
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="button"
        tabIndex={0}
        aria-label="Set of the Day Challenge"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderRadius: '16px',
          cursor: 'pointer',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(255, 0, 127, 0.22) 0%, rgba(121, 40, 202, 0.28) 45%, rgba(0, 240, 255, 0.18) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '2px solid rgba(255, 0, 127, 0.72)',
          animation: 'setOfTheDayBorderShift 8s ease-in-out infinite',
          boxShadow: isHovered
            ? '0 0 28px rgba(255, 0, 127, 0.4), 0 0 16px rgba(255, 183, 3, 0.35)'
            : '0 6px 20px rgba(0, 0, 0, 0.35), 0 0 16px rgba(255, 0, 127, 0.2)',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Left Info Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 1 }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ff007f, #ff6b00)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(255, 0, 127, 0.55)',
              flexShrink: 0
            }}
          >
            <Flame size={24} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 183, 3, 0.22)',
                  color: 'var(--accent-gold)',
                  border: '1px solid rgba(255, 183, 3, 0.4)'
                }}
              >
                Set of the Day
              </span>

              {playerStatus.completed && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(0, 255, 135, 0.18)',
                    color: 'var(--accent-green)',
                    border: '1px solid rgba(0, 255, 135, 0.35)'
                  }}
                >
                  <Star size={11} fill="var(--accent-green)" />
                  Rank #{playerStatus.position || 1}
                </span>
              )}

              {debugMode && onResetDaily && (
                <button
                  onClick={handleResetClick}
                  title="Reset daily status for testing"
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 0, 127, 0.25)',
                    color: 'var(--accent-pink)',
                    border: '1px solid var(--accent-pink)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🔄 Reset (Debug)
                </button>
              )}
            </div>

            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.2px',
                textAlign: 'left',
                transform: 'translateX(1px)'
              }}
            >
              <span>Daily Sequence • Never Repeated</span>
            </div>
          </div>
        </div>

        {/* Right Side: top time to beat */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1,
            flexShrink: 0
          }}
        >
          <div
            style={{
              textAlign: 'right'
            }}
          >
            <div
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                letterSpacing: '0.8px',
                color: 'var(--accent-gold)',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px'
              }}
            >
              <Trophy size={11} color="var(--accent-gold)" />
              {playerStatus.completed ? 'Top Time' : 'Time to Beat'}
            </div>

            <div
              style={{
                fontSize: '1.2rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                color: '#ffffff',
                textShadow: '0 0 10px rgba(0, 240, 255, 0.6)'
              }}
            >
              {`${topTimeSec}s`}
            </div>
          </div>

          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: isHovered
                ? 'linear-gradient(135deg, #33f3ff, #1a82ff)'
                : 'linear-gradient(135deg, var(--accent-cyan), #0072ff)',
              boxShadow: '0 4px 20px rgba(0, 240, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronRight size={22} strokeWidth={3} />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
