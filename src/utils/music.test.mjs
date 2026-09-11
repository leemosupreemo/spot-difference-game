import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BGM_TRACKS,
  INTER_TRACK_PAUSE_MS,
  resolveMusicUrl,
  generateShuffledIndices,
  MusicController
} from './music.js';

test('BGM_TRACKS includes all 4 user tracks', () => {
  assert.equal(BGM_TRACKS.length, 4);
  const titles = BGM_TRACKS.map(t => t.title);
  assert.ok(titles.includes('Night Circuit Run'));
  assert.ok(titles.includes('Neon Pulse'));
  assert.ok(titles.includes('Neon Horizon'));
  assert.ok(titles.includes('Night Circuit Run-2'));
});

test('INTER_TRACK_PAUSE_MS is exactly 15 seconds', () => {
  assert.equal(INTER_TRACK_PAUSE_MS, 15000);
});

test('resolveMusicUrl encodes spaces properly and prefixes music folder', () => {
  const url = resolveMusicUrl('Night Circuit Run.m4a');
  assert.equal(url, './music/Night%20Circuit%20Run.m4a');
});

test('generateShuffledIndices produces a complete permutation of all 4 tracks', () => {
  for (let run = 0; run < 20; run++) {
    const indices = generateShuffledIndices(4);
    assert.equal(indices.length, 4);
    const sorted = [...indices].sort((a, b) => a - b);
    assert.deepEqual(sorted, [0, 1, 2, 3]);
  }
});

test('generateShuffledIndices avoids starting with previous last index when possible', () => {
  for (let run = 0; run < 30; run++) {
    const lastIndex = 2;
    const indices = generateShuffledIndices(4, lastIndex);
    assert.notEqual(indices[0], lastIndex);
  }
});

test('MusicController initializes with clean state and safe SSR handling', () => {
  const controller = new MusicController();
  const state = controller.getState();
  assert.equal(state.isPlaying, false);
  assert.equal(state.muted, false);
  assert.equal(state.volume, 0.35);
  assert.equal(state.currentTrack, null);
  assert.equal(state.isWaitingForNext, false);
});

test('MusicController mute controls toggle and set correctly', () => {
  const controller = new MusicController();
  assert.equal(controller.isMuted(), false);
  
  const toggled = controller.toggleMute();
  assert.equal(toggled, true);
  assert.equal(controller.isMuted(), true);

  controller.setMuted(false);
  assert.equal(controller.isMuted(), false);
});

test('MusicController setVolume clamps values between 0.0 and 1.0', () => {
  const controller = new MusicController();
  controller.setVolume(1.5);
  assert.equal(controller.getVolume(), 1.0);

  controller.setVolume(-0.2);
  assert.equal(controller.getVolume(), 0.0);

  controller.setVolume(0.5);
  assert.equal(controller.getVolume(), 0.5);
});

test('MusicController cycles through all tracks and resets queue', () => {
  const controller = new MusicController(BGM_TRACKS, 50);
  controller.start();
  assert.equal(controller.queue.length, 4);
  assert.equal(controller.queueIndex, 0);

  const playedTracks = [];
  playedTracks.push(controller.getCurrentTrack().title);

  // Advance track 1 -> 2
  controller.skip();
  assert.equal(controller.queueIndex, 1);
  playedTracks.push(controller.getCurrentTrack().title);

  // Advance track 2 -> 3
  controller.skip();
  assert.equal(controller.queueIndex, 2);
  playedTracks.push(controller.getCurrentTrack().title);

  // Advance track 3 -> 4
  controller.skip();
  assert.equal(controller.queueIndex, 3);
  playedTracks.push(controller.getCurrentTrack().title);

  // All 4 distinct tracks were played in this cycle
  const uniquePlayed = new Set(playedTracks);
  assert.equal(uniquePlayed.size, 4);

  // Next skip triggers a new cycle!
  controller.skip();
  assert.equal(controller.queueIndex, 0);
  assert.equal(controller.queue.length, 4);
});
