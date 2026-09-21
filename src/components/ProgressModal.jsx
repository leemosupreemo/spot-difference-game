import React, { useState, useEffect } from 'react';
import { CheckCircle2, Globe, Award, Zap, Trophy, Target, Timer, Flame, Star, Play, WifiOff, RefreshCw, ChevronDown } from 'lucide-react';
import { sounds } from '../utils/audio';
import { fetchLeaderboards } from '../services/playerProgress';
import { isOnline, subscribeNetworkStatus, checkConnectivity } from '../services/networkService';
import {
  isGameCenterSupported,
  isGameCenterAuthenticated,
  onGameCenterAuthChange,
  openGameCenterLeaderboard
} from '../services/gameCenter';
import {
  getDailyLeaderboard,
  fetchDailyLeaderboard,
  getDailyTimeToBeat,
  getDailyPlayerStatus,
  getTodayDateString
} from '../services/dailyChallenge';
import { trackDailyChallengeClicked } from '../services/analytics.js';
import { getSetNumber } from '../utils/setLeaderboards.js';
import { formatSetLabel } from '../utils/remoteSetPolicy.js';

export default function ProgressModal({
  isOpen,
  onClose: _onClose,
  difficultyStats,
  onStartDaily,
  onResetDaily = null,
  onResetLocalRecords = null,
  initialTab = 'leaderboards',
  initialSetId = '',
  debugMode = false,
  forceOffline = false,
  photoSetIds = []
}) {
  const [mainView, setMainView] = useState(initialTab); // 'leaderboards' | 'daily' | 'progress'
  const [selectedLeaderboardPack, setSelectedLeaderboardPack] = useState('find_the_sniper'); // 'find_the_sniper' | 'abstract_animated'
  const [selectedLeaderboardSet, setSelectedLeaderboardSet] = useState(initialSetId || '');
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [dailyBoard, setDailyBoard] = useState([]);
  const [dailyStatus, setDailyStatus] = useState({ completed: false });
  const [dailyTimeToBeat, setDailyTimeToBeat] = useState(null);
  const [networkOnline, setNetworkOnline] = useState(() => forceOffline ? false : isOnline());
  const [gameCenterAuthenticated, setGameCenterAuthenticated] = useState(() => isGameCenterAuthenticated());

  useEffect(() => {
    return subscribeNetworkStatus(online => {
      if (!forceOffline) setNetworkOnline(online);
    });
  }, [forceOffline]);

  useEffect(() => {
    return onGameCenterAuthChange(state => {
      setGameCenterAuthenticated(Boolean(state?.isAuthenticated));
    });
  }, []);

  const handleRetryFetch = () => {
    try { sounds.playTap(); } catch (_) {}
    setLoadingLeaderboard(true);
    checkConnectivity().then(online => {
      setNetworkOnline(online);
    }).catch(() => {});
    fetchLeaderboards(difficultyStats, photoSetIds)
      .then(data => {
        setLeaderboardData(data);
      })
      .finally(() => setLoadingLeaderboard(false));

    const today = getTodayDateString();
    fetchDailyLeaderboard(today).then(remoteBoard => {
      if (remoteBoard && remoteBoard.length > 0) {
        setDailyBoard(remoteBoard);
      }
    }).catch(() => {});
  };

  const isOfflineMode = forceOffline || !networkOnline;
  const hasSetInitialTabRef = React.useRef(false);

  useEffect(() => {
    if (isOpen) {
      // Only snap to the requested initial tab on the opening transition, not on every
      // subsequent difficultyStats change (e.g. a local reset) while already open.
      if (initialTab && !hasSetInitialTabRef.current) {
        setMainView(initialTab);
      }
      hasSetInitialTabRef.current = true;
      setLoadingLeaderboard(true);
      fetchLeaderboards(difficultyStats, photoSetIds)
        .then(data => {
          setLeaderboardData(data);
          const availableSets = Object.keys(data?.bySetFirst || {});
          if (initialSetId && availableSets.includes(initialSetId)) {
            setSelectedLeaderboardSet(initialSetId);
          } else {
            // Default to the General Leaderboard (Top 25) unless the caller asked for a specific set
            setSelectedLeaderboardSet(current => current && availableSets.includes(current) ? current : '');
          }
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
    } else {
      hasSetInitialTabRef.current = false;
    }
  }, [isOpen, difficultyStats, photoSetIds]);

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
        const c = setObj.clears || 0;
        clears += c;
        if (c > 0) {
          setCompletedCount += 1;
        }
        totalPoints += (setObj.totalPoints || 0);

        if (typeof setObj.firstTime === 'number' && setObj.firstTime > 0 && (!bestFirstTime || setObj.firstTime < bestFirstTime)) {
          bestFirstTime = setObj.firstTime;
        }

        const rTime = (typeof setObj.fastestRepeat === 'number' && setObj.fastestRepeat > 0)
          ? setObj.fastestRepeat
          : (typeof setObj.firstTime === 'number' && setObj.firstTime > 0 ? setObj.firstTime : null);
        if (rTime && (!bestRepeatTime || rTime < bestRepeatTime)) {
          bestRepeatTime = rTime;
        }
      }
    });

    const avgPointsPerSet = clears > 0 ? Math.round(totalPoints / clears) : 0;
    return { clears, totalPoints, avgPointsPerSet, bestFirstTime, bestRepeatTime, setCompletedCount };
  };

  const deterministicPhotoEntries = selectedLeaderboardPack === 'find_the_sniper' && selectedLeaderboardSet
    ? (leaderboardData?.bySetFirst?.[selectedLeaderboardSet] || leaderboardData?.bySetRepeat?.[selectedLeaderboardSet] || [])
    : [];
  // Once a Photo Set is selected, an empty set remains empty. Falling back to
  // a pack-wide ranking would compare different deterministic content.
  const topLeaderboardEntries = selectedLeaderboardPack === 'find_the_sniper' && selectedLeaderboardSet
    ? deterministicPhotoEntries
    : (leaderboardData?.byPackFirst?.[selectedLeaderboardPack] || leaderboardData?.byPackRepeat?.[selectedLeaderboardPack] || []);

  const isSetView = Boolean(selectedLeaderboardPack === 'find_the_sniper' && selectedLeaderboardSet);

  const getPlayerSetStats = (setId) => {
    if (!setId || !difficultyStats) return null;
    for (const diffObj of Object.values(difficultyStats)) {
      if (diffObj?.sets?.[setId]) {
        return diffObj.sets[setId];
      }
    }
    return null;
  };

  return (
    <div
      className="modal-split-card"
      style={{
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
        padding: '0 16px',
        boxSizing: 'border-box',
        '--modal-accent': 'var(--accent-cyan)'
      }}
    >
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
          style={{ justifyContent: 'center', padding: '10px 6px', fontSize: '0.88rem', fontWeight: 800, borderRadius: '12px' }}
        >
          <Flame size={16} /> Daily Challenge
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
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', minHeight: '380px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, letterSpacing: '0.5px' }}>
                <Award size={22} color="var(--accent-gold)" /> LIVE LEADERBOARD
              </h3>
              {isGameCenterSupported() && gameCenterAuthenticated && (
                <button
                  onClick={() => { sounds.playTap(); openGameCenterLeaderboard(); }}
                  className="glass-btn glass-btn-primary"
                  style={{ fontSize: '0.76rem', padding: '6px 10px', borderRadius: '8px' }}
                >
                  Game Center
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
              <button
                onClick={() => { sounds.playTap(); setSelectedLeaderboardPack('find_the_sniper'); }}
                className={`glass-btn ${selectedLeaderboardPack === 'find_the_sniper' ? 'glass-btn-primary' : ''}`}
                style={{ padding: '5px 12px', fontSize: '0.8rem', fontWeight: 800, borderRadius: '8px' }}
              >
                📷 Photography
              </button>
              <button
                onClick={() => { sounds.playTap(); setSelectedLeaderboardPack('abstract_animated'); }}
                className={`glass-btn ${selectedLeaderboardPack === 'abstract_animated' ? 'glass-btn-primary' : ''}`}
                style={{ padding: '5px 12px', fontSize: '0.8rem', fontWeight: 800, borderRadius: '8px' }}
              >
                🎨 Abstract
              </button>
            </div>
          </div>

          {/* Photo Set Dropdown: Under Live Leaderboard title, left aligned. This row's space is
              always reserved (even when the dropdown itself doesn't apply, e.g. Abstract pack)
              so the table below doesn't jump up when switching category pills. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', justifyContent: 'flex-start', minHeight: '40px' }}>
            {selectedLeaderboardPack === 'find_the_sniper' && Object.keys(leaderboardData?.bySetFirst || {}).length > 0 && (
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <select
                  aria-label="Photo Set leaderboard"
                  value={selectedLeaderboardSet}
                  onChange={event => {
                    sounds.playTap();
                    setSelectedLeaderboardSet(event.target.value);
                  }}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    background: 'rgba(0, 240, 255, 0.1)',
                    color: '#fff',
                    border: '1.5px solid var(--accent-cyan)',
                    boxShadow: '0 0 12px rgba(0, 240, 255, 0.25)',
                    borderRadius: '10px',
                    padding: '8px 34px 8px 14px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    outline: 'none',
                    cursor: 'pointer',
                    maxWidth: '340px'
                  }}
                >
                  <option value="">General Leaderboard (Top 25)</option>
                  {Object.keys(leaderboardData.bySetFirst)
                    .sort((a, b) => getSetNumber(a) - getSetNumber(b))
                    .map(setId => (
                      <option key={setId} value={setId}>
                        {formatSetLabel(setId)}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  size={16}
                  color="var(--accent-cyan)"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none'
                  }}
                />
              </div>
            )}
          </div>

          {/* Offline Mode Indicator Banner */}
          {isOfflineMode && (
            <div
              className="leaderboard-offline-banner"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 183, 3, 0.12)',
                border: '1px solid rgba(255, 183, 3, 0.35)',
                borderRadius: '10px',
                padding: '8px 12px',
                marginBottom: '14px',
                fontSize: '0.8rem',
                color: 'var(--accent-gold)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <WifiOff size={16} color="var(--accent-gold)" />
                <span>
                  <strong>Offline Mode:</strong> Showing cached leaderboards. New records will sync once reconnected.
                </span>
              </div>
              {networkOnline && (
                <button
                  onClick={handleRetryFetch}
                  style={{
                    background: 'rgba(255, 183, 3, 0.2)',
                    border: '1px solid rgba(255, 183, 3, 0.5)',
                    color: 'var(--accent-gold)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Retry fetching live leaderboard"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              )}
            </div>
          )}

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
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', overflowX: 'auto', border: '1px solid var(--border-glass)', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                <thead>
                  {isSetView ? (
                    <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 900 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          <span>RANK / PLAYER</span>
                          <span style={{ color: 'var(--accent-gold)' }}>FASTEST 1ST ATTEMPT</span>
                        </div>
                      </th>
                      <th style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        color: 'var(--accent-cyan)',
                        fontWeight: 900
                      }}>
                        MOST POINTS PER ANY ATTEMPT
                      </th>
                    </tr>
                  ) : (
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
                  )}
                </thead>
                <tbody>
                  {topLeaderboardEntries.length === 0 ? (
                    <tr>
                      <td colSpan={isSetView ? 2 : 4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records yet. Complete a stage set to submit your score!
                      </td>
                    </tr>
                  ) : (
                    topLeaderboardEntries.slice(0, 25).map((entry, index) => {
                      const isLocal = Boolean(entry.isCurrentPlayer);
                      const playerSet = isLocal ? getPlayerSetStats(selectedLeaderboardSet) : null;
                      const isFirstFailed = (isLocal && (playerSet?.firstFailed || playerSet?.firstTime === 'failed'))
                        || entry.firstTime === 'failed'
                        || Boolean(entry.firstFailed);

                      const firstTimeMs = (isLocal && playerSet && typeof playerSet.firstTime === 'number')
                        ? playerSet.firstTime
                        : (typeof entry.firstTime === 'number' ? entry.firstTime : entry.avgFirstTimeByPack?.[selectedLeaderboardPack]);
                      const repeatTimeMs = entry.repeatTime || entry.avgRepeatTimeByPack?.[selectedLeaderboardPack] || entry.avgTimesByPack?.[selectedLeaderboardPack];
                      const fastestTimeMs = entry.fastestTime || entry.fastestTimeByPack?.[selectedLeaderboardPack];

                      // Only highlight row as "YOU" if the player actually has a recorded time, score, or attempt
                      const hasRecord = isSetView
                        ? Boolean(playerSet?.clears || playerSet?.bestScore || isFirstFailed || typeof firstTimeMs === 'number' || typeof repeatTimeMs === 'number')
                        : Boolean(entry.clears || entry.totalSetsCleared || (typeof firstTimeMs === 'number' && firstTimeMs > 0) || (typeof repeatTimeMs === 'number' && repeatTimeMs > 0) || (typeof fastestTimeMs === 'number' && fastestTimeMs > 0));

                      const isMe = isLocal && hasRecord;

                      const firstTimeStr = isFirstFailed
                        ? 'Failed'
                        : (typeof firstTimeMs === 'number' && firstTimeMs > 0 ? `${(firstTimeMs / 1000).toFixed(2)}s` : '--');
                      const overallTimeStr = typeof repeatTimeMs === 'number' && repeatTimeMs > 0 ? `${(repeatTimeMs / 1000).toFixed(2)}s` : '--';
                      const fastestTimeStr = typeof fastestTimeMs === 'number' && fastestTimeMs > 0 ? `${(fastestTimeMs / 1000).toFixed(2)}s` : '--';
                      const displayName = entry.playerName || `SPEEDRUNNER #${index + 1}`;

                      const effectiveMostPoints = playerSet?.bestScore
                        || playerSet?.lastScore
                        || (playerSet?.totalPoints && playerSet?.clears ? Math.round(playerSet.totalPoints / playerSet.clears) : null)
                        || entry.mostPoints
                        || (typeof entry.totalPoints === 'number' && entry.totalPoints > 0 ? (entry.clears ? Math.round(entry.totalPoints / entry.clears) : entry.totalPoints) : null)
                        || (fastestTimeMs ? Math.max(1200, Math.round(2500 - (fastestTimeMs / 1000) * 35)) : null);
                      const pointsStr = typeof effectiveMostPoints === 'number' && effectiveMostPoints > 0 ? `${effectiveMostPoints.toLocaleString()} PTS` : '--';

                      if (isSetView) {
                        return (
                          <tr
                            key={entry.uid || index}
                            style={{
                              background: isMe ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.05)'
                            }}
                          >
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: index === 0 ? 'var(--accent-gold)' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'var(--text-muted)', fontWeight: 900 }}>
                                    #{index + 1}
                                  </span>
                                  <span style={{ fontWeight: 800, color: isMe ? 'var(--accent-cyan)' : '#fff' }}>
                                    {displayName}
                                  </span>
                                </div>
                                <span style={{
                                  fontFamily: 'var(--font-mono)',
                                  color: isFirstFailed ? 'var(--accent-pink)' : 'var(--accent-gold)',
                                  fontWeight: 900,
                                  fontSize: '0.96rem'
                                }}>
                                  {firstTimeStr}
                                </span>
                              </div>
                            </td>
                            <td style={{
                              padding: '12px 14px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--accent-cyan)',
                              fontWeight: 900,
                              fontSize: '0.96rem'
                            }}>
                              {pointsStr}
                            </td>
                          </tr>
                        );
                      }

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
                            color: isFirstFailed ? 'var(--accent-pink)' : 'var(--accent-gold)',
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
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', minHeight: '380px', boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={22} color="var(--accent-gold)" />
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.5px' }}>
                  SET OF THE DAY LEADERBOARD
                </h3>
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
                    trackDailyChallengeClicked({ source: 'progress_modal', date: getTodayDateString() });
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
                <div style={{ fontSize: '0.83rem', fontWeight: 900, color: '#fff' }}>
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

          {/* Top 5 Times Table */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', overflowX: 'auto', border: '1px solid var(--border-glass)', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '12px 14px' }}>RANK / PLAYER</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>RATING</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>TOTAL TIME</th>
                </tr>
              </thead>
              <tbody>
                {dailyBoard.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No times recorded yet for today. Be the first to clear the Set of the Day!
                    </td>
                  </tr>
                ) : (
                  dailyBoard.slice(0, 5).map((entry, index) => {
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
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '20px', minHeight: '380px', boxSizing: 'border-box' }}>
          {/* Overall Summary Stat Cards */}
          {(() => {
            const allSets = getAllRecordedSets();
            const totalClears = allSets.reduce((sum, s) => sum + (s.clears || 0), 0);
            const totalPoints = allSets.reduce((sum, s) => sum + (s.totalPoints || 0), 0);
            const avgPointsOverall = totalClears > 0 ? Math.round(totalPoints / totalClears) : 0;
            const bestOverallTimeMs = allSets.reduce((best, s) => {
              const t = s.firstTime;
              const numericTime = typeof t === 'number' && t > 0 ? t : null;
              return numericTime && (!best || numericTime < best) ? numericTime : best;
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
                    <Timer size={14} /> FASTEST 1ST ATTEMPT
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

          {debugMode && onResetLocalRecords && (
            <button
              onClick={() => {
                sounds.playTap();
                onResetLocalRecords();
              }}
              className="glass-btn"
              style={{
                marginTop: '16px',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.82rem',
                fontWeight: 800,
                color: 'var(--accent-pink)',
                borderColor: 'rgba(255, 0, 127, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} /> Reset My Local Records
            </button>
          )}
        </div>
      )}
    </div>
  );
}
