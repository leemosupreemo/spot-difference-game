// Detects the modal screenshot harness (see ScreenshotHarness.jsx / capture_modal_screenshots.mjs)
// so services can skip real network calls: keeps visual regression captures deterministic and
// stops screenshot runs from writing fake completions into production Firestore.
export function isScreenshotHarnessMode() {
  if (typeof window === 'undefined' || !window.location) return false;
  return new URLSearchParams(window.location.search).has('screenshotModal');
}
