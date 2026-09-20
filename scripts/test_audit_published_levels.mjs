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
