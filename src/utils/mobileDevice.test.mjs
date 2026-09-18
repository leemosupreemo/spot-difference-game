import assert from 'node:assert/strict';
import test from 'node:test';
import { isMobileUA, isMobileDevice } from './mobileDevice.js';

test('isMobileUA identifies iPhone user agents as mobile', () => {
  const iPhoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  assert.strictEqual(isMobileUA(iPhoneUA, 5), true);
});

test('isMobileUA identifies Android user agents as mobile', () => {
  const androidUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
  assert.strictEqual(isMobileUA(androidUA, 5), true);
});

test('isMobileUA identifies iPad user agents as mobile', () => {
  const iPadUA = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
  assert.strictEqual(isMobileUA(iPadUA, 5), true);
});

test('isMobileUA identifies iPadOS desktop-spoofing user agent as mobile when multi-touch is present', () => {
  const iPadOSMacUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  // With multi-touch points > 1, iPadOS is recognized as mobile
  assert.strictEqual(isMobileUA(iPadOSMacUA, 5), true);
  // Without multi-touch points, regular macOS desktop Safari is NOT mobile
  assert.strictEqual(isMobileUA(iPadOSMacUA, 0), false);
});

test('isMobileUA identifies desktop browsers as non-mobile', () => {
  const macDesktopUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  const windowsDesktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  assert.strictEqual(isMobileUA(macDesktopUA, 0), false);
  assert.strictEqual(isMobileUA(windowsDesktopUA, 0), false);
  assert.strictEqual(isMobileUA('', 0), false);
});

test('isMobileDevice returns false safely when no window is present (SSR/test runner)', () => {
  assert.strictEqual(isMobileDevice(), false);
});
