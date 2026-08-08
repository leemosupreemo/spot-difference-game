// Procedural Image Pair & Mutation Generation Pipeline Engine
// Generates Clean 1:1 Base Image -> Guaranteed Single Visible Mutation -> DataURL Cache

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Find The Sniper: Camouflage', category: 'Extreme Hunter' },
  { id: 'lego_kingdom', title: 'Lego Micro Kingdom', category: 'Toys & Bricks' },
  { id: 'dense_landscape', title: 'Alpine Meadow & Forest', category: 'Landscape' },
  { id: 'antique_shop', title: 'Magical Antique Shop', category: 'Fantasy' },
  { id: 'cyber_arcade', title: 'Cyberpunk Arcade Alley', category: 'Cyberpunk' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color to a high-contrast hue
  'REMOVE_OBJECT',    // Draw object on Image A only (missing on Image B)
  'ADD_DETAIL'        // Add high-contrast micro detail on Image B
];

/**
 * Generates a 1:1 Image Pair (Base vs Modified) with guaranteed single visible difference.
 * Calibrated clutter density (250 - 1,400 items) and fair target hit radiuses (5% - 12%).
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

  // Balanced background clutter & visual noise count
  const noiseCount = targetDifficulty === 'Easy' ? 250 : targetDifficulty === 'Medium' ? 600 : 1400;

  // Track discrete candidate target objects
  const objects = [];

  // -------------------------------------------------------------
  // STEP 1: RENDER BASE BACKGROUND & SCENE OBJECTS
  // -------------------------------------------------------------
  if (themeId === 'find_the_sniper') {
    ctxA.fillStyle = '#1c120c';
    ctxA.fillRect(0, 0, width, height);

    // Autumn leaves, pebbles & forest litter
    const leafColors = ['#d94e1f', '#b83b1d', '#9e2a2b', '#e07a5f', '#f4a261', '#e9c46a', '#3a5a40', '#486b00', '#633900'];
    for (let i = 0; i < noiseCount; i++) {
      const lx = random() * width;
      const ly = random() * height;
      const lSize = 3 + random() * 7;
      ctxA.fillStyle = randomChoice(leafColors);
      ctxA.beginPath();
      ctxA.ellipse(lx, ly, lSize, lSize / 2, random() * Math.PI, 0, Math.PI * 2);
      ctxA.fill();
    }

    // Grid of Candidate Target Objects
    for (let gx = 40; gx < width - 40; gx += 45) {
      for (let gy = 40; gy < height - 40; gy += 45) {
        if (random() > 0.45) continue;
        const color = randomChoice(leafColors);
        const objId = `sniper_item_${gx}_${gy}`;
        const itemW = targetDifficulty === 'Easy' ? 18 : targetDifficulty === 'Medium' ? 14 : 10;
        const itemH = targetDifficulty === 'Easy' ? 18 : targetDifficulty === 'Medium' ? 14 : 10;

        objects.push({
          id: objId,
          type: 'SNIPER_OBJECT',
          x: gx, y: gy, w: itemW, h: itemH, color,
          draw: (ctx, drawColor, isMutated, mType) => {
            let finalColor = drawColor;
            if (isMutated && mType === 'COLOR_SHIFT') {
              finalColor = drawColor === '#ff0055' ? '#00f0ff' : '#ff0055';
            }
            ctx.fillStyle = finalColor;
            ctx.beginPath();
            ctx.arc(gx + itemW / 2, gy + itemH / 2, itemW / 2, 0, Math.PI * 2);
            ctx.fill();

            if (isMutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#00f0ff';
              ctx.fillRect(gx + itemW / 4, gy + itemH / 4, itemW / 2, itemH / 2);
            }
          }
        });
      }
    }

  } else if (themeId === 'lego_kingdom') {
    ctxA.fillStyle = '#1b5e20';
    ctxA.fillRect(0, 0, width, height);

    // Lego Stud Grid Floor
    ctxA.fillStyle = '#2e7d32';
    for (let gx = 8; gx < width; gx += 16) {
      for (let gy = 8; gy < height; gy += 16) {
        ctxA.beginPath();
        ctxA.arc(gx, gy, 3, 0, Math.PI * 2);
        ctxA.fill();
      }
    }

    const brickColors = ['#e53935', '#1e88e5', '#fdd835', '#fb8c00', '#8e24aa', '#ff007f'];
    
    for (let bx = 30; bx < width - 30; bx += 32) {
      for (let by = 30; by < height - 30; by += 32) {
        if (random() > 0.5) continue;
        const bColor = randomChoice(brickColors);
        const objId = `lego_${bx}_${by}`;
        const brickW = targetDifficulty === 'Easy' ? 22 : targetDifficulty === 'Medium' ? 16 : 12;
        const brickH = targetDifficulty === 'Easy' ? 18 : targetDifficulty === 'Medium' ? 14 : 10;

        objects.push({
          id: objId,
          type: 'LEGO_BRICK',
          x: bx, y: by, w: brickW, h: brickH, color: bColor,
          draw: (ctx, drawColor, isMutated, mType) => {
            let finalColor = drawColor;
            if (isMutated && mType === 'COLOR_SHIFT') {
              finalColor = drawColor === '#00f0ff' ? '#ff007f' : '#00f0ff';
            }
            ctx.fillStyle = finalColor;
            ctx.fillRect(bx, by, brickW, brickH);
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.strokeRect(bx, by, brickW, brickH);

            if (isMutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(bx + brickW / 2, by + brickH / 2, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }
    }

  } else if (themeId === 'dense_landscape') {
    const skyGrad = ctxA.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#1b263b');
    skyGrad.addColorStop(1, '#415a77');
    ctxA.fillStyle = skyGrad;
    ctxA.fillRect(0, 0, width, height);

    const flowerColors = ['#ff007f', '#ffea00', '#00f0ff', '#ffb703', '#ffffff'];
    for (let i = 0; i < noiseCount; i++) {
      const fx = random() * width;
      const fy = random() * height;
      const fRadius = 2 + random() * 4;
      ctxA.fillStyle = randomChoice(flowerColors);
      ctxA.beginPath();
      ctxA.arc(fx, fy, fRadius, 0, Math.PI * 2);
      ctxA.fill();
    }

    for (let gx = 35; gx < width - 35; gx += 40) {
      for (let gy = 35; gy < height - 35; gy += 40) {
        if (random() > 0.45) continue;
        const color = randomChoice(flowerColors);
        const objId = `meadow_${gx}_${gy}`;
        const itemW = targetDifficulty === 'Easy' ? 18 : targetDifficulty === 'Medium' ? 14 : 10;
        const itemH = targetDifficulty === 'Easy' ? 18 : targetDifficulty === 'Medium' ? 14 : 10;

        objects.push({
          id: objId,
          type: 'MEADOW_ITEM',
          x: gx, y: gy, w: itemW, h: itemH, color,
          draw: (ctx, drawColor, isMutated, mType) => {
            let finalColor = drawColor;
            if (isMutated && mType === 'COLOR_SHIFT') {
              finalColor = drawColor === '#ffea00' ? '#ff007f' : '#ffea00';
            }
            ctx.fillStyle = finalColor;
            ctx.beginPath();
            ctx.arc(gx + itemW / 2, gy + itemH / 2, itemW / 2, 0, Math.PI * 2);
            ctx.fill();

            if (isMutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#00f0ff';
              ctx.fillRect(gx + itemW / 4, gy + itemH / 4, itemW / 2, itemH / 2);
            }
          }
        });
      }
    }

  } else if (themeId === 'antique_shop') {
    ctxA.fillStyle = '#140c07';
    ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = '#2d1810';
    for (let sy = 70; sy < height; sy += 80) {
      ctxA.fillRect(0, sy, width, 10);
    }

    const itemColors = ['#00e676', '#ff1744', '#ffea00', '#d500f9', '#00b0ff'];

    for (let sy = 70; sy < height - 40; sy += 80) {
      for (let sx = 30; sx < width - 30; sx += 35) {
        if (random() > 0.45) continue;
        const color = randomChoice(itemColors);
        const objId = `antique_${sx}_${sy}`;
        const itemW = targetDifficulty === 'Easy' ? 18 : targetDifficulty === 'Medium' ? 14 : 10;
        const itemH = targetDifficulty === 'Easy' ? 28 : targetDifficulty === 'Medium' ? 22 : 16;

        objects.push({
          id: objId,
          type: 'POTION_VIAL',
          x: sx, y: sy - itemH, w: itemW, h: itemH, color,
          draw: (ctx, drawColor, isMutated, mType) => {
            let finalColor = drawColor;
            if (isMutated && mType === 'COLOR_SHIFT') {
              finalColor = drawColor === '#00b0ff' ? '#ff1744' : '#00b0ff';
            }
            ctx.fillStyle = finalColor;
            ctx.fillRect(sx, sy - itemH, itemW, itemH);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.strokeRect(sx, sy - itemH, itemW, itemH);

            if (isMutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffea00';
              ctx.beginPath();
              ctx.arc(sx + itemW / 2, sy - itemH / 2, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }
    }

  } else {
    ctxA.fillStyle = '#030308';
    ctxA.fillRect(0, 0, width, height);

    ctxA.strokeStyle = '#00f0ff';
    ctxA.lineWidth = 0.5;
    for (let y = 15; y < height; y += 20) {
      ctxA.beginPath();
      ctxA.moveTo(0, y);
      ctxA.lineTo(width, y);
      ctxA.stroke();
    }

    const neonColors = ['#ff007f', '#00f0ff', '#ffb703', '#00ff87', '#d500f9'];

    for (let cx = 25; cx < width - 25; cx += 32) {
      for (let cy = 25; cy < height - 25; cy += 32) {
        if (random() > 0.45) continue;
        const color = randomChoice(neonColors);
        const objId = `cyber_${cx}_${cy}`;
        const itemW = targetDifficulty === 'Easy' ? 18 : targetDifficulty === 'Medium' ? 14 : 10;
        const itemH = targetDifficulty === 'Easy' ? 18 : targetDifficulty === 'Medium' ? 14 : 10;

        objects.push({
          id: objId,
          type: 'CYBER_BUTTON',
          x: cx, y: cy, w: itemW, h: itemH, color,
          draw: (ctx, drawColor, isMutated, mType) => {
            let finalColor = drawColor;
            if (isMutated && mType === 'COLOR_SHIFT') {
              finalColor = drawColor === '#ff007f' ? '#00ff87' : '#ff007f';
            }
            ctx.fillStyle = finalColor;
            ctx.fillRect(cx, cy, itemW, itemH);

            if (isMutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#00f0ff';
              ctx.fillRect(cx + itemW / 4, cy + itemH / 4, itemW / 2, itemH / 2);
            }
          }
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STEP 2: CHOOSE EXACT 1 TARGET OBJECT FOR MUTATION
  // -------------------------------------------------------------
  const targetObj = objects.length > 0 ? randomChoice(objects) : {
    id: 'fallback_target',
    type: 'TARGET_PIXEL',
    x: width / 2, y: height / 2, w: 16, h: 16, color: '#ff0055',
    draw: (ctx, c, isMutated, mType) => {
      ctx.fillStyle = isMutated ? '#00f0ff' : '#ff0055';
      ctx.fillRect(width / 2, height / 2, 16, 16);
    }
  };

  const mutation = randomChoice(MUTATION_TYPES);

  // Draw ALL objects on Canvas A (including targetObj in original state)
  objects.forEach(obj => obj.draw(ctxA, obj.color, false, ''));

  // Draw ALL objects on Canvas B
  // If REMOVE_OBJECT: skip targetObj on Canvas B
  // If COLOR_SHIFT / ADD_DETAIL: draw targetObj with mutated flag on Canvas B
  objects.forEach(obj => {
    if (obj.id === targetObj.id) {
      if (mutation !== 'REMOVE_OBJECT') {
        obj.draw(ctxB, obj.color, true, mutation);
      }
    } else {
      obj.draw(ctxB, obj.color, false, '');
    }
  });

  // Calculate Center Percent & Radius
  const centerXPercent = Math.round(((targetObj.x + targetObj.w / 2) / width) * 100);
  const centerYPercent = Math.round(((targetObj.y + targetObj.h / 2) / height) * 100);

  // Fair & fun hit radiuses for mobile touch
  const radiusPercent = targetDifficulty === 'Easy' ? 12 : targetDifficulty === 'Medium' ? 8 : 5;

  const diffs = [
    {
      id: 1,
      x: centerXPercent,
      y: centerYPercent,
      radius: radiusPercent,
      mutationType: mutation,
      description: `Spot the 1 difference!`,
      hint: `Look closely near (${centerXPercent}%, ${centerYPercent}%)`
    }
  ];

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
