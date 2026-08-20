import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralLevelPair, ART_WORLDS, MUTATION_TYPES, PAINT_STYLES } from './proceduralGenerator.js';

test('exports the 12 unique artistic and impressionist worlds', () => {
  assert.equal(ART_WORLDS.length, 12);
  const worldIds = ART_WORLDS.map(w => w.id);
  assert.ok(worldIds.includes('monet_waterlilies'));
  assert.ok(worldIds.includes('vangogh_starry'));
  assert.ok(worldIds.includes('woodland_wildlife'));
  assert.ok(worldIds.includes('ocean_depths'));
  assert.ok(worldIds.includes('tropical_aviary'));
  assert.ok(worldIds.includes('kyoto_garden'));
  assert.ok(worldIds.includes('synthwave_neon_city'));
  assert.ok(worldIds.includes('egyptian_gilded_papyrus'));
  assert.ok(worldIds.includes('cosmic_nebula_stargate'));
  assert.ok(worldIds.includes('steampunk_clockwork'));
  assert.ok(worldIds.includes('nordic_aurora_fjord'));
  assert.ok(worldIds.includes('cubist_mondrian_abstract'));
});

test('exports 16 distinct paint styles and rendering finishes', () => {
  assert.equal(PAINT_STYLES.length, 16);
  assert.ok(PAINT_STYLES.includes('IMPASTO'));
  assert.ok(PAINT_STYLES.includes('POINTILLIST'));
  assert.ok(PAINT_STYLES.includes('WATERCOLOR'));
  assert.ok(PAINT_STYLES.includes('INK_WASH'));
  assert.ok(PAINT_STYLES.includes('SOFT_PASTEL'));
  assert.ok(PAINT_STYLES.includes('STAINED_GLASS'));
  assert.ok(PAINT_STYLES.includes('RETRO_SYNTHWAVE'));
  assert.ok(PAINT_STYLES.includes('WOODBLOCK_PRINT'));
  assert.ok(PAINT_STYLES.includes('MOSAIC_TILE'));
  assert.ok(PAINT_STYLES.includes('BAUHAUS_FLAT'));
  assert.ok(PAINT_STYLES.includes('RISOGRAPH_PRINT'));
  assert.ok(PAINT_STYLES.includes('GOTHIC_FILIGREE'));
  assert.ok(PAINT_STYLES.includes('NEON_CYBERPUNK'));
  assert.ok(PAINT_STYLES.includes('PAPER_CUTOUT_COLLAGE'));
  assert.ok(PAINT_STYLES.includes('CEL_SHADED_ANIME'));
  assert.ok(PAINT_STYLES.includes('TERRAZZO_INLAY'));
});

test('generates procedural level pairs across varied worlds with guaranteed exactly 1 difference', () => {
  for (let i = 0; i < 40; i++) {
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

test('provides valid render method that draws without throwing across different worlds', () => {
  for (let i = 0; i < 12; i++) {
    const level = generateProceduralLevelPair('abstract_animated', 'Medium', 5000 + i * 1337);
    assert.equal(typeof level.render, 'function');

    const calls = [];
    const mockCtx = {
      drawImage: (...args) => calls.push(args)
    };

    level.render(mockCtx, 800, 600, false);
    level.render(mockCtx, 800, 600, true);
    assert.equal(calls.length, 2, `Render should have drawn both base and modified frames for world seed ${i}`);
  }
});
