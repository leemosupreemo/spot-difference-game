import React from 'react';
import { Play, Layers, Sparkles, Camera, Target, Search, Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { sounds } from '../utils/audio';
import { SCENE_THEMES } from '../utils/proceduralGenerator';
import { logApp, auditDOMState } from '../utils/logger';
import TutorialBanner from './TutorialBanner';

export default function MainMenu({
  selectedTheme,
  setSelectedTheme,
  onStartGame
}) {
  const themeIcons = {
    find_the_sniper: '📷',
    abstract_animated: '🎨'
  };

  const spotAndTapRules = [
    {
      icon: <Target size={18} color="var(--accent-pink)" />,
      title: 'Spot Exactly 1 Difference',
      desc: 'Compare the Original & Variant side-by-side'
    },
    {
      icon: <Search size={18} color="var(--accent-cyan)" />,
      title: 'Synchronized Dual Loupe',
      desc: 'Tap & hold to zoom and pan high-res details'
    },
    {
      icon: <Zap size={18} color="var(--accent-gold)" />,
      title: 'Dynamic Speed Score',
      desc: 'Solve fast to maximize your stage points'
    },
    {
      icon: <ShieldAlert size={18} color="var(--accent-green)" />,
      title: '3-Strike Limit',
      desc: 'Clear 5 images in a row for full victory'
    }
  ];

  return (
    <div style={{
      maxWidth: '850px',
      margin: '0 auto 20px auto',
      padding: '0 16px',
      textAlign: 'center',
      animation: 'pageFadeIn 0.15s ease-out'
    }}>
      {/* Top Interactive Tutorial Graphic Banner */}
      <TutorialBanner />

      {/* 2-Column Responsive Grid (Equal Heights!) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        alignItems: 'stretch'
      }}>
        {/* Left Side: SPOT & TAP Quick Guide */}
        <div className="glass-panel" style={{
          padding: '16px 14px',
          borderRadius: '18px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Target size={20} color="var(--accent-pink)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                SPOT & TAP
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {spotAndTapRules.map((rule, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.07)'
                  }}
                >
                  <div style={{
                    padding: '6px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px'
                  }}>
                    {rule.icon}
                  </div>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.86rem', display: 'block', marginBottom: '2px' }}>
                      {rule.title}
                    </strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: '1.25', display: 'block' }}>
                      {rule.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Category Selection & START GAME Button */}
        <div className="glass-panel" style={{
          padding: '16px 14px',
          borderRadius: '18px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Layers size={20} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                CATEGORY
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              {SCENE_THEMES.map(theme => {
                const isSelected = selectedTheme === theme.id;
                return (
                  <div
                    key={theme.id}
                    onClick={() => {
                      sounds.playTap();
                      setSelectedTheme(theme.id);
                    }}
                    className="glass-panel"
                    style={{
                      padding: '14px 10px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      border: isSelected ? '2.5px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                      boxShadow: isSelected ? '0 0 15px rgba(0, 240, 255, 0.4)' : 'none',
                      background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      transition: 'all 0.18s ease',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>
                      {themeIcons[theme.id] || '📷'}
                    </div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: isSelected ? '#fff' : 'var(--text-main)', margin: 0 }}>
                      {theme.title}
                    </h4>
                  </div>
                );
              })}
            </div>
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
              padding: '14px 24px',
              fontSize: '1.25rem',
              fontWeight: 900,
              justifyContent: 'center',
              borderRadius: '14px',
              boxShadow: '0 6px 30px rgba(0, 240, 255, 0.5)',
              letterSpacing: '0.5px',
              touchAction: 'manipulation',
              WebkitUserSelect: 'auto',
              userSelect: 'auto',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            <Play size={22} fill="#000" /> START GAME
          </button>
        </div>
      </div>
    </div>
  );
}
