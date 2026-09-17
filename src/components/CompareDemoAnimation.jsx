import React, { useState, useEffect } from 'react';
import { Hand } from 'lucide-react';
import { sounds } from '../utils/audio';
import { resolveAssetUrl } from '../utils/photoPairLevelLoader';

// Dedicated tutorial photo pair (excluded from game rotation)
const DEMO_BASE_IMAGE = 'levels/photo-pairs/kitchen/easy_kitchen_001/base.jpg';
const DEMO_VARIANT_IMAGE = 'levels/photo-pairs/kitchen/easy_kitchen_001/variant.jpg';
const DEMO_TARGET = { x: 59.5, y: 55.5, radius: 9.9 };

export default function CompareDemoAnimation({ animationEnabled = true, isCompleted = false, compact = false }) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [showHand, setShowHand] = useState(false);
  const [handTapping, setHandTapping] = useState(false);
  const [foundSuccess, setFoundSuccess] = useState(false);

  // Auto-playing loop demonstration (runs every 5.4s)
  useEffect(() => {
    if (isCompleted || !animationEnabled) {
      setIsZoomed(false);
      setShowHand(false);
      setHandTapping(false);
      setFoundSuccess(false);
      return;
    }

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
  }, [isCompleted, animationEnabled]);

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

  const cardClassName = compact ? 'tutorial-card tutorial-card-compact' : 'tutorial-card';
  const handIconSize = compact ? 16 : 24;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: compact ? '8px' : '12px',
      width: '100%'
    }}>
      {/* Card 1: Original Photo (Deep Zoom 3.8x on difference) */}
      <div className={cardClassName} style={{
        border: isZoomed ? '1.5px solid rgba(0, 240, 255, 0.7)' : '1.5px solid rgba(255, 255, 255, 0.18)',
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
            width: '46%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            border: 'clamp(2.5px, 0.6vw, 4.5px) dashed var(--accent-cyan)',
            boxShadow: '0 0 24px rgba(0, 240, 255, 0.75)',
            pointerEvents: 'none',
            animation: 'hitPulse 0.4s ease-out'
          }} />
        )}
      </div>

      <span style={{ fontSize: compact ? '0.82rem' : '1.1rem', color: 'var(--accent-cyan)', fontWeight: 900, userSelect: 'none', padding: '0 4px' }}>
        VS
      </span>

      {/* Card 2: Modified Photo (Deep Zoom 3.8x + Hit Indicator) */}
      <div
        onClick={animationEnabled ? handleManualTap : undefined}
        className={cardClassName}
        style={{
          border: foundSuccess ? '2px solid var(--accent-green)' : '1.5px solid rgba(0, 240, 255, 0.45)',
          boxShadow: foundSuccess ? '0 0 22px rgba(0, 255, 135, 0.5)' : '0 4px 16px rgba(0,0,0,0.6)',
          cursor: animationEnabled ? 'pointer' : 'default'
        }}
        title={animationEnabled ? 'Tap the difference to try it!' : 'Tutorial animation paused'}
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
            width: '46%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            border: 'clamp(3px, 0.7vw, 5.5px) solid var(--accent-green)',
            boxShadow: '0 0 26px var(--accent-green), 0 0 45px rgba(0, 255, 135, 0.45)',
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
            <Hand className={compact ? '' : 'tutorial-hand-icon'} size={handIconSize} fill="var(--accent-gold)" color="#000" />
          </div>
        )}
      </div>
    </div>
  );
}
