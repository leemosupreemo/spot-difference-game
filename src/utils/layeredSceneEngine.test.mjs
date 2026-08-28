import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVectorObjectAsset } from './layeredSceneEngine.js';

test('createVectorObjectAsset generates valid SVG markup for all supported asset types', () => {
  const types = ['gear', 'ic_chip', 'hex_nut', 'paperclip', 'jewel'];

  for (const type of types) {
    const svg = createVectorObjectAsset(type, 64, 64, '#ffaa00', 42);
    assert.ok(typeof svg === 'string');
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('</svg>'));
    assert.ok(svg.includes('width="64"'));
    assert.ok(svg.includes('height="64"'));
  }
});

test('createVectorObjectAsset falls back to jewel asset for unknown type', () => {
  const svg = createVectorObjectAsset('unknown_type', 50, 50, '#112233', 1);
  assert.ok(typeof svg === 'string');
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('jewelGrad_1'));
});
