#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'public/levels/photo_pair_manifest.json');
const outputRoot = path.join(root, 'public/levels/photo-pairs/mass-abstract-extra');
const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sourceEntries = entries.filter(entry => entry.id.startsWith('mass_abstract_') && entry.baseImage);
const count = Number.parseInt(process.argv[2] || '25', 10);
const startAt = Number.parseInt(process.argv[3] || '101', 10);

if (!sourceEntries.length) throw new Error('Existing abstract levels are required as source images.');
const publicFile = publicPath => path.join(root, 'public', publicPath.replace(/^\//, ''));

function targetFor(index) {
  const x = 17 + ((index * 31) % 67);
  const y = 19 + ((index * 41) % 63);
  const difficulty = ['Easy', 'Medium', 'Hard'][index % 3];
  return { x, y, radius: difficulty === 'Easy' ? 7.2 : difficulty === 'Medium' ? 5.7 : 4.1, difficulty };
}

function mutate(base, target, shift) {
  const result = new PNG({ width: base.width, height: base.height });
  result.data.set(base.data);
  const cx = Math.round(base.width * target.x / 100), cy = Math.round(base.height * target.y / 100);
  const radius = Math.round(Math.min(base.width, base.height) * target.radius / 100);
  for (let y = Math.max(0, cy - radius); y <= Math.min(base.height - 1, cy + radius); y++) for (let x = Math.max(0, cx - radius); x <= Math.min(base.width - 1, cx + radius); x++) {
    const dist = Math.hypot(x - cx, y - cy);
    if (dist > radius) continue;
    const offset = (y * base.width + x) * 4;
    const weight = 0.72 * (1 + Math.cos(Math.PI * dist / radius)) / 2;
    const [r, g, b] = [base.data[offset], base.data[offset + 1], base.data[offset + 2]];
    const rotated = shift % 3 === 0 ? [g, b, r] : shift % 3 === 1 ? [b, r, g] : [255 - r, 255 - g, 255 - b];
    result.data[offset] = Math.round(r * (1 - weight) + rotated[0] * weight);
    result.data[offset + 1] = Math.round(g * (1 - weight) + rotated[1] * weight);
    result.data[offset + 2] = Math.round(b * (1 - weight) + rotated[2] * weight);
  }
  return result;
}

const generated = [];
for (let index = 0; index < count; index++) {
  const levelNumber = startAt + index;
  const id = `mass_abstract_${String(levelNumber).padStart(3, '0')}`;
  const source = sourceEntries[index % sourceEntries.length];
  const target = targetFor(index);
  const variant = mutate(PNG.sync.read(fs.readFileSync(publicFile(source.baseImage))), target, index);
  const dir = path.join(outputRoot, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'variant.png'), PNG.sync.write(variant));
  generated.push({ id, title: `Illustrated Abstract Detail ${String(levelNumber).padStart(3, '0')}`, pack: 'Abstract Animated', packId: 'abstract_animated', category: 'Illustrated Abstract', difficulty: target.difficulty, baseImage: source.baseImage, variantImage: `/levels/photo-pairs/mass-abstract-extra/${id}/variant.png`, diffs: [{ id: 1, ...target, hint: 'Compare the small color detail in this area.' }] });
}

const ids = new Set(generated.map(entry => entry.id));
fs.writeFileSync(manifestPath, `${JSON.stringify([...entries.filter(entry => !ids.has(entry.id)), ...generated], null, 2)}\n`);
console.log(`Generated ${generated.length} illustrated/abstract variants.`);
