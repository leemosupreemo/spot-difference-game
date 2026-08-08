// Procedural Image Pair & Mutation Generation Pipeline Engine
// Generates Hyper-Cluttered, Ultra-Busy Base Image -> Controlled Single Mutation -> DataURL Cache

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Find The Sniper: Camouflage', category: 'Extreme Hunter' },
  { id: 'lego_kingdom', title: 'Lego Micro Kingdom', category: 'Toys & Bricks' },
  { id: 'dense_landscape', title: 'Alpine Meadow & Forest', category: 'Landscape' },
  { id: 'antique_shop', title: 'Magical Antique Shop', category: 'Fantasy' },
  { id: 'cyber_arcade', title: 'Cyberpunk Arcade Alley', category: 'Cyberpunk' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color subtly
  'REMOVE_OBJECT',    // Erase a micro object and inpaint background
  'ADD_DETAIL'        // Add extra micro detail on top of object
];

/**
 * Generates an Image Pair (Base vs Modified) with controlled, programmatic mutations.
 * Scale clutter noise density to 1,500 - 8,000 items for extreme visual challenge!
 */
export function generateProceduralLevelPair(themeId = 'find_the_sniper', targetDifficulty = 'Medium', seed = Date.now()) {
  const width = 800;
  const height = 600;

  // Offscreen canvases for Base (A) and Modified (B)
  const canvasA = document.createElement('canvas');
  canvasA.width = width;
  canvasA.height = height;
  const ctxA = canvasA.getContext('2d');

  const canvasB = document.createElement('canvas');
  canvasB.width = width;
  canvasB.height = height;
  const ctxB = canvasB.getContext('2d');

  // Seeded PRNG
  let currentSeed = seed;
  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  const randomChoice = (arr) => arr[Math.floor(random() * arr.length)];

  // Scale background clutter & visual noise count massively
  const noiseCount = targetDifficulty === 'Easy' ? 1500 : targetDifficulty === 'Medium' ? 3500 : 8000;

  // Track discrete candidate target objects
  const objects = [];

  // -------------------------------------------------------------
  // STEP 1: RENDER RICH DENSE SCENE & REGISTER CANDIDATE OBJECTS
  // -------------------------------------------------------------
  if (themeId === 'find_the_sniper') {
    // Forest Floor & Dense Camouflage Noise
    ctxA.fillStyle = '#1c120c';
    ctxA.fillRect(0, 0, width, height);

    // Draw 1,500 - 8,000 autumn leaves, pebbles, twigs & forest litter
    const leafColors = ['#d94e1f', '#b83b1d', '#9e2a2b', '#e07a5f', '#f4a261', '#e9c46a', '#3a5a40', '#486b00', '#2b4400', '#633900'];
    for (let i = 0; i < noiseCount; i++) {
      const lx = random() * width;
      const ly = random() * height;
      const lSize = 2 + random() * 6;
      ctxA.fillStyle = randomChoice(leafColors);
      ctxA.beginPath();
      ctxA.ellipse(lx, ly, lSize, lSize / 2.2, random() * Math.PI, 0, Math.PI * 2);
      ctxA.fill();
    }

    // Grid of Candidate Micro Objects hidden in leaves
    for (let gx = 30; gx < width - 30; gx += 35) {
      for (let gy = 30; gy < height - 30; gy += 35) {
        if (random() > 0.35) continue;
        const color = randomChoice(leafColors);
        const objId = `sniper_item_${gx}_${gy}`;
        const itemType = randomChoice(['ACORN', 'CAMO_BUTTON', 'TWIG_RING', 'PEBBLE']);
        const sizeW = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 10 : 6;
        const sizeH = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 10 : 6;

        objects.push({
          id: objId,
          type: itemType,
          sizeCategory: targetDifficulty === 'Easy' ? 'Medium' : 'Micro',
          x: gx, y: gy, w: sizeW, h: sizeH, color,
          draw: (ctx, drawColor, mutated = false, mutationType = '') => {
            const finalColor = mutated && mutationType === 'COLOR_SHIFT' ? '#ff0055' : drawColor;
            ctx.fillStyle = finalColor;
            ctx.beginPath();
            ctx.arc(gx + sizeW / 2, gy + sizeH / 2, sizeW / 2, 0, Math.PI * 2);
            ctx.fill();

            if (mutated && mutationType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(gx + sizeW / 4, gy + sizeH / 4, sizeW / 2, sizeH / 2);
            }
          }
        });
      }
    }

  } else if (themeId === 'lego_kingdom') {
    // Lego Base Plate Grid & Hyper Stud Noise
    ctxA.fillStyle = '#121218';
    ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = '#1b5e20';
    ctxA.fillRect(0, 0, width, height);

    // Lego Stud Grid Floor
    ctxA.fillStyle = '#2e7d32';
    for (let gx = 6; gx < width; gx += 12) {
      for (let gy = 6; gy < height; gy += 12) {
        ctxA.beginPath();
        ctxA.arc(gx, gy, 2.5, 0, Math.PI * 2);
        ctxA.fill();
      }
    }

    const brickColors = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#ff007f', '#00f0ff'];
    
    // Draw 1,500 - 8,000 Micro Bricks & Gem Studs
    for (let bx = 20; bx < width - 20; bx += 18) {
      for (let by = 20; by < height - 20; by += 18) {
        if (random() > 0.4) continue;
        const bColor = randomChoice(brickColors);
        const objId = `lego_${bx}_${by}`;
        const brickW = targetDifficulty === 'Easy' ? 16 : targetDifficulty === 'Medium' ? 12 : 8;
        const brickH = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 10 : 8;

        objects.push({
          id: objId,
          type: 'LEGO_STUD_TILE',
          sizeCategory: targetDifficulty === 'Easy' ? 'Medium' : 'Micro',
          x: bx, y: by, w: brickW, h: brickH, color: bColor,
          draw: (ctx, drawColor, mutated = false, mutationType = '') => {
            const finalColor = mutated && mutationType === 'COLOR_SHIFT' ? '#ffffff' : drawColor;
            ctx.fillStyle = finalColor;
            ctx.fillRect(bx, by, brickW, brickH);
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, brickW, brickH);

            if (mutated && mutationType === 'ADD_DETAIL') {
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.arc(bx + brickW / 2, by + brickH / 2, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }
    }

  } else if (themeId === 'dense_landscape') {
    // Sky & Mountain Background
    const skyGrad = ctxA.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0d1b2a');
    skyGrad.addColorStop(0.5, '#1b263b');
    skyGrad.addColorStop(1, '#415a77');
    ctxA.fillStyle = skyGrad;
    ctxA.fillRect(0, 0, width, height);

    // Draw 1,500 - 8,000 Meadow Wildflowers & Pines
    const flowerColors = ['#ff007f', '#ffea00', '#00f0ff', '#ffb703', '#ffffff', '#e040fb'];
    for (let i = 0; i < noiseCount; i++) {
      const fx = random() * width;
      const fy = random() * height;
      const fRadius = 1.5 + random() * 4;
      ctxA.fillStyle = randomChoice(flowerColors);
      ctxA.beginPath();
      ctxA.arc(fx, fy, fRadius, 0, Math.PI * 2);
      ctxA.fill();
    }

    for (let gx = 25; gx < width - 25; gx += 30) {
      for (let gy = 25; gy < height - 25; gy += 30) {
        if (random() > 0.35) continue;
        const color = randomChoice(flowerColors);
        const objId = `meadow_${gx}_${gy}`;
        const itemW = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 10 : 6;
        const itemH = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 10 : 6;

        objects.push({
          id: objId,
          type: 'WILDFLOWER_BUTTERFLY',
          sizeCategory: targetDifficulty === 'Easy' ? 'Medium' : 'Micro',
          x: gx, y: gy, w: itemW, h: itemH, color,
          draw: (ctx, drawColor, mutated = false, mutationType = '') => {
            const finalColor = mutated && mutationType === 'COLOR_SHIFT' ? '#000000' : drawColor;
            ctx.fillStyle = finalColor;
            ctx.beginPath();
            ctx.arc(gx + itemW / 2, gy + itemH / 2, itemW / 2, 0, Math.PI * 2);
            ctx.fill();

            if (mutated && mutationType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffea00';
              ctx.fillRect(gx + itemW / 4, gy + itemH / 4, itemW / 2, itemH / 2);
            }
          }
        });
      }
    }

  } else if (themeId === 'antique_shop') {
    // Dark Antique Shelves & Clutter
    ctxA.fillStyle = '#140c07';
    ctxA.fillRect(0, 0, width, height);

    // Shelves Grid
    ctxA.fillStyle = '#2d1810';
    for (let sy = 60; sy < height; sy += 70) {
      ctxA.fillRect(0, sy, width, 8);
    }

    const itemColors = ['#00e676', '#ff1744', '#ffea00', '#d500f9', '#00b0ff', '#ff9100', '#ffffff'];

    // Draw 1,500 - 8,000 Antique Vials, Potions & Clocks
    for (let sy = 60; sy < height - 30; sy += 70) {
      for (let sx = 20; sx < width - 20; sx += 25) {
        if (random() > 0.4) continue;
        const color = randomChoice(itemColors);
        const objId = `antique_${sx}_${sy}`;
        const itemW = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 10 : 7;
        const itemH = targetDifficulty === 'Easy' ? 24 : targetDifficulty === 'Medium' ? 18 : 12;

        objects.push({
          id: objId,
          type: 'POTION_VIAL',
          sizeCategory: targetDifficulty === 'Easy' ? 'Medium' : 'Micro',
          x: sx, y: sy - itemH, w: itemW, h: itemH, color,
          draw: (ctx, drawColor, mutated = false, mutationType = '') => {
            const finalColor = mutated && mutationType === 'COLOR_SHIFT' ? '#ffffff' : drawColor;
            ctx.fillStyle = finalColor;
            ctx.fillRect(sx, sy - itemH, itemW, itemH);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.strokeRect(sx, sy - itemH, itemW, itemH);

            if (mutated && mutationType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ff0055';
              ctx.beginPath();
              ctx.arc(sx + itemW / 2, sy - itemH / 2, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }
    }

  } else {
    // Cyber Arcade Alley & Neon Wiring Grid
    ctxA.fillStyle = '#030308';
    ctxA.fillRect(0, 0, width, height);

    // Neon Matrix Grid
    ctxA.strokeStyle = '#00f0ff';
    ctxA.lineWidth = 0.5;
    for (let y = 10; y < height; y += 15) {
      ctxA.beginPath();
      ctxA.moveTo(0, y);
      ctxA.lineTo(width, y);
      ctxA.stroke();
    }

    const neonColors = ['#ff007f', '#00f0ff', '#ffb703', '#00ff87', '#d500f9', '#ffffff'];

    // Draw 1,500 - 8,000 Cyber Arcade Chips & Buttons
    for (let cx = 15; cx < width - 15; cx += 22) {
      for (let cy = 15; cy < height - 15; cy += 22) {
        if (random() > 0.4) continue;
        const color = randomChoice(neonColors);
        const objId = `cyber_${cx}_${cy}`;
        const itemW = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 10 : 6;
        const itemH = targetDifficulty === 'Easy' ? 14 : targetDifficulty === 'Medium' ? 10 : 6;

        objects.push({
          id: objId,
          type: 'CYBER_BUTTON',
          sizeCategory: targetDifficulty === 'Easy' ? 'Medium' : 'Micro',
          x: cx, y: cy, w: itemW, h: itemH, color,
          draw: (ctx, drawColor, mutated = false, mutationType = '') => {
            const finalColor = mutated && mutationType === 'COLOR_SHIFT' ? '#ffffff' : drawColor;
            ctx.fillStyle = finalColor;
            ctx.fillRect(cx, cy, itemW, itemH);

            if (mutated && mutationType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ff007f';
              ctx.fillRect(cx + itemW / 4, cy + itemH / 4, itemW / 2, itemH / 2);
            }
          }
        });
      }
    }
  }

  // Draw All Base Objects on Canvas A
  objects.forEach(obj => obj.draw(ctxA, obj.color, false, ''));

  // -------------------------------------------------------------
  // STEP 2: COPY CANVAS A -> CANVAS B (PIXEL PERFECT 1:1 CLONE)
  // -------------------------------------------------------------
  ctxB.drawImage(canvasA, 0, 0);

  // -------------------------------------------------------------
  // STEP 3: CONTROLLED SINGLE MUTATION WITH TIGHT TARGET RADIUS
  // -------------------------------------------------------------
  const candidateObjects = (objects.length > 0 ? objects : [{
    id: 'fallback_target',
    type: 'TARGET_PIXEL',
    x: width / 2, y: height / 2, w: 10, h: 10, color: '#ff0055',
    draw: (ctx) => ctx.fillRect(width / 2, height / 2, 10, 10)
  }])
    .sort(() => random() - 0.5)
    .slice(0, 1);

  const diffs = [];

  candidateObjects.forEach((targetObj, index) => {
    const mutation = randomChoice(MUTATION_TYPES);
    let mutatedColor = targetObj.color;

    // Erase object bounding box area on Canvas B
    ctxB.save();
    ctxB.clearRect(targetObj.x - 2, targetObj.y - 2, targetObj.w + 4, targetObj.h + 4);
    
    // Inpaint surrounding background patch
    const patch = ctxA.getImageData(Math.max(0, targetObj.x - 4), Math.max(0, targetObj.y - 4), 1, 1).data;
    ctxB.fillStyle = `rgb(${patch[0]}, ${patch[1]}, ${patch[2]})`;
    ctxB.fillRect(targetObj.x - 2, targetObj.y - 2, targetObj.w + 4, targetObj.h + 4);
    ctxB.restore();

    let description = '';

    if (mutation === 'REMOVE_OBJECT') {
      description = `Removed micro object`;
    } else if (mutation === 'COLOR_SHIFT') {
      mutatedColor = '#ffffff';
      targetObj.draw(ctxB, mutatedColor, true, 'COLOR_SHIFT');
      description = `Recolored micro object`;
    } else {
      targetObj.draw(ctxB, targetObj.color, true, 'ADD_DETAIL');
      description = `Added micro detail`;
    }

    const centerXPercent = Math.round(((targetObj.x + targetObj.w / 2) / width) * 100);
    const centerYPercent = Math.round(((targetObj.y + targetObj.h / 2) / height) * 100);

    // Tight Hit Radius for High Challenge
    const radiusPercent = targetDifficulty === 'Easy' ? 10 : targetDifficulty === 'Medium' ? 6 : 3;

    diffs.push({
      id: index + 1,
      x: centerXPercent,
      y: centerYPercent,
      radius: radiusPercent,
      mutationType: mutation,
      description,
      hint: `Search closely near (${centerXPercent}%, ${centerYPercent}%)`
    });
  });

  // Export DataURLs for 100% Fail-Proof Canvas Painting on Mobile
  const dataUrlA = canvasA.toDataURL('image/png');
  const dataUrlB = canvasB.toDataURL('image/png');

  const imgA = new Image();
  imgA.src = dataUrlA;

  const imgB = new Image();
  imgB.src = dataUrlB;

  return {
    id: `procedural_${themeId}_${seed}`,
    title: `${SCENE_THEMES.find(t => t.id === themeId)?.title || 'Procedural Scene'} #${Math.floor(seed % 1000)}`,
    category: SCENE_THEMES.find(t => t.id === themeId)?.category || 'Procedural',
    difficulty: targetDifficulty,
    totalDifferences: 1,
    bgGradient: ['#0b091a', '#1e1035'],
    accentColor: '#00f0ff',
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
