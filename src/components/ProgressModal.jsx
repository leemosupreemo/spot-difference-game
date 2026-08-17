import React, { useState, useEffect } from 'react';
import { CheckCircle2, Flame, Globe, Award } from 'lucide-react';
import { sounds } from '../utils/audio';
import { fetchLeaderboards } from '../services/playerProgress';

export default function ProgressModal({ isOpen, onClose: _onClose, difficultyStats }) {
  const [mainView, setMainView] = useState('leaderboards'); // 'leaderboards' | 'progress'
  const [selectedTab, setSelectedTab] = useState('Easy'); // Easy | Medium | Hard
  const [selectedLeaderboardPack, setSelectedLeaderboardPack] = useState('find_the_sniper'); // 'find_the_sniper' | 'abstract_animated'
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoadingLeaderboard(true);
      fetchLeaderboards(difficultyStats)
        .then(data => {
          setLeaderboardData(data);
        })
        .finally(() => setLoadingLeaderboard(false));
    }
  }, [isOpen, difficultyStats]);

  if (!isOpen) return null;

  const currentStats = difficultyStats[selectedTab] || {
    setsCleared: 0,
    fastestFirstTimeOverall: null,
    fastestRepeatOverall: null,
    sets: {}
  };

  const categoriesList = [
    { id: 'find_the_sniper', title: 'Photography', icon: '📷' },
    { id: 'abstract_animated', title: 'Fantastical', icon: '✨' }
  ];

  const getCategoryStats = (packId) => {
    let clears = 0;
    let bestFirstTime = null;
    let bestRepeatTime = null;
    let setCompletedCount = 0;

    Object.values(currentStats.sets || {}).forEach(setObj => {
      const setPack = setObj.packId || 'find_the_sniper';
      if (setPack === packId || (packId === 'find_the_sniper' && (!setObj.packId || setObj.packId === 'find_the_sniper'))) {
        clears += (setObj.clears || 1);
        setCompletedCount += 1;

        if (setObj.firstTime && (!bestFirstTime || setObj.firstTime < bestFirstTime)) {
          bestFirstTime = setObj.firstTime;
        }

        const rTime = setObj.fastestRepeat || setObj.firstTime;
        if (rTime && (!bestRepeatTime || rTime < bestRepeatTime)) {
          bestRepeatTime = rTime;
        }
      }
    });

    return { clears, bestFirstTime, bestRepeatTime, setCompletedCount };
  };

  const topLeaderboardEntries = leaderboardData?.byPackRepeat?.[selectedLeaderboardPack] || [];

  return (
    <div style={{
      width: '100%',
      maxWidth: '900px',
      margin: '0 auto',
      padding: '0 16px',
      boxSizing: 'border-box',
      animation: 'pageFadeIn 0.15s ease-out'
    }}>
      {/* Main View Mode Selector (Leaderboards vs Progress) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        background: 'rgba(0,0,0,0.5)',
        padding: '6px',
        borderRadius: '16px',
        marginBottom: '16px',
        border: '1px solid var(--border-glass)'
      }}>
        <button
          onClick={() => { sounds.playTap(); setMainView('leaderboards'); }}
          className={`glass-btn ${mainView === 'leaderboards' ? 'glass-btn-primary' : ''}`}
          style={{ justifyContent: 'center', padding: '10px', fontSize: '0.95rem', fontWeight: 800, borderRadius: '12px' }}
        >
          <Globe size={18} /> Global Leaderboards
        </button>
        <button
          onClick={() => { sounds.playTap(); setMainView('progress'); }}
          className={`glass-btn ${mainView === 'progress' ? 'glass-btn-primary' : ''}`}
          style={{ justifyContent: 'center', padding: '10px', fontSize: '0.95rem', fontWeight: 800, borderRadius: '12px' }}
        >
          <CheckCircle2 size={18} /> My Progress
        </button>
      </div>

      {mainView === 'leaderboards' ? (
        /* GLOBAL LEADERBOARDS VIEW */
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', minHeight: '380px', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Award size={20} color="var(--accent-gold)" /> LIVE LEADERBOARD
            </h3>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
              <button
                onClick={() => { sounds.playTap(); setSelectedLeaderboardPack('find_the_sniper'); }}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedLeaderboardPack === 'find_the_sniper' ? 'var(--accent-cyan)' : 'transparent',
                  color: selectedLeaderboardPack === 'find_the_sniper' ? '#000' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                📷 Photography
              </button>
              <button
                onClick={() => { sounds.playTap(); setSelectedLeaderboardPack('abstract_animated'); }}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedLeaderboardPack === 'abstract_animated' ? '#d9b3ff' : 'transparent',
                  color: selectedLeaderboardPack === 'abstract_animated' ? '#000' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                ✨ Fantastical
              </button>
            </div>
          </div>

          {loadingLeaderboard ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
              Fetching Leaderboard...
            </p>
          ) : (
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '12px 16px' }}>RANK</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>SETS CLEARED</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>AVG FASTEST TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {topLeaderboardEntries.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records yet. Complete a stage set to submit your score!
                      </td>
                    </tr>
                  ) : (
                    topLeaderboardEntries.map((entry, index) => {
                      const isMe = entry.isCurrentPlayer;
                      const avgTimeMs = entry.effectiveTime || entry.avgRepeatTimeByPack?.[selectedLeaderboardPack] || entry.avgTimesByPack?.[selectedLeaderboardPack];
                      const timeStr = avgTimeMs ? `${(avgTimeMs / 1000).toFixed(2)}s` : '--';
                      const displayName = isMe ? 'YOU (THIS DEVICE)' : (entry.playerName || `SPEEDRUNNER #${index + 1}`);
                      const setsCount = entry.totalSetsCleared ?? (isMe ? (leaderboardData?.localPlayer?.totalSetsCleared || 0) : 1);

                      return (
                        <tr
                          key={entry.uid || index}
                          style={{
                            background: isMe ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: isMe ? 'var(--accent-cyan)' : '#fff' }}>
                            <span style={{ color: index === 0 ? 'var(--accent-gold)' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'var(--text-muted)', marginRight: '10px' }}>
                              #{index + 1}
                            </span>
                            {displayName}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                            {setsCount} Sets
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 800 }}>
                            {timeStr}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* MY PROGRESS VIEW */
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', minHeight: '380px', boxSizing: 'border-box', overflowY: 'auto' }}>
          {/* Difficulty Tab Selector */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            background: 'rgba(0,0,0,0.5)',
            padding: '5px',
            borderRadius: '16px',
            marginBottom: '16px',
            border: '1px solid var(--border-glass)',
            boxSizing: 'border-box'
          }}>
            {['Easy', 'Medium', 'Hard'].map((diff) => {
              const isSelected = selectedTab === diff;
              const colors = { Easy: 'var(--accent-green)', Medium: 'var(--accent-gold)', Hard: 'var(--accent-pink)' };
              return (
                <button
                  key={diff}
                  onClick={() => { sounds.playTap(); setSelectedTab(diff); }}
                  className="glass-btn"
                  style={{
                    justifyContent: 'center',
                    padding: '8px 12px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    borderRadius: '10px',
                    background: isSelected ? colors[diff] : 'rgba(255, 255, 255, 0.05)',
                    color: isSelected ? '#000' : 'var(--text-main)',
                    border: `1.5px solid ${isSelected ? colors[diff] : 'var(--border-glass)'}`,
                    boxShadow: 'none',
                    transform: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {diff === 'Easy' && '🟢 '}
                  {diff === 'Medium' && '🟡 '}
                  {diff === 'Hard' && '🔴 '}
                  {diff.toUpperCase()}
                </button>
              );
            })}
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="var(--accent-pink)" /> {selectedTab.toUpperCase()} PROGRESS
          </h3>

          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '12px 14px' }}>CATEGORY</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>CLEARED</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>BEST 1ST TRY</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>BEST REPEAT TRY</th>
                </tr>
              </thead>
              <tbody>
                {categoriesList.map(cat => {
                  const stats = getCategoryStats(cat.id);
                  const firstStr = stats.bestFirstTime ? `${(stats.bestFirstTime / 1000).toFixed(2)}s` : '--';
                  const repeatStr = stats.bestRepeatTime ? `${(stats.bestRepeatTime / 1000).toFixed(2)}s` : '--';

                  return (
                    <tr key={cat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{cat.icon}</span> {cat.title}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {stats.clears}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)', fontWeight: 800 }}>
                        {firstStr}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                        {repeatStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
