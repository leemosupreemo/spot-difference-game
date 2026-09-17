import React from 'react';

export default function HunterTagRejectionNotice({ visible, reason = 'profanity' }) {
  if (!visible) return null;
  const message = reason === 'empty'
    ? 'Please enter a name before saving.'
    : "That name isn't allowed. Please choose another Hunter Tag.";
  return (
    <div style={{ marginTop: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-pink)' }}>
      {message}
    </div>
  );
}
