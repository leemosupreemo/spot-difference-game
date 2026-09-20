// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const remoteLevel = {
  id: 'remote_refresh_001',
  title: 'Remote Refresh Test',
  category: 'Photography',
  pack: 'Photography',
  packId: 'find_the_sniper',
  difficulty: 'Medium',
  baseImage: 'https://example.com/levels/remote_refresh_001_base.webp',
  variantImage: 'https://example.com/levels/remote_refresh_001_variant.webp',
  diffs: [{ id: 1, x: 50, y: 50, radius: 6 }]
};

const snapshot = {
  size: 1,
  forEach(callback) {
    callback({ data: () => ({ active: true, levels: [remoteLevel] }) });
  }
};

const getDocs = vi.fn(async () => snapshot);
const getDocsFromServer = vi.fn(async () => snapshot);

vi.mock('firebase/app', () => ({
  getApps: () => [{}],
  initializeApp: () => ({})
}));

// Reproduces the iOS failure: anonymous authentication never settles.
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  signInAnonymously: () => new Promise(() => {})
}));

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  getDocs,
  getDocsFromServer,
  getFirestore: () => ({}),
  query: value => value,
  where: () => ({})
}));

// Encode a plain object the way the Firestore REST API returns it, so the
// decoder is exercised rather than bypassed.
function encode(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) fields[k] = encode(v);
    return { mapValue: { fields } };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  return { stringValue: String(value) };
}

const restPayload = {
  documents: [{
    name: 'projects/p/databases/(default)/documents/remote_level_packs/pack_test',
    fields: { active: { booleanValue: true }, levels: encode([remoteLevel]) }
  }]
};

const restFetch = vi.fn(async () => ({ ok: true, json: async () => restPayload }));

const remoteSync = await import('./remoteLevelSync.js');

describe('remote level synchronization in a browser', () => {
  beforeEach(() => {
    remoteSync.clearCachedRemoteLevels();
    getDocs.mockClear();
    getDocsFromServer.mockClear();
    restFetch.mockClear();
    // Packs are read over plain HTTPS; the SDK is only a fallback.
    globalThis.fetch = restFetch;
  });

  test('startup sync reads public packs even when anonymous authentication is stalled', async () => {
    const levels = await remoteSync.syncRemoteLevelPacks(100);

    expect(levels.map(level => level.id)).toEqual(['remote_refresh_001']);
  });

  test('manual refresh requires a server response and replaces the remote cache', async () => {
    const levels = await remoteSync.refreshRemoteLevelPacks(100);

    expect(levels.map(level => level.id)).toEqual(['remote_refresh_001']);
    expect(remoteSync.getCachedRemoteLevels().map(level => level.id)).toEqual(['remote_refresh_001']);
  });
  test('packs are read over plain HTTPS, not the streaming SDK', async () => {
    const levels = await remoteSync.syncRemoteLevelPacks(2000);

    expect(levels.map(level => level.id)).toEqual(['remote_refresh_001']);
    expect(restFetch).toHaveBeenCalled();
    expect(String(restFetch.mock.calls[0][0])).toContain('firestore.googleapis.com');
    // The SDK hangs forever inside the app's WebView, so it must not be the
    // path a healthy sync depends on.
    expect(getDocs).not.toHaveBeenCalled();
    expect(getDocsFromServer).not.toHaveBeenCalled();
  });

  test('a blocked REST request falls back to the SDK rather than giving up', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 403 }));

    const levels = await remoteSync.refreshRemoteLevelPacks(2000);

    expect(levels.map(level => level.id)).toEqual(['remote_refresh_001']);
    expect(getDocsFromServer).toHaveBeenCalled();
  });
});
