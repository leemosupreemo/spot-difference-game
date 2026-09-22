import React from 'react';

// Deterministic (not Math.random) so the mix of trails is stable across renders,
// but varied enough per-trail that the loop never reads as a fixed, robotic cycle.
const TRAIL_COLORS = ['#00f0ff', '#ff007f', '#9b6cff'];

const TRAILS = Array.from({ length: 7 }, (_, index) => {
  const axis = index % 2 === 0 ? 'horizontal' : 'vertical';
  return {
    id: index,
    axis,
    offset: `${6 + ((index * 31) % 88)}%`,
    length: 120 + ((index * 47) % 140),
    duration: 6 + ((index * 17) % 50) / 10,
    delay: -((index * 3.1) % 12),
    color: TRAIL_COLORS[index % TRAIL_COLORS.length]
  };
});

export default function TronLightcycleField() {
  return (
    <div className="tron-lightcycle-field" aria-hidden="true">
      {TRAILS.map(trail => {
        const isVertical = trail.axis === 'vertical';
        return (
          <span
            key={trail.id}
            className={`tron-lightcycle-trail tron-lightcycle-${trail.axis}`}
            style={{
              [isVertical ? 'left' : 'top']: trail.offset,
              '--trail-length': `${trail.length}px`,
              '--trail-color': trail.color,
              animationDuration: `${trail.duration}s`,
              animationDelay: `${trail.delay}s`
            }}
          />
        );
      })}
    </div>
  );
}
