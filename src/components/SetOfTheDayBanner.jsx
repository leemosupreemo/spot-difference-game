import React, { useState, useEffect } from 'react';
import { Flame, Clock, Trophy, ChevronRight, Sparkles, Star } from 'lucide-react';
import { sounds } from '../utils/audio.js';
import { isSetOfTheDayEnabled } from '../services/appConfig.js';
import {
  getDailyTimeToBeat,
  getDailyPlayerStatus,
  getTodayDateString
} from '../services/dailyChallenge.js';

export default function SetOfTheDayBanner({ onStartDaily, onOpenDailyLeaderboard, forceShow = false, debugMode = false, onResetDaily = null }) {
  const [enabled, setEnabled] = useState(isSetOfTheDayEnabled());
  const [timeToBeatMs, setTimeToBeatMs] = useState(null);
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
  }, []);

  // Do not continue showing after a player attempts or completes it (always show in debug mode)
  const isAttempted = Boolean(playerStatus.completed || playerStatus.attempted || playerStatus.failed);
  if (!enabled || (!forceShow && !debugMode && isAttempted)) return null;

  const timeToBeatSec = timeToBeatMs ? (timeToBeatMs / 1000).toFixed(1) : '--.-';
  const playerTimeSec = playerStatus.completed && playerStatus.totalTimeMs
    ? (playerStatus.totalTimeMs / 1000).toFixed(1)
    : null;

  const handleResetClick = (e) => {
    e.stopPropagation();
    sounds.playWin();
    if (onResetDaily) onResetDaily();
    setPlayerStatus({ completed: false, attempted: false, failed: false });
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (isAttempted && !debugMode) {
      sounds.playTap();
      if (onOpenDailyLeaderboard) onOpenDailyLeaderboard();
      return;
    }
    sounds.playTap();
    if (onStartDaily) onStartDaily();
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '850px',
        margin: '0 auto 12px auto',
        padding: '0 16px',
        boxSizing: 'border-box'
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
          border: isHovered
            ? '1.5px solid rgba(255, 183, 3, 0.9)'
            : '1.5px solid rgba(255, 0, 127, 0.45)',
          boxShadow: isHovered
            ? '0 0 28px rgba(255, 0, 127, 0.4), 0 0 16px rgba(255, 183, 3, 0.35)'
            : '0 6px 20px rgba(0, 0, 0, 0.35), 0 0 16px rgba(255, 0, 127, 0.2)',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Animated subtle top shimmer */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, #ff007f, #ffb703, #00f0ff, #ff007f)',
            backgroundSize: '200% 100%',
            opacity: 0.85
          }}
        />

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
                fontSize: '0.96rem',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.2px'
              }}
            >
              {playerStatus.completed ? (
                <span>Cleared in {playerTimeSec}s • Tap to improve!</span>
              ) : (
                <span>3-Image Daily Sequence • Never Repeated</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: TIME TO BEAT */}
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
              textAlign: 'right',
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.12)'
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
              Time to Beat
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
              {timeToBeatSec}s
            </div>
          </div>

          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isHovered ? 'var(--accent-cyan)' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronRight size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}
