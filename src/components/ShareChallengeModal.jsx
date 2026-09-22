import React, { useEffect, useState } from 'react';
import { Share2, Copy, Download, X, MessageSquare } from 'lucide-react';
import { sounds } from '../utils/audio';
import { generateChallengeUrl, generateChallengeText, renderChallengeCardBlob, recordLocalShareEvent, shareToPlatform } from '../utils/challengeMetrics';
import { isNativeSharing, shareNativeResult } from '../utils/nativeShare';
import { trackChallengeShareClicked, trackChallengeShareCompleted, trackChallengeShareCancelled } from '../services/analytics';
import { getSavedPlayerName } from '../services/playerProgress';
import ModalAmbientParticles from './ModalAmbientParticles.jsx';

function TikTokIcon({ size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
    </svg>
  );
}

function InstagramIcon({ size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export default function ShareChallengeModal({
  isOpen, onClose, elapsedTime = 0,
  isPersonalBest = false, difficulty = 'Medium', themeId = 'find_the_sniper',
  levelTitle = 'Stage Set', levelId = ''
}) {
  const [cardBlob, setCardBlob] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const playerName = getSavedPlayerName() || 'SpeedHunter';
  const challengeUrl = generateChallengeUrl({ elapsedTimeMs: elapsedTime, playerName, difficulty, themeId, levelId });
  const metrics = { elapsedTimeMs: elapsedTime, isPersonalBest, difficulty, themeId };
  const shareText = generateChallengeText({ elapsedTimeMs: elapsedTime, isPersonalBest, playerName, challengeUrl });

  useEffect(() => {
    let active = true;
    setCardBlob(null);
    setMessage('');
    if (isOpen) {
      renderChallengeCardBlob({ elapsedTimeMs: elapsedTime, isPersonalBest, playerName, levelTitle })
        .then(blob => { if (active) setCardBlob(blob); })
        .catch(() => { if (active) setMessage('Image unavailable. You can still share the link.'); });
    }
    return () => { active = false; };
  }, [isOpen, elapsedTime, isPersonalBest, playerName, levelTitle]);

  useEffect(() => {
    if (!isOpen) return;
    const dismiss = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = async platform => {
    if (busy) return;
    sounds.playTap();
    setBusy(true);
    setMessage('');
    trackChallengeShareClicked({ source: `share_sheet_${platform}`, ...metrics });
    recordLocalShareEvent('tap');
    try {
      let result;
      if (platform === 'copy') {
        if (!navigator.clipboard?.writeText) throw new Error('Copy unavailable');
        await navigator.clipboard.writeText(challengeUrl);
        result = { success: true, message: 'Link copied.' };
      } else if (isNativeSharing()) {
        result = await shareNativeResult({
          title: 'Diff Hunter Result',
          text: platform === 'save' ? undefined : shareText,
          url: platform === 'save' ? undefined : challengeUrl,
          cardBlob: platform === 'text' ? null : cardBlob
        });
      } else if (platform === 'save') {
        if (!cardBlob) throw new Error('Image unavailable');
        const url = URL.createObjectURL(cardBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'DiffHunter_Result.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        result = { success: true, message: 'Image download started.' };
      } else {
        result = await shareToPlatform({ platform, elapsedTimeMs: elapsedTime, isPersonalBest, cardBlob, challengeUrl, playerName });
      }
      setMessage(result.message);
      if (result.success) {
        trackChallengeShareCompleted({ method: platform, ...metrics });
        if (platform === 'copy' || platform === 'save' || isNativeSharing()) recordLocalShareEvent('complete');
      } else if (result.cancelled || /cancel/i.test(result.message)) {
        trackChallengeShareCancelled({ reason: 'user_cancelled', elapsedTimeMs: elapsedTime });
      }
    } catch (error) {
      console.warn('[ShareChallenge] Share failed:', error);
      setMessage('Sharing unavailable. Copy or select the link below.');
    } finally { setBusy(false); }
  };

  const options = [
    ['text', 'Text', <MessageSquare key="text" size={20} />],
    ['tiktok', 'TikTok', <TikTokIcon key="tiktok" size={20} />],
    ['instagram', 'Instagram', <InstagramIcon key="instagram" size={20} />],
    ['more', 'More', <Share2 key="more" size={20} />],
    ['copy', 'Copy link', <Copy key="copy" size={20} />],
    ['save', 'Save image', <Download key="save" size={20} />]
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'transparent', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-result-title" className="glass-panel modal-split-card" onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: '440px', padding: '20px', borderRadius: '22px', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', boxSizing: 'border-box', background: '#111827', position: 'relative', '--modal-accent': 'var(--accent-cyan)' }}>
        <ModalAmbientParticles />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--modal-gap-sm)' }}>
            <Share2 size={22} color="var(--accent-cyan)" />
            <h2 id="share-result-title" style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.5px', color: '#fff' }}>
              Share result
            </h2>
          </div>
          <button
            autoFocus
            className="glass-btn"
            aria-label="Close share sheet"
            onClick={onClose}
            style={{
              padding: 0,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {options.map(([platform, label, icon]) => (
            <button key={platform} className="glass-btn" disabled={busy || (platform === 'save' && !cardBlob)} onClick={() => handleAction(platform)} style={{ flexDirection: 'column', justifyContent: 'center', gap: 'var(--modal-gap-sm)', padding: '14px 4px', fontSize: '0.8rem', minHeight: '76px' }}>
              {icon}{label}
            </button>
          ))}
        </div>
        {message && <p role="status" style={{ fontSize: '0.85rem', margin: '14px 0 0' }}>{message}</p>}
        <input aria-label="Challenge link" readOnly value={challengeUrl} onFocus={event => event.target.select()} style={{ width: '100%', marginTop: '14px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.25)', color: 'var(--text-muted)', fontSize: '0.75rem', boxSizing: 'border-box' }} />
      </div>
    </div>
  );
}
