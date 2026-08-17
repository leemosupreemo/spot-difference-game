// Multi-Scale Organic Procedural Art Engine
// GUARANTEED EXACTLY 1 VISIBLE DIFFERENCE between Image A and Image B
// Features 4 Rich Organic Worlds with True Scale Hierarchy:
// 1. Bioluminescent Deep Ocean Reef (Giant Jellyfish, Manta Rays, Coral Fans, Koi/Turtles, Dewy Plankton)
// 2. Tropical Botanical Canopy (Hero Monstera Fronds, Toucans/Butterflies, Tree Frogs, Specular Dewdrops)
// 3. Cosmic Nebula & Planetary System (Gas Giants with Rings, Spiral Galaxies, Comets, Constellations)
// 4. Japanese Pagoda & Sakura Garden (Curved Pagoda Eaves, Koi Fish, Paper Lanterns, Swirling Blossom Petals)

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const ART_WORLDS = [
  { id: 'ocean_reef', name: 'Bioluminescent Ocean Reef' },
  { id: 'botanical_canopy', name: 'Tropical Botanical Canopy' },
  { id: 'cosmic_nebula', name: 'Cosmic Nebula & Planetary System' },
  { id: 'sakura_pagoda', name: 'Japanese Pagoda & Sakura Garden' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color to a contrasting bold hue
  'REMOVE_DETAIL',    // Remove a distinct sub-element / spot / stripe / jewel
  'ADD_DETAIL',       // Add an ornament / spot / beacon / highlight
  'SHAPE_ROTATE',     // Rotate the element by 45-90 degrees
  'SCALE_CHANGE'      // Scale the element up or down
];

function createPRNG(seed) {
  let s = Math.abs(Math.floor(seed || 1)) % 2147483647;
  if (s <= 0) s = 1;
  // Mulberry/LCG seed hash mixing
  s = (s ^ 0x6D2B79F5) % 2147483647;
  if (s <= 0) s = 1;
  s = (s * 48271) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates an authentic, multi-scale organic procedural scene pair
 * with guaranteed exactly 1 visible difference.
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

  // Pick one of 4 rich organic worlds
  const worldIndex = Math.floor(random() * 4);

  if (worldIndex === 0) {
    // =========================================================================
    // 🌊 WORLD 1: BIOLUMINESCENT DEEP OCEAN REEF
    // =========================================================================
    sceneTitle = 'Bioluminescent Reef';

    // Abyssal deep ocean gradient
    const oceanGrad = ctxA.createRadialGradient(width * 0.5, height * 0.4, 50, width * 0.5, height * 0.5, width * 0.75);
    oceanGrad.addColorStop(0, '#06283d');
    oceanGrad.addColorStop(0.5, '#02182b');
    oceanGrad.addColorStop(1, '#010914');
    ctxA.fillStyle = oceanGrad;
    ctxA.fillRect(0, 0, width, height);

    // Atmospheric sun rays / caustic beams
    ctxA.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctxA.lineWidth = 40;
    for (let r = 0; r < 5; r++) {
      ctxA.beginPath();
      ctxA.moveTo(width * 0.2 + r * 120, 0);
      ctxA.lineTo(width * 0.1 + r * 150, height);
      ctxA.stroke();
    }

    // 1. HERO ELEMENT: Giant Bioluminescent Jellyfish (180px)
    const jellyX = randomRange(width * 0.25, width * 0.75);
    const jellyY = randomRange(120, 220);
    const jellyColor = randomChoice(['#ff007f', '#00f0ff', '#a855f7', '#00ff87']);

    candidates.push({
      id: 'hero_jellyfish',
      x: jellyX, y: jellyY, size: 90, kind: 'JELLYFISH_BELL', baseColor: jellyColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(jellyX, jellyY);
        let color = jellyColor;
        if (mutated && mType === 'COLOR_SHIFT') {
          color = jellyColor === '#ff007f' ? '#00f0ff' : jellyColor === '#00f0ff' ? '#00ff87' : '#ff007f';
        }
        const bellScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        // Translucent Glowing Bell
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, 50 * bellScale, Math.PI, 0, false);
        ctx.bezierCurveTo(45 * bellScale, 20 * bellScale, -45 * bellScale, 20 * bellScale, -50 * bellScale, 0);
        ctx.closePath();
        ctx.fill();

        // Inner bell glow organ
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(0, -10 * bellScale, 16 * bellScale, Math.PI, 0, false);
          ctx.fill();
        }

        // Bioluminescent Tentacles
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.75;
        for (let t = -3; t <= 3; t++) {
          ctx.beginPath();
          ctx.moveTo(t * 12 * bellScale, 10);
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
      x: coralX, y: coralY - 60, size: 80, kind: 'CORAL_FAN', baseColor: coralColor,
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
          const len = 90 - Math.abs(b) * 10;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(Math.cos(a) * (len * 0.5) + b * 6, Math.sin(a) * (len * 0.5), Math.cos(a) * len, Math.sin(a) * len);
          ctx.stroke();

          // Coral Polyp Nodes
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

    // 3. MEDIUM ELEMENTS: Swimming Sea Creatures (Turtles, Fish, Starfish) (50-80px)
    const fishCount = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 22 : 30;
    const fishColors = ['#ff9f1c', '#2ec4b6', '#e71d36', '#ff007f', '#00f0ff', '#ffd166'];

    for (let f = 0; f < fishCount; f++) {
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
            // Tail fin
            ctx.beginPath();
            ctx.moveTo(-curSize * 0.4 * dir, 0);
            ctx.lineTo(-curSize * 0.7 * dir, -curSize * 0.28);
            ctx.lineTo(-curSize * 0.7 * dir, curSize * 0.28);
            ctx.closePath();
            ctx.fill();
            // Eye
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curSize * 0.25 * dir, -curSize * 0.06, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(curSize * 0.25 * dir, -curSize * 0.06, 1.8, 0, Math.PI * 2);
            ctx.fill();
            // Side stripe
            if (!(mutated && mType === 'REMOVE_DETAIL')) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.2, -0.8, 0.8);
              ctx.stroke();
            }
          } else if (kind === 'SEA_TURTLE') {
            // Shell
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.4, curSize * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Flippers
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(curSize * 0.3, -curSize * 0.32, curSize * 0.25, curSize * 0.1, -0.6, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.3, curSize * 0.32, curSize * 0.25, curSize * 0.1, 0.6, 0, Math.PI * 2);
            ctx.fill();
            // Shell star pattern
            if (mutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(0, 0, 5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Starfish
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

    // 4. MICRO ELEMENTS: Luminescent Oxygen Bubble Clusters (10-20px)
    for (let b = 0; b < 24; b++) {
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

          // Specular gleam
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

    // Rich canopy gradient
    const jungleGrad = ctxA.createLinearGradient(0, 0, 0, height);
    jungleGrad.addColorStop(0, '#061a10');
    jungleGrad.addColorStop(0.5, '#0b351e');
    jungleGrad.addColorStop(1, '#1b5e34');
    ctxA.fillStyle = jungleGrad;
    ctxA.fillRect(0, 0, width, height);

    // Dappled golden sunbeams
    ctxA.strokeStyle = 'rgba(255, 235, 59, 0.08)';
    ctxA.lineWidth = 60;
    for (let s = 0; s < 4; s++) {
      ctxA.beginPath();
      ctxA.moveTo(width * 0.1 + s * 220, 0);
      ctxA.lineTo(width * 0.3 + s * 220, height);
      ctxA.stroke();
    }

    // 1. HERO ELEMENT: Giant Monstera Deliciosa Leaf (200px)
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

        // Fenestration Cutouts
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

    // 2. MEDIUM ELEMENTS: Toucans, Tree Frogs, Exotic Orchids (45-80px)
    const faunaCount = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 22 : 30;
    const faunaColors = ['#ff0054', '#ffbd00', '#00f5d4', '#7b2cbf', '#ff5400', '#3a86ff'];

    for (let f = 0; f < faunaCount; f++) {
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
            // Body
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.35, curSize * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
            // Beak
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(curSize * 0.25, -curSize * 0.1);
            ctx.quadraticCurveTo(curSize * 0.7, -curSize * 0.15, curSize * 0.65, curSize * 0.15);
            ctx.lineTo(curSize * 0.25, curSize * 0.1);
            ctx.closePath();
            ctx.fill();
            // Eye
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
            // Tree frog
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.38, 0, Math.PI * 2);
            ctx.fill();
            // Toe pads
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

    // 3. MICRO ELEMENTS: Specular Glistening Dewdrops (10-18px)
    for (let d = 0; d < 24; d++) {
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
          // Specular highlight
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

    // Deep space nebula wash
    const spaceGrad = ctxA.createRadialGradient(width * 0.5, height * 0.5, 40, width * 0.5, height * 0.5, width * 0.8);
    spaceGrad.addColorStop(0, '#3c096c');
    spaceGrad.addColorStop(0.4, '#10002b');
    spaceGrad.addColorStop(1, '#030008');
    ctxA.fillStyle = spaceGrad;
    ctxA.fillRect(0, 0, width, height);

    // Glowing nebula dust clouds
    ctxA.fillStyle = 'rgba(217, 70, 239, 0.12)';
    for (let c = 0; c < 6; c++) {
      ctxA.beginPath();
      ctxA.arc(randomRange(100, width - 100), randomRange(100, height - 100), randomRange(80, 160), 0, Math.PI * 2);
      ctxA.fill();
    }

    // 1. HERO ELEMENT: Giant Gas Giant Planet with Orbital Rings (220px)
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

        // Planet sphere
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 50 * pScale, 0, Math.PI * 2);
        ctx.fill();

        // Atmospheric Stripes
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

        // Orbital Rings
        ctx.strokeStyle = (mutated && mType === 'ADD_DETAIL') ? '#ff007f' : '#ffd166';
        ctx.lineWidth = 5 * pScale;
        ctx.beginPath();
        ctx.ellipse(0, 0, 95 * pScale, 28 * pScale, -0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 2. MEDIUM ELEMENTS: Comets, Asteroids, Satellites (45-80px)
    const cosmicCount = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 22 : 30;
    const cosmicColors = ['#00f0ff', '#ff007f', '#ffd166', '#ffffff', '#a855f7', '#00ff87'];

    for (let c = 0; c < cosmicCount; c++) {
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
            // Luminous Tail
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-curSize * 0.8, -curSize * 0.6);
            ctx.stroke();
            // Nucleus
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.22, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === 'CRATERED_MOON') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            // Craters
            if (!(mutated && mType === 'REMOVE_DETAIL')) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
              ctx.beginPath();
              ctx.arc(-curSize * 0.12, -curSize * 0.1, curSize * 0.12, 0, Math.PI * 2);
              ctx.arc(curSize * 0.14, curSize * 0.12, curSize * 0.08, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Satellite Orbiter
            ctx.fillStyle = color;
            ctx.fillRect(-curSize * 0.2, -curSize * 0.2, curSize * 0.4, curSize * 0.4);
            // Solar Wings
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(-curSize * 0.55, -curSize * 0.08, curSize * 0.3, curSize * 0.16);
            ctx.fillRect(curSize * 0.25, -curSize * 0.08, curSize * 0.3, curSize * 0.16);
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO ELEMENTS: 8-Point Diffraction Starbursts (10-20px)
    for (let s = 0; s < 26; s++) {
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

  } else {
    // =========================================================================
    // 🌸 WORLD 4: JAPANESE PAGODA & SAKURA GARDEN
    // =========================================================================
    sceneTitle = 'Sakura Pagoda Garden';

    // Twilight mountain watercolor wash
    const sakuraGrad = ctxA.createLinearGradient(0, 0, 0, height);
    sakuraGrad.addColorStop(0, '#fce7f3');
    sakuraGrad.addColorStop(0.4, '#fbcfe8');
    sakuraGrad.addColorStop(0.7, '#f472b6');
    sakuraGrad.addColorStop(1, '#4c1d95');
    ctxA.fillStyle = sakuraGrad;
    ctxA.fillRect(0, 0, width, height);

    // Giant Crimson Sun Disc
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

        // Sweeping Curved Eaves
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-90 * pScale, 0);
        ctx.quadraticCurveTo(0, -35 * pScale, 90 * pScale, 0);
        ctx.lineTo(75 * pScale, 20 * pScale);
        ctx.quadraticCurveTo(0, 0, -75 * pScale, 20 * pScale);
        ctx.closePath();
        ctx.fill();

        // Pagoda Spire Finial
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(0, -38 * pScale, 8 * pScale, 0, Math.PI * 2);
        ctx.fill();

        // Hanging Roof Bells
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

    // 2. MEDIUM ELEMENTS: Swimming Nishikigoi (Koi), Paper Lanterns, Origami Cranes (45-80px)
    const gardenCount = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 22 : 30;
    const gardenColors = ['#e11d48', '#fb923c', '#ffffff', '#ffd166', '#a855f7', '#06b6d4'];

    for (let g = 0; g < gardenCount; g++) {
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
            // S-curve Koi Body
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.45, curSize * 0.22, 0.4, 0, Math.PI * 2);
            ctx.fill();
            // Scarlet patch
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(curSize * 0.1, -curSize * 0.05, curSize * 0.18, 0, Math.PI * 2);
            ctx.fill();
            // Tail fin
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.moveTo(-curSize * 0.4, 0);
            ctx.lineTo(-curSize * 0.7, -curSize * 0.25);
            ctx.lineTo(-curSize * 0.7, curSize * 0.25);
            ctx.closePath();
            ctx.fill();
          } else if (kind === 'PAPER_LANTERN') {
            // Lantern Body
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.35, curSize * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            // Candle Glow Core
            ctx.fillStyle = '#ffd166';
            ctx.shadowColor = '#ffd166';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.16, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // Cap & Tassel
            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(-curSize * 0.2, -curSize * 0.44, curSize * 0.4, 4);
            ctx.fillRect(-curSize * 0.2, curSize * 0.42, curSize * 0.4, 4);
          } else {
            // Origami Crane
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

    // 3. MICRO ELEMENTS: Swirling Sakura Cherry Blossom Petals (10-18px)
    for (let p = 0; p < 28; p++) {
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
