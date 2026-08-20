import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhotoPairStage,
  clearPhotoPairManifestCache,
  createPhotoPairLevel,
  applyCuratedPackOverrides,
  selectPhotoPairEntries
} from './photoPairLevelLoader.js';

const entry = {
  id: 'market_001',
  title: 'Cluttered Market Shelf',
  pack: 'Find the Sniper',
  packId: 'find_the_sniper',
  category: 'Extreme Hunter',
  difficulty: 'Hard',
  baseImage: 'levels/photo-pairs/find-the-sniper/market_001/base.webp',
  variantImage: 'levels/photo-pairs/find-the-sniper/market_001/variant.webp',
  diffs: [{ id: 1, x: 63.2, y: 48.7, radius: 4.5 }]
};

test('adapts a manifest entry into the existing level render contract', () => {
  const calls = [];
  const ctx = { drawImage: (...args) => calls.push(args) };
  const level = createPhotoPairLevel(entry, { base: { src: 'base' }, variant: { src: 'variant' } });

  level.render(ctx, 800, 600, false);
  level.render(ctx, 800, 600, true);

  assert.equal(level.totalDifferences, 1);
  assert.equal(level.diffs[0].x, 63.2);
  assert.deepEqual(calls.map(call => call[0].src), ['base', 'variant']);
});

test('selects matching entries by pack and difficulty with no duplicates', () => {
  const entries = [
    entry,
    { ...entry, id: 'market_002' },
    { ...entry, id: 'easy_001', difficulty: 'Easy' }
  ];
  const selected = selectPhotoPairEntries(entries, {
    packId: 'find_the_sniper',
    difficulty: 'Hard',
    count: 2,
    seed: 1
  });

  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map(item => item.id)).size, 2);
  assert.deepEqual(selected.map(item => item.difficulty), ['Hard', 'Hard']);
});

test('prioritizes new non-designated images first before categorized ones', () => {
  const unreviewedEntry = { ...entry, id: 'unreviewed_001' };
  const categorizedEntry = { ...entry, id: 'categorized_001' };
  const entries = [categorizedEntry, unreviewedEntry];
  const statusMap = {
    categorized_001: { status: 'approved', packId: 'find_the_sniper' }
  };

  const selected = selectPhotoPairEntries(entries, {
    packId: 'find_the_sniper',
    difficulty: 'Hard',
    count: 2,
    seed: 1,
    statusMap
  });

  assert.equal(selected.length, 2);
  assert.equal(selected[0].id, 'unreviewed_001', 'Non-designated image must come first');
  assert.equal(selected[1].id, 'categorized_001', 'Categorized image must be deprioritized');
});

test('uses a curator category designation when selecting a manifest entry', () => {
  const reclassified = applyCuratedPackOverrides([entry], {
    market_001: { status: 'approved', packId: 'abstract_animated', pack: 'Fantastical' }
  });
  const selected = selectPhotoPairEntries(reclassified, {
    packId: 'abstract_animated',
    difficulty: 'Hard',
    count: 1,
    seed: 1
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].packId, 'abstract_animated');
  assert.equal(selected[0].pack, 'Fantastical');
});

test('builds a stage from a fetched manifest and loadable image pairs', async () => {
  clearPhotoPairManifestCache();
  const loadedSources = [];
  const stage = await buildPhotoPairStage({
    packId: 'find_the_sniper',
    difficulty: 'Hard',
    count: 1,
    seed: 1,
    fetchImpl: async () => ({
      ok: true,
      json: async () => [entry]
    }),
    imageFactory: () => ({
      set src(value) {
        this._src = value;
        loadedSources.push(value);
        queueMicrotask(() => this.onload?.());
      },
      get src() {
        return this._src;
      }
    })
  });

  assert.equal(stage.length, 1);
  assert.equal(stage[0].id, 'market_001');
  assert.deepEqual(loadedSources, [entry.baseImage, entry.variantImage]);
});

test('continues loading later candidates after an image pair fails', async () => {
  clearPhotoPairManifestCache();
  const badEntry = {
    ...entry,
    id: 'bad_market_001',
    baseImage: '/levels/photo-pairs/find-the-sniper/bad_market_001/base.png',
    variantImage: '/levels/photo-pairs/find-the-sniper/bad_market_001/variant.png'
  };
  const goodEntry = {
    ...entry,
    id: 'good_market_001',
    baseImage: '/levels/photo-pairs/find-the-sniper/good_market_001/base.png',
    variantImage: '/levels/photo-pairs/find-the-sniper/good_market_001/variant.png'
  };

  const stage = await buildPhotoPairStage({
    packId: 'find_the_sniper',
    difficulty: 'Hard',
    count: 1,
    seed: 99999,
    fetchImpl: async () => ({
      ok: true,
      json: async () => [badEntry, goodEntry]
    }),
    imageFactory: () => ({
      set src(value) {
        this._src = value;
        queueMicrotask(() => {
          if (value.includes('/bad_market_001/')) this.onerror?.();
          else this.onload?.();
        });
      },
      get src() {
        return this._src;
      }
    })
  });

  assert.equal(stage.length, 1);
  assert.equal(stage[0].id, 'good_market_001');
});
