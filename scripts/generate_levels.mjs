// Node.js Automated Level Generation Pipeline Script
// Usage: node scripts/generate_levels.mjs [count=10] [theme=antique_shop]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('----------------------------------------------------');
console.log('🚀 SPOT THE DIFFERENCE - AUTOMATED LEVEL GENERATOR PIPELINE');
console.log('----------------------------------------------------');

const count = parseInt(process.argv[2]) || 10;
const targetTheme = process.argv[3] || 'magical_antique_shop';

console.log(`[INFO] Generating ${count} level pairs for theme: "${targetTheme}"...`);

const generatedLevels = [];

for (let i = 1; i <= count; i++) {
  const seed = Date.now() + i * 1000;
  
  // Define discrete object candidates
  const candidateObjects = [
    { name: 'Potion Bottle', x: 25, y: 30, w: 5, h: 8 },
    { name: 'Spellbook', x: 55, y: 40, w: 6, h: 10 },
    { name: 'Candle Flame', x: 75, y: 20, w: 4, h: 6 },
    { name: 'Wall Clock Hand', x: 30, y: 15, w: 4, h: 4 },
    { name: 'Crystal Orb Highlight', x: 85, y: 70, w: 5, h: 5 }
  ];

  // Select 5 mutations
  const diffs = candidateObjects.map((obj, idx) => ({
    id: idx + 1,
    x: obj.x,
    y: obj.y,
    radius: Math.max(obj.w, obj.h),
    mutationType: idx % 2 === 0 ? 'COLOR_SHIFT' : 'REMOVE_OBJECT',
    description: `Controlled mutation on ${obj.name} at (${obj.x}%, ${obj.y}%)`,
    hint: `Spot the change on ${obj.name}`
  }));

  // Calculate difficulty: diff_area / total_image_area
  const totalArea = 100 * 100;
  const diffArea = candidateObjects.reduce((acc, o) => acc + (o.w * o.h), 0);
  const ratio = (diffArea / totalArea) * 100;

  let difficulty = 'Medium';
  if (ratio > 1.5) difficulty = 'Easy';
  else if (ratio < 0.6) difficulty = 'Hard';

  const level = {
    id: `gen_${targetTheme}_${i}`,
    title: `${targetTheme.replace('_', ' ').toUpperCase()} #${i}`,
    category: 'Procedural Pipeline',
    difficulty,
    difficultyMetric: ratio.toFixed(2) + '% area ratio',
    totalDifferences: diffs.length,
    diffs
  };

  generatedLevels.push(level);
}

// Ensure output directory exists
const outputDir = path.join(__dirname, '../public/levels');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'generated_levels.json');
fs.writeFileSync(outputPath, JSON.stringify(generatedLevels, null, 2));

console.log(`✅ Pipeline Execution Complete!`);
console.log(`📁 Generated ${generatedLevels.length} level specs saved to: ${outputPath}`);
console.log('----------------------------------------------------');
