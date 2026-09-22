import React, { useMemo, useState, useEffect, useRef } from 'react';
import { RotateCcw, Skull, X, ArrowRight } from 'lucide-react';
import { sounds } from '../utils/audio';
import { getSetNumber } from '../utils/setLeaderboards.js';
import { formatSetLabel } from '../utils/remoteSetPolicy.js';
import { getAttemptedSetIds } from '../utils/setAttemptTracker.js';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';

export default function GameOverModal({
  isOpen,
  onClose,
  onRestart,
  onNextLevel,
  onNextStage,
  elapsedTime,
  levelTitle,
  setId = null,
  themeId = 'find_the_sniper',
  isFirstAttempt = false,
  difficultyStats = null,
  attemptedSets = null
}) {
  if (!isOpen) return null;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setIsDropdownOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleOutsideInteraction = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideInteraction, true);
    document.addEventListener('touchstart', handleOutsideInteraction, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction, true);
      document.removeEventListener('touchstart', handleOutsideInteraction, true);
    };
  }, [isDropdownOpen]);

  const handleSelectSet = (targetSetId, event) => {
    if (event) {
      event.stopPropagation();
    }
    sounds.playTap();
    setIsDropdownOpen(false);
    onRestart?.(targetSetId);
  };

  const seconds = (elapsedTime / 1000).toFixed(2);
  const isAbstract = themeId === 'abstract_animated';
  const stageNumber = getSetNumber(setId);

  const attemptedList = useMemo(() => {
    let list;
    if (Array.isArray(attemptedSets) && attemptedSets.length > 0) {
      const others = attemptedSets.filter(id => id !== setId);
      list = setId ? [setId, ...others] : attemptedSets;
    } else {
      list = getAttemptedSetIds(difficultyStats, setId);
    }
    if ((!list || list.length === 0) && setId) {
      return [setId];
    }
    return list || [];
  }, [attemptedSets, difficultyStats, setId]);

  return (
    <div
      data-testid="game-over-backdrop"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-panel modal-split-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '94%',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: isDropdownOpen ? 'visible' : 'auto',
          padding: '20px 18px',
          boxSizing: 'border-box',
          textAlign: 'center',
          border: '2px solid var(--accent-pink)',
          boxShadow: '0 0 40px rgba(255, 0, 127, 0.45)',
          borderRadius: '20px',
          position: 'relative',
          zIndex: 20,
          '--modal-accent': 'var(--accent-pink)'
        }}
      >
        <ModalAmbientParticles />

        {/* Top Left Redo / Repeat Button with Attempted Sets Dropdown (Photography only; dynamic abstract mode has no set repeat) */}
        {!isAbstract && (
          <div ref={dropdownRef} style={{ position: 'absolute', top: 12, left: 12, zIndex: 110 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                sounds.playTap();
                setIsDropdownOpen(prev => !prev);
              }}
              style={{
                background: isDropdownOpen
                  ? 'var(--accent-cyan)'
                  : 'linear-gradient(135deg, rgba(0, 240, 255, 0.22), rgba(0, 140, 255, 0.12))',
                border: '1.5px solid var(--accent-cyan)',
                color: isDropdownOpen ? '#050714' : 'var(--accent-cyan)',
                borderRadius: '12px',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: isDropdownOpen
                  ? '0 0 20px rgba(0, 240, 255, 0.7)'
                  : '0 0 14px rgba(0, 240, 255, 0.4)',
                transition: 'all 0.18s ease',
                touchAction: 'manipulation'
              }}
              title="Repeat Set"
              aria-label="Repeat Set"
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
            >
              <RotateCcw size={18} strokeWidth={2.4} color={isDropdownOpen ? '#050714' : 'var(--accent-cyan)'} />
            </button>

            {/* Dropdown Menu of Attempted Sets */}
            {isDropdownOpen && (
              <div
                className="glass-panel"
                role="listbox"
                aria-label="Attempted Sets to Repeat"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '44px',
                  left: 0,
                  background: 'rgba(10, 14, 28, 0.98)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1.5px solid var(--accent-cyan)',
                  borderRadius: '14px',
                  padding: '8px',
                  width: 'max-content',
                  minWidth: '210px',
                  maxWidth: '280px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.85), 0 0 20px rgba(0, 240, 255, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  textAlign: 'left',
                  zIndex: 120
                }}
              >
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  color: 'var(--accent-cyan)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  padding: '2px 6px 4px 6px',
                  borderBottom: '1px solid rgba(0, 240, 255, 0.15)',
                  marginBottom: '2px',
                  userSelect: 'none'
                }}>
                  Choose Set to Repeat
                </div>

                {attemptedList.map((targetSetId, idx) => {
                  const isFailedSet = targetSetId === setId || (idx === 0 && Boolean(setId));
                  const label = isAbstract && targetSetId === setId
                    ? (levelTitle || 'Abstract Stage')
                    : formatSetLabel(targetSetId);

                  return (
                    <button
                      key={targetSetId || idx}
                      type="button"
                      onClick={(e) => handleSelectSet(targetSetId, e)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: isFailedSet
                          ? 'linear-gradient(90deg, rgba(255, 0, 127, 0.28), rgba(255, 0, 127, 0.12))'
                          : 'rgba(255, 255, 255, 0.05)',
                        border: isFailedSet
                          ? '1.5px solid var(--accent-pink)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isFailedSet ? '#fff' : 'var(--text-main, #eee)',
                        fontWeight: isFailedSet ? 900 : 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: isFailedSet ? '0 0 10px rgba(255, 0, 127, 0.35)' : 'none',
                        transition: 'background 0.15s ease, transform 0.1s ease',
                        gap: '8px',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'rgba(0, 240, 255, 0.2)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isFailedSet) {
                          e.currentTarget.style.background = 'rgba(0, 240, 255, 0.15)';
                          e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isFailedSet) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <RotateCcw
                          size={13}
                          color={isFailedSet ? 'var(--accent-pink)' : 'var(--accent-cyan)'}
                          style={{ flexShrink: 0 }}
                        />
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {label}
                        </span>
                      </div>

                      {isFailedSet && (
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          letterSpacing: '0.4px',
                          background: 'var(--accent-pink)',
                          color: '#000',
                          borderRadius: '6px',
                          padding: '2px 5px',
                          flexShrink: 0
                        }}>
                          FAILED
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
            cursor: 'pointer',
            zIndex: 10
          }}
          title="Return to Main Menu"
        >
          <X size={18} />
        </button>

        {/* Skull Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-pink), #8a004f)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto',
          boxShadow: '0 0 24px var(--accent-pink)'
        }}>
          <Skull size={28} color="#000" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '8px', color: 'var(--accent-pink)', letterSpacing: '0.5px' }}>
          STAGE FAILED
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: isFirstAttempt ? '8px' : '16px', fontWeight: 600 }}>
          {isAbstract ? levelTitle : `Stage #${stageNumber}`}
        </p>

        {isFirstAttempt && (
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--accent-pink)',
            background: 'rgba(255, 0, 127, 0.1)',
            border: '1px solid rgba(255, 0, 127, 0.35)',
            borderRadius: '10px',
            padding: '7px 12px',
            marginBottom: '16px',
            letterSpacing: '0.3px'
          }}>
            1st Attempt marked as 'Failed' in records
          </div>
        )}

        {/* Performance Breakdown */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--modal-gap-md)',
          background: 'rgba(0,0,0,0.45)',
          padding: '14px 16px',
          borderRadius: '16px',
          marginBottom: '20px',
          textAlign: 'left',
          border: '1px solid var(--border-glass)'
        }}>
          <div style={{ padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              TIME REACHED
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)' }}>
              {seconds}s
            </span>
          </div>

          <div style={{ padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              LIVES REMAINING
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent-pink)', fontFamily: 'var(--font-mono)' }}>
              0 / 3 ❤️
            </span>
          </div>
        </div>

        {/* Navigation Buttons (exact same as Set Complete modal) */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', width: '100%' }}>
          <button
            className="glass-btn"
            onClick={() => { sounds.playTap(); onClose(); }}
            title="Back to Menu"
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
            onClick={() => {
              sounds.playTap();
              const handleNext = onNextStage || onNextLevel || onRestart;
              handleNext?.();
            }}
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
  );
}

