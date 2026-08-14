import React, { useState, useEffect } from 'react';
import { getAppLogs, subscribeAppLogs, clearAppLogs } from '../utils/logger';
import { Copy, Trash2, X, Terminal, Check } from 'lucide-react';

export default function DebugLogModal() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLogs(getAppLogs());
    const handleOpenEvent = () => setOpen(true);
    window.addEventListener('open-debug-logs', handleOpenEvent);
    const unsubscribe = subscribeAppLogs(setLogs);
    return () => {
      window.removeEventListener('open-debug-logs', handleOpenEvent);
      unsubscribe();
    };
  }, []);

  const handleCopy = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating Log Button - Top Right */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.95)',
          color: 'var(--accent-cyan, #00f0ff)',
          border: '1.5px solid var(--accent-cyan, #00f0ff)',
          borderRadius: '24px',
          padding: '8px 14px',
          fontSize: '0.8rem',
          fontWeight: 800,
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 20px rgba(0,240,255,0.4)',
          cursor: 'pointer'
        }}
      >
        <Terminal size={14} /> 📜 Logs ({logs.length})
      </button>

      {/* Slide-over Log Modal */}
      {open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000000,
          background: 'rgba(0, 0, 0, 0.94)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#090a10',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '16px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.03)'
            }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
                📜 App Diagnostics Log ({logs.length})
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCopy}
                  style={{
                    background: copied ? '#10b981' : 'var(--accent-cyan, #00f0ff)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIED!' : 'COPY LOGS'}
                </button>
                <button
                  onClick={() => clearAppLogs()}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Log Viewport */}
            <div style={{
              flex: 1,
              padding: '12px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              lineHeight: 1.4,
              color: '#d1d5db',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {logs.length === 0 ? (
                <div style={{ color: '#6b7280', textAlign: 'center', marginTop: '40px' }}>No logs recorded yet.</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: log.level === 'ERROR' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                    color: log.level === 'ERROR' ? '#fca5a5' : '#e5e7eb',
                    wordBreak: 'break-all'
                  }}>
                    <span style={{ color: '#6b7280', marginRight: '6px' }}>[{log.timestamp}]</span>
                    <strong style={{ marginRight: '6px', color: 'var(--accent-cyan)' }}>[{log.level}]</strong>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
