// Procedural Image Pair & Mutation Generation Pipeline Engine
// Implements: Base Image -> Controlled Mutation -> Answer Bounding Box -> Difficulty Rating

export const SCENE_THEMES = [
  { id: 'antique_shop', title: 'Magical Antique Shop', category: 'Fantasy' },
  { id: 'cyber_arcade', title: 'Cyberpunk Arcade Alley', category: 'Cyberpunk' },
  { id: 'cat_cafe', title: 'Cozy Cat Cafe', category: 'Cozy' },
  { id: 'pirate_deck', title: 'Pirate Captain Ship Deck', category: 'Adventure' },
  { id: 'wizard_lab', title: 'Wizard Alchemy Laboratory', category: 'Magic' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color (e.g., Red Potion -> Blue Potion)
  'REMOVE_OBJECT',    // Erase a small object and inpaint background
  'FLIP_OBJECT',      // Horizontal/Vertical flip
  'SHIFT_POSITION',   // Translate object by N pixels
  'ADD_DETAIL'        // Add extra button, star, or stripe on top of object
];

/**
 * Generates an Image Pair (Base vs Modified) with controlled, programmatic mutations.
 * Returns level object compatible with Diff Hunter game engine.
 */
export function generateProceduralLevelPair(themeId = 'antique_shop', targetDifficulty = 'Medium', seed = Date.now()) {
  const width = 800;
  const height = 600;

  // Create temporary offscreen canvases
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

  const randomRange = (min, max) => min + random() * (max - min);
  const randomChoice = (arr) => arr[Math.floor(random() * arr.length)];

  // Define discrete objects with bounding boxes
  const objects = [];

  // -------------------------------------------------------------
  // STEP 1: RENDER BASE SCENE & TRACK DISCRETE OBJECTS
  // -------------------------------------------------------------
  if (themeId === 'antique_shop' || themeId === 'wizard_lab') {
    // Background Wall & Shelves
    const wallGrad = ctxA.createLinearGradient(0, 0, 0, height);
    wallGrad.addColorStop(0, '#12002b');
    wallGrad.addColorStop(1, '#2d0854');
    ctxA.fillStyle = wallGrad;
    ctxA.fillRect(0, 0, width, height);

    // Draw Shelves
    ctxA.fillStyle = '#4a2810';
    ctxA.fillRect(0, 180, width, 14);
    ctxA.fillRect(0, 380, width, 14);

    // Discrete Objects Generator on Shelves
    // 1. Potion Bottles
    for (let x = 40; x < width - 60; x += 90) {
      const pWidth = 24;
      const pHeight = 36;
      const py = (x % 180 === 0 ? 180 : 380) - pHeight;
      const pColor = randomChoice(['#ff0055', '#00f0ff', '#ffea00', '#00ff87', '#9d4edd']);
      
      objects.push({
        id: `potion_${x}`,
        type: 'POTION',
        x,
        y: py,
        w: pWidth,
        h: pHeight,
        color: pColor,
        draw: (ctx, color, mutated = false, mutationType = '') => {
          ctx.fillStyle = '#e0e0e0';
          ctx.fillRect(x + 8, py - 6, 8, 6); // Cork

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(x + 12, py + 22, 12, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillRect(x + 7, py + 4, 10, 14);

          // Extra detail if mutated
          if (mutated && mutationType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x + 12, py + 22, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }

    // 2. Spellbooks & Scrolls
    for (let x = 80; x < width - 100; x += 130) {
      const bWidth = 22;
      const bHeight = 44;
      const by = 180 - bHeight;
      const bColor = randomChoice(['#8b0000', '#1b4332', '#212529', '#ffb703']);

      objects.push({
        id: `book_${x}`,
        type: 'BOOK',
        x,
        y: by,
        w: bWidth,
        h: bHeight,
        color: bColor,
        draw: (ctx, color, mutated = false, mutationType = '') => {
          ctx.fillStyle = color;
          ctx.fillRect(x, by, bWidth, bHeight);

          ctx.fillStyle = '#ffea00';
          ctx.fillRect(x + 4, by + 10, bWidth - 8, 4);
          ctx.fillRect(x + 4, by + 24, bWidth - 8, 4);

          if (mutated && mutationType === 'ADD_DETAIL') {
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(x + 8, by + 15, 6, 6);
          }
        }
      });
    }

    // 3. Hanging Candles & Stars
    for (let x = 100; x < width - 100; x += 150) {
      const cy = 40;
      objects.push({
        id: `candle_${x}`,
        type: 'CANDLE',
        x,
        y: cy,
        w: 20,
        h: 50,
        color: '#ffea00',
        draw: (ctx, color, mutated = false, mutationType = '') => {
          ctx.strokeStyle = '#888';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 10, 0);
          ctx.lineTo(x + 10, cy);
          ctx.stroke();

          ctx.fillStyle = '#fff';
          ctx.fillRect(x + 4, cy, 12, 30);

          // Flame
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(x + 10, cy - 6, 6, 9, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  } else {
    // Cyberpunk / Cafe / Deck Default Base Scene
    ctxA.fillStyle = '#0b091a';
    ctxA.fillRect(0, 0, width, height);

    // Grid Lines
    ctxA.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    for (let i = 0; i < width; i += 40) {
      ctxA.beginPath(); ctxA.moveTo(i, 0); ctxA.lineTo(i, height); ctxA.stroke();
    }
    for (let i = 0; i < height; i += 40) {
      ctxA.beginPath(); ctxA.moveTo(0, i); ctxA.lineTo(width, i); ctxA.stroke();
    }

    // Discrete Arcade Cabinets / Vending Items
    for (let x = 60; x < width - 80; x += 120) {
      const cColor = randomChoice(['#ff007f', '#00f0ff', '#ffea00', '#00ff87']);
      objects.push({
        id: `arcade_${x}`,
        type: 'ARCADE',
        x,
        y: 200,
        w: 50,
        h: 120,
        color: cColor,
        draw: (ctx, color, mutated = false, mutationType = '') => {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(x, 200, 50, 120);

          // Screen
          ctx.fillStyle = color;
          ctx.fillRect(x + 6, 210, 38, 40);

          // Controls
          ctx.fillStyle = '#ff0055';
          ctx.beginPath();
          ctx.arc(x + 16, 265, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#00f0ff';
          ctx.fillRect(x + 28, 262, 10, 6);
        }
      });
    }
  }

  // Draw Base Scene A
  objects.forEach(obj => obj.draw(ctxA, obj.color, false, ''));

  // Copy Canvas A to Canvas B
  ctxB.drawImage(canvasA, 0, 0);

  // -------------------------------------------------------------
  // STEP 2: SELECT CANDIDATE OBJECTS & APPLY CONTROLLED MUTATIONS
  // -------------------------------------------------------------
  const diffCount = targetDifficulty === 'Easy' ? 3 : targetDifficulty === 'Medium' ? 5 : 7;
  const candidateObjects = [...objects].sort(() => random() - 0.5).slice(0, diffCount);

  const diffs = [];

  candidateObjects.forEach((targetObj, index) => {
    const mutation = randomChoice(MUTATION_TYPES);
    let mutatedColor = targetObj.color;
    let mutatedX = targetObj.x;
    let mutatedY = targetObj.y;

    // Erase object region on Canvas B (inpaint background)
    ctxB.save();
    ctxB.clearRect(targetObj.x - 4, targetObj.y - 8, targetObj.w + 8, targetObj.h + 16);
    // Fill in background patch
    const patch = ctxA.getImageData(targetObj.x - 4, targetObj.y - 8, 1, 1).data;
    ctxB.fillStyle = `rgb(${patch[0]}, ${patch[1]}, ${patch[2]})`;
    ctxB.fillRect(targetObj.x - 4, targetObj.y - 8, targetObj.w + 8, targetObj.h + 16);
    ctxB.restore();

    let description = '';

    if (mutation === 'REMOVE_OBJECT') {
      description = `Removed ${targetObj.type.toLowerCase()} at (${Math.round((targetObj.x/width)*100)}%, ${Math.round((targetObj.y/height)*100)}%)`;
      // Don't re-draw object on Canvas B
    } else if (mutation === 'COLOR_SHIFT') {
      const palette = ['#ff0055', '#00f0ff', '#ffea00', '#00ff87', '#9d4edd', '#ffffff'].filter(c => c !== targetObj.color);
      mutatedColor = randomChoice(palette);
      targetObj.draw(ctxB, mutatedColor, true, 'COLOR_SHIFT');
      description = `Changed ${targetObj.type.toLowerCase()} color from ${targetObj.color} to ${mutatedColor}`;
    } else if (mutation === 'SHIFT_POSITION') {
      mutatedX = targetObj.x + Math.round(randomRange(8, 15));
      const movedObj = { ...targetObj, x: mutatedX };
      movedObj.draw(ctxB, targetObj.color, true, 'SHIFT_POSITION');
      description = `Shifted ${targetObj.type.toLowerCase()} position rightwards`;
    } else {
      // ADD_DETAIL or FLIP
      targetObj.draw(ctxB, targetObj.color, true, 'ADD_DETAIL');
      description = `Added subtle detail highlight on ${targetObj.type.toLowerCase()}`;
    }

    // Calculate answer bounding box & normalized percentage coordinate
    const centerXPercent = Math.round(((targetObj.x + targetObj.w / 2) / width) * 100);
    const centerYPercent = Math.round(((targetObj.y + targetObj.h / 2) / height) * 100);
    const radiusPercent = Math.round((Math.max(targetObj.w, targetObj.h) / width) * 100 * 1.2);

    diffs.push({
      id: index + 1,
      x: centerXPercent,
      y: centerYPercent,
      radius: Math.max(5, radiusPercent),
      mutationType: mutation,
      description,
      hint: `Look closely near (${centerXPercent}%, ${centerYPercent}%) for a ${mutation.toLowerCase().replace('_', ' ')}`
    });
  });

  // -------------------------------------------------------------
  // STEP 3: DIFFICULTY CALCULATION (diff_area / total_image_area)
  // -------------------------------------------------------------
  const totalImageArea = width * height;
  const totalDiffArea = candidateObjects.reduce((acc, obj) => acc + (obj.w * obj.h), 0);
  const areaRatio = totalDiffArea / totalImageArea;

  let computedDifficulty = 'Medium';
  if (areaRatio > 0.015) computedDifficulty = 'Easy';
  else if (areaRatio < 0.005) computedDifficulty = 'Hard';

  // Return level package
  return {
    id: `procedural_${themeId}_${seed}`,
    title: `${SCENE_THEMES.find(t => t.id === themeId)?.title || 'Procedural Pair'} #${Math.floor(seed % 1000)}`,
    category: SCENE_THEMES.find(t => t.id === themeId)?.category || 'Procedural',
    difficulty: targetDifficulty || computedDifficulty,
    difficultyMetric: (areaRatio * 100).toFixed(3) + '%',
    totalDifferences: diffs.length,
    bgGradient: ['#0b091a', '#1e1035'],
    accentColor: '#00f0ff',
    diffs,
    // Custom Canvas Render Function for Level Engine
    render: (ctx, w, h, isModified) => {
      const sourceCanvas = isModified ? canvasB : canvasA;
      ctx.drawImage(sourceCanvas, 0, 0, w, h);
    }
  };
}
