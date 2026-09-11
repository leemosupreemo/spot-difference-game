import React, { useEffect, useState } from 'react';
import { Share2, Copy, Download, X, MessageSquare } from 'lucide-react';
import { sounds } from '../utils/audio';
import { generateChallengeUrl, generateChallengeText, renderChallengeCardBlob, recordLocalShareEvent, shareToPlatform } from '../utils/challengeMetrics';
import { isNativeSharing, shareNativeResult } from '../utils/nativeShare';
import { trackChallengeShareClicked, trackChallengeShareCompleted, trackChallengeShareCancelled } from '../services/analytics';
import { getSavedPlayerName } from '../services/playerProgress';

export default function ShareChallengeModal({
  isOpen, onClose, elapsedTime = 0, percentileBeat = 0, topPercentile = 100,
  isPersonalBest = false, difficulty = 'Medium', themeId = 'find_the_sniper',
  levelTitle = 'Stage Set', levelId = ''
}) {
  const [cardBlob, setCardBlob] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const playerName = getSavedPlayerName() || 'SpeedHunter';
  const challengeUrl = generateChallengeUrl({ elapsedTimeMs: elapsedTime, playerName, difficulty, themeId, levelId });
  const metrics = { elapsedTimeMs: elapsedTime, percentileBeat, isPersonalBest, difficulty, themeId };
  const shareText = generateChallengeText({ elapsedTimeMs: elapsedTime, beatPercentile: percentileBeat, topPercentile, isPersonalBest, playerName, challengeUrl });

  useEffect(() => {
    let active = true;
    setCardBlob(null);
    setMessage('');
    if (isOpen) {
      renderChallengeCardBlob({ elapsedTimeMs: elapsedTime, beatPercentile: percentileBeat, topPercentile, isPersonalBest, playerName, levelTitle })
        .then(blob => { if (active) setCardBlob(blob); })
        .catch(() => { if (active) setMessage('Image unavailable. You can still share the link.'); });
    }
    return () => { active = false; };
  }, [isOpen, elapsedTime, percentileBeat, topPercentile, isPersonalBest, playerName, levelTitle]);

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
        result = await shareToPlatform({ platform, elapsedTimeMs: elapsedTime, topPercentile, beatPercentile: percentileBeat, isPersonalBest, cardBlob, challengeUrl, playerName });
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
    ['tiktok', 'TikTok', <span key="tiktok" aria-hidden="true">♪</span>],
    ['instagram', 'Instagram', <span key="instagram" aria-hidden="true">◎</span>],
    ['more', 'More', <Share2 key="more" size={20} />],
    ['copy', 'Copy link', <Copy key="copy" size={20} />],
    ['save', 'Save image', <Download key="save" size={20} />]
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-result-title" className="glass-panel" onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: '440px', padding: '20px', borderRadius: '22px', maxHeight: '80dvh', overflowY: 'auto', background: '#111827' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="share-result-title" style={{ margin: 0, fontSize: '1.1rem' }}>Share result</h2>
          <button autoFocus className="glass-btn" aria-label="Close share sheet" onClick={onClose} style={{ padding: '10px' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {options.map(([platform, label, icon]) => (
            <button key={platform} className="glass-btn" disabled={busy || (platform === 'save' && !cardBlob)} onClick={() => handleAction(platform)} style={{ flexDirection: 'column', justifyContent: 'center', gap: '8px', padding: '14px 4px', fontSize: '0.8rem', minHeight: '76px' }}>
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
