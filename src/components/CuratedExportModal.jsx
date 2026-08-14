import React, { useState } from 'react';
import { CheckCircle2, Copy, Download, Share2, X } from 'lucide-react';
import {
  downloadCuratedJSON,
  exportCuratedDataset,
  serializeCuratedDataset
} from '../utils/curationStore';
import { PHOTO_PACKS } from '../data/photoPacks';
import { sounds } from '../utils/audio';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

export default function CuratedExportModal({ isOpen, onClose }) {
  const [statusMessage, setStatusMessage] = useState('');
  const dataset = exportCuratedDataset(PHOTO_PACKS);
  const exportText = serializeCuratedDataset(dataset);
  const approvedIdsText = dataset.approvedLevelIds.length
    ? dataset.approvedLevelIds.join(', ')
    : 'None';

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await copyText(exportText);
      sounds.playTap();
      setStatusMessage('Copied export JSON to clipboard.');
    } catch {
      sounds.playError();
      setStatusMessage('Copy failed. Select the JSON text and copy it manually.');
    }
  };

  const handleShare = async () => {
    if (!navigator.share) {
      setStatusMessage('Share is not available. Use Copy instead.');
      return;
    }

    try {
      await navigator.share({
        title: 'Diff Hunter curated levels',
        text: exportText
      });
      sounds.playTap();
      setStatusMessage('Opened the phone share sheet.');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        sounds.playError();
        setStatusMessage('Share failed. Use Copy instead.');
      }
    }
  };

  const handleDownload = () => {
    sounds.playTap();
    downloadCuratedJSON(PHOTO_PACKS, dataset);
    setStatusMessage('Download started if this browser allows file downloads.');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(5, 6, 12, 0.9)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '14px'
    }}>
      <div className="glass-panel" style={{
        width: 'min(720px, 100%)',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: '18px',
        padding: '18px',
        border: '1px solid rgba(0, 240, 255, 0.45)',
        boxShadow: '0 0 36px rgba(0, 240, 255, 0.22)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', marginBottom: '4px' }}>
              Curation Export
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Copy or share this JSON from your phone so the approved IDs can be recovered.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="glass-btn"
            style={{ padding: '8px', borderRadius: '50%', flexShrink: 0 }}
            aria-label="Close export"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          marginBottom: '12px'
        }}>
          <button type="button" className="glass-btn glass-btn-primary" onClick={handleCopy} style={{ justifyContent: 'center' }}>
            <Copy size={16} /> Copy JSON
          </button>
          <button type="button" className="glass-btn" onClick={handleShare} style={{ justifyContent: 'center' }}>
            <Share2 size={16} /> Share
          </button>
          <button type="button" className="glass-btn" onClick={handleDownload} style={{ justifyContent: 'center' }}>
            <Download size={16} /> Download
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '8px',
          marginBottom: '12px'
        }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(0, 255, 135, 0.1)', border: '1px solid rgba(0, 255, 135, 0.35)' }}>
            <span style={{ color: 'var(--accent-green)', fontSize: '0.75rem', fontWeight: 800 }}>APPROVED</span>
            <div style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 900 }}>{dataset.summary.approvedCount}</div>
          </div>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255, 0, 127, 0.08)', border: '1px solid rgba(255, 0, 127, 0.3)' }}>
            <span style={{ color: 'var(--accent-pink)', fontSize: '0.75rem', fontWeight: 800 }}>DISMISSED</span>
            <div style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 900 }}>{dataset.summary.dismissedCount}</div>
          </div>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255, 183, 3, 0.08)', border: '1px solid rgba(255, 183, 3, 0.3)' }}>
            <span style={{ color: 'var(--accent-gold)', fontSize: '0.75rem', fontWeight: 800 }}>WRONG DIFF</span>
            <div style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 900 }}>{dataset.summary.wrongDifficultyCount}</div>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 800, marginBottom: '5px' }}>
            APPROVED IDS
          </div>
          <div style={{
            color: '#fff',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-glass)',
            borderRadius: '10px',
            padding: '9px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            overflowWrap: 'anywhere'
          }}>
            {approvedIdsText}
          </div>
        </div>

        <textarea
          readOnly
          value={exportText}
          onFocus={(event) => event.currentTarget.select()}
          style={{
            width: '100%',
            minHeight: '260px',
            resize: 'vertical',
            background: 'rgba(0,0,0,0.62)',
            color: '#fff',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            lineHeight: 1.45,
            outline: 'none'
          }}
        />

        {statusMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--accent-cyan)',
            fontSize: '0.8rem',
            fontWeight: 700,
            marginTop: '10px'
          }}>
            <CheckCircle2 size={15} /> {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}
