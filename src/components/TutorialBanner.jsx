import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, Hand } from 'lucide-react';
import { sounds } from '../utils/audio';
import { resolveAssetUrl } from '../utils/photoPairLevelLoader';

// Dedicated tutorial photo pair (excluded from game rotation)
const DEMO_BASE_IMAGE = 'levels/photo-pairs/kitchen/easy_kitchen_001/base.jpg';
const DEMO_VARIANT_IMAGE = 'levels/photo-pairs/kitchen/easy_kitchen_001/variant.jpg';
const DEMO_TARGET = { x: 59.5, y: 55.5, radius: 9.0 };

export default function TutorialBanner() {
  const [isZoomed, setIsZoomed] = useState(false);
  const [showHand, setShowHand] = useState(false);
  const [handTapping, setHandTapping] = useState(false);
  const [foundSuccess, setFoundSuccess] = useState(false);

  // Auto-playing loop demonstration (runs every 5.4s)
  useEffect(() => {
    let t1, t2, t3, t4, t5, t6;

    const runLoop = () => {
      // 0. Full view start
      setIsZoomed(false);
      setShowHand(false);
      setHandTapping(false);
      setFoundSuccess(false);

      // 1. Hand appears
      t1 = setTimeout(() => {
        setShowHand(true);
        setHandTapping(false);
      }, 1000);

      // 2. Hand taps down
      t2 = setTimeout(() => {
        setHandTapping(true);
      }, 1350);

      // 3. Hand disappears right before zoom starts
      t3 = setTimeout(() => {
        setShowHand(false);
      }, 1550);

      // 4. Zoom in & show success indicator
      t4 = setTimeout(() => {
        setFoundSuccess(true);
        setIsZoomed(true);
      }, 1680);

      // 5. Zoom back out to full scene
      t5 = setTimeout(() => {
        setIsZoomed(false);
        setFoundSuccess(false);
      }, 4500);

      // 6. Repeat loop
      t6 = setTimeout(runLoop, 5400);
    };

    runLoop();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, []);

  const handleManualTap = () => {
    sounds.playSuccess();
    setFoundSuccess(true);
    setIsZoomed(true);
    setShowHand(false);
    setTimeout(() => {
      setIsZoomed(false);
      setFoundSuccess(false);
    }, 3000);
  };

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
        
        {/* Left / Center Hero: Deep Synchronized Zoom-In Demonstration */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: '1 1 420px',
          justifyContent: 'center'
        }}>
          
          {/* Card 1: Original Photo (Deep Zoom 3.8x on difference) */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '210px',
            aspectRatio: '16 / 10',
            borderRadius: '12px',
            overflow: 'hidden',
            border: isZoomed ? '1.5px solid rgba(0, 240, 255, 0.7)' : '1.5px solid rgba(255, 255, 255, 0.18)',
            background: '#0a0d16',
            boxShadow: isZoomed ? '0 0 18px rgba(0, 240, 255, 0.35)' : '0 4px 16px rgba(0,0,0,0.6)',
            transition: 'border-color 0.35s ease, box-shadow 0.35s ease'
          }}>
            <img
              src={resolveAssetUrl(DEMO_BASE_IMAGE)}
              alt="Original scene demo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                transformOrigin: `${DEMO_TARGET.x}% ${DEMO_TARGET.y}%`,
                transform: isZoomed ? 'scale(3.8)' : 'scale(1)',
                transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />

            {/* Magnified Target Comparison Ring in Original */}
            {isZoomed && (
              <div style={{
                position: 'absolute',
                left: `${DEMO_TARGET.x}%`,
                top: `${DEMO_TARGET.y}%`,
                transform: 'translate(-50%, -50%)',
                width: '106px',
                height: '106px',
                borderRadius: '50%',
                border: '3px dashed var(--accent-cyan)',
                boxShadow: '0 0 20px rgba(0, 240, 255, 0.7)',
                pointerEvents: 'none',
                animation: 'hitPulse 0.4s ease-out'
              }} />
            )}

          </div>

          <span style={{ fontSize: '0.95rem', color: 'var(--accent-cyan)', fontWeight: 900, userSelect: 'none' }}>
            VS
          </span>

          {/* Card 2: Modified Photo (Deep Zoom 3.8x + Hit Indicator) */}
          <div
            onClick={handleManualTap}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '210px',
              aspectRatio: '16 / 10',
              borderRadius: '12px',
              overflow: 'hidden',
              border: foundSuccess ? '1.5px solid var(--accent-green)' : '1.5px solid rgba(0, 240, 255, 0.45)',
              background: '#0a0d16',
              boxShadow: foundSuccess ? '0 0 22px rgba(0, 255, 135, 0.5)' : '0 4px 16px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              transition: 'all 0.35s ease'
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
                display: 'block',
                transformOrigin: `${DEMO_TARGET.x}% ${DEMO_TARGET.y}%`,
                transform: isZoomed ? 'scale(3.8)' : 'scale(1)',
                transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />

            {/* Glowing Difference Target Outline (Clean Hollow Ring) */}
            {foundSuccess && (
              <div style={{
                position: 'absolute',
                left: `${DEMO_TARGET.x}%`,
                top: `${DEMO_TARGET.y}%`,
                transform: 'translate(-50%, -50%)',
                width: '106px',
                height: '106px',
                borderRadius: '50%',
                border: '3.5px solid var(--accent-green)',
                boxShadow: '0 0 22px var(--accent-green)',
                background: 'transparent',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'hitPulse 0.35s ease-out',
                zIndex: 6
              }} />
            )}

            {/* Pointer Hand Flashing in Briefly During Tap and then Disappearing */}
            {showHand && (
              <div style={{
                position: 'absolute',
                left: `${DEMO_TARGET.x}%`,
                top: `${DEMO_TARGET.y}%`,
                transform: handTapping ? 'translate(-50%, -50%) scale(0.92)' : 'translate(-50%, -50%) scale(1.05)',
                color: '#fff',
                background: 'transparent',
                backgroundColor: 'transparent',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))',
                transition: 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.15s ease',
                pointerEvents: 'none',
                zIndex: 10,
                opacity: showHand ? 1 : 0
              }}>
                <Hand size={18} fill="var(--accent-gold)" color="#000" />
              </div>
            )}

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
              fontSize: '0.74rem',
              fontWeight: 800,
              color: 'var(--accent-gold)',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '0 9px',
              height: '28px',
              borderRadius: '7px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxSizing: 'border-box'
            }}>
              <Zap size={13} /> Faster = More Points
            </span>

            <span style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              color: 'var(--accent-pink)',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '0 9px',
              height: '28px',
              borderRadius: '7px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxSizing: 'border-box'
            }}>
              ❤️ 3 Lives
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
