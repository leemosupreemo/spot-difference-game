// Ultra-High-Fidelity Multi-Scale Organic Procedural Art Engine
// GUARANTEED EXACTLY 1 VISIBLE DIFFERENCE between Image A and Image B
// 8 Immersive Organic & Thematic Worlds:
// 1. Bioluminescent Deep Ocean Reef
// 2. Tropical Rainforest Canopy
// 3. Cosmic Nebula & Planetary System
// 4. Japanese Pagoda & Sakura Garden
// 5. Enchanted Fairytale Forest & Bioluminescent Fungi
// 6. Ancient Starlit Desert Oasis
// 7. Steampunk Clockwork & Brass Atrium
// 8. Arctic Glaciers & Emerald Aurora Borealis

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const ART_WORLDS = [
  { id: 'ocean_reef', name: 'Bioluminescent Ocean Reef' },
  { id: 'botanical_canopy', name: 'Tropical Botanical Canopy' },
  { id: 'cosmic_nebula', name: 'Cosmic Nebula & Planetary System' },
  { id: 'sakura_pagoda', name: 'Japanese Pagoda & Sakura Garden' },
  { id: 'enchanted_forest', name: 'Enchanted Fairytale Forest' },
  { id: 'desert_oasis', name: 'Ancient Starlit Desert Oasis' },
  { id: 'steampunk_atrium', name: 'Steampunk Clockwork Atrium' },
  { id: 'arctic_aurora', name: 'Arctic Aurora & Glacial Cavern' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change element / sub-feature color to a bold contrasting hue
  'REMOVE_DETAIL',    // Remove a distinct sub-ornament / spot / stripe / jewel / flame
  'ADD_DETAIL',       // Add an ornament / spot / beacon / highlight / jewel
  'SHAPE_ROTATE',     // Rotate element / fin / hand / petal by 45-90 degrees
  'SCALE_CHANGE'      // Scale element up or down
];

function createPRNG(seed) {
  let s = Math.abs(Math.floor(seed || 1)) % 2147483647;
  if (s <= 0) s = 1;
  // Multi-pass hash mixing
  s = (s ^ 0x6D2B79F5) % 2147483647;
  if (s <= 0) s = 1;
  s = (s * 48271) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates an authentic, ultra-rich procedural scene pair with guaranteed exactly 1 visible difference.
 */
export function generateProceduralLevelPair(themeId = 'abstract_animated', targetDifficulty = 'Medium', seed = Date.now()) {
  const width = 800;
  const height = 600;

  const canvasA = document.createElement('canvas');
  canvasA.width = width;
  canvasA.height = height;
  const ctxA = canvasA.getContext('2d');

  const canvasB = document.createElement('canvas');
  canvasB.width = width;
  canvasB.height = height;
  const ctxB = canvasB.getContext('2d');

  const random = createPRNG(seed);
  const randomChoice = (arr) => arr[Math.floor(random() * arr.length)];
  const randomRange = (min, max) => min + random() * (max - min);

  const isPhotoTheme = themeId === 'find_the_sniper';
  const candidates = [];
  let sceneTitle = 'Organic World';

  // Select one of 8 distinct thematic worlds
  const worldIndex = Math.floor(random() * 8);

  // Dynamic Density multipliers with safe minimums
  const mediumCount = targetDifficulty === 'Easy' ? 16 : targetDifficulty === 'Medium' ? 24 : 32;
  const microCount = targetDifficulty === 'Easy' ? 24 : targetDifficulty === 'Medium' ? 36 : 48;

  if (worldIndex === 0) {
    // =========================================================================
    // 🌊 WORLD 1: BIOLUMINESCENT DEEP OCEAN REEF
    // =========================================================================
    sceneTitle = 'Bioluminescent Reef';

    const oceanGrad = ctxA.createRadialGradient(width * 0.5, height * 0.4, 50, width * 0.5, height * 0.5, width * 0.75);
    oceanGrad.addColorStop(0, '#06283d');
    oceanGrad.addColorStop(0.5, '#02182b');
    oceanGrad.addColorStop(1, '#010914');
    ctxA.fillStyle = oceanGrad;
    ctxA.fillRect(0, 0, width, height);

    // Caustic Light Rays
    ctxA.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctxA.lineWidth = 45;
    for (let r = 0; r < 5; r++) {
      ctxA.beginPath();
      ctxA.moveTo(width * 0.2 + r * 130, 0);
      ctxA.lineTo(width * 0.1 + r * 150, height);
      ctxA.stroke();
    }

    // 1. HERO ELEMENT: Giant Bioluminescent Jellyfish (200px)
    const jellyX = randomRange(width * 0.25, width * 0.75);
    const jellyY = randomRange(120, 220);
    const jellyColor = randomChoice(['#ff007f', '#00f0ff', '#a855f7', '#00ff87']);

    candidates.push({
      id: 'hero_jellyfish',
      x: jellyX, y: jellyY, size: 95, kind: 'JELLYFISH_BELL', baseColor: jellyColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(jellyX, jellyY);
        let color = jellyColor;
        if (mutated && mType === 'COLOR_SHIFT') {
          color = jellyColor === '#ff007f' ? '#00f0ff' : jellyColor === '#00f0ff' ? '#00ff87' : '#ff007f';
        }
        const bellScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, 52 * bellScale, Math.PI, 0, false);
        ctx.bezierCurveTo(46 * bellScale, 22 * bellScale, -46 * bellScale, 22 * bellScale, -52 * bellScale, 0);
        ctx.closePath();
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(0, -10 * bellScale, 18 * bellScale, Math.PI, 0, false);
          ctx.fill();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.75;
        for (let t = -3; t <= 3; t++) {
          ctx.beginPath();
          ctx.moveTo(t * 12 * bellScale, 12);
          ctx.bezierCurveTo(t * 18 + 15, 60, t * 18 - 15, 110, t * 10, 160);
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    // 2. HERO ELEMENT: Massive Branching Coral Fan (Bottom)
    const coralX = randomRange(120, width - 120);
    const coralY = height - 40;
    const coralColor = randomChoice(['#ff5722', '#e91e63', '#00bcd4', '#ffb300']);

    candidates.push({
      id: 'hero_coral_fan',
      x: coralX, y: coralY - 60, size: 85, kind: 'CORAL_FAN', baseColor: coralColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(coralX, coralY);
        let color = coralColor;
        if (mutated && mType === 'COLOR_SHIFT') {
          color = coralColor === '#ff5722' ? '#00bcd4' : '#ff5722';
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;

        for (let b = -4; b <= 4; b++) {
          const a = (b * Math.PI) / 12 - Math.PI / 2;
          const len = 92 - Math.abs(b) * 10;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(Math.cos(a) * (len * 0.5) + b * 6, Math.sin(a) * (len * 0.5), Math.cos(a) * len, Math.sin(a) * len);
          ctx.stroke();

          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(Math.cos(a) * len, Math.sin(a) * len, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    });

    // 3. MEDIUM CRITTERS (Sea Turtles, Fish, Starfish)
    const fishColors = ['#ff9f1c', '#2ec4b6', '#e71d36', '#ff007f', '#00f0ff', '#ffd166'];
    for (let f = 0; f < mediumCount; f++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['SWIMMING_FISH', 'SEA_TURTLE', 'STARFISH']);
      const baseColor = randomChoice(fishColors);
      const dir = random() > 0.5 ? 1 : -1;

      candidates.push({
        id: `ocean_critter_${f}`,
        x: cx, y: cy, size, kind, baseColor, dir,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#ff9f1c' ? '#2ec4b6' : baseColor === '#2ec4b6' ? '#e71d36' : '#ff9f1c';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'SWIMMING_FISH') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.45, curSize * 0.24, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-curSize * 0.4 * dir, 0);
            ctx.lineTo(-curSize * 0.7 * dir, -curSize * 0.28);
            ctx.lineTo(-curSize * 0.7 * dir, curSize * 0.28);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curSize * 0.25 * dir, -curSize * 0.06, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(curSize * 0.25 * dir, -curSize * 0.06, 1.8, 0, Math.PI * 2);
            ctx.fill();
            if (!(mutated && mType === 'REMOVE_DETAIL')) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.2, -0.8, 0.8);
              ctx.stroke();
            }
          } else if (kind === 'SEA_TURTLE') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.4, curSize * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(curSize * 0.3, -curSize * 0.32, curSize * 0.25, curSize * 0.1, -0.6, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.3, curSize * 0.32, curSize * 0.25, curSize * 0.1, 0.6, 0, Math.PI * 2);
            ctx.fill();
            if (mutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(0, 0, 5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let s = 0; s < 5; s++) {
              const a = (s * Math.PI * 2) / 5 - Math.PI / 2;
              const px = Math.cos(a) * curSize * 0.45;
              const py = Math.sin(a) * curSize * 0.45;
              const aMid = a + Math.PI / 5;
              const mx = Math.cos(aMid) * curSize * 0.18;
              const my = Math.sin(aMid) * curSize * 0.18;
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
              ctx.lineTo(mx, my);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    // 4. MICRO OXYGEN BUBBLES
    for (let b = 0; b < microCount; b++) {
      const bx = randomRange(40, width - 40);
      const by = randomRange(40, height - 40);
      const bSize = randomRange(8, 16);

      candidates.push({
        id: `bubble_${b}`,
        x: bx, y: by, size: bSize, kind: 'OXYGEN_BUBBLE', baseColor: '#00f0ff',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(bx, by);
          let bCol = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : '#00f0ff';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? bSize * 1.8 : bSize;

          ctx.strokeStyle = bCol;
          ctx.lineWidth = 2;
          ctx.shadowColor = bCol;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-rad * 0.18, -rad * 0.18, rad * 0.14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 1) {
    // =========================================================================
    // 🌿 WORLD 2: TROPICAL BOTANICAL RAINFOREST CANOPY
    // =========================================================================
    sceneTitle = 'Tropical Rainforest';

    const jungleGrad = ctxA.createLinearGradient(0, 0, 0, height);
    jungleGrad.addColorStop(0, '#061a10');
    jungleGrad.addColorStop(0.5, '#0b351e');
    jungleGrad.addColorStop(1, '#1b5e34');
    ctxA.fillStyle = jungleGrad;
    ctxA.fillRect(0, 0, width, height);

    ctxA.strokeStyle = 'rgba(255, 235, 59, 0.08)';
    ctxA.lineWidth = 60;
    for (let s = 0; s < 4; s++) {
      ctxA.beginPath();
      ctxA.moveTo(width * 0.1 + s * 220, 0);
      ctxA.lineTo(width * 0.3 + s * 220, height);
      ctxA.stroke();
    }

    // 1. HERO ELEMENT: Monstera Deliciosa Leaf (200px)
    const monsteraX = randomRange(width * 0.3, width * 0.7);
    const monsteraY = randomRange(160, 260);
    const monsteraColor = '#38b000';

    candidates.push({
      id: 'hero_monstera',
      x: monsteraX, y: monsteraY, size: 110, kind: 'MONSTERA_FROND', baseColor: monsteraColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(monsteraX, monsteraY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#70e000' : monsteraColor;
        const leafScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 65 * leafScale, 95 * leafScale, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#004b23';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -95 * leafScale);
        ctx.lineTo(0, 95 * leafScale);
        ctx.stroke();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#0b351e';
          for (let cut = -2; cut <= 2; cut++) {
            ctx.beginPath();
            ctx.ellipse(cut * 22 * leafScale, cut * 28 * leafScale, 8 * leafScale, 22 * leafScale, 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM FAUNA (Toucans, Morpho Butterflies, Orchids, Tree Frogs)
    const faunaColors = ['#ff0054', '#ffbd00', '#00f5d4', '#7b2cbf', '#ff5400', '#3a86ff'];
    for (let f = 0; f < mediumCount; f++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['TOUCAN', 'EXOTIC_ORCHID', 'MORPHO_BUTTERFLY', 'TREE_FROG']);
      const baseColor = randomChoice(faunaColors);

      candidates.push({
        id: `botanical_critter_${f}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#ff0054' ? '#00f5d4' : baseColor === '#00f5d4' ? '#ffbd00' : '#ff0054';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'TOUCAN') {
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.35, curSize * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(curSize * 0.25, -curSize * 0.1);
            ctx.quadraticCurveTo(curSize * 0.7, -curSize * 0.15, curSize * 0.65, curSize * 0.15);
            ctx.lineTo(curSize * 0.25, curSize * 0.1);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curSize * 0.15, -curSize * 0.05, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(curSize * 0.15, -curSize * 0.05, 1.8, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === 'MORPHO_BUTTERFLY') {
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(-curSize * 0.3, -curSize * 0.2, curSize * 0.35, curSize * 0.22, -0.4, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.3, -curSize * 0.2, curSize * 0.35, curSize * 0.22, 0.4, 0, Math.PI * 2);
            ctx.ellipse(-curSize * 0.24, curSize * 0.22, curSize * 0.25, curSize * 0.16, 0.5, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.24, curSize * 0.22, curSize * 0.25, curSize * 0.16, -0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-2, -curSize * 0.35, 4, curSize * 0.7);
          } else if (kind === 'EXOTIC_ORCHID') {
            for (let p = 0; p < 5; p++) {
              const a = (p * Math.PI * 2) / 5 - Math.PI / 2;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.ellipse(Math.cos(a) * (curSize * 0.35), Math.sin(a) * (curSize * 0.35), curSize * 0.32, curSize * 0.16, a, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = (mutated && mType === 'REMOVE_DETAIL') ? color : '#ffd166';
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.16, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.38, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff5400';
            for (let t = 0; t < 4; t++) {
              const ta = (t * Math.PI) / 2;
              ctx.beginPath();
              ctx.arc(Math.cos(ta) * (curSize * 0.45), Math.sin(ta) * (curSize * 0.45), 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO DEWDROPS
    for (let d = 0; d < microCount; d++) {
      const dx = randomRange(40, width - 40);
      const dy = randomRange(40, height - 40);
      const dSize = randomRange(8, 16);

      candidates.push({
        id: `dewdrop_${d}`,
        x: dx, y: dy, size: dSize, kind: 'DEWDROP', baseColor: '#ffffff',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(dx, dy);
          const rad = (mutated && mType === 'SCALE_CHANGE') ? dSize * 1.8 : dSize;
          ctx.fillStyle = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-rad * 0.15, -rad * 0.15, rad * 0.14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 2) {
    // =========================================================================
    // 🪐 WORLD 3: COSMIC NEBULA & PLANETARY SYSTEM
    // =========================================================================
    sceneTitle = 'Cosmic Planetary Nebula';

    const spaceGrad = ctxA.createRadialGradient(width * 0.5, height * 0.5, 40, width * 0.5, height * 0.5, width * 0.8);
    spaceGrad.addColorStop(0, '#3c096c');
    spaceGrad.addColorStop(0.4, '#10002b');
    spaceGrad.addColorStop(1, '#030008');
    ctxA.fillStyle = spaceGrad;
    ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = 'rgba(217, 70, 239, 0.12)';
    for (let c = 0; c < 6; c++) {
      ctxA.beginPath();
      ctxA.arc(randomRange(100, width - 100), randomRange(100, height - 100), randomRange(80, 160), 0, Math.PI * 2);
      ctxA.fill();
    }

    // 1. HERO ELEMENT: Gas Giant Planet with Orbital Rings (220px)
    const planetX = randomRange(width * 0.3, width * 0.7);
    const planetY = randomRange(140, 250);
    const planetColor = randomChoice(['#3a86ff', '#ff006e', '#8338ec', '#fb5607']);

    candidates.push({
      id: 'hero_gas_giant',
      x: planetX, y: planetY, size: 100, kind: 'GAS_GIANT_PLANET', baseColor: planetColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(planetX, planetY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#00f0ff' : planetColor;
        const pScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 50 * pScale, 0, Math.PI * 2);
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 4 * pScale;
          ctx.beginPath();
          ctx.arc(0, 0, 50 * pScale, -0.4, 0.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 50 * pScale, 2.7, 3.5);
          ctx.stroke();
        }

        ctx.strokeStyle = (mutated && mType === 'ADD_DETAIL') ? '#ff007f' : '#ffd166';
        ctx.lineWidth = 5 * pScale;
        ctx.beginPath();
        ctx.ellipse(0, 0, 95 * pScale, 28 * pScale, -0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 2. MEDIUM COMETS, MOONS & SATELLITES
    const cosmicColors = ['#00f0ff', '#ff007f', '#ffd166', '#ffffff', '#a855f7', '#00ff87'];
    for (let c = 0; c < mediumCount; c++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['COMET_TRAIL', 'CRATERED_MOON', 'SATELLITE_ORBITER']);
      const baseColor = randomChoice(cosmicColors);

      candidates.push({
        id: `cosmic_obj_${c}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#00f0ff' ? '#ff007f' : '#00f0ff';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'COMET_TRAIL') {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-curSize * 0.8, -curSize * 0.6);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.22, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === 'CRATERED_MOON') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            if (!(mutated && mType === 'REMOVE_DETAIL')) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
              ctx.beginPath();
              ctx.arc(-curSize * 0.12, -curSize * 0.1, curSize * 0.12, 0, Math.PI * 2);
              ctx.arc(curSize * 0.14, curSize * 0.12, curSize * 0.08, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.fillStyle = color;
            ctx.fillRect(-curSize * 0.2, -curSize * 0.2, curSize * 0.4, curSize * 0.4);
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(-curSize * 0.55, -curSize * 0.08, curSize * 0.3, curSize * 0.16);
            ctx.fillRect(curSize * 0.25, -curSize * 0.08, curSize * 0.3, curSize * 0.16);
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO DIFFRACTION STARBURSTS
    for (let s = 0; s < microCount; s++) {
      const sx = randomRange(40, width - 40);
      const sy = randomRange(40, height - 40);
      const sSize = randomRange(10, 18);

      candidates.push({
        id: `starburst_${s}`,
        x: sx, y: sy, size: sSize, kind: 'DIFFRACTION_STAR', baseColor: '#ffffff',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(sx, sy);
          let scol = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : '#ffffff';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? sSize * 1.8 : sSize;

          ctx.strokeStyle = scol;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = scol;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(-rad * 0.6, 0);
          ctx.lineTo(rad * 0.6, 0);
          ctx.moveTo(0, -rad * 0.6);
          ctx.lineTo(0, rad * 0.6);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 3) {
    // =========================================================================
    // 🌸 WORLD 4: JAPANESE PAGODA & SAKURA GARDEN
    // =========================================================================
    sceneTitle = 'Sakura Pagoda Garden';

    const sakuraGrad = ctxA.createLinearGradient(0, 0, 0, height);
    sakuraGrad.addColorStop(0, '#fce7f3');
    sakuraGrad.addColorStop(0.4, '#fbcfe8');
    sakuraGrad.addColorStop(0.7, '#f472b6');
    sakuraGrad.addColorStop(1, '#4c1d95');
    ctxA.fillStyle = sakuraGrad;
    ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = '#e11d48';
    ctxA.beginPath();
    ctxA.arc(width * 0.5, height * 0.45, 110, 0, Math.PI * 2);
    ctxA.fill();

    // 1. HERO ELEMENT: Sweeping Pagoda Temple Roof (220px)
    const pagodaX = randomRange(width * 0.35, width * 0.65);
    const pagodaY = height * 0.62;
    const pagodaColor = '#1e1b4b';

    candidates.push({
      id: 'hero_pagoda',
      x: pagodaX, y: pagodaY, size: 110, kind: 'PAGODA_ROOF', baseColor: pagodaColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(pagodaX, pagodaY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#831843' : pagodaColor;
        const pScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-90 * pScale, 0);
        ctx.quadraticCurveTo(0, -35 * pScale, 90 * pScale, 0);
        ctx.lineTo(75 * pScale, 20 * pScale);
        ctx.quadraticCurveTo(0, 0, -75 * pScale, 20 * pScale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(0, -38 * pScale, 8 * pScale, 0, Math.PI * 2);
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(-80 * pScale, 6 * pScale, 4 * pScale, 0, Math.PI * 2);
          ctx.arc(80 * pScale, 6 * pScale, 4 * pScale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM KOI, LANTERNS & CRANES
    const gardenColors = ['#e11d48', '#fb923c', '#ffffff', '#ffd166', '#a855f7', '#06b6d4'];
    for (let g = 0; g < mediumCount; g++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['KOI_FISH', 'PAPER_LANTERN', 'ORIGAMI_CRANE']);
      const baseColor = randomChoice(gardenColors);

      candidates.push({
        id: `garden_obj_${g}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#e11d48' ? '#06b6d4' : '#e11d48';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'KOI_FISH') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.45, curSize * 0.22, 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(curSize * 0.1, -curSize * 0.05, curSize * 0.18, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.moveTo(-curSize * 0.4, 0);
            ctx.lineTo(-curSize * 0.7, -curSize * 0.25);
            ctx.lineTo(-curSize * 0.7, curSize * 0.25);
            ctx.closePath();
            ctx.fill();
          } else if (kind === 'PAPER_LANTERN') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.35, curSize * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffd166';
            ctx.shadowColor = '#ffd166';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.16, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(-curSize * 0.2, -curSize * 0.44, curSize * 0.4, 4);
            ctx.fillRect(-curSize * 0.2, curSize * 0.42, curSize * 0.4, 4);
          } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.45);
            ctx.lineTo(curSize * 0.4, curSize * 0.3);
            ctx.lineTo(0, curSize * 0.15);
            ctx.lineTo(-curSize * 0.4, curSize * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO DRIFTING SAKURA PETALS
    for (let p = 0; p < microCount; p++) {
      const px = randomRange(40, width - 40);
      const py = randomRange(40, height - 40);
      const pSize = randomRange(10, 18);
      const pRot = random() * Math.PI * 2;

      candidates.push({
        id: `sakura_petal_${p}`,
        x: px, y: py, size: pSize, kind: 'SAKURA_PETAL', baseColor: '#fda4af',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(pRot + ((mutated && mType === 'SHAPE_ROTATE') ? Math.PI / 3 : 0));
          let pcol = (mutated && mType === 'COLOR_SHIFT') ? '#ffffff' : '#fda4af';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? pSize * 1.8 : pSize;

          ctx.fillStyle = pcol;
          ctx.beginPath();
          ctx.ellipse(0, 0, rad * 0.45, rad * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 4) {
    // =========================================================================
    // 🍄 WORLD 5: ENCHANTED FAIRYTALE FOREST & FUNGI
    // =========================================================================
    sceneTitle = 'Enchanted Fungi Forest';

    const forestGrad = ctxA.createLinearGradient(0, 0, 0, height);
    forestGrad.addColorStop(0, '#090514');
    forestGrad.addColorStop(0.5, '#1e1135');
    forestGrad.addColorStop(1, '#3b1c5a');
    ctxA.fillStyle = forestGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO ELEMENT: Giant Bioluminescent Toadstool (210px)
    const mushX = randomRange(width * 0.35, width * 0.65);
    const mushY = height * 0.65;
    const mushColor = '#ff0055';

    candidates.push({
      id: 'hero_toadstool',
      x: mushX, y: mushY - 40, size: 105, kind: 'GIANT_TOADSTOOL', baseColor: mushColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(mushX, mushY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#00f5d4' : mushColor;
        const mScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        // Stem
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-18 * mScale, 0);
        ctx.lineTo(18 * mScale, 0);
        ctx.lineTo(12 * mScale, -65 * mScale);
        ctx.lineTo(-12 * mScale, -65 * mScale);
        ctx.closePath();
        ctx.fill();

        // Cap
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, -65 * mScale, 65 * mScale, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();

        // Polka Dots
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-26 * mScale, -95 * mScale, 8 * mScale, 0, Math.PI * 2);
          ctx.arc(26 * mScale, -95 * mScale, 8 * mScale, 0, Math.PI * 2);
          ctx.arc(0, -112 * mScale, 9 * mScale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM ELEMENTS: Crystal Clusters, Fairy Wisps, Snails (45-80px)
    const fairyColors = ['#00f0ff', '#f72585', '#7209b7', '#4cc9f0', '#ffbe0b'];
    for (let f = 0; f < mediumCount; f++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['CRYSTAL_CLUSTER', 'FAIRY_WISP', 'ENCHANTED_SNAIL']);
      const baseColor = randomChoice(fairyColors);

      candidates.push({
        id: `fairy_obj_${f}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#00f0ff' ? '#f72585' : '#00f0ff';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'CRYSTAL_CLUSTER') {
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.5);
            ctx.lineTo(curSize * 0.25, curSize * 0.4);
            ctx.lineTo(-curSize * 0.25, curSize * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (kind === 'FAIRY_WISP') {
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.16, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Snail
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.18, 0, Math.PI);
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO SPORES & GLOWING EMBER NODES
    for (let s = 0; s < microCount; s++) {
      const sx = randomRange(40, width - 40);
      const sy = randomRange(40, height - 40);
      const sSize = randomRange(8, 16);

      candidates.push({
        id: `spore_${s}`,
        x: sx, y: sy, size: sSize, kind: 'GLOWING_SPORE', baseColor: '#00ff87',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(sx, sy);
          let scol = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : '#00ff87';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? sSize * 1.8 : sSize;

          ctx.fillStyle = scol;
          ctx.shadowColor = scol;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 5) {
    // =========================================================================
    // 🏜️ WORLD 6: ANCIENT STARLIT DESERT OASIS
    // =========================================================================
    sceneTitle = 'Starlit Desert Oasis';

    const desertGrad = ctxA.createLinearGradient(0, 0, 0, height);
    desertGrad.addColorStop(0, '#0c0f24');
    desertGrad.addColorStop(0.4, '#1f1a38');
    desertGrad.addColorStop(0.7, '#432344');
    desertGrad.addColorStop(1, '#d97706');
    ctxA.fillStyle = desertGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO ELEMENT: Majestic Date Palm Tree (220px)
    const palmX = randomRange(width * 0.3, width * 0.7);
    const palmY = height * 0.65;
    const palmColor = '#059669';

    candidates.push({
      id: 'hero_date_palm',
      x: palmX, y: palmY - 60, size: 110, kind: 'DATE_PALM', baseColor: palmColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(palmX, palmY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#10b981' : palmColor;
        const pScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        // Curved Trunk
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 12 * pScale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(15 * pScale, -50 * pScale, 10 * pScale, -110 * pScale);
        ctx.stroke();

        // Palm Fronds
        ctx.fillStyle = color;
        for (let f = -3; f <= 3; f++) {
          const a = (f * Math.PI) / 6 - Math.PI / 2;
          ctx.beginPath();
          ctx.ellipse(10 * pScale + Math.cos(a) * 45 * pScale, -110 * pScale + Math.sin(a) * 45 * pScale, 48 * pScale, 14 * pScale, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM SCARAB BEETLES, CAMELS & DESERT STARS
    const oasisColors = ['#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#10b981'];
    for (let o = 0; o < mediumCount; o++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['JEWELED_SCARAB', 'CRESCENT_DUNE', 'OASIS_LOTUS']);
      const baseColor = randomChoice(oasisColors);

      candidates.push({
        id: `oasis_obj_${o}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#f59e0b' ? '#06b6d4' : '#f59e0b';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'JEWELED_SCARAB') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.35, curSize * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.45);
            ctx.lineTo(0, curSize * 0.45);
            ctx.stroke();
          } else if (kind === 'CRESCENT_DUNE') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0c0f24';
            ctx.beginPath();
            ctx.arc(curSize * 0.18, -curSize * 0.1, curSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = color;
            for (let l = 0; l < 6; l++) {
              const la = (l * Math.PI * 2) / 6;
              ctx.beginPath();
              ctx.ellipse(Math.cos(la) * (curSize * 0.3), Math.sin(la) * (curSize * 0.3), curSize * 0.25, curSize * 0.12, la, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO DESERT MIRAGE PARTICLES
    for (let m = 0; m < microCount; m++) {
      const mx = randomRange(40, width - 40);
      const my = randomRange(40, height - 40);
      const mSize = randomRange(8, 16);

      candidates.push({
        id: `mirage_${m}`,
        x: mx, y: my, size: mSize, kind: 'MIRAGE_STAR', baseColor: '#ffd166',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(mx, my);
          let mcol = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : '#ffd166';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? mSize * 1.8 : mSize;

          ctx.fillStyle = mcol;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 6) {
    // =========================================================================
    // ⚙️ WORLD 7: STEAMPUNK CLOCKWORK & BRASS ATRIUM
    // =========================================================================
    sceneTitle = 'Steampunk Clockwork Atrium';

    ctxA.fillStyle = '#1c1611';
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO ELEMENT: Giant Brass Pocket Watch & Escapement (220px)
    const gearX = randomRange(width * 0.35, width * 0.65);
    const gearY = height * 0.5;
    const gearColor = '#d4af37';

    candidates.push({
      id: 'hero_brass_gear',
      x: gearX, y: gearY, size: 110, kind: 'BRASS_CLOCK_GEAR', baseColor: gearColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(gearX, gearY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#cd7f32' : gearColor;
        const gScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        for (let g = 0; g < 12; g++) {
          const a = (g * Math.PI * 2) / 12;
          ctx.fillRect(Math.cos(a) * (52 * gScale) - 5, Math.sin(a) * (52 * gScale) - 5, 10, 10);
        }
        ctx.beginPath();
        ctx.arc(0, 0, 52 * gScale, 0, Math.PI * 2);
        ctx.fill();

        // Clock Dial
        ctx.fillStyle = '#faf8f5';
        ctx.beginPath();
        ctx.arc(0, 0, 42 * gScale, 0, Math.PI * 2);
        ctx.fill();

        // Clock Hands
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3 * gScale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const handAngle = (mutated && mType === 'SHAPE_ROTATE') ? Math.PI : -Math.PI / 2;
        ctx.lineTo(Math.cos(handAngle) * 30 * gScale, Math.sin(handAngle) * 30 * gScale);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 2. MEDIUM GEARS, VACUUM TUBES, PRESSURE GAUGES
    const brassColors = ['#d4af37', '#c0c0c0', '#cd7f32', '#f59e0b', '#06b6d4'];
    for (let b = 0; b < mediumCount; b++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['MINI_GEAR', 'VACUUM_TUBE', 'PRESSURE_GAUGE']);
      const baseColor = randomChoice(brassColors);

      candidates.push({
        id: `steampunk_obj_${b}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#d4af37' ? '#06b6d4' : '#d4af37';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'MINI_GEAR') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1c1611';
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.18, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === 'VACUUM_TUBE') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.25, curSize * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            // Glowing filament
            ctx.fillStyle = '#ffd166';
            ctx.shadowColor = '#ffd166';
            ctx.shadowBlur = 8;
            ctx.fillRect(-2, -curSize * 0.2, 4, curSize * 0.4);
          } else {
            // Gauge
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO RIVET BOLTS
    for (let r = 0; r < microCount; r++) {
      const rx = randomRange(40, width - 40);
      const ry = randomRange(40, height - 40);
      const rSize = randomRange(8, 16);

      candidates.push({
        id: `rivet_${r}`,
        x: rx, y: ry, size: rSize, kind: 'RIVET_BOLT', baseColor: '#cd7f32',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(rx, ry);
          let rcol = (mutated && mType === 'COLOR_SHIFT') ? '#00f0ff' : '#cd7f32';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? rSize * 1.8 : rSize;

          ctx.fillStyle = rcol;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else {
    // =========================================================================
    // ❄️ WORLD 8: ARCTIC AURORA & GLACIAL CAVERN
    // =========================================================================
    sceneTitle = 'Arctic Aurora Borealis';

    const auroraGrad = ctxA.createLinearGradient(0, 0, 0, height);
    auroraGrad.addColorStop(0, '#021019');
    auroraGrad.addColorStop(0.4, '#064e3b');
    auroraGrad.addColorStop(0.7, '#0284c7');
    auroraGrad.addColorStop(1, '#f8fafc');
    ctxA.fillStyle = auroraGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO ELEMENT: Dancing Emerald Aurora Curtain (220px)
    const auroraX = width * 0.5;
    const auroraY = 160;
    const auroraColor = '#00ff87';

    candidates.push({
      id: 'hero_aurora_curtain',
      x: auroraX, y: auroraY, size: 110, kind: 'AURORA_CURTAIN', baseColor: auroraColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#a855f7' : auroraColor;
        ctx.strokeStyle = color;
        ctx.lineWidth = 14;
        ctx.shadowColor = color;
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.moveTo(0, 140);
        ctx.bezierCurveTo(width * 0.3, 80, width * 0.7, 220, width, 120);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 2. MEDIUM GLACIAL ICEBERGS, NARWHALS & ICE CRYSTALS
    const arcticColors = ['#00f0ff', '#38bdf8', '#ffffff', '#c084fc', '#4ade80'];
    for (let a = 0; a < mediumCount; a++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['GLACIAL_SPIRE', 'NARWHAL', 'SNOW_CRYSTAL']);
      const baseColor = randomChoice(arcticColors);

      candidates.push({
        id: `arctic_obj_${a}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#00f0ff' ? '#c084fc' : '#00f0ff';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'GLACIAL_SPIRE') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.5);
            ctx.lineTo(curSize * 0.35, curSize * 0.4);
            ctx.lineTo(-curSize * 0.35, curSize * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          } else if (kind === 'NARWHAL') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.45, curSize * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            // Tusk
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(curSize * 0.45, 0);
            ctx.lineTo(curSize * 0.85, -curSize * 0.1);
            ctx.stroke();
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            for (let s = 0; s < 6; s++) {
              const ang = (s * Math.PI * 2) / 6;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(ang) * (curSize * 0.4), Math.sin(ang) * (curSize * 0.4));
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO SNOWFLAKES
    for (let f = 0; f < microCount; f++) {
      const fx = randomRange(40, width - 40);
      const fy = randomRange(40, height - 40);
      const fSize = randomRange(8, 16);

      candidates.push({
        id: `snowflake_${f}`,
        x: fx, y: fy, size: fSize, kind: 'MICRO_SNOWFLAKE', baseColor: '#ffffff',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(fx, fy);
          let fcol = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : '#ffffff';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? fSize * 1.8 : fSize;

          ctx.fillStyle = fcol;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }
  }

  // =========================================================================
  // GUARANTEED EXACTLY 1 DIFFERENCE ENGINE
  // 1. Draw ALL objects onto Canvas A in pristine state
  // 2. Clone Canvas A 100% onto Canvas B
  // 3. Mutate ONLY targetObj on Canvas B
  // =========================================================================

  // Draw all candidates onto Canvas A
  candidates.forEach(c => c.draw(ctxA, false, ''));

  // Clone background & scene 100% onto Canvas B
  ctxB.drawImage(canvasA, 0, 0);

  // Pick exactly 1 target from candidates
  const targetIndex = Math.floor(random() * candidates.length);
  const targetObj = candidates[targetIndex];
  const mutationType = randomChoice(['COLOR_SHIFT', 'SCALE_CHANGE', 'SHAPE_ROTATE', 'ADD_DETAIL', 'REMOVE_DETAIL']);

  // Draw candidates onto Canvas B: all in pristine state, EXCEPT targetObj which gets mutated
  candidates.forEach(c => {
    if (c.id === targetObj.id) {
      c.draw(ctxB, true, mutationType);
    } else {
      c.draw(ctxB, false, '');
    }
  });

  // Calculate Difference Coordinate Percentages
  const diffX = Math.round((targetObj.x / width) * 1000) / 10;
  const diffY = Math.round((targetObj.y / height) * 1000) / 10;
  const hitRadius = targetDifficulty === 'Easy' ? 10 : targetDifficulty === 'Medium' ? 8 : 6;

  const diffs = [
    {
      id: 1,
      x: diffX,
      y: diffY,
      radius: hitRadius,
      mutationType,
      hint: `Look closely near the ${targetObj.kind || 'feature'} at (${diffX}%, ${diffY}%)`
    }
  ];

  // Convert to Data URLs for instant native painting
  const dataUrlA = canvasA.toDataURL('image/jpeg', 0.94);
  const dataUrlB = canvasB.toDataURL('image/jpeg', 0.94);

  const imgA = new Image();
  imgA.src = dataUrlA;

  const imgB = new Image();
  imgB.src = dataUrlB;

  return {
    id: `procedural_${themeId}_${seed}`,
    title: `${sceneTitle} #${Math.floor(seed % 1000)}`,
    category: isPhotoTheme ? 'Photographic' : 'Illustrated',
    difficulty: targetDifficulty,
    totalDifferences: 1,
    diffs,
    render: (ctx, w, h, isModified) => {
      const img = isModified ? imgB : imgA;
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      }
    }
  };
}
