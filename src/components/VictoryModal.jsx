import React, { useEffect, useState, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Star, ArrowRight, X, Share2, Swords, Check, WifiOff } from 'lucide-react';
import { sounds } from '../utils/audio';
import { calculateStarRating, checkAndUpdatePersonalBest, recordLocalShareEvent } from '../utils/challengeMetrics';
import { trackResultScreenViewed, trackChallengeShareClicked, identifyPlayer } from '../services/analytics';
import { mirrorRoundToGameCenter } from '../services/gameCenter';
import { getSetNumber, calculateSetWorldRank, checkAndUpdateDynamicSetRecord } from '../utils/setLeaderboards.js';
import { savePlayerName, generateDefaultPlayerName } from '../services/playerProgress.js';
import { containsProfanity } from '../utils/profanityFilter.js';
import { submitLeaderboardScore } from '../services/leaderboardService.js';
import { isOnline, subscribeNetworkStatus } from '../services/networkService.js';
import ShareChallengeModal from './ShareChallengeModal';
import { isNativeSharing, shareChallengeResultDirectly } from '../utils/nativeShare.js';
import HunterTagRejectionNotice from './HunterTagRejectionNotice.jsx';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';

export default function VictoryModal({
  isOpen,
  level,
  levelTitle,
  elapsedTime = 0,
  missCount = 0,
  score = 0,
  difficulty = 'Medium',
  themeId = 'find_the_sniper',
  isStageSet = true,
  incomingChallenge = null,
  isDaily = false,
  isFailed = false,
  isNewRecord = false,
  setId = null,
  setNumber = null,
  attemptNumber = null,
  isPersonalBestForSet = null,
  forceOffline = false,
  onNextLevel,
  onClose,
  onReturnToMenu,
  onOpenLeaderboard
}) {
  const celebrated = useRef(false);
  const celebrationTimer = useRef(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const isAbstract = themeId === 'abstract_animated' || level?.packId === 'abstract_animated';
  const effectiveSetId = isAbstract ? null : (setId || level?.setId || null);
  const displaySetNumber = setNumber || (effectiveSetId ? getSetNumber(effectiveSetId) : 1);
  const displayAttemptNumber = attemptNumber || 1;

  const displayStars = isFailed ? 0 : calculateStarRating(elapsedTime, difficulty, isStageSet);

  const [isPersonalBest, setIsPersonalBest] = useState(false);

  // Top 3 world rank calculation for non-abstract sets
  const worldRank = useMemo(() => {
    if (isAbstract || !effectiveSetId || !isOpen) return null;
    return calculateSetWorldRank(effectiveSetId, elapsedTime);
  }, [isAbstract, effectiveSetId, elapsedTime, isOpen]);

  const isLeaderboardRecord = Boolean(!isAbstract && (worldRank === 1 || worldRank === 2 || worldRank === 3));

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

  const ordinalPlace = worldRank === 1 ? '1st' : worldRank === 2 ? '2nd' : worldRank === 3 ? '3rd' : `${worldRank}th`;

  const submitRecordName = finalName => {
    savePlayerName(finalName);
    setCustomPlayerName(finalName);

    try {
      identifyPlayer(finalName, {
        "Hunter Tag": finalName,
        "Player Name": finalName
      });
    } catch (_) {}

    if (effectiveSetId && elapsedTime > 0) {
      submitLeaderboardScore({
        boardType: 'photoSet',
        boardId: effectiveSetId,
        score: elapsedTime,
        displayName: finalName,
        metric: 'elapsedMs'
      }).catch(() => {});

      submitLeaderboardScore({
        boardType: 'category',
        boardId: isAbstract ? 'abstract' : 'photo',
        score: elapsedTime,
        displayName: finalName,
        metric: 'elapsedMs'
      }).catch(() => {});
    }
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

  const worldTitleConfig = useMemo(() => {
    if (!isAbstract) {
      if (worldRank === 1) {
        return {
          title: 'World 1st!',
          trophyColor: '#FFD700',
          trophyGlow: 'rgba(255, 215, 0, 0.65)',
          gradient: 'linear-gradient(90deg, #FFFFFF 0%, #FFD700 60%, #FFA500 100%)'
        };
      }
      if (worldRank === 2) {
        return {
          title: 'World 2nd!',
          trophyColor: '#E0E0E0',
          trophyGlow: 'rgba(224, 224, 224, 0.65)',
          gradient: 'linear-gradient(90deg, #FFFFFF 0%, #E0E0E0 60%, #A0A0A0 100%)'
        };
      }
      if (worldRank === 3) {
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
  }, [isAbstract, worldRank]);

  const recordBadgeText = useMemo(() => {
    if (isAbstract) {
      return (isPersonalBest || isNewRecord) ? '(personal best!)' : null;
    }
    // World 1st, 2nd, and 3rd are prominently displayed as the modal title with the trophy
    if (worldRank === 1 || worldRank === 2 || worldRank === 3) return null;
    if (isPersonalBest || isNewRecord || isPersonalBestForSet) return '(personal best!)';
    return null;
  }, [isAbstract, worldRank, isPersonalBest, isNewRecord, isPersonalBestForSet]);

  const hasRecord = Boolean(isLeaderboardRecord || isPersonalBest || isNewRecord || isPersonalBestForSet);
  const canShare = Boolean(hasRecord || (isDaily && !isFailed));

  useEffect(() => {
    if (!isOpen) {
      celebrated.current = false;
      setShareModalOpen(false);
      return;
    }
    if (celebrated.current) return;
    celebrated.current = true;
    if (isOpen) {
      let pb = false;
      if (isAbstract) {
        const dynamicCheck = checkAndUpdateDynamicSetRecord(elapsedTime);
        pb = dynamicCheck.isNewRecord;
      } else if (typeof isPersonalBestForSet === 'boolean') {
        pb = isPersonalBestForSet;
      } else {
        const pbCheck = checkAndUpdatePersonalBest(elapsedTime, difficulty, themeId, isStageSet);
        pb = pbCheck.isPersonalBest;
      }
      setIsPersonalBest(pb);

      // Automatically mirror fastest times & achievements to Apple Game Center if signed in
      mirrorRoundToGameCenter({
        elapsedTimeMs: elapsedTime,
        difficulty,
        isPersonalBest: pb,
        score,
        stars: displayStars
      }).catch(() => {});

      // Record result screen view for share rate conversion funnel
      recordLocalShareEvent('view');
      trackResultScreenViewed({
        elapsedTimeMs: elapsedTime,
        isPersonalBest: pb,
        score,
        stars: displayStars,
        difficulty,
        themeId,
        isStageSet,
        isChallengeMode: Boolean(incomingChallenge),
        challengerName: incomingChallenge?.challengerName || null
      });

      const isPb = Boolean((isPersonalBest || isNewRecord || isPersonalBestForSet) && !isLeaderboardRecord);

      if (typeof sounds.playFanfare === 'function') {
        sounds.playFanfare(displayStars, { isLeaderboardRecord, isPersonalBest: isPb });
      } else {
        sounds.playWin(displayStars, { isLeaderboardRecord, isPersonalBest: isPb });
      }

      // Tiered celebration:
      // - None for 1 star
      // - Some for 2 stars
      // - More for 3 stars
      // - Golden fireworks for any new leaderboard record
      // - Vibrant celebratory fireworks variant for personal best
      const isThreeStars = displayStars === 3;
      const count = isThreeStars ? 380 : 260;

      // Golden color palette when 3 stars are achieved or for leaderboard records
      const goldenColors = ['#FFD700', '#FFA500', '#FFDF00', '#F7B731', '#FFEAA7', '#D4AF37', '#FFF380', '#00F0FF'];
      const standardColors = ['#00F0FF', '#7000FF', '#FF007F', '#00FF88', '#38EF7D', '#3A86FF', '#F12711'];
      const activeColors = isThreeStars ? goldenColors : standardColors;
      const goldenFireworksColors = ['#FFD700', '#FFA500', '#FFDF00', '#FFEAA7', '#D4AF37', '#FFF380', '#DAA520', '#FFFFFF', '#F39C12'];
      const pbFireworksColors = ['#00F0FF', '#FF007F', '#00FF88', '#9D4EDD', '#FFB703', '#3A86FF', '#FFFFFF'];

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

      if (isLeaderboardRecord) {
        // Fireworks for any new leaderboard record (golden colored)
        try {
          confetti({
            particleCount: 150,
            spread: 360,
            startVelocity: 52,
            ticks: 150,
            origin: { x: 0.5, y: 0.35 },
            colors: goldenFireworksColors,
            scalar: 1.45
          });
        } catch (_) {}

        const t1 = setTimeout(() => {
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

        const t2 = setTimeout(() => {
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

        const t3 = setTimeout(() => {
          try {
            confetti({
              particleCount: 70,
              angle: 60,
              spread: 65,
              startVelocity: 45,
              origin: { x: 0.05, y: 0.75 },
              colors: goldenFireworksColors
            });
            confetti({
              particleCount: 70,
              angle: 120,
              spread: 65,
              startVelocity: 45,
              origin: { x: 0.95, y: 0.75 },
              colors: goldenFireworksColors
            });
          } catch (_) {}
        }, 420);

        celebrationTimer.current = t1;
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
      } else if (isPb) {
        // Fireworks variant for Personal Best (vibrant multi-color)
        try {
          confetti({
            particleCount: 135,
            spread: 360,
            startVelocity: 50,
            ticks: 140,
            origin: { x: 0.5, y: 0.38 },
            colors: pbFireworksColors,
            scalar: 1.4
          });
        } catch (_) {}

        const t1 = setTimeout(() => {
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

        const t2 = setTimeout(() => {
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

        celebrationTimer.current = t1;
        return () => { clearTimeout(t1); clearTimeout(t2); };
      } else if (isThreeStars) {
        // More for 3 stars
        fire(0.25, { spread: 30, startVelocity: 65 });
        fire(0.2, { spread: 68, startVelocity: 45 });
        fire(0.35, { spread: 115, decay: 0.91, scalar: 0.95 });
        fire(0.1, { spread: 130, startVelocity: 32, decay: 0.92, scalar: 1.35 });
        fire(0.1, { spread: 130, startVelocity: 55 });

        celebrationTimer.current = setTimeout(() => {
          try {
            confetti({
              particleCount: 60,
              angle: 60,
              spread: 65,
              startVelocity: 42,
              origin: { x: 0.05, y: 0.75 },
              colors: goldenColors
            });
            confetti({
              particleCount: 60,
              angle: 120,
              spread: 65,
              startVelocity: 42,
              origin: { x: 0.95, y: 0.75 },
              colors: goldenColors
            });
          } catch (error) {
            console.warn('Victory celebration unavailable:', error);
          }
        }, 180);
        return () => clearTimeout(celebrationTimer.current);
      } else if (displayStars === 2) {
        // Some for 2 stars
        fire(0.4, { spread: 68, startVelocity: 46 });
      }
      // None for 1 star (no fire calls)
    }
  }, [isOpen, displayStars, elapsedTime, difficulty, themeId, isStageSet, score, incomingChallenge, isAbstract, worldRank, isPersonalBest, isNewRecord, isPersonalBestForSet]);

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

  const handleLeaveResult = action => {
    sounds.playTap();
    clearTimeout(celebrationTimer.current);
    confetti.reset?.();
    commitAbandonedRecordName();
    onClose();
    action?.();
  };

  const handleOpenShare = async () => {
    sounds.playTap();
    if (isNativeSharing()) {
      try {
        await shareChallengeResultDirectly({
          elapsedTime,
          isPersonalBest: Boolean(isPersonalBest || isNewRecord),
          difficulty,
          themeId,
          levelTitle: titleText,
          levelId: level?.id || ''
        });
      } catch (err) {
        console.warn('[VictoryModal] Direct native share failed, falling back to modal:', err);
        setShareModalOpen(true);
      }
    } else {
      trackChallengeShareClicked({
        source: isPersonalBest ? 'victory_modal_pb_cta' : 'victory_modal_cta',
        elapsedTimeMs: elapsedTime,
        isPersonalBest,
        difficulty,
        themeId
      });
      setShareModalOpen(true);
    }
  };

  return (
    <>
      <div
        data-testid="victory-modal-backdrop"
        onClick={() => handleLeaveResult(onNextLevel)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}
      >
        <div
          className="glass-panel modal-split-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '440px',
            width: '94%',
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            padding: '14px 16px',
            boxSizing: 'border-box',
            textAlign: 'center',
            border: isPersonalBest ? '2px solid var(--accent-gold)' : '2px solid var(--accent-cyan)',
            boxShadow: isPersonalBest ? '0 0 45px rgba(255, 183, 3, 0.45)' : '0 0 40px rgba(0, 240, 255, 0.45)',
            borderRadius: '20px',
            position: 'relative',
            '--modal-accent': isPersonalBest ? 'var(--accent-gold)' : 'var(--accent-cyan)'
          }}
        >
          <ModalAmbientParticles />
          {/* Top Right Close "X" Button */}
          <button
            onClick={() => handleLeaveResult(onReturnToMenu || onClose)}
            title="Return to Main Menu"
            aria-label="Return to Main Menu"
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

          {/* Header with Leaderboards button to the left of title */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40px', marginBottom: '8px', padding: '0 48px' }}>
            <button
              onClick={() => { sounds.playTap(); commitAbandonedRecordName(); onOpenLeaderboard?.(effectiveSetId); }}
              aria-label="View leaderboards"
              title="View leaderboards"
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

          {/* Underneath centered: Star Rating. Outline stays static; only the gold fill pops in, per star. */}
          <div role="img" aria-label={`${displayStars} out of 3 stars`} style={{ display: 'flex', justifyContent: 'center', gap: 'var(--modal-gap-sm)', marginBottom: '14px' }}>
            {[1, 2, 3].map(starNum => {
              const active = starNum <= displayStars;
              return (
                <div key={starNum} style={{ position: 'relative', width: '30px', height: '30px' }}>
                  <Star size={30} fill="none" color="rgba(255, 255, 255, 0.25)" />
                  {active && (
                    <div style={{ position: 'absolute', inset: '-10px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <Star
                        size={30}
                        fill="var(--accent-gold)"
                        color="var(--accent-gold)"
                        style={{
                          filter: 'drop-shadow(0 0 14px rgba(255, 183, 3, 0.95))',
                          animation: `starFillPopIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${(starNum - 1) * 0.65}s both`
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Underneath centered: Time (with Share button to left and record label next to time if record achieved) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--modal-gap-sm)',
            marginBottom: '12px',
            flexWrap: 'wrap'
          }}>
            {canShare && (
              <button
                onClick={handleOpenShare}
                aria-label="Share result"
                title="Share result"
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  borderRadius: '12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.9), rgba(255, 110, 0, 0.95))',
                  color: '#000',
                  border: 'none',
                  boxShadow: '0 2px 10px rgba(255, 183, 3, 0.4)'
                }}
              >
                <Share2 size={18} />
              </button>
            )}
            <span style={{
              fontSize: '2rem',
              fontWeight: 900,
              fontFamily: 'var(--font-mono)',
              color: '#ffffff',
              textShadow: '0 0 20px rgba(0, 240, 255, 0.65)',
              lineHeight: 1.1
            }}>
              {seconds}s
            </span>
            {recordBadgeText && (
              <span style={{
                fontSize: '0.86rem',
                fontWeight: 900,
                color: 'var(--accent-gold)',
                textShadow: '0 0 10px rgba(255, 183, 3, 0.8)'
              }}>
                {recordBadgeText}
              </span>
            )}
          </div>

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

          {/* Details Subsection: Left-aligned details with right-aligned values */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid var(--border-glass)',
            borderRadius: '14px',
            padding: '10px 16px',
            marginBottom: '10px',
            fontSize: '0.95rem',
            textAlign: 'left'
          }}>
            {!isAbstract && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Set #</span>
                <span style={{ fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>{displaySetNumber}</span>
              </div>
            )}

            {!isAbstract && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Attempt #</span>
                <span style={{ fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>{displayAttemptNumber}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Points</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>{score.toLocaleString()} PTS</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Accuracy</span>
              <span style={{ fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{accuracy}%</span>
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
              padding: '8px 10px',
              marginBottom: '10px',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 900, color: playerWonChallenge ? 'var(--accent-green)' : 'var(--accent-pink)' }}>
                <Swords size={16} />
                {playerWonChallenge ? `YOU BEAT ${incomingChallenge.challengerName.toUpperCase()}!` : `${incomingChallenge.challengerName.toUpperCase()} WAS FASTER!`}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--modal-gap-md)', marginTop: '6px', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{incomingChallenge.challengerName}: <b style={{ color: '#fff' }}>{challengerSec}s</b></span>
                <span style={{ color: 'var(--text-muted)' }}>vs</span>
                <span style={{ color: playerWonChallenge ? 'var(--accent-green)' : 'var(--accent-gold)' }}>You: <b style={{ color: '#fff' }}>{seconds}s</b></span>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', width: '100%' }}>
            <button
              className="glass-btn"
              onClick={() => handleLeaveResult(onReturnToMenu || onClose)}
              style={{
                flex: 1,
                justifyContent: 'center',
                fontSize: '0.95rem',
                fontWeight: 800,
                padding: '12px 14px',
                borderRadius: '12px',
                whiteSpace: 'nowrap'
              }}
            >
              Return to Menu
            </button>
            <button
              className="glass-btn glass-btn-primary"
              onClick={() => handleLeaveResult(onNextLevel)}
              style={{
                flex: 1.2,
                justifyContent: 'center',
                fontSize: '1.05rem',
                fontWeight: 900,
                padding: '12px 16px',
                borderRadius: '12px',
                whiteSpace: 'nowrap'
              }}
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
          isPersonalBest={Boolean(isPersonalBest || isNewRecord)}
          difficulty={difficulty}
          themeId={themeId}
          levelTitle={titleText}
          levelId={level?.id || ''}
        />
      )}
    </>
  );
}
