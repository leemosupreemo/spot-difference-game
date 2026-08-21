import React, { useState, useEffect, useMemo } from 'react';
import { Terminal, Copy, Check, Share2, Trash2, X, RefreshCw, Smartphone, ShieldCheck, Layers } from 'lucide-react';
import { getAppLogs, clearAppLogs, subscribeAppLogs, logApp } from '../utils/logger';
import { getCuratedStatusMap, getLevelStatus } from '../utils/curationStore';
import { getAllPhotoPairEntries, selectPhotoPairEntries } from '../utils/photoPairLevelLoader';
import { sounds } from '../utils/audio';

export default function DiagnosticsModal({
  isOpen,
  onClose,
  currentLevel,
  selectedTheme,
  selectedDifficulty,
  activeMode,
  debugMode,
  levels = []
}) {
  const [logs, setLogs] = useState(() => getAppLogs());
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLogs(getAppLogs());
    const unsub = subscribeAppLogs(updated => {
      setLogs([...updated]);
    });
    return unsub;
  }, [isOpen]);

  const {
    manifestEntries,
    statusMap,
    totalReviewed,
    approvedCount,
    wrongDiffCount,
    dismissedCount,
    topCandidates
  } = useMemo(() => {
    if (!isOpen) {
      return {
        manifestEntries: [],
        statusMap: {},
        totalReviewed: 0,
        approvedCount: 0,
        wrongDiffCount: 0,
        dismissedCount: 0,
        topCandidates: []
      };
    }
    const entries = getAllPhotoPairEntries();
    const map = getCuratedStatusMap();
    const totalRev = Object.keys(map).length;
    const appr = Object.values(map).filter(v => getLevelStatus(v)?.status === 'approved').length;
    const wrong = Object.values(map).filter(v => getLevelStatus(v)?.status === 'wrong_difficulty').length;
    const dis = Object.values(map).filter(v => getLevelStatus(v)?.status === 'dismissed').length;
    const candidates = selectPhotoPairEntries(entries, {
      packId: selectedTheme,
      difficulty: selectedDifficulty,
      count: 6,
      statusMap: map
    });

    return {
      manifestEntries: entries,
      statusMap: map,
      totalReviewed: totalRev,
      approvedCount: appr,
      wrongDiffCount: wrong,
      dismissedCount: dis,
      topCandidates: candidates
    };
  }, [isOpen, selectedTheme, selectedDifficulty]);

  if (!isOpen) return null;

  const getSystemReport = () => {
    return {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      screenSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Unknown',
      gameConfig: {
        theme: selectedTheme,
        difficulty: selectedDifficulty,
        mode: activeMode,
        debugMode: Boolean(debugMode),
        currentLevelId: currentLevel?.id || 'None',
        currentLevelTitle: currentLevel?.title || 'None',
        currentStageCount: levels.length
      },
      manifestSummary: {
        totalActiveManifestEntries: manifestEntries.length,
        reviewedEntriesCount: totalReviewed,
        approvedCount,
        wrongDiffCount,
        dismissedCount
      },
      topStageCandidates: topCandidates.map((c, i) => ({
        index: i + 1,
        id: c.id,
        title: c.title,
        difficulty: c.difficulty,
        curationStatus: statusMap[c.id]?.status || 'UNREVIEWED / BRAND NEW'
      })),
      activeLoadedStageLevels: levels.map((l, i) => ({
        index: i + 1,
        id: l.id,
        title: l.title,
        baseImage: l.baseImage || 'Procedural Canvas',
        variantImage: l.variantImage || 'Procedural Canvas'
      })),
      recentLogs: logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`)
    };
  };

  const handleCopyReport = async () => {
    sounds.playWin();
    const report = getSystemReport();
    const formattedText = `=== DIFF HUNTER DIAGNOSTICS REPORT ===\nGenerated: ${report.timestamp}\nTheme: ${report.gameConfig.theme} | Difficulty: ${report.gameConfig.difficulty} | Mode: ${report.gameConfig.mode}\nCurrent Level: ${report.gameConfig.currentLevelId} (${report.gameConfig.currentLevelTitle})\nLoaded Stage: ${report.activeLoadedStageLevels.map(s => s.id).join(', ')}\nTop Candidates: ${report.topStageCandidates.map(c => `${c.id} [${c.curationStatus}]`).join(', ')}\n\n--- RECENT LOGS (${report.recentLogs.length}) ---\n${report.recentLogs.join('\n')}\n\n--- FULL JSON DATA ---\n${JSON.stringify(report, null, 2)}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(formattedText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = formattedText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      logApp('INFO', '[Diagnostics] Full report copied to clipboard');
    } catch (e) {
      alert('Unable to copy directly to clipboard. Please copy from text display.');
    }
  };

  const handleShareReport = async () => {
    sounds.playTap();
    const report = getSystemReport();
    const text = `Diff Hunter Diagnostics (${report.timestamp})\nLevel: ${report.gameConfig.currentLevelId}\nStage: ${report.activeLoadedStageLevels.map(s => s.id).join(', ')}\nLogs:\n${report.recentLogs.slice(-10).join('\n')}`;

    if (navigator?.share) {
      try {
        await navigator.share({
          title: 'Diff Hunter Diagnostics',
          text
        });
      } catch (_) {}
    } else {
      handleCopyReport();
    }
  };

  const handleClear = () => {
    sounds.playTap();
    clearAppLogs();
    setLogs([]);
  };

  const filteredLogs = filterText
    ? logs.filter(l => l.message.toLowerCase().includes(filterText.toLowerCase()) || l.level.toLowerCase().includes(filterText.toLowerCase()))
    : logs;

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div className="glass-panel modal-content" style={{
        maxWidth: '750px',
        width: '92vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        border: '1px solid rgba(0, 240, 255, 0.4)',
        boxShadow: '0 0 35px rgba(0, 240, 255, 0.25)'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={22} color="var(--accent-cyan)" />
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 900, letterSpacing: '0.5px' }}>
              Live System Diagnostics & Logs
            </h3>
          </div>
          <button
            onClick={() => { sounds.playTap(); onClose(); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* System Summary Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '8px',
          marginBottom: '14px',
          background: 'rgba(0,0,0,0.3)',
          padding: '10px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: '0.8rem'
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>ACTIVE LEVEL</span>
            <strong style={{ color: 'var(--accent-cyan)' }}>{currentLevel?.id || 'None'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>THEME / DIFFICULTY</span>
            <strong style={{ color: '#fff' }}>{selectedTheme} ({selectedDifficulty})</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>LOADED STAGE QUEUE ({levels.length})</span>
            <strong style={{ color: 'var(--accent-green)', fontSize: '0.75rem' }}>
              {levels.map(l => l.id.replace('ai_macro_', '')).join(' → ') || 'Empty'}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>TOP CANDIDATES IN MANIFEST</span>
            <strong style={{ color: '#ffd166', fontSize: '0.75rem' }}>
              {topCandidates.slice(0, 3).map(c => c.id.replace('ai_macro_', '')).join(', ')}
            </strong>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Filter logs (e.g. BuildStage, SelectEntries)..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              flex: 1,
              minWidth: '180px',
              padding: '6px 12px',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.8rem'
            }}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleCopyReport}
              className="game-btn primary"
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: copied ? 'var(--accent-green)' : 'var(--accent-cyan)',
                color: '#000',
                fontWeight: 800
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied Full Report!' : 'Copy Diagnostics'}
            </button>

            <button
              onClick={handleShareReport}
              className="game-btn secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Share Diagnostics"
            >
              <Share2 size={15} />
              Share
            </button>

            <button
              onClick={handleClear}
              className="game-btn secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
              title="Clear Logs"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Live Console Output */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: '#070913',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          borderRadius: '8px',
          padding: '10px',
          fontFamily: 'SF Mono, Menlo, Monaco, Courier, monospace',
          fontSize: '0.75rem',
          lineHeight: '1.45',
          minHeight: '260px'
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
              No log entries recorded yet.
            </div>
          ) : (
            filteredLogs.map(l => {
              const isError = l.level === 'ERROR' || l.message.includes('Error');
              const isWarn = l.level === 'WARN' || l.message.includes('warn');
              const isHighlight = l.message.includes('[BuildStage') || l.message.includes('[SelectEntries') || l.message.includes('[StartGame');

              return (
                <div
                  key={l.id}
                  style={{
                    color: isError ? '#ff4d6d' : isWarn ? '#ffd166' : isHighlight ? '#00f0ff' : '#e0e6ed',
                    marginBottom: '3px',
                    wordBreak: 'break-word'
                  }}
                >
                  <span style={{ color: '#5c677d', marginRight: '6px' }}>[{l.timestamp}]</span>
                  <strong style={{ marginRight: '6px', opacity: 0.8 }}>[{l.level}]</strong>
                  <span>{l.message}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Instructions footer */}
        <div style={{ marginTop: '10px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          💡 Tap <strong>Copy Diagnostics</strong> to copy the complete report and paste it into chat!
        </div>

      </div>
    </div>
  );
}
