import * as Sentry from '@sentry/capacitor';
import * as SentryReact from '@sentry/react';
import { Capacitor } from '@capacitor/core';
import { logApp } from '../utils/logger.js';

let isSentryInitialized = false;

/**
 * Initialize Sentry for web and native iOS hybrid monitoring.
 * Safely handles missing DSN in development, test environments, and server-side rendering.
 */
export function initSentry() {
  if (isSentryInitialized) return;

  const isTest = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
  if (isTest || typeof window === 'undefined') {
    isSentryInitialized = true;
    return;
  }

  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  const dsn = env.VITE_SENTRY_DSN;

  if (!dsn) {
    logApp('INFO', '[Sentry] VITE_SENTRY_DSN not set. Sentry running in passive local mode.');
    isSentryInitialized = true;
    return;
  }

  try {
    const isDev = Boolean(env.DEV);
    const isNative = typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
    const isPluginAvailable = typeof Capacitor !== 'undefined' && typeof Capacitor.isPluginAvailable === 'function' && Capacitor.isPluginAvailable('SentryCapacitor');
    const enableNative = Boolean(isNative && isPluginAvailable);

    const integrations = [
      SentryReact.browserTracingIntegration(),
    ];

    // Replay integration is only supported on desktop/standard web browser contexts.
    // WKWebView in Capacitor iOS should not run browser replay.
    if (!isNative && typeof SentryReact.replayIntegration === 'function') {
      integrations.push(
        SentryReact.replayIntegration({
          maskAllText: false,
          blockAllMedia: false
        })
      );
    }

    Sentry.init({
      dsn,
      environment: env.MODE || (isDev ? 'development' : 'production'),
      release: `diff-hunter@${env.VITE_APP_VERSION || '1.0.0'}`,
      enableNative,
      enableNativeNagger: false,
      integrations,
      // Performance Monitoring: Sample 100% in dev, 20% in production
      tracesSampleRate: isDev ? 1.0 : 0.2,
      // Session Replay: Only on web
      replaysSessionSampleRate: isDev ? 0.0 : (isNative ? 0.0 : 0.1),
      replaysOnErrorSampleRate: isNative ? 0.0 : 1.0,
      // Filter out noisy browser extension or third-party iframe errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        'Load failed'
      ],
      beforeSend(event, hint) {
        if (isDev) {
          console.debug('[Sentry beforeSend]', event, hint);
        }
        return event;
      }
    }, SentryReact.init);

    isSentryInitialized = true;
    logApp('INFO', `[Sentry] Initialized successfully. (native: ${enableNative})`);
  } catch (err) {
    console.error('[Sentry] Initialization error:', err);
  }
}

/**
 * Capture an exception with optional extra context tags.
 */
export function captureError(error, context = {}) {
  logApp('ERROR', `[Sentry.captureError] ${error?.message || error}`, JSON.stringify(context));
  try {
    return Sentry.captureException(error, {
      extra: context
    });
  } catch (_) {
    return null;
  }
}

/**
 * Capture a diagnostic or warning message.
 */
export function captureMessage(message, level = 'info', context = {}) {
  try {
    return Sentry.captureMessage(message, {
      level,
      extra: context
    });
  } catch (_) {
    return null;
  }
}

/**
 * Attach user or device identity to Sentry events.
 */
export function setSentryUser(userId, userDetails = {}) {
  try {
    Sentry.setUser(userId ? { id: userId, ...userDetails } : null);
  } catch (_) {}
}

/**
 * Add a custom breadcrumb for debugging gameplay sequences.
 */
export function addBreadcrumb(breadcrumb) {
  try {
    Sentry.addBreadcrumb(breadcrumb);
  } catch (_) {}
}

export { Sentry, SentryReact };
