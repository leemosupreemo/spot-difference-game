import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhotoPairStage,
  clearPhotoPairManifestCache,
  createPhotoPairLevel,
  selectPhotoPairEntries,
  resolveAssetUrl,
  getAllPhotoPairEntries,
  getEntryAspectBucket
} from './photoPairLevelLoader.js';
import {
  saveCachedRemoteLevels,
  clearCachedRemoteLevels
} from '../services/remoteLevelSync.js';

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

test('resolveAssetUrl preserves remote HTTPS and HTTP URLs and prefixes relative paths', () => {
  assert.equal(resolveAssetUrl('https://firebasestorage.googleapis.com/v0/b/app/image.jpg'), 'https://firebasestorage.googleapis.com/v0/b/app/image.jpg');
  assert.equal(resolveAssetUrl('http://example.com/levels/sample.jpg'), 'http://example.com/levels/sample.jpg');
  assert.equal(resolveAssetUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), 'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  assert.equal(resolveAssetUrl('/levels/sample.jpg'), './levels/sample.jpg');
  assert.equal(resolveAssetUrl('levels/sample.jpg'), './levels/sample.jpg');
  assert.equal(resolveAssetUrl(null), null);
});

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
  const statusMap = {
    market_001: { status: 'approved' },
    market_002: { status: 'approved' },
    easy_001: { status: 'approved' }
  };
  const selected = selectPhotoPairEntries(entries, {
    packId: 'find_the_sniper',
    difficulty: 'Hard',
    count: 2,
    seed: 1,
    statusMap
  });

  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map(item => item.id)).size, 2);
  assert.deepEqual(selected.map(item => item.difficulty), ['Hard', 'Hard']);
});

test('excludes never-reviewed levels from live selection entirely', () => {
  const unreviewedEntry = { ...entry, id: 'unreviewed_001' };
  const approvedEntry = { ...entry, id: 'approved_001' };
  const entries = [unreviewedEntry, approvedEntry];
  const statusMap = {
    approved_001: { status: 'approved', packId: 'find_the_sniper' }
  };

  const selected = selectPhotoPairEntries(entries, {
    packId: 'find_the_sniper',
    difficulty: 'Hard',
    count: 2,
    seed: 1,
    statusMap
  });

  assert.equal(selected.length, 1, 'A level with no curation status must never reach live selection');
  assert.equal(selected[0].id, 'approved_001');
});

test('uses a curator category designation when selecting a manifest entry', () => {
  // selectPhotoPairEntries applies applyCuratedPackOverrides internally, so
  // the same statusMap must be passed to it directly (not pre-applied) --
  // it's also what makes the entry approved and therefore eligible at all.
  const statusMap = {
    market_001: { status: 'approved', packId: 'abstract_animated', pack: 'Abstract' }
  };
  const selected = selectPhotoPairEntries([entry], {
    packId: 'abstract_animated',
    difficulty: 'Hard',
    count: 1,
    seed: 1,
    statusMap
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].packId, 'abstract_animated');
  assert.equal(selected[0].pack, 'Abstract');
});

test('getAllPhotoPairEntries merges cached remote levels and deduplicates by ID', () => {
  clearCachedRemoteLevels();
  const initialEntries = getAllPhotoPairEntries();
  const initialCount = initialEntries.length;

  const mockRemoteNew = {
    id: 'remote_brand_new_level_999',
    title: 'Remote Mountain Peak',
    category: 'Photography',
    pack: 'Photography',
    packId: 'find_the_sniper',
    difficulty: 'Medium',
    baseImage: 'https://firebasestorage.googleapis.com/base.jpg',
    variantImage: 'https://firebasestorage.googleapis.com/variant.jpg',
    diffs: [{ id: 1, x: 50, y: 50, radius: 5 }]
  };

  // Mock duplicate ID of an existing local level
  const firstLocalId = initialEntries[0].id;
  const mockRemoteDuplicate = {
    id: firstLocalId,
    title: 'Duplicate Local Title',
    category: 'Photography',
    pack: 'Photography',
    packId: 'find_the_sniper',
    difficulty: 'Easy',
    baseImage: '/levels/dup_base.jpg',
    variantImage: '/levels/dup_variant.jpg',
    diffs: [{ id: 1, x: 40, y: 40, radius: 5 }]
  };

  saveCachedRemoteLevels([mockRemoteNew, mockRemoteDuplicate]);

  const mergedEntries = getAllPhotoPairEntries();
  assert.equal(mergedEntries.length, initialCount + 1, 'Should add exactly 1 new remote level and skip duplicate ID');

  const foundNew = mergedEntries.find(e => e.id === 'remote_brand_new_level_999');
  assert.ok(foundNew, 'New remote level should be found in merged manifest');
  assert.equal(foundNew.title, 'Remote Mountain Peak');

  // Clean up
  clearCachedRemoteLevels();
  const restoredEntries = getAllPhotoPairEntries();
  assert.equal(restoredEntries.length, initialCount);
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
    curatedStatusMap: { market_001: { status: 'approved' } },
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

test('builds the requested photo set in sequence order regardless of difficulty', async () => {
  const setEntries = [
    { ...entry, id: 'set_entry_005', setId: 'photo_set_test', sequence: 5, difficulty: 'Medium' },
    { ...entry, id: 'set_entry_001', setId: 'photo_set_test', sequence: 1, difficulty: 'Easy' },
    { ...entry, id: 'set_entry_003', setId: 'photo_set_test', sequence: 3, difficulty: 'Hard' },
    { ...entry, id: 'set_entry_002', setId: 'photo_set_test', sequence: 2, difficulty: 'Medium' },
    { ...entry, id: 'set_entry_004', setId: 'photo_set_test', sequence: 4, difficulty: 'Easy' }
  ];
  const fetchImpl = async () => ({
    ok: true,
    json: async () => setEntries
  });

  const easyStage = await buildPhotoPairStage({
    packId: 'find_the_sniper',
    setId: 'photo_set_test',
    difficulty: 'Easy',
    count: 5,
    fetchImpl,
    curatedStatusMap: {}
  });
  const hardStage = await buildPhotoPairStage({
    packId: 'find_the_sniper',
    setId: 'photo_set_test',
    difficulty: 'Hard',
    count: 5,
    fetchImpl,
    curatedStatusMap: {}
  });

  const expectedIds = ['set_entry_001', 'set_entry_002', 'set_entry_003', 'set_entry_004', 'set_entry_005'];
  assert.deepEqual(easyStage.map(item => item.id), expectedIds);
  assert.deepEqual(hardStage.map(item => item.id), expectedIds);
});

test('rejects a requested set that is incomplete within the requested pack', async () => {
  const mixedPackSet = [
    { ...entry, id: 'photo_001', setId: 'photo_set_mixed', sequence: 1 },
    { ...entry, id: 'photo_002', setId: 'photo_set_mixed', sequence: 2 },
    { ...entry, id: 'abstract_003', setId: 'photo_set_mixed', sequence: 3, packId: 'abstract_animated' },
    { ...entry, id: 'photo_004', setId: 'photo_set_mixed', sequence: 4 },
    { ...entry, id: 'photo_005', setId: 'photo_set_mixed', sequence: 5 }
  ];

  const stage = await buildPhotoPairStage({
    packId: 'find_the_sniper',
    setId: 'photo_set_mixed',
    count: 5,
    fetchImpl: async () => ({ ok: true, json: async () => mixedPackSet }),
    curatedStatusMap: {}
  });

  assert.deepEqual(stage, []);
});

test('treats an explicitly empty set ID as invalid instead of using legacy selection', async () => {
  const stage = await buildPhotoPairStage({
    packId: 'find_the_sniper',
    setId: '',
    count: 5,
    fetchImpl: async () => ({ ok: true, json: async () => [entry] }),
    curatedStatusMap: {}
  });

  assert.deepEqual(stage, []);
});

test('returns no stage when the requested photo set is incomplete', async () => {
  const incompleteSet = [
    { ...entry, id: 'set_entry_001', setId: 'photo_set_incomplete', sequence: 1 },
    { ...entry, id: 'set_entry_002', setId: 'photo_set_incomplete', sequence: 2 }
  ];

  const stage = await buildPhotoPairStage({
    packId: 'find_the_sniper',
    setId: 'photo_set_incomplete',
    difficulty: 'Medium',
    count: 3,
    fetchImpl: async () => ({
      ok: true,
      json: async () => incompleteSet
    }),
    curatedStatusMap: {}
  });

  assert.deepEqual(stage, []);
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
    curatedStatusMap: {
      bad_market_001: { status: 'approved' },
      good_market_001: { status: 'approved' }
    },
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

test('getEntryAspectBucket correctly categorizes 4:3 high-res, 4:3 standard, and widescreen', () => {
  // High-res 4:3 (1200x896)
  assert.equal(getEntryAspectBucket({ dimensions: { width: 1200, height: 896 }, aspectRatio: '4:3' }), 0);
  // Standard/Legacy 4:3 (640x480)
  assert.equal(getEntryAspectBucket({ dimensions: { width: 640, height: 480 }, aspectRatio: '4:3' }), 1);
  // Widescreen 16:9 (1376x768)
  assert.equal(getEntryAspectBucket({ dimensions: { width: 1376, height: 768 }, aspectRatio: '16:9' }), 2);
  // Default mock entry without dimension metadata -> treated as 4:3 high-res
  assert.equal(getEntryAspectBucket({}), 0);
});

test('selectPhotoPairEntries prioritizes full-frame 4:3 images over 16:9 widescreen images', () => {
  const widescreenEntry = {
    ...entry,
    id: 'widescreen_v7_001',
    dimensions: { width: 1376, height: 768 },
    aspectRatio: '16:9'
  };
  const fullFrame43Entry = {
    ...entry,
    id: 'fullframe_43_001',
    dimensions: { width: 1200, height: 896 },
    aspectRatio: '4:3'
  };

  // Even if widescreen entry is placed first in input array
  const entries = [widescreenEntry, fullFrame43Entry];
  const statusMap = {
    widescreen_v7_001: { status: 'approved' },
    fullframe_43_001: { status: 'approved' }
  };
  const selected = selectPhotoPairEntries(entries, {
    packId: 'find_the_sniper',
    difficulty: 'Hard',
    count: 2,
    statusMap
  });

  assert.equal(selected.length, 2);
  assert.equal(selected[0].id, 'fullframe_43_001', '4:3 full-frame photo must be prioritized first to match Generated mode size');
  assert.equal(selected[1].id, 'widescreen_v7_001', '16:9 widescreen photo must be placed second');
});

test('createPhotoPairLevel retains dimensions and aspectRatio properties', () => {
  const customEntry = {
    ...entry,
    dimensions: { width: 1200, height: 896 },
    aspectRatio: '4:3'
  };
  const level = createPhotoPairLevel(customEntry);
  assert.deepEqual(level.dimensions, { width: 1200, height: 896 });
  assert.equal(level.aspectRatio, '4:3');
});

test('pending levels never reach production through the requested-set path', async () => {
  // The default stage path already requires an explicit 'approved' status
  // (selectPhotoPairEntries). The requested-set path does not, so it is the
  // one that could serve an unreviewed level. Both must now be gated.
  const mk = (id, sequence, extra = {}) => ({
    id, title: id, category: 'Photography', pack: 'Find the Sniper',
    packId: 'find_the_sniper', difficulty: 'Medium', operation: 'recolor',
    setId: 'gate_set_1', sequence,
    baseImage: `levels/${id}_base.webp`, variantImage: `levels/${id}_variant.webp`,
    diffs: [{ id: 1, x: 50, y: 50, radius: 5, operation: 'recolor' }], ...extra
  });
  // Five entries make one complete set; four are pending review.
  const manifest = [
    mk('setgate_1', 1, { curationStatus: 'pending' }),
    mk('setgate_2', 2, { curationStatus: 'pending' }),
    mk('setgate_3', 3, { curationStatus: 'pending' }),
    mk('setgate_4', 4, { curationStatus: 'pending' }),
    mk('setgate_5', 5)
  ];
  const fetchImpl = async () => ({ ok: true, json: async () => manifest });
  const imageFactory = () => {
    const img = {};
    setTimeout(() => img.onload && img.onload(), 0);
    return img;
  };

  const { getPhotoSetCatalog } = await import('./photoSetCatalog.js');
  const setId = getPhotoSetCatalog(manifest, { setSize: 5 }).sets[0]?.setId;
  assert.ok(setId, 'fixture should form one complete set');

  const stageIds = async (statusMap, debugMode) => {
    const stage = await buildPhotoPairStage({
      fetchImpl, imageFactory, curatedStatusMap: statusMap, debugMode,
      setId, count: 5, seed: 1
    });
    return stage.map(level => level.id);
  };

  // Production: the set is no longer complete once pending entries are hidden,
  // so nothing is served -- and critically no pending level is served.
  const prod = await stageIds({}, false);
  for (const id of ['setgate_1', 'setgate_2', 'setgate_3', 'setgate_4']) {
    assert.ok(!prod.includes(id), `pending level ${id} leaked into production via the set path`);
  }

  // Debug: the reviewer can play the whole set to judge it.
  const debug = await stageIds({}, true);
  assert.equal(debug.length, 5, 'debug mode must expose the full pending set for review');
});

test('approving a pending level in debug is what promotes it', async () => {
  const entry = { id: 'promote_me', curationStatus: 'pending' };
  const { isEntryPlayable } = await import('./pendingLevelGate.js');

  assert.equal(isEntryPlayable(entry, {}, false), false, 'unreviewed: hidden in production');
  assert.equal(isEntryPlayable(entry, {}, true), true, 'unreviewed: visible in debug');
  assert.equal(isEntryPlayable(entry, { promote_me: 'approved' }, false), true,
    'approved in debug: now live');
});

test('offline withholds online-only sets from both selection paths', async () => {
  const mk = (id, setId, sequence) => ({
    id, title: id, category: 'Photography', pack: 'Find the Sniper',
    packId: 'find_the_sniper', difficulty: 'Medium', operation: 'recolor',
    setId, sequence,
    baseImage: `https://host/levels/${id}_base.webp`,
    variantImage: `https://host/levels/${id}_variant.webp`,
    diffs: [{ id: 1, x: 50, y: 50, radius: 5, operation: 'recolor' }]
  });
  const manifest = [
    ...[1, 2, 3, 4, 5].map(n => mk(`bundled_${n}`, 'photo_set_900', n)),
    ...[1, 2, 3, 4, 5].map(n => mk(`remote_${n}`, 'remote_set_900', n))
  ];
  const fetchImpl = async () => ({ ok: true, json: async () => manifest });
  const imageFactory = () => {
    const img = {};
    setTimeout(() => img.onload && img.onload(), 0);
    return img;
  };
  const approved = Object.fromEntries(manifest.map(e => [e.id, 'approved']));

  const ids = async (setId, online) => {
    const stage = await buildPhotoPairStage({
      fetchImpl, imageFactory, curatedStatusMap: approved,
      debugMode: false, online, setId, count: 5, seed: 1
    });
    return stage.map(l => l.id);
  };

  // Set path: the online-only set is unavailable offline, the bundled one works.
  assert.equal((await ids('remote_set_900', false)).length, 0,
    'an online-only set must not start while offline');
  assert.equal((await ids('remote_set_900', true)).length, 5);
  assert.equal((await ids('photo_set_900', false)).length, 5,
    'a bundled set must still work offline');

  // Non-set path: it ignores setId entirely, so it needs the same filter or
  // remote levels leak into a stage that cannot load.
  const loose = await buildPhotoPairStage({
    fetchImpl, imageFactory, curatedStatusMap: approved,
    debugMode: false, online: false, count: 5, seed: 1
  });
  assert.ok(!loose.some(l => String(l.id).startsWith('remote_')),
    'offline stage must contain no online-only levels');
});

test('a placeholder slot is served without any image request', async () => {
  const placeholder = {
    id: 'remote_set_901_placeholder_05', title: 'Coming soon', category: 'Photography',
    pack: 'Find the Sniper', packId: 'find_the_sniper', difficulty: 'Medium',
    setId: 'remote_set_901', sequence: 5, isPlaceholder: true,
    placeholderMessage: 'Sorry, this image could not be loaded.', diffs: []
  };
  const real = (n) => ({
    id: `r_${n}`, title: `r${n}`, category: 'Photography', pack: 'Find the Sniper',
    packId: 'find_the_sniper', difficulty: 'Medium', setId: 'remote_set_901', sequence: n,
    baseImage: `https://host/${n}_base.webp`, variantImage: `https://host/${n}_variant.webp`,
    diffs: [{ id: 1, x: 50, y: 50, radius: 5, operation: 'recolor' }]
  });
  const manifest = [real(1), real(2), real(3), real(4), placeholder];
  const requested = [];
  const imageFactory = () => {
    const img = {};
    Object.defineProperty(img, 'src', {
      set(value) { requested.push(value); setTimeout(() => img.onload && img.onload(), 0); }
    });
    return img;
  };
  const stage = await buildPhotoPairStage({
    fetchImpl: async () => ({ ok: true, json: async () => manifest }),
    imageFactory,
    curatedStatusMap: Object.fromEntries(manifest.map(e => [e.id, 'approved'])),
    debugMode: false, online: true, setId: 'remote_set_901', count: 5, seed: 1
  });

  assert.equal(stage.length, 5, 'the padded set is still a complete five');
  const slot = stage.find(l => l.isPlaceholder);
  assert.ok(slot, 'the placeholder must survive into the stage');
  assert.deepEqual(slot.diffs, [], 'nothing to find in a placeholder');
  assert.ok(!requested.some(u => String(u).includes('placeholder')),
    'a placeholder must never trigger an image request');
  assert.equal(requested.length, 8, 'only the four real levels are fetched');
});

test('a stage never serves two levels from the same photo back to back', async () => {
  const { hasAdjacentRepeat } = await import('./stageOrdering.js');
  const mk = (id, base, sequence) => ({
    id, title: id, category: 'Photography', pack: 'Find the Sniper',
    packId: 'find_the_sniper', difficulty: 'Medium', operation: 'recolor',
    setId: 'photo_set_950', sequence,
    baseImage: `levels/${base}_base.webp`,
    variantImage: `levels/${id}_variant.webp`,
    diffs: [{ id: 1, x: 50, y: 50, radius: 5, operation: 'recolor' }]
  });
  // Three of five share one photo and arrive consecutively -- the worst case
  // that is still separable.
  const manifest = [
    mk('t1', 'tar', 1), mk('t2', 'tar', 2), mk('t3', 'tar', 3),
    mk('s1', 'solo_a', 4), mk('s2', 'solo_b', 5)
  ];
  const imageFactory = () => {
    const img = {};
    setTimeout(() => img.onload && img.onload(), 0);
    return img;
  };
  const stage = await buildPhotoPairStage({
    fetchImpl: async () => ({ ok: true, json: async () => manifest }),
    imageFactory,
    curatedStatusMap: Object.fromEntries(manifest.map(e => [e.id, 'approved'])),
    debugMode: false, online: true, setId: 'photo_set_950', count: 5, seed: 1
  });

  assert.equal(stage.length, 5, 'every level is still served');
  assert.equal(hasAdjacentRepeat(stage), false, 'same-photo levels must be spaced apart');
  assert.deepEqual(stage.map(l => l.id).sort(), ['s1', 's2', 't1', 't2', 't3']);
});

// --- stage preloading is concurrent -------------------------------------
// A five-level set is ten images. Fetched one after another that is ten
// round trips before play starts, which is what remote sets now pay.

const preloadEntry = (id, sequence) => ({
  id,
  title: `Preload ${id}`,
  category: 'Photography',
  packId: 'find_the_sniper',
  setId: 'photo_set_preload',
  sequence,
  difficulty: 'Medium',
  baseImage: `levels/${id}_base.jpg`,
  variantImage: `levels/${id}_variant.jpg`,
  diffs: [{ id: 1, x: 50, y: 50, radius: 5 }]
});

/**
 * An image whose load is deferred until the test releases it, so a stage can
 * only finish if every pair was in flight at the same time.
 */
function gatedImageFactory() {
  const pending = [];
  const factory = () => {
    const img = {};
    Object.defineProperty(img, 'src', {
      set(value) {
        this._src = value;
        pending.push(() => this.onload?.());
      },
      get() { return this._src; }
    });
    return img;
  };
  return { factory, pending };
}

test('a stage preloads all of its pairs concurrently', async () => {
  clearPhotoPairManifestCache();
  const manifest = [1, 2, 3, 4, 5].map(n => preloadEntry(`preload_00${n}`, n));
  const approved = Object.fromEntries(manifest.map(e => [e.id, { status: 'approved' }]));
  const { factory, pending } = gatedImageFactory();

  const stagePromise = buildPhotoPairStage({
    fetchImpl: async () => ({ ok: true, json: async () => manifest }),
    imageFactory: factory,
    curatedStatusMap: approved,
    setId: 'photo_set_preload',
    count: 5,
    seed: 1
  });

  // Let the loader start every request it intends to make.
  await new Promise(resolve => setTimeout(resolve, 0));

  // Sequentially only the first pair would be in flight. All five must be.
  assert.equal(pending.length, 10,
    `expected 10 images in flight at once, saw ${pending.length}`);

  pending.forEach(release => release());
  const stage = await stagePromise;
  assert.equal(stage.length, 5);
  assert.deepEqual(stage.map(l => l.id), manifest.map(e => e.id));
});

test('a pair that fails to load is replaced by the next candidate', async () => {
  clearPhotoPairManifestCache();
  // Seven candidates for a five-level stage; two of them never load.
  const manifest = [1, 2, 3, 4, 5, 6, 7].map(n => preloadEntry(`fallible_00${n}`, n));
  const approved = Object.fromEntries(manifest.map(e => [e.id, { status: 'approved' }]));
  const broken = new Set(['fallible_002', 'fallible_004']);

  const imageFactory = () => {
    const img = {};
    Object.defineProperty(img, 'src', {
      set(value) {
        this._src = value;
        const fails = [...broken].some(id => value.includes(id));
        queueMicrotask(() => (fails ? img.onerror?.(new Error('boom')) : img.onload?.()));
      },
      get() { return this._src; }
    });
    return img;
  };

  const stage = await buildPhotoPairStage({
    fetchImpl: async () => ({ ok: true, json: async () => manifest }),
    imageFactory,
    curatedStatusMap: approved,
    packId: 'find_the_sniper',
    difficulty: 'Medium',
    count: 5,
    seed: 1
  });

  assert.equal(stage.length, 5);
  for (const id of broken) {
    assert.ok(!stage.some(level => level.id === id), `${id} should not be seated`);
  }
});

// --- the daily challenge must be able to find its own levels ---------------

test('daily-reserved levels are withheld from regular play but available on request', async () => {
  const { getAllPhotoPairEntries } = await import('./photoPairLevelLoader.js');
  const regular = getAllPhotoPairEntries();
  const withDaily = getAllPhotoPairEntries({ includeDailyOnly: true });
  const dailyIds = withDaily.filter(e => String(e.id).startsWith('daily_set_')).map(e => e.id);

  assert.ok(dailyIds.length > 0, 'the manifest should carry daily-reserved levels');
  for (const id of dailyIds) {
    assert.ok(!regular.some(e => e.id === id), `${id} must stay out of regular play`);
  }
});

test('every level the daily queue schedules can actually be resolved', async () => {
  // Set of the Day resolves its ids against getAllPhotoPairEntries. When that
  // filtered daily-reserved levels out, none of them resolved and the
  // challenge could not start -- the reservation broke the thing it protects.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'public/daily-queue.json'), 'utf8'));

  const needed = [...new Set([
    ...(queue.queue || []).flatMap(set => set.levels || []),
    ...Object.values(queue.schedule || {}).flat()
  ])].filter(id => typeof id === 'string');

  const { getAllPhotoPairEntries } = await import('./photoPairLevelLoader.js');
  const available = new Set(getAllPhotoPairEntries({ includeDailyOnly: true }).map(e => e.id));
  const custom = new Set((queue.customLevels || []).map(l => l.id || l));

  const missing = needed.filter(id => !available.has(id) && !custom.has(id));
  assert.deepEqual(missing, [], `daily queue references levels that cannot be resolved: ${missing.join(', ')}`);
});
