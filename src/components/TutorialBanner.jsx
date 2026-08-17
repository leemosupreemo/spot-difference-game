import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Zap, Hand } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function TutorialBanner() {
  const [step, setStep] = useState(0); // 0: idle, 1: tapping, 2: found, 3: reset
  const [interactiveFound, setInteractiveFound] = useState(false);

  // Auto-playing loop demonstration (runs every 4.5s)
  useEffect(() => {
    let timer1, timer2, timer3, timer4;

    const runLoop = () => {
      setStep(0);
      setInteractiveFound(false);

      timer1 = setTimeout(() => setStep(1), 1200); // Hand moves in & taps
      timer2 = setTimeout(() => {
        setStep(2); // Spot found + pulse
      }, 1900);
      timer3 = setTimeout(() => setStep(3), 3800); // Fade out
      timer4 = setTimeout(runLoop, 4500); // Repeat
    };

    runLoop();

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  const handleManualTap = () => {
    sounds.playSuccess();
    setInteractiveFound(true);
    setStep(2);
    setTimeout(() => {
      setInteractiveFound(false);
    }, 2500);
  };

  const isFound = interactiveFound || step === 2;

  return (
    <div className="glass-panel" style={{
      padding: '12px 16px',
      borderRadius: '16px',
      marginBottom: '14px',
      background: 'linear-gradient(135deg, rgba(18, 22, 36, 0.85), rgba(9, 10, 16, 0.95))',
      border: '1px solid rgba(0, 240, 255, 0.25)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        
        {/* Left: Interactive Demo Graphic */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: '1 1 300px',
          justifyContent: 'center'
        }}>
          
          {/* Mini Image 1 (Left - Original) */}
          <div style={{
            position: 'relative',
            width: '130px',
            height: '92px',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1.5px solid rgba(255,255,255,0.15)',
            background: 'linear-gradient(135deg, #1e1b4b, #0f172a)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            {/* Visual SVG Scene: Desk with mug, pencil, notepad */}
            <svg viewBox="0 0 130 92" style={{ width: '100%', height: '100%', display: 'block' }}>
              <rect width="130" height="92" fill="#141828" />
              {/* Desk wood stripes */}
              <line x1="0" y1="46" x2="130" y2="46" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <line x1="0" y1="70" x2="130" y2="70" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              {/* Notepad */}
              <rect x="14" y="20" width="38" height="50" rx="3" fill="#f8fafc" opacity="0.9" />
              <line x1="20" y1="30" x2="44" y2="30" stroke="#94a3b8" strokeWidth="2" />
              <line x1="20" y1="40" x2="40" y2="40" stroke="#94a3b8" strokeWidth="2" />
              <line x1="20" y1="50" x2="44" y2="50" stroke="#94a3b8" strokeWidth="2" />
              {/* Coffee Cup (Teal in original) */}
              <circle cx="85" cy="46" r="16" fill="#00f0ff" />
              <circle cx="85" cy="46" r="12" fill="#0f172a" />
              {/* Coffee Cup Handle */}
              <path d="M 101 40 C 108 40, 108 52, 101 52" fill="none" stroke="#00f0ff" strokeWidth="3" />
              {/* Pencil */}
              <line x1="62" y1="20" x2="62" y2="70" stroke="#ffb703" strokeWidth="4" strokeLinecap="round" />
            </svg>

            <span style={{
              position: 'absolute',
              bottom: '4px',
              left: '6px',
              fontSize: '0.62rem',
              fontWeight: 900,
              color: 'var(--text-muted)',
              background: 'rgba(0,0,0,0.6)',
              padding: '1px 6px',
              borderRadius: '4px',
              letterSpacing: '0.4px'
            }}>
              ORIGINAL
            </span>
          </div>

          <span style={{ fontSize: '1rem', color: 'var(--accent-cyan)', fontWeight: 900 }}>VS</span>

          {/* Mini Image 2 (Right - Modified with Difference) */}
          <div
            onClick={handleManualTap}
            style={{
              position: 'relative',
              width: '130px',
              height: '92px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: isFound ? '1.5px solid var(--accent-green)' : '1.5px solid rgba(0, 240, 255, 0.4)',
              background: 'linear-gradient(135deg, #1e1b4b, #0f172a)',
              boxShadow: isFound ? '0 0 15px rgba(0, 255, 135, 0.4)' : '0 4px 12px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              transition: 'border-color 0.2s ease'
            }}
            title="Tap the difference to try it!"
          >
            {/* Visual SVG Scene: Coffee cup recolored to Pink difference! */}
            <svg viewBox="0 0 130 92" style={{ width: '100%', height: '100%', display: 'block' }}>
              <rect width="130" height="92" fill="#141828" />
              <line x1="0" y1="46" x2="130" y2="46" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <line x1="0" y1="70" x2="130" y2="70" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              {/* Notepad */}
              <rect x="14" y="20" width="38" height="50" rx="3" fill="#f8fafc" opacity="0.9" />
              <line x1="20" y1="30" x2="44" y2="30" stroke="#94a3b8" strokeWidth="2" />
              <line x1="20" y1="40" x2="40" y2="40" stroke="#94a3b8" strokeWidth="2" />
              <line x1="20" y1="50" x2="44" y2="50" stroke="#94a3b8" strokeWidth="2" />
              
              {/* THE DIFFERENCE: Coffee Cup recolored to Neon Pink (#ff007f)! */}
              <circle cx="85" cy="46" r="16" fill="#ff007f" />
              <circle cx="85" cy="46" r="12" fill="#0f172a" />
              <path d="M 101 40 C 108 40, 108 52, 101 52" fill="none" stroke="#ff007f" strokeWidth="3" />

              {/* Pencil */}
              <line x1="62" y1="20" x2="62" y2="70" stroke="#ffb703" strokeWidth="4" strokeLinecap="round" />
            </svg>

            {/* Difference Highlight Ripple / Hit Marker when found */}
            {isFound && (
              <div style={{
                position: 'absolute',
                left: '65%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: '2.5px solid var(--accent-green)',
                boxShadow: '0 0 15px var(--accent-green), inset 0 0 10px var(--accent-green)',
                background: 'rgba(0, 255, 135, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'hitPulse 0.4s ease-out'
              }}>
                <CheckCircle2 size={16} color="#fff" strokeWidth={3} />
              </div>
            )}

            {/* Animated Pointer Hand Gliding in and Tapping */}
            {!interactiveFound && (step === 1 || step === 2) && (
              <div style={{
                position: 'absolute',
                left: '65%',
                top: '50%',
                transform: step === 1 ? 'translate(-30%, -30%) scale(1.1)' : 'translate(-50%, -50%) scale(0.95)',
                color: '#fff',
                filter: 'drop-shadow(0 0 8px #000)',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                pointerEvents: 'none',
                zIndex: 10
              }}>
                <Hand size={22} fill="var(--accent-gold)" color="#000" />
              </div>
            )}

            <span style={{
              position: 'absolute',
              bottom: '4px',
              left: '6px',
              fontSize: '0.62rem',
              fontWeight: 900,
              color: 'var(--accent-pink)',
              background: 'rgba(0,0,0,0.6)',
              padding: '1px 6px',
              borderRadius: '4px',
              letterSpacing: '0.4px'
            }}>
              MODIFIED (DIFFERENCE!)
            </span>
          </div>

        </div>

        {/* Right: Explanatory Copy & Quick Tips */}
        <div style={{ flex: '2 1 280px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Sparkles size={16} color="var(--accent-gold)" />
            <h4 style={{ fontSize: '0.92rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.3px' }}>
              HOW IT WORKS: SPOT & TAP THE 1 DIFFERENCE
            </h4>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 8px 0' }}>
            Compare both images side-by-side. Spot the subtle change (recolored cup above), and <strong style={{ color: 'var(--accent-cyan)' }}>tap that location on either image</strong> to lock it in!
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--accent-gold)',
              background: 'rgba(255, 183, 3, 0.12)',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 183, 3, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Zap size={12} /> Faster Tap = Higher Score
            </span>

            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--accent-pink)',
              background: 'rgba(255, 0, 127, 0.12)',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 0, 127, 0.3)'
            }}>
              ❤️ 3 Lives per Stage
            </span>

            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--accent-green)',
              background: 'rgba(0, 255, 135, 0.12)',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(0, 255, 135, 0.3)'
            }}>
              🎯 5 Pairs to Clear
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
