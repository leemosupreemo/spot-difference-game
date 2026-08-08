// Procedural Image Pair & Mutation Generation Pipeline Engine
// Generates Base Image -> Controlled Single Mutation -> DataURL Image Cache for 100% Reliable Render on Mobile

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Find The Sniper: Camouflage', category: 'Extreme Hunter' },
  { id: 'lego_kingdom', title: 'Lego Micro Kingdom', category: 'Toys & Bricks' },
  { id: 'dense_landscape', title: 'Alpine Meadow & Forest', category: 'Landscape' },
  { id: 'antique_shop', title: 'Magical Antique Shop', category: 'Fantasy' },
  { id: 'cyber_arcade', title: 'Cyberpunk Arcade Alley', category: 'Cyberpunk' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color
  'REMOVE_OBJECT',    // Erase a small object and inpaint background
  'ADD_DETAIL'        // Add extra detail on top of object
];

/**
 * Generates an Image Pair (Base vs Modified) with controlled, programmatic mutations.
 * Returns DataURL cached images for 100% guaranteed rendering across iOS, Android, and Web.
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

  // Scale background clutter & visual noise by difficulty
  const noiseCount = targetDifficulty === 'Easy' ? 180 : targetDifficulty === 'Medium' ? 500 : 1000;

  // Track discrete objects with coordinates & bounding boxes
  const objects = [];

  // -------------------------------------------------------------
  // STEP 1: RENDER RICH DENSE SCENE & REGISTER CANDIDATE OBJECTS
  // -------------------------------------------------------------
  if (themeId === 'find_the_sniper') {
    // Dense Autumn Leaf & Gravel Texture Floor
    ctxA.fillStyle = '#2b1b17';
    ctxA.fillRect(0, 0, width, height);

    // Draw dense autumn leaves & gravel pebbles
    const leafColors = ['#d94e1f', '#b83b1d', '#9e2a2b', '#e07a5f', '#f4a261', '#e9c46a', '#3a5a40'];
    for (let i = 0; i < noiseCount; i++) {
      const lx = random() * width;
      const ly = random() * height;
      const lSize = 4 + random() * 8;
      ctxA.fillStyle = randomChoice(leafColors);
      ctxA.beginPath();
      ctxA.ellipse(lx, ly, lSize, lSize / 2, random() * Math.PI, 0, Math.PI * 2);
      ctxA.fill();
    }

    // 1. Large Object (Easy)
    const catX = width * 0.42;
    const catY = height * 0.58;
    objects.push({
      id: 'sniper_cat',
      type: 'CAMOUFLAGED_CAT',
      sizeCategory: 'Large',
      x: catX, y: catY, w: 36, h: 26, color: '#e07a5f',
      draw: (ctx, color, mutated = false, mutationType = '') => {
        ctx.fillStyle = mutated && mutationType === 'COLOR_SHIFT' ? '#2b1b17' : '#d94e1f';
        ctx.beginPath();
        ctx.ellipse(catX + 18, catY + 13, 18, 11, -Math.PI / 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4a261';
        ctx.beginPath();
        ctx.moveTo(catX + 4, catY + 3);
        ctx.lineTo(catX + 11, catY - 5);
        ctx.lineTo(catX + 14, catY + 6);
        ctx.fill();
      }
    });

    // 2. Medium Object (Medium)
    const owlX = width * 0.78;
    const owlY = height * 0.25;
    objects.push({
      id: 'sniper_owl',
      type: 'HIDDEN_OWL',
      sizeCategory: 'Medium',
      x: owlX, y: owlY, w: 20, h: 24, color: '#9e2a2b',
      draw: (ctx, color, mutated = false, mutationType = '') => {
        ctx.fillStyle = mutated && mutationType === 'COLOR_SHIFT' ? '#2b1b17' : '#9e2a2b';
        ctx.beginPath();
        ctx.ellipse(owlX + 10, owlY + 12, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(owlX + 6, owlY + 8, 3, 0, Math.PI * 2);
        ctx.arc(owlX + 14, owlY + 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 3. Micro Object (Hard)
    const ringX = width * 0.18;
    const ringY = height * 0.72;
    objects.push({
      id: 'sniper_ring',
      type: 'GOLD_RING',
      sizeCategory: 'Micro',
      x: ringX, y: ringY, w: 10, h: 10, color: '#ffea00',
      draw: (ctx, color, mutated = false, mutationType = '') => {
        ctx.strokeStyle = mutated && mutationType === 'COLOR_SHIFT' ? '#888888' : '#ffea00';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ringX + 5, ringY + 5, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

  } else if (themeId === 'lego_kingdom') {
    // Lego Base Plate Grid
    ctxA.fillStyle = '#1b1b24';
    ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = '#2e7d32';
    ctxA.fillRect(0, height * 0.4, width, height * 0.6);

    // Lego Stud Grid Floor
    ctxA.fillStyle = '#1b5e20';
    for (let gx = 8; gx < width; gx += 16) {
      for (let gy = height * 0.4 + 8; gy < height; gy += 16) {
        ctxA.beginPath();
        ctxA.arc(gx, gy, 3, 0, Math.PI * 2);
        ctxA.fill();
      }
    }

    const brickColors = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa'];
    const brickW = targetDifficulty === 'Easy' ? 44 : targetDifficulty === 'Medium' ? 28 : 14;
    const brickH = targetDifficulty === 'Easy' ? 22 : targetDifficulty === 'Medium' ? 14 : 8;

    for (let bx = 40; bx < width - 50; bx += (brickW + 6)) {
      for (let by = 60; by < height * 0.4 - 15; by += (brickH + 6)) {
        const bColor = randomChoice(brickColors);
        const objId = `lego_${bx}_${by}`;

        objects.push({
          id: objId,
          type: 'LEGO_BRICK',
          sizeCategory: targetDifficulty === 'Easy' ? 'Large' : targetDifficulty === 'Medium' ? 'Medium' : 'Micro',
          x: bx, y: by, w: brickW, h: brickH, color: bColor,
          draw: (ctx, color, mutated = false, mutationType = '') => {
            ctx.fillStyle = color;
            ctx.fillRect(bx, by, brickW, brickH);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, brickW, brickH);

            if (mutated && mutationType === 'ADD_DETAIL') {
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
    // Sky & Mountain Sunset Gradient
    const skyGrad = ctxA.createLinearGradient(0, 0, 0, height * 0.5);
    skyGrad.addColorStop(0, '#1a237e');
    skyGrad.addColorStop(0.6, '#880e4f');
    skyGrad.addColorStop(1, '#ff6f00');
    ctxA.fillStyle = skyGrad;
    ctxA.fillRect(0, 0, width, height * 0.5);

    // Mountains
    ctxA.fillStyle = '#263238';
    ctxA.beginPath();
    ctxA.moveTo(0, height * 0.5);
    ctxA.lineTo(width * 0.25, height * 0.22);
    ctxA.lineTo(width * 0.5, height * 0.5);
    ctxA.lineTo(width * 0.75, height * 0.18);
    ctxA.lineTo(width, height * 0.5);
    ctxA.fill();

    // Meadow Field
    ctxA.fillStyle = '#2e7d32';
    ctxA.fillRect(0, height * 0.5, width, height * 0.5);

    // Pine Trees
    for (let i = 0; i < noiseCount / 3; i++) {
      const tx = random() * width;
      const ty = height * 0.45 + random() * (height * 0.5);
      const th = 20 + random() * 30;
      ctxA.fillStyle = '#1b5e20';
      ctxA.beginPath();
      ctxA.moveTo(tx, ty - th);
      ctxA.lineTo(tx - th / 3, ty);
      ctxA.lineTo(tx + th / 3, ty);
      ctxA.fill();
    }

    // Target Objects (Fox, Butterfly, Mushroom)
    const foxX = width * 0.35;
    const foxY = height * 0.65;
    objects.push({
      id: 'landscape_fox',
      type: 'RED_FOX',
      sizeCategory: 'Large',
      x: foxX, y: foxY, w: 32, h: 22, color: '#e65100',
      draw: (ctx, color, mutated = false, mutationType = '') => {
        ctx.fillStyle = mutated && mutationType === 'COLOR_SHIFT' ? '#2e7d32' : '#e65100';
        ctx.fillRect(foxX, foxY, 32, 22);
      }
    });

    const bfX = width * 0.72;
    const bfY = height * 0.55;
    objects.push({
      id: 'landscape_butterfly',
      type: 'BUTTERFLY',
      sizeCategory: 'Micro',
      x: bfX, y: bfY, w: 12, h: 12, color: '#00e5ff',
      draw: (ctx, color, mutated = false, mutationType = '') => {
        ctx.fillStyle = mutated && mutationType === 'COLOR_SHIFT' ? '#ff007f' : '#00e5ff';
        ctx.beginPath();
        ctx.arc(bfX + 6, bfY + 6, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

  } else if (themeId === 'antique_shop') {
    // Dark Wooden Interior
    ctxA.fillStyle = '#1c100b';
    ctxA.fillRect(0, 0, width, height);

    // Shelves
    ctxA.fillStyle = '#3e2723';
    for (let sy = 100; sy < height; sy += 120) {
      ctxA.fillRect(0, sy, width, 14);
    }

    // Antique Bottles & Clocks
    const itemColors = ['#00e676', '#ff1744', '#ffea00', '#d500f9', '#00b0ff'];
    for (let sy = 100; sy < height - 60; sy += 120) {
      for (let sx = 40; sx < width - 40; sx += 60) {
        const itemColor = randomChoice(itemColors);
        const itemId = `item_${sx}_${sy}`;
        objects.push({
          id: itemId,
          type: 'ANTIQUE_BOTTLE',
          sizeCategory: sx > width * 0.6 ? 'Micro' : 'Medium',
          x: sx, y: sy - 35, w: 18, h: 35, color: itemColor,
          draw: (ctx, color, mutated = false, mutationType = '') => {
            ctx.fillStyle = color;
            ctx.fillRect(sx, sy - 35, 18, 35);
          }
        });
      }
    }

  } else {
    // Cyber Arcade Alley
    ctxA.fillStyle = '#05050f';
    ctxA.fillRect(0, 0, width, height);

    // Neon Perspective Grid
    ctxA.strokeStyle = '#00f0ff';
    ctxA.lineWidth = 1;
    for (let y = height * 0.5; y < height; y += 20) {
      ctxA.beginPath();
      ctxA.moveTo(0, y);
      ctxA.lineTo(width, y);
      ctxA.stroke();
    }

    // Arcade Cabinets
    const cabinetColors = ['#ff007f', '#00f0ff', '#ffb703', '#00ff87'];
    for (let ax = 30; ax < width - 60; ax += 70) {
      const cColor = randomChoice(cabinetColors);
      const cabId = `arcade_${ax}`;
      objects.push({
        id: cabId,
        type: 'ARCADE_CABINET',
        sizeCategory: ax > width * 0.5 ? 'Micro' : 'Large',
        x: ax, y: height * 0.25, w: 45, h: 110, color: cColor,
        draw: (ctx, color, mutated = false, mutationType = '') => {
          ctx.fillStyle = color;
          ctx.fillRect(ax, height * 0.25, 45, 110);
        }
      });
    }
  }

  // Draw All Base Objects on Canvas A
  objects.forEach(obj => obj.draw(ctxA, obj.color, false, ''));

  // -------------------------------------------------------------
  // STEP 2: COPY CANVAS A -> CANVAS B (PIXEL PERFECT 1:1 CLONE)
  // -------------------------------------------------------------
  ctxB.drawImage(canvasA, 0, 0);

  // -------------------------------------------------------------
  // STEP 3: CONTROLLED SINGLE MUTATION SELECTED BY TARGET DIFFICULTY
  // -------------------------------------------------------------
  const filteredCandidates = objects.filter(o => {
    if (targetDifficulty === 'Easy') return o.sizeCategory === 'Large' || o.w >= 24;
    if (targetDifficulty === 'Hard') return o.sizeCategory === 'Micro' || o.w <= 16;
    return true;
  });

  const candidateObjects = (filteredCandidates.length > 0 ? filteredCandidates : objects)
    .sort(() => random() - 0.5)
    .slice(0, 1);

  const diffs = [];

  candidateObjects.forEach((targetObj, index) => {
    const mutation = randomChoice(MUTATION_TYPES);
    let mutatedColor = targetObj.color;

    // Erase object bounding box area on Canvas B
    ctxB.save();
    ctxB.clearRect(targetObj.x - 2, targetObj.y - 4, targetObj.w + 4, targetObj.h + 8);
    
    // Inpaint / Copy surrounding background patch
    const patch = ctxA.getImageData(Math.max(0, targetObj.x - 4), Math.max(0, targetObj.y - 4), 1, 1).data;
    ctxB.fillStyle = `rgb(${patch[0]}, ${patch[1]}, ${patch[2]})`;
    ctxB.fillRect(targetObj.x - 2, targetObj.y - 4, targetObj.w + 4, targetObj.h + 8);
    ctxB.restore();

    let description = '';

    if (mutation === 'REMOVE_OBJECT') {
      description = `Removed ${targetObj.type.toLowerCase().replace('_', ' ')}`;
    } else if (mutation === 'COLOR_SHIFT') {
      const palette = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#ff007f', '#00f0ff'].filter(c => c !== targetObj.color);
      mutatedColor = randomChoice(palette);
      targetObj.draw(ctxB, mutatedColor, true, 'COLOR_SHIFT');
      description = `Recolored ${targetObj.type.toLowerCase().replace('_', ' ')}`;
    } else {
      targetObj.draw(ctxB, targetObj.color, true, 'ADD_DETAIL');
      description = `Added micro detail on ${targetObj.type.toLowerCase().replace('_', ' ')}`;
    }

    const centerXPercent = Math.round(((targetObj.x + targetObj.w / 2) / width) * 100);
    const centerYPercent = Math.round(((targetObj.y + targetObj.h / 2) / height) * 100);
    const radiusPercent = Math.max(4, Math.round((Math.max(targetObj.w, targetObj.h) / width) * 100 * 1.1));

    diffs.push({
      id: index + 1,
      x: centerXPercent,
      y: centerYPercent,
      radius: radiusPercent,
      mutationType: mutation,
      description,
      hint: `Look closely near (${centerXPercent}%, ${centerYPercent}%)`
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
