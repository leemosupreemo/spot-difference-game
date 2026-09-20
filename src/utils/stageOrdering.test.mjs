import test from 'node:test';
import assert from 'node:assert/strict';
import {
  baseImageKey, hasAdjacentRepeat, canSeparate, separateAdjacentDuplicates
} from './stageOrdering.js';

const lvl = (id, base) => ({ id, baseImage: `levels/${base}_base.webp` });

test('levels are twinned by base image, not by id', () => {
  assert.equal(baseImageKey(lvl('a_v1', 'shared')), 'shared_base.webp');
  assert.equal(baseImageKey(lvl('a_v1', 'shared')), baseImageKey(lvl('a_v2', 'shared')));
  assert.notEqual(baseImageKey(lvl('a', 'one')), baseImageKey(lvl('b', 'two')));
  assert.equal(baseImageKey({ id: 'no_image' }), 'no_image');
  assert.equal(baseImageKey(null), '');
});

test('separates the shape that prompted this: four of five from one photo', () => {
  const stage = [lvl('t1', 'tar'), lvl('t2', 'tar'), lvl('t3', 'tar'), lvl('t4', 'tar'), lvl('s', 'solo')];
  assert.equal(canSeparate(stage), false, '4 of 5 cannot be spaced apart');
  const ordered = separateAdjacentDuplicates(stage);
  assert.equal(ordered.length, 5, 'an impossible pool still keeps every level');
});

test('three of five is the most that can be separated', () => {
  const stage = [lvl('t1', 'tar'), lvl('t2', 'tar'), lvl('t3', 'tar'), lvl('a', 'one'), lvl('b', 'two')];
  assert.equal(canSeparate(stage), true);
  const ordered = separateAdjacentDuplicates(stage);
  assert.equal(hasAdjacentRepeat(ordered), false);
  assert.equal(ordered.length, 5);
});

test('adjacent twins are pulled apart', () => {
  const stage = [lvl('a1', 'A'), lvl('a2', 'A'), lvl('b', 'B'), lvl('c', 'C'), lvl('d', 'D')];
  assert.equal(hasAdjacentRepeat(stage), true);
  const ordered = separateAdjacentDuplicates(stage);
  assert.equal(hasAdjacentRepeat(ordered), false);
  assert.deepEqual(ordered.map(l => l.id).sort(), ['a1', 'a2', 'b', 'c', 'd']);
});

test('an already-valid stage keeps its order', () => {
  const stage = [lvl('a', 'A'), lvl('b', 'B'), lvl('c', 'C'), lvl('d', 'D'), lvl('e', 'E')];
  assert.deepEqual(separateAdjacentDuplicates(stage).map(l => l.id),
    stage.map(l => l.id), 'no gratuitous reshuffling');
});

test('two pairs and a single are interleaved', () => {
  const stage = [lvl('a1', 'A'), lvl('a2', 'A'), lvl('b1', 'B'), lvl('b2', 'B'), lvl('c', 'C')];
  const ordered = separateAdjacentDuplicates(stage);
  assert.equal(hasAdjacentRepeat(ordered), false);
  assert.equal(ordered.length, 5);
});

test('no level is ever dropped or duplicated', () => {
  for (const shape of [['A','A','A','B','C'], ['A','B','A','B','A'], ['A','A','B','B','C'], ['A','A','A','A','A']]) {
    const stage = shape.map((b, i) => lvl(`${b}${i}`, b));
    const ordered = separateAdjacentDuplicates(stage);
    assert.deepEqual(ordered.map(l => l.id).sort(), stage.map(l => l.id).sort());
  }
});

test('short stages and junk input are left alone', () => {
  assert.deepEqual(separateAdjacentDuplicates([]), []);
  assert.deepEqual(separateAdjacentDuplicates(null), []);
  const two = [lvl('a1', 'A'), lvl('a2', 'A')];
  assert.equal(separateAdjacentDuplicates(two).length, 2, 'two levels have nowhere to go');
});

test('canSeparate matches the ceil(n/2) limit exactly', () => {
  const build = (same, total) => Array.from({ length: total }, (_, i) =>
    lvl(`l${i}`, i < same ? 'same' : `other_${i}`));
  assert.equal(canSeparate(build(3, 5)), true);
  assert.equal(canSeparate(build(4, 5)), false);
  assert.equal(canSeparate(build(2, 4)), true);
  assert.equal(canSeparate(build(3, 4)), false);
});
