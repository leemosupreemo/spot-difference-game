import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Mobile Splash / Launch Screen
 *
 * Displays on mobile devices upon application startup:
 * 1. Shows Diff Hunter app logo & title label.
 * 2. Staggers in "The Jaunt Co." icon and label underneath.
 * 3. Holds briefly so players can easily read it.
 * 4. Fades out smoothly to reveal the homescreen (MainMenu).
 *
 * Tapping anywhere allows the player to skip directly to the homescreen.
 */
export default function SplashScreen({
  onFinish,
  initialDelay = 400,
  holdDuration = 1350,
  fadeDuration = 550
}) {
  // 'diff-hunter' -> 'jaunt-co' -> 'fade-out' -> 'done'
  const [stage, setStage] = useState('diff-hunter');
  const [isDismissed, setIsDismissed] = useState(false);

  // Step 1: Reveal Jaunt Co. underneath
  useEffect(() => {
    const jauntTimer = setTimeout(() => {
      setStage('jaunt-co');
    }, initialDelay);

    return () => clearTimeout(jauntTimer);
  }, [initialDelay]);

  // Step 2: Start fade out
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setStage('fade-out');
    }, initialDelay + holdDuration);

    return () => clearTimeout(fadeTimer);
  }, [initialDelay, holdDuration]);

  // Step 3: Complete dismiss after fade out
  useEffect(() => {
    if (stage !== 'fade-out') return;

    const completeTimer = setTimeout(() => {
      setIsDismissed(true);
      if (onFinish) onFinish();
    }, fadeDuration);

    return () => clearTimeout(completeTimer);
  }, [stage, fadeDuration, onFinish]);

  // Quick skip on tap / click
  const handleSkip = useCallback(() => {
    if (stage === 'fade-out' || isDismissed) return;
    setStage('fade-out');
  }, [stage, isDismissed]);

  if (isDismissed) {
    return null;
  }

  const isJauntVisible = stage === 'jaunt-co' || stage === 'fade-out';
  const isFading = stage === 'fade-out';

  const splashContent = (
    <div
      role="region"
      aria-label="Diff Hunter by The Jaunt Co."
      onClick={handleSkip}
      onTouchStart={handleSkip}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        minWidth: '100vw',
        height: '100dvh',
        minHeight: '100%',
        margin: 0,
        zIndex: 9999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090a10',
        backgroundImage: 'radial-gradient(ellipse at 50% 45%, #18122c 0%, #090a10 65%, #050609 100%)',
        opacity: isFading ? 0 : 1,
        transition: `opacity ${fadeDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        pointerEvents: isFading ? 'none' : 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        padding: '24px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Central Brand Unit */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
          transform: isFading ? 'scale(1.02)' : 'scale(1)',
          transition: `transform ${fadeDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`
        }}
      >
        {/* Diff Hunter App Logo */}
        <div
          style={{
            position: 'relative',
            marginBottom: '16px'
          }}
        >
          <img
            src="/app-icon.png"
            alt="Diff Hunter Logo"
            style={{
              width: 'clamp(60px, 14vw, 84px)',
              height: 'clamp(60px, 14vw, 84px)',
              borderRadius: '20px',
              display: 'block',
              boxShadow: '0 0 35px rgba(0, 240, 255, 0.45), 0 0 60px rgba(255, 0, 128, 0.25)',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              background: '#0e111a'
            }}
          />
        </div>

        {/* Diff Hunter Title Label */}
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.5rem, 5vw, 2.2rem)',
            fontWeight: 900,
            letterSpacing: '0.12em',
            lineHeight: 1.1,
            background: 'linear-gradient(90deg, #ffffff 0%, #00f0ff 70%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 24px rgba(0, 240, 255, 0.35)'
          }}
        >
          DIFF HUNTER
        </h1>

        {/* Jaunt Co. Section Underneath */}
        <div
          style={{
            marginTop: 'clamp(28px, 6vh, 44px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isJauntVisible ? 1 : 0,
            transform: isJauntVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 420ms cubic-bezier(0.16, 1, 0.3, 1), transform 420ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.4)',
              fontWeight: 600,
              marginBottom: '6px'
            }}
          >
            A Game By
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <img
              src="/jaunt-logo-cropped.png"
              alt="The Jaunt Co."
              onError={(e) => {
                // Fallback to original jaunt-logo.png if cropped fails
                e.currentTarget.src = '/jaunt-logo.png';
              }}
              style={{
                height: 'clamp(38px, 8vw, 52px)',
                width: 'auto',
                maxWidth: '200px',
                objectFit: 'contain',
                opacity: 0.92,
                filter: 'drop-shadow(0 0 16px rgba(255, 255, 255, 0.22))'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(splashContent, document.body);
  }

  return splashContent;
}
