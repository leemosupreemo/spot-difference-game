import { Capacitor } from '@capacitor/core';

/**
 * Checks if a given User-Agent string and touch point count represents a mobile or tablet device.
 * Useful for pure testing without relying on browser globals.
 *
 * @param {string} userAgent
 * @param {number} maxTouchPoints
 * @returns {boolean}
 */
export function isMobileUA(userAgent = '', maxTouchPoints = 0) {
  if (!userAgent) return false;
  
  // Standard mobile / tablet user agents
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    return true;
  }

  // iPadOS Safari on iOS 13+ reports as Macintosh desktop but with multi-touch points
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) {
    return true;
  }

  return false;
}

/**
 * Determines whether the current client is a mobile device (phone or tablet),
 * either running as a native app (Capacitor iOS/Android) or on mobile web.
 *
 * Supports query parameters for testing/overriding:
 *   - ?splash=1 / ?splash=true: Forces mobile splash screen
 *   - ?splash=0 / ?splash=false: Skips splash screen
 *   - ?device=<phone|tablet>: Simulates mobile device
 *
 * @returns {boolean}
 */
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;

  // 1. URL search param overrides
  try {
    const params = new URLSearchParams(window.location.search);
    const splashParam = params.get('splash');
    if (splashParam === '1' || splashParam === 'true') return true;
    if (splashParam === '0' || splashParam === 'false') return false;

    const deviceParam = params.get('device');
    if (deviceParam && deviceParam !== 'full') return true;
  } catch {}

  // 2. Simulator harness active device check
  try {
    const simDevice = window.localStorage?.getItem('diff_hunter_sim_device');
    if (simDevice && simDevice !== 'full') {
      const isSimEnabled = window.localStorage?.getItem('diff_hunter_sim_flag') === 'true' ||
        new URLSearchParams(window.location.search).has('sim') ||
        new URLSearchParams(window.location.search).has('simulator');
      if (isSimEnabled) return true;
    }
  } catch {}

  // 3. Native Capacitor platform (iOS, Android)
  try {
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.()) {
      return true;
    }
    if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.()) {
      return true;
    }
  } catch {}

  // 4. Mobile user agent check
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  if (isMobileUA(ua, touchPoints)) {
    return true;
  }

  // 5. Coarse pointer + mobile/tablet screen dimension check
  try {
    const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches || touchPoints > 0;
    const isMobileViewport = window.innerWidth <= 1024 && (window.innerWidth <= 844 || window.innerHeight <= 500);
    if (hasCoarsePointer && isMobileViewport) {
      return true;
    }
  } catch {}

  return false;
}
