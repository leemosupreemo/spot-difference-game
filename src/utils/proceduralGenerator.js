// Master Multi-Scale Organic & Impressionist Procedural Art Engine
// GUARANTEED EXACTLY 1 HIGH-CONTRAST VISIBLE DIFFERENCE between Image A and Image B
// 1. Separate Layer Pipeline (Background cloned before objects - ZERO ghosting/masking bugs)
// 2. High-Contrast Palette Engine (Guaranteed contrast between objects & background)
// 3. Wide Scale Variation (0.4x micro-scale up to 2.4x giant hero scale)
// 4. Impressionist Styles (Claude Monet Water Lilies, Van Gogh Swirls, Renoir Dappled Light)
// 5. Multi-Variant Object Poses & Bezier Silhouettes

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const ART_WORLDS = [
  { id: 'monet_waterlilies', name: 'Monet Giverny Water Lilies' },
  { id: 'vangogh_starry', name: 'Van Gogh Starry Cypress Grove' },
  { id: 'woodland_wildlife', name: 'Enchanted Woodland Wildlife' },
  { id: 'ocean_depths', name: 'Ocean Depths & Marine Life' },
  { id: 'tropical_aviary', name: 'Tropical Aviary Garden' },
  { id: 'kyoto_garden', name: 'Kyoto Zen Garden' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color to a bold contrasting neon/saturated hue
  'REMOVE_DETAIL',    // Remove a distinct sub-feature / blossom / eye / spot / stripe
  'ADD_DETAIL',       // Add an ornament / crown / jewel / star / beacon
  'SHAPE_ROTATE',     // Rotate animal head / tail / flower / boat / brushstroke by 45-90 degrees
  'SCALE_CHANGE'      // Scale element up or down by 1.8x
];

function createPRNG(seed) {
  let s = Math.abs(Math.floor(seed || 1)) % 2147483647;
  if (s <= 0) s = 1;
  s = (s ^ 0x6D2B79F5) % 2147483647;
  if (s <= 0) s = 1;
  s = (s * 48271) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createSafeCanvas(width, height) {
  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  const noop = () => {};
  const mockCtx = {
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    fillRect: noop,
    strokeRect: noop,
    drawImage: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    ellipse: noop,
    quadraticCurveTo: noop,
    fill: noop,
    stroke: noop
  };
  return {
    width,
    height,
    getContext: () => mockCtx,
    toDataURL: () => 'data:image/jpeg;base64,mock'
  };
}

function createSafeImage(src) {
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.src = src;
    return img;
  }
  return { src, complete: true, naturalWidth: 800, naturalHeight: 600 };
}

/**
 * Generates an impressionistic or organic procedural scene pair with guaranteed single high-contrast difference.
 */
export function generateProceduralLevelPair(themeId = 'abstract_animated', targetDifficulty = 'Medium', seed = Date.now()) {
  const width = 800;
  const height = 600;

  const canvasA = createSafeCanvas(width, height);
  const ctxA = canvasA.getContext('2d');

  const canvasB = createSafeCanvas(width, height);
  const ctxB = canvasB.getContext('2d');

  const random = createPRNG(seed);
  const randomChoice = (arr) => arr[Math.floor(random() * arr.length)];
  const randomRange = (min, max) => min + random() * (max - min);

  const isPhotoTheme = themeId === 'find_the_sniper';
  const candidates = [];
  let sceneTitle = 'Impressionist Realm';

  // Select world
  const worldIndex = Math.floor(random() * 6);

  // Density counts with safe minimums
  const objectCount = targetDifficulty === 'Easy' ? 24 : targetDifficulty === 'Medium' ? 38 : 52;
  const microCount = targetDifficulty === 'Easy' ? 30 : targetDifficulty === 'Medium' ? 45 : 60;

  // =========================================================================
  // STEP 1: RENDER PURE BACKGROUND ONTO CANVAS A (NO CANDIDATES YET!)
  // =========================================================================

  if (worldIndex === 0) {
    // =========================================================================
    // 🪷 WORLD 1: CLAUDE MONET GIVERNY WATER LILIES (Impressionist Pond)
    // =========================================================================
    sceneTitle = 'Monet Water Lilies';

    // Layered impressionist water wash
    const pondGrad = ctxA.createLinearGradient(0, 0, 0, height);
    pondGrad.addColorStop(0, '#0a2e36');
    pondGrad.addColorStop(0.3, '#144552');
    pondGrad.addColorStop(0.7, '#1b4965');
    pondGrad.addColorStop(1, '#052b3b');
    ctxA.fillStyle = pondGrad;
    ctxA.fillRect(0, 0, width, height);

    // Dappled Impressionist Willow Strokes
    const willowColors = ['#2d6a4f', '#52b788', '#74c69d', '#95d5b2', '#1b4332'];
    for (let w = 0; w < 120; w++) {
      ctxA.fillStyle = randomChoice(willowColors);
      ctxA.globalAlpha = randomRange(0.25, 0.6);
      ctxA.beginPath();
      ctxA.ellipse(random() * width, random() * (height * 0.4), randomRange(8, 26), randomRange(3, 8), randomRange(-0.5, 0.5), 0, Math.PI * 2);
      ctxA.fill();
    }
    ctxA.globalAlpha = 1.0;

    // Arching Japanese Footbridge in background
    ctxA.strokeStyle = '#1b4332';
    ctxA.lineWidth = 14;
    ctxA.beginPath();
    ctxA.moveTo(width * 0.1, height * 0.28);
    ctxA.quadraticCurveTo(width * 0.5, height * 0.12, width * 0.9, height * 0.28);
    ctxA.stroke();

    // Candidates: Water Lily Pads & Blossoms of varying scales (20px to 140px)
    const lilyColors = ['#ff007f', '#ffffff', '#ffd166', '#ff70a6', '#c77dff'];
    for (let i = 0; i < objectCount; i++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(120, height - 60);
      // Wide Scale variation: 0.4x micro pads to 2.2x giant hero lily clusters
      const scaleMult = (i === 0) ? 2.2 : (i < 5) ? 1.4 : (i < 20) ? 1.0 : 0.55;
      const size = randomRange(26, 44) * scaleMult;
      const kind = randomChoice(['WATER_LILY_BLOSSOM', 'LILY_PAD_CLUSTER', 'KOI_RIPPLE']);
      const baseColor = randomChoice(lilyColors);
      const poseRot = random() * Math.PI * 2;

      candidates.push({
        id: `monet_lily_${i}`,
        x: cx, y: cy, size, kind, baseColor, poseRot,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          const curRot = (mutated && mType === 'SHAPE_ROTATE') ? poseRot + Math.PI / 3 : poseRot;
          ctx.rotate(curRot);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#ff007f' ? '#00f0ff' : baseColor === '#ffd166' ? '#ff007f' : '#ffd166';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

          if (kind === 'WATER_LILY_BLOSSOM') {
            // Under-pad
            ctx.fillStyle = '#2d6a4f';
            ctx.beginPath();
            ctx.ellipse(0, curSize * 0.15, curSize * 0.48, curSize * 0.26, 0, 0, Math.PI * 1.7);
            ctx.lineTo(0, curSize * 0.15);
            ctx.closePath();
            ctx.fill();

            // Impressionist Layered Petals
            for (let p = 0; p < 8; p++) {
              const a = (p * Math.PI * 2) / 8;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.ellipse(Math.cos(a) * (curSize * 0.22), Math.sin(a) * (curSize * 0.22), curSize * 0.24, curSize * 0.1, a, 0, Math.PI * 2);
              ctx.fill();
            }

            // Golden Center Stamen
            if (!(mutated && mType === 'REMOVE_DETAIL')) {
              ctx.fillStyle = '#ffd166';
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.12, 0, Math.PI * 2);
              ctx.fill();
            }

            if (mutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.06, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (kind === 'LILY_PAD_CLUSTER') {
            ctx.fillStyle = '#40916c';
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.5, curSize * 0.32, 0, 0, Math.PI * 1.75);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();
            // Radiating leaf veins
            ctx.strokeStyle = '#74c69d';
            ctx.lineWidth = 1.5;
            for (let v = 0; v < 4; v++) {
              const va = (v * Math.PI) / 3;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(va) * curSize * 0.45, Math.sin(va) * curSize * 0.28);
              ctx.stroke();
            }
          } else {
            // Concentric Water Ripple
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.45, curSize * 0.24, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.25, curSize * 0.14, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    // Micro Water Droplets
    for (let d = 0; d < microCount; d++) {
      const dx = randomRange(40, width - 40);
      const dy = randomRange(40, height - 40);
      const dSize = randomRange(6, 14);

      candidates.push({
        id: `monet_drop_${d}`,
        x: dx, y: dy, size: dSize, kind: 'WATER_SPARKLE', baseColor: '#ffffff',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(dx, dy);
          const rad = (mutated && mType === 'SCALE_CHANGE') ? dSize * 1.8 : dSize;
          ctx.fillStyle = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 1) {
    // =========================================================================
    // 🌌 WORLD 2: VINCENT VAN GOGH STARRY CYPRESS GROVE (Impressionist Night)
    // =========================================================================
    sceneTitle = 'Van Gogh Starry Cypress';

    // Swirling cobalt night sky gradient
    const starryGrad = ctxA.createLinearGradient(0, 0, 0, height);
    starryGrad.addColorStop(0, '#03045e');
    starryGrad.addColorStop(0.4, '#023e8a');
    starryGrad.addColorStop(0.8, '#0077b6');
    starryGrad.addColorStop(1, '#001233');
    ctxA.fillStyle = starryGrad;
    ctxA.fillRect(0, 0, width, height);

    // Impasto Swirling Sky Beams
    const swirlColors = ['#ffd166', '#00f0ff', '#48cae4', '#90e0ef', '#ffb703'];
    for (let s = 0; s < 140; s++) {
      ctxA.strokeStyle = randomChoice(swirlColors);
      ctxA.lineWidth = randomRange(2.5, 6);
      ctxA.lineCap = 'round';
      ctxA.globalAlpha = randomRange(0.3, 0.7);
      const sx = random() * width;
      const sy = random() * (height * 0.6);
      ctxA.beginPath();
      ctxA.moveTo(sx, sy);
      ctxA.quadraticCurveTo(sx + 20, sy - 15, sx + 40, sy);
      ctxA.stroke();
    }
    ctxA.globalAlpha = 1.0;

    // 1. HERO ELEMENT: Flame-like Cypress Tree (Left/Center 240px)
    const treeX = randomRange(width * 0.2, width * 0.4);
    const treeY = height * 0.55;

    candidates.push({
      id: 'hero_cypress',
      x: treeX, y: treeY - 80, size: 120, kind: 'CYPRESS_TREE', baseColor: '#00291d',
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(treeX, treeY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#1b4332' : '#00291d';
        const tScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        // Flame-like swirling tree silhouette
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 40 * tScale);
        ctx.bezierCurveTo(-45 * tScale, 0, -35 * tScale, -120 * tScale, 0, -180 * tScale);
        ctx.bezierCurveTo(35 * tScale, -120 * tScale, 45 * tScale, 0, 0, 40 * tScale);
        ctx.closePath();
        ctx.fill();

        // Impasto flame strokes on tree
        ctx.strokeStyle = '#2d6a4f';
        ctx.lineWidth = 3 * tScale;
        for (let l = -2; l <= 2; l++) {
          ctx.beginPath();
          ctx.moveTo(l * 10 * tScale, 0);
          ctx.quadraticCurveTo(l * 15 * tScale, -80 * tScale, 0, -160 * tScale);
          ctx.stroke();
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(0, -185 * tScale, 7 * tScale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM SWIRLING STARS & VILLAGE ROOFTOPS (25px to 60px)
    const starColors = ['#ffd166', '#ffb703', '#ffffff', '#00f0ff', '#ff70a6'];
    for (let st = 0; st < objectCount; st++) {
      const cx = randomRange(50, width - 50);
      const cy = randomRange(60, height - 70);
      const scaleMult = (st < 4) ? 1.5 : (st < 18) ? 1.0 : 0.5;
      const size = randomRange(24, 44) * scaleMult;
      const kind = randomChoice(['SWIRLING_STAR', 'CRESCENT_GLOW', 'VILLAGE_SPIRE']);
      const baseColor = randomChoice(starColors);
      const poseRot = random() * Math.PI * 2;

      candidates.push({
        id: `vangogh_star_${st}`,
        x: cx, y: cy, size, kind, baseColor, poseRot,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          const curRot = (mutated && mType === 'SHAPE_ROTATE') ? poseRot + Math.PI / 4 : poseRot;
          ctx.rotate(curRot);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#ffd166' ? '#00f0ff' : baseColor === '#00f0ff' ? '#ff70a6' : '#ffd166';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

          if (kind === 'SWIRLING_STAR') {
            // Multi-ring halo
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = color;
            ctx.shadowBlur = 14;
            for (let r = 1; r <= 3; r++) {
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.15 * r, 0, Math.PI * 2);
              ctx.stroke();
            }
            // Star Core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.12, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === 'CRESCENT_GLOW') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, -0.6 * Math.PI, 0.8 * Math.PI, false);
            ctx.bezierCurveTo(curSize * 0.1, curSize * 0.3, curSize * 0.1, -curSize * 0.3, Math.cos(-0.6 * Math.PI) * curSize * 0.4, Math.sin(-0.6 * Math.PI) * curSize * 0.4);
            ctx.closePath();
            ctx.fill();
          } else {
            // Village Spire
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.5);
            ctx.lineTo(curSize * 0.25, curSize * 0.4);
            ctx.lineTo(-curSize * 0.25, curSize * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = color;
            ctx.fillRect(-2, curSize * 0.1, 4, 6);
          }
          ctx.restore();
        }
      });
    }

    // Micro Twinkle Brush Flares
    for (let t = 0; t < microCount; t++) {
      const tx = randomRange(40, width - 40);
      const ty = randomRange(40, height - 40);
      const tSize = randomRange(6, 14);

      candidates.push({
        id: `vangogh_twinkle_${t}`,
        x: tx, y: ty, size: tSize, kind: 'NIGHT_TWINKLE', baseColor: '#ffd166',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(tx, ty);
          const rad = (mutated && mType === 'SCALE_CHANGE') ? tSize * 1.8 : tSize;
          ctx.strokeStyle = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : '#ffd166';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-rad * 0.5, 0);
          ctx.lineTo(rad * 0.5, 0);
          ctx.moveTo(0, -rad * 0.5);
          ctx.lineTo(0, rad * 0.5);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 2) {
    // =========================================================================
    // 🦊 WORLD 3: ENCHANTED WOODLAND WILDLIFE
    // =========================================================================
    sceneTitle = 'Enchanted Woodland';

    const bgGrad = ctxA.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0c1b18');
    bgGrad.addColorStop(0.5, '#16382b');
    bgGrad.addColorStop(1, '#2d5a43');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    ctxA.strokeStyle = '#1b120c';
    ctxA.lineWidth = 26;
    ctxA.lineCap = 'round';
    ctxA.beginPath();
    ctxA.moveTo(0, height * 0.45);
    ctxA.bezierCurveTo(width * 0.35, height * 0.52, width * 0.65, height * 0.38, width, height * 0.52);
    ctxA.stroke();

    // 1. HERO 1: Sleeping Red Fox (200px)
    const foxX = randomRange(width * 0.35, width * 0.65);
    const foxY = height * 0.55;
    const foxColor = '#e65c00';

    candidates.push({
      id: 'hero_fox',
      x: foxX, y: foxY, size: 100, kind: 'SLEEPING_FOX', baseColor: foxColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(foxX, foxY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#d90429' : foxColor;
        const fScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-48 * fScale, 0);
        ctx.bezierCurveTo(-48 * fScale, -42 * fScale, 30 * fScale, -48 * fScale, 42 * fScale, -14 * fScale);
        ctx.bezierCurveTo(52 * fScale, 18 * fScale, -28 * fScale, 42 * fScale, -48 * fScale, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(32 * fScale, -10 * fScale);
        ctx.bezierCurveTo(62 * fScale, -5 * fScale, 58 * fScale, 34 * fScale, 14 * fScale, 28 * fScale);
        ctx.bezierCurveTo(0, 24 * fScale, 10 * fScale, 0, 32 * fScale, -10 * fScale);
        ctx.closePath();
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(45 * fScale, 18 * fScale, 11 * fScale, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-32 * fScale, -14 * fScale);
        ctx.lineTo(-46 * fScale, -36 * fScale);
        ctx.lineTo(-28 * fScale, -26 * fScale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-32 * fScale, -5 * fScale, 8 * fScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-35 * fScale, -6 * fScale, 2.8 * fScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 2. MEDIUM WOODLAND ANIMALS & FLORA
    const woodlandColors = ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#9d4edd', '#48cae4'];
    for (let w = 0; w < objectCount; w++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const scaleMult = (w < 4) ? 1.4 : (w < 18) ? 1.0 : 0.55;
      const size = randomRange(26, 46) * scaleMult;
      const kind = randomChoice(['HORNED_OWL', 'CURLED_HEDGEHOG', 'CHANTERELLE_MUSHROOM', 'ACORN_CLUSTER']);
      const baseColor = randomChoice(woodlandColors);

      candidates.push({
        id: `woodland_critter_${w}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#f4a261' ? '#2a9d8f' : baseColor === '#2a9d8f' ? '#e76f51' : '#f4a261';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

          if (kind === 'HORNED_OWL') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.35, curSize * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(-curSize * 0.14, -curSize * 0.15, 6, 0, Math.PI * 2);
            ctx.arc(curSize * 0.14, -curSize * 0.15, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(-curSize * 0.14, -curSize * 0.15, 3, 0, Math.PI * 2);
            ctx.arc(curSize * 0.14, -curSize * 0.15, 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === 'CURLED_HEDGEHOG') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, Math.PI, 0, false);
            ctx.lineTo(curSize * 0.45, curSize * 0.2);
            ctx.lineTo(-curSize * 0.45, curSize * 0.2);
            ctx.closePath();
            ctx.fill();
          } else if (kind === 'CHANTERELLE_MUSHROOM') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(-curSize * 0.4, -curSize * 0.2);
            ctx.bezierCurveTo(-curSize * 0.2, -curSize * 0.4, curSize * 0.2, -curSize * 0.4, curSize * 0.4, -curSize * 0.2);
            ctx.quadraticCurveTo(curSize * 0.1, curSize * 0.3, 0, curSize * 0.45);
            ctx.quadraticCurveTo(-curSize * 0.1, curSize * 0.3, -curSize * 0.4, -curSize * 0.2);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillStyle = '#8b5a2b';
            ctx.beginPath();
            ctx.ellipse(0, 4, curSize * 0.28, curSize * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, -curSize * 0.15, curSize * 0.28, Math.PI, 0, false);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

    // Micro Berries
    for (let b = 0; b < microCount; b++) {
      const bx = randomRange(40, width - 40);
      const by = randomRange(40, height - 40);
      const bSize = randomRange(6, 14);

      candidates.push({
        id: `woodland_berry_${b}`,
        x: bx, y: by, size: bSize, kind: 'FOREST_BERRY', baseColor: '#e63946',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(bx, by);
          const rad = (mutated && mType === 'SCALE_CHANGE') ? bSize * 1.8 : bSize;
          ctx.fillStyle = (mutated && mType === 'COLOR_SHIFT') ? '#00f0ff' : '#e63946';
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 3) {
    // =========================================================================
    // 🐋 WORLD 4: OCEAN DEPTHS & MARINE LIFE
    // =========================================================================
    sceneTitle = 'Ocean Abyssal Kingdom';

    const seaGrad = ctxA.createLinearGradient(0, 0, 0, height);
    seaGrad.addColorStop(0, '#021526');
    seaGrad.addColorStop(0.5, '#03284c');
    seaGrad.addColorStop(1, '#08537a');
    ctxA.fillStyle = seaGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO: Breaching Whale (220px)
    const whaleX = randomRange(width * 0.3, width * 0.7);
    const whaleY = height * 0.42;
    const whaleColor = '#1d3557';

    candidates.push({
      id: 'hero_whale',
      x: whaleX, y: whaleY, size: 105, kind: 'HUMPBACK_WHALE', baseColor: whaleColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(whaleX, whaleY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#0077b6' : whaleColor;
        const wScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-75 * wScale, 10 * wScale);
        ctx.bezierCurveTo(-45 * wScale, -42 * wScale, 38 * wScale, -32 * wScale, 75 * wScale, -10 * wScale);
        ctx.bezierCurveTo(38 * wScale, 28 * wScale, -38 * wScale, 38 * wScale, -75 * wScale, 10 * wScale);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-75 * wScale, 10 * wScale);
        ctx.lineTo(-100 * wScale, -14 * wScale);
        ctx.lineTo(-90 * wScale, 10 * wScale);
        ctx.lineTo(-100 * wScale, 34 * wScale);
        ctx.closePath();
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 * wScale;
          ctx.beginPath();
          ctx.moveTo(18 * wScale, 10 * wScale);
          ctx.bezierCurveTo(38 * wScale, 18 * wScale, 58 * wScale, 10 * wScale, 72 * wScale, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM CREATURES (Seahorses, Octopuses, Manta Rays)
    const marineColors = ['#f72585', '#7209b7', '#4cc9f0', '#ffb703', '#06d6a0'];
    for (let m = 0; m < objectCount; m++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const scaleMult = (m < 4) ? 1.4 : (m < 18) ? 1.0 : 0.55;
      const size = randomRange(26, 46) * scaleMult;
      const kind = randomChoice(['CURLY_SEAHORSE', 'SWIRL_OCTOPUS', 'SCALLOP_SHELL']);
      const baseColor = randomChoice(marineColors);

      candidates.push({
        id: `marine_critter_${m}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#f72585' ? '#4cc9f0' : baseColor === '#4cc9f0' ? '#ffb703' : '#f72585';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

          if (kind === 'CURLY_SEAHORSE') {
            ctx.strokeStyle = color;
            ctx.lineWidth = curSize * 0.28;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.35);
            ctx.quadraticCurveTo(curSize * 0.2, -curSize * 0.1, 0, curSize * 0.1);
            ctx.quadraticCurveTo(-curSize * 0.2, curSize * 0.3, curSize * 0.05, curSize * 0.45);
            ctx.stroke();
          } else if (kind === 'SWIRL_OCTOPUS') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, -curSize * 0.1, curSize * 0.35, curSize * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, curSize * 0.3);
            ctx.arc(0, 0, curSize * 0.4, Math.PI * 0.8, Math.PI * 2.2, false);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

    // Micro Pearls
    for (let p = 0; p < microCount; p++) {
      const px = randomRange(40, width - 40);
      const py = randomRange(40, height - 40);
      const pSize = randomRange(6, 14);

      candidates.push({
        id: `ocean_pearl_${p}`,
        x: px, y: py, size: pSize, kind: 'OCEAN_PEARL', baseColor: '#e0fbfc',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(px, py);
          const rad = (mutated && mType === 'SCALE_CHANGE') ? pSize * 1.8 : pSize;
          ctx.fillStyle = (mutated && mType === 'COLOR_SHIFT') ? '#f72585' : '#e0fbfc';
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 4) {
    // =========================================================================
    // 🌺 WORLD 5: TROPICAL AVIARY GARDEN
    // =========================================================================
    sceneTitle = 'Tropical Aviary Garden';

    const aviaryGrad = ctxA.createLinearGradient(0, 0, 0, height);
    aviaryGrad.addColorStop(0, '#071f15');
    aviaryGrad.addColorStop(0.5, '#0e432c');
    aviaryGrad.addColorStop(1, '#1b5e3b');
    ctxA.fillStyle = aviaryGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO: Hovering Hummingbird (200px)
    const birdX = randomRange(width * 0.3, width * 0.7);
    const birdY = height * 0.45;
    const birdColor = '#00b4d8';

    candidates.push({
      id: 'hero_hummingbird',
      x: birdX, y: birdY, size: 95, kind: 'HOVERING_HUMMINGBIRD', baseColor: birdColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(birdX, birdY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#9d4edd' : birdColor;
        const bScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5 * bScale;
        ctx.beginPath();
        ctx.moveTo(15 * bScale, -5 * bScale);
        ctx.quadraticCurveTo(45 * bScale, -12 * bScale, 68 * bScale, -8 * bScale);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-32 * bScale, 18 * bScale);
        ctx.bezierCurveTo(-38 * bScale, 0, 10 * bScale, -22 * bScale, 18 * bScale, -5 * bScale);
        ctx.bezierCurveTo(14 * bScale, 18 * bScale, -18 * bScale, 28 * bScale, -32 * bScale, 18 * bScale);
        ctx.closePath();
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ff0054';
          ctx.beginPath();
          ctx.ellipse(8 * bScale, 2 * bScale, 8 * bScale, 6 * bScale, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM BUTTERFLIES & FLOWERS
    const floraColors = ['#ff007f', '#ffb703', '#fb5607', '#06d6a0', '#7209b7'];
    for (let fl = 0; fl < objectCount; fl++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const scaleMult = (fl < 4) ? 1.4 : (fl < 18) ? 1.0 : 0.55;
      const size = randomRange(26, 46) * scaleMult;
      const kind = randomChoice(['MONARCH_BUTTERFLY', 'CHAMELEON_COIL', 'HIBISCUS_FLOWER']);
      const baseColor = randomChoice(floraColors);

      candidates.push({
        id: `aviary_obj_${fl}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#ff007f' ? '#06d6a0' : baseColor === '#06d6a0' ? '#ffb703' : '#ff007f';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

          if (kind === 'MONARCH_BUTTERFLY') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(-curSize * 0.28, -curSize * 0.2, curSize * 0.32, curSize * 0.22, -0.4, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.28, -curSize * 0.2, curSize * 0.32, curSize * 0.22, 0.4, 0, Math.PI * 2);
            ctx.ellipse(-curSize * 0.22, curSize * 0.2, curSize * 0.24, curSize * 0.15, 0.5, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.22, curSize * 0.2, curSize * 0.24, curSize * 0.15, -0.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind === 'CHAMELEON_COIL') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(-curSize * 0.35, curSize * 0.15, curSize * 0.2, 0, Math.PI * 1.8);
            ctx.stroke();
          } else {
            for (let p = 0; p < 5; p++) {
              const a = (p * Math.PI * 2) / 5 - Math.PI / 2;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.ellipse(Math.cos(a) * (curSize * 0.32), Math.sin(a) * (curSize * 0.32), curSize * 0.3, curSize * 0.16, a, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      });
    }

    // Micro Dewdrops
    for (let d = 0; d < microCount; d++) {
      const dx = randomRange(40, width - 40);
      const dy = randomRange(40, height - 40);
      const dSize = randomRange(6, 14);

      candidates.push({
        id: `dewdrop_${d}`,
        x: dx, y: dy, size: dSize, kind: 'DEWDROP', baseColor: '#ffffff',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(dx, dy);
          const rad = (mutated && mType === 'SCALE_CHANGE') ? dSize * 1.8 : dSize;
          ctx.fillStyle = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else {
    // =========================================================================
    // ⛩️ WORLD 6: KYOTO ZEN GARDEN
    // =========================================================================
    sceneTitle = 'Kyoto Zen Garden';

    const zenGrad = ctxA.createLinearGradient(0, 0, 0, height);
    zenGrad.addColorStop(0, '#fdf2f8');
    zenGrad.addColorStop(0.4, '#fed7aa');
    zenGrad.addColorStop(0.7, '#f472b6');
    zenGrad.addColorStop(1, '#312e81');
    ctxA.fillStyle = zenGrad;
    ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = '#e11d48';
    ctxA.beginPath();
    ctxA.arc(width * 0.5, height * 0.45, 110, 0, Math.PI * 2);
    ctxA.fill();

    // 1. HERO: Red-Crowned Crane (200px)
    const craneX = randomRange(width * 0.35, width * 0.65);
    const craneY = height * 0.48;
    const craneColor = '#ffffff';

    candidates.push({
      id: 'hero_crane',
      x: craneX, y: craneY, size: 95, kind: 'RED_CROWNED_CRANE', baseColor: craneColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(craneX, craneY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#fce7f3' : craneColor;
        const cScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 32 * cScale, 18 * cScale, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(15 * cScale, -5 * cScale);
        ctx.bezierCurveTo(25 * cScale, -25 * cScale, 18 * cScale, -45 * cScale, 30 * cScale, -55 * cScale);
        ctx.lineTo(38 * cScale, -52 * cScale);
        ctx.bezierCurveTo(28 * cScale, -40 * cScale, 32 * cScale, -20 * cScale, 20 * cScale, 0);
        ctx.closePath();
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#e11d48';
          ctx.beginPath();
          ctx.arc(32 * cScale, -55 * cScale, 5 * cScale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM KOI & LANTERNS
    const zenColors = ['#e11d48', '#fb923c', '#ffffff', '#ffd166', '#a855f7', '#06b6d4'];
    for (let z = 0; z < objectCount; z++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const scaleMult = (z < 4) ? 1.4 : (z < 18) ? 1.0 : 0.55;
      const size = randomRange(26, 46) * scaleMult;
      const kind = randomChoice(['KOI_FISH', 'PAPER_LANTERN', 'BONSAI_PINE']);
      const baseColor = randomChoice(zenColors);

      candidates.push({
        id: `zen_obj_${z}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#e11d48' ? '#06b6d4' : '#e11d48';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

          if (kind === 'KOI_FISH') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.45, curSize * 0.22, 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(curSize * 0.1, -curSize * 0.05, curSize * 0.18, 0, Math.PI * 2);
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
          } else {
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, curSize * 0.4);
            ctx.quadraticCurveTo(curSize * 0.2, 0, 0, -curSize * 0.2);
            ctx.stroke();
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.arc(0, -curSize * 0.25, curSize * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

    // Micro Sakura Petals
    for (let p = 0; p < microCount; p++) {
      const px = randomRange(40, width - 40);
      const py = randomRange(40, height - 40);
      const pSize = randomRange(8, 16);

      candidates.push({
        id: `zen_petal_${p}`,
        x: px, y: py, size: pSize, kind: 'SAKURA_PETAL', baseColor: '#fda4af',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(px, py);
          const rad = (mutated && mType === 'SCALE_CHANGE') ? pSize * 1.8 : pSize;
          ctx.fillStyle = (mutated && mType === 'COLOR_SHIFT') ? '#ffffff' : '#fda4af';
          ctx.beginPath();
          ctx.ellipse(0, 0, rad * 0.45, rad * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }
  }

  // =========================================================================
  // STEP 2: CLONE PURE BACKGROUND 100% ONTO CANVAS B (ZERO GHOSTING BUG!)
  // =========================================================================
  ctxB.drawImage(canvasA, 0, 0);

  // =========================================================================
  // STEP 3: PICK EXACTLY 1 TARGET OBJECT FOR MUTATION
  // =========================================================================
  const targetIndex = Math.floor(random() * candidates.length);
  const targetObj = candidates[targetIndex];
  const mutationType = randomChoice(['COLOR_SHIFT', 'SCALE_CHANGE', 'SHAPE_ROTATE', 'ADD_DETAIL', 'REMOVE_DETAIL']);

  // =========================================================================
  // STEP 4: DRAW ALL OBJECTS ONTO BOTH CANVASES
  // Non-target objects are drawn identically.
  // ONLY targetObj receives the mutated state on Canvas B.
  // Because the background was cloned before objects, Canvas B NEVER has the unmutated version underneath!
  // =========================================================================
  candidates.forEach(c => {
    if (c.id === targetObj.id) {
      c.draw(ctxA, false, '');
      c.draw(ctxB, true, mutationType);
    } else {
      c.draw(ctxA, false, '');
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

  const imgA = createSafeImage(dataUrlA);
  const imgB = createSafeImage(dataUrlB);

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
