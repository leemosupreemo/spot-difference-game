#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'public/levels/photo_pair_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function assetPath(publicPath) {
  return path.join(root, 'public', publicPath.replace(/^\//, ''));
}

function largestComponent(diff, width, height) {
  const active = new Uint8Array(width * height);
  for (let index = 0; index < active.length; index++) {
    const offset = index * 4;
    active[index] = diff[offset] !== diff[offset + 1] || diff[offset + 1] !== diff[offset + 2] ? 1 : 0;
  }
  const visited = new Uint8Array(active.length);
  let largest = null;

  for (let start = 0; start < active.length; start++) {
    if (!active[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let count = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      const x = current % width;
      const y = Math.floor(current / width);
      count++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (active[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
      }
    }
    if (!largest || count > largest.count) largest = { count, minX, maxX, minY, maxY };
  }
  return largest;
}

for (const entry of manifest) {
  if (!entry.id.startsWith('abstract_') && !entry.id.startsWith('photo_') && !entry.id.startsWith('mass_')) continue;
  const base = PNG.sync.read(fs.readFileSync(assetPath(entry.baseImage)));
  const variant = PNG.sync.read(fs.readFileSync(assetPath(entry.variantImage)));
  if (base.width !== variant.width || base.height !== variant.height) throw new Error(`${entry.id}: image dimensions differ`);
  const diff = new PNG({ width: base.width, height: base.height });
  pixelmatch(base.data, variant.data, diff.data, base.width, base.height, { threshold: 0.12, includeAA: true });
  const component = largestComponent(diff.data, base.width, base.height);
  if (!component) throw new Error(`${entry.id}: no pixel differences found`);
  const componentWidth = component.maxX - component.minX + 1;
  const componentHeight = component.maxY - component.minY + 1;
  entry.diffs[0].x = Number((((component.minX + component.maxX) / 2 / base.width) * 100).toFixed(1));
  entry.diffs[0].y = Number((((component.minY + component.maxY) / 2 / base.height) * 100).toFixed(1));
  entry.diffs[0].radius = Number((Math.max(componentWidth / base.width, componentHeight / base.height) * 50 + 3).toFixed(1));
  console.log(`${entry.id}: ${entry.diffs[0].x}, ${entry.diffs[0].y}, r${entry.diffs[0].radius}`);
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
