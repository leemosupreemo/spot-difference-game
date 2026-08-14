// Advanced Procedural Image Pair & Mutation Generation Pipeline Engine
// Generates Clean 1:1 Base Image -> Guaranteed Single Visible Mutation -> DataURL Cache

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color to a high-contrast hue
  'REMOVE_OBJECT',    // Draw object on Image A only (missing on Image B)
  'ADD_DETAIL',       // Add high-contrast micro detail / pattern on Image B
  'SHAPE_ROTATE'      // Rotate target object by 45 degrees
];

/**
 * Generates a 1:1 Image Pair (Base vs Modified) with guaranteed single visible difference.
 * Features advanced multi-layer composition, gradient lighting, and varied object primitives.
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
  const randomRange = (min, max) => min + random() * (max - min);

  // Clutter density calibrated by difficulty
  const noiseCount = targetDifficulty === 'Easy' ? 350 : targetDifficulty === 'Medium' ? 750 : 1500;
  const objects = [];

  // -------------------------------------------------------------
  // STEP 1: ADVANCED LAYERED BACKGROUND COMPOSITION
  // -------------------------------------------------------------
  if (themeId === 'find_the_sniper') {
    // PHOTOGRAPHY / NATURE THEME: Forest Floor & Rich Foliage
    const palettes = [
      { bg1: '#120a06', bg2: '#2a170d', leaves: ['#d94e1f', '#b83b1d', '#9e2a2b', '#e07a5f', '#f4a261', '#e9c46a', '#3a5a40', '#486b00', '#633900'] },
      { bg1: '#05190e', bg2: '#0d3b22', leaves: ['#2dc653', '#25a244', '#208b3a', '#1a7431', '#104f55', '#70e000', '#38b000', '#ccff33'] },
      { bg1: '#190a19', bg2: '#3d163d', leaves: ['#9d4edd', '#7b2cbf', '#5a189a', '#3c096c', '#e0aaff', '#c77dff', '#ff007f', '#ffb703'] }
    ];

    const chosenPalette = randomChoice(palettes);

    // Layer 1: Dark Ground Gradient
    const groundGrad = ctxA.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.7);
    groundGrad.addColorStop(0, chosenPalette.bg2);
    groundGrad.addColorStop(1, chosenPalette.bg1);
    ctxA.fillStyle = groundGrad;
    ctxA.fillRect(0, 0, width, height);

    // Layer 2: Background Moss & Fallen Organic Litter
    for (let i = 0; i < noiseCount; i++) {
      const lx = random() * width;
      const ly = random() * height;
      const lSize = randomRange(3, 9);
      const angle = random() * Math.PI * 2;
      ctxA.fillStyle = randomChoice(chosenPalette.leaves);
      ctxA.beginPath();
      ctxA.ellipse(lx, ly, lSize, lSize * 0.5, angle, 0, Math.PI * 2);
      ctxA.fill();
    }

    // Layer 3: Discrete Interactive Target Objects (Leaves, Mushrooms, Pebbles)
    const objectTypes = ['LEAF', 'MUSHROOM', 'PEBBLE', 'CLOVER'];
    const gridStep = targetDifficulty === 'Easy' ? 50 : targetDifficulty === 'Medium' ? 40 : 32;

    for (let gx = 35; gx < width - 35; gx += gridStep) {
      for (let gy = 35; gy < height - 35; gy += gridStep) {
        if (random() > 0.5) continue;
        const color = randomChoice(chosenPalette.leaves);
        const objType = randomChoice(objectTypes);
        const objId = `sniper_${gx}_${gy}`;
        const itemW = targetDifficulty === 'Easy' ? 22 : targetDifficulty === 'Medium' ? 16 : 12;
        const itemH = itemW;
        const rotAngle = random() * Math.PI;

        objects.push({
          id: objId,
          type: objType,
          x: gx, y: gy, w: itemW, h: itemH, color, rotAngle,
          draw: (ctx, drawColor, isMutated, mType) => {
            ctx.save();
            ctx.translate(gx + itemW / 2, gy + itemH / 2);
            const drawAngle = (isMutated && mType === 'SHAPE_ROTATE') ? rotAngle + Math.PI / 4 : rotAngle;
            ctx.rotate(drawAngle);

            let finalColor = drawColor;
            if (isMutated && mType === 'COLOR_SHIFT') {
              finalColor = drawColor === '#ff007f' ? '#00f0ff' : '#ff007f';
            }

            ctx.fillStyle = finalColor;
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1;

            if (objType === 'LEAF') {
              ctx.beginPath();
              ctx.ellipse(0, 0, itemW / 2, itemH / 4, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              // Leaf stem line
              ctx.strokeStyle = 'rgba(255,255,255,0.4)';
              ctx.beginPath();
              ctx.moveTo(-itemW / 2, 0);
              ctx.lineTo(itemW / 2, 0);
              ctx.stroke();
            } else if (objType === 'MUSHROOM') {
              // Mushroom Cap
              ctx.beginPath();
              ctx.arc(0, -2, itemW / 2, Math.PI, 0);
              ctx.fill();
              ctx.stroke();
              // Stem
              ctx.fillStyle = '#f0f4f8';
              ctx.fillRect(-2, -2, 4, itemH / 2);
            } else if (objType === 'PEBBLE') {
              ctx.beginPath();
              ctx.arc(0, 0, itemW / 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              // Specular highlight
              ctx.fillStyle = 'rgba(255,255,255,0.5)';
              ctx.beginPath();
              ctx.arc(-itemW / 4, -itemH / 4, itemW / 6, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // CLOVER
              for (let c = 0; c < 3; c++) {
                ctx.beginPath();
                ctx.arc(Math.cos(c * 2.09) * 4, Math.sin(c * 2.09) * 4, itemW / 3, 0, Math.PI * 2);
                ctx.fill();
              }
            }

            if (isMutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#00f0ff';
              ctx.beginPath();
              ctx.arc(0, 0, 3, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          }
        });
      }
    }

  } else {
    // FANTASTICAL / CYBER COSMOS THEME: Nebula Sky, Glowing Grid & Floating Crystals
    const palettes = [
      { bg1: '#070314', bg2: '#1b003a', neon: ['#ff007f', '#00f0ff', '#ffb703', '#00ff87', '#d500f9', '#7000ff'] },
      { bg1: '#020b14', bg2: '#05294a', neon: ['#00f0ff', '#00ff87', '#3a86ff', '#8338ec', '#ff006e', '#ffbe0b'] },
      { bg1: '#140008', bg2: '#3a001e', neon: ['#ff0055', '#ff5400', '#ffbd00', '#ff007f', '#7000ff', '#00f0ff'] }
    ];

    const chosenPalette = randomChoice(palettes);

    // Layer 1: Cosmic Aurora Gradient
    const spaceGrad = ctxA.createLinearGradient(0, 0, width, height);
    spaceGrad.addColorStop(0, chosenPalette.bg1);
    spaceGrad.addColorStop(0.5, chosenPalette.bg2);
    spaceGrad.addColorStop(1, chosenPalette.bg1);
    ctxA.fillStyle = spaceGrad;
    ctxA.fillRect(0, 0, width, height);

    // Layer 2: Glowing Cyber Perspective Grid
    ctxA.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctxA.lineWidth = 1;
    for (let x = 0; x < width; x += 35) {
      ctxA.beginPath();
      ctxA.moveTo(x, 0);
      ctxA.lineTo(x, height);
      ctxA.stroke();
    }
    for (let y = 0; y < height; y += 35) {
      ctxA.beginPath();
      ctxA.moveTo(0, y);
      ctxA.lineTo(width, y);
      ctxA.stroke();
    }

    // Layer 3: Starfield Particles & Floating Orbs
    for (let i = 0; i < noiseCount; i++) {
      const sx = random() * width;
      const sy = random() * height;
      const sRadius = randomRange(1, 4);
      ctxA.fillStyle = randomChoice(chosenPalette.neon);
      ctxA.beginPath();
      ctxA.arc(sx, sy, sRadius, 0, Math.PI * 2);
      ctxA.fill();
    }

    // Layer 4: Interactive Target Objects (3D Hexagons, Donut Rings, Crystals, Stars)
    const objectTypes = ['HEXAGON', 'DONUT', 'CRYSTAL', 'STAR'];
    const gridStep = targetDifficulty === 'Easy' ? 45 : targetDifficulty === 'Medium' ? 36 : 28;

    for (let cx = 35; cx < width - 35; cx += gridStep) {
      for (let cy = 35; cy < height - 35; cy += gridStep) {
        if (random() > 0.45) continue;
        const color = randomChoice(chosenPalette.neon);
        const objType = randomChoice(objectTypes);
        const objId = `cyber_${cx}_${cy}`;
        const itemW = targetDifficulty === 'Easy' ? 22 : targetDifficulty === 'Medium' ? 16 : 12;
        const itemH = itemW;
        const rotAngle = random() * Math.PI;

        objects.push({
          id: objId,
          type: objType,
          x: cx, y: cy, w: itemW, h: itemH, color, rotAngle,
          draw: (ctx, drawColor, isMutated, mType) => {
            ctx.save();
            ctx.translate(cx + itemW / 2, cy + itemH / 2);
            const drawAngle = (isMutated && mType === 'SHAPE_ROTATE') ? rotAngle + Math.PI / 4 : rotAngle;
            ctx.rotate(drawAngle);

            let finalColor = drawColor;
            if (isMutated && mType === 'COLOR_SHIFT') {
              finalColor = drawColor === '#ff007f' ? '#00ff87' : '#ff007f';
            }

            ctx.fillStyle = finalColor;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;

            if (objType === 'HEXAGON') {
              ctx.beginPath();
              for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const px = Math.cos(angle) * (itemW / 2);
                const py = Math.sin(angle) * (itemH / 2);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            } else if (objType === 'DONUT') {
              ctx.beginPath();
              ctx.arc(0, 0, itemW / 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = chosenPalette.bg1;
              ctx.beginPath();
              ctx.arc(0, 0, itemW / 4, 0, Math.PI * 2);
              ctx.fill();
            } else if (objType === 'CRYSTAL') {
              ctx.beginPath();
              ctx.moveTo(0, -itemH / 2);
              ctx.lineTo(itemW / 2, 0);
              ctx.lineTo(0, itemH / 2);
              ctx.lineTo(-itemW / 2, 0);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            } else {
              // STAR
              ctx.beginPath();
              ctx.fillRect(-itemW / 3, -itemH / 3, (itemW * 2) / 3, (itemH * 2) / 3);
              ctx.strokeRect(-itemW / 3, -itemH / 3, (itemW * 2) / 3, (itemH * 2) / 3);
            }

            if (isMutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#00f0ff';
              ctx.beginPath();
              ctx.arc(0, 0, 3, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
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
  // If COLOR_SHIFT / ADD_DETAIL / SHAPE_ROTATE: draw targetObj with mutated flag on Canvas B
  objects.forEach(obj => {
    if (obj.id === targetObj.id) {
      if (mutation === 'REMOVE_OBJECT') {
        // Redraw background patch on canvas B to remove target object cleanly
        ctxB.drawImage(canvasA, obj.x - 4, obj.y - 4, obj.w + 8, obj.h + 8, obj.x - 4, obj.y - 4, obj.w + 8, obj.h + 8);
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
