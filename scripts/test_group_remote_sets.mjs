import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRemoteSets } from './group_remote_sets.mjs';
import { isPlaceholderEntry } from '../src/utils/remoteSetPolicy.js';

const levels = (n) => Array.from({ length: n }, (_, i) => ({ id: `lvl_${i + 1}` }));

test('splits into fives and numbers sets from 001', () => {
  const sets = buildRemoteSets(levels(10));
  assert.deepEqual(sets.map(s => s.setId), ['remote_set_001', 'remote_set_002']);
  assert.ok(sets.every(s => s.levels.length === 5));
  assert.ok(sets.every(s => s.levels.every(l => !isPlaceholderEntry(l))));
});

test('every level carries its set id and a 1-5 sequence', () => {
  const [set] = buildRemoteSets(levels(5));
  assert.deepEqual(set.levels.map(l => l.sequence), [1, 2, 3, 4, 5]);
  assert.ok(set.levels.every(l => l.setId === 'remote_set_001'));
});

test('a short final set is padded so it is still a complete five', () => {
  // All 28 share no base image here, so allocation packs them 5,5,5,5,5,3.
  const sets = buildRemoteSets(levels(28));
  assert.equal(sets.length, 6);
  const last = sets[5];
  assert.equal(last.realCount, 3);
  assert.equal(last.levels.length, 5);
  assert.deepEqual(last.levels.map(isPlaceholderEntry), [false, false, false, true, true]);
  assert.deepEqual(last.levels.map(l => l.sequence), [1, 2, 3, 4, 5]);
  assert.ok(last.levels.every(l => l.setId === 'remote_set_006'));
});

test('padding never touches a full set', () => {
  const sets = buildRemoteSets(levels(25));
  assert.equal(sets.length, 5);
  assert.ok(sets.flatMap(s => s.levels).every(l => !isPlaceholderEntry(l)));
});

test('a single level still yields one complete padded set', () => {
  const [set] = buildRemoteSets(levels(1));
  assert.equal(set.levels.length, 5);
  assert.equal(set.realCount, 1);
  assert.equal(set.levels.filter(isPlaceholderEntry).length, 4);
});

test('no approved levels means no sets at all', () => {
  assert.deepEqual(buildRemoteSets([]), []);
});

test('level ids stay unique across the whole grouping', () => {
  const all = buildRemoteSets(levels(28)).flatMap(s => s.levels);
  assert.equal(new Set(all.map(l => l.id)).size, all.length);
});

test('the original entries are not mutated', () => {
  const source = levels(3);
  buildRemoteSets(source);
  assert.ok(source.every(l => !('setId' in l) && !('sequence' in l)));
});

// --- spreading allocation -----------------------------------------------

const withBase = (id, base) => ({ id, baseImage: `levels/${base}_base.webp` });

test('variants of one photo are spread across sets, never stacked', async () => {
  const { allocateSets, baseKey } = await import('./group_remote_sets.mjs');
  // The shape that caused the bug: four views of one photo arriving together.
  const levels = [
    ...[1, 2, 3, 4].map(n => withBase(`tarantula_v${n}`, 'tarantula')),
    ...[1, 2, 3, 4].map(n => withBase(`fiber_v${n}`, 'fiber')),
    ...[1, 2, 3].map(n => withBase(`gem_v${n}`, 'gem')),
    ...Array.from({ length: 14 }, (_, i) => withBase(`solo_${i}`, `solo_${i}`))
  ];
  const sets = allocateSets(levels, 5);
  for (const set of sets) {
    const bases = set.map(baseKey);
    assert.equal(new Set(bases).size, bases.length,
      `a set repeated a photo: ${bases.join(', ')}`);
  }
  assert.equal(sets.flat().length, levels.length, 'no level may be dropped');
});

test('the real 28-level shape yields sets with no repeated photo', async () => {
  const { allocateSets, baseKey } = await import('./group_remote_sets.mjs');
  // Group sizes measured from the live pool: 4,4,3,2,2,2,2 then nine singles.
  const sizes = [4, 4, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const levels = sizes.flatMap((n, g) =>
    Array.from({ length: n }, (_, i) => withBase(`g${g}_v${i}`, `photo_${g}`)));
  assert.equal(levels.length, 28);

  const sets = allocateSets(levels, 5);
  assert.equal(sets.length, 6);
  for (const set of sets) {
    assert.equal(new Set(set.map(baseKey)).size, set.length);
  }
});

test('buildRemoteSets pads the smallest set and reports repeats', async () => {
  const { buildRemoteSets } = await import('./group_remote_sets.mjs');
  const sizes = [4, 4, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const levels = sizes.flatMap((n, g) =>
    Array.from({ length: n }, (_, i) => withBase(`g${g}_v${i}`, `photo_${g}`)));
  const sets = buildRemoteSets(levels);

  assert.ok(sets.every(s => s.levels.length === 5));
  assert.ok(sets.every(s => s.repeatedBases === 0), 'no set may repeat a photo');
  // The padded set sorts last, so earlier set numbers stay full.
  assert.equal(sets[sets.length - 1].realCount, 3);
  assert.ok(sets.slice(0, -1).every(s => s.realCount === 5));
  assert.deepEqual(sets.map(s => s.setId),
    ['001', '002', '003', '004', '005', '006'].map(n => `remote_set_${n}`));
});

test('a group too large to spread is reported rather than hidden', async () => {
  const { buildRemoteSets } = await import('./group_remote_sets.mjs');
  // Six copies of one photo but only two sets: repetition is unavoidable.
  const levels = [
    ...Array.from({ length: 6 }, (_, i) => withBase(`same_${i}`, 'same')),
    ...Array.from({ length: 4 }, (_, i) => withBase(`other_${i}`, `other_${i}`))
  ];
  const sets = buildRemoteSets(levels);
  assert.ok(sets.some(s => s.repeatedBases > 0),
    'an impossible pool must surface the repetition, not swallow it');
});

test('packs from a larger previous allocation must not survive a shrink', async () => {
  // The regroup writes 001..005 when five sets remain. A previous run's 006 and
  // 007 are not overwritten, so unless they are deleted they keep serving
  // levels that have just been dismissed.
  const source = await import('node:fs')
    .then(fs => fs.readFileSync(new URL('./group_remote_sets.mjs', import.meta.url), 'utf8'));
  assert.match(source, /writtenPackIds\.add\(packId\)/);
  assert.match(source, /if \(writtenPackIds\.has\(packId\)\) continue;/);
  assert.doesNotMatch(source, /if \(packId\.startsWith\(PACK_PREFIX\)\) continue;/,
    'same-prefix packs must not be skipped when deciding what to remove');
});

test('a level present in two packs is collected once, not allocated twice', async () => {
  const source = await import('node:fs')
    .then(fs => fs.readFileSync(new URL('./group_remote_sets.mjs', import.meta.url), 'utf8'));
  // A superseded pack lingering alongside its replacement means the same level
  // is read twice; allocating both copies publishes one id in two sets.
  assert.match(source, /const seenIds = new Set\(\)/);
  assert.match(source, /if \(!level\?\.id \|\| seenIds\.has\(level\.id\)\) continue;/);
});

test('allocation never places the same level id twice', async () => {
  const { allocateSets } = await import('./group_remote_sets.mjs');
  const levels = Array.from({ length: 23 }, (_, i) => ({
    id: `lvl_${i}`, baseImage: `levels/photo_${i % 6}_base.webp`
  }));
  const placed = allocateSets(levels, 5).flat().map(l => l.id);
  assert.equal(new Set(placed).size, placed.length, 'a level id must appear in one set only');
  assert.equal(placed.length, levels.length);
});

test('packing that would repeat a photo falls back to spreading', async () => {
  const { allocateSets, baseKey } = await import('./group_remote_sets.mjs');
  // The real shape that exposed this: 34 levels from 10 photos, several with
  // five variants. Fullest-first packing strands a large group; spreading does
  // not, and a repeated photograph costs more than an untidy tail.
  const levels = [];
  const sizes = [5, 5, 5, 5, 4, 3, 3, 2, 1, 1];
  sizes.forEach((n, g) => {
    for (let i = 0; i < n; i++) levels.push({ id: `g${g}_${i}`, baseImage: `levels/photo_${g}_base.webp` });
  });
  assert.equal(levels.length, 34);

  const sets = allocateSets(levels, 5);
  const repeats = sets.reduce((t, s) => t + (s.length - new Set(s.map(baseKey)).size), 0);
  assert.equal(repeats, 0, 'no set may show the same photograph twice');
  assert.equal(sets.flat().length, 34, 'and no level may be dropped');
});

test('a regroup keeps levels still awaiting review', async () => {
  // A review batch is deliberately unreviewed. Keeping only approved levels
  // would delete it mid-review.
  const source = await import('node:fs')
    .then(fs => fs.readFileSync(new URL('./group_remote_sets.mjs', import.meta.url), 'utf8'));
  assert.match(source, /if \(recorded === 'dismissed'\) return null;/);
  assert.match(source, /return \{ \.\.\.level, curationStatus: 'pending' \};/);
  assert.doesNotMatch(source, /all\.filter\(l => statusOf\(official\[l\.id\]\) === 'approved'\)/,
    'keeping only approved levels destroys an in-flight review batch');
});

test('an approved level is stamped approved, not left pending', async () => {
  // The gate reads the level's own curationStatus. A level approved in the
  // record but still marked pending stays invisible in production for good.
  const source = await import('node:fs')
    .then(fs => fs.readFileSync(new URL('./group_remote_sets.mjs', import.meta.url), 'utf8'));
  assert.match(source, /recorded === 'approved' \|\| recorded === 'wrong_difficulty'/);
  assert.match(source, /return \{ \.\.\.level, curationStatus: 'approved' \};/);
});

test('awaiting-review levels are kept out of live sets', async () => {
  const { partitionByReviewState } = await import('./group_remote_sets.mjs');
  const levels = [
    { id: 'a', curationStatus: 'approved' },
    { id: 'b', curationStatus: 'pending' },
    { id: 'c', curationStatus: 'approved' },
    { id: 'd' }
  ];
  const { live, review } = partitionByReviewState(levels);
  assert.deepEqual(live.map(l => l.id), ['a', 'c']);
  // Anything not explicitly approved is held back -- a level with no status is
  // not a level a player should meet.
  assert.deepEqual(review.map(l => l.id), ['b', 'd']);
});

test('a set of approved levels is startable in production, a mixed one is not', async () => {
  const { partitionByReviewState, buildRemoteSets } = await import('./group_remote_sets.mjs');
  const mk = (id, status) => ({ id, baseImage: `levels/${id}_base.jpg`, curationStatus: status });
  const kept = [
    ...Array.from({ length: 4 }, (_, i) => mk(`ok${i}`, 'approved')),
    mk('waiting', 'pending')
  ];

  // Grouped together, the one pending level would leave this set holding four
  // in production. Split first and the live set is whole.
  const { live, review } = partitionByReviewState(kept);
  const liveSets = buildRemoteSets(live);
  for (const set of liveSets) {
    const visible = set.levels.filter(l => l.curationStatus === 'pending').length;
    assert.equal(visible, 0, `${set.setId} must hold no level awaiting review`);
  }
  const reviewSets = buildRemoteSets(review, 5, undefined, liveSets.length + 1);
  assert.ok(reviewSets.length > 0, 'the review batch still gets its own set');
  assert.notEqual(reviewSets[0].setId, liveSets[0].setId, 'and it is numbered after the live sets');
});

test('a placeholder is never carried into the next grouping', async () => {
  const { isPublishableLevel } = await import('./group_remote_sets.mjs');
  assert.equal(isPublishableLevel({ id: 'real', baseImage: 'levels/a_base.jpg' }), true);
  assert.equal(isPublishableLevel({ id: 'remote_set_004_placeholder_05', isPlaceholder: true }), false);
  assert.equal(isPublishableLevel({}), false);
});
