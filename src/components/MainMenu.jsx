import { Play, Layers, Sparkles, Camera, Swords, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { sounds } from '../utils/audio';
import { SCENE_THEMES } from '../utils/proceduralGenerator';
import { logApp, auditDOMState } from '../utils/logger';
import { trackCategorySelected } from '../services/analytics';
import { getAppStoreReviewUrl } from '../services/appConfig';
import TutorialBanner from './TutorialBanner';

export default function MainMenu({
  selectedTheme,
  setSelectedTheme,
  onStartGame,
  incomingChallenge = null
}) {
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  const themeDetails = {
    find_the_sniper: {
      icon: <Camera size={26} color="var(--accent-cyan)" />,
      badge: 'REALISTIC PHOTOS',
      desc: 'Authentic high-resolution photographs with 1 subtle difference'
    },
    abstract_animated: {
      icon: <Sparkles size={26} color="#d9b3ff" />,
      badge: 'INFINITE WORLDS',
      desc: 'Dynamic generative art compositions across 12 artistic worlds'
    }
  };

  return (
    <div className="menu-container page-fade-in">
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

      {/* Top Interactive Tutorial Graphic Banner with full-width SPOT & TAP */}
      <TutorialBanner />

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

            return (
              <div
                key={theme.id}
                onClick={() => {
                  sounds.playTap();
                  setSelectedTheme(theme.id);
                  trackCategorySelected(theme.id);
                }}
                className="glass-panel mode-card-item"
                style={{
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
                  {details.desc && (
                    <p style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-muted)',
                      margin: '4px 0 0 0',
                      lineHeight: '1.25'
                    }}>
                      {details.desc}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Action START GAME Button */}
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
            padding: '15px 24px',
            fontSize: '1.25rem',
            fontWeight: 900,
            justifyContent: 'center',
            borderRadius: '14px',
            boxShadow: '0 6px 30px rgba(0, 240, 255, 0.5)',
            letterSpacing: '0.5px',
            touchAction: 'manipulation',
            WebkitUserSelect: 'auto',
            userSelect: 'auto',
            cursor: 'pointer'
          }}
        >
          <Play size={22} fill="#000" /> START GAME
        </button>
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
