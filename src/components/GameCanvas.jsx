import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sounds } from '../utils/audio';
import { Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { logApp, auditDOMState } from '../utils/logger';
import { resolveAssetUrl } from '../utils/photoPairLevelLoader';

export default function GameCanvas({
  level,
  foundDiffs,
  onDiffFound,
  onMissTap,
  activeHintId,
  magnifierEnabled,
  debugMode = false
}) {
  const canvasRefLeft = useRef(null);
  const canvasRefRight = useRef(null);
  const containerRefLeft = useRef(null);
  const containerRefRight = useRef(null);

  const [misses, setMisses] = useState([]);
  const [speedPopups, setSpeedPopups] = useState([]);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100, visible: false });

  useEffect(() => {
    logApp('INFO', `[GameCanvasMounted] Level: ${level?.id} Title: ${level?.title}`);
    auditDOMState(`GameCanvasMounted_${level?.id || 'unknown'}`);
  }, [level?.id]);

  // Render original and modified canvases
  const drawCanvases = useCallback(() => {
    if (!level) return;
    const width = 800;
    const height = 600;

    // Draw Left (Original)
    const ctxLeft = canvasRefLeft.current?.getContext('2d');
    if (ctxLeft) {
      canvasRefLeft.current.width = width;
      canvasRefLeft.current.height = height;
      level.render(ctxLeft, width, height, false);
    }

    // Draw Right (Modified)
    const ctxRight = canvasRefRight.current?.getContext('2d');
    if (ctxRight) {
      canvasRefRight.current.width = width;
      canvasRefRight.current.height = height;
      level.render(ctxRight, width, height, true);
    }
  }, [level]);

  useEffect(() => {
    drawCanvases();
    const t1 = setTimeout(() => {
      drawCanvases();
      auditDOMState('DrawCanvases_50ms');
    }, 50);
    const t2 = setTimeout(() => {
      drawCanvases();
      auditDOMState('DrawCanvases_200ms');
    }, 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [drawCanvases, level]);

  const lastTapTimeRef = useRef(0);

  // Handle click or touch on EITHER canvas (Original or Variant)
  const handleCanvasTap = (e, containerRef) => {
    if (!containerRef.current || !level) return;

    const now = Date.now();
    if (now - lastTapTimeRef.current < 250) {
      return; // Ignore duplicate synthetic touch/click within 250ms
    }
    lastTapTimeRef.current = now;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY ?? e.changedTouches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const clickXPercent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const clickYPercent = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    // Check hit against level diffs (works on Original or Variant)
    let hitFound = false;

    level.diffs.forEach(diff => {
      if (foundDiffs.includes(diff.id)) return; // Already found

      const dx = clickXPercent - diff.x;
      const dy = clickYPercent - diff.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= diff.radius) {
        hitFound = true;
        sounds.playSuccess();

        // Speed bonus calculation
        const now = Date.now();
        const bonusAmount = 300;
        const newPopup = {
          id: now + Math.random(),
          x: clickXPercent,
          y: clickYPercent,
          text: `+${bonusAmount} PTS`
        };
        setSpeedPopups(prev => [...prev, newPopup]);
        setTimeout(() => {
          setSpeedPopups(prev => prev.filter(p => p.id !== newPopup.id));
        }, 1000);

        onDiffFound(diff.id);
      }
    });

    if (!hitFound) {
      sounds.playError();
      onMissTap();

      // Show temporary miss marker
      const missId = Date.now() + Math.random();
      const newMiss = { id: missId, x: clickXPercent, y: clickYPercent };
      setMisses(prev => [...prev, newMiss]);
      setTimeout(() => {
        setMisses(prev => prev.filter(m => m.id !== missId));
      }, 500);
    }
  };

  // Handle mouse and touch dragging for synchronized magnifying lens
  const handlePointerMove = (e, containerRef) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    setCursorPos({ x, y, visible: true });
  };

  const handleMouseLeave = () => {
    setCursorPos(prev => ({ ...prev, visible: false }));
  };

  const leftBgUrl = level?.baseImage
    ? resolveAssetUrl(level.baseImage)
    : canvasRefLeft.current?.toDataURL();

  const rightBgUrl = level?.variantImage
    ? resolveAssetUrl(level.variantImage)
    : canvasRefRight.current?.toDataURL();

  return (
    <div style={{ width: '100%' }}>
      
      {/* Side-by-Side Canvas Viewport */}
      <div className="game-viewport">
        
        {/* Left Side: Original Image */}
        <div
          ref={containerRefLeft}
          className="canvas-card"
          onClick={(e) => handleCanvasTap(e, containerRefLeft)}
          onTouchEnd={(e) => {
            handleCanvasTap(e, containerRefLeft);
          }}
          onMouseMove={(e) => handlePointerMove(e, containerRefLeft)}
          onTouchMove={(e) => handlePointerMove(e, containerRefLeft)}
          onMouseLeave={handleMouseLeave}
          onTouchCancel={handleMouseLeave}
        >
          <canvas ref={canvasRefLeft} className="canvas-element" />
          {level?.baseImage && (
            <img
              src={resolveAssetUrl(level.baseImage)}
              alt={level.title || 'Original Scene'}
              className="canvas-element"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 1,
                borderRadius: 'inherit'
              }}
            />
          )}

          {/* Render Found Differences Markers */}
          {level.diffs.map(diff => {
            if (!foundDiffs.includes(diff.id)) return null;
            return (
              <div
                key={`left-hit-${diff.id}`}
                className="hit-marker"
                style={{ left: `${diff.x}%`, top: `${diff.y}%` }}
              >
                <span className="hit-marker-number">{diff.id}</span>
              </div>
            );
          })}

          {/* Hint Radar Overlay (Exact Difference Pinpoint - ONLY WHEN HINT BUTTON TAPPED) */}
          {activeHintId && level?.diffs?.map(diff => {
            if (foundDiffs.includes(diff.id) || activeHintId !== diff.id) return null;
            return (
              <div
                key={`left-hint-radar-${diff.id}`}
                className="hint-radar"
                style={{
                  left: `${diff.x}%`,
                  top: `${diff.y}%`,
                  zIndex: 8
                }}
              />
            );
          })}

          {/* Temporary Miss Markers */}
          {misses.map(miss => (
            <div
              key={`left-miss-${miss.id}`}
              className="miss-marker"
              style={{ left: `${miss.x}%`, top: `${miss.y}%` }}
            />
          ))}

          {/* Speed Bonus Floating Popups */}
          {speedPopups.map(popup => (
            <div
              key={`left-pop-${popup.id}`}
              className="speed-popup"
              style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
            >
              {popup.text}
            </div>
          ))}

          {/* Synchronized Magnifier Lens */}
          {magnifierEnabled && cursorPos.visible && (
            <div
              className="magnifier-lens"
              style={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
                backgroundImage: `url(${leftBgUrl})`,
                backgroundPosition: `${cursorPos.x}% ${cursorPos.y}%`,
                backgroundSize: '250%',
                zIndex: 10
              }}
            />
          )}
        </div>

        {/* Right Side: Modified Image */}
        <div
          ref={containerRefRight}
          className="canvas-card"
          onClick={(e) => handleCanvasTap(e, containerRefRight)}
          onTouchEnd={(e) => {
            handleCanvasTap(e, containerRefRight);
          }}
          onMouseMove={(e) => handlePointerMove(e, containerRefRight)}
          onTouchMove={(e) => handlePointerMove(e, containerRefRight)}
          onMouseLeave={handleMouseLeave}
          onTouchCancel={handleMouseLeave}
        >
          <canvas ref={canvasRefRight} className="canvas-element" />
          {level?.variantImage && (
            <img
              src={resolveAssetUrl(level.variantImage)}
              alt={level.title || 'Modified Scene'}
              className="canvas-element"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 1,
                borderRadius: 'inherit'
              }}
            />
          )}

          {/* Render Found Differences Markers */}
          {level.diffs.map(diff => {
            if (!foundDiffs.includes(diff.id)) return null;
            return (
              <div
                key={`right-hit-${diff.id}`}
                className="hit-marker"
                style={{ left: `${diff.x}%`, top: `${diff.y}%` }}
              >
                <span className="hit-marker-number">{diff.id}</span>
              </div>
            );
          })}

          {/* Hint Radar Overlay (Exact Difference Pinpoint - ONLY WHEN HINT BUTTON TAPPED) */}
          {activeHintId && level?.diffs?.map(diff => {
            if (foundDiffs.includes(diff.id) || activeHintId !== diff.id) return null;
            return (
              <div
                key={`right-hint-radar-${diff.id}`}
                className="hint-radar"
                style={{
                  left: `${diff.x}%`,
                  top: `${diff.y}%`,
                  zIndex: 8
                }}
              />
            );
          })}

          {/* Temporary Miss Markers */}
          {misses.map(miss => (
            <div
              key={`right-miss-${miss.id}`}
              className="miss-marker"
              style={{ left: `${miss.x}%`, top: `${miss.y}%` }}
            />
          ))}

          {/* Speed Bonus Floating Popups */}
          {speedPopups.map(popup => (
            <div
              key={`right-pop-${popup.id}`}
              className="speed-popup"
              style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
            >
              {popup.text}
            </div>
          ))}

          {/* Synchronized Magnifier Lens */}
          {magnifierEnabled && cursorPos.visible && (
            <div
              className="magnifier-lens"
              style={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
                backgroundImage: `url(${rightBgUrl})`,
                backgroundPosition: `${cursorPos.x}% ${cursorPos.y}%`,
                backgroundSize: '250%',
                zIndex: 10
              }}
            />
          )}
        </div>

      </div>
    </div>
  );
}
