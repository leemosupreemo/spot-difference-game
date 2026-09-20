/**
 * Shared Firestore handle with a transport that survives WebViews.
 * ================================================================================
 * Firestore's default transport is WebChannel, a streaming connection. It is
 * fast where it works, and it hangs where something between the app and Google
 * mangles long-lived streams -- Capacitor's WKWebView, corporate proxies, some
 * VPNs and content blockers. The symptom is not an error but silence: reads that
 * can be answered from cache appear fine, while `getDocsFromServer`, which
 * refuses the cache, waits forever. That is exactly how the remote pack refresh
 * failed on device while the identical query returned in under a second from
 * Node.
 *
 * `experimentalAutoDetectLongPolling` probes the connection and falls back to
 * long polling when the stream does not establish, so the same code works in a
 * browser and in the native shell.
 *
 * This has to be the only place Firestore is started. `initializeFirestore`
 * throws once `getFirestore` has run against the same app, so scattered
 * `getFirestore` calls would silently keep the default transport -- whichever
 * ran first would win, depending on import order.
 * ================================================================================
 */

import { getFirestore, initializeFirestore } from 'firebase/firestore';

const clients = new WeakMap();

/**
 * The Firestore instance for a Firebase app, started with long-polling
 * auto-detection the first time it is requested.
 */
export function getFirestoreClient(app) {
  if (!app) throw new Error('getFirestoreClient needs a Firebase app');
  const existing = clients.get(app);
  if (existing) return existing;

  let db;
  try {
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch (_) {
    // Firestore was already started for this app -- by an earlier call here in
    // another bundle chunk, or by a direct getFirestore somewhere. Use what
    // exists rather than failing; the settings simply do not apply.
    db = getFirestore(app);
  }
  clients.set(app, db);
  return db;
}
