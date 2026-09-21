import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLevels } from './audit_published_levels.mjs';

const lvl = (id, over = {}) => ({
  id, setId: 'photo_set_001', sequence: 1,
  baseImage: `levels/${id}_base.webp`, variantImage: `levels/${id}_variant.webp`, ...over
});
const set = (setId, ids, over = () => ({})) =>
  ids.map((id, i) => lvl(id, { setId, sequence: i + 1, ...over(id, i) }));
const hashes = (pairs) => new Map(pairs);
const codes = (f) => f.map(x => x.check).sort();

test('a clean pool reports nothing', () => {
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  const h = hashes(bundled.flatMap(l => [
    [`${l.id}_base.webp`, `b_${l.id}`], [`${l.id}_variant.webp`, `v_${l.id}`]
  ]));
  assert.deepEqual(auditLevels({ bundled, hashes: h }), []);
});

test('a level published in two sets is caught', () => {
  // The real bug: one id allocated into two sets by a double read.
  const bundled = [...set('photo_set_001', ['a', 'b', 'c', 'd', 'e']),
                   ...set('photo_set_002', ['a', 'f', 'g', 'h', 'i'])];
  assert.ok(codes(auditLevels({ bundled })).includes('duplicate-id'));
});

test('the same picture under two ids is caught', () => {
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  const h = hashes([['a_variant.webp', 'SAME'], ['b_variant.webp', 'SAME']]);
  const found = auditLevels({ bundled, hashes: h });
  assert.ok(codes(found).includes('duplicate-variant-image'));
  assert.match(found.find(f => f.check === 'duplicate-variant-image').detail, /a, b/);
});

test('a puzzle with no difference is caught', () => {
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  const h = hashes([['a_base.webp', 'X'], ['a_variant.webp', 'X']]);
  assert.ok(codes(auditLevels({ bundled, hashes: h })).includes('no-difference'));
});

test('a dismissed level still published is caught in either pool', () => {
  const dismissedIds = new Set(['c', 'z']);
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  const remote = set('remote_set_001', ['v', 'w', 'x', 'y', 'z']);
  const found = auditLevels({ bundled, remote, dismissedIds });
  const details = found.filter(f => f.check === 'dismissed-still-live').map(f => f.detail);
  assert.equal(details.length, 2);
  assert.ok(details.some(d => d.includes('bundled')) && details.some(d => d.includes('remote')));
});

test('a short or misnumbered set is caught', () => {
  const short = set('photo_set_001', ['a', 'b', 'c', 'd']);
  assert.ok(codes(auditLevels({ bundled: short })).includes('incomplete-set'));

  const gap = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  gap[4].sequence = 9;
  assert.ok(codes(auditLevels({ bundled: gap })).includes('bad-sequence'));
});

test('a set repeating one photograph is caught', () => {
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e'],
    (id) => (id === 'b' ? { baseImage: 'levels/a_base.webp' } : {}));
  assert.ok(codes(auditLevels({ bundled })).includes('repeated-photo'));
});

test('a placeholder completes its set without counting as a repeat', () => {
  // Placeholders share no artwork, so they must not trip the repeat check.
  const bundled = [
    ...set('remote_set_006', ['a', 'b', 'c']),
    { id: 'p4', setId: 'remote_set_006', sequence: 4, isPlaceholder: true },
    { id: 'p5', setId: 'remote_set_006', sequence: 5, isPlaceholder: true }
  ];
  assert.deepEqual(auditLevels({ bundled }), []);
});

test('a placeholder that references artwork is caught', () => {
  const bundled = [
    ...set('remote_set_006', ['a', 'b', 'c', 'd']),
    { id: 'p5', setId: 'remote_set_006', sequence: 5, isPlaceholder: true,
      baseImage: 'levels/x_base.webp' }
  ];
  assert.ok(codes(auditLevels({ bundled })).includes('placeholder-has-artwork'));
});

test('a level missing an image reference is caught', () => {
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  delete bundled[2].variantImage;
  assert.ok(codes(auditLevels({ bundled })).includes('missing-image-reference'));
});

test('a daily-reserved level published remotely is a warning, not an error', () => {
  const remote = set('remote_set_001', ['a', 'b', 'c', 'd', 'e'],
    (id) => (id === 'c' ? { dailyOnly: true } : {}));
  const found = auditLevels({ remote });
  const daily = found.find(f => f.check === 'daily-in-remote');
  assert.ok(daily);
  assert.equal(daily.level, 'warning');
});

test('unassigned levels are audited but not treated as a set', () => {
  const bundled = [lvl('a', { setId: undefined, sequence: undefined }),
                   lvl('b', { setId: undefined, sequence: undefined })];
  assert.deepEqual(auditLevels({ bundled }), []);
});

test('artwork that belongs to no level is reported', () => {
  // Generated base images keep landing in the assets directory unreferenced,
  // where they ship in the bundle and deploy to Hosting for nothing.
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  const assetFiles = [
    { name: 'public/levels/a_base.webp', bytes: 100 },
    { name: 'public/levels/a_variant.webp', bytes: 100 },
    { name: 'public/levels/fresh_v9_coins_020_base.jpg', bytes: 1_200_000 }
  ];
  const found = auditLevels({ bundled, assetFiles });
  const stray = found.find(f => f.check === 'unreferenced-asset');
  assert.ok(stray, 'an unreferenced image must be reported');
  assert.equal(stray.level, 'warning', 'waste, not breakage: a deploy should not fail');
  assert.match(stray.detail, /fresh_v9_coins_020_base\.jpg/);
  assert.match(stray.detail, /1\.2 MB/);
});

test('referenced artwork is not mistaken for a stray', () => {
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  const assetFiles = bundled.flatMap(l => [
    { name: `public/levels/${l.id}_base.webp`, bytes: 10 },
    { name: `public/levels/${l.id}_variant.webp`, bytes: 10 }
  ]);
  assert.deepEqual(auditLevels({ bundled, assetFiles }), []);
});

test('remote artwork is matched by filename, not by directory', () => {
  // Remote levels reference absolute Hosting URLs while the file lives under
  // remote-levels/; matching on the full path would call every one a stray.
  const remote = [1, 2, 3, 4, 5].map(n => ({
    id: `r${n}`, setId: 'remote_set_001', sequence: n,
    baseImage: `https://host.web.app/levels/b${n}_base.webp`,
    variantImage: `https://host.web.app/levels/r${n}_variant.webp`
  }));
  const assetFiles = remote.flatMap((l, i) => [
    { name: `remote-levels/levels/b${i + 1}_base.webp`, bytes: 10 },
    { name: `remote-levels/levels/r${i + 1}_variant.webp`, bytes: 10 }
  ]);
  assert.deepEqual(auditLevels({ remote, assetFiles }), []);
});

test('no asset listing means no stray findings', () => {
  const bundled = set('photo_set_001', ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(auditLevels({ bundled }), []);
});

// --- photograph identity survives a flip ---------------------------------

const photoLevel = (id, setId, sequence, photoKey, extra = {}) => ({
  id, setId, sequence, photoKey,
  baseImage: `levels/${id}_a.webp`,
  variantImage: `levels/${id}_b.webp`,
  ...extra
});

const fiveOf = (setId, keys) => keys.map((k, i) => photoLevel(`${setId}_${i + 1}`, setId, i + 1, k));

test('a flipped level still counts as its own photograph in a set', async () => {
  const { auditLevels } = await import('./audit_published_levels.mjs');
  // Two levels of photo A in one set: one flipped, one not. Before photoKey the
  // flipped one pointed at a unique variant file in its base slot and this went
  // unnoticed.
  const levels = fiveOf('remote_set_900', ['p/a', 'p/b', 'p/c', 'p/d', 'p/e']);
  levels[1].photoKey = 'p/a';
  levels[1].flipped = true;
  const findings = auditLevels({ remote: levels });
  assert.ok(findings.some(f => f.check === 'repeated-photo'),
    'the same photograph twice in one set must be reported even when one is flipped');
});

test('one photograph may only be flipped once', async () => {
  const { auditLevels } = await import('./audit_published_levels.mjs');
  const a = fiveOf('remote_set_901', ['q/a', 'q/b', 'q/c', 'q/d', 'q/e']);
  const b = fiveOf('remote_set_902', ['q/f', 'q/g', 'q/h', 'q/i', 'q/j']);
  a[0].flipped = true;
  b[0].flipped = true;
  b[0].photoKey = 'q/a';   // same photograph as a[0], flipped in another set
  const findings = auditLevels({ remote: [...a, ...b] });
  assert.ok(findings.some(f => f.check === 'photo-flipped-twice'),
    'flipping one photograph on two levels repeats the right-hand panel');

  // One flip of that photograph is fine.
  b[0].flipped = false;
  assert.ok(!auditLevels({ remote: [...a, ...b] })
    .some(f => f.check === 'photo-flipped-twice'));
});

test('a level with no derivable photograph is reported', async () => {
  const { auditLevels } = await import('./audit_published_levels.mjs');
  const levels = fiveOf('remote_set_903', ['r/a', 'r/b', 'r/c', 'r/d', 'r/e']);
  delete levels[2].photoKey;
  levels[2].baseImage = '';
  levels[2].variantImage = '';
  const findings = auditLevels({ remote: levels });
  assert.ok(findings.some(f => f.check === 'missing-photo-key'));
});
