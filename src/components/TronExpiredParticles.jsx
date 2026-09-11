import React from 'react';

const PARTICLES = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 37) % 84)}%`,
  top: `${6 + ((index * 53) % 88)}%`,
  delay: `${-((index * 0.43) % 5.2)}s`,
  duration: `${4.8 + ((index * 17) % 28) / 10}s`,
  size: `${2 + (index % 3)}px`
}));

export default function TronExpiredParticles() {
  return (
    <div className="tron-expired-particles" aria-hidden="true">
      <div className="tron-expired-scanline" />
      {PARTICLES.map(particle => (
        <span
          key={particle.id}
          className={`tron-expired-particle ${particle.id % 4 === 0 ? 'is-violet' : ''}`}
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            animationDelay: particle.delay,
            animationDuration: particle.duration
          }}
        />
      ))}
    </div>
  );
}
