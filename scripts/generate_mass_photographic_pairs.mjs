#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'public/levels/photo_pair_manifest.json');
const outputRoot = path.join(root, 'public/levels/photo-pairs/mass-photo-real');
const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sourceEntries = entries.filter(entry => entry.id.startsWith('photo_') && entry.baseImage && entry.variantImage);
const count = Number.parseInt(process.argv[2] || '100', 10);
const startAt = Number.parseInt(process.argv[3] || '1', 10);

if (sourceEntries.length < 20) throw new Error('At least 20 existing photographic source levels are required.');

function sourcePath(publicPath) {
  return path.join(root, 'public', publicPath.replace(/^\//, ''));
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [Math.round(hue(p, q, h + 1 / 3) * 255), Math.round(hue(p, q, h) * 255), Math.round(hue(p, q, h - 1 / 3) * 255)];
}

function plannedTarget(index) {
  const x = 16 + ((index * 29) % 69);
  const y = 18 + ((index * 37) % 65);
  const difficulty = ['Easy', 'Medium', 'Hard'][index % 3];
  const radius = difficulty === 'Easy' ? 7 : difficulty === 'Medium' ? 5.5 : 4;
  return { x, y, radius, difficulty };
}

function mutatePhoto(base, target, hueOffset) {
  const result = new PNG({ width: base.width, height: base.height });
  result.data.set(base.data);
  const cx = Math.round((target.x / 100) * base.width);
  const cy = Math.round((target.y / 100) * base.height);
  const radius = Math.round((target.radius / 100) * Math.min(base.width, base.height));
  const minX = Math.max(0, cx - radius), maxX = Math.min(base.width - 1, cx + radius);
  const minY = Math.max(0, cy - radius), maxY = Math.min(base.height - 1, cy + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance > radius) continue;
      const index = (y * base.width + x) * 4;
      const alpha = 0.62 * (1 + Math.cos((distance / radius) * Math.PI)) / 2;
      const [h, s, l] = rgbToHsl(base.data[index], base.data[index + 1], base.data[index + 2]);
      const [r, g, b] = hslToRgb((h + hueOffset) % 1, Math.min(1, Math.max(0.28, s * 1.25)), l);
      result.data[index] = Math.round(base.data[index] * (1 - alpha) + r * alpha);
      result.data[index + 1] = Math.round(base.data[index + 1] * (1 - alpha) + g * alpha);
      result.data[index + 2] = Math.round(base.data[index + 2] * (1 - alpha) + b * alpha);
    }
  }
  return result;
}

const generated = [];
for (let index = 0; index < count; index++) {
  const levelNumber = startAt + index;
  const id = `mass_photo_${String(levelNumber).padStart(3, '0')}`;
  const source = sourceEntries[index % sourceEntries.length];
  const target = plannedTarget(index);
  const base = PNG.sync.read(fs.readFileSync(sourcePath(source.baseImage)));
  const variant = mutatePhoto(base, target, 0.38 + (index % 4) * 0.08);
  const outputDir = path.join(outputRoot, id);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'variant.png'), PNG.sync.write(variant));
  generated.push({
    id,
    title: `Photographic Detail ${String(levelNumber).padStart(3, '0')}`,
    pack: 'Find the Sniper',
    packId: 'find_the_sniper',
    category: 'Photographic Detail',
    difficulty: target.difficulty,
    baseImage: source.baseImage,
    variantImage: `/levels/photo-pairs/mass-photo-real/${id}/variant.png`,
    diffs: [{ id: 1, ...target, hint: 'Compare the small color detail in this area.' }]
  });
}

const generatedIds = new Set(generated.map(entry => entry.id));
const retained = entries.filter(entry => !generatedIds.has(entry.id));
fs.writeFileSync(manifestPath, `${JSON.stringify([...retained, ...generated], null, 2)}\n`);
console.log(`Generated ${generated.length} photographic variants from ${sourceEntries.length} photo masters.`);
