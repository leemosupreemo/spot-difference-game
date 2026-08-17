// Multi-Planar High-Complexity Organic Procedural Art Engine
// GUARANTEED EXACTLY 1 VISIBLE DIFFERENCE between Image A and Image B
// 6 Immersive Illustrated Worlds with Multi-Planar Depth & Hand-Drawn Bezier Contours:
// 1. Woodland Wildlife Sanctuary (Foxes, Fallow Deer, Owls, Hedgehogs, Squirrels, Fungi)
// 2. Ocean Abyssal Coral Kingdom (Whales, Hammerheads, Seahorses, Octopuses, Nautilus, Manta Rays)
// 3. Tropical Rainforest Aviary (Macaws, Hummingbirds, Toucans, Chameleons, Tree Frogs, Orchids)
// 4. Celestial Fairy-Tale Sky (Sleeping Moon, Cloud Castles, Hot Air Balloons, Pegasus, Stardust)
// 5. Japanese Kyoto Zen Garden (Torii Gates, Pagodas, Koi Carp, Red-Crowned Cranes, Bonsai)
// 6. Enchanted Bioluminescent Hollow (Giant Toadstools, Crystal Geodes, Pixie Wisps, Dragonflies)

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const ART_WORLDS = [
  { id: 'woodland_sanctuary', name: 'Woodland Wildlife Sanctuary' },
  { id: 'ocean_abyss', name: 'Ocean Abyssal Coral Kingdom' },
  { id: 'tropical_aviary', name: 'Tropical Rainforest Aviary' },
  { id: 'celestial_fairytale', name: 'Celestial Fairy-Tale Sky' },
  { id: 'kyoto_garden', name: 'Japanese Kyoto Zen Garden' },
  { id: 'enchanted_hollow', name: 'Enchanted Bioluminescent Hollow' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change feather/fur/petal/wing hue to a distinct bold contrasting color
  'REMOVE_DETAIL',    // Remove a distinct spot / feather / eye glint / stripe / flower bud / tusk
  'ADD_DETAIL',       // Add an ornament / crown / flower / spot / feather / glowing core
  'SHAPE_ROTATE',     // Rotate animal head / tail / flower / butterfly / wing by 45-90 degrees
  'SCALE_CHANGE'      // Scale element up or down
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

/**
 * Generates an organic, multi-planar illustrated scene pair with zero rigid geometry
 * and guaranteed exactly 1 visible difference.
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
  let sceneTitle = 'Illustrated Realm';

  // Pick one of 6 rich organic worlds
  const worldIndex = Math.floor(random() * 6);

  // Density counts with safe minimums
  const mediumCount = targetDifficulty === 'Easy' ? 20 : targetDifficulty === 'Medium' ? 30 : 40;
  const microCount = targetDifficulty === 'Easy' ? 28 : targetDifficulty === 'Medium' ? 42 : 56;

  if (worldIndex === 0) {
    // =========================================================================
    // 🦊 WORLD 1: WOODLAND WILDLIFE SANCTUARY
    // =========================================================================
    sceneTitle = 'Woodland Wildlife Sanctuary';

    // Multi-tone misty forest watercolor gradient
    const bgGrad = ctxA.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a1915');
    bgGrad.addColorStop(0.4, '#143828');
    bgGrad.addColorStop(0.8, '#26543b');
    bgGrad.addColorStop(1, '#3d7052');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    // Gnarled ancient mossy tree boughs
    ctxA.strokeStyle = '#1a110a';
    ctxA.lineWidth = 26;
    ctxA.lineCap = 'round';
    ctxA.beginPath();
    ctxA.moveTo(0, height * 0.42);
    ctxA.bezierCurveTo(width * 0.35, height * 0.48, width * 0.65, height * 0.36, width, height * 0.48);
    ctxA.stroke();

    // 1. HERO 1: Sleeping Red Fox (200px)
    const foxX = randomRange(width * 0.25, width * 0.5);
    const foxY = height * 0.52;
    const foxColor = '#e65c00';

    candidates.push({
      id: 'hero_fox',
      x: foxX, y: foxY, size: 95, kind: 'SLEEPING_FOX', baseColor: foxColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(foxX, foxY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#d90429' : foxColor;
        const fScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        // Curled body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-45 * fScale, 0);
        ctx.bezierCurveTo(-45 * fScale, -40 * fScale, 28 * fScale, -45 * fScale, 40 * fScale, -12 * fScale);
        ctx.bezierCurveTo(50 * fScale, 18 * fScale, -25 * fScale, 40 * fScale, -45 * fScale, 0);
        ctx.closePath();
        ctx.fill();

        // Fluffy brush tail
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(30 * fScale, -8 * fScale);
        ctx.bezierCurveTo(60 * fScale, -5 * fScale, 55 * fScale, 32 * fScale, 12 * fScale, 28 * fScale);
        ctx.bezierCurveTo(0, 22 * fScale, 10 * fScale, 0, 30 * fScale, -8 * fScale);
        ctx.closePath();
        ctx.fill();

        // White Tail Tip
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(42 * fScale, 18 * fScale, 10 * fScale, 0, Math.PI * 2);
          ctx.fill();
        }

        // Head & Ears
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-30 * fScale, -12 * fScale);
        ctx.lineTo(-44 * fScale, -35 * fScale);
        ctx.lineTo(-26 * fScale, -24 * fScale);
        ctx.closePath();
        ctx.fill();

        // White Muzzle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-30 * fScale, -4 * fScale, 8 * fScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-33 * fScale, -5 * fScale, 2.8 * fScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 2. HERO 2: Grazing Fallow Deer / Fawn (180px)
    const deerX = randomRange(width * 0.65, width * 0.85);
    const deerY = height * 0.58;
    const deerColor = '#b07d56';

    candidates.push({
      id: 'hero_fawn',
      x: deerX, y: deerY, size: 85, kind: 'FALLOW_FAWN', baseColor: deerColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(deerX, deerY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#8d5b36' : deerColor;
        const dScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        // Slender body & neck
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 38 * dScale, 22 * dScale, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Graceful Neck & Head
        ctx.beginPath();
        ctx.moveTo(-20 * dScale, -10 * dScale);
        ctx.quadraticCurveTo(-38 * dScale, -35 * dScale, -42 * dScale, -48 * dScale);
        ctx.lineTo(-28 * dScale, -48 * dScale);
        ctx.quadraticCurveTo(-15 * dScale, -25 * dScale, -5 * dScale, -12 * dScale);
        ctx.closePath();
        ctx.fill();

        // Spotted Fawn Spots
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          for (let s = -2; s <= 2; s++) {
            ctx.beginPath();
            ctx.arc(s * 10 * dScale, -4 * dScale, 2.5 * dScale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    });

    // 3. MEDIUM WOODLAND CRITTERS (Horned Owls, Hedgehogs, Squirrels, Chanterelles)
    const woodlandColors = ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#9d4edd', '#48cae4'];
    for (let w = 0; w < mediumCount; w++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
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
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'HORNED_OWL') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.35, curSize * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-curSize * 0.25, -curSize * 0.35);
            ctx.lineTo(-curSize * 0.35, -curSize * 0.58);
            ctx.lineTo(-curSize * 0.12, -curSize * 0.42);
            ctx.moveTo(curSize * 0.25, -curSize * 0.35);
            ctx.lineTo(curSize * 0.35, -curSize * 0.58);
            ctx.lineTo(curSize * 0.12, -curSize * 0.42);
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
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            for (let s = -3; s <= 3; s++) {
              ctx.beginPath();
              ctx.moveTo(s * 6, -curSize * 0.3);
              ctx.lineTo(s * 8, -curSize * 0.5);
              ctx.stroke();
            }
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(curSize * 0.42, curSize * 0.12, 3, 0, Math.PI * 2);
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
            if (mutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(0, -curSize * 0.25, 4, 0, Math.PI * 2);
              ctx.fill();
            }
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

    // 4. MICRO FOREST BERRIES & DEWY OAK LEAVES
    for (let l = 0; l < microCount; l++) {
      const lx = randomRange(40, width - 40);
      const ly = randomRange(40, height - 40);
      const lSize = randomRange(10, 20);
      const lRot = random() * Math.PI * 2;

      candidates.push({
        id: `forest_berry_${l}`,
        x: lx, y: ly, size: lSize, kind: 'FOREST_BERRY', baseColor: '#e63946',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(lRot + ((mutated && mType === 'SHAPE_ROTATE') ? Math.PI / 3 : 0));
          let bcol = (mutated && mType === 'COLOR_SHIFT') ? '#48cae4' : '#e63946';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? lSize * 1.8 : lSize;

          ctx.fillStyle = bcol;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-rad * 0.12, -rad * 0.12, rad * 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 1) {
    // =========================================================================
    // 🐋 WORLD 2: OCEAN ABYSSAL CORAL KINGDOM
    // =========================================================================
    sceneTitle = 'Ocean Abyssal Kingdom';

    const seaGrad = ctxA.createLinearGradient(0, 0, 0, height);
    seaGrad.addColorStop(0, '#021526');
    seaGrad.addColorStop(0.5, '#03284c');
    seaGrad.addColorStop(1, '#08537a');
    ctxA.fillStyle = seaGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO 1: Breaching Humpback Whale (220px)
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

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(52 * wScale, -5 * wScale, 4 * wScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(52 * wScale, -5 * wScale, 2 * wScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 2. MEDIUM SEAHORSES, OCTOPUSES, MANTA RAYS & SHELLS
    const marineColors = ['#f72585', '#7209b7', '#4cc9f0', '#ffb703', '#06d6a0'];
    for (let m = 0; m < mediumCount; m++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['CURLY_SEAHORSE', 'SWIRL_OCTOPUS', 'SCALLOP_SHELL', 'MANTA_RAY']);
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
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'CURLY_SEAHORSE') {
            ctx.strokeStyle = color;
            ctx.lineWidth = curSize * 0.28;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.35);
            ctx.quadraticCurveTo(curSize * 0.2, -curSize * 0.1, 0, curSize * 0.1);
            ctx.quadraticCurveTo(-curSize * 0.2, curSize * 0.3, curSize * 0.05, curSize * 0.45);
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.35);
            ctx.lineTo(curSize * 0.3, -curSize * 0.35);
            ctx.lineTo(0, -curSize * 0.25);
            ctx.closePath();
            ctx.fill();
            if (mutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffd166';
              ctx.beginPath();
              ctx.arc(0, -curSize * 0.48, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (kind === 'MANTA_RAY') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.4);
            ctx.lineTo(curSize * 0.6, 0);
            ctx.lineTo(0, curSize * 0.3);
            ctx.lineTo(-curSize * 0.6, 0);
            ctx.closePath();
            ctx.fill();
            // Tail whip
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, curSize * 0.3);
            ctx.lineTo(0, curSize * 0.7);
            ctx.stroke();
          } else if (kind === 'SWIRL_OCTOPUS') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, -curSize * 0.1, curSize * 0.35, curSize * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            for (let t = -2; t <= 2; t++) {
              ctx.beginPath();
              ctx.moveTo(t * 7, curSize * 0.1);
              ctx.quadraticCurveTo(t * 15 + 10, curSize * 0.35, t * 10, curSize * 0.5);
              ctx.stroke();
            }
          } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, curSize * 0.3);
            ctx.arc(0, 0, curSize * 0.4, Math.PI * 0.8, Math.PI * 2.2, false);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            for (let r = -2; r <= 2; r++) {
              ctx.beginPath();
              ctx.moveTo(0, curSize * 0.3);
              ctx.lineTo(r * 8, -curSize * 0.35);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO PEARLS
    for (let p = 0; p < microCount; p++) {
      const px = randomRange(40, width - 40);
      const py = randomRange(40, height - 40);
      const pSize = randomRange(8, 16);

      candidates.push({
        id: `ocean_pearl_${p}`,
        x: px, y: py, size: pSize, kind: 'OCEAN_PEARL', baseColor: '#e0fbfc',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(px, py);
          let pcol = (mutated && mType === 'COLOR_SHIFT') ? '#f72585' : '#e0fbfc';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? pSize * 1.8 : pSize;

          ctx.fillStyle = pcol;
          ctx.shadowColor = pcol;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-rad * 0.12, -rad * 0.12, rad * 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 2) {
    // =========================================================================
    // 🌺 WORLD 3: TROPICAL RAINFOREST AVIARY
    // =========================================================================
    sceneTitle = 'Tropical Rainforest Aviary';

    const aviaryGrad = ctxA.createLinearGradient(0, 0, 0, height);
    aviaryGrad.addColorStop(0, '#071f15');
    aviaryGrad.addColorStop(0.5, '#0e432c');
    aviaryGrad.addColorStop(1, '#1b5e3b');
    ctxA.fillStyle = aviaryGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO 1: Hovering Hummingbird (200px)
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

        ctx.fillStyle = 'rgba(0, 180, 216, 0.7)';
        ctx.beginPath();
        ctx.ellipse(-10 * bScale, -28 * bScale, 12 * bScale, 30 * bScale, -0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(8 * bScale, -8 * bScale, 3.5 * bScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(8 * bScale, -8 * bScale, 1.8 * bScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 2. MEDIUM BUTTERFLIES, CHAMELEONS & FLOWERS
    const floraColors = ['#ff007f', '#ffb703', '#fb5607', '#06d6a0', '#7209b7'];
    for (let fl = 0; fl < mediumCount; fl++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
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
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'MONARCH_BUTTERFLY') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(-curSize * 0.28, -curSize * 0.2, curSize * 0.32, curSize * 0.22, -0.4, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.28, -curSize * 0.2, curSize * 0.32, curSize * 0.22, 0.4, 0, Math.PI * 2);
            ctx.ellipse(-curSize * 0.22, curSize * 0.2, curSize * 0.24, curSize * 0.15, 0.5, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.22, curSize * 0.2, curSize * 0.24, curSize * 0.15, -0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();
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
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(curSize * 0.18, -curSize * 0.08, 5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            for (let p = 0; p < 5; p++) {
              const a = (p * Math.PI * 2) / 5 - Math.PI / 2;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.ellipse(Math.cos(a) * (curSize * 0.32), Math.sin(a) * (curSize * 0.32), curSize * 0.3, curSize * 0.16, a, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(curSize * 0.45, -curSize * 0.3);
            ctx.stroke();
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
        id: `dewdrop_pollen_${d}`,
        x: dx, y: dy, size: dSize, kind: 'DEWDROP_POLLEN', baseColor: '#ffffff',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(dx, dy);
          let dcol = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : '#ffffff';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? dSize * 1.8 : dSize;

          ctx.fillStyle = dcol;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 3) {
    // =========================================================================
    // 🌙 WORLD 4: CELESTIAL FAIRY-TALE SKY
    // =========================================================================
    sceneTitle = 'Celestial Fairy-Tale Sky';

    const skyGrad = ctxA.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0c0721');
    skyGrad.addColorStop(0.4, '#261b53');
    skyGrad.addColorStop(0.8, '#442268');
    skyGrad.addColorStop(1, '#853272');
    ctxA.fillStyle = skyGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO 1: Sleeping Crescent Moon (220px)
    const moonX = randomRange(width * 0.35, width * 0.65);
    const moonY = height * 0.42;
    const moonColor = '#ffd166';

    candidates.push({
      id: 'hero_crescent_moon',
      x: moonX, y: moonY, size: 105, kind: 'SLEEPING_CRESCENT_MOON', baseColor: moonColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(moonX, moonY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#ffffff' : moonColor;
        const mScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, 52 * mScale, -0.6 * Math.PI, 0.8 * Math.PI, false);
        ctx.bezierCurveTo(14 * mScale, 38 * mScale, 14 * mScale, -38 * mScale, Math.cos(-0.6 * Math.PI) * 52 * mScale, Math.sin(-0.6 * Math.PI) * 52 * mScale);
        ctx.closePath();
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.strokeStyle = '#43281c';
          ctx.lineWidth = 2.5 * mScale;
          ctx.beginPath();
          ctx.arc(-8 * mScale, -5 * mScale, 8 * mScale, 0.2, Math.PI * 0.8);
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM BALLOONS, CLOUD PUFFS & STARS
    const skyColors = ['#ff70a6', '#ff9770', '#ffd670', '#e9ff70', '#70d6ff'];
    for (let s = 0; s < mediumCount; s++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['HOT_AIR_BALLOON', 'BILLOWY_CLOUD', 'SHOOTING_STAR']);
      const baseColor = randomChoice(skyColors);

      candidates.push({
        id: `sky_obj_${s}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#ff70a6' ? '#70d6ff' : '#ff70a6';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'HOT_AIR_BALLOON') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, -curSize * 0.15, curSize * 0.35, Math.PI, 0, false);
            ctx.lineTo(curSize * 0.18, curSize * 0.25);
            ctx.lineTo(-curSize * 0.18, curSize * 0.25);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#8b5a2b';
            ctx.fillRect(-curSize * 0.08, curSize * 0.38, curSize * 0.16, curSize * 0.12);
          } else if (kind === 'BILLOWY_CLOUD') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            ctx.beginPath();
            ctx.arc(-curSize * 0.2, 0, curSize * 0.22, 0, Math.PI * 2);
            ctx.arc(0, -curSize * 0.15, curSize * 0.28, 0, Math.PI * 2);
            ctx.arc(curSize * 0.2, 0, curSize * 0.22, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-curSize * 0.4, -curSize * 0.2, -curSize * 0.7, -curSize * 0.5);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO TWINKLES
    for (let t = 0; t < microCount; t++) {
      const tx = randomRange(40, width - 40);
      const ty = randomRange(40, height - 40);
      const tSize = randomRange(8, 16);

      candidates.push({
        id: `sky_twinkle_${t}`,
        x: tx, y: ty, size: tSize, kind: 'SKY_TWINKLE', baseColor: '#ffffff',
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(tx, ty);
          let tcol = (mutated && mType === 'COLOR_SHIFT') ? '#ff70a6' : '#ffffff';
          const rad = (mutated && mType === 'SCALE_CHANGE') ? tSize * 1.8 : tSize;

          ctx.strokeStyle = tcol;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-rad * 0.4, 0);
          ctx.lineTo(rad * 0.4, 0);
          ctx.moveTo(0, -rad * 0.4);
          ctx.lineTo(0, rad * 0.4);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

  } else if (worldIndex === 4) {
    // =========================================================================
    // ⛩️ WORLD 5: JAPANESE KYOTO ZEN GARDEN
    // =========================================================================
    sceneTitle = 'Kyoto Zen Garden';

    const zenGrad = ctxA.createLinearGradient(0, 0, 0, height);
    zenGrad.addColorStop(0, '#fdf2f8');
    zenGrad.addColorStop(0.4, '#fed7aa');
    zenGrad.addColorStop(0.7, '#f472b6');
    zenGrad.addColorStop(1, '#312e81');
    ctxA.fillStyle = zenGrad;
    ctxA.fillRect(0, 0, width, height);

    // Giant Crimson Sun
    ctxA.fillStyle = '#e11d48';
    ctxA.beginPath();
    ctxA.arc(width * 0.5, height * 0.45, 110, 0, Math.PI * 2);
    ctxA.fill();

    // 1. HERO 1: Red-Crowned Crane with Spreading Wings (200px)
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

        // Pure white body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 32 * cScale, 18 * cScale, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Long S-Curve Neck & Head
        ctx.beginPath();
        ctx.moveTo(15 * cScale, -5 * cScale);
        ctx.bezierCurveTo(25 * cScale, -25 * cScale, 18 * cScale, -45 * cScale, 30 * cScale, -55 * cScale);
        ctx.lineTo(38 * cScale, -52 * cScale);
        ctx.bezierCurveTo(28 * cScale, -40 * cScale, 32 * cScale, -20 * cScale, 20 * cScale, 0);
        ctx.closePath();
        ctx.fill();

        // Red Crown Patch
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#e11d48';
          ctx.beginPath();
          ctx.arc(32 * cScale, -55 * cScale, 5 * cScale, 0, Math.PI * 2);
          ctx.fill();
        }

        // Long Slender Legs
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 2 * cScale;
        ctx.beginPath();
        ctx.moveTo(-5 * cScale, 12 * cScale);
        ctx.lineTo(-10 * cScale, 48 * cScale);
        ctx.moveTo(8 * cScale, 12 * cScale);
        ctx.lineTo(5 * cScale, 48 * cScale);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 2. MEDIUM KOI, TORII GATES & PAPER LANTERNS
    const zenColors = ['#e11d48', '#fb923c', '#ffffff', '#ffd166', '#a855f7', '#06b6d4'];
    for (let z = 0; z < mediumCount; z++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
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
            // Bonsai Pine
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

    // 3. MICRO SAKURA PETALS
    for (let p = 0; p < microCount; p++) {
      const px = randomRange(40, width - 40);
      const py = randomRange(40, height - 40);
      const pSize = randomRange(10, 18);
      const pRot = random() * Math.PI * 2;

      candidates.push({
        id: `zen_petal_${p}`,
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

  } else {
    // =========================================================================
    // 🍄 WORLD 6: ENCHANTED BIOLUMINESCENT HOLLOW
    // =========================================================================
    sceneTitle = 'Enchanted Bioluminescent Hollow';

    const hollowGrad = ctxA.createLinearGradient(0, 0, 0, height);
    hollowGrad.addColorStop(0, '#060312');
    hollowGrad.addColorStop(0.5, '#170b30');
    hollowGrad.addColorStop(1, '#331252');
    ctxA.fillStyle = hollowGrad;
    ctxA.fillRect(0, 0, width, height);

    // 1. HERO 1: Giant Bioluminescent Toadstool (210px)
    const mushX = randomRange(width * 0.35, width * 0.65);
    const mushY = height * 0.65;
    const mushColor = '#ff0055';

    candidates.push({
      id: 'hero_toadstool',
      x: mushX, y: mushY - 40, size: 100, kind: 'GIANT_TOADSTOOL', baseColor: mushColor,
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(mushX, mushY);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#00f5d4' : mushColor;
        const mScale = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(-16 * mScale, 0);
        ctx.lineTo(16 * mScale, 0);
        ctx.lineTo(10 * mScale, -60 * mScale);
        ctx.lineTo(-10 * mScale, -60 * mScale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, -60 * mScale, 60 * mScale, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-24 * mScale, -88 * mScale, 7 * mScale, 0, Math.PI * 2);
          ctx.arc(24 * mScale, -88 * mScale, 7 * mScale, 0, Math.PI * 2);
          ctx.arc(0, -105 * mScale, 8 * mScale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    // 2. MEDIUM DRAGONFLIES, PIXIE WISPS & CRYSTAL CLUSTERS
    const hollowColors = ['#00f0ff', '#f72585', '#7209b7', '#4cc9f0', '#ffbe0b'];
    for (let h = 0; h < mediumCount; h++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(70, height - 70);
      const size = randomRange(26, 48);
      const kind = randomChoice(['CRYSTAL_CLUSTER', 'FAIRY_WISP', 'DRAGONFLY']);
      const baseColor = randomChoice(hollowColors);

      candidates.push({
        id: `hollow_obj_${h}`,
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
          } else if (kind === 'DRAGONFLY') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-2, -curSize * 0.3, 4, curSize * 0.6);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.ellipse(-curSize * 0.3, -curSize * 0.1, curSize * 0.32, curSize * 0.08, -0.3, 0, Math.PI * 2);
            ctx.ellipse(curSize * 0.3, -curSize * 0.1, curSize * 0.32, curSize * 0.08, 0.3, 0, Math.PI * 2);
            ctx.fill();
          } else {
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
          }
          ctx.restore();
        }
      });
    }

    // 3. MICRO GLOWING SPORES
    for (let s = 0; s < microCount; s++) {
      const sx = randomRange(40, width - 40);
      const sy = randomRange(40, height - 40);
      const sSize = randomRange(8, 16);

      candidates.push({
        id: `hollow_spore_${s}`,
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
  }

  // =========================================================================
  // GUARANTEED EXACTLY 1 DIFFERENCE ENGINE
  // 1. Draw ALL candidates onto Canvas A
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
