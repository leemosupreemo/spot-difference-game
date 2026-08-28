import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from './canvasLevels.js';

test('LEVELS contains valid array of canvas levels', () => {
  assert.ok(Array.isArray(LEVELS));
  assert.ok(LEVELS.length > 0);
});

test('each level has valid schema, diffs array, and render method', () => {
  for (const lvl of LEVELS) {
    assert.ok(typeof lvl.id === 'string');
    assert.ok(typeof lvl.title === 'string');
    assert.ok(typeof lvl.category === 'string');
    assert.ok(['Easy', 'Medium', 'Hard'].includes(lvl.difficulty));
    assert.ok(Array.isArray(lvl.diffs));
    assert.ok(lvl.diffs.length > 0);

    for (const diff of lvl.diffs) {
      assert.ok(diff.id !== undefined);
      assert.ok(typeof diff.x === 'number' && diff.x >= 0 && diff.x <= 100);
      assert.ok(typeof diff.y === 'number' && diff.y >= 0 && diff.y <= 100);
      assert.ok(typeof diff.radius === 'number' && diff.radius > 0);
    }

    assert.equal(typeof lvl.render, 'function');
  }
});
