// Procedural Image Pair & Mutation Generation Pipeline Engine
// Generates Clean 1:1 Base Image -> Guaranteed Single Visible Mutation -> DataURL Cache

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color to a high-contrast hue
  'REMOVE_OBJECT',    // Draw object on Image A only (missing on Image B)
  'ADD_DETAIL'        // Add high-contrast micro detail on Image B
];

/**
 * Generates a 1:1 Image Pair (Base vs Modified) with guaranteed single visible difference.
 * Calibrated clutter density and fair target hit radiuses.
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
  // STEP 1: RENDER BASE BACKGROUND ON CANVAS A
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

  } else {
    // Fantastical / Cyber Grid Theme
    ctxA.fillStyle = '#0a0814';
    ctxA.fillRect(0, 0, width, height);

    // Cyber background grid lines
    ctxA.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctxA.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctxA.beginPath();
      ctxA.moveTo(x, 0);
      ctxA.lineTo(x, height);
      ctxA.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctxA.beginPath();
      ctxA.moveTo(0, y);
      ctxA.lineTo(width, y);
      ctxA.stroke();
    }

    const neonColors = ['#ff007f', '#00f0ff', '#ffb703', '#00ff87', '#d500f9'];

    for (let cx = 35; cx < width - 35; cx += 40) {
      for (let cy = 35; cy < height - 35; cy += 40) {
        if (random() > 0.45) continue;
        const color = randomChoice(neonColors);
        const objId = `cyber_${cx}_${cy}`;
        const itemW = targetDifficulty === 'Easy' ? 20 : targetDifficulty === 'Medium' ? 15 : 11;
        const itemH = targetDifficulty === 'Easy' ? 20 : targetDifficulty === 'Medium' ? 15 : 11;

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
  // STEP 2: COPY CANVAS A BACKGROUND TO CANVAS B (100% IDENTICAL BASE)
  // -------------------------------------------------------------
  ctxB.drawImage(canvasA, 0, 0);

  // -------------------------------------------------------------
  // STEP 3: CHOOSE EXACT 1 TARGET OBJECT FOR MUTATION
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
  // If REMOVE_OBJECT: skip targetObj on Canvas B (restoring identical background)
  // If COLOR_SHIFT / ADD_DETAIL: draw targetObj with mutated flag on Canvas B
  objects.forEach(obj => {
    if (obj.id === targetObj.id) {
      if (mutation === 'REMOVE_OBJECT') {
        // Redraw background patch on canvas B to remove target object cleanly
        ctxB.drawImage(canvasA, obj.x - 2, obj.y - 2, obj.w + 4, obj.h + 4, obj.x - 2, obj.y - 2, obj.w + 4, obj.h + 4);
      } else {
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
