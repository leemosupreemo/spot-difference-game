import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, RotateCcw, Download, ChevronRight, CheckCircle2, XCircle, HelpCircle, AlertTriangle, Camera, Sparkles } from 'lucide-react';
import { sounds } from '../utils/audio';
import { getLevelStatus } from '../utils/curationStore';
import CuratedExportModal from './CuratedExportModal';

export default function DebugCuratorBar({
  currentLevel,
  curatedStatusMap,
  onSetStatus,
  onSetCategory,
  onResetAll,
  onPruneDismissed,
  onNextPair,
  debugSourceMode = 'premade',
  onToggleSourceMode,
  skipKeptLevels = true,
  onToggleSkipKept
}) {
  const [isExportOpen, setIsExportOpen] = useState(false);

  if (!currentLevel) return null;

  const levelId = currentLevel.id;
  const statusObj = getLevelStatus(curatedStatusMap[levelId]);
  const currentStatus = statusObj?.status || null;
  const currentPackId = statusObj?.packId || currentLevel.packId || 'find_the_sniper';

  const handleApprove = () => {
    sounds.playWin();
    onSetStatus(levelId, 'approved');
  };

  const handleDifficulty = (suggestedDifficulty) => {
    sounds.playTap();
    onSetStatus(levelId, 'wrong_difficulty', { suggestedDifficulty });
  };

  const handleDismiss = () => {
    sounds.playError();
    onSetStatus(levelId, 'dismissed');
  };

  const handleReset = () => {
    sounds.playTap();
    onSetStatus(levelId, null);
  };

  const handleCategory = (packId) => {
    sounds.playTap();
    onSetCategory(levelId, packId);
  };

  const statusValues = Object.values(curatedStatusMap).map(v => getLevelStatus(v)?.status);
  const approvedTotal = statusValues.filter(s => s === 'approved').length;
  const wrongDiffTotal = statusValues.filter(s => s === 'wrong_difficulty').length;
  const dismissedTotal = statusValues.filter(s => s === 'dismissed').length;

  return (
    <div style={{
      width: '100%',
      maxWidth: '1300px',
      margin: '0 auto 10px auto',
      padding: '0 16px',
      boxSizing: 'border-box'
    }}>
      <div className="glass-panel" style={{
        padding: '8px 14px',
        width: '100%',
        boxSizing: 'border-box',
        borderColor: currentStatus === 'approved' ? 'rgba(0, 255, 135, 0.6)' : currentStatus === 'wrong_difficulty' ? 'rgba(255, 183, 3, 0.6)' : currentStatus === 'dismissed' ? 'rgba(255, 0, 127, 0.6)' : 'rgba(0, 240, 255, 0.4)',
        boxShadow: currentStatus === 'approved' ? '0 0 20px rgba(0, 255, 135, 0.25)' : currentStatus === 'wrong_difficulty' ? '0 0 20px rgba(255, 183, 3, 0.25)' : currentStatus === 'dismissed' ? '0 0 20px rgba(255, 0, 127, 0.25)' : '0 0 15px rgba(0, 240, 255, 0.15)',
        transition: 'all 0.25s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          
          {/* Left: Curator Title, Source Mode Toggle & Image Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--accent-cyan)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🛠️ DEBUG CURATOR
            </span>

            {/* Source Mode Toggle: Premade vs Procedural */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '2px', border: '1px solid var(--border-glass)' }}>
              <button
                onClick={() => { sounds.playTap(); onToggleSourceMode && onToggleSourceMode('premade'); }}
                style={{
                  padding: '4px 9px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: debugSourceMode === 'premade' ? 'var(--accent-cyan)' : 'transparent',
                  color: debugSourceMode === 'premade' ? '#000' : 'var(--text-muted)'
                }}
                title="Review premade photo manifest library"
              >
                🖼️ PREMADE
              </button>

              <button
                onClick={() => { sounds.playTap(); onToggleSourceMode && onToggleSourceMode('procedural'); }}
                style={{
                  padding: '4px 9px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: debugSourceMode === 'procedural' ? 'var(--accent-gold)' : 'transparent',
                  color: debugSourceMode === 'procedural' ? '#000' : 'var(--text-muted)'
                }}
                title="Generate fresh procedural levels on-the-fly"
              >
                ⚡ PROCEDURAL
              </button>
            </div>

            {/* Skip Kept Toggle */}
            {onToggleSkipKept && (
              <button
                onClick={() => { sounds.playTap(); onToggleSkipKept(!skipKeptLevels); }}
                className="glass-btn"
                style={{
                  padding: '4px 9px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  background: skipKeptLevels ? 'rgba(0, 255, 135, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                  color: skipKeptLevels ? 'var(--accent-green)' : 'var(--text-muted)',
                  border: `1px solid ${skipKeptLevels ? 'rgba(0, 255, 135, 0.4)' : 'var(--border-glass)'}`
                }}
                title="Toggle whether to skip images already marked 'Keep'"
              >
                {skipKeptLevels ? '⏩ Skip Kept: ON' : '⏸️ Skip Kept: OFF'}
              </button>
            )}

            {/* Current Status Pill */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '10px',
              fontSize: '0.78rem',
              fontWeight: 800,
              background: currentStatus === 'approved' ? 'rgba(0, 255, 135, 0.2)' : currentStatus === 'wrong_difficulty' ? 'rgba(255, 183, 3, 0.2)' : currentStatus === 'dismissed' ? 'rgba(255, 0, 127, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              color: currentStatus === 'approved' ? 'var(--accent-green)' : currentStatus === 'wrong_difficulty' ? 'var(--accent-gold)' : currentStatus === 'dismissed' ? 'var(--accent-pink)' : 'var(--text-muted)',
              border: `1px solid ${currentStatus === 'approved' ? 'rgba(0, 255, 135, 0.4)' : currentStatus === 'wrong_difficulty' ? 'rgba(255, 183, 3, 0.4)' : currentStatus === 'dismissed' ? 'rgba(255, 0, 127, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`
            }}>
              {currentStatus === 'approved' ? (
                <><CheckCircle2 size={14} /> OFFICIAL SET (APPROVED)</>
              ) : currentStatus === 'wrong_difficulty' ? (
                <><AlertTriangle size={14} /> KEEP - WRONG DIFFICULTY</>
              ) : currentStatus === 'dismissed' ? (
                <><XCircle size={14} /> DISMISSED</>
              ) : (
                <><HelpCircle size={14} /> PENDING REVIEW</>
              )}
            </div>
          </div>

          {/* Center: Curation and Difficulty Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Option 1: Thumbs Up (Keep - Good) */}
            <button
              onClick={handleApprove}
              className="glass-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                borderRadius: '10px',
                background: currentStatus === 'approved' ? 'linear-gradient(135deg, #00ff87, #00b862)' : 'rgba(0, 255, 135, 0.15)',
                color: currentStatus === 'approved' ? '#000' : 'var(--accent-green)',
                borderColor: 'var(--accent-green)',
                fontWeight: 800
              }}
              title="Thumbs Up: Approve & Keep in Official Set"
            >
              <ThumbsUp size={15} /> Keep
            </button>

            {['Easy', 'Medium', 'Hard'].map((difficulty) => (
              <button
                key={difficulty}
                onClick={() => handleDifficulty(difficulty)}
                className="glass-btn"
                style={{
                  padding: '6px 9px',
                  fontSize: '0.78rem',
                  borderRadius: '10px',
                  background: currentStatus === 'wrong_difficulty' && statusObj?.suggestedDifficulty === difficulty ? 'linear-gradient(135deg, #ffb703, #d49600)' : 'rgba(255, 183, 3, 0.15)',
                  color: currentStatus === 'wrong_difficulty' && statusObj?.suggestedDifficulty === difficulty ? '#000' : 'var(--accent-gold)',
                  borderColor: 'var(--accent-gold)',
                  fontWeight: 800
                }}
                title={`Keep image and assign ${difficulty} difficulty`}
              >
                {difficulty}
              </button>
            ))}

            {/* Option 3: Thumbs Down (Dismiss) */}
            <button
              onClick={handleDismiss}
              className="glass-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                borderRadius: '10px',
                background: currentStatus === 'dismissed' ? 'linear-gradient(135deg, #ff007f, #b8005c)' : 'rgba(255, 0, 127, 0.15)',
                color: currentStatus === 'dismissed' ? '#fff' : 'var(--accent-pink)',
                borderColor: 'var(--accent-pink)',
                fontWeight: 800
              }}
              title="Thumbs Down: Dismiss image from set"
            >
              <ThumbsDown size={15} /> Dismiss
            </button>

            {/* Reset Button */}
            {currentStatus && (
              <button
                onClick={handleReset}
                className="glass-btn"
                style={{ padding: '6px 10px', borderRadius: '10px', fontSize: '0.78rem' }}
                title="Reset status to pending"
              >
                <RotateCcw size={14} />
              </button>
            )}

            <button
              onClick={() => handleCategory('find_the_sniper')}
              className="glass-btn"
              style={{
                padding: '6px 9px',
                fontSize: '0.78rem',
                borderRadius: '10px',
                background: currentPackId === 'find_the_sniper' ? 'rgba(0, 240, 255, 0.35)' : 'rgba(0, 240, 255, 0.1)',
                color: 'var(--accent-cyan)',
                borderColor: 'var(--accent-cyan)',
                fontWeight: 800
              }}
              title="Designate this pair as Photography"
            >
              <Camera size={14} /> Photography
            </button>

            <button
              onClick={() => handleCategory('abstract_animated')}
              className="glass-btn"
              style={{
                padding: '6px 9px',
                fontSize: '0.78rem',
                borderRadius: '10px',
                background: currentPackId === 'abstract_animated' ? 'rgba(187, 134, 252, 0.35)' : 'rgba(187, 134, 252, 0.1)',
                color: '#d9b3ff',
                borderColor: '#d9b3ff',
                fontWeight: 800
              }}
              title="Designate this pair as Fantastical"
            >
              <Sparkles size={14} /> Fantastical
            </button>
          </div>

          {/* Right: Summary Counts & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              👍 <span style={{ color: 'var(--accent-green)' }}>{approvedTotal}</span> | ⚠️ <span style={{ color: 'var(--accent-gold)' }}>{wrongDiffTotal}</span> | 👎 <span style={{ color: 'var(--accent-pink)' }}>{dismissedTotal}</span>
            </div>

            <button
              onClick={() => setIsExportOpen(true)}
              className="glass-btn"
              style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '8px' }}
              title="Copy, share, or download curated decisions"
            >
              <Download size={14} /> Export
            </button>

            {onPruneDismissed && (
              <button
                onClick={() => { sounds.playTap(); onPruneDismissed(); }}
                className="glass-btn"
                style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '8px', color: 'var(--accent-pink)', borderColor: 'rgba(255, 0, 127, 0.4)' }}
                title="Prune off all dismissed images and keep all approved & pending ones"
              >
                ✂️ Prune Dismissed
              </button>
            )}

            <button
              onClick={onResetAll}
              className="glass-btn"
              style={{ padding: '5px 10px', fontSize: '0.78rem', borderRadius: '8px' }}
              title="Reset every curation decision to pending"
            >
              <RotateCcw size={14} /> Reset all
            </button>

            {onNextPair && (
              <button
                onClick={onNextPair}
                className="glass-btn glass-btn-primary"
                style={{ padding: '5px 12px', fontSize: '0.78rem', borderRadius: '8px' }}
                title="Next level pair"
              >
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>

        </div>
      </div>
      <CuratedExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </div>
  );
}
