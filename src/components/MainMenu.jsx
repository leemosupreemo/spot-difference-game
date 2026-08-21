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
      icon: <Camera size={28} color="var(--accent-cyan)" />,
      badge: 'REAL PHOTO PAIRS',
      desc: 'Authentic high-resolution photographs with 1 subtle difference'
    },
    abstract_animated: {
      icon: <Sparkles size={28} color="#d9b3ff" />,
      badge: 'PROCEDURAL WORLDS',
      desc: 'Dynamic generative art compositions across 12 artistic worlds'
    }
  };

  return (
    <div style={{
      maxWidth: '650px',
      margin: '0 auto 20px auto',
      padding: '0 16px',
      textAlign: 'center',
      animation: 'pageFadeIn 0.15s ease-out'
    }}>
      {/* Top Interactive Tutorial Graphic Banner */}
      <TutorialBanner />

      {/* Main Mode / Category Selection Card */}
      <div className="glass-panel" style={{
        padding: '20px 18px',
        borderRadius: '20px',
        textAlign: 'left',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Layers size={22} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
            SELECT GAME MODE
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
          {SCENE_THEMES.map(theme => {
            const isSelected = selectedTheme === theme.id;
            const details = themeDetails[theme.id] || {
              icon: <Camera size={28} color="var(--accent-cyan)" />,
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
                  padding: '16px 18px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  border: isSelected ? '2.5px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  boxShadow: isSelected ? '0 0 20px rgba(0, 240, 255, 0.35)' : 'none',
                  background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}
              >
                <div style={{
                  padding: '12px',
                  borderRadius: '14px',
                  background: isSelected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {details.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 900, color: isSelected ? '#fff' : 'var(--text-main)', margin: 0 }}>
                      {theme.title}
                    </h4>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)',
                      color: isSelected ? '#000' : 'var(--text-muted)'
                    }}>
                      {details.badge}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                    {details.desc}
                  </p>
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
            padding: '16px 24px',
            fontSize: '1.3rem',
            fontWeight: 900,
            justifyContent: 'center',
            borderRadius: '16px',
            boxShadow: '0 6px 30px rgba(0, 240, 255, 0.5)',
            letterSpacing: '0.5px',
            touchAction: 'manipulation',
            WebkitUserSelect: 'auto',
            userSelect: 'auto',
            cursor: 'pointer'
          }}
        >
          <Play size={24} fill="#000" /> START GAME
        </button>
      </div>
    </div>
  );
}
