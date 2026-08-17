import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralLevelPair, ART_WORLDS, MUTATION_TYPES } from './proceduralGenerator.js';

test('exports the 6 unique organic and impressionist art worlds', () => {
  assert.equal(ART_WORLDS.length, 6);
  const worldIds = ART_WORLDS.map(w => w.id);
  assert.ok(worldIds.includes('monet_waterlilies'));
  assert.ok(worldIds.includes('vangogh_starry'));
  assert.ok(worldIds.includes('woodland_wildlife'));
  assert.ok(worldIds.includes('ocean_depths'));
  assert.ok(worldIds.includes('tropical_aviary'));
  assert.ok(worldIds.includes('kyoto_garden'));
});

test('generates a procedural level pair with guaranteed exactly 1 difference', () => {
  for (let i = 0; i < 20; i++) {
    const seed = 1000 + i * 777;
    const level = generateProceduralLevelPair('abstract_animated', 'Medium', seed);

    assert.equal(level.totalDifferences, 1, `Level ${level.id} should have totalDifferences == 1`);
    assert.equal(level.diffs.length, 1, `Level ${level.id} should have exactly 1 diff in array`);
    assert.ok(level.diffs[0].x >= 0 && level.diffs[0].x <= 100, `Diff x (${level.diffs[0].x}) must be in [0, 100]`);
    assert.ok(level.diffs[0].y >= 0 && level.diffs[0].y <= 100, `Diff y (${level.diffs[0].y}) must be in [0, 100]`);
    assert.ok(level.diffs[0].radius >= 4 && level.diffs[0].radius <= 12, 'Hit radius must be reasonable');
    assert.ok(MUTATION_TYPES.includes(level.diffs[0].mutationType), `Mutation type ${level.diffs[0].mutationType} must be valid`);
  }
});

test('supports all difficulty levels with proportional hit radii', () => {
  const easyLevel = generateProceduralLevelPair('abstract_animated', 'Easy', 42);
  const mediumLevel = generateProceduralLevelPair('abstract_animated', 'Medium', 42);
  const hardLevel = generateProceduralLevelPair('abstract_animated', 'Hard', 42);

  assert.equal(easyLevel.diffs[0].radius, 10);
  assert.equal(mediumLevel.diffs[0].radius, 8);
  assert.equal(hardLevel.diffs[0].radius, 6);
});

test('provides valid render method that draws without throwing', () => {
  const level = generateProceduralLevelPair('abstract_animated', 'Medium', 9999);
  assert.equal(typeof level.render, 'function');

  const calls = [];
  const mockCtx = {
    drawImage: (...args) => calls.push(args)
  };

  level.render(mockCtx, 800, 600, false);
  level.render(mockCtx, 800, 600, true);
  assert.equal(calls.length, 2, 'Render should have drawn both base and modified frames');
});
