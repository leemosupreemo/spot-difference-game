import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Zap, Hand } from 'lucide-react';
import { sounds } from '../utils/audio';
import { resolveAssetUrl } from '../utils/photoPairLevelLoader';

// Use actual real photographic image pair for demonstration
const DEMO_BASE_IMAGE = 'levels/photo-pairs/kitchen/easy_kitchen_001/base.jpg';
const DEMO_VARIANT_IMAGE = 'levels/photo-pairs/kitchen/easy_kitchen_001/variant.jpg';
const DEMO_TARGET = { x: 58.2, y: 54.4, radius: 9.5 };

export default function TutorialBanner() {
  const [step, setStep] = useState(0); // 0: idle, 1: tapping, 2: found, 3: reset
  const [interactiveFound, setInteractiveFound] = useState(false);

  // Auto-playing loop demonstration (runs every 4.5s)
  useEffect(() => {
    let timer1, timer2, timer3, timer4;

    const runLoop = () => {
      setStep(0);
      setInteractiveFound(false);

      timer1 = setTimeout(() => setStep(1), 1200); // Hand glides in
      timer2 = setTimeout(() => setStep(2), 1800); // Spot found + pulse
      timer3 = setTimeout(() => setStep(3), 3700); // Fade out
      timer4 = setTimeout(runLoop, 4400); // Repeat
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
        
        {/* Left / Center Hero: Real Photographic Side-by-Side Graphic Demonstration */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: '1 1 420px',
          justifyContent: 'center'
        }}>
          
          {/* Card 1: Actual Original Photo */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '210px',
            aspectRatio: '16 / 10',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1.5px solid rgba(255, 255, 255, 0.18)',
            background: '#0a0d16',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
          }}>
            <img
              src={resolveAssetUrl(DEMO_BASE_IMAGE)}
              alt="Original scene demo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            />

            <span style={{
              position: 'absolute',
              bottom: '5px',
              left: '6px',
              fontSize: '0.66rem',
              fontWeight: 900,
              color: 'rgba(255, 255, 255, 0.9)',
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

          {/* Card 2: Actual Modified Photo (Interactive Tap Target) */}
          <div
            onClick={handleManualTap}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '210px',
              aspectRatio: '16 / 10',
              borderRadius: '12px',
              overflow: 'hidden',
              border: isFound ? '1.5px solid var(--accent-green)' : '1.5px solid rgba(0, 240, 255, 0.45)',
              background: '#0a0d16',
              boxShadow: isFound ? '0 0 20px rgba(0, 255, 135, 0.45)' : '0 4px 16px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Tap the difference to try it!"
          >
            <img
              src={resolveAssetUrl(DEMO_VARIANT_IMAGE)}
              alt="Modified scene demo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            />

            {/* Glowing Difference Target Ripple & Checkmark */}
            {isFound && (
              <div style={{
                position: 'absolute',
                left: `${DEMO_TARGET.x}%`,
                top: `${DEMO_TARGET.y}%`,
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
                left: `${DEMO_TARGET.x}%`,
                top: `${DEMO_TARGET.y}%`,
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
            Compare both photos. <strong style={{ color: 'var(--accent-cyan)' }}>Tap the 1 difference</strong> as fast as you can!
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
