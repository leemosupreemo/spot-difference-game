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

export function isDevEnvironment() {
  try {
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

export function getInitialDebugMode() {
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
