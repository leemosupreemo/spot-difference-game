/**
 * Read Firestore documents over plain HTTPS.
 * ================================================================================
 * The Firestore SDK talks to the backend over WebChannel, or long polling when
 * told to. Inside the app's WKWebView neither connects, and the SDK's response
 * to that is not an error -- it treats an unreachable backend as "offline" and
 * retries forever, so the promise simply never settles. Raising timeouts and
 * forcing long polling both failed for that reason: there was nothing to wait
 * for.
 *
 * Remote level packs are public, read-only documents. Fetching them needs none
 * of the SDK's machinery -- no listeners, no offline queue, no auth. A plain GET
 * against the REST API returns the same data in half a second, uses the same
 * transport as every other successful request the app makes, and fails with a
 * real error instead of hanging.
 *
 * This is deliberately read-only. Writes and anything needing live updates stay
 * on the SDK.
 * ================================================================================
 */

const REST_ROOT = 'https://firestore.googleapis.com/v1';

/**
 * Firestore REST wraps every value in its type. Unwrap to plain JS.
 * Integers arrive as strings because JSON cannot hold a 64-bit int.
 */
export function decodeValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields || {});
  // An unknown type is dropped rather than guessed; the caller validates anyway.
  return undefined;
}

export function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    const decoded = decodeValue(value);
    if (decoded !== undefined) out[key] = decoded;
  }
  return out;
}

/** Turn a REST list response into plain documents. */
export function decodeDocuments(payload) {
  return (payload?.documents || []).map(doc => ({
    id: String(doc.name || '').split('/').pop(),
    ...decodeFields(doc.fields)
  }));
}

/**
 * List a collection over HTTPS.
 * Rejects on a bad response or timeout -- it never hangs, which is the whole
 * point of using this instead of the SDK here.
 */
export async function listCollection(collectionPath, {
  projectId,
  apiKey,
  timeoutMs = 10000,
  pageSize = 100,
  fetchImpl = (typeof fetch === 'function' ? fetch : null)
} = {}) {
  if (!projectId || !apiKey) throw new Error('listCollection needs projectId and apiKey');
  if (!fetchImpl) throw new Error('No fetch implementation available');

  const documents = [];
  let pageToken = '';
  // Bounded rather than while(true): a malformed nextPageToken must not spin.
  for (let page = 0; page < 20; page++) {
    const url = `${REST_ROOT}/projects/${projectId}/databases/(default)/documents/`
      + `${collectionPath}?key=${encodeURIComponent(apiKey)}&pageSize=${pageSize}`
      + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response;
    try {
      response = await fetchImpl(url, { method: 'GET', signal: controller?.signal });
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!response?.ok) {
      throw new Error(`Firestore REST ${collectionPath} failed: ${response?.status ?? 'no response'}`);
    }
    const payload = await response.json();
    documents.push(...decodeDocuments(payload));
    pageToken = payload?.nextPageToken || '';
    if (!pageToken) break;
  }
  return documents;
}
