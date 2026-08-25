import React from 'react';
import { Play, Layers, Sparkles, Camera } from 'lucide-react';
import { sounds } from '../utils/audio';
import { SCENE_THEMES } from '../utils/proceduralGenerator';
import { logApp, auditDOMState } from '../utils/logger';
import TutorialBanner from './TutorialBanner';

export default function MainMenu({
  selectedTheme,
  setSelectedTheme,
  onStartGame
}) {
  const themeDetails = {
    find_the_sniper: {
      icon: <Camera size={26} color="var(--accent-cyan)" />,
      badge: 'REAL PHOTO PAIRS',
      desc: 'Authentic high-resolution photographs with 1 subtle difference'
    },
    abstract_animated: {
      icon: <Sparkles size={26} color="#d9b3ff" />,
      badge: 'PROCEDURAL WORLDS',
      desc: 'Dynamic generative art compositions across 12 artistic worlds'
    }
  };

  return (
    <div style={{
      maxWidth: '750px',
      margin: '0 auto 20px auto',
      padding: '0 16px',
      textAlign: 'center',
      animation: 'pageFadeIn 0.15s ease-out'
    }}>
      {/* Top Interactive Tutorial Graphic Banner with full-width SPOT & TAP */}
      <TutorialBanner />

      {/* Main Mode / Category Selection Card */}
      <div className="glass-panel" style={{
        padding: '16px 18px',
        borderRadius: '18px',
        textAlign: 'left',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Layers size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
            SELECT GAME MODE
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' }}>
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
                }}
                className="glass-panel"
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
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: isSelected ? '#fff' : 'var(--text-main)', margin: 0 }}>
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

        {/* Main Action START GAME Button */}
        <button
          className="glass-btn glass-btn-primary"
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
    </div>
  );
}
