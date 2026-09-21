import React, { useMemo, useState, useEffect } from 'react';
import { formatSetLabel } from '../utils/remoteSetPolicy.js';
import { Play, Layers, Sparkles, Camera, Swords, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { sounds } from '../utils/audio';
import { SCENE_THEMES, generateProceduralLevelPair } from '../utils/proceduralGenerator';
import { resolveAssetUrl } from '../utils/photoPairLevelLoader';
import { logApp, auditDOMState } from '../utils/logger';
import { trackCategorySelected, trackMainMenuViewed } from '../services/analytics';
import { hasCompletedFirstSet } from '../services/playerProgress';
import TutorialBanner from './TutorialBanner';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';
import TronLightcycleField from './TronLightcycleField.jsx';

// A representative real photo (Photography mode) and a deterministically seeded
// procedural scene (Abstract mode) used as a dim, animated background hint for
// whichever Game Mode card is active. Neither is part of the playable rotation.
const GAME_MODE_PHOTO_BG = 'levels/photo-pairs/kitchen/easy_kitchen_001/base.jpg';
const GAME_MODE_ABSTRACT_SEED = 8675309;

export default function MainMenu({
  selectedTheme,
  setSelectedTheme,
  photoSetIds = [],
  photoSetId = '',
  onPhotoSetChange = null,
  onStartGame,
  incomingChallenge = null,
  hasCompletedFirstSet: hasCompletedProp,
  bannerSlot = null,
  noticeSlot = null,
  reviewDismissedLevels = false,
  onToggleReviewDismissed = null,
  dismissedCount = 0,
  simulatedOffline = false,
  onToggleSimulatedOffline = null,
  debugMode = false,
  tutorialAnimationEnabled = true,
  onToggleTutorialAnimation = null,
  onRefreshRemotePacks = null,
  remotePackSync = { status: 'idle', count: 0 }
}) {
  const isSetCompleted = hasCompletedProp !== undefined ? hasCompletedProp : hasCompletedFirstSet();
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

  const photoModeBg = useMemo(() => resolveAssetUrl(GAME_MODE_PHOTO_BG), []);
  const abstractModeBg = useMemo(() => {
    try {
      return generateProceduralLevelPair('abstract_animated', 'Medium', GAME_MODE_ABSTRACT_SEED).baseImage;
    } catch (_) {
      return null;
    }
  }, []);
  const cardBgImages = {
    find_the_sniper: photoModeBg,
    abstract_animated: abstractModeBg
  };
  // Per-card tick, bumped only on that card's own tap (even re-tapping the active
  // mode) so its zoom/fade replays independently of the other card.
  const [gameModeBgTicks, setGameModeBgTicks] = useState({});

  useEffect(() => {
    trackMainMenuViewed({ selectedTheme });
  }, []);

  const themeDetails = {
    find_the_sniper: {
      icon: <Camera size={26} color="var(--accent-cyan)" />,
      badge: 'REALISTIC PHOTOS'
    },
    abstract_animated: {
      icon: <Sparkles size={26} color="#d9b3ff" />,
      badge: 'INFINITE WORLDS'
    }
  };

  return (
    <div className="menu-container page-fade-in">
      <TronLightcycleField />
      <ModalAmbientParticles />
      {/* Incoming Challenge Banner (When launched from a friend's link) */}
      {incomingChallenge && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.25), rgba(255, 0, 127, 0.2))',
          border: '2px solid var(--accent-gold)',
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 0 25px rgba(255, 183, 3, 0.35)',
          animation: 'pageFadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000'
            }}>
              <Swords size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 900, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⚔️ CHALLENGE RECEIVED
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#fff' }}>
                Can you beat <span style={{ color: 'var(--accent-cyan)' }}>{incomingChallenge.challengerName}</span>'s <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>{incomingChallenge.targetTimeSec}s</span>?
              </div>
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 183, 3, 0.2)',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.74rem',
            fontWeight: 800,
            color: 'var(--accent-gold)'
          }}>
            1 DIFFERENCE
          </div>
        </div>
      )}

      {noticeSlot}
      {bannerSlot}

      {debugMode && onToggleTutorialAnimation && (
        <button
          type="button"
          onClick={onToggleTutorialAnimation}
          className="glass-btn"
          style={{
            width: '100%',
            marginBottom: '10px',
            padding: '8px 12px',
            justifyContent: 'center',
            fontSize: '0.78rem',
            fontWeight: 800,
            color: tutorialAnimationEnabled ? 'var(--accent-green)' : 'var(--text-muted)',
            borderColor: tutorialAnimationEnabled ? 'rgba(0, 255, 135, 0.45)' : 'var(--border-glass)',
            background: tutorialAnimationEnabled ? 'rgba(0, 255, 135, 0.12)' : 'rgba(255, 255, 255, 0.05)'
          }}
        >
          {tutorialAnimationEnabled ? '▶ Tutorial Animation: ON' : '⏸ Tutorial Animation: OFF'}
        </button>
      )}

      {debugMode && selectedTheme === 'find_the_sniper' && onRefreshRemotePacks && (
        <div style={{ marginBottom: '10px' }}>
          <button
            type="button"
            aria-label={remotePackSync.status === 'refreshing' ? 'Refreshing Remote Packs' : 'Refresh Remote Packs'}
            disabled={remotePackSync.status === 'refreshing'}
            onClick={onRefreshRemotePacks}
            className="glass-btn"
            style={{
              width: '100%',
              padding: '8px 12px',
              justifyContent: 'center',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: remotePackSync.status === 'error' ? '#ff6b8a' : 'var(--accent-cyan)',
              borderColor: remotePackSync.status === 'error' ? 'rgba(255, 107, 138, 0.5)' : 'rgba(0, 240, 255, 0.45)',
              background: 'rgba(0, 240, 255, 0.08)'
            }}
          >
            {remotePackSync.status === 'refreshing' ? '↻ REFRESHING REMOTE PACKS…' : '↻ REFRESH REMOTE PACKS'}
          </button>
          {remotePackSync.status === 'success' && (
            <div style={{ marginTop: '5px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 800 }}>
              {remotePackSync.count} remote levels loaded
            </div>
          )}
          {remotePackSync.status === 'error' && (
            <div role="alert" style={{ marginTop: '5px', textAlign: 'center', fontSize: '0.72rem', color: '#ff6b8a', fontWeight: 800 }}>
              {remotePackSync.message || 'Remote refresh failed'}
            </div>
          )}
        </div>
      )}

      {/* Tutorial graphic remains available in debug mode after the first set. */}
      {(!isSetCompleted || debugMode) && tutorialAnimationEnabled && (
        <TutorialBanner forceShow={debugMode} />
      )}

      {/* Main Mode / Category Selection Card */}
      <div className="glass-panel" style={{
        padding: '16px 18px',
        borderRadius: '18px',
        textAlign: 'left',
        boxSizing: 'border-box',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Layers size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
            GAME MODE
          </h3>
        </div>

        <div className="mode-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          {SCENE_THEMES.map(theme => {
            const isSelected = selectedTheme === theme.id;
            const details = themeDetails[theme.id] || {
              icon: <Camera size={26} color="var(--accent-cyan)" />,
              badge: 'MODE',
              desc: ''
            };
            const cardBgImage = cardBgImages[theme.id];
            const cardBgTick = gameModeBgTicks[theme.id] || 0;

            return (
              <div
                key={theme.id}
                onClick={() => {
                  sounds.playTap();
                  setSelectedTheme(theme.id);
                  setGameModeBgTicks(prev => ({ ...prev, [theme.id]: (prev[theme.id] || 0) + 1 }));
                  trackCategorySelected(theme.id);
                }}
                className="glass-panel mode-card-item"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  boxShadow: isSelected ? '0 0 16px rgba(0, 240, 255, 0.3)' : 'none',
                  background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                {cardBgImage && (
                  <div className="game-mode-bg" aria-hidden="true">
                    <div
                      key={`${theme.id}-${cardBgTick}`}
                      className="game-mode-bg-image"
                      style={{ backgroundImage: `url(${cardBgImage})` }}
                    />
                  </div>
                )}
                <div style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: isSelected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {details.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 className="mode-card-title" style={{ fontSize: '1.05rem', fontWeight: 900, color: isSelected ? '#fff' : 'var(--text-main)', margin: 0 }}>
                      {theme.title}
                    </h4>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '5px',
                      background: isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)',
                      color: isSelected ? '#000' : 'var(--text-muted)'
                    }}>
                      {details.badge}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {debugMode && (
          <button
            type="button"
            aria-label="Review Dismissed Levels"
            aria-pressed={reviewDismissedLevels}
            onClick={() => onToggleReviewDismissed?.(!reviewDismissedLevels)}
            disabled={!reviewDismissedLevels && dismissedCount === 0}
            style={{
              width: '100%',
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '0.76rem',
              letterSpacing: '0.5px',
              cursor: (!reviewDismissedLevels && dismissedCount === 0) ? 'default' : 'pointer',
              background: reviewDismissedLevels ? 'rgba(255, 176, 32, 0.18)' : 'rgba(10, 8, 28, 0.9)',
              color: reviewDismissedLevels ? 'var(--accent-gold, #ffb020)' : 'var(--text-muted)',
              border: `1px solid ${reviewDismissedLevels ? 'rgba(255, 176, 32, 0.55)' : 'var(--border-glass)'}`,
              opacity: (!reviewDismissedLevels && dismissedCount === 0) ? 0.5 : 1
            }}
          >
            {reviewDismissedLevels
              ? '↩︎ REVIEWING DISMISSED — TAP TO EXIT'
              : `🗑 REVIEW DISMISSED (${dismissedCount})`}
          </button>
        )}

        {debugMode && (
          <button
            type="button"
            aria-label="Simulate Offline"
            aria-pressed={simulatedOffline}
            onClick={() => onToggleSimulatedOffline?.(!simulatedOffline)}
            style={{
              width: '100%',
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '0.76rem',
              letterSpacing: '0.5px',
              cursor: 'pointer',
              background: simulatedOffline ? 'rgba(255, 107, 138, 0.18)' : 'rgba(10, 8, 28, 0.9)',
              color: simulatedOffline ? '#ff6b8a' : 'var(--text-muted)',
              border: `1px solid ${simulatedOffline ? 'rgba(255, 107, 138, 0.55)' : 'var(--border-glass)'}`
            }}
          >
            {simulatedOffline ? '📴 SIMULATING OFFLINE — TAP TO RESTORE' : '📡 SIMULATE OFFLINE'}
          </button>
        )}

        {debugMode && selectedTheme === 'find_the_sniper' && (
          <label style={{ display: 'block', marginBottom: '14px' }}>
            <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.76rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              PHOTO SET
            </span>
            <select
              aria-label="Photo Set"
              value={photoSetId}
              disabled={photoSetIds.length === 0}
              onChange={(event) => onPhotoSetChange?.(event.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-glass)',
                background: 'rgba(10, 8, 28, 0.9)',
                color: 'var(--text-main)',
                fontWeight: 800
              }}
            >
              {photoSetIds.map((availableSetId) => (
                <option key={availableSetId} value={availableSetId}>
                  {formatSetLabel(availableSetId)}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Main Action START GAME Button with Periodic Sheen */}
        <div className="start-game-outer-container start-game-btn-wrapper">
          <div className="start-game-btn-anchor">
            <button
              className="glass-btn glass-btn-primary start-game-btn"
              onPointerDown={() => {
                logApp('INFO', `[StartGameBtnPointerDown] Theme: ${selectedTheme}`);
                auditDOMState('StartGameBtnPointerDown');
              }}
              onClick={(e) => {
                e.currentTarget.blur();
                logApp('INFO', `[StartGameBtnClicked] Theme: ${selectedTheme}`);
                auditDOMState('StartGameBtnClicked');
                try { sounds.playWin(); } catch (_) {}
                try { onStartGame(); } catch (err) { logApp('ERROR', '[onStartGameError]', err?.stack || err); }
              }}
              style={{
                width: '100%',
                maxWidth: '360px',
                padding: '15px 24px',
                fontSize: '1.25rem',
                fontWeight: 900,
                justifyContent: 'center',
                borderRadius: '14px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                letterSpacing: '0.5px',
                touchAction: 'manipulation',
                WebkitUserSelect: 'auto',
                userSelect: 'auto',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Play size={22} fill="#000" /> START GAME
            </button>
          </div>
        </div>
      </div>

      {/* Web Only "Coming Soon to iPhone" Badge Banner */}
      {!isNative && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-muted)',
            fontSize: '0.82rem',
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginTop: '4px',
            userSelect: 'none'
          }}
        >
          <Smartphone size={16} color="var(--accent-cyan)" />
          <span>Coming soon to iPhone & iPad on the <strong style={{ color: '#fff' }}>App Store</strong></span>
        </div>
      )}
    </div>
  );
}
