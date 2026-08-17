import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Zap, Hand } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function TutorialBanner() {
  const [step, setStep] = useState(0); // 0: idle, 1: tapping, 2: found, 3: reset
  const [interactiveFound, setInteractiveFound] = useState(false);

  // Auto-playing loop demonstration (runs every 4.2s)
  useEffect(() => {
    let timer1, timer2, timer3, timer4;

    const runLoop = () => {
      setStep(0);
      setInteractiveFound(false);

      timer1 = setTimeout(() => setStep(1), 1100); // Hand glides in
      timer2 = setTimeout(() => setStep(2), 1700); // Spot found + pulse
      timer3 = setTimeout(() => setStep(3), 3600); // Fade out
      timer4 = setTimeout(runLoop, 4200); // Repeat
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
      padding: '14px 16px',
      borderRadius: '18px',
      marginBottom: '14px',
      background: 'linear-gradient(135deg, rgba(16, 20, 32, 0.9), rgba(8, 10, 16, 0.98))',
      border: '1px solid rgba(0, 240, 255, 0.3)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        
        {/* Left / Center Hero: Large & Wide Side-by-Side Graphic Demonstration */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: '1 1 420px',
          justifyContent: 'center'
        }}>
          
          {/* Card 1: Original Image */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '205px',
            aspectRatio: '16 / 10',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1.5px solid rgba(255, 255, 255, 0.16)',
            background: 'linear-gradient(135deg, #151928, #0a0d16)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
          }}>
            {/* Visual SVG Scene: Cozy Desk & Workspace Clutter */}
            <svg viewBox="0 0 200 125" style={{ width: '100%', height: '100%', display: 'block' }}>
              <rect width="200" height="125" fill="#111420" />
              {/* Background desk gradient and texture lines */}
              <line x1="0" y1="62" x2="200" y2="62" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <line x1="0" y1="95" x2="200" y2="95" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              
              {/* Notepad on left */}
              <rect x="20" y="24" width="55" height="76" rx="4" fill="#f1f5f9" opacity="0.9" />
              <line x1="28" y1="40" x2="65" y2="40" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="28" y1="54" x2="58" y2="54" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="28" y1="68" x2="65" y2="68" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="28" y1="82" x2="50" y2="82" stroke="#94a3b8" strokeWidth="2.5" />
              
              {/* Golden Brass Compass on desk */}
              <circle cx="102" cy="74" r="18" fill="none" stroke="#ffb703" strokeWidth="3" />
              <line x1="102" y1="60" x2="102" y2="88" stroke="#ffb703" strokeWidth="2" />
              <line x1="88" y1="74" x2="116" y2="74" stroke="#ffb703" strokeWidth="2" />
              <circle cx="102" cy="74" r="3" fill="#ffb703" />

              {/* Coffee Mug on right (Cyan in Original) */}
              <circle cx="152" cy="62" r="22" fill="#00f0ff" />
              <circle cx="152" cy="62" r="17" fill="#0c101c" />
              <path d="M 174 53 C 185 53, 185 71, 174 71" fill="none" stroke="#00f0ff" strokeWidth="3.5" strokeLinecap="round" />
            </svg>

            <span style={{
              position: 'absolute',
              bottom: '5px',
              left: '6px',
              fontSize: '0.66rem',
              fontWeight: 900,
              color: 'rgba(255, 255, 255, 0.7)',
              background: 'rgba(0,0,0,0.7)',
              padding: '2px 7px',
              borderRadius: '5px',
              letterSpacing: '0.5px'
            }}>
              ORIGINAL
            </span>
          </div>

          <span style={{ fontSize: '0.95rem', color: 'var(--accent-cyan)', fontWeight: 900, userSelect: 'none' }}>
            VS
          </span>

          {/* Card 2: Modified Image (Interactive Tap Target) */}
          <div
            onClick={handleManualTap}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '205px',
              aspectRatio: '16 / 10',
              borderRadius: '12px',
              overflow: 'hidden',
              border: isFound ? '1.5px solid var(--accent-green)' : '1.5px solid rgba(0, 240, 255, 0.45)',
              background: 'linear-gradient(135deg, #151928, #0a0d16)',
              boxShadow: isFound ? '0 0 20px rgba(0, 255, 135, 0.4)' : '0 4px 16px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Tap the difference to try it!"
          >
            {/* Visual SVG Scene: Difference on Coffee Mug (Pink recolor) */}
            <svg viewBox="0 0 200 125" style={{ width: '100%', height: '100%', display: 'block' }}>
              <rect width="200" height="125" fill="#111420" />
              <line x1="0" y1="62" x2="200" y2="62" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <line x1="0" y1="95" x2="200" y2="95" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              
              {/* Notepad on left */}
              <rect x="20" y="24" width="55" height="76" rx="4" fill="#f1f5f9" opacity="0.9" />
              <line x1="28" y1="40" x2="65" y2="40" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="28" y1="54" x2="58" y2="54" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="28" y1="68" x2="65" y2="68" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="28" y1="82" x2="50" y2="82" stroke="#94a3b8" strokeWidth="2.5" />
              
              {/* Golden Brass Compass on desk */}
              <circle cx="102" cy="74" r="18" fill="none" stroke="#ffb703" strokeWidth="3" />
              <line x1="102" y1="60" x2="102" y2="88" stroke="#ffb703" strokeWidth="2" />
              <line x1="88" y1="74" x2="116" y2="74" stroke="#ffb703" strokeWidth="2" />
              <circle cx="102" cy="74" r="3" fill="#ffb703" />

              {/* THE DIFFERENCE: Coffee Mug recolored to Neon Pink (#ff007f)! */}
              <circle cx="152" cy="62" r="22" fill="#ff007f" />
              <circle cx="152" cy="62" r="17" fill="#0c101c" />
              <path d="M 174 53 C 185 53, 185 71, 174 71" fill="none" stroke="#ff007f" strokeWidth="3.5" strokeLinecap="round" />
            </svg>

            {/* Glowing Difference Target Ripple & Checkmark */}
            {isFound && (
              <div style={{
                position: 'absolute',
                left: '76%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                border: '3px solid var(--accent-green)',
                boxShadow: '0 0 20px var(--accent-green), inset 0 0 12px var(--accent-green)',
                background: 'rgba(0, 255, 135, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'hitPulse 0.35s ease-out'
              }}>
                <CheckCircle2 size={20} color="#fff" strokeWidth={3} />
              </div>
            )}

            {/* Animated Pointer Hand Gliding in and Tapping */}
            {!interactiveFound && (step === 1 || step === 2) && (
              <div style={{
                position: 'absolute',
                left: '76%',
                top: '50%',
                transform: step === 1 ? 'translate(-25%, -25%) scale(1.15)' : 'translate(-50%, -50%) scale(0.95)',
                color: '#fff',
                filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.9))',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                pointerEvents: 'none',
                zIndex: 10
              }}>
                <Hand size={26} fill="var(--accent-gold)" color="#000" />
              </div>
            )}

            <span style={{
              position: 'absolute',
              bottom: '5px',
              left: '6px',
              fontSize: '0.66rem',
              fontWeight: 900,
              color: 'var(--accent-pink)',
              background: 'rgba(0,0,0,0.7)',
              padding: '2px 7px',
              borderRadius: '5px',
              letterSpacing: '0.5px'
            }}>
              MODIFIED (DIFFERENCE!)
            </span>
          </div>

        </div>

        {/* Right Side: Simple, Compact Text & Badges */}
        <div style={{
          flex: '0 1 250px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="var(--accent-gold)" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.4px' }}>
              SPOT & TAP
            </h4>
          </div>

          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.35, margin: 0 }}>
            Compare both images. <strong style={{ color: 'var(--accent-cyan)' }}>Tap the 1 difference</strong> as fast as you can!
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
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
              <Zap size={12} /> Faster = More Points
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
              ❤️ 3 Lives
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
