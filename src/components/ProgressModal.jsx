import React, { useState, useEffect } from 'react';
import { CheckCircle2, Globe, Award, Zap, Trophy, Target, Timer, Flame, Star, Calendar, Play } from 'lucide-react';
import { sounds } from '../utils/audio';
import { fetchLeaderboards } from '../services/playerProgress';
import {
  isGameCenterSupported,
  openGameCenterLeaderboard,
  openGameCenterAchievements,
  onGameCenterAuthChange
} from '../services/gameCenter';
import {
  getDailyLeaderboard,
  fetchDailyLeaderboard,
  getDailyTimeToBeat,
  getDailyPlayerStatus,
  getTodayDateString,
  formatTimeUntilNextDaily
} from '../services/dailyChallenge';

export default function ProgressModal({
  isOpen,
  onClose: _onClose,
  difficultyStats,
  onStartDaily,
  onResetDaily = null,
  initialTab = 'leaderboards',
  debugMode = false
}) {
  const [mainView, setMainView] = useState(initialTab); // 'leaderboards' | 'daily' | 'progress'
  const [selectedLeaderboardPack, setSelectedLeaderboardPack] = useState('find_the_sniper'); // 'find_the_sniper' | 'abstract_animated'
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [gcState, setGcState] = useState({ isAuthenticated: false, player: null });
  const [dailyBoard, setDailyBoard] = useState([]);
  const [dailyStatus, setDailyStatus] = useState({ completed: false });
  const [dailyTimeToBeat, setDailyTimeToBeat] = useState(null);

  useEffect(() => {
    return onGameCenterAuthChange(setGcState);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoadingLeaderboard(true);
      fetchLeaderboards(difficultyStats)
        .then(data => {
          setLeaderboardData(data);
        })
        .finally(() => setLoadingLeaderboard(false));

      const today = getTodayDateString();
      setDailyBoard(getDailyLeaderboard(today));
      setDailyStatus(getDailyPlayerStatus(today));
      setDailyTimeToBeat(getDailyTimeToBeat(today));

      fetchDailyLeaderboard(today).then(remoteBoard => {
        if (remoteBoard && remoteBoard.length > 0) {
          setDailyBoard(remoteBoard);
          setDailyStatus(getDailyPlayerStatus(today));
          setDailyTimeToBeat(getDailyTimeToBeat(today));
        }
      }).catch(() => {});
    }
  }, [isOpen, difficultyStats]);

  if (!isOpen) return null;

  const categoriesList = [
    { id: 'find_the_sniper', title: 'Photography', icon: '📷' },
    { id: 'abstract_animated', title: 'Abstract', icon: '🎨' }
  ];

  const getAllRecordedSets = () => {
    const allSets = [];
    const seenSetKeys = new Set();
    Object.entries(difficultyStats || {}).forEach(([diffKey, diffObj]) => {
      Object.entries(diffObj?.sets || {}).forEach(([setKey, setObj]) => {
        const uniqueKey = `${diffKey}_${setKey}`;
        if (!seenSetKeys.has(uniqueKey)) {
          seenSetKeys.add(uniqueKey);
          allSets.push(setObj);
        }
      });
    });
    return allSets;
  };

  const getCategoryStats = (packId) => {
    let clears = 0;
    let totalPoints = 0;
    let bestFirstTime = null;
    let bestRepeatTime = null;
    let setCompletedCount = 0;

    const allSets = getAllRecordedSets();
    allSets.forEach(setObj => {
      const setPack = setObj.packId || 'find_the_sniper';
      if (setPack === packId || (packId === 'find_the_sniper' && (!setObj.packId || setObj.packId === 'find_the_sniper'))) {
        const c = setObj.clears || 1;
        clears += c;
        setCompletedCount += 1;
        totalPoints += (setObj.totalPoints || 0);

        if (setObj.firstTime && (!bestFirstTime || setObj.firstTime < bestFirstTime)) {
          bestFirstTime = setObj.firstTime;
        }

        const rTime = setObj.fastestRepeat || setObj.firstTime;
        if (rTime && (!bestRepeatTime || rTime < bestRepeatTime)) {
          bestRepeatTime = rTime;
        }
      }
    });

    const avgPointsPerSet = clears > 0 ? Math.round(totalPoints / clears) : 0;
    return { clears, totalPoints, avgPointsPerSet, bestFirstTime, bestRepeatTime, setCompletedCount };
  };

  const topLeaderboardEntries = leaderboardData?.byPackFirst?.[selectedLeaderboardPack] || leaderboardData?.byPackRepeat?.[selectedLeaderboardPack] || [];

  return (
    <div style={{
      width: '100%',
      maxWidth: '900px',
      margin: '0 auto',
      padding: '0 16px',
      boxSizing: 'border-box',
      animation: 'pageFadeIn 0.15s ease-out'
    }}>
      {/* Main View Mode Selector (Leaderboards vs Daily vs Progress) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        background: 'rgba(0,0,0,0.5)',
        padding: '6px',
        borderRadius: '16px',
        marginBottom: '16px',
        border: '1px solid var(--border-glass)'
      }}>
        <button
          onClick={() => { sounds.playTap(); setMainView('leaderboards'); }}
          className={`glass-btn ${mainView === 'leaderboards' ? 'glass-btn-primary' : ''}`}
          style={{ justifyContent: 'center', padding: '10px 6px', fontSize: '0.88rem', fontWeight: 800, borderRadius: '12px' }}
        >
          <Globe size={16} /> Global
        </button>
        <button
          onClick={() => { sounds.playTap(); setMainView('daily'); }}
          className={`glass-btn ${mainView === 'daily' ? 'glass-btn-primary' : ''}`}
          style={{
            justifyContent: 'center',
            padding: '10px 6px',
            fontSize: '0.88rem',
            fontWeight: 800,
            borderRadius: '12px',
            borderColor: mainView === 'daily' ? 'rgba(255, 183, 3, 0.7)' : undefined,
            color: mainView === 'daily' ? 'var(--accent-gold)' : undefined
          }}
        >
          <Flame size={16} color="var(--accent-gold)" /> Daily Challenge
        </button>
        <button
          onClick={() => { sounds.playTap(); setMainView('progress'); }}
          className={`glass-btn ${mainView === 'progress' ? 'glass-btn-primary' : ''}`}
          style={{ justifyContent: 'center', padding: '10px 6px', fontSize: '0.88rem', fontWeight: 800, borderRadius: '12px' }}
        >
          <CheckCircle2 size={16} /> My Progress
        </button>
      </div>

      {mainView === 'leaderboards' ? (
        /* GLOBAL LEADERBOARDS VIEW */
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', minHeight: '380px', boxSizing: 'border-box', overflowY: 'auto' }}>
          {/* Apple Game Center Quick Access (iOS) */}
          {isGameCenterSupported() && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                marginBottom: '16px',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={18} color="var(--accent-gold)" />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                  {gcState.isAuthenticated
                    ? `Game Center: ${gcState.player?.alias || 'Connected'}`
                    : 'Apple Game Center'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { sounds.playTap(); openGameCenterLeaderboard(); }}
                  className="glass-btn glass-btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '8px' }}
                >
                  Leaderboards
                </button>
                <button
                  onClick={() => { sounds.playTap(); openGameCenterAchievements(); }}
                  className="glass-btn"
                  style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '8px' }}
                >
                  Achievements
                </button>
              </div>
            </div>
          )}

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
                🎨 Abstract
              </button>
            </div>
          </div>

          {loadingLeaderboard ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              padding: '48px 0',
              color: 'var(--text-muted)'
            }}>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.3px' }}>
                Fetching Leaderboard...
              </p>
              <div className="loading-spinner" />
            </div>
          ) : (
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '12px 14px' }}>RANK / PLAYER</th>
                    <th style={{
                      padding: '12px 10px',
                      textAlign: 'center',
                      color: 'var(--accent-gold)',
                      background: 'rgba(255, 183, 3, 0.14)',
                      borderLeft: '1px solid rgba(255, 183, 3, 0.35)',
                      borderRight: '1px solid rgba(255, 183, 3, 0.35)',
                      fontWeight: 900
                    }}>
                      ★ AVG 1ST ATTEMPT
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>AVG OVERALL</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>FASTEST TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {topLeaderboardEntries.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records yet. Complete a stage set to submit your score!
                      </td>
                    </tr>
                  ) : (
                    topLeaderboardEntries.map((entry, index) => {
                      const isMe = entry.isCurrentPlayer;
                      const firstTimeMs = entry.firstTime || entry.avgFirstTimeByPack?.[selectedLeaderboardPack];
                      const repeatTimeMs = entry.repeatTime || entry.avgRepeatTimeByPack?.[selectedLeaderboardPack] || entry.avgTimesByPack?.[selectedLeaderboardPack];
                      const fastestTimeMs = entry.fastestTime || entry.fastestTimeByPack?.[selectedLeaderboardPack];

                      const firstTimeStr = typeof firstTimeMs === 'number' && firstTimeMs > 0 ? `${(firstTimeMs / 1000).toFixed(2)}s` : '--';
                      const overallTimeStr = typeof repeatTimeMs === 'number' && repeatTimeMs > 0 ? `${(repeatTimeMs / 1000).toFixed(2)}s` : '--';
                      const fastestTimeStr = typeof fastestTimeMs === 'number' && fastestTimeMs > 0 ? `${(fastestTimeMs / 1000).toFixed(2)}s` : '--';
                      const displayName = isMe ? 'YOU (THIS DEVICE)' : (entry.playerName || `SPEEDRUNNER #${index + 1}`);

                      return (
                        <tr
                          key={entry.uid || index}
                          style={{
                            background: isMe ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                          }}
                        >
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: isMe ? 'var(--accent-cyan)' : '#fff' }}>
                            <span style={{ color: index === 0 ? 'var(--accent-gold)' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'var(--text-muted)', marginRight: '8px' }}>
                              #{index + 1}
                            </span>
                            {displayName}
                          </td>
                          <td style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-gold)',
                            fontWeight: 900,
                            fontSize: '0.96rem',
                            background: isMe ? 'rgba(255, 183, 3, 0.22)' : 'rgba(255, 183, 3, 0.08)',
                            borderLeft: '1px solid rgba(255, 183, 3, 0.3)',
                            borderRight: '1px solid rgba(255, 183, 3, 0.3)'
                          }}>
                            {firstTimeStr}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 800 }}>
                            {overallTimeStr}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                            {fastestTimeStr}
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
      ) : mainView === 'daily' ? (
        /* DAILY CHALLENGE VIEW */
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', minHeight: '380px', boxSizing: 'border-box', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={22} color="var(--accent-gold)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
                  SET OF THE DAY LEADERBOARD
                </h3>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Today's 3-Image Sequence • Fastest 20 Times
              </div>
            </div>

            {/* Time to beat badge & Play CTA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 183, 3, 0.4)',
                borderRadius: '12px',
                padding: '6px 14px',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-gold)', textTransform: 'uppercase' }}>
                  Time to Beat
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                  {dailyTimeToBeat ? `${(dailyTimeToBeat / 1000).toFixed(1)}s` : '--'}
                </div>
              </div>

              {onStartDaily && !dailyStatus.completed && !dailyStatus.attempted && !dailyStatus.failed && (
                <button
                  onClick={() => {
                    sounds.playTap();
                    onStartDaily();
                  }}
                  className="glass-btn glass-btn-primary"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Play size={14} fill="#000" /> Play Set
                </button>
              )}
            </div>
          </div>

          {/* Player Daily Summary Card if attempted/failed */}
          {!dailyStatus.completed && (dailyStatus.attempted || dailyStatus.failed) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(255, 0, 127, 0.15), rgba(40, 15, 30, 0.25))',
              border: '1px solid rgba(255, 0, 127, 0.35)',
              borderRadius: '14px',
              padding: '12px 18px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-pink)' }}>
                  DAILY RUN ENDED
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#fff' }}>
                  Attempted today • Refreshes daily at 4:00 AM ET (1:00 AM PT)
                </div>
              </div>

              {debugMode && onResetDaily && (
                <button
                  onClick={() => {
                    sounds.playWin();
                    onResetDaily();
                    setDailyStatus({ completed: false, attempted: false, failed: false });
                  }}
                  className="glass-btn"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: 'var(--accent-pink)',
                    borderColor: 'var(--accent-pink)',
                    background: 'rgba(255, 0, 127, 0.2)',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Reset Attempt (Debug)
                </button>
              )}
            </div>
          )}

          {/* Player Daily Summary Card if completed */}
          {dailyStatus.completed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(255, 0, 127, 0.15), rgba(0, 240, 255, 0.12))',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              borderRadius: '14px',
              padding: '12px 18px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Trophy size={20} color="var(--accent-gold)" />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    YOUR COMPLETED RUN TODAY
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>
                    {(dailyStatus.totalTimeMs / 1000).toFixed(2)}s • Rank #{dailyStatus.position || 1}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[1, 2, 3].map(s => (
                    <Star
                      key={s}
                      size={18}
                      color={s <= (dailyStatus.stars || 3) ? 'var(--accent-gold)' : 'rgba(255,255,255,0.2)'}
                      fill={s <= (dailyStatus.stars || 3) ? 'var(--accent-gold)' : 'none'}
                    />
                  ))}
                </div>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  background: 'rgba(0, 255, 135, 0.2)',
                  color: 'var(--accent-green)',
                  fontSize: '0.82rem',
                  fontWeight: 900
                }}>
                  Top {Math.max(1, 100 - (dailyStatus.percentile || 95))}%
                </div>

                {debugMode && onResetDaily && (
                  <button
                    onClick={() => {
                      sounds.playWin();
                      onResetDaily();
                      setDailyStatus({ completed: false, attempted: false, failed: false });
                    }}
                    className="glass-btn"
                    style={{
                      padding: '6px 12px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: 'var(--accent-pink)',
                      borderColor: 'var(--accent-pink)',
                      background: 'rgba(255, 0, 127, 0.2)',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Reset (Debug)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Top 20 Times Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  <th style={{ padding: '12px 14px' }}>RANK / PLAYER</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>RATING</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>TOTAL TIME</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>DATE</th>
                </tr>
              </thead>
              <tbody>
                {dailyBoard.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No times recorded yet for today. Be the first to clear the Set of the Day!
                    </td>
                  </tr>
                ) : (
                  dailyBoard.map((entry, index) => {
                    const isMe = entry.isLocalPlayer;
                    const timeStr = typeof entry.totalTimeMs === 'number' ? `${(entry.totalTimeMs / 1000).toFixed(2)}s` : '--';
                    const displayName = isMe ? `${entry.playerName || 'YOU'} (YOU)` : entry.playerName;
                    const rankNum = entry.rank || (index + 1);

                    return (
                      <tr
                        key={index}
                        style={{
                          background: isMe ? 'rgba(0, 240, 255, 0.15)' : index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.05)'
                        }}
                      >
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: isMe ? 'var(--accent-cyan)' : '#fff' }}>
                          <span style={{
                            color: rankNum === 1 ? 'var(--accent-gold)' : rankNum === 2 ? '#c0c0c0' : rankNum === 3 ? '#cd7f32' : 'var(--text-muted)',
                            marginRight: '8px',
                            fontWeight: 900
                          }}>
                            {rankNum === 1 ? '🥇 #1' : rankNum === 2 ? '🥈 #2' : rankNum === 3 ? '🥉 #3' : `#${rankNum}`}
                          </span>
                          {displayName}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '2px' }}>
                            {[1, 2, 3].map(s => (
                              <Star
                                key={s}
                                size={13}
                                color={s <= (entry.stars || 1) ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)'}
                                fill={s <= (entry.stars || 1) ? 'var(--accent-gold)' : 'none'}
                              />
                            ))}
                          </div>
                        </td>
                        <td style={{
                          padding: '12px 10px',
                          textAlign: 'center',
                          fontFamily: 'var(--font-mono)',
                          color: rankNum === 1 ? 'var(--accent-gold)' : 'var(--accent-cyan)',
                          fontWeight: 900,
                          fontSize: '0.98rem'
                        }}>
                          {timeStr}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          Today
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MY PROGRESS VIEW */
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', minHeight: '380px', boxSizing: 'border-box', overflowY: 'auto' }}>
          {/* Overall Summary Stat Cards */}
          {(() => {
            const allSets = getAllRecordedSets();
            const totalClears = allSets.reduce((sum, s) => sum + (s.clears || 1), 0);
            const totalPoints = allSets.reduce((sum, s) => sum + (s.totalPoints || 0), 0);
            const avgPointsOverall = totalClears > 0 ? Math.round(totalPoints / totalClears) : 0;
            const bestOverallTimeMs = allSets.reduce((best, s) => {
              const t = s.fastestRepeat || s.firstTime;
              return t && (!best || t < best) ? t : best;
            }, null);

            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                marginBottom: '16px'
              }}>
                <div style={{
                  background: 'rgba(255, 183, 3, 0.08)',
                  border: '1px solid rgba(255, 183, 3, 0.3)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                    <Trophy size={14} /> TOTAL POINTS
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                    {totalPoints.toLocaleString()} <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)' }}>PTS</span>
                  </span>
                </div>

                <div style={{
                  background: 'rgba(0, 240, 255, 0.08)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    <Zap size={14} /> AVG PTS / SET
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                    {avgPointsOverall.toLocaleString()} <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>PTS</span>
                  </span>
                </div>

                <div style={{
                  background: 'rgba(0, 255, 135, 0.08)',
                  border: '1px solid rgba(0, 255, 135, 0.3)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                    <Target size={14} /> SETS CLEARED
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                    {totalClears} <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)' }}>SETS</span>
                  </span>
                </div>

                <div style={{
                  background: 'rgba(255, 0, 127, 0.08)',
                  border: '1px solid rgba(255, 0, 127, 0.3)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-pink)' }}>
                    <Timer size={14} /> BEST TIME
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                    {bestOverallTimeMs ? `${(bestOverallTimeMs / 1000).toFixed(2)}s` : '--'}
                  </span>
                </div>
              </div>
            );
          })()}

          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '12px 14px' }}>CATEGORY</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>CLEARED</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>TOTAL PTS</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>AVG / SET</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>BEST TIME</th>
                </tr>
              </thead>
              <tbody>
                {categoriesList.map(cat => {
                  const stats = getCategoryStats(cat.id);
                  const repeatStr = stats.bestRepeatTime ? `${(stats.bestRepeatTime / 1000).toFixed(2)}s` : (stats.bestFirstTime ? `${(stats.bestFirstTime / 1000).toFixed(2)}s` : '--');

                  return (
                    <tr key={cat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{cat.icon}</span> {cat.title}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {stats.clears}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)', fontWeight: 800 }}>
                        {stats.totalPoints.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                        {stats.avgPointsPerSet.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 800 }}>
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
