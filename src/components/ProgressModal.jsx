import React, { useState, useEffect } from 'react';
import { Trophy, CheckCircle2, ArrowLeft, Flame, Globe, Award } from 'lucide-react';
import { sounds } from '../utils/audio';
import { fetchLeaderboards } from '../services/playerProgress';

export default function ProgressModal({ isOpen, onClose, difficultyStats }) {
  const [mainView, setMainView] = useState('leaderboards'); // 'leaderboards' | 'progress'
  const [selectedTab, setSelectedTab] = useState('Easy'); // Easy | Medium | Hard
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

  const topLeaderboardEntries = leaderboardData?.byPackRepeat?.find_the_sniper || [];

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'var(--bg-dark)',
      backgroundImage: `
        radial-gradient(at 10% 20%, rgba(255, 0, 127, 0.15) 0px, transparent 50%),
        radial-gradient(at 90% 80%, rgba(0, 240, 255, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(18, 9, 36, 0.8) 0px, transparent 100%)
      `,
      backgroundAttachment: 'fixed',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-main)',
      paddingTop: 'max(env(safe-area-inset-top), 20px)',
      paddingBottom: 'max(env(safe-area-inset-bottom), 40px)',
      paddingLeft: '20px',
      paddingRight: '20px',
      boxSizing: 'border-box',
      animation: 'hitPulse 0.3s ease-out'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Full Screen Top Exit Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button
            onClick={() => {
              sounds.playTap();
              onClose();
            }}
            className="glass-btn glass-btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <ArrowLeft size={20} /> Back to Menu
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={26} color="var(--accent-gold)" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 900, background: 'linear-gradient(90deg, #fff, var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              LEADERBOARD & RECORDS
            </h1>
          </div>
        </div>

        {/* Main View Mode Selector (Leaderboards vs Progress) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          background: 'rgba(0,0,0,0.5)',
          padding: '6px',
          borderRadius: '16px',
          marginBottom: '20px',
          border: '1px solid var(--border-glass)'
        }}>
          <button
            onClick={() => { sounds.playTap(); setMainView('leaderboards'); }}
            className={`glass-btn ${mainView === 'leaderboards' ? 'glass-btn-primary' : ''}`}
            style={{ justifyContent: 'center', padding: '12px', fontSize: '1rem', fontWeight: 800, borderRadius: '12px' }}
          >
            <Globe size={18} /> Global Leaderboards
          </button>
          <button
            onClick={() => { sounds.playTap(); setMainView('progress'); }}
            className={`glass-btn ${mainView === 'progress' ? 'glass-btn-primary' : ''}`}
            style={{ justifyContent: 'center', padding: '12px', fontSize: '1rem', fontWeight: 800, borderRadius: '12px' }}
          >
            <CheckCircle2 size={18} /> My Progress
          </button>
        </div>

        {mainView === 'leaderboards' ? (
          /* GLOBAL LEADERBOARDS VIEW */
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px', height: '420px', boxSizing: 'border-box', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Award size={20} color="var(--accent-gold)" /> TOP SPEEDRUNNERS
              </h3>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: leaderboardData?.isCloud ? 'var(--accent-green)' : 'var(--accent-cyan)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                {leaderboardData?.isCloud ? '☁️ FIRESTORE CONNECTED' : '⚡ LIVE LEADERBOARD'}
              </span>
            </div>

            {loadingLeaderboard ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                Fetching Cloud Speedrunners...
              </p>
            ) : (
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '14px 18px' }}>RANK</th>
                      <th style={{ padding: '14px 18px', textAlign: 'center' }}>SETS CLEARED</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>AVG FASTEST TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLeaderboardEntries.map((entry, index) => {
                      const isMe = entry.isCurrentPlayer;
                      const avgTimeMs = entry.effectiveTime || entry.avgRepeatTimeByPack?.find_the_sniper || entry.avgTimesByPack?.find_the_sniper;
                      const timeStr = avgTimeMs ? `${(avgTimeMs / 1000).toFixed(2)}s` : '--';
                      const displayName = isMe ? 'YOU (THIS DEVICE)' : (entry.playerName || `SPEEDRUNNER #${index + 1}`);

                      return (
                        <tr
                          key={entry.uid}
                          style={{
                            background: isMe ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                          }}
                        >
                          <td style={{ padding: '14px 18px', fontWeight: 800, color: isMe ? 'var(--accent-cyan)' : '#fff' }}>
                            <span style={{ color: index === 0 ? 'var(--accent-gold)' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'var(--text-muted)', marginRight: '10px' }}>
                              #{index + 1}
                            </span>
                            {displayName}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                            {entry.totalSetsCleared || 1} Sets
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 800 }}>
                            {timeStr}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* MY PROGRESS VIEW */
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px', height: '420px', boxSizing: 'border-box', overflowY: 'auto' }}>
            {/* Difficulty Tab Selector */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              background: 'rgba(0,0,0,0.5)',
              padding: '6px',
              borderRadius: '18px',
              marginBottom: '20px',
              border: '1px solid var(--border-glass)',
              height: '56px',
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
                      height: '44px',
                      padding: '0 12px',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      borderRadius: '12px',
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

            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        <td style={{ padding: '14px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{cat.icon}</span> {cat.title}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                          {stats.clears}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)', fontWeight: 800 }}>
                          {firstStr}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 800 }}>
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
    </div>
  );
}
