import React from 'react';

/**
 * Explains why the set the player was on is no longer available.
 *
 * Online-only sets keep their artwork on Hosting, so going offline withdraws
 * them and the app quietly moves the player to a set that works. Without a word
 * of explanation that reads as the game losing their place, so this says what
 * happened and that it comes back.
 *
 * It only appears when a switch actually happened -- not merely whenever the
 * player is offline -- so it never nags someone who was on a bundled set all
 * along and lost nothing.
 */
export default function OfflineSetNotice({ visible, onDismiss = null }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '0 0 12px 0',
        padding: '10px 12px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 176, 32, 0.45)',
        background: 'rgba(48, 34, 8, 0.55)',
        color: 'var(--text-main)',
        fontSize: '0.78rem',
        fontWeight: 700,
        lineHeight: 1.35,
        textAlign: 'left'
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1 }}>📡</span>
      <span style={{ flex: 1 }}>
        You're offline, so some photo sets aren't available right now. We've
        switched you to one you can play — the rest return when you reconnect.
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss offline notice"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #9aa3c0)',
            fontSize: '1rem',
            fontWeight: 900,
            cursor: 'pointer',
            padding: '0 2px',
            lineHeight: 1
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
