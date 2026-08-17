// Advanced Procedural Scene Generator Engine
// Produces visually complex, high-density, multi-layered vector scenes
// GUARANTEED EXACTLY 1 VISIBLE DIFFERENCE between Image A and Image B

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color to a contrasting neon/bold hue
  'REMOVE_DETAIL',    // Remove a distinct sub-element / ornament / center
  'ADD_DETAIL',       // Add an ornament / jewel / diode / mark
  'SHAPE_ROTATE',     // Rotate the element by 45-90 degrees
  'SCALE_CHANGE'      // Scale the element up or down
];

/**
 * Creates a seeded PRNG generator
 */
function createPRNG(seed) {
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates a rich, highly varied procedural image pair with GUARANTEED EXACTLY 1 DIFFERENCE.
 */
export function generateProceduralLevelPair(themeId = 'find_the_sniper', targetDifficulty = 'Medium', seed = Date.now()) {
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

  const isSniper = themeId === 'find_the_sniper';
  const subStyle = Math.floor(random() * 3); // 0, 1, 2 sub-archetypes per theme

  // Discrete interactive candidate objects list
  const candidates = [];

  // =========================================================================
  // STEP 1: RENDER BASE BACKGROUND ONTO CANVAS A
  // =========================================================================
  if (isSniper) {
    if (subStyle === 0) {
      // 🌿 BOTANICAL GREENHOUSE & LUSH FOLIAGE
      const bgGrad = ctxA.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width * 0.75);
      bgGrad.addColorStop(0, '#132a13');
      bgGrad.addColorStop(0.5, '#0d1f0f');
      bgGrad.addColorStop(1, '#050c06');
      ctxA.fillStyle = bgGrad;
      ctxA.fillRect(0, 0, width, height);

      // Organic soil / moss texture particles
      const leafColors = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#1b4332', '#d8f3dc', '#ffb703', '#d90429', '#ff758f'];
      for (let i = 0; i < 900; i++) {
        const px = random() * width;
        const py = random() * height;
        const pr = randomRange(2, 7);
        ctxA.fillStyle = randomChoice(leafColors);
        ctxA.globalAlpha = randomRange(0.2, 0.7);
        ctxA.beginPath();
        ctxA.ellipse(px, py, pr, pr * 0.6, random() * Math.PI, 0, Math.PI * 2);
        ctxA.fill();
      }
      ctxA.globalAlpha = 1.0;

      // Dense Interactive Foliage Grid (Ferns, Flowers, Monstera leaves, Butterflies)
      const gridXCount = targetDifficulty === 'Easy' ? 9 : targetDifficulty === 'Medium' ? 12 : 15;
      const gridYCount = targetDifficulty === 'Easy' ? 7 : targetDifficulty === 'Medium' ? 9 : 11;
      const stepX = (width - 80) / gridXCount;
      const stepY = (height - 80) / gridYCount;

      for (let ix = 0; ix < gridXCount; ix++) {
        for (let iy = 0; iy < gridYCount; iy++) {
          if (random() > 0.85) continue;
          const cx = 40 + ix * stepX + randomRange(-10, 10);
          const cy = 40 + iy * stepY + randomRange(-10, 10);
          const size = randomRange(22, 36);
          const kind = randomChoice(['FLOWER', 'MONSTERA', 'BUTTERFLY', 'FERN_CLUSTER', 'LADYBUG']);
          const baseColor = randomChoice(['#ff007f', '#ffb703', '#00f0ff', '#ff5400', '#d500f9', '#ffffff', '#00ff87']);
          const rot = random() * Math.PI * 2;

          candidates.push({
            id: `botanical_${ix}_${iy}`,
            x: cx,
            y: cy,
            size,
            kind,
            baseColor,
            rot,
            draw: (ctx, mutated, mType) => {
              ctx.save();
              ctx.translate(cx, cy);
              const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 2 : rot;
              ctx.rotate(curRot);
              let color = baseColor;
              if (mutated && mType === 'COLOR_SHIFT') {
                color = baseColor === '#ff007f' ? '#00f0ff' : baseColor === '#ffb703' ? '#ff007f' : '#ffb703';
              }
              const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

              if (kind === 'FLOWER') {
                // 5-Petal Flower
                for (let p = 0; p < 5; p++) {
                  const angle = (p * Math.PI * 2) / 5;
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.ellipse(Math.cos(angle) * (curSize * 0.45), Math.sin(angle) * (curSize * 0.45), curSize * 0.38, curSize * 0.2, angle, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                  ctx.stroke();
                }
                // Flower Core Center
                ctx.fillStyle = (mutated && mType === 'REMOVE_DETAIL') ? color : '#ffd166';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.22, 0, Math.PI * 2);
                ctx.fill();
                if (mutated && mType === 'ADD_DETAIL') {
                  ctx.fillStyle = '#ff007f';
                  ctx.beginPath();
                  ctx.arc(0, 0, curSize * 0.1, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else if (kind === 'BUTTERFLY') {
                // Butterfly Wings
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(-curSize * 0.35, -curSize * 0.25, curSize * 0.4, curSize * 0.28, -0.4, 0, Math.PI * 2);
                ctx.ellipse(curSize * 0.35, -curSize * 0.25, curSize * 0.4, curSize * 0.28, 0.4, 0, Math.PI * 2);
                ctx.ellipse(-curSize * 0.28, curSize * 0.28, curSize * 0.3, curSize * 0.2, 0.5, 0, Math.PI * 2);
                ctx.ellipse(curSize * 0.28, curSize * 0.28, curSize * 0.3, curSize * 0.2, -0.5, 0, Math.PI * 2);
                ctx.fill();
                // Body
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-2, -curSize * 0.4, 4, curSize * 0.8);
                if (mutated && mType === 'ADD_DETAIL') {
                  ctx.fillStyle = '#ffffff';
                  ctx.beginPath();
                  ctx.arc(-curSize * 0.35, -curSize * 0.25, 3, 0, Math.PI * 2);
                  ctx.arc(curSize * 0.35, -curSize * 0.25, 3, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else if (kind === 'LADYBUG') {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, -curSize * 0.45);
                ctx.lineTo(0, curSize * 0.45);
                ctx.stroke();
                // Dots
                if (!(mutated && mType === 'REMOVE_DETAIL')) {
                  ctx.fillStyle = '#000';
                  ctx.beginPath();
                  ctx.arc(-curSize * 0.2, -curSize * 0.15, 2.5, 0, Math.PI * 2);
                  ctx.arc(curSize * 0.2, -curSize * 0.15, 2.5, 0, Math.PI * 2);
                  ctx.arc(-curSize * 0.2, curSize * 0.15, 2.5, 0, Math.PI * 2);
                  ctx.arc(curSize * 0.2, curSize * 0.15, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else {
                // MONSTERA / BROAD LEAF
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 0, curSize * 0.5, curSize * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#0a2315';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-curSize * 0.5, 0);
                ctx.lineTo(curSize * 0.5, 0);
                ctx.stroke();
                if (mutated && mType === 'ADD_DETAIL') {
                  // Dewdrop
                  ctx.fillStyle = '#00f0ff';
                  ctx.beginPath();
                  ctx.arc(curSize * 0.15, -curSize * 0.1, 4, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
              ctx.restore();
            }
          });
        }
      }

    } else if (subStyle === 1) {
      // 🔌 HARDWARE PCB / CIRCUIT BOARD WORKBENCH
      ctxA.fillStyle = '#061a14';
      ctxA.fillRect(0, 0, width, height);

      // Gold copper trace grid network
      ctxA.strokeStyle = 'rgba(212, 175, 55, 0.25)';
      ctxA.lineWidth = 2;
      for (let x = 20; x < width; x += 40) {
        ctxA.beginPath();
        ctxA.moveTo(x, 0);
        ctxA.lineTo(x + 20, height);
        ctxA.stroke();
      }
      for (let y = 20; y < height; y += 40) {
        ctxA.beginPath();
        ctxA.moveTo(0, y);
        ctxA.lineTo(width, y + 20);
        ctxA.stroke();
      }

      // PCB Components: QFP Chips, SMD Resistors, Capacitors, LEDs
      const gridXCount = targetDifficulty === 'Easy' ? 10 : targetDifficulty === 'Medium' ? 14 : 18;
      const gridYCount = targetDifficulty === 'Easy' ? 8 : targetDifficulty === 'Medium' ? 10 : 12;
      const stepX = (width - 60) / gridXCount;
      const stepY = (height - 60) / gridYCount;

      for (let ix = 0; ix < gridXCount; ix++) {
        for (let iy = 0; iy < gridYCount; iy++) {
          if (random() > 0.8) continue;
          const cx = 30 + ix * stepX + randomRange(-6, 6);
          const cy = 30 + iy * stepY + randomRange(-6, 6);
          const size = randomRange(20, 34);
          const kind = randomChoice(['MICROCHIP', 'LED', 'CAPACITOR', 'RESISTOR']);
          const baseColor = randomChoice(['#ff0055', '#00ff87', '#00f0ff', '#ffb703', '#ffd166', '#3a86ff']);
          const rot = (Math.floor(random() * 4) * Math.PI) / 2;

          candidates.push({
            id: `pcb_${ix}_${iy}`,
            x: cx,
            y: cy,
            size,
            kind,
            baseColor,
            rot,
            draw: (ctx, mutated, mType) => {
              ctx.save();
              ctx.translate(cx, cy);
              const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 4 : rot;
              ctx.rotate(curRot);
              let color = baseColor;
              if (mutated && mType === 'COLOR_SHIFT') {
                color = baseColor === '#ff0055' ? '#00ff87' : baseColor === '#00ff87' ? '#00f0ff' : '#ff0055';
              }
              const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

              if (kind === 'MICROCHIP') {
                // Square IC body
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-curSize * 0.45, -curSize * 0.45, curSize * 0.9, curSize * 0.9);
                ctx.strokeStyle = '#334155';
                ctx.strokeRect(-curSize * 0.45, -curSize * 0.45, curSize * 0.9, curSize * 0.9);
                // Golden corner pin index dot
                ctx.fillStyle = (mutated && mType === 'REMOVE_DETAIL') ? '#0f172a' : '#ffd166';
                ctx.beginPath();
                ctx.arc(-curSize * 0.3, -curSize * 0.3, 2.5, 0, Math.PI * 2);
                ctx.fill();
                // Silver pins
                ctx.fillStyle = '#cbd5e1';
                for (let p = -curSize * 0.35; p <= curSize * 0.35; p += curSize * 0.2) {
                  ctx.fillRect(p - 1.5, -curSize * 0.55, 3, 3);
                  ctx.fillRect(p - 1.5, curSize * 0.45, 3, 3);
                  ctx.fillRect(-curSize * 0.55, p - 1.5, 3, 3);
                  ctx.fillRect(curSize * 0.45, p - 1.5, 3, 3);
                }
              } else if (kind === 'LED') {
                // Glowing LED Indicator
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(-curSize * 0.1, -curSize * 0.1, curSize * 0.12, 0, Math.PI * 2);
                ctx.fill();
              } else if (kind === 'CAPACITOR') {
                // Cylindrical Electrolytic Capacitor
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                // Negative stripe marking
                if (!(mutated && mType === 'REMOVE_DETAIL')) {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(-curSize * 0.35, -2, curSize * 0.7, 4);
                }
              } else {
                // SMD RESISTOR
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(-curSize * 0.4, -curSize * 0.22, curSize * 0.8, curSize * 0.44);
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(-curSize * 0.4, -curSize * 0.22, curSize * 0.15, curSize * 0.44);
                ctx.fillRect(curSize * 0.25, -curSize * 0.22, curSize * 0.15, curSize * 0.44);
                // Value color band
                ctx.fillStyle = color;
                ctx.fillRect(-curSize * 0.1, -curSize * 0.22, curSize * 0.2, curSize * 0.44);
              }
              ctx.restore();
            }
          });
        }
      }

    } else {
      // 🛠️ WORKBENCH & CLUTTER HARDWARE
      ctxA.fillStyle = '#1e1b18';
      ctxA.fillRect(0, 0, width, height);

      // Wood grain lines
      ctxA.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctxA.lineWidth = 3;
      for (let y = 0; y < height; y += 15) {
        ctxA.beginPath();
        ctxA.moveTo(0, y);
        ctxA.bezierCurveTo(width * 0.3, y + 8, width * 0.7, y - 8, width, y);
        ctxA.stroke();
      }

      // Hardware objects (Screws, Bolts, Washers, Hex Nuts, Gears)
      const gridXCount = targetDifficulty === 'Easy' ? 9 : targetDifficulty === 'Medium' ? 13 : 16;
      const gridYCount = targetDifficulty === 'Easy' ? 7 : targetDifficulty === 'Medium' ? 9 : 11;
      const stepX = (width - 60) / gridXCount;
      const stepY = (height - 60) / gridYCount;

      for (let ix = 0; ix < gridXCount; ix++) {
        for (let iy = 0; iy < gridYCount; iy++) {
          if (random() > 0.82) continue;
          const cx = 35 + ix * stepX + randomRange(-8, 8);
          const cy = 35 + iy * stepY + randomRange(-8, 8);
          const size = randomRange(22, 36);
          const kind = randomChoice(['HEX_NUT', 'SCREW_HEAD', 'BRASS_WASHER', 'SMALL_GEAR']);
          const baseColor = randomChoice(['#d4af37', '#c0c0c0', '#cd7f32', '#94a3b8', '#e5e7eb', '#ff007f']);
          const rot = random() * Math.PI * 2;

          candidates.push({
            id: `hardware_${ix}_${iy}`,
            x: cx,
            y: cy,
            size,
            kind,
            baseColor,
            rot,
            draw: (ctx, mutated, mType) => {
              ctx.save();
              ctx.translate(cx, cy);
              const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 4 : rot;
              ctx.rotate(curRot);
              let color = baseColor;
              if (mutated && mType === 'COLOR_SHIFT') {
                color = baseColor === '#d4af37' ? '#c0c0c0' : baseColor === '#c0c0c0' ? '#cd7f32' : '#d4af37';
              }
              const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

              if (kind === 'HEX_NUT') {
                ctx.fillStyle = color;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                  const a = (i * Math.PI) / 3;
                  const px = Math.cos(a) * (curSize * 0.45);
                  const py = Math.sin(a) * (curSize * 0.45);
                  if (i === 0) ctx.moveTo(px, py);
                  else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.stroke();
                // Threaded hole
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.22, 0, Math.PI * 2);
                ctx.fill();
              } else if (kind === 'SCREW_HEAD') {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.stroke();
                // Phillips cross slot
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-curSize * 0.3, 0);
                ctx.lineTo(curSize * 0.3, 0);
                if (!(mutated && mType === 'REMOVE_DETAIL')) {
                  ctx.moveTo(0, -curSize * 0.3);
                  ctx.lineTo(0, curSize * 0.3);
                }
                ctx.stroke();
              } else if (kind === 'SMALL_GEAR') {
                ctx.fillStyle = color;
                // Gear teeth
                for (let g = 0; g < 8; g++) {
                  const a = (g * Math.PI * 2) / 8;
                  ctx.fillRect(Math.cos(a) * (curSize * 0.35) - 3, Math.sin(a) * (curSize * 0.35) - 3, 6, 6);
                }
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1e1b18';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.16, 0, Math.PI * 2);
                ctx.fill();
              } else {
                // BRASS WASHER
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1e1b18';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.24, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            }
          });
        }
      }
    }

  } else {
    // =========================================================================
    // THEME 2: FANTASTICAL / COSMIC / STEAMPUNK
    // =========================================================================
    if (subStyle === 0) {
      // 💎 CRYSTALLINE PRISM & MINERAL GEODE
      const bgGrad = ctxA.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0a0118');
      bgGrad.addColorStop(0.5, '#1e0836');
      bgGrad.addColorStop(1, '#050014');
      ctxA.fillStyle = bgGrad;
      ctxA.fillRect(0, 0, width, height);

      // Glowing starry constellation background
      const crystalColors = ['#00f0ff', '#ff007f', '#7000ff', '#00ff87', '#ffb703', '#d500f9', '#ffffff'];
      for (let s = 0; s < 700; s++) {
        ctxA.fillStyle = randomChoice(crystalColors);
        ctxA.globalAlpha = randomRange(0.2, 0.8);
        ctxA.fillRect(random() * width, random() * height, randomRange(1.5, 4), randomRange(1.5, 4));
      }
      ctxA.globalAlpha = 1.0;

      // Crystals & Sacred Geometry
      const gridXCount = targetDifficulty === 'Easy' ? 9 : targetDifficulty === 'Medium' ? 12 : 15;
      const gridYCount = targetDifficulty === 'Easy' ? 7 : targetDifficulty === 'Medium' ? 9 : 11;
      const stepX = (width - 60) / gridXCount;
      const stepY = (height - 60) / gridYCount;

      for (let ix = 0; ix < gridXCount; ix++) {
        for (let iy = 0; iy < gridYCount; iy++) {
          if (random() > 0.8) continue;
          const cx = 35 + ix * stepX + randomRange(-8, 8);
          const cy = 35 + iy * stepY + randomRange(-8, 8);
          const size = randomRange(22, 38);
          const kind = randomChoice(['OCTAHEDRON', 'GEM_SHIELD', 'PRISM_STAR', 'CRYSTAL_CLUSTER']);
          const baseColor = randomChoice(crystalColors);
          const rot = random() * Math.PI * 2;

          candidates.push({
            id: `crystal_${ix}_${iy}`,
            x: cx,
            y: cy,
            size,
            kind,
            baseColor,
            rot,
            draw: (ctx, mutated, mType) => {
              ctx.save();
              ctx.translate(cx, cy);
              const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 4 : rot;
              ctx.rotate(curRot);
              let color = baseColor;
              if (mutated && mType === 'COLOR_SHIFT') {
                color = baseColor === '#00f0ff' ? '#ff007f' : baseColor === '#ff007f' ? '#00ff87' : '#00f0ff';
              }
              const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

              ctx.fillStyle = color;
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;

              if (kind === 'OCTAHEDRON') {
                ctx.beginPath();
                ctx.moveTo(0, -curSize * 0.5);
                ctx.lineTo(curSize * 0.4, 0);
                ctx.lineTo(0, curSize * 0.5);
                ctx.lineTo(-curSize * 0.4, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Facet line
                ctx.beginPath();
                ctx.moveTo(-curSize * 0.4, 0);
                ctx.lineTo(curSize * 0.4, 0);
                ctx.stroke();
              } else if (kind === 'GEM_SHIELD') {
                ctx.beginPath();
                ctx.moveTo(-curSize * 0.35, -curSize * 0.4);
                ctx.lineTo(curSize * 0.35, -curSize * 0.4);
                ctx.lineTo(curSize * 0.45, 0);
                ctx.lineTo(0, curSize * 0.5);
                ctx.lineTo(-curSize * 0.45, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                if (mutated && mType === 'ADD_DETAIL') {
                  ctx.fillStyle = '#ffffff';
                  ctx.beginPath();
                  ctx.arc(0, 0, 4, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else if (kind === 'PRISM_STAR') {
                // 4-Point Shimmer Star
                ctx.beginPath();
                ctx.moveTo(0, -curSize * 0.5);
                ctx.quadraticCurveTo(0, 0, curSize * 0.5, 0);
                ctx.quadraticCurveTo(0, 0, 0, curSize * 0.5);
                ctx.quadraticCurveTo(0, 0, -curSize * 0.5, 0);
                ctx.quadraticCurveTo(0, 0, 0, -curSize * 0.5);
                ctx.fill();
                ctx.stroke();
              } else {
                // CRYSTAL CLUSTER
                ctx.fillRect(-curSize * 0.3, -curSize * 0.3, curSize * 0.6, curSize * 0.6);
                ctx.strokeRect(-curSize * 0.3, -curSize * 0.3, curSize * 0.6, curSize * 0.6);
                if (!(mutated && mType === 'REMOVE_DETAIL')) {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(-curSize * 0.15, -curSize * 0.15, curSize * 0.3, curSize * 0.3);
                }
              }
              ctx.restore();
            }
          });
        }
      }

    } else {
      // ⚙️ STEAMPUNK CLOCKWORK & HOROLOGY
      const bgGrad = ctxA.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.7);
      bgGrad.addColorStop(0, '#2d1b00');
      bgGrad.addColorStop(0.7, '#180c00');
      bgGrad.addColorStop(1, '#080400');
      ctxA.fillStyle = bgGrad;
      ctxA.fillRect(0, 0, width, height);

      // Engraved brass dial arcs
      ctxA.strokeStyle = 'rgba(255, 183, 3, 0.18)';
      ctxA.lineWidth = 1.5;
      for (let r = 80; r < 500; r += 60) {
        ctxA.beginPath();
        ctxA.arc(width / 2, height / 2, r, 0, Math.PI * 2);
        ctxA.stroke();
      }

      // Horology Elements (Interlocking Gears, Ruby Bearings, Balance Springs)
      const gearColors = ['#ffb703', '#d4af37', '#c08081', '#e0aaff', '#00f0ff', '#ff007f'];
      const gridXCount = targetDifficulty === 'Easy' ? 9 : targetDifficulty === 'Medium' ? 12 : 15;
      const gridYCount = targetDifficulty === 'Easy' ? 7 : targetDifficulty === 'Medium' ? 9 : 11;
      const stepX = (width - 60) / gridXCount;
      const stepY = (height - 60) / gridYCount;

      for (let ix = 0; ix < gridXCount; ix++) {
        for (let iy = 0; iy < gridYCount; iy++) {
          if (random() > 0.8) continue;
          const cx = 35 + ix * stepX + randomRange(-8, 8);
          const cy = 35 + iy * stepY + randomRange(-8, 8);
          const size = randomRange(22, 38);
          const kind = randomChoice(['SPUR_GEAR', 'RUBY_BEARING', 'ESCAPE_WHEEL', 'BALANCE_SPRING']);
          const baseColor = randomChoice(gearColors);
          const rot = random() * Math.PI * 2;

          candidates.push({
            id: `horology_${ix}_${iy}`,
            x: cx,
            y: cy,
            size,
            kind,
            baseColor,
            rot,
            draw: (ctx, mutated, mType) => {
              ctx.save();
              ctx.translate(cx, cy);
              const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 4 : rot;
              ctx.rotate(curRot);
              let color = baseColor;
              if (mutated && mType === 'COLOR_SHIFT') {
                color = baseColor === '#ffb703' ? '#ff007f' : baseColor === '#ff007f' ? '#00f0ff' : '#ffb703';
              }
              const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

              if (kind === 'SPUR_GEAR') {
                ctx.fillStyle = color;
                for (let g = 0; g < 10; g++) {
                  const a = (g * Math.PI * 2) / 10;
                  ctx.fillRect(Math.cos(a) * (curSize * 0.38) - 3, Math.sin(a) * (curSize * 0.38) - 3, 6, 6);
                }
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.38, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#080400';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.16, 0, Math.PI * 2);
                ctx.fill();
              } else if (kind === 'RUBY_BEARING') {
                // Synthetic Ruby Jewel
                ctx.fillStyle = '#ff0055';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffd166';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                // Pivot center hole
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.12, 0, Math.PI * 2);
                ctx.fill();
              } else if (kind === 'ESCAPE_WHEEL') {
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
                ctx.stroke();
                // Spokes
                for (let s = 0; s < 4; s++) {
                  const a = (s * Math.PI) / 2;
                  ctx.beginPath();
                  ctx.moveTo(0, 0);
                  ctx.lineTo(Math.cos(a) * curSize * 0.35, Math.sin(a) * curSize * 0.35);
                  ctx.stroke();
                }
                if (mutated && mType === 'ADD_DETAIL') {
                  ctx.fillStyle = '#00f0ff';
                  ctx.beginPath();
                  ctx.arc(0, 0, 4, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else {
                // BALANCE SPRING (Spiral)
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let a = 0; a < Math.PI * 6; a += 0.2) {
                  const r = (a / (Math.PI * 6)) * (curSize * 0.4);
                  const px = Math.cos(a) * r;
                  const py = Math.sin(a) * r;
                  if (a === 0) ctx.moveTo(px, py);
                  else ctx.lineTo(px, py);
                }
                ctx.stroke();
              }
              ctx.restore();
            }
          });
        }
      }
    }
  }

  // =========================================================================
  // STEP 2: CLONE BACKGROUND 100.0% ONTO CANVAS B
  // =========================================================================
  ctxB.drawImage(canvasA, 0, 0);

  // Fallback candidate if none populated
  if (candidates.length === 0) {
    candidates.push({
      id: 'fallback_center',
      x: width / 2,
      y: height / 2,
      size: 30,
      draw: (ctx, mutated, mType) => {
        ctx.fillStyle = mutated ? '#ff007f' : '#00f0ff';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 15, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // =========================================================================
  // STEP 3: PICK EXACTLY 1 TARGET OBJECT FOR MUTATION
  // =========================================================================
  const targetIndex = Math.floor(random() * candidates.length);
  const targetObj = candidates[targetIndex];
  // Ensure the mutation is bold and easily discernible
  const mutationType = randomChoice(['COLOR_SHIFT', 'SCALE_CHANGE', 'SHAPE_ROTATE', 'ADD_DETAIL', 'REMOVE_DETAIL']);

  // =========================================================================
  // STEP 4: DRAW ALL OBJECTS CLEANLY ONTO BOTH CANVASES
  // Non-target objects are drawn identically.
  // ONLY targetObj receives the mutated state on Canvas B.
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
