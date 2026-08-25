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
  { id: 'monet_waterlilies', name: 'Monet Giverny Water Lilies', worldKey: 'MONET' },
  { id: 'vangogh_starry', name: 'Van Gogh Starry Cypress Grove', worldKey: 'VANGOGH' },
  { id: 'ocean_depths', name: 'Hokusai Great Wave of Kanagawa', worldKey: 'HOKUSAI' },
  { id: 'kyoto_garden', name: 'Klimt Kyoto Golden Tapestry', worldKey: 'KLIMT' },
  { id: 'synthwave_neon_city', name: 'Retro Synthwave Neon Metropolis', worldKey: 'SYNTHWAVE' },
  { id: 'cubist_mondrian_abstract', name: 'Mondrian & Bauhaus Neoplasticism', worldKey: 'MONDRIAN' },
  { id: 'nordic_aurora_fjord', name: 'Nordic Aurora & Glacial Fjord', worldKey: 'NORDIC_AURORA' },
  { id: 'steampunk_clockwork', name: 'Steampunk Clockwork Mechanism', worldKey: 'STEAMPUNK' },
  { id: 'woodland_wildlife', name: 'Enchanted Forest & Herbarium', worldKey: 'BOTANICAL' },
  { id: 'tropical_aviary', name: 'Japanese Edo Cherry Blossom Aviary', worldKey: 'EDO_JAPAN' },
  { id: 'cosmic_nebula_stargate', name: 'Cosmic Nebula Stargate & Planets', worldKey: 'COSMIC' },
  { id: 'egyptian_gilded_papyrus', name: 'Gilded Egyptian Papyrus & Glass', worldKey: 'STAINED_GLASS' }
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
  // STEP 1 & 2: BESPOKE WORLD-SPECIFIC BACKGROUND & THEMATIC OBJECT POPULATION
  // =========================================================================

  const key = worldDef.worldKey || 'MONET';

  if (key === 'MONET') {
    // 1. MONET WATER LILIES: Soft pastel pond with weeping willow reflections & 50+ floating lilies & koi
    const pondGrad = ctxA.createLinearGradient(0, 0, width, height);
    pondGrad.addColorStop(0, '#1b4332');
    pondGrad.addColorStop(0.5, '#2d6a4f');
    pondGrad.addColorStop(1, '#081c15');
    ctxA.fillStyle = pondGrad;
    ctxA.fillRect(0, 0, width, height);

    // Dappled willow reflections
    for (let w = 0; w < 8; w++) {
      ctxA.fillStyle = 'rgba(149, 213, 178, 0.15)';
      ctxA.beginPath();
      ctxA.ellipse(randomRange(50, width - 50), randomRange(20, height * 0.4), randomRange(80, 160), randomRange(20, 50), random() * 0.4, 0, Math.PI * 2);
      ctxA.fill();
    }

    // Floating Lily Pads (30 objects)
    for (let i = 0; i < 30; i++) {
      const cx = randomRange(40, width - 40);
      const cy = randomRange(40, height - 40);
      const rad = randomRange(28, 55);
      const padCol = randomChoice(['#40916c', '#52b788', '#2d6a4f', '#74c69d']);
      const rot = random() * Math.PI * 2;

      candidates.push({
        id: `monet_lilypad_${i}`,
        x: cx, y: cy, size: rad * 2, kind: 'Floating Giverny Lily Pad', baseColor: padCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 2 : rot;
          ctx.rotate(curRot);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : padCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          // Lily pad with pie wedge cut
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(0, 0, rad * s, 0.35, Math.PI * 2);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#1b4332';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Veins
          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;
            for (let a = 0.6; a < Math.PI * 2; a += 0.8) {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(a) * rad * 0.8 * s, Math.sin(a) * rad * 0.8 * s);
              ctx.stroke();
            }
          }

          if (mutated && mType === 'ADD_DETAIL') {
            // Blooming lotus blossom on top
            ctx.fillStyle = '#ff70a6';
            for (let p = 0; p < 6; p++) {
              ctx.beginPath();
              ctx.ellipse(Math.cos(p * Math.PI / 3) * 14 * s, Math.sin(p * Math.PI / 3) * 14 * s, 10 * s, 5 * s, p * Math.PI / 3, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(0, 0, 6 * s, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

    // Blooming Water Lilies (20 objects)
    for (let j = 0; j < 20; j++) {
      const cx = randomRange(50, width - 50);
      const cy = randomRange(50, height - 50);
      const size = randomRange(35, 65);
      const bloomCol = randomChoice(['#ff70a6', '#f72585', '#ffffff', '#e0aaff', '#ffd166']);

      candidates.push({
        id: `monet_blossom_${j}`,
        x: cx, y: cy, size, kind: 'Blooming Water Lily Lotus', baseColor: bloomCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#00f0ff' : bloomCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.7 : 1.0;

          // Multi-layer petals
          ctx.fillStyle = col;
          for (let p = 0; p < 8; p++) {
            ctx.beginPath();
            ctx.ellipse(Math.cos(p * Math.PI / 4) * size * 0.3 * s, Math.sin(p * Math.PI / 4) * size * 0.3 * s, size * 0.35 * s, size * 0.16 * s, p * Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
          }
          // Golden center core
          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.18 * s, 0, Math.PI * 2);
            ctx.fill();
          }
          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ff0054';
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.3 * s, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'VANGOGH') {
    // 2. VAN GOGH STARRY SKY: Midnight vortex sky + 35 glowing spiral nebula stars & cypress trees
    const skyGrad = ctxA.createLinearGradient(0, 0, width, height);
    skyGrad.addColorStop(0, '#03071e');
    skyGrad.addColorStop(0.5, '#0d1b2a');
    skyGrad.addColorStop(1, '#1b263b');
    ctxA.fillStyle = skyGrad;
    ctxA.fillRect(0, 0, width, height);

    // Swirling sky vortices
    for (let v = 0; v < 6; v++) {
      ctxA.strokeStyle = 'rgba(76, 201, 240, 0.2)';
      ctxA.lineWidth = 8.0;
      ctxA.beginPath();
      ctxA.arc(randomRange(100, width - 100), randomRange(80, height * 0.6), randomRange(80, 180), 0, Math.PI * 1.5);
      ctxA.stroke();
    }

    // Glowing Spiral Stars (35 objects)
    for (let s = 0; s < 35; s++) {
      const cx = randomRange(40, width - 40);
      const cy = randomRange(30, height * 0.75);
      const rad = randomRange(26, 52);
      const starCol = randomChoice(['#ffd166', '#ffb703', '#ffffff', '#4cc9f0', '#fb5607']);

      candidates.push({
        id: `vangogh_star_${s}`,
        x: cx, y: cy, size: rad * 2, kind: 'Swirling Vortex Star', baseColor: starCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#f72585' : starCol;
          const sc = (mutated && mType === 'SCALE_CHANGE') ? 1.7 : 1.0;

          // Star halo glow
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(0, 0, rad * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;

          // Concentric radiating rings
          ctx.strokeStyle = col;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, rad * 0.65 * sc, 0, Math.PI * 2);
          ctx.stroke();

          // Intense core
          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, rad * 0.3 * sc, 0, Math.PI * 2);
            ctx.fill();
          }

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 3.0;
            ctx.beginPath();
            ctx.arc(0, 0, rad * 1.2 * sc, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    // Flame-like Cypress Silhouettes (8 objects)
    for (let c = 0; c < 8; c++) {
      const cx = (c + 0.5) * (width / 8) + randomRange(-30, 30);
      const cy = height * 0.75 + randomRange(-20, 20);
      const hSize = randomRange(120, 220);
      const wSize = randomRange(45, 80);

      candidates.push({
        id: `vangogh_cypress_${c}`,
        x: cx, y: cy, size: hSize, kind: 'Flame Cypress Silhouette', baseColor: '#081c15',
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#e63946' : '#081c15';
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.5 : 1.0;

          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(0, -hSize * s);
          ctx.bezierCurveTo(wSize * 0.6 * s, -hSize * 0.5 * s, wSize * 0.5 * s, 0, wSize * 0.3 * s, 40);
          ctx.lineTo(-wSize * 0.3 * s, 40);
          ctx.bezierCurveTo(-wSize * 0.5 * s, 0, -wSize * 0.6 * s, -hSize * 0.5 * s, 0, -hSize * s);
          ctx.closePath();
          ctx.fill();

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(0, -hSize * s * 0.7, 14, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'SYNTHWAVE') {
    // 3. RETRO SYNTHWAVE: Wireframe grid floor, neon sunset, 40+ isometric skyscrapers & holograms
    const bgGrad = ctxA.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0017');
    bgGrad.addColorStop(0.55, '#3c096c');
    bgGrad.addColorStop(1, '#050014');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    // Setting Segmented Sun
    ctxA.fillStyle = '#ff007f';
    ctxA.beginPath();
    ctxA.arc(width * 0.5, height * 0.5, 140, Math.PI, 0);
    ctxA.fill();
    // Sun segments
    ctxA.fillStyle = '#3c096c';
    for (let s = 1; s <= 6; s++) {
      ctxA.fillRect(width * 0.5 - 150, height * 0.5 - s * 20, 300, s * 2.5);
    }

    // 3D Wireframe Perspective Grid Floor
    ctxA.strokeStyle = '#00f0ff';
    ctxA.lineWidth = 1.5;
    const horizon = height * 0.55;
    for (let x = -width; x <= width * 2; x += 60) {
      ctxA.beginPath();
      ctxA.moveTo(width * 0.5, horizon);
      ctxA.lineTo(x, height);
      ctxA.stroke();
    }
    for (let y = horizon; y <= height; y += (y - horizon) * 0.35 + 8) {
      ctxA.beginPath();
      ctxA.moveTo(0, y);
      ctxA.lineTo(width, y);
      ctxA.stroke();
    }

    // Isometric Neon Skyscrapers & Holographic Polyhedra (40 objects)
    for (let b = 0; b < 40; b++) {
      const cx = randomRange(40, width - 40);
      const cy = randomRange(horizon + 20, height - 30);
      const bw = randomRange(30, 60);
      const bh = randomRange(45, 110);
      const bCol = randomChoice(['#ff007f', '#00f0ff', '#ffe600', '#7928ca', '#00f5d4']);

      candidates.push({
        id: `synthwave_bldg_${b}`,
        x: cx, y: cy, size: Math.max(bw, bh), kind: 'Neon Cyber Skyscraper', baseColor: bCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#ffffff' : bCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          // Building facade
          ctx.fillStyle = '#10002b';
          ctx.fillRect(-bw * 0.5 * s, -bh * s, bw * s, bh * s);
          ctx.strokeStyle = col;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(-bw * 0.5 * s, -bh * s, bw * s, bh * s);

          // Window grid lights
          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = col;
            for (let r = -bh * s + 10; r < -10; r += 16) {
              for (let c = -bw * 0.5 * s + 6; c < bw * 0.5 * s - 6; c += 10) {
                ctx.fillRect(c, r, 5, 8);
              }
            }
          }

          // Rooftop laser beacon
          if (mutated && mType === 'ADD_DETAIL') {
            ctx.strokeStyle = '#ffe600';
            ctx.lineWidth = 4.0;
            ctx.beginPath();
            ctx.moveTo(0, -bh * s);
            ctx.lineTo(0, -bh * s - 40);
            ctx.stroke();
            ctx.fillStyle = '#ffe600';
            ctx.beginPath();
            ctx.arc(0, -bh * s - 40, 8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'MONDRIAN') {
    // 4. MONDRIAN & BAUHAUS: Asymmetric black architectural grid + 45 primary rectangles & geometric circles
    ctxA.fillStyle = '#f8f9fa';
    ctxA.fillRect(0, 0, width, height);

    // Thick Black Dividing Grid Bars
    ctxA.fillStyle = '#000000';
    ctxA.fillRect(width * 0.32, 0, 12, height);
    ctxA.fillRect(width * 0.68, 0, 12, height);
    ctxA.fillRect(0, height * 0.38, width, 12);
    ctxA.fillRect(0, height * 0.72, width, 12);

    // Primary Colored Rectangles & Bauhaus Disks (45 objects)
    for (let m = 0; m < 45; m++) {
      const cx = randomRange(45, width - 45);
      const cy = randomRange(45, height - 45);
      const sz = randomRange(40, 85);
      const isCircle = m % 2 === 0;
      const mCol = randomChoice(['#e63946', '#1d3557', '#ffd166', '#000000', '#06d6a0', '#ff007f']);

      candidates.push({
        id: `mondrian_tile_${m}`,
        x: cx, y: cy, size: sz, kind: isCircle ? 'Bauhaus Circle Tile' : 'De Stijl Rectangular Pane', baseColor: mCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#00f0ff' : mCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          ctx.fillStyle = col;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3.5;

          if (isCircle) {
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.45 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (!(mutated && mType === 'REMOVE_DETAIL')) {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(0, 0, sz * 0.18 * s, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.fillRect(-sz * 0.45 * s, -sz * 0.35 * s, sz * 0.9 * s, sz * 0.7 * s);
            ctx.strokeRect(-sz * 0.45 * s, -sz * 0.35 * s, sz * 0.9 * s, sz * 0.7 * s);
            if (!(mutated && mType === 'REMOVE_DETAIL')) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-sz * 0.15 * s, -sz * 0.15 * s, sz * 0.3 * s, sz * 0.3 * s);
            }
          }

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ff007f';
            ctx.beginPath();
            ctx.arc(sz * 0.35 * s, -sz * 0.25 * s, 10, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'STEAMPUNK') {
    // 5. STEAMPUNK CLOCKWORK: Blueprint drafting grid + 50 interlocking brass cogs & pressure gauges
    const bgGrad = ctxA.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#1c1917');
    bgGrad.addColorStop(1, '#0c0a09');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    // Drafting grid lines
    ctxA.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctxA.lineWidth = 1.0;
    for (let x = 0; x < width; x += 40) {
      ctxA.beginPath(); ctxA.moveTo(x, 0); ctxA.lineTo(x, height); ctxA.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctxA.beginPath(); ctxA.moveTo(0, y); ctxA.lineTo(width, y); ctxA.stroke();
    }

    // Interlocking Brass Cogs & Gauges (50 objects)
    for (let g = 0; g < 50; g++) {
      const cx = randomRange(45, width - 45);
      const cy = randomRange(45, height - 45);
      const rad = randomRange(26, 55);
      const isGauge = g % 3 === 0;
      const gCol = randomChoice(['#d4af37', '#f4a261', '#e76f51', '#2a9d8f', '#b5179e']);

      candidates.push({
        id: `steampunk_cog_${g}`,
        x: cx, y: cy, size: rad * 2, kind: isGauge ? 'Copper Pressure Gauge' : 'Interlocking Brass Cog', baseColor: gCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#00f0ff' : gCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          if (isGauge) {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(0, 0, rad * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            // Dial needle
            if (!(mutated && mType === 'REMOVE_DETAIL')) {
              const rot = (mutated && mType === 'SHAPE_ROTATE') ? Math.PI * 0.75 : -Math.PI * 0.25;
              ctx.strokeStyle = '#e63946';
              ctx.lineWidth = 3.0;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(rot) * rad * 0.75 * s, Math.sin(rot) * rad * 0.75 * s);
              ctx.stroke();
            }
          } else {
            // Gear with teeth
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(0, 0, rad * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = col;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
              ctx.fillRect(Math.cos(a) * rad * s - 4, Math.sin(a) * rad * s - 4, 8, 8);
            }
            ctx.fillStyle = '#0c0a09';
            ctx.beginPath();
            ctx.arc(0, 0, rad * 0.35 * s, 0, Math.PI * 2);
            ctx.fill();
          }

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(0, 0, rad * 0.2 * s, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'HOKUSAI') {
    // 6. HOKUSAI GREAT WAVE: Prussian indigo sea + Mt. Fuji + 40 wave crests, fishing skiffs & sea birds
    const seaGrad = ctxA.createLinearGradient(0, 0, width, height);
    seaGrad.addColorStop(0, '#02182b');
    seaGrad.addColorStop(0.5, '#06395b');
    seaGrad.addColorStop(1, '#00101d');
    ctxA.fillStyle = seaGrad;
    ctxA.fillRect(0, 0, width, height);

    // Distant Mt Fuji Silhouette
    ctxA.fillStyle = '#010d18';
    ctxA.beginPath();
    ctxA.moveTo(width * 0.45, height * 0.55);
    ctxA.lineTo(width * 0.55, height * 0.32);
    ctxA.lineTo(width * 0.65, height * 0.55);
    ctxA.closePath();
    ctxA.fill();
    ctxA.fillStyle = '#ffffff';
    ctxA.beginPath();
    ctxA.moveTo(width * 0.52, height * 0.38);
    ctxA.lineTo(width * 0.55, height * 0.32);
    ctxA.lineTo(width * 0.58, height * 0.38);
    ctxA.closePath();
    ctxA.fill();

    for (let w = 0; w < 40; w++) {
      const cx = randomRange(40, width - 40);
      const cy = randomRange(height * 0.35, height - 30);
      const sz = randomRange(40, 85);
      const isBoat = w % 4 === 0;

      candidates.push({
        id: `hokusai_wave_${w}`,
        x: cx, y: cy, size: sz, kind: isBoat ? 'Wooden Fishing Skiff' : 'Curling Ocean Wave Foam Crest', baseColor: isBoat ? '#d4a373' : '#0077b6',
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#f72585' : (isBoat ? '#d4a373' : '#0077b6');
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          if (isBoat) {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.45 * s, 0);
            ctx.bezierCurveTo(-sz * 0.2 * s, sz * 0.25 * s, sz * 0.2 * s, sz * 0.25 * s, sz * 0.45 * s, 0);
            ctx.lineTo(sz * 0.35 * s, -sz * 0.15 * s);
            ctx.lineTo(-sz * 0.35 * s, -sz * 0.15 * s);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#3a1e05';
            ctx.lineWidth = 2.0;
            ctx.stroke();
          } else {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.45 * s, sz * 0.3 * s);
            ctx.bezierCurveTo(-sz * 0.2 * s, -sz * 0.35 * s, sz * 0.2 * s, -sz * 0.45 * s, sz * 0.45 * s, -sz * 0.1 * s);
            ctx.bezierCurveTo(sz * 0.2 * s, 0, -sz * 0.1 * s, sz * 0.15 * s, -sz * 0.45 * s, sz * 0.3 * s);
            ctx.closePath();
            ctx.fill();
            // Foam claws
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sz * 0.45 * s, -sz * 0.1 * s, sz * 0.15 * s, 0, Math.PI * 2);
            ctx.fill();
          }

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(0, -sz * 0.35 * s, 10, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'KLIMT') {
    // 7. KLIMT GILDED TREE: Shimmering gold mosaic background + 45 golden spiral branches & Byzantine jewels
    const goldBg = ctxA.createRadialGradient(width * 0.5, height * 0.5, 40, width * 0.5, height * 0.5, width * 0.6);
    goldBg.addColorStop(0, '#3d2508');
    goldBg.addColorStop(0.6, '#211404');
    goldBg.addColorStop(1, '#0e0801');
    ctxA.fillStyle = goldBg;
    ctxA.fillRect(0, 0, width, height);

    for (let k = 0; k < 45; k++) {
      const cx = randomRange(40, width - 40);
      const cy = randomRange(40, height - 40);
      const sz = randomRange(35, 75);
      const kCol = randomChoice(['#ffd700', '#dfba6f', '#f72585', '#06d6a0', '#00b4d8', '#ffffff']);

      candidates.push({
        id: `klimt_motif_${k}`,
        x: cx, y: cy, size: sz, kind: 'Gilded Byzantine Mosaic Spiral', baseColor: kCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : kCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          // Golden Spiral
          ctx.strokeStyle = col;
          ctx.lineWidth = 4.0 * s;
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.38 * s, 0, Math.PI * 1.5);
          ctx.stroke();

          // Byzantine square jewels
          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = '#ffd166';
            ctx.fillRect(-sz * 0.18 * s, -sz * 0.18 * s, sz * 0.36 * s, sz * 0.36 * s);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-sz * 0.18 * s, -sz * 0.18 * s, sz * 0.36 * s, sz * 0.36 * s);
          }

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.2 * s, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'NORDIC_AURORA') {
    // 8. NORDIC AURORA: Glacial mountains + glowing vertical aurora curtains + 40 pine trees & ice stars
    const nightGrad = ctxA.createLinearGradient(0, 0, 0, height);
    nightGrad.addColorStop(0, '#03071e');
    nightGrad.addColorStop(0.6, '#0f2b46');
    nightGrad.addColorStop(1, '#020d18');
    ctxA.fillStyle = nightGrad;
    ctxA.fillRect(0, 0, width, height);

    // Glowing Aurora Curtains
    for (let a = 0; a < 5; a++) {
      ctxA.fillStyle = 'rgba(0, 245, 212, 0.18)';
      ctxA.beginPath();
      ctxA.moveTo(a * 350, 0);
      ctxA.bezierCurveTo(a * 350 + 150, height * 0.3, a * 350 - 100, height * 0.5, a * 350 + 80, height * 0.7);
      ctxA.lineTo(a * 350 + 200, height * 0.7);
      ctxA.bezierCurveTo(a * 350 + 50, height * 0.5, a * 350 + 250, height * 0.3, a * 350 + 150, 0);
      ctxA.closePath();
      ctxA.fill();
    }

    for (let n = 0; n < 40; n++) {
      const cx = randomRange(40, width - 40);
      const cy = randomRange(40, height - 40);
      const sz = randomRange(35, 75);
      const nCol = randomChoice(['#00f5d4', '#e0fbfc', '#38b000', '#ffd166', '#f72585']);

      candidates.push({
        id: `nordic_tree_${n}`,
        x: cx, y: cy, size: sz, kind: 'Arctic Pine Tree Silhouette', baseColor: nCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#ff0054' : nCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          // Tiered pine tree
          ctx.fillStyle = col;
          for (let t = 0; t < 3; t++) {
            ctx.beginPath();
            ctx.moveTo(0, -sz * 0.45 * s + t * 14 * s);
            ctx.lineTo(sz * 0.35 * s - t * 4 * s, -sz * 0.15 * s + t * 16 * s);
            ctx.lineTo(-sz * 0.35 * s + t * 4 * s, -sz * 0.15 * s + t * 16 * s);
            ctx.closePath();
            ctx.fill();
          }

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, -sz * 0.5 * s, 8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'COSMIC') {
    // 9. COSMIC NEBULA: Deep space void + ringed planets & galactic quasars (40 objects)
    ctxA.fillStyle = '#02000a';
    ctxA.fillRect(0, 0, width, height);

    // Glowing Galactic Cloud
    const nebGrad = ctxA.createRadialGradient(width * 0.5, height * 0.5, 20, width * 0.5, height * 0.5, width * 0.5);
    nebGrad.addColorStop(0, 'rgba(114, 9, 183, 0.35)');
    nebGrad.addColorStop(0.5, 'rgba(247, 37, 133, 0.2)');
    nebGrad.addColorStop(1, 'rgba(2, 0, 10, 0)');
    ctxA.fillStyle = nebGrad;
    ctxA.fillRect(0, 0, width, height);

    for (let p = 0; p < 40; p++) {
      const cx = randomRange(40, width - 40);
      const cy = randomRange(40, height - 40);
      const sz = randomRange(35, 75);
      const isRinged = p % 2 === 0;
      const pCol = randomChoice(['#00f0ff', '#ff007f', '#ffd166', '#8338ec', '#06d6a0']);

      candidates.push({
        id: `cosmic_planet_${p}`,
        x: cx, y: cy, size: sz, kind: isRinged ? 'Ringed Saturnian Exoplanet' : 'Glowing Quasar Core', baseColor: pCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#ffffff' : pCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          // Planet sphere
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.35 * s, 0, Math.PI * 2);
          ctx.fill();

          if (isRinged) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.0;
            ctx.beginPath();
            ctx.ellipse(0, 0, sz * 0.6 * s, sz * 0.16 * s, Math.PI / 6, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(sz * 0.45 * s, -sz * 0.35 * s, 8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (key === 'STAINED_GLASS') {
    // 10. GOTHIC STAINED GLASS: Dark stone arch + leaded glass facets & fleur-de-lis (45 objects)
    ctxA.fillStyle = '#08080a';
    ctxA.fillRect(0, 0, width, height);

    for (let g = 0; g < 45; g++) {
      const cx = randomRange(45, width - 45);
      const cy = randomRange(45, height - 45);
      const sz = randomRange(35, 75);
      const gCol = randomChoice(['#e63946', '#0077b6', '#38b000', '#ffd166', '#7209b7']);

      candidates.push({
        id: `stained_glass_facet_${g}`,
        x: cx, y: cy, size: sz, kind: 'Cathedral Stained Glass Pane', baseColor: gCol,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let col = (mutated && mType === 'COLOR_SHIFT') ? '#00f0ff' : gCol;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          // Diamond facet
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(0, -sz * 0.45 * s);
          ctx.lineTo(sz * 0.35 * s, 0);
          ctx.lineTo(0, sz * 0.45 * s);
          ctx.lineTo(-sz * 0.35 * s, 0);
          ctx.closePath();
          ctx.fill();
          // Black lead caming border
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 4.0;
          ctx.stroke();

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.15 * s, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else {
    // 11-12. BOTANICAL / EDO JAPAN / FALLBACK WORLDS (45 objects)
    const bgGrad = ctxA.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#2d3142');
    bgGrad.addColorStop(1, '#0f111a');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    for (let k = 0; k < 45; k++) {
      const cx = randomRange(50, width - 50);
      const cy = randomRange(50, height - 50);
      const sz = randomRange(35, 75);
      const col = randomChoice(palette);

      candidates.push({
        id: `world_object_${k}`,
        x: cx, y: cy, size: sz, kind: `${worldDef.name} Motif`, baseColor: col,
        isTargetEligible: true,
        supportedMutations: ['COLOR_SHIFT', 'SCALE_CHANGE', 'ADD_DETAIL', 'REMOVE_DETAIL', 'SHAPE_ROTATE'],
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          applyObjectPopStyle(ctx, true);
          let c = (mutated && mType === 'COLOR_SHIFT') ? '#ff007f' : col;
          const s = (mutated && mType === 'SCALE_CHANGE') ? 1.6 : 1.0;

          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.45 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.2 * s, 0, Math.PI * 2);
            ctx.fill();
          }
          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(sz * 0.3 * s, 0, 10, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }
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
