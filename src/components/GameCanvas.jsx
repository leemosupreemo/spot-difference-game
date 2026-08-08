import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sounds } from '../utils/audio';
import { Search, CheckCircle2, AlertCircle } from 'lucide-react';

export default function GameCanvas({
  level,
  foundDiffs,
  onDiffFound,
  onMissTap,
  activeHintId,
  magnifierEnabled
}) {
  const canvasRefLeft = useRef(null);
  const canvasRefRight = useRef(null);
  const containerRefLeft = useRef(null);
  const containerRefRight = useRef(null);

  const [misses, setMisses] = useState([]);
  const [speedPopups, setSpeedPopups] = useState([]);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100, visible: false });

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
  }, [drawCanvases]);

  // Handle click on either canvas
  const handleCanvasClick = (e, containerRef) => {
    if (!containerRef.current || !level) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickXPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const clickYPercent = ((e.clientY - rect.top) / rect.height) * 100;

    // Check hit against level diffs
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

  // Mouse move for synchronized magnifier lens
  const handleMouseMove = (e, containerRef) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      setCursorPos({ x, y, visible: true });
    } else {
      setCursorPos(prev => ({ ...prev, visible: false }));
    }
  };

  const handleMouseLeave = () => {
    setCursorPos(prev => ({ ...prev, visible: false }));
  };

  return (
    <div style={{ width: '100%' }}>
      
      {/* Side-by-Side Canvas Viewport */}
      <div className="game-viewport">
        
        {/* Left Side: Original Image */}
        <div
          ref={containerRefLeft}
          className="canvas-card"
          onClick={(e) => handleCanvasClick(e, containerRefLeft)}
          onMouseMove={(e) => handleMouseMove(e, containerRefLeft)}
          onMouseLeave={handleMouseLeave}
        >
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 5,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem',
            fontWeight: 700, letterSpacing: '0.5px', color: 'var(--accent-cyan)',
            border: '1px solid rgba(0, 240, 255, 0.3)'
          }}>
            ORIGINAL
          </div>

          <canvas ref={canvasRefLeft} className="canvas-element" />

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

          {/* Hint Radar Overlay */}
          {activeHintId && (
            <div
              className="hint-radar"
              style={{
                left: `${level.diffs.find(d => d.id === activeHintId)?.x}%`,
                top: `${level.diffs.find(d => d.id === activeHintId)?.y}%`
              }}
            />
          )}

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
                backgroundImage: `url(${canvasRefLeft.current?.toDataURL()})`,
                backgroundPosition: `${cursorPos.x}% ${cursorPos.y}%`,
                backgroundSize: '250%'
              }}
            />
          )}
        </div>

        {/* Right Side: Modified Image */}
        <div
          ref={containerRefRight}
          className="canvas-card"
          onClick={(e) => handleCanvasClick(e, containerRefRight)}
          onMouseMove={(e) => handleMouseMove(e, containerRefRight)}
          onMouseLeave={handleMouseLeave}
        >
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 5,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem',
            fontWeight: 700, letterSpacing: '0.5px', color: 'var(--accent-pink)',
            border: '1px solid rgba(255, 0, 127, 0.3)'
          }}>
            MODIFIED
          </div>

          <canvas ref={canvasRefRight} className="canvas-element" />

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

          {/* Hint Radar Overlay */}
          {activeHintId && (
            <div
              className="hint-radar"
              style={{
                left: `${level.diffs.find(d => d.id === activeHintId)?.x}%`,
                top: `${level.diffs.find(d => d.id === activeHintId)?.y}%`
              }}
            />
          )}

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
                backgroundImage: `url(${canvasRefRight.current?.toDataURL()})`,
                backgroundPosition: `${cursorPos.x}% ${cursorPos.y}%`,
                backgroundSize: '250%'
              }}
            />
          )}
        </div>

      </div>
    </div>
  );
}
