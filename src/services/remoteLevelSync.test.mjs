import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCachedRemoteLevels,
  saveCachedRemoteLevels,
  clearCachedRemoteLevels,
  subscribeToRemoteLevels,
  syncRemoteLevelPacks
} from './remoteLevelSync.js';

test('remoteLevelSync starts with empty cached levels after clear', () => {
  clearCachedRemoteLevels();
  const cached = getCachedRemoteLevels();
  assert.ok(Array.isArray(cached));
  assert.equal(cached.length, 0);
});

test('saveCachedRemoteLevels validates and saves valid remote levels', () => {
  clearCachedRemoteLevels();

  const mockRemoteLevel = {
    id: 'remote_nature_001',
    title: 'Remote Mountain Stream',
    category: 'Photography',
    pack: 'Photography',
    packId: 'find_the_sniper',
    difficulty: 'Medium',
    baseImage: '/levels/photo-pairs/mountain_base.jpg',
    variantImage: '/levels/photo-pairs/mountain_variant.jpg',
    diffs: [
      {
        id: 1,
        x: 45.0,
        y: 60.0,
        radius: 5.5,
        description: 'Single stone color shift',
        hint: 'Look near (45%, 60%)'
      }
    ]
  };

  const saved = saveCachedRemoteLevels([mockRemoteLevel]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 'remote_nature_001');

  const retrieved = getCachedRemoteLevels();
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0].title, 'Remote Mountain Stream');
});

test('saveCachedRemoteLevels filters out invalid entries', () => {
  clearCachedRemoteLevels();

  const invalidLevel = {
    id: '',
    title: 'Invalid',
    baseImage: 'not_an_image'
  };

  const saved = saveCachedRemoteLevels([invalidLevel]);
  assert.equal(saved.length, 0);
});

test('subscribeToRemoteLevels notifies subscribers when remote levels change', () => {
  clearCachedRemoteLevels();
  const notifications = [];

  const unsubscribe = subscribeToRemoteLevels(entries => {
    notifications.push(entries.length);
  });

  const validLevel = {
    id: 'remote_sub_001',
    title: 'Subscriber Test Level',
    category: 'Photography',
    pack: 'Photography',
    packId: 'find_the_sniper',
    difficulty: 'Easy',
    baseImage: '/levels/test_base.jpg',
    variantImage: '/levels/test_variant.jpg',
    diffs: [{ id: 1, x: 50, y: 50, radius: 6 }]
  };

  saveCachedRemoteLevels([validLevel]);
  clearCachedRemoteLevels();

  assert.ok(notifications.length >= 2);
  assert.equal(notifications[notifications.length - 1], 0);

  if (typeof unsubscribe === 'function') {
    unsubscribe();
  }
});

test('syncRemoteLevelPacks runs safely in test/offline environment', async () => {
  const result = await syncRemoteLevelPacks();
  assert.ok(Array.isArray(result));
});
