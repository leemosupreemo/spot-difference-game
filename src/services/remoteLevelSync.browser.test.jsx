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

const remoteSync = await import('./remoteLevelSync.js');

describe('remote level synchronization in a browser', () => {
  beforeEach(() => {
    remoteSync.clearCachedRemoteLevels();
    getDocs.mockClear();
    getDocsFromServer.mockClear();
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
});
