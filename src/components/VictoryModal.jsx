import React, { useEffect, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Star, Clock, Zap, ArrowRight, RotateCcw, X, Share2, Flame, Swords } from 'lucide-react';
import { sounds } from '../utils/audio';
import { calculatePercentileRank, checkAndUpdatePersonalBest, recordLocalShareEvent } from '../utils/challengeMetrics';
import { trackResultScreenViewed, trackChallengeShareClicked } from '../services/analytics';
import ShareChallengeModal from './ShareChallengeModal';

export default function VictoryModal({
  isOpen,
  level,
  levelTitle,
  elapsedTime = 0,
  missCount = 0,
  score = 0,
  stars = 3,
  difficulty = 'Medium',
  themeId = 'find_the_sniper',
  isStageSet = true,
  incomingChallenge = null,
  onNextLevel,
  onRestart,
  onClose
}) {
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Calculate Stars based on Points Obtained across stage (Score >= 1000 -> 3 Stars, Score >= 500 -> 2 Stars, Score > 0 -> 1 Star, or explicit stars prop)
  const displayStars = (score > 0)
    ? (score >= 1000 ? 3 : score >= 500 ? 2 : 1)
    : (typeof stars === 'number' ? stars : 3);

  // Percentile and Personal Best Metrics
  const { topPercentile, beatPercentile, rankLabel } = useMemo(() => {
    return calculatePercentileRank(elapsedTime, difficulty, isStageSet);
  }, [elapsedTime, difficulty, isStageSet]);

  const [isPersonalBest, setIsPersonalBest] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const pbCheck = checkAndUpdatePersonalBest(elapsedTime, difficulty, themeId, isStageSet);
      setIsPersonalBest(pbCheck.isPersonalBest);

      // Record result screen view for share rate conversion funnel
      recordLocalShareEvent('view');
      trackResultScreenViewed({
        elapsedTimeMs: elapsedTime,
        percentileBeat: beatPercentile,
        topPercentile,
        isPersonalBest: pbCheck.isPersonalBest,
        score,
        stars: displayStars,
        difficulty,
        themeId,
        isStageSet,
        isChallengeMode: Boolean(incomingChallenge),
        challengerName: incomingChallenge?.challengerName || null
      });

      if (typeof sounds.playFanfare === 'function') {
        sounds.playFanfare(displayStars);
      } else {
        sounds.playWin(displayStars);
      }

      // Trigger Confetti Fireworks
      const isThreeStars = displayStars === 3;
      const count = isThreeStars ? 280 : 200;

      // Golden color palette when 3 stars are achieved
      const goldenColors = ['#FFD700', '#FFA500', '#FFDF00', '#F7B731', '#FFEAA7', '#D4AF37', '#FFF380', '#00F0FF'];
      const standardColors = ['#00F0FF', '#7000FF', '#FF007F', '#00FF88', '#38EF7D', '#3A86FF', '#F12711'];
      const activeColors = isThreeStars ? goldenColors : standardColors;

      const defaults = { origin: { y: 0.7 }, colors: activeColors };

      function fire(particleRatio, opts) {
        try {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
          });
        } catch (error) {
          console.warn('Victory celebration unavailable:', error);
        }
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });

      if (isThreeStars) {
        // Extra golden side cannons for 3-star glorious victory
        const timer = setTimeout(() => {
          try {
            confetti({
              particleCount: 45,
              angle: 60,
              spread: 55,
              origin: { x: 0.05, y: 0.75 },
              colors: goldenColors
            });
            confetti({
              particleCount: 45,
              angle: 120,
              spread: 55,
              origin: { x: 0.95, y: 0.75 },
              colors: goldenColors
            });
          } catch (error) {
            console.warn('Victory celebration unavailable:', error);
          }
        }, 180);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, displayStars, elapsedTime, difficulty, themeId, isStageSet, beatPercentile, topPercentile, score, incomingChallenge]);

  if (!isOpen) return null;

  const seconds = (elapsedTime / 1000).toFixed(2);
  const safeMisses = Number.isFinite(missCount) ? missCount : 0;
  const accuracy = Math.max(0, Math.min(100, Math.round(100 - safeMisses * 15)));
  const titleText = levelTitle || level?.title || 'Stage Set';

  // Rivalry head-to-head comparison if user launched from a challenge link
  const challengerSec = incomingChallenge?.targetTimeSec || (incomingChallenge?.targetTimeMs ? (incomingChallenge.targetTimeMs / 1000).toFixed(2) : null);
  const userSecNum = parseFloat(seconds);
  const challengerSecNum = challengerSec ? parseFloat(challengerSec) : null;
  const playerWonChallenge = challengerSecNum !== null ? userSecNum <= challengerSecNum : null;

  const handleOpenShare = () => {
    sounds.playTap();
    trackChallengeShareClicked({
      source: isPersonalBest ? 'victory_modal_pb_cta' : 'victory_modal_cta',
      elapsedTimeMs: elapsedTime,
      percentileBeat,
      isPersonalBest,
      difficulty,
      themeId
    });
    setShareModalOpen(true);
  };

  return (
    <>
      <div
        onClick={() => { sounds.playTap(); onClose(); }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}
      >
        <div
          className="glass-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '440px',
            width: '94%',
            maxHeight: '94vh',
            overflowY: 'auto',
            padding: '18px 20px',
            textAlign: 'center',
            border: isPersonalBest ? '2px solid var(--accent-gold)' : '2px solid var(--accent-cyan)',
            boxShadow: isPersonalBest ? '0 0 45px rgba(255, 183, 3, 0.45)' : '0 0 40px rgba(0, 240, 255, 0.45)',
            borderRadius: '20px',
            position: 'relative',
            animation: 'pageFadeIn 0.12s ease-out'
          }}
        >
          {/* Top Right Close "X" Button */}
          <button
            onClick={() => { sounds.playTap(); onClose(); }}
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
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>

          {/* Compact Trophy Icon */}
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-gold), #ff8800)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 8px auto',
            boxShadow: '0 0 20px var(--accent-gold)'
          }}>
            <Trophy size={26} color="#000" />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '2px', background: 'linear-gradient(90deg, #fff, var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            STAGE CLEAR!
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            {titleText}
          </p>

          {/* Stars Earned */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
            {[1, 2, 3].map(starNum => {
              const active = starNum <= displayStars;
              return (
                <div
                  key={starNum}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: active ? 'scale(1.15)' : 'scale(0.88)',
                    transition: `transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${starNum * 0.15}s`
                  }}
                >
                  <Star
                    size={36}
                    fill={active ? 'var(--accent-gold)' : 'none'}
                    color={active ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.25)'}
                    style={{
                      filter: active ? 'drop-shadow(0 0 14px rgba(255, 183, 3, 0.95))' : 'none'
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Salient Virality Highlight / Personal Best Banner */}
          <div style={{
            background: isPersonalBest
              ? 'linear-gradient(135deg, rgba(255, 183, 3, 0.2), rgba(255, 0, 127, 0.15))'
              : 'rgba(0, 240, 255, 0.08)',
            border: isPersonalBest
              ? '1px solid rgba(255, 183, 3, 0.6)'
              : '1px solid rgba(0, 240, 255, 0.25)',
            borderRadius: '14px',
            padding: '10px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            textAlign: 'left'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {isPersonalBest ? (
                  <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Flame size={14} /> NEW PERSONAL BEST!
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    PERFORMANCE BENCHMARK
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                You beat <span style={{ color: 'var(--accent-green)', fontWeight: 900 }}>{beatPercentile}%</span> of Diff Hunter players
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '0.72rem',
              fontWeight: 900,
              color: 'var(--accent-gold)',
              whiteSpace: 'nowrap'
            }}>
              {rankLabel}
            </div>
          </div>

          {/* Incoming Head-to-Head Challenge Rivalry Result Banner */}
          {incomingChallenge && (
            <div style={{
              background: playerWonChallenge
                ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 240, 255, 0.15))'
                : 'linear-gradient(135deg, rgba(255, 0, 127, 0.2), rgba(255, 183, 3, 0.15))',
              border: `1.5px solid ${playerWonChallenge ? 'var(--accent-green)' : 'var(--accent-pink)'}`,
              borderRadius: '14px',
              padding: '10px 14px',
              marginBottom: '14px',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 900, color: playerWonChallenge ? 'var(--accent-green)' : 'var(--accent-pink)' }}>
                <Swords size={16} />
                {playerWonChallenge ? `YOU BEAT ${incomingChallenge.challengerName.toUpperCase()}!` : `${incomingChallenge.challengerName.toUpperCase()} WAS FASTER!`}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{incomingChallenge.challengerName}: <b style={{ color: '#fff' }}>{challengerSec}s</b></span>
                <span style={{ color: 'var(--text-muted)' }}>vs</span>
                <span style={{ color: playerWonChallenge ? 'var(--accent-green)' : 'var(--accent-gold)' }}>You: <b style={{ color: '#fff' }}>{seconds}s</b></span>
              </div>
            </div>
          )}

          {/* Performance Breakdown Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            background: 'rgba(0,0,0,0.4)',
            padding: '12px 14px',
            borderRadius: '14px',
            marginBottom: '14px',
            textAlign: 'left'
          }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} color="var(--accent-cyan)" /> TIME TAKEN
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {seconds}s
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={12} color="var(--accent-gold)" /> TOTAL PTS
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
                {score} PTS
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingRight: '8px' }}>ACCURACY</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                {accuracy}%
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingRight: '8px' }}>MISSES</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: safeMisses > 0 ? 'var(--accent-pink)' : 'var(--text-muted)' }}>
                {safeMisses}
              </span>
            </div>
          </div>

          {/* PLG Feature: Challenge a Friend Button */}
          <button
            onClick={handleOpenShare}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '14px',
              marginBottom: '12px',
              fontSize: '0.96rem',
              fontWeight: 900,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.9), rgba(255, 110, 0, 0.95))',
              color: '#000',
              border: 'none',
              boxShadow: '0 4px 18px rgba(255, 183, 3, 0.4)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
          >
            <Share2 size={18} />
            {incomingChallenge ? `Challenge ${incomingChallenge.challengerName} Back` : 'Challenge a Friend'}
          </button>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="glass-btn"
              onClick={() => { sounds.playTap(); onRestart(); }}
              style={{ flex: 1, justifyContent: 'center', fontSize: '1rem', fontWeight: 800, padding: '10px 14px', borderRadius: '12px' }}
            >
              <RotateCcw size={18} /> Retry
            </button>

            <button
              className="glass-btn glass-btn-primary"
              onClick={() => { sounds.playTap(); onNextLevel(); }}
              style={{ flex: 1.4, justifyContent: 'center', fontSize: '1.05rem', fontWeight: 900, padding: '10px 16px', borderRadius: '12px' }}
            >
              Next Stage <ArrowRight size={18} />
            </button>
          </div>

        </div>
      </div>

      {/* Share Challenge Modal */}
      {shareModalOpen && (
        <ShareChallengeModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          elapsedTime={elapsedTime}
          percentileBeat={beatPercentile}
          topPercentile={topPercentile}
          isPersonalBest={isPersonalBest}
          difficulty={difficulty}
          themeId={themeId}
          levelTitle={titleText}
          levelId={level?.id || ''}
        />
      )}
    </>
  );
}
