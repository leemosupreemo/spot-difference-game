import React from 'react';

export default function ResultCard({ elapsedTimeMs = 0, topPercentile = 100, isNewRecord = false }) {
  const seconds = (Math.max(0, elapsedTimeMs) / 1000).toFixed(2);
  return (
    <div className="result-card-container" style={{ marginBottom: '14px', textAlign: 'center' }}>
      {isNewRecord && (
        <p style={{ margin: '0 0 8px', color: 'var(--accent-gold)', fontWeight: 800 }}>
          New personal best
        </p>
      )}
      <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{seconds}s</div>
      <div style={{ marginTop: '4px', color: 'var(--accent-cyan)', fontWeight: 700 }}>Top {topPercentile}%</div>
    </div>
  );
}
