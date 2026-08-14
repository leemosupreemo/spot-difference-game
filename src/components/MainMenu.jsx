import React from 'react';
import { Play, Flame, Layers, CheckCircle2 } from 'lucide-react';
import { sounds } from '../utils/audio';
import { SCENE_THEMES } from '../utils/proceduralGenerator';
import { logApp, auditDOMState } from '../utils/logger';

export default function MainMenu({
  selectedTheme,
  setSelectedTheme,
  selectedDifficulty,
  setSelectedDifficulty,
  onStartGame
}) {
  const themeIcons = {
    find_the_sniper: '📷',
    abstract_animated: '✨'
  };

  const difficulties = [
    { id: 'Easy', name: 'EASY', color: 'var(--accent-green)', icon: '🟢' },
    { id: 'Medium', name: 'MEDIUM', color: 'var(--accent-gold)', icon: '🟡' },
    { id: 'Hard', name: 'HARD', color: 'var(--accent-pink)', icon: '🔴' }
  ];

  return (
    <div style={{
      maxWidth: '850px',
      margin: '0 auto 20px auto',
      padding: '0 16px',
      textAlign: 'center',
      animation: 'pageFadeIn 0.15s ease-out'
    }}>
      {/* Single Screen 2-Column Responsive Grid (Equal Heights!) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        alignItems: 'stretch'
      }}>
        {/* Left Side: Compact Difficulty Selection */}
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
              <Flame size={20} color="var(--accent-pink)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                DIFFICULTY
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {difficulties.map(diff => {
                const isSelected = selectedDifficulty === diff.id;
                return (
                  <button
                    key={diff.id}
                    onClick={() => {
                      sounds.playTap();
                      setSelectedDifficulty(diff.id);
                    }}
                    className="glass-btn"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      justifyContent: 'space-between',
                      borderRadius: '12px',
                      background: isSelected ? diff.color : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#000' : 'var(--text-main)',
                      borderColor: isSelected ? diff.color : 'var(--border-glass)',
                      boxShadow: isSelected ? `0 0 15px ${diff.color}55` : 'none',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{diff.icon}</span> {diff.name}
                    </span>
                    {isSelected && <CheckCircle2 size={16} color="#000" strokeWidth={3} />}
                  </button>
                );
              })}
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
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
              logApp('INFO', `[StartGameBtnPointerDown] Theme: ${selectedTheme} Diff: ${selectedDifficulty}`);
              auditDOMState('StartGameBtnPointerDown');
            }}
            onClick={(e) => {
              e.currentTarget.blur();
              logApp('INFO', `[StartGameBtnClicked] Theme: ${selectedTheme} Diff: ${selectedDifficulty}`);
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
