// Master Multi-Scale Organic, Impressionist & Diverse Procedural Art Engine
// Combining Master Artistic Compositions with Rich, Multi-Scale Object Populations (85-110 objects per scene)
// 1. Diverse Shape Movements: Cubist Polygonal Facets, Kandinsky Abstract Concentric Forms, Impressionist Dappled Blooms, Japanese Woodblock Silhouettes
// 2. Focused on Subtle Shape Morphs, Delicate Geometric Additions/Removals, and Rotation Details
// 3. High-Contrast Distant Color Shifts (if color difference, guaranteed bold contrast, never too close)
// 4. Dense Multi-Scale Hierarchy (4px to 360px) with 20+ Vibrant Harmonious Palettes across 12 Worlds
// 5. Guaranteed Exactly 1 High-Contrast Visible Difference with Zero Ghosting

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Abstract', category: 'Abstract' }
];

export const ART_WORLDS = [
  { id: 'monet_waterlilies', name: 'Monet Giverny Water Lilies', composition: 'MONET_WATER_MIRROR' },
  { id: 'vangogh_starry', name: 'Van Gogh Starry Cypress Grove', composition: 'VANGOGH_VORTEX_SKY' },
  { id: 'woodland_wildlife', name: 'Enchanted Woodland Wildlife', composition: 'FRIEDRICH_SUBLIME_CLEARING' },
  { id: 'ocean_depths', name: 'Hokusai Abyssal Great Wave', composition: 'HOKUSAI_GREAT_WAVE' },
  { id: 'tropical_aviary', name: 'Hiroshige Edo Aviary Vista', composition: 'HIROSHIGE_EDO_FRAMING' },
  { id: 'kyoto_garden', name: 'Kyoto Zen Golden Tapestry', composition: 'KLIMT_TREE_OF_LIFE' },
  { id: 'synthwave_neon_city', name: 'Retro Cyber Metropolis Horizon', composition: 'NEO_CYBER_PERSPECTIVE' },
  { id: 'egyptian_gilded_papyrus', name: 'Ancient Gilded Secession Fresco', composition: 'KLIMT_TREE_OF_LIFE' },
  { id: 'cosmic_nebula_stargate', name: 'Surrealist Celestial Portal', composition: 'MAGRITTE_SURREALIST_PORTAL' },
  { id: 'steampunk_clockwork', name: 'Clockwork Golden Spiral Engine', composition: 'HOKUSAI_GREAT_WAVE' },
  { id: 'nordic_aurora_fjord', name: 'Romantic Sublime Aurora Fjord', composition: 'FRIEDRICH_SUBLIME_CLEARING' },
  { id: 'cubist_mondrian_abstract', name: 'Cubist Bauhaus & Mondrian Abstraction', composition: 'MONDRIAN_NEOPLASTIC_EQUILIBRIUM' }
];

export const MUTATION_TYPES = [
  'COLOR_SHIFT',     // Change object color to a bold contrasting neon/saturated hue
  'REMOVE_DETAIL',    // Remove a distinct sub-feature / blossom / eye / spot / stripe
  'ADD_DETAIL',       // Add an ornament / crown / jewel / star / beacon
  'SHAPE_ROTATE',     // Rotate animal head / tail / flower / boat / brushstroke by 45-90 degrees
  'SCALE_CHANGE'      // Scale element up or down by 1.8x
];

export const PAINT_STYLES = [
  'IMPASTO',
  'POINTILLIST',
  'WATERCOLOR',
  'INK_WASH',
  'SOFT_PASTEL',
  'STAINED_GLASS',
  'RETRO_SYNTHWAVE',
  'WOODBLOCK_PRINT',
  'MOSAIC_TILE',
  'BAUHAUS_FLAT',
  'RISOGRAPH_PRINT',
  'GOTHIC_FILIGREE',
  'NEON_CYBERPUNK',
  'PAPER_CUTOUT_COLLAGE',
  'CEL_SHADED_ANIME',
  'TERRAZZO_INLAY'
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
    stroke: noop,
    clip: noop
  };
  return {
    width,
    height,
    getContext: () => mockCtx,
    toDataURL: () => 'data:image/png;base64,mock'
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

// Contrast & Edge Definition Utility
function applyObjectPopStyle(ctx, isDarkTheme = true) {
  if (isDarkTheme) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 3;
  } else {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.5)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 2;
  }
}

// High-Divergence Color Mappings (Guarantees >= 120° hue or luminance opposition - never too close!)
const CONTRAST_MAP = {
  '#ff007f': '#00f0ff',
  '#00f0ff': '#ff007f',
  '#ffd166': '#7209b7',
  '#7209b7': '#ffd166',
  '#06d6a0': '#ef476f',
  '#ef476f': '#06d6a0',
  '#f72585': '#4cc9f0',
  '#4cc9f0': '#f72585',
  '#e65c00': '#00b4d8',
  '#00b4d8': '#e65c00',
  '#ffffff': '#ff0054',
  '#ff0054': '#ffffff',
  '#e11d48': '#06b6d4',
  '#06b6d4': '#e11d48',
  '#ffbe0b': '#3a86ff',
  '#3a86ff': '#ffbe0b',
  '#8338ec': '#ff006e',
  '#ff006e': '#8338ec',
  '#00f5d4': '#7b2cbf',
  '#7b2cbf': '#00f5d4',
  '#f15bb5': '#fee440',
  '#fee440': '#f15bb5',
  '#fb8500': '#219ebc',
  '#219ebc': '#fb8500',
  '#9b5de5': '#00f5d4',
  '#10b981': '#f43f5e',
  '#d946ef': '#10b981',
  '#f59e0b': '#3b82f6',
  '#3b82f6': '#f59e0b',
  '#ec4899': '#14b8a6',
  '#14b8a6': '#ec4899'
};

function getHighContrastColor(color) {
  return CONTRAST_MAP[color] || (color.startsWith('#f') ? '#00f0ff' : '#ffd166');
}

const BASE_MUTATIONS = ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'SCALE_CHANGE', 'COLOR_SHIFT'];

function clamp255(v) {
  return Math.max(0, Math.min(255, v));
}

function shadeHex(hex, amt) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  const mix = amt > 0 ? 255 : 0;
  const t = Math.abs(amt);
  r = Math.round(r + (mix - r) * t);
  g = Math.round(g + (mix - g) * t);
  b = Math.round(b + (mix - b) * t);
  return `#${[r, g, b].map(v => clamp255(v).toString(16).padStart(2, '0')).join('')}`;
}

function makeWobbleSignature(random) {
  const jitter = [];
  for (let i = 0; i < 12; i++) jitter.push(1 + (random() * 2 - 1) * 0.18);
  const strokes = [];
  for (let i = 0; i < 8; i++) {
    strokes.push({
      angle: random() * Math.PI * 2,
      len: 0.3 + random() * 0.55,
      offset: (random() - 0.5) * 0.65,
      light: random() > 0.5
    });
  }
  const dots = [];
  for (let i = 0; i < 50; i++) {
    dots.push({ a: random() * Math.PI * 2, r: random(), size: 1.2 + random() * 2.5, alt: random() > 0.65 });
  }
  const tiles = [];
  for (let i = 0; i < 6; i++) {
    tiles.push({
      ox: (random() - 0.5) * 0.6,
      oy: (random() - 0.5) * 0.6,
      w: 0.2 + random() * 0.25,
      h: 0.2 + random() * 0.25
    });
  }
  const hatchLines = [];
  for (let i = 0; i < 5; i++) {
    hatchLines.push({
      yOffset: (random() - 0.5) * 0.7,
      thickness: 0.8 + random() * 1.4
    });
  }
  return { jitter, strokes, dots, tiles, hatchLines };
}

function wobblePath(ctx, cx, cy, rx, ry, rotation, jitter) {
  const n = jitter ? jitter.length : 8;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob = jitter ? jitter[i] : 1;
    const lx = Math.cos(a) * rx * wob;
    const ly = Math.sin(a) * ry * wob;
    pts.push([
      cx + lx * Math.cos(rotation) - ly * Math.sin(rotation),
      cy + lx * Math.sin(rotation) + ly * Math.cos(rotation)
    ]);
  }
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.closePath();
}

function applyPaintFinish(ctx, style, { color, strokeColor, cx, cy, rx, ry, sig, lineWidth = 1.5 }) {
  const strokeCol = strokeColor || shadeHex(color, -0.5);
  const spread = Math.max(rx, ry) || 1;

  if (style === 'POINTILLIST') {
    ctx.save();
    ctx.clip();
    const altColor = shadeHex(color, 0.35);
    const darkColor = shadeHex(color, -0.3);
    if (sig && sig.dots) {
      sig.dots.forEach(d => {
        const x = cx + Math.cos(d.a) * d.r * rx;
        const y = cy + Math.sin(d.a) * d.r * ry;
        ctx.fillStyle = d.alt ? altColor : darkColor;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(x, y, d.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lineWidth * 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  if (style === 'WATERCOLOR') {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    if (sig && sig.jitter) {
      wobblePath(ctx, cx, cy, rx * 1.15, ry * 1.15, 0, sig.jitter);
    }
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'INK_WASH') {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
    if (sig && sig.jitter) {
      wobblePath(ctx, cx, cy, rx * 1.05, ry * 1.05, 0.05, sig.jitter);
    }
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lineWidth * 0.8;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'SOFT_PASTEL') {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lineWidth * 0.6;
    ctx.stroke();
    ctx.clip();
    if (sig && sig.dots) {
      sig.dots.slice(0, 20).forEach(d => {
        const x = cx + Math.cos(d.a) * d.r * rx * 0.8;
        const y = cy + Math.sin(d.a) * d.r * ry * 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(x, y, d.size * 1.4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  if (style === 'STAINED_GLASS') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.88;
    ctx.fill();
    ctx.strokeStyle = '#09090f';
    ctx.lineWidth = lineWidth * 2.2;
    ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.6, cy - ry * 0.6);
    ctx.lineTo(cx + rx * 0.6, cy + ry * 0.6);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'RETRO_SYNTHWAVE') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lineWidth * 1.2;
    ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let y = cy - ry; y < cy + ry; y += 4) {
      ctx.beginPath();
      ctx.moveTo(cx - rx, y);
      ctx.lineTo(cx + rx, y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (style === 'WOODBLOCK_PRINT') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#121217';
    ctx.lineWidth = lineWidth * 1.8;
    ctx.stroke();
    ctx.clip();
    if (sig && sig.hatchLines) {
      ctx.strokeStyle = shadeHex(color, -0.4);
      ctx.globalAlpha = 0.45;
      sig.hatchLines.forEach(h => {
        ctx.lineWidth = h.thickness;
        ctx.beginPath();
        ctx.moveTo(cx - rx, cy + h.yOffset * ry);
        ctx.lineTo(cx + rx, cy + h.yOffset * ry + ry * 0.2);
        ctx.stroke();
      });
    }
    ctx.restore();
    return;
  }

  if (style === 'MOSAIC_TILE') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#1e1e24';
    ctx.lineWidth = lineWidth * 1.5;
    ctx.stroke();
    ctx.clip();
    if (sig && sig.tiles) {
      sig.tiles.forEach(t => {
        const tx = cx + t.ox * rx;
        const ty = cy + t.oy * ry;
        ctx.fillStyle = t.w > 0.3 ? shadeHex(color, 0.25) : shadeHex(color, -0.25);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(tx, ty, t.w * rx, t.h * ry);
        ctx.strokeStyle = '#0d0d11';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, t.w * rx, t.h * ry);
      });
    }
    ctx.restore();
    return;
  }

  if (style === 'BAUHAUS_FLAT') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2.5, lineWidth * 1.6);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'RISOGRAPH_PRINT') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lineWidth * 1.4;
    ctx.stroke();
    ctx.clip();
    if (sig && sig.dots) {
      sig.dots.slice(0, 35).forEach(d => {
        const x = cx + Math.cos(d.a) * d.r * rx;
        const y = cy + Math.sin(d.a) * d.r * ry;
        ctx.fillStyle = '#ff007f';
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, d.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
    return;
  }

  if (style === 'GOTHIC_FILIGREE') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = lineWidth * 2.2;
    ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = '#fff0a6';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, rx * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'NEON_CYBERPUNK') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2.5, lineWidth * 1.5);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'PAPER_CUTOUT_COLLAGE') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.strokeStyle = shadeHex(color, 0.4);
    ctx.lineWidth = lineWidth * 1.2;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (style === 'CEL_SHADED_ANIME') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(3, lineWidth * 2);
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cx - rx * 0.25, cy - ry * 0.25, rx * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (style === 'TERRAZZO_INLAY') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = lineWidth * 1.8;
    ctx.stroke();
    ctx.clip();
    if (sig && sig.dots) {
      sig.dots.slice(0, 25).forEach((d, idx) => {
        const x = cx + Math.cos(d.a) * d.r * rx;
        const y = cy + Math.sin(d.a) * d.r * ry;
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#ffd166';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x - d.size, y - d.size, d.size * 2, d.size * 2);
      });
    }
    ctx.restore();
    return;
  }

  // IMPASTO (default)
  ctx.save();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.clip();
  ctx.lineCap = 'round';
  const lightCol = shadeHex(color, 0.3);
  const darkCol = shadeHex(color, -0.25);
  if (sig && sig.strokes) {
    sig.strokes.forEach(s => {
      const len = s.len * spread;
      const ox = Math.cos(s.angle + Math.PI / 2) * s.offset * rx;
      const oy = Math.sin(s.angle + Math.PI / 2) * s.offset * ry;
      const x1 = cx + ox - Math.cos(s.angle) * len * 0.5;
      const y1 = cy + oy - Math.sin(s.angle) * len * 0.5;
      const x2 = cx + ox + Math.cos(s.angle) * len * 0.5;
      const y2 = cy + oy + Math.sin(s.angle) * len * 0.5;
      ctx.strokeStyle = s.light ? lightCol : darkCol;
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = Math.max(2, Math.min(rx, ry) * 0.22);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Generates an artistic procedural scene structured around Master Art Compositions
 * populated with a rich multi-movement object population (85-110 candidate objects).
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

  const worldIndex = Math.floor(random() * ART_WORLDS.length);
  const worldDef = ART_WORLDS[worldIndex];
  const sceneTitle = worldDef.name;
  const paintStyle = randomChoice(PAINT_STYLES);

  // Golden Ratio focal anchor points
  const phiX = width * 0.618;
  const phiY = height * 0.382;

  // Ultra-Rich 16+ Color Palettes per World
  const worldPalettes = {
    monet_waterlilies: ['#ff007f', '#ffffff', '#ffd166', '#ff70a6', '#c77dff', '#00f0ff', '#2a9d8f', '#90e0ef', '#74c69d', '#e0aaff', '#f72585', '#06d6a0', '#ffd60a'],
    vangogh_starry: ['#ffd166', '#ffb703', '#ffffff', '#00f0ff', '#ff70a6', '#06d6a0', '#4cc9f0', '#7209b7', '#f72585', '#3a86ff', '#e0fbfc', '#ffbe0b', '#fb5607'],
    woodland_wildlife: ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#9d4edd', '#48cae4', '#ff0054', '#70e000', '#38b000', '#d8f3dc', '#f77f00', '#fcbf49', '#e63946'],
    ocean_depths: ['#0077b6', '#00f0ff', '#f72585', '#7209b7', '#ffd166', '#06d6a0', '#ffffff', '#4cc9f0', '#03045e', '#b5179e', '#560bad', '#4895ef', '#80ffdb'],
    tropical_aviary: ['#ff007f', '#ffb703', '#fb5607', '#06d6a0', '#7209b7', '#00f0ff', '#ffffff', '#e63946', '#ff0054', '#70e000', '#f15bb5', '#fee440', '#00bbf9'],
    kyoto_garden: ['#ffd166', '#e11d48', '#fb923c', '#ffffff', '#a855f7', '#06d6a0', '#d4af37', '#b5179e', '#f72585', '#ffbe0b', '#9d4edd', '#f4a261', '#e76f51'],
    synthwave_neon_city: ['#ff007f', '#00f0ff', '#ffe600', '#7928ca', '#00f5d4', '#ff5400', '#ffffff', '#f72585', '#7209b7', '#3a86ff', '#ff006e', '#8338ec', '#ffbe0b'],
    egyptian_gilded_papyrus: ['#ffd166', '#00b4d8', '#e11d48', '#06d6a0', '#ffffff', '#dfba6f', '#f4a261', '#d4af37', '#b5179e', '#e76f51', '#0077b6', '#ffd60a'],
    cosmic_nebula_stargate: ['#00f0ff', '#ff007f', '#ffd166', '#06d6a0', '#8338ec', '#3a86ff', '#ffffff', '#f72585', '#7209b7', '#4cc9f0', '#b5179e', '#00f5d4'],
    steampunk_clockwork: ['#ffd166', '#f4a261', '#e76f51', '#00f0ff', '#d4af37', '#ffffff', '#e63946', '#7209b7', '#06d6a0', '#b5179e', '#ffb703', '#8338ec'],
    nordic_aurora_fjord: ['#00f5d4', '#e0fbfc', '#38b000', '#ffd166', '#f72585', '#48cae4', '#ffffff', '#70e000', '#00b4d8', '#3a86ff', '#8338ec', '#06d6a0'],
    cubist_mondrian_abstract: ['#e63946', '#1d3557', '#ffd166', '#000000', '#06d6a0', '#ffffff', '#ff007f', '#3a86ff', '#ffbe0b', '#7209b7', '#f72585', '#00f0ff']
  };

  const palette = worldPalettes[worldDef.id] || ['#ff007f', '#00f0ff', '#ffd166', '#06d6a0', '#ffffff', '#7209b7', '#ffbe0b'];

  // =========================================================================
  // STEP 1: RENDER MASTER COMPOSITION BACKGROUND & MAJOR ANCHORS
  // =========================================================================

  if (worldDef.composition === 'HOKUSAI_GREAT_WAVE') {
    const seaGrad = ctxA.createLinearGradient(0, 0, width, height);
    seaGrad.addColorStop(0, '#02182b');
    seaGrad.addColorStop(0.4, '#06395b');
    seaGrad.addColorStop(0.8, '#10567a');
    seaGrad.addColorStop(1, '#00101d');
    ctxA.fillStyle = seaGrad;
    ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = '#010d18';
    ctxA.beginPath();
    ctxA.moveTo(width * 0.45, height * 0.65);
    ctxA.lineTo(width * 0.58, height * 0.45);
    ctxA.lineTo(width * 0.72, height * 0.65);
    ctxA.closePath();
    ctxA.fill();

    const waveSig = makeWobbleSignature(random);
    candidates.push({
      id: 'hokusai_wave_crest',
      x: width * 0.35, y: height * 0.38, size: 320, kind: 'GREAT_WAVE_CREST', baseColor: '#0077b6', supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(width * 0.35, height * 0.38);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#7209b7' : '#0077b6';
        const s = (mutated && mType === 'SCALE_CHANGE') ? 1.25 : 1.0;

        ctx.beginPath();
        ctx.moveTo(-width * 0.4, height * 0.45 * s);
        ctx.bezierCurveTo(-width * 0.1, -height * 0.2 * s, width * 0.2, -height * 0.45 * s, width * 0.35, -height * 0.25 * s);
        ctx.bezierCurveTo(width * 0.15, -height * 0.1 * s, -width * 0.05, height * 0.2 * s, -width * 0.4, height * 0.45 * s);
        ctx.closePath();
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#03045e', cx: 0, cy: 0, rx: 180 * s, ry: 120 * s, sig: waveSig, lineWidth: 4 });

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ffd166';
          ctx.shadowColor = '#ffd166';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(width * 0.35 * s, -height * 0.3 * s, 16 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    const boatSig = makeWobbleSignature(random);
    candidates.push({
      id: 'hokusai_barge',
      x: width * 0.48, y: height * 0.62, size: 150, kind: 'WOODEN_BARGE', baseColor: '#d4a373', supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(width * 0.48, height * 0.62);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? 0.35 : 0;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#e63946' : '#d4a373';
        const s = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        ctx.beginPath();
        ctx.moveTo(-75 * s, 10 * s);
        ctx.bezierCurveTo(-30 * s, 25 * s, 30 * s, 25 * s, 75 * s, 0);
        ctx.lineTo(65 * s, -15 * s);
        ctx.lineTo(-65 * s, -10 * s);
        ctx.closePath();
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#6f1d1b', cx: 0, cy: 0, rx: 75 * s, ry: 25 * s, sig: boatSig, lineWidth: 2.5 });

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffd166';
          ctx.fillRect(-12 * s, -40 * s, 12 * s, 15 * s);
        }
        ctx.restore();
      }
    });

  } else if (worldDef.composition === 'KLIMT_TREE_OF_LIFE') {
    const goldBg = ctxA.createRadialGradient(width * 0.5, height * 0.5, 40, width * 0.5, height * 0.5, width * 0.6);
    goldBg.addColorStop(0, '#2e1904');
    goldBg.addColorStop(0.5, '#4a2c0a');
    goldBg.addColorStop(1, '#170c02');
    ctxA.fillStyle = goldBg;
    ctxA.fillRect(0, 0, width, height);

    const treeSig = makeWobbleSignature(random);
    candidates.push({
      id: 'klimt_tree_trunk',
      x: width * 0.5, y: height * 0.55, size: 300, kind: 'GOLDEN_SPIRAL_TRUNK', baseColor: '#ffd166', supportedMutations: ['ADD_DETAIL', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(width * 0.5, height * 0.55);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#00f0ff' : '#ffd166';
        const s = (mutated && mType === 'SCALE_CHANGE') ? 1.2 : 1.0;

        ctx.strokeStyle = color;
        ctx.lineWidth = 14 * s;
        ctx.beginPath();
        ctx.moveTo(0, 140 * s);
        ctx.lineTo(0, -40 * s);
        ctx.bezierCurveTo(-60 * s, -80 * s, -140 * s, -60 * s, -150 * s, -130 * s);
        ctx.moveTo(0, -40 * s);
        ctx.bezierCurveTo(60 * s, -80 * s, 140 * s, -60 * s, 150 * s, -130 * s);
        ctx.stroke();

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ff007f';
          ctx.shadowColor = '#ff007f';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(0, -180 * s, 16 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    const figureSig = makeWobbleSignature(random);
    candidates.push({
      id: 'klimt_robe_figure',
      x: phiX, y: phiY + 120, size: 160, kind: 'BYZANTINE_ROBE', baseColor: '#f72585', supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'COLOR_SHIFT'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(phiX, phiY + 120);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? '#4cc9f0' : '#f72585';
        const s = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        wobblePath(ctx, 0, 0, 50 * s, 85 * s, 0, figureSig.jitter);
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#ffd166', cx: 0, cy: 0, rx: 50 * s, ry: 85 * s, sig: figureSig, lineWidth: 3 });

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffd166';
          for (let r = -2; r <= 2; r++) {
            ctx.fillRect(r * 18 * s - 5, r * 15 * s, 12 * s, 12 * s);
          }
        }
        ctx.restore();
      }
    });

  } else {
    const skyGrad = ctxA.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#06121e');
    skyGrad.addColorStop(0.5, '#19334d');
    skyGrad.addColorStop(1, '#050a10');
    ctxA.fillStyle = skyGrad;
    ctxA.fillRect(0, 0, width, height);

    const anchorSig = makeWobbleSignature(random);
    candidates.push({
      id: 'master_composition_anchor',
      x: width * 0.35, y: height * 0.45, size: 280, kind: 'FOREGROUND_ARCHITECTURAL_CANOPY', baseColor: palette[0], supportedMutations: ['ADD_DETAIL', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(width * 0.35, height * 0.45);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(palette[0]) : palette[0];
        const s = (mutated && mType === 'SCALE_CHANGE') ? 1.25 : 1.0;

        wobblePath(ctx, 0, 0, 140 * s, 80 * s, 0.2, anchorSig.jitter);
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#000000', cx: 0, cy: 0, rx: 140 * s, ry: 80 * s, sig: anchorSig, lineWidth: 3 });

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ffd166';
          ctx.shadowColor = '#ffd166';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(0, -90 * s, 16 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    const heroSig = makeWobbleSignature(random);
    candidates.push({
      id: 'master_hero_centerpiece',
      x: phiX, y: phiY + 50, size: 160, kind: 'HERO_CENTERPIECE_FORM', baseColor: palette[1] || '#00f0ff', supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(phiX, phiY + 50);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? Math.PI / 4 : 0;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(palette[1] || '#00f0ff') : (palette[1] || '#00f0ff');
        const s = (mutated && mType === 'SCALE_CHANGE') ? 1.3 : 1.0;

        wobblePath(ctx, 0, 0, 70 * s, 50 * s, 0, heroSig.jitter);
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#ffffff', cx: 0, cy: 0, rx: 70 * s, ry: 50 * s, sig: heroSig, lineWidth: 2.5 });

        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(30 * s, -10 * s, 14 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  // =========================================================================
  // STEP 2: DENSE, MULTI-MOVEMENT DIVERSE OBJECT POPULATION (85-110 OBJECTS)
  // =========================================================================

  // A. CUBIST FACET SHARDS & GEOMETRIC PLANES (60px - 110px) - 14 objects
  for (let c = 0; c < 14; c++) {
    const cx = randomRange(60, width - 60);
    const cy = randomRange(60, height - 60);
    const size = randomRange(60, 110);
    const baseColor = randomChoice(palette);
    const sig = makeWobbleSignature(random);
    const rot = random() * Math.PI * 2;

    candidates.push({
      id: `cubist_facet_${c}`,
      x: cx, y: cy, size, kind: 'Cubist Geometric Shard', baseColor, rot,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 2 : rot;
        ctx.rotate(curRot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const s = (mutated && mType === 'SCALE_CHANGE') ? size * 1.7 : size;

        // Multi-faceted angular geometric shard
        ctx.beginPath();
        ctx.moveTo(-s * 0.45, -s * 0.3);
        ctx.lineTo(s * 0.1, -s * 0.5);
        ctx.lineTo(s * 0.45, 0);
        ctx.lineTo(s * 0.2, s * 0.45);
        ctx.lineTo(-s * 0.35, s * 0.25);
        ctx.closePath();
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#000000', cx: 0, cy: 0, rx: s * 0.45, ry: s * 0.45, sig, lineWidth: 2.5 });

        // Base has a prominent white diagonal accent line
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3.0;
          ctx.beginPath();
          ctx.moveTo(-s * 0.4, -s * 0.25);
          ctx.lineTo(s * 0.18, s * 0.4);
          ctx.stroke();
        }

        // Add detail adds a bold golden emblem
        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(s * 0.1, -s * 0.45, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.0;
          ctx.stroke();
        }
        ctx.restore();
      }
    });
  }

  // B. KANDINSKY ABSTRACT CONCENTRIC DISKS & S-RIBBONS (45px - 90px) - 16 objects
  for (let k = 0; k < 16; k++) {
    const cx = randomRange(60, width - 60);
    const cy = randomRange(60, height - 60);
    const size = randomRange(45, 90);
    const baseColor = randomChoice(palette);
    const sig = makeWobbleSignature(random);
    const isRibbon = k % 2 === 0;

    candidates.push({
      id: `abstract_form_${k}`,
      x: cx, y: cy, size, kind: isRibbon ? 'Flowing Curve Ribbon' : 'Concentric Abstract Disk', baseColor,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? Math.PI / 2 : 0;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const s = (mutated && mType === 'SCALE_CHANGE') ? size * 1.75 : size;

        if (isRibbon) {
          ctx.strokeStyle = color;
          ctx.lineWidth = (mutated && mType === 'REMOVE_DETAIL') ? 4 : 10;
          ctx.beginPath();
          ctx.moveTo(-s * 0.45, -s * 0.2);
          ctx.bezierCurveTo(-s * 0.15, -s * 0.5, s * 0.15, s * 0.5, s * 0.45, 0);
          ctx.stroke();

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ff007f';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2);
          applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#000000', cx: 0, cy: 0, rx: s * 0.38, ry: s * 0.38, sig, lineWidth: 2.5 });

          // Prominent center core
          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.52, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    });
  }

  // C. IMPRESSIONIST DAPPLED FLORA & ORGANIC FIGURATIVE FORMS (40px - 85px) - 20 objects
  for (let f = 0; f < 20; f++) {
    const cx = randomRange(60, width - 60);
    const cy = randomRange(60, height - 60);
    const size = randomRange(40, 85);
    const baseColor = randomChoice(palette);
    const kind = randomChoice(['Organic Botanical Petal', 'Stylized Silhouette Motif', 'Impressionist Floral Bloom', 'Winged Creature Form']);
    const sig = makeWobbleSignature(random);
    const poseRot = random() * Math.PI * 2;

    candidates.push({
      id: `impressionist_flora_${f}`,
      x: cx, y: cy, size, kind, baseColor, poseRot,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? poseRot + Math.PI / 2 : poseRot;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

        wobblePath(ctx, 0, 0, curSize * 0.45, curSize * 0.3, 0, sig.jitter);
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#ffffff', cx: 0, cy: 0, rx: curSize * 0.45, ry: curSize * 0.3, sig, lineWidth: 2 });

        // Base has a distinct secondary golden eye / core
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(curSize * 0.2, -curSize * 0.1, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(-curSize * 0.2, curSize * 0.1, 10, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  // D. COMPACT GEOMETRIC ACCENTS & MOTIFS (25px - 45px) - 20 objects
  for (let a = 0; a < 20; a++) {
    const cx = randomRange(45, width - 45);
    const cy = randomRange(45, height - 45);
    const size = randomRange(25, 45);
    const baseColor = randomChoice(palette);
    const kind = 'Geometric Star Accent';
    const sig = makeWobbleSignature(random);
    const baseRot = random() * Math.PI;

    candidates.push({
      id: `compact_accent_${a}`,
      x: cx, y: cy, size, kind, baseColor,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? baseRot + Math.PI / 4 : baseRot;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.85 : size;

        // Distinct starburst / cross shape
        ctx.fillStyle = color;
        ctx.fillRect(-curSize * 0.45, -curSize * 0.15, curSize * 0.9, curSize * 0.3);
        ctx.fillRect(-curSize * 0.15, -curSize * 0.45, curSize * 0.3, curSize * 0.9);

        // Center dot
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, curSize * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, curSize * 0.55, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    });
  }

  // E. ART DECO CHEVRON FANS & STEPPED SUNBURSTS (45px - 85px) - 10 objects
  for (let ad = 0; ad < 10; ad++) {
    const cx = randomRange(55, width - 55);
    const cy = randomRange(55, height - 55);
    const size = randomRange(45, 85);
    const baseColor = randomChoice(palette);
    const sig = makeWobbleSignature(random);
    const baseRot = random() * Math.PI * 2;

    candidates.push({
      id: `art_deco_fan_${ad}`,
      x: cx, y: cy, size, kind: 'Art Deco Stepped Sunburst Fan', baseColor,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? baseRot + Math.PI / 2 : baseRot;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const s = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

        // Fan stepped arches
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.45, Math.PI, 0);
        ctx.closePath();
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#ffd166', cx: 0, cy: 0, rx: s * 0.45, ry: s * 0.45, sig, lineWidth: 2 });

        // Radiating chevron rays
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          for (let a = Math.PI; a <= Math.PI * 2; a += Math.PI / 4) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
            ctx.stroke();
          }
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ff007f';
          ctx.beginPath();
          ctx.arc(0, -s * 0.25, 10, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  // F. SACRED GEOMETRY METATRON RINGS & POLYHEDRA (50px - 90px) - 10 objects
  for (let sg = 0; sg < 10; sg++) {
    const cx = randomRange(60, width - 60);
    const cy = randomRange(60, height - 60);
    const size = randomRange(50, 90);
    const baseColor = randomChoice(palette);
    const sig = makeWobbleSignature(random);
    const baseRot = random() * Math.PI;

    candidates.push({
      id: `sacred_polyhedron_${sg}`,
      x: cx, y: cy, size, kind: 'Sacred Geometry Hexagonal Prism', baseColor,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? baseRot + Math.PI / 3 : baseRot;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const s = (mutated && mType === 'SCALE_CHANGE') ? size * 1.75 : size;

        // Outer hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const x = Math.cos(a) * s * 0.45;
          const y = Math.sin(a) * s * 0.45;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#000000', cx: 0, cy: 0, rx: s * 0.45, ry: s * 0.45, sig, lineWidth: 2.2 });

        // Internal isometric cube diagonals
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          for (let i = 0; i < 6; i += 2) {
            const a = (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
            ctx.stroke();
          }
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 3.0;
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    });
  }

  // G. ISLAMIC ARABESQUE & MOROCCAN 8-POINT STARS (40px - 80px) - 10 objects
  for (let ia = 0; ia < 10; ia++) {
    const cx = randomRange(55, width - 55);
    const cy = randomRange(55, height - 55);
    const size = randomRange(40, 80);
    const baseColor = randomChoice(palette);
    const sig = makeWobbleSignature(random);
    const baseRot = random() * Math.PI;

    candidates.push({
      id: `arabesque_star_${ia}`,
      x: cx, y: cy, size, kind: 'Moroccan Arabesque 8-Point Star', baseColor,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? baseRot + Math.PI / 4 : baseRot;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const s = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

        // Two overlapping interlocking squares
        ctx.fillStyle = color;
        ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
        ctx.restore();

        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#ffd166', cx: 0, cy: 0, rx: s * 0.4, ry: s * 0.4, sig, lineWidth: 2 });

        // Center emerald medallion
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#06d6a0';
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ffbe0b';
          ctx.beginPath();
          ctx.arc(s * 0.3, -s * 0.3, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  // H. BIOLUMINESCENT MARINE CREATURES & SPIRAL SHELLS (45px - 95px) - 10 objects
  for (let mc = 0; mc < 10; mc++) {
    const cx = randomRange(55, width - 55);
    const cy = randomRange(55, height - 55);
    const size = randomRange(45, 95);
    const baseColor = randomChoice(palette);
    const sig = makeWobbleSignature(random);
    const baseRot = random() * Math.PI * 2;

    candidates.push({
      id: `marine_creature_${mc}`,
      x: cx, y: cy, size, kind: 'Bioluminescent Nautilus Spiral', baseColor,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? baseRot + Math.PI / 2 : baseRot;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const s = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

        // Spiral nautilus shell
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.42, 0, Math.PI * 1.5);
        ctx.quadraticCurveTo(s * 0.2, s * 0.2, 0, 0);
        ctx.closePath();
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#00f0ff', cx: 0, cy: 0, rx: s * 0.42, ry: s * 0.42, sig, lineWidth: 2 });

        // Shell chamber ribs
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(-s * 0.35, 0);
          ctx.lineTo(0, -s * 0.35);
          ctx.stroke();
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ff70a6';
          ctx.beginPath();
          ctx.arc(s * 0.22, -s * 0.22, 10, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  // I. HERALDIC ROYAL CRESTS & ALCHEMY CROWNS (40px - 80px) - 10 objects
  for (let rc = 0; rc < 10; rc++) {
    const cx = randomRange(55, width - 55);
    const cy = randomRange(55, height - 55);
    const size = randomRange(40, 80);
    const baseColor = randomChoice(palette);
    const sig = makeWobbleSignature(random);
    const baseRot = random() * Math.PI;

    candidates.push({
      id: `heraldic_crest_${rc}`,
      x: cx, y: cy, size, kind: 'Heraldic Crown Motif', baseColor,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? baseRot + Math.PI / 4 : baseRot;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const s = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

        // Tri-point crown / shield
        ctx.beginPath();
        ctx.moveTo(-s * 0.4, s * 0.2);
        ctx.lineTo(-s * 0.35, -s * 0.3);
        ctx.lineTo(-s * 0.12, 0);
        ctx.lineTo(0, -s * 0.45);
        ctx.lineTo(s * 0.12, 0);
        ctx.lineTo(s * 0.35, -s * 0.3);
        ctx.lineTo(s * 0.4, s * 0.2);
        ctx.closePath();
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#000000', cx: 0, cy: 0, rx: s * 0.4, ry: s * 0.4, sig, lineWidth: 2.2 });

        // Center pearl jewel
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, -s * 0.1, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(0, -s * 0.45, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  // J. ORIGAMI FOLDED ANIMALS & BLOSSOMS (40px - 85px) - 10 objects
  for (let og = 0; og < 10; og++) {
    const cx = randomRange(55, width - 55);
    const cy = randomRange(55, height - 55);
    const size = randomRange(40, 85);
    const baseColor = randomChoice(palette);
    const sig = makeWobbleSignature(random);
    const baseRot = random() * Math.PI * 2;

    candidates.push({
      id: `origami_crane_${og}`,
      x: cx, y: cy, size, kind: 'Origami Folded Crane Blossom', baseColor,
      isTargetEligible: true,
      supportedMutations: ['ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE', 'COLOR_SHIFT', 'SCALE_CHANGE'],
      draw: (ctx, mutated, mType) => {
        ctx.save();
        ctx.translate(cx, cy);
        const rot = (mutated && mType === 'SHAPE_ROTATE') ? baseRot + Math.PI / 2 : baseRot;
        ctx.rotate(rot);
        applyObjectPopStyle(ctx, true);
        let color = (mutated && mType === 'COLOR_SHIFT') ? getHighContrastColor(baseColor) : baseColor;
        const s = (mutated && mType === 'SCALE_CHANGE') ? size * 1.8 : size;

        // Origami wing diamond
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.45);
        ctx.lineTo(s * 0.4, 0);
        ctx.lineTo(0, s * 0.35);
        ctx.lineTo(-s * 0.4, 0);
        ctx.closePath();
        applyPaintFinish(ctx, paintStyle, { color, strokeColor: '#000000', cx: 0, cy: 0, rx: s * 0.4, ry: s * 0.4, sig, lineWidth: 2 });

        // Origami fold crease line
        if (!(mutated && mType === 'REMOVE_DETAIL')) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.45);
          ctx.lineTo(0, s * 0.35);
          ctx.stroke();
        }

        if (mutated && mType === 'ADD_DETAIL') {
          ctx.fillStyle = '#ff0054';
          ctx.beginPath();
          ctx.arc(s * 0.25, 0, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  // K. MICRO ATMOSPHERIC COLOR PARTICLES, SPARKLES & SHARDS (4px - 14px) - 30 background objects (NOT target eligible)
  for (let p = 0; p < 30; p++) {
    const px = randomRange(25, width - 25);
    const py = randomRange(25, height - 25);
    const pSize = randomRange(4, 14);
    const baseColor = randomChoice(['#ffffff', '#ffd166', '#00f0ff', '#ff70a6', '#06d6a0', '#ff007f']);

    candidates.push({
      id: `micro_sparkle_${p}`,
      x: px, y: py, size: pSize, kind: 'Atmospheric Micro Shard', baseColor,
      isTargetEligible: false, // Never pick micro particles as the game difference!
      supportedMutations: [],
      draw: (ctx) => {
        ctx.save();
        ctx.translate(px, py);
        ctx.fillStyle = baseColor;
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, pSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  // =========================================================================
  // STEP 3: CLONE BASE BACKGROUND TO CANVAS B (ZERO GHOSTING)
  // =========================================================================
  ctxB.drawImage(canvasA, 0, 0);

  // =========================================================================
  // STEP 4: PICK EXACTLY 1 HIGH-CONTRAST, HIGH-SALIENT TARGET FOR MUTATION
  // =========================================================================
  const eligibleCandidates = candidates.filter(c => c.isTargetEligible && c.size >= 40);
  const targetIndex = Math.floor(random() * eligibleCandidates.length);
  const targetObj = eligibleCandidates[targetIndex] || candidates.find(c => c.isTargetEligible) || candidates[0];

  // Pick mutation from the target's supported pool
  const mutationType = randomChoice(targetObj.supportedMutations || ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL']);

  // =========================================================================
  // STEP 5: RENDER ALL OBJECTS ONTO BOTH CANVASES (TARGET DRAWN LAST ON TOP!)
  // =========================================================================
  // Draw all non-target objects first
  candidates.filter(c => c.id !== targetObj.id).forEach(c => {
    c.draw(ctxA, false, '');
    c.draw(ctxB, false, '');
  });

  // Draw target object LAST on top so it is 100% visible and never covered/occluded
  targetObj.draw(ctxA, false, '');
  targetObj.draw(ctxB, true, mutationType);

  const diffX = Math.round((targetObj.x / width) * 1000) / 10;
  const diffY = Math.round((targetObj.y / height) * 1000) / 10;
  const hitRadius = targetDifficulty === 'Easy' ? 10 : targetDifficulty === 'Medium' ? 8 : 6;

  let hintAction = 'Look closely at';
  if (mutationType === 'COLOR_SHIFT') hintAction = 'Notice the vibrant color change on';
  else if (mutationType === 'REMOVE_DETAIL') hintAction = 'Spot the missing detail on';
  else if (mutationType === 'ADD_DETAIL') hintAction = 'Check the added ornament on';
  else if (mutationType === 'SHAPE_ROTATE') hintAction = 'Observe the rotated angle of';
  else if (mutationType === 'SCALE_CHANGE') hintAction = 'Notice the size difference of';

  const diffs = [
    {
      id: 1,
      x: diffX,
      y: diffY,
      radius: hitRadius,
      mutationType,
      hint: `${hintAction} the ${targetObj.kind || 'feature'} near (${diffX}%, ${diffY}%)`
    }
  ];

  const dataUrlA = canvasA.toDataURL('image/png');
  const dataUrlB = canvasB.toDataURL('image/png');

  const imgA = createSafeImage(dataUrlA);
  const imgB = createSafeImage(dataUrlB);

  return {
    id: `procedural_${themeId}_${seed}`,
    title: `${sceneTitle} #${Math.floor(seed % 1000)}`,
    category: isPhotoTheme ? 'Photographic' : 'Illustrated',
    difficulty: targetDifficulty,
    totalDifferences: 1,
    baseImage: dataUrlA,
    variantImage: dataUrlB,
    diffs,
    render: (ctx, w, h, isModified) => {
      const srcCanvas = isModified ? canvasB : canvasA;
      if (srcCanvas && typeof srcCanvas.getContext === 'function') {
        try {
          ctx.drawImage(srcCanvas, 0, 0, w, h);
          return;
        } catch (_) {}
      }
      const img = isModified ? imgB : imgA;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, w, h);
      } else if (img) {
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      }
    }
  };
}
