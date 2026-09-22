/**
 * Debug Mode Environment & Gating Utility
 * ================================================================================
 * For the dev branch / dev URLs (e.g. diffhunter--dev-*.web.app, localhost, 127.0.0.1),
 * debug mode is ALWAYS enabled by default unless explicitly specified otherwise.
 *
 * Can be overridden:
 * - Via URL parameter: ?debug=0 or ?debug=false (to disable), ?debug=1 or ?debug=true (to enable)
 * - Via localStorage: diff_hunter_debug = 'true' | 'false'
 * ================================================================================
 */

import { Capacitor } from '@capacitor/core';

export function isDevEnvironment() {
  try {
    // Native mobile app containers (Capacitor on iOS / Android) run from localhost internally.
    // They are native production builds, NOT browser dev environments!
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
      return false;
    }

    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname || '';
      if (
        hostname.includes('--dev') ||
        hostname.includes('-dev.') ||
        hostname.includes('localhost') ||
        hostname.includes('127.0.0.1') ||
        hostname.endsWith('.local')
      ) {
        return true;
      }
    }

    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (
        import.meta.env.DEV ||
        import.meta.env.MODE === 'development' ||
        import.meta.env.VITE_IS_DEV_CHANNEL === 'true' ||
        import.meta.env.VITE_DEV_MODE === 'true'
      ) {
        return true;
      }
    }
  } catch (_) {}

  return false;
}

/**
 * Whether this build permits debug mode at all.
 *
 * This is deliberately a build-time decision. Every runtime route in -- the
 * triple-tap on the logo, ?debug=1, the diff_hunter_debug localStorage key -- is
 * reachable by anyone holding the app, so the gate has to live somewhere a player
 * cannot get at: the bundle itself. App Store builds and production web ship with
 * this false and have no way in, whatever they tap or type.
 *
 * Internal channels opt in explicitly:
 *   VITE_ENABLE_DEBUG=true   Firebase App Distribution builds for testers
 *   VITE_IS_DEV_CHANNEL=true the dev hosting channel
 *   VITE_FORCE_DEBUG=true    a build that starts already in debug mode
 *   import.meta.env.DEV      the Vite dev server
 */
export function debugFeaturesEnabled() {
  try {
    const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;

    // No import.meta.env means this is not a bundled build at all -- the Node
    // test runner, where suites exercise debug-only behaviour by mocking
    // window.location. Every build the player can install is a Vite build and
    // always has env, so this branch cannot be reached from a shipped app.
    if (!env) return true;

    if (env.VITE_ENABLE_DEBUG === 'true') return true;
    if (env.VITE_IS_DEV_CHANNEL === 'true') return true;
    if (env.VITE_FORCE_DEBUG === 'true') return true;
    if (env.DEV === true || env.MODE === 'development') return true;
  } catch (_) {}

  return false;
}

export function getInitialDebugMode() {
  // Checked before anything else: a URL parameter or a stale localStorage value
  // must not be able to reopen this in a build that shipped without it.
  if (!debugFeaturesEnabled()) return false;

  try {
    // Release builds intended for internal testing can force debug on. This
    // takes precedence over stale localStorage opt-outs from older builds.
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FORCE_DEBUG === 'true') {
      return true;
    }

    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      const debugQuery = urlParams.get('debug');

      // 1. Explicit URL parameter override has highest priority
      if (debugQuery === '0' || debugQuery === 'false' || debugQuery === 'no' || debugQuery === 'off') {
        return false;
      }
      if (debugQuery === '1' || debugQuery === 'true' || debugQuery === 'yes' || debugQuery === 'on') {
        return true;
      }

      // 2. Explicit localStorage preference
      const stored = localStorage.getItem('diff_hunter_debug');
      if (stored === 'false') return false;
      if (stored === 'true') return true;

      // 3. Dev environment / dev URL default
      if (isDevEnvironment()) {
        return true;
      }
    }
  } catch (_) {}

  return false;
}
