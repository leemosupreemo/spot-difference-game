// Procedural Image Pair & Mutation Generation Pipeline Engine
// Implements: Base Image -> Controlled Mutation -> Answer Bounding Box -> Difficulty Rating

export const SCENE_THEMES = [
  { id: 'lego_kingdom', title: 'Lego Micro Kingdom', category: 'Toys & Bricks' },
  { id: 'dense_landscape', title: 'Alpine Meadow & Forest', category: 'Landscape' },
  { id: 'antique_shop', title: 'Magical Antique Shop', category: 'Fantasy' },
  { id: 'cyber_arcade', title: 'Cyberpunk Arcade Alley', category: 'Cyberpunk' },
  { id: 'cat_cafe', title: 'Cozy Cat Cafe', category: 'Cozy' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color (e.g. Red Lego Brick -> Blue Lego Brick)
  'REMOVE_OBJECT',    // Erase a small object and inpaint background
  'FLIP_OBJECT',      // Horizontal/Vertical flip
  'SHIFT_POSITION',   // Translate object by N pixels
  'ADD_DETAIL'        // Add extra stud, star, or stripe on top of object
];

/**
 * Generates an Image Pair (Base vs Modified) with controlled, programmatic mutations.
 * Enforces: Image B is 100% pixel-identical to Image A EXCEPT for controlled target mutations.
 */
export function generateProceduralLevelPair(themeId = 'lego_kingdom', targetDifficulty = 'Medium', seed = Date.now()) {
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

  // Track discrete objects with coordinates & bounding boxes
  const objects = [];

  // -------------------------------------------------------------
  // STEP 1: RENDER RICH DENSE SCENE & REGISTER CANDIDATE OBJECTS
  // -------------------------------------------------------------
  if (themeId === 'lego_kingdom') {
    // Lego Base Plate Grid
    ctxA.fillStyle = '#2b2b36';
    ctxA.fillRect(0, 0, width, height);

    // Green Lego Plate Floor
    ctxA.fillStyle = '#2e7d32';
    ctxA.fillRect(0, height * 0.5, width, height * 0.5);

    // Draw Lego Stud Grid Floor
    ctxA.fillStyle = '#1b5e20';
    for (let gx = 10; gx < width; gx += 20) {
      for (let gy = height * 0.5 + 10; gy < height; gy += 20) {
        ctxA.beginPath();
        ctxA.arc(gx, gy, 4, 0, Math.PI * 2);
        ctxA.fill();
      }
    }

    // Dense Lego Castle / Town Wall Bricks
    const brickColors = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa'];
    const brickW = 32;
    const brickH = 16;

    for (let bx = 40; bx < width - 60; bx += 36) {
      for (let by = 100; by < height * 0.5 - 20; by += 20) {
        const bColor = randomChoice(brickColors);
        const objId = `lego_${bx}_${by}`;

        objects.push({
          id: objId,
          type: 'LEGO_BRICK',
          x: bx,
          y: by,
          w: brickW,
          h: brickH,
          color: bColor,
          draw: (ctx, color, mutated = false, mutationType = '') => {
            // Main Lego Brick
            ctx.fillStyle = color;
            ctx.fillRect(bx, by, brickW, brickH);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, brickW, brickH);

            // Studs on top of Lego Brick
            ctx.fillStyle = color;
            ctx.fillRect(bx + 4, by - 4, 6, 4);
            ctx.fillRect(bx + 20, by - 4, 6, 4);

            // Mutation Add Detail (Extra Stud / Sticker)
            if (mutated && mutationType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(bx + 16, by + 8, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }
    }
  } else if (themeId === 'dense_landscape') {
    // Sky & Mountain Landscape Background
    const skyGrad = ctxA.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#023e8a');
    skyGrad.addColorStop(0.5, '#0077b6');
    skyGrad.addColorStop(1, '#90e0ef');
    ctxA.fillStyle = skyGrad;
    ctxA.fillRect(0, 0, width, height);

    // Mountain Peaks
    ctxA.fillStyle = '#4a5568';
    ctxA.beginPath();
    ctxA.moveTo(0, height * 0.6);
    ctxA.lineTo(width * 0.25, height * 0.2);
    ctxA.lineTo(width * 0.5, height * 0.6);
    ctxA.lineTo(width * 0.75, height * 0.15);
    ctxA.lineTo(width, height * 0.6);
    ctxA.lineTo(width, height);
    ctxA.lineTo(0, height);
    ctxA.fill();

    // Snowcaps
    ctxA.fillStyle = '#ffffff';
    ctxA.beginPath();
    ctxA.moveTo(width * 0.25, height * 0.2);
    ctxA.lineTo(width * 0.2, height * 0.3);
    ctxA.lineTo(width * 0.3, height * 0.3);
    ctxA.fill();

    // Dense Forest Pine Trees
    for (let tx = 30; tx < width - 40; tx += 45) {
      for (let ty = height * 0.55; ty < height - 60; ty += 50) {
        const treeColor = randomChoice(['#1b4332', '#2d6a4f', '#40916c', '#52b788']);
        objects.push({
          id: `tree_${tx}_${ty}`,
          type: 'PINE_TREE',
          x: tx,
          y: ty,
          w: 24,
          h: 40,
          color: treeColor,
          draw: (ctx, color, mutated = false, mutationType = '') => {
            // Trunk
            ctx.fillStyle = '#582f0e';
            ctx.fillRect(tx + 9, ty + 25, 6, 15);

            // Foliage Triangles
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(tx + 12, ty);
            ctx.lineTo(tx, ty + 25);
            ctx.lineTo(tx + 24, ty + 25);
            ctx.fill();

            if (mutated && mutationType === 'ADD_DETAIL') {
              // Star on top of tree
              ctx.fillStyle = '#ffea00';
              ctx.beginPath();
              ctx.arc(tx + 12, ty - 3, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }
    }
  } else {
    // Default Fantasy Antique Shop Fallback
    ctxA.fillStyle = '#12002b';
    ctxA.fillRect(0, 0, width, height);

    for (let x = 60; x < width - 80; x += 100) {
      objects.push({
        id: `antique_${x}`,
        type: 'ANTIQUE',
        x,
        y: 250,
        w: 30,
        h: 40,
        color: '#ffb703',
        draw: (ctx, color) => {
          ctx.fillStyle = color;
          ctx.fillRect(x, 250, 30, 40);
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
  // STEP 3: CONTROLLED MUTATION ON CANVAS B ONLY AT TARGET BOUNDING BOX
  // -------------------------------------------------------------
  const diffCount = targetDifficulty === 'Easy' ? 3 : targetDifficulty === 'Medium' ? 5 : 7;
  const candidateObjects = [...objects].sort(() => random() - 0.5).slice(0, diffCount);

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
      description = `Removed ${targetObj.type.toLowerCase().replace('_', ' ')} at (${Math.round((targetObj.x/width)*100)}%, ${Math.round((targetObj.y/height)*100)}%)`;
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
      hint: `Look closely near (${centerXPercent}%, ${centerYPercent}%) for a ${mutation.toLowerCase().replace('_', ' ')}`
    });
  });

  // Calculate Empirical Area Ratio Metric
  const totalImageArea = width * height;
  const totalDiffArea = candidateObjects.reduce((acc, obj) => acc + (obj.w * obj.h), 0);
  const areaRatio = (totalDiffArea / totalImageArea) * 100;

  return {
    id: `procedural_${themeId}_${seed}`,
    title: `${SCENE_THEMES.find(t => t.id === themeId)?.title || 'Procedural Scene'} #${Math.floor(seed % 1000)}`,
    category: SCENE_THEMES.find(t => t.id === themeId)?.category || 'Procedural',
    difficulty: targetDifficulty,
    difficultyMetric: areaRatio.toFixed(3) + '% area ratio',
    totalDifferences: diffs.length,
    bgGradient: ['#0b091a', '#1e1035'],
    accentColor: '#00f0ff',
    diffs,
    render: (ctx, w, h, isModified) => {
      const sourceCanvas = isModified ? canvasB : canvasA;
      ctx.drawImage(sourceCanvas, 0, 0, w, h);
    }
  };
}
