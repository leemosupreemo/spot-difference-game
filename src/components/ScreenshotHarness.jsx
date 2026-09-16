import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { WifiOff } from 'lucide-react';
import VictoryModal from './VictoryModal.jsx';
import DailyVictoryModal from './DailyVictoryModal.jsx';
import ConfirmExitModal from './ConfirmExitModal.jsx';
import GameOverModal from './GameOverModal.jsx';
import ProgressModal from './ProgressModal.jsx';
import HelpModal from './HelpModal.jsx';
import RatingModal from './RatingModal.jsx';
import ShareChallengeModal from './ShareChallengeModal.jsx';
import SetOfTheDayBanner from './SetOfTheDayBanner.jsx';
import { SCREENSHOT_MODALS } from './screenshotModals.js';
export { SCREENSHOT_MODALS };

export default function ScreenshotHarness({ modalId }) {
  useEffect(() => {
    // If fanfare is requested, fire burst of golden confetti
    if (modalId === 'victory-fanfare') {
      const colors = ['#FFD700', '#FFA500', '#FFFFFF', '#FFDF00'];
      confetti({
        particleCount: 75,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors,
        disableForReducedMotion: false
      });
      const t = setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 60,
          origin: { x: 0.1, y: 0.6 },
          colors
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 60,
          origin: { x: 0.9, y: 0.6 },
          colors
        });
      }, 200);
      return () => clearTimeout(t);
    }
  }, [modalId]);

  const activeId = modalId || 'gallery';

  const renderModalContent = () => {
    switch (activeId) {
      case 'offline-banner':
        return (
          <div style={{ padding: '24px 16px', maxWidth: '440px', margin: '40px auto' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              background: 'rgba(255, 183, 3, 0.14)',
              border: '1.5px solid rgba(255, 183, 3, 0.55)',
              borderRadius: '14px',
              color: 'var(--accent-gold)',
              boxShadow: '0 0 25px rgba(255, 183, 3, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 700 }}>
                <WifiOff size={20} />
                <span>
                  <strong>Offline Mode:</strong> Showing cached records. Scores will sync once reconnected.
                </span>
              </div>
              <button className="glass-btn" style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 800, borderRadius: '10px', flexShrink: 0 }}>
                Retry
              </button>
            </div>
          </div>
        );

      case 'daily-banner-unattempted':
        return (
          <div style={{ padding: '30px 16px', maxWidth: '440px', margin: '40px auto' }}>
            <SetOfTheDayBanner
              playerStatus={{ completed: false, attempted: false, failed: false }}
              onPlayDaily={() => {}}
              onOpenStats={() => {}}
            />
          </div>
        );

      case 'daily-banner-completed':
        return (
          <div style={{ padding: '30px 16px', maxWidth: '440px', margin: '40px auto' }}>
            <SetOfTheDayBanner
              playerStatus={{ completed: true, attempted: true, failed: false }}
              onPlayDaily={() => {}}
              onOpenStats={() => {}}
            />
          </div>
        );

      case 'victory-standard':
        return (
          <VictoryModal
            isOpen={true}
            isStageSet={true}
            elapsedTime={24300}
            score={1420}
            setId="photo_set_001"
            setNumber={1}
            attemptNumber={1}
            onClose={() => {}}
            onNextLevel={() => {}}
            onRestart={() => {}}
            onOpenLeaderboard={() => {}}
          />
        );

      case 'victory-world-1st':
        return (
          <VictoryModal
            isOpen={true}
            isStageSet={true}
            elapsedTime={12150}
            score={1890}
            setId="photo_set_001"
            setNumber={1}
            attemptNumber={1}
            onClose={() => {}}
            onNextLevel={() => {}}
            onRestart={() => {}}
            onOpenLeaderboard={() => {}}
          />
        );

      case 'victory-new-record':
        return (
          <VictoryModal
            isOpen={true}
            isStageSet={true}
            elapsedTime={14800}
            score={1750}
            isNewRecord={true}
            isPersonalBestForSet={true}
            setId="photo_set_001"
            setNumber={1}
            attemptNumber={2}
            onClose={() => {}}
            onNextLevel={() => {}}
            onRestart={() => {}}
            onOpenLeaderboard={() => {}}
          />
        );

      case 'victory-leaderboard':
        return (
          <VictoryModal
            isOpen={true}
            isStageSet={true}
            elapsedTime={12150}
            score={1890}
            setId="photo_set_001"
            setNumber={1}
            attemptNumber={1}
            onClose={() => {}}
            onNextLevel={() => {}}
            onRestart={() => {}}
            onOpenLeaderboard={() => {}}
          />
        );

      case 'victory-name-editing':
        return (
          <VictoryModal
            isOpen={true}
            isStageSet={true}
            elapsedTime={12150}
            score={1890}
            setId="photo_set_001"
            setNumber={1}
            attemptNumber={1}
            initialEditingName={true}
            onClose={() => {}}
            onNextLevel={() => {}}
            onRestart={() => {}}
            onOpenLeaderboard={() => {}}
          />
        );

      case 'victory-fanfare':
        return (
          <VictoryModal
            isOpen={true}
            isStageSet={true}
            elapsedTime={12150}
            score={1890}
            setId="photo_set_001"
            setNumber={1}
            isNewRecord={true}
            isPersonalBestForSet={true}
            onClose={() => {}}
            onNextLevel={() => {}}
            onRestart={() => {}}
            onOpenLeaderboard={() => {}}
          />
        );

      case 'victory-offline':
        return (
          <VictoryModal
            isOpen={true}
            isStageSet={true}
            elapsedTime={12150}
            score={1890}
            setId="photo_set_001"
            setNumber={1}
            forceOffline={true}
            onClose={() => {}}
            onNextLevel={() => {}}
            onRestart={() => {}}
            onOpenLeaderboard={() => {}}
          />
        );

      case 'daily-victory-success':
        return (
          <DailyVictoryModal
            isOpen={true}
            totalTimeMs={18420}
            position={2}
            percentile={97}
            stars={3}
            score={1490}
            setId="photo_set_004"
            setNumber={4}
            onClose={() => {}}
            onOpenLeaderboard={() => {}}
            onRestart={() => {}}
          />
        );

      case 'daily-victory-failed':
        return (
          <DailyVictoryModal
            isOpen={true}
            totalTimeMs={22100}
            isFailed={true}
            isForfeit={false}
            setId="photo_set_004"
            setNumber={4}
            onClose={() => {}}
            onOpenLeaderboard={() => {}}
            onRestart={() => {}}
          />
        );

      case 'daily-victory-forfeited':
        return (
          <DailyVictoryModal
            isOpen={true}
            totalTimeMs={15400}
            isFailed={true}
            isForfeit={true}
            setId="photo_set_004"
            setNumber={4}
            onClose={() => {}}
            onOpenLeaderboard={() => {}}
            onRestart={() => {}}
          />
        );

      case 'daily-victory-name-editing':
        return (
          <DailyVictoryModal
            isOpen={true}
            totalTimeMs={18420}
            position={2}
            percentile={97}
            stars={3}
            score={1490}
            setId="photo_set_004"
            setNumber={4}
            initialEditingName={true}
            onClose={() => {}}
            onOpenLeaderboard={() => {}}
            onRestart={() => {}}
          />
        );

      case 'confirm-exit-standard':
        return (
          <ConfirmExitModal
            isOpen={true}
            isDaily={false}
            onConfirm={() => {}}
            onCancel={() => {}}
          />
        );

      case 'confirm-exit-daily':
        return (
          <ConfirmExitModal
            isOpen={true}
            isDaily={true}
            onConfirm={() => {}}
            onCancel={() => {}}
          />
        );

      case 'game-over':
        return (
          <GameOverModal
            isOpen={true}
            seconds={45.2}
            levelTitle="Antique Watchmaker - Set 2"
            onRestart={() => {}}
            onClose={() => {}}
          />
        );

      case 'share-challenge':
        return (
          <ShareChallengeModal
            isOpen={true}
            onClose={() => {}}
            challengeUrl="https://diff-hunter.web.app/?c=d_photo_set_001_1842"
            elapsedTime={18420}
            difficulty="Medium"
            themeId="find_the_sniper"
          />
        );

      case 'help':
        return (
          <HelpModal
            isOpen={true}
            onClose={() => {}}
          />
        );

      case 'rating':
        return (
          <RatingModal
            isOpen={true}
            onClose={() => {}}
          />
        );

      case 'progress-leaderboards':
        return (
          <ProgressModal
            isOpen={true}
            initialTab="leaderboards"
            onClose={() => {}}
          />
        );

      case 'progress-daily':
        return (
          <ProgressModal
            isOpen={true}
            initialTab="daily"
            onClose={() => {}}
          />
        );

      case 'progress-my-progress':
        return (
          <ProgressModal
            isOpen={true}
            initialTab="progress"
            onClose={() => {}}
          />
        );

      case 'progress-offline':
        return (
          <ProgressModal
            isOpen={true}
            initialTab="leaderboards"
            forceOffline={true}
            onClose={() => {}}
          />
        );

      default:
        // Gallery mode
        return (
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px', color: '#fff' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px', background: 'linear-gradient(90deg, #fff, var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Modal & Menu Screenshot Harness
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
              Select any modal or state below to inspect or capture:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {SCREENSHOT_MODALS.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    const u = new URL(window.location);
                    u.searchParams.set('screenshotModal', m.id);
                    window.location = u.toString();
                  }}
                  className="glass-panel"
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '1px solid var(--border-glass)',
                    color: '#fff'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {m.category}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '4px' }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {m.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className="screenshot-harness"
      data-testid="screenshot-harness"
      data-modal-id={activeId}
      style={{
        minHeight: '100dvh',
        width: '100%',
        background: '#0a0a14',
        color: '#fff',
        boxSizing: 'border-box'
      }}
    >
      {renderModalContent()}
    </div>
  );
}
