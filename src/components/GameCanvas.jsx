import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sounds } from '../utils/audio';
import { logApp, auditDOMState } from '../utils/logger';
import { resolveAssetUrl } from '../utils/photoPairLevelLoader';
import { calculateSpeedPoints } from '../utils/scoring';

export default function GameCanvas({
  level,
  foundDiffs,
  onDiffFound,
  onMissTap,
  activeHintId,
  magnifierEnabled,
  elapsedTime = 0,
  revealAnswer = false,
  debugMode = false
}) {
  const canvasRefLeft = useRef(null);
  const canvasRefRight = useRef(null);
  const containerRefLeft = useRef(null);
  const containerRefRight = useRef(null);

  const [misses, setMisses] = useState([]);
  const [speedPopups, setSpeedPopups] = useState([]);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50, visible: false });
  const [canvasUrls, setCanvasUrls] = useState({ left: '', right: '' });
  const [cardAspectRatio, setCardAspectRatio] = useState('4 / 3');

  // Detect natural image aspect ratio to eliminate cropping and ensure 100% pixel-perfect coordinates
  useEffect(() => {
    if (level?.baseImage) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setCardAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
        }
      };
      img.src = resolveAssetUrl(level.baseImage);
    } else {
      setCardAspectRatio('4 / 3');
    }
  }, [level?.baseImage, level?.id]);

  // Pointer/Touch gesture tracking
  const pointerStartRef = useRef({ x: 0, y: 0, time: 0, isDrag: false });

  useEffect(() => {
    logApp('INFO', `[GameCanvasMounted] Level: ${level?.id} Title: ${level?.title}`);
    auditDOMState(`GameCanvasMounted_${level?.id || 'unknown'}`);
  }, [level?.id]);

  // When magnifier is enabled, ensure lens is immediately visible
  useEffect(() => {
    if (magnifierEnabled) {
      setCursorPos(prev => ({
        x: prev.x >= 0 ? prev.x : 50,
        y: prev.y >= 0 ? prev.y : 50,
        visible: true
      }));
    } else {
      setCursorPos(prev => ({ ...prev, visible: false }));
    }
  }, [magnifierEnabled]);

  const isPhoto = Boolean(level?.baseImage && !level.baseImage.startsWith('data:'));

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
      if (typeof level.render === 'function') {
        level.render(ctxLeft, width, height, false);
      }
    }

    // Draw Right (Modified)
    const ctxRight = canvasRefRight.current?.getContext('2d');
    if (ctxRight) {
      canvasRefRight.current.width = width;
      canvasRefRight.current.height = height;
      if (typeof level.render === 'function') {
        level.render(ctxRight, width, height, true);
      }
    }

    if (!isPhoto && magnifierEnabled) {
      try {
        const leftUrl = canvasRefLeft.current?.toDataURL('image/jpeg', 0.9);
        const rightUrl = canvasRefRight.current?.toDataURL('image/jpeg', 0.9);
        setCanvasUrls({ left: leftUrl || '', right: rightUrl || '' });
      } catch (e) {}
    }
  }, [level, isPhoto, magnifierEnabled]);

  useEffect(() => {
    drawCanvases();
    const t1 = setTimeout(() => {
      drawCanvases();
      auditDOMState('DrawCanvases_50ms');
    }, 50);
    const t2 = setTimeout(() => {
      drawCanvases();
      auditDOMState('DrawCanvases_150ms');
    }, 150);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [drawCanvases, level]);

  // Handle pointer down (touch/mouse start)
  const handlePointerDown = (e, containerRef) => {
    if (!containerRef.current || revealAnswer) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    pointerStartRef.current = {
      x: clientX,
      y: clientY,
      time: Date.now(),
      isDrag: false
    };

    if (magnifierEnabled) {
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      setCursorPos({ x, y, visible: true });
    }
  };

  // Handle mouse and touch dragging for synchronized magnifying lens
  const handlePointerMove = (e, containerRef) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const dx = clientX - pointerStartRef.current.x;
    const dy = clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 8) {
      pointerStartRef.current.isDrag = true;
    }

    if (magnifierEnabled) {
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      setCursorPos({ x, y, visible: true });
    }
  };

  // Handle pointer up (only intentional quick taps trigger guesses)
  const handlePointerUp = (e, containerRef) => {
    if (!containerRef.current || !level || revealAnswer) return;

    const start = pointerStartRef.current;
    const duration = Date.now() - start.time;

    const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY ?? e.changedTouches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickXPercent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const clickYPercent = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    if (magnifierEnabled) {
      setCursorPos({ x: clickXPercent, y: clickYPercent, visible: true });
    }

    // If dragging or long-pressing in Zoom mode: treat as pan inspection without penalty
    if (start.isDrag || duration > 400) {
      return;
    }

    // Check hit against level diffs (works on Original or Variant)
    let hitFound = false;

    level.diffs.forEach(diff => {
      if (foundDiffs.includes(diff.id)) return;

      const dX = clickXPercent - diff.x;
      const dY = clickYPercent - diff.y;
      const distance = Math.sqrt(dX * dX + dY * dY);

      if (distance <= diff.radius) {
        hitFound = true;
        sounds.playSuccess();

        const now = Date.now();
        const pointsEarned = calculateSpeedPoints(elapsedTime);
        const newPopup = {
          id: now + Math.random(),
          x: clickXPercent,
          y: clickYPercent,
          text: `+${pointsEarned} PTS`
        };
        setSpeedPopups(prev => [...prev, newPopup]);
        setTimeout(() => {
          setSpeedPopups(prev => prev.filter(p => p.id !== newPopup.id));
        }, 2200);

        onDiffFound(diff.id);
      }
    });

    if (!hitFound) {
      if (magnifierEnabled) {
        // In Zoom inspection mode: move lens safely without miss penalty
        sounds.playTap();
        return;
      }

      sounds.playError();
      onMissTap();

      // Show temporary miss red circle & floating -1 heart popup
      const missId = Date.now() + Math.random();
      const newMiss = { id: missId, x: clickXPercent, y: clickYPercent };
      setMisses(prev => [...prev, newMiss]);
      setTimeout(() => {
        setMisses(prev => prev.filter(m => m.id !== missId));
      }, 1800);
    }
  };

  const handleMouseLeave = () => {
    if (!magnifierEnabled) {
      setCursorPos(prev => ({ ...prev, visible: false }));
    }
  };

  const leftBgUrl = isPhoto ? resolveAssetUrl(level?.baseImage) : canvasUrls.left;
  const rightBgUrl = isPhoto ? resolveAssetUrl(level?.variantImage) : canvasUrls.right;

  return (
    <div style={{
      width: '100%',
      maxWidth: '1300px',
      margin: '0 auto',
      padding: '0 16px',
      boxSizing: 'border-box'
    }}>
      
      {/* Side-by-Side Canvas Viewport */}
      <div className="game-viewport">
        
        {/* Left Side: Original Image */}
        <div
          ref={containerRefLeft}
          className="canvas-card"
          style={{ aspectRatio: cardAspectRatio }}
          onPointerDown={(e) => handlePointerDown(e, containerRefLeft)}
          onPointerMove={(e) => handlePointerMove(e, containerRefLeft)}
          onPointerUp={(e) => handlePointerUp(e, containerRefLeft)}
          onPointerLeave={handleMouseLeave}
          onPointerCancel={handleMouseLeave}
        >
          <canvas ref={canvasRefLeft} className="canvas-element" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          {isPhoto && level?.baseImage && (
            <img
              key={`${level.id}-base`}
              src={resolveAssetUrl(level.baseImage)}
              alt={level.title || 'Original Scene'}
              className="canvas-element"
              draggable={false}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                zIndex: 1,
                borderRadius: 'inherit',
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none'
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
              />
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

          {/* Reveal Marker on Failure (Answer Spotlight before Fail Modal) */}
          {revealAnswer && level?.diffs?.map(diff => (
            <div
              key={`left-reveal-${diff.id}`}
              className="reveal-marker"
              style={{
                left: `${diff.x}%`,
                top: `${diff.y}%`,
                width: `${Math.max(54, (diff.radius || 10) * 3.8)}px`,
                height: `${Math.max(54, (diff.radius || 10) * 3.8)}px`
              }}
            />
          ))}

          {/* Temporary Miss Red Circle Markers & Floating -1 Heart Popups */}
          {misses.map(miss => (
            <React.Fragment key={`left-miss-group-${miss.id}`}>
              <div
                className="miss-marker"
                style={{ left: `${miss.x}%`, top: `${miss.y}%` }}
              >
                -1 ❤️
              </div>
            </React.Fragment>
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

          {/* Synchronized Magnifier Lens (Fixed above touch point, extends outside bounds at edges) */}
          {magnifierEnabled && cursorPos.visible && leftBgUrl && (
            <div
              className="magnifier-lens"
              style={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
                transform: 'translate(-50%, calc(-100% + 4px))',
                backgroundImage: `url(${leftBgUrl})`,
                backgroundPosition: `calc(77px - ${cursorPos.x * 7.7}px) calc(77px - ${cursorPos.y * 7.7}px)`,
                backgroundSize: '770px 770px',
                backgroundRepeat: 'no-repeat',
                zIndex: 40
              }}
            />
          )}
        </div>

        {/* Right Side: Modified Image */}
        <div
          ref={containerRefRight}
          className="canvas-card"
          style={{ aspectRatio: cardAspectRatio }}
          onPointerDown={(e) => handlePointerDown(e, containerRefRight)}
          onPointerMove={(e) => handlePointerMove(e, containerRefRight)}
          onPointerUp={(e) => handlePointerUp(e, containerRefRight)}
          onPointerLeave={handleMouseLeave}
          onPointerCancel={handleMouseLeave}
        >
          <canvas ref={canvasRefRight} className="canvas-element" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          {isPhoto && level?.variantImage && (
            <img
              key={`${level.id}-variant`}
              src={resolveAssetUrl(level.variantImage)}
              alt={level.title || 'Modified Scene'}
              className="canvas-element"
              draggable={false}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                zIndex: 1,
                borderRadius: 'inherit',
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none'
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
              />
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

          {/* Reveal Marker on Failure (Answer Spotlight before Fail Modal) */}
          {revealAnswer && level?.diffs?.map(diff => (
            <div
              key={`right-reveal-${diff.id}`}
              className="reveal-marker"
              style={{
                left: `${diff.x}%`,
                top: `${diff.y}%`,
                width: `${Math.max(54, (diff.radius || 10) * 3.8)}px`,
                height: `${Math.max(54, (diff.radius || 10) * 3.8)}px`
              }}
            />
          ))}

          {/* Temporary Miss Red Circle Markers & Floating -1 Heart Popups */}
          {misses.map(miss => (
            <React.Fragment key={`right-miss-group-${miss.id}`}>
              <div
                className="miss-marker"
                style={{ left: `${miss.x}%`, top: `${miss.y}%` }}
              >
                -1 ❤️
              </div>
            </React.Fragment>
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

          {/* Synchronized Magnifier Lens (Fixed above touch point, extends outside bounds at edges) */}
          {magnifierEnabled && cursorPos.visible && rightBgUrl && (
            <div
              className="magnifier-lens"
              style={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
                transform: 'translate(-50%, calc(-100% + 4px))',
                backgroundImage: `url(${rightBgUrl})`,
                backgroundPosition: `calc(77px - ${cursorPos.x * 7.7}px) calc(77px - ${cursorPos.y * 7.7}px)`,
                backgroundSize: '770px 770px',
                backgroundRepeat: 'no-repeat',
                zIndex: 40
              }}
            />
          )}
        </div>

      </div>
    </div>
  );
}
