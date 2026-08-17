// Advanced Procedural Art Engine with Distinct Abstract Art Movements & High-Density Styles
// GUARANTEED EXACTLY 1 VISIBLE DIFFERENCE between Image A and Image B
// Inspired by: Wassily Kandinsky, Piet Mondrian, Joan Miró, Yayoi Kusama,
// Kazimir Malevich, Henri Matisse, Bridget Riley, and Jackson Pollock.

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const ART_MOVEMENTS = [
  { id: 'kandinsky', name: 'Kandinsky Geometric Composition' },
  { id: 'mondrian', name: 'Mondrian Neoplastic Grid' },
  { id: 'miro', name: 'Miró Biomorphic Surrealism' },
  { id: 'kusama', name: 'Kusama Infinity Polka Dots' },
  { id: 'malevich', name: 'Malevich Suprematism' },
  { id: 'matisse', name: 'Matisse Gouache Cut-Outs' },
  { id: 'riley', name: 'Riley Op-Art Optical Waves' },
  { id: 'pollock', name: 'Pollock Action Splatter Web' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color to a contrasting neon/bold hue
  'REMOVE_DETAIL',    // Remove a distinct sub-element / ornament / center
  'ADD_DETAIL',       // Add an ornament / jewel / diode / mark
  'SHAPE_ROTATE',     // Rotate the element by 45-90 degrees
  'SCALE_CHANGE'      // Scale the element up or down
];

function createPRNG(seed) {
  let s = Math.abs(Math.floor(seed || 1)) % 2147483647;
  if (s <= 0) s = 1;
  // Mulberry/LCG seed hash mixing
  s = (s ^ 0x6D2B79F5) % 2147483647;
  if (s <= 0) s = 1;
  s = (s * 48271) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates an authentic, museum-grade abstract art or photographic scene pair
 * with guaranteed exactly 1 visible mutation.
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
  let sceneTitle = 'Abstract Art';

  // =========================================================================
  // ART STYLES PIPELINE
  // =========================================================================

  if (isPhotoTheme) {
    // PHOTOGRAPHIC CLUTTER & REAL-WORLD DETAIL
    const photoSubStyle = Math.floor(random() * 3);

    if (photoSubStyle === 0) {
      // 🌿 BOTANICAL GREENHOUSE & LUSH FOLIAGE
      sceneTitle = 'Botanical Canopy';
      const bgGrad = ctxA.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width * 0.75);
      bgGrad.addColorStop(0, '#132a13');
      bgGrad.addColorStop(0.5, '#0d1f0f');
      bgGrad.addColorStop(1, '#050c06');
      ctxA.fillStyle = bgGrad;
      ctxA.fillRect(0, 0, width, height);

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
          const kind = randomChoice(['FLOWER', 'MONSTERA', 'BUTTERFLY', 'LADYBUG']);
          const baseColor = randomChoice(['#ff007f', '#ffb703', '#00f0ff', '#ff5400', '#d500f9', '#ffffff', '#00ff87']);
          const rot = random() * Math.PI * 2;

          candidates.push({
            id: `botanical_${ix}_${iy}`,
            x: cx, y: cy, size, kind, baseColor, rot,
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
                for (let p = 0; p < 5; p++) {
                  const angle = (p * Math.PI * 2) / 5;
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.ellipse(Math.cos(angle) * (curSize * 0.45), Math.sin(angle) * (curSize * 0.45), curSize * 0.38, curSize * 0.2, angle, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                  ctx.stroke();
                }
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
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(-curSize * 0.35, -curSize * 0.25, curSize * 0.4, curSize * 0.28, -0.4, 0, Math.PI * 2);
                ctx.ellipse(curSize * 0.35, -curSize * 0.25, curSize * 0.4, curSize * 0.28, 0.4, 0, Math.PI * 2);
                ctx.ellipse(-curSize * 0.28, curSize * 0.28, curSize * 0.3, curSize * 0.2, 0.5, 0, Math.PI * 2);
                ctx.ellipse(curSize * 0.28, curSize * 0.28, curSize * 0.3, curSize * 0.2, -0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-2, -curSize * 0.4, 4, curSize * 0.8);
              } else {
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
                if (!(mutated && mType === 'REMOVE_DETAIL')) {
                  ctx.fillStyle = '#000';
                  ctx.beginPath();
                  ctx.arc(-curSize * 0.2, -curSize * 0.15, 2.5, 0, Math.PI * 2);
                  ctx.arc(curSize * 0.2, -curSize * 0.15, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
              ctx.restore();
            }
          });
        }
      }

    } else if (photoSubStyle === 1) {
      // 🔌 HARDWARE CIRCUIT WORKBENCH
      sceneTitle = 'Micro-Circuit Hardware';
      ctxA.fillStyle = '#061a14';
      ctxA.fillRect(0, 0, width, height);

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
            x: cx, y: cy, size, kind, baseColor, rot,
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
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-curSize * 0.45, -curSize * 0.45, curSize * 0.9, curSize * 0.9);
                ctx.strokeStyle = '#334155';
                ctx.strokeRect(-curSize * 0.45, -curSize * 0.45, curSize * 0.9, curSize * 0.9);
                ctx.fillStyle = (mutated && mType === 'REMOVE_DETAIL') ? '#0f172a' : '#ffd166';
                ctx.beginPath();
                ctx.arc(-curSize * 0.3, -curSize * 0.3, 2.5, 0, Math.PI * 2);
                ctx.fill();
              } else if (kind === 'LED') {
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
              } else {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            }
          });
        }
      }

    } else {
      // 🛠️ WORKBENCH HARDWARE CLUTTER
      sceneTitle = 'Horology & Hardware';
      ctxA.fillStyle = '#1e1b18';
      ctxA.fillRect(0, 0, width, height);

      ctxA.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctxA.lineWidth = 3;
      for (let y = 0; y < height; y += 15) {
        ctxA.beginPath();
        ctxA.moveTo(0, y);
        ctxA.bezierCurveTo(width * 0.3, y + 8, width * 0.7, y - 8, width, y);
        ctxA.stroke();
      }

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
          const kind = randomChoice(['HEX_NUT', 'SCREW_HEAD', 'SMALL_GEAR']);
          const baseColor = randomChoice(['#d4af37', '#c0c0c0', '#cd7f32', '#94a3b8', '#ff007f']);
          const rot = random() * Math.PI * 2;

          candidates.push({
            id: `hardware_${ix}_${iy}`,
            x: cx, y: cy, size, kind, baseColor, rot,
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
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.22, 0, Math.PI * 2);
                ctx.fill();
              } else if (kind === 'SMALL_GEAR') {
                ctx.fillStyle = color;
                for (let g = 0; g < 8; g++) {
                  const a = (g * Math.PI * 2) / 8;
                  ctx.fillRect(Math.cos(a) * (curSize * 0.35) - 3, Math.sin(a) * (curSize * 0.35) - 3, 6, 6);
                }
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-curSize * 0.3, 0);
                ctx.lineTo(curSize * 0.3, 0);
                ctx.stroke();
              }
              ctx.restore();
            }
          });
        }
      }
    }

  } else {
    // =========================================================================
    // ABSTRACT ART MOVEMENTS PIPELINE (8 AUTHENTIC DISTINCT STYLES)
    // =========================================================================
    const artStyleIndex = Math.floor(random() * 8);

    if (artStyleIndex === 0) {
      // 🎨 STYLE 1: WASSILY KANDINSKY (Composition Geometric Harmony)
      sceneTitle = 'Kandinsky Composition';
      const bgGrad = ctxA.createRadialGradient(width / 2, height / 2, 60, width / 2, height / 2, width * 0.7);
      bgGrad.addColorStop(0, '#fbf5e6');
      bgGrad.addColorStop(0.5, '#ede0c8');
      bgGrad.addColorStop(1, '#d5c4a1');
      ctxA.fillStyle = bgGrad;
      ctxA.fillRect(0, 0, width, height);

      // Sweeping dynamic beams & arc lines
      ctxA.strokeStyle = '#1e1e1e';
      ctxA.lineWidth = 4;
      ctxA.beginPath();
      ctxA.moveTo(0, height * 0.85);
      ctxA.bezierCurveTo(width * 0.3, height * 0.1, width * 0.7, height * 0.9, width, height * 0.2);
      ctxA.stroke();

      ctxA.strokeStyle = '#c1121f';
      ctxA.lineWidth = 3;
      ctxA.beginPath();
      ctxA.moveTo(50, 50);
      ctxA.lineTo(width - 50, height - 50);
      ctxA.stroke();

      // Kandinsky Elements (Concentric rings, checkerboard sectors, crescent moons, floating discs)
      const colors = ['#e63946', '#1d3557', '#457b9d', '#ffb703', '#fb8500', '#2a9d8f', '#6a040f', '#03045e'];
      const count = targetDifficulty === 'Easy' ? 24 : targetDifficulty === 'Medium' ? 36 : 50;

      for (let i = 0; i < count; i++) {
        const cx = randomRange(60, width - 60);
        const cy = randomRange(60, height - 60);
        const size = randomRange(26, 48);
        const kind = randomChoice(['CONCENTRIC_CIRCLES', 'CRESCENT_MOON', 'CHECKER_WEDGE', 'BEAM_STAR']);
        const baseColor = randomChoice(colors);
        const accentColor = randomChoice(colors);
        const rot = random() * Math.PI * 2;

        candidates.push({
          id: `kandinsky_${i}`,
          x: cx, y: cy, size, kind, baseColor, rot,
          draw: (ctx, mutated, mType) => {
            ctx.save();
            ctx.translate(cx, cy);
            const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 3 : rot;
            ctx.rotate(curRot);
            let color = baseColor;
            if (mutated && mType === 'COLOR_SHIFT') {
              color = baseColor === '#e63946' ? '#1d3557' : baseColor === '#1d3557' ? '#ffb703' : '#e63946';
            }
            const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

            if (kind === 'CONCENTRIC_CIRCLES') {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              ctx.fillStyle = (mutated && mType === 'REMOVE_DETAIL') ? color : accentColor;
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.25, 0, Math.PI * 2);
              ctx.fill();

              if (mutated && mType === 'ADD_DETAIL') {
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
              }
            } else if (kind === 'CRESCENT_MOON') {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#fbf5e6';
              ctx.beginPath();
              ctx.arc(curSize * 0.2, -curSize * 0.1, curSize * 0.38, 0, Math.PI * 2);
              ctx.fill();
            } else if (kind === 'CHECKER_WEDGE') {
              ctx.fillStyle = color;
              ctx.fillRect(-curSize * 0.4, -curSize * 0.4, curSize * 0.8, curSize * 0.8);
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 2;
              ctx.strokeRect(-curSize * 0.4, -curSize * 0.4, curSize * 0.8, curSize * 0.8);
              ctx.fillStyle = accentColor;
              ctx.fillRect(0, 0, curSize * 0.4, curSize * 0.4);
              ctx.fillRect(-curSize * 0.4, -curSize * 0.4, curSize * 0.4, curSize * 0.4);
            } else {
              ctx.strokeStyle = color;
              ctx.lineWidth = 3;
              for (let a = 0; a < 4; a++) {
                const ang = (a * Math.PI) / 4;
                ctx.beginPath();
                ctx.moveTo(-Math.cos(ang) * curSize * 0.45, -Math.sin(ang) * curSize * 0.45);
                ctx.lineTo(Math.cos(ang) * curSize * 0.45, Math.sin(ang) * curSize * 0.45);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
        });
      }

    } else if (artStyleIndex === 1) {
      // 🟥 STYLE 2: PIET MONDRIAN (De Stijl Neoplasticism)
      sceneTitle = 'Mondrian Neoplasticism';
      ctxA.fillStyle = '#faf8f5';
      ctxA.fillRect(0, 0, width, height);

      // Black grid lattice
      ctxA.strokeStyle = '#111111';
      ctxA.lineWidth = 8;
      const xLines = [120, 260, 420, 580, 700];
      const yLines = [90, 220, 350, 480];

      xLines.forEach(x => {
        ctxA.beginPath();
        ctxA.moveTo(x, 0);
        ctxA.lineTo(x, height);
        ctxA.stroke();
      });

      yLines.forEach(y => {
        ctxA.beginPath();
        ctxA.moveTo(0, y);
        ctxA.lineTo(width, y);
        ctxA.stroke();
      });

      // Primary color blocks & nested cells
      const primaryColors = ['#d90429', '#00509d', '#ffd000', '#111111', '#e5e5e5'];
      for (let xi = 0; xi < xLines.length; xi++) {
        for (let yi = 0; yi < yLines.length; yi++) {
          const rx = (xi === 0 ? 0 : xLines[xi - 1]) + 4;
          const ry = (yi === 0 ? 0 : yLines[yi - 1]) + 4;
          const rw = xLines[xi] - (xi === 0 ? 0 : xLines[xi - 1]) - 8;
          const rh = yLines[yi] - (yi === 0 ? 0 : yLines[yi - 1]) - 8;
          const color = randomChoice(primaryColors);

          if (random() > 0.4) {
            ctxA.fillStyle = color;
            ctxA.fillRect(rx, ry, rw, rh);
          }

          const cx = rx + rw / 2;
          const cy = ry + rh / 2;
          const baseColor = color;
          candidates.push({
            id: `mondrian_${xi}_${yi}`,
            x: cx, y: cy, size, kind: 'RECT_BLOCK', baseColor,
            draw: (ctx, mutated, mType) => {
              ctx.save();
              ctx.translate(cx, cy);
              let drawColor = baseColor;
              if (mutated && mType === 'COLOR_SHIFT') {
                drawColor = baseColor === '#d90429' ? '#00509d' : baseColor === '#00509d' ? '#ffd000' : '#d90429';
              }
              const curW = (mutated && mType === 'SCALE_CHANGE') ? rw * 0.7 : rw * 0.85;
              const curH = (mutated && mType === 'SCALE_CHANGE') ? rh * 0.7 : rh * 0.85;

              ctx.fillStyle = drawColor;
              ctx.fillRect(-curW / 2, -curH / 2, curW, curH);
              ctx.strokeStyle = '#111111';
              ctx.lineWidth = 4;
              ctx.strokeRect(-curW / 2, -curH / 2, curW, curH);

              if (mutated && mType === 'ADD_DETAIL') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-curW / 4, -curH / 4, curW / 2, curH / 2);
                ctx.strokeRect(-curW / 4, -curH / 4, curW / 2, curH / 2);
              }
              ctx.restore();
            }
          });
        }
      }

    } else if (artStyleIndex === 2) {
      // 🌟 STYLE 3: JOAN MIRÓ (Biomorphic Surrealist Glyphs)
      sceneTitle = 'Miró Biomorphic Dream';
      const bgGrad = ctxA.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#fef9e7');
      bgGrad.addColorStop(0.5, '#f8e9a1');
      bgGrad.addColorStop(1, '#fad390');
      ctxA.fillStyle = bgGrad;
      ctxA.fillRect(0, 0, width, height);

      // Wandering calligraphic black ink paths
      ctxA.strokeStyle = '#000000';
      ctxA.lineWidth = 3;
      ctxA.beginPath();
      ctxA.moveTo(80, 120);
      ctxA.bezierCurveTo(width * 0.4, 50, width * 0.2, height * 0.8, width * 0.8, height * 0.6);
      ctxA.stroke();

      const miroColors = ['#e63946', '#1d3557', '#ffb703', '#2a9d8f', '#000000', '#f4a261'];
      const count = targetDifficulty === 'Easy' ? 22 : targetDifficulty === 'Medium' ? 32 : 44;

      for (let i = 0; i < count; i++) {
        const cx = randomRange(50, width - 50);
        const cy = randomRange(50, height - 50);
        const size = randomRange(24, 42);
        const kind = randomChoice(['MIRO_STAR', 'AMOEBA_EYE', 'CRESCENT_BEAST', 'CALLIGRAPHIC_LOOP']);
        const baseColor = randomChoice(miroColors);
        const rot = random() * Math.PI * 2;

        candidates.push({
          id: `miro_${i}`,
          x: cx, y: cy, size, kind, baseColor, rot,
          draw: (ctx, mutated, mType) => {
            ctx.save();
            ctx.translate(cx, cy);
            const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 4 : rot;
            ctx.rotate(curRot);
            let color = baseColor;
            if (mutated && mType === 'COLOR_SHIFT') {
              color = baseColor === '#e63946' ? '#1d3557' : baseColor === '#1d3557' ? '#ffb703' : '#e63946';
            }
            const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

            if (kind === 'MIRO_STAR') {
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 3;
              for (let s = 0; s < 4; s++) {
                const a = (s * Math.PI) / 4;
                ctx.beginPath();
                ctx.moveTo(-Math.cos(a) * (curSize * 0.45), -Math.sin(a) * (curSize * 0.45));
                ctx.lineTo(Math.cos(a) * (curSize * 0.45), Math.sin(a) * (curSize * 0.45));
                ctx.stroke();
              }
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.2, 0, Math.PI * 2);
              ctx.fill();
            } else if (kind === 'AMOEBA_EYE') {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.ellipse(0, 0, curSize * 0.45, curSize * 0.28, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 2.5;
              ctx.stroke();
              ctx.fillStyle = (mutated && mType === 'REMOVE_DETAIL') ? color : '#000000';
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.14, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 2;
              ctx.stroke();
              if (mutated && mType === 'ADD_DETAIL') {
                ctx.strokeStyle = '#e63946';
                ctx.beginPath();
                ctx.moveTo(-curSize * 0.3, -curSize * 0.3);
                ctx.lineTo(curSize * 0.3, curSize * 0.3);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
        });
      }

    } else if (artStyleIndex === 3) {
      // 🔴 STYLE 4: YAYOI KUSAMA (Infinity Polka Dots)
      sceneTitle = 'Kusama Infinity Dots';
      const bgPair = randomChoice([
        { bg: '#ffd000', dot: '#111111', accent: '#d90429' },
        { bg: '#d90429', dot: '#ffffff', accent: '#ffd000' },
        { bg: '#03045e', dot: '#00f0ff', accent: '#ff007f' },
        { bg: '#ff007f', dot: '#ffffff', accent: '#00f0ff' }
      ]);

      ctxA.fillStyle = bgPair.bg;
      ctxA.fillRect(0, 0, width, height);

      // Undulating infinity field of dots
      const gridXCount = targetDifficulty === 'Easy' ? 12 : targetDifficulty === 'Medium' ? 16 : 20;
      const gridYCount = targetDifficulty === 'Easy' ? 9 : targetDifficulty === 'Medium' ? 12 : 15;
      const stepX = width / gridXCount;
      const stepY = height / gridYCount;

      for (let ix = 0; ix < gridXCount; ix++) {
        for (let iy = 0; iy < gridYCount; iy++) {
          const cx = stepX * (ix + 0.5);
          const cy = stepY * (iy + 0.5);
          const distFromCenter = Math.hypot(cx - width / 2, cy - height / 2);
          const size = Math.max(10, 26 - (distFromCenter / width) * 16);
          const baseColor = bgPair.dot;

          candidates.push({
            id: `kusama_${ix}_${iy}`,
            x: cx, y: cy, size, kind: 'POLKA_DOT', baseColor,
            draw: (ctx, mutated, mType) => {
              ctx.save();
              ctx.translate(cx, cy);
              let color = baseColor;
              if (mutated && mType === 'COLOR_SHIFT') {
                color = bgPair.accent;
              }
              const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : (mutated && mType === 'REMOVE_DETAIL') ? size * 0.4 : size;

              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
              ctx.fill();

              if (mutated && mType === 'ADD_DETAIL') {
                ctx.fillStyle = bgPair.bg;
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.2, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            }
          });
        }
      }

    } else if (artStyleIndex === 4) {
      // ⬛ STYLE 5: KAZIMIR MALEVICH (Suprematist Geometries)
      sceneTitle = 'Malevich Suprematism';
      ctxA.fillStyle = '#f4f1ea';
      ctxA.fillRect(0, 0, width, height);

      const colors = ['#111111', '#c1121f', '#003049', '#fdf0d5', '#669bbc', '#2b2d42'];
      const count = targetDifficulty === 'Easy' ? 20 : targetDifficulty === 'Medium' ? 30 : 42;

      for (let i = 0; i < count; i++) {
        const cx = randomRange(70, width - 70);
        const cy = randomRange(70, height - 70);
        const size = randomRange(26, 52);
        const kind = randomChoice(['SUPREMATIST_BAR', 'TILTED_SQUARE', 'CRUCIFORM_CROSS', 'TRAPEZOID']);
        const baseColor = randomChoice(colors);
        const rot = random() * Math.PI;

        candidates.push({
          id: `malevich_${i}`,
          x: cx, y: cy, size, kind, baseColor, rot,
          draw: (ctx, mutated, mType) => {
            ctx.save();
            ctx.translate(cx, cy);
            const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 4 : rot;
            ctx.rotate(curRot);
            let color = baseColor;
            if (mutated && mType === 'COLOR_SHIFT') {
              color = baseColor === '#111111' ? '#c1121f' : baseColor === '#c1121f' ? '#003049' : '#111111';
            }
            const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

            ctx.fillStyle = color;
            if (kind === 'SUPREMATIST_BAR') {
              ctx.fillRect(-curSize * 0.6, -curSize * 0.15, curSize * 1.2, curSize * 0.3);
            } else if (kind === 'CRUCIFORM_CROSS') {
              ctx.fillRect(-curSize * 0.45, -curSize * 0.12, curSize * 0.9, curSize * 0.24);
              ctx.fillRect(-curSize * 0.12, -curSize * 0.45, curSize * 0.24, curSize * 0.9);
            } else if (kind === 'TRAPEZOID') {
              ctx.beginPath();
              ctx.moveTo(-curSize * 0.4, -curSize * 0.3);
              ctx.lineTo(curSize * 0.4, -curSize * 0.2);
              ctx.lineTo(curSize * 0.25, curSize * 0.3);
              ctx.lineTo(-curSize * 0.35, curSize * 0.3);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.fillRect(-curSize * 0.35, -curSize * 0.35, curSize * 0.7, curSize * 0.7);
            }
            ctx.restore();
          }
        });
      }

    } else if (artStyleIndex === 5) {
      // 🌿 STYLE 6: HENRI MATISSE (Gouaches Découpées Cut-Outs)
      sceneTitle = 'Matisse Fauvist Cut-Outs';
      ctxA.fillStyle = '#fffdfa';
      ctxA.fillRect(0, 0, width, height);

      const matisseColors = ['#0038a8', '#d62828', '#f77f00', '#2a9d8f', '#9b5de5', '#00f5d4', '#f15bb5'];
      const count = targetDifficulty === 'Easy' ? 24 : targetDifficulty === 'Medium' ? 35 : 48;

      for (let i = 0; i < count; i++) {
        const cx = randomRange(50, width - 50);
        const cy = randomRange(50, height - 50);
        const size = randomRange(26, 44);
        const kind = randomChoice(['SEAWEED_FROND', 'CORAL_FAN', 'DANCING_STAR', 'FLORA_PETAL']);
        const baseColor = randomChoice(matisseColors);
        const rot = random() * Math.PI * 2;

        candidates.push({
          id: `matisse_${i}`,
          x: cx, y: cy, size, kind, baseColor, rot,
          draw: (ctx, mutated, mType) => {
            ctx.save();
            ctx.translate(cx, cy);
            const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 3 : rot;
            ctx.rotate(curRot);
            let color = baseColor;
            if (mutated && mType === 'COLOR_SHIFT') {
              color = baseColor === '#0038a8' ? '#d62828' : baseColor === '#d62828' ? '#f77f00' : '#0038a8';
            }
            const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

            ctx.fillStyle = color;
            if (kind === 'SEAWEED_FROND') {
              for (let f = 0; f < 5; f++) {
                const angle = (f * Math.PI) / 4 - Math.PI / 2;
                ctx.beginPath();
                ctx.ellipse(Math.cos(angle) * (curSize * 0.3), Math.sin(angle) * (curSize * 0.3), curSize * 0.35, curSize * 0.14, angle, 0, Math.PI * 2);
                ctx.fill();
              }
            } else if (kind === 'DANCING_STAR') {
              for (let a = 0; a < 6; a++) {
                const ang = (a * Math.PI * 2) / 6;
                ctx.beginPath();
                ctx.ellipse(Math.cos(ang) * (curSize * 0.35), Math.sin(ang) * (curSize * 0.35), curSize * 0.25, curSize * 0.12, ang, 0, Math.PI * 2);
                ctx.fill();
              }
            } else {
              ctx.beginPath();
              ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
              ctx.fill();
              if (mutated && mType === 'ADD_DETAIL') {
                ctx.fillStyle = '#fffdfa';
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.2, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.restore();
          }
        });
      }

    } else if (artStyleIndex === 6) {
      // 🌊 STYLE 7: BRIDGET RILEY (Op-Art Optical Waves)
      sceneTitle = 'Riley Optical Waves';
      ctxA.fillStyle = '#0f172a';
      ctxA.fillRect(0, 0, width, height);

      // High-contrast undulating sine wave lines
      ctxA.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctxA.lineWidth = 2;
      for (let y = 0; y < height; y += 20) {
        ctxA.beginPath();
        for (let x = 0; x <= width; x += 10) {
          const waveY = y + Math.sin((x / width) * Math.PI * 4) * 12;
          if (x === 0) ctxA.moveTo(x, waveY);
          else ctxA.lineTo(x, waveY);
        }
        ctxA.stroke();
      }

      // Optical nodes & vortex nodes
      const opColors = ['#00f0ff', '#ff007f', '#ffffff', '#ffbe0b', '#00ff87', '#7b2cbf'];
      const gridXCount = targetDifficulty === 'Easy' ? 10 : targetDifficulty === 'Medium' ? 14 : 18;
      const gridYCount = targetDifficulty === 'Easy' ? 8 : targetDifficulty === 'Medium' ? 10 : 12;
      const stepX = width / gridXCount;
      const stepY = height / gridYCount;

      for (let ix = 0; ix < gridXCount; ix++) {
        for (let iy = 0; iy < gridYCount; iy++) {
          if (random() > 0.8) continue;
          const cx = stepX * (ix + 0.5);
          const cy = stepY * (iy + 0.5) + Math.sin((ix / gridXCount) * Math.PI * 4) * 10;
          const size = randomRange(20, 36);
          const kind = randomChoice(['VORTEX_RING', 'OP_CHEVRON', 'DIAMOND_PRISM']);
          const baseColor = randomChoice(opColors);
          const rot = random() * Math.PI * 2;

          candidates.push({
            id: `op_${ix}_${iy}`,
            x: cx, y: cy, size, kind, baseColor, rot,
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

              if (kind === 'VORTEX_RING') {
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, curSize * 0.25, 0, Math.PI * 2);
                ctx.fill();
              } else if (kind === 'DIAMOND_PRISM') {
                ctx.beginPath();
                ctx.moveTo(0, -curSize * 0.5);
                ctx.lineTo(curSize * 0.4, 0);
                ctx.lineTo(0, curSize * 0.5);
                ctx.lineTo(-curSize * 0.4, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              } else {
                ctx.fillRect(-curSize * 0.35, -curSize * 0.35, curSize * 0.7, curSize * 0.7);
                ctx.strokeRect(-curSize * 0.35, -curSize * 0.35, curSize * 0.7, curSize * 0.7);
              }
              ctx.restore();
            }
          });
        }
      }

    } else {
      // 🎨 STYLE 8: JACKSON POLLOCK (Action Enamel Drip Web)
      sceneTitle = 'Pollock Action Web';
      ctxA.fillStyle = '#22201e';
      ctxA.fillRect(0, 0, width, height);

      // Raw canvas weave background splatters
      const dripColors = ['#f4f1de', '#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#d90429', '#00f0ff'];
      for (let d = 0; d < 40; d++) {
        ctxA.strokeStyle = randomChoice(dripColors);
        ctxA.lineWidth = randomRange(1.5, 5);
        ctxA.beginPath();
        ctxA.moveTo(random() * width, random() * height);
        ctxA.bezierCurveTo(random() * width, random() * height, random() * width, random() * height, random() * width, random() * height);
        ctxA.stroke();
      }

      const count = targetDifficulty === 'Easy' ? 24 : targetDifficulty === 'Medium' ? 36 : 48;
      for (let i = 0; i < count; i++) {
        const cx = randomRange(60, width - 60);
        const cy = randomRange(60, height - 60);
        const size = randomRange(22, 38);
        const kind = randomChoice(['ENAMEL_SPLASH', 'DRIP_LOOP', 'VELOCITY_DROP']);
        const baseColor = randomChoice(dripColors);
        const rot = random() * Math.PI * 2;

        candidates.push({
          id: `pollock_${i}`,
          x: cx, y: cy, size, kind, baseColor, rot,
          draw: (ctx, mutated, mType) => {
            ctx.save();
            ctx.translate(cx, cy);
            const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 3 : rot;
            ctx.rotate(curRot);
            let color = baseColor;
            if (mutated && mType === 'COLOR_SHIFT') {
              color = baseColor === '#d90429' ? '#00f0ff' : baseColor === '#00f0ff' ? '#f2cc8f' : '#d90429';
            }
            const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Radial micro splatter droplets
            for (let s = 0; s < 4; s++) {
              const a = (s * Math.PI) / 2;
              ctx.beginPath();
              ctx.arc(Math.cos(a) * (curSize * 0.48), Math.sin(a) * (curSize * 0.48), 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        });
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
      draw: (ctx, mutated) => {
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
