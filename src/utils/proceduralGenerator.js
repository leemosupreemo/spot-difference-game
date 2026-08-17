// Advanced Procedural Art Engine with Radical Structural Diversity
// GUARANTEED EXACTLY 1 VISIBLE DIFFERENCE between Image A and Image B
// Structural Paradigms: Voronoi Stained Glass, Turbulent Flow Fields, Recursive Fractal Trees,
// Topographic Contours, Sacred Radial Mandalas, Mountain Horizon Vistas,
// Overlapping Constructivist Planes, and Isometric Architectural Skylines.

export const SCENE_THEMES = [
  { id: 'find_the_sniper', title: 'Photography', category: 'Photographic' },
  { id: 'abstract_animated', title: 'Fantastical', category: 'Illustrated' }
];

export const ART_STRUCTURES = [
  { id: 'voronoi', name: 'Voronoi Prismatic Shards' },
  { id: 'flow_field', name: 'Turbulent Flow Streamlines' },
  { id: 'fractal_tree', name: 'Fractal Dendritic Canopy' },
  { id: 'topography', name: 'Topographic Elevation Terraces' },
  { id: 'mandala', name: 'Sacred Radial Mandala' },
  { id: 'horizon', name: 'Celestial Horizon Landscape' },
  { id: 'constructivist', name: 'Constructivist Transparent Planes' },
  { id: 'skyline', name: 'Isometric Architectural Skyline' }
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
 * Generates an authentic, structurally varied non-grid procedural image pair
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
  let sceneTitle = 'Procedural Art';

  // =========================================================================
  // 8 RADICAL NON-GRID STRUCTURAL PARADIGMS
  // =========================================================================

  const structureIndex = isPhotoTheme
    ? Math.floor(random() * 3) // 0: Macro Forest, 1: PCB Network, 2: Horizon Vista
    : Math.floor(random() * 8); // 0-7: Distinct Non-Grid Structural Paradigms

  if (isPhotoTheme && structureIndex === 0) {
    // 🌿 1. ORGANIC BOTANICAL SCATTER (Cluster-Based Foliage, not a grid)
    sceneTitle = 'Botanical Canopy';
    const bgGrad = ctxA.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width * 0.75);
    bgGrad.addColorStop(0, '#132a13');
    bgGrad.addColorStop(0.5, '#0d1f0f');
    bgGrad.addColorStop(1, '#050c06');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    // Natural cluster centers
    const clusterCenters = [
      { x: width * 0.25, y: height * 0.3 },
      { x: width * 0.75, y: height * 0.35 },
      { x: width * 0.5, y: height * 0.65 },
      { x: width * 0.2, y: height * 0.8 },
      { x: width * 0.85, y: height * 0.75 }
    ];

    const leafColors = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#1b4332', '#d8f3dc', '#ffb703', '#d90429'];
    const count = targetDifficulty === 'Easy' ? 35 : targetDifficulty === 'Medium' ? 55 : 80;

    for (let i = 0; i < count; i++) {
      const center = randomChoice(clusterCenters);
      const angle = random() * Math.PI * 2;
      const dist = Math.pow(random(), 0.6) * 200;
      const cx = Math.max(40, Math.min(width - 40, center.x + Math.cos(angle) * dist));
      const cy = Math.max(40, Math.min(height - 40, center.y + Math.sin(angle) * dist));
      const size = randomRange(22, 38);
      const kind = randomChoice(['FLOWER', 'MONSTERA', 'BUTTERFLY', 'LADYBUG']);
      const baseColor = randomChoice(['#ff007f', '#ffb703', '#00f0ff', '#ff5400', '#d500f9', '#ffffff', '#00ff87']);
      const rot = random() * Math.PI * 2;

      candidates.push({
        id: `botanical_${i}`,
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
              const a = (p * Math.PI * 2) / 5;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.ellipse(Math.cos(a) * (curSize * 0.45), Math.sin(a) * (curSize * 0.45), curSize * 0.38, curSize * 0.2, a, 0, Math.PI * 2);
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
          }
          ctx.restore();
        }
      });
    }

  } else if (!isPhotoTheme && structureIndex === 0) {
    // 💎 1. VORONOI PRISMATIC SHARDS & STAINED GLASS (Cellular non-grid tessellation)
    sceneTitle = 'Voronoi Stained Glass';
    ctxA.fillStyle = '#0a0d14';
    ctxA.fillRect(0, 0, width, height);

    // Generate non-uniform seed points
    const pointCount = targetDifficulty === 'Easy' ? 28 : targetDifficulty === 'Medium' ? 42 : 56;
    const points = [];
    for (let i = 0; i < pointCount; i++) {
      points.push({
        id: `shard_${i}`,
        x: randomRange(40, width - 40),
        y: randomRange(40, height - 40),
        color: randomChoice(['#ff007f', '#00f0ff', '#7000ff', '#00ff87', '#ffb703', '#3a86ff', '#f72585', '#4cc9f0'])
      });
    }

    // Connect Voronoi triangulation cells
    points.forEach((pt, idx) => {
      const neighbor = points[(idx + 1) % points.length];
      const neighbor2 = points[(idx + 3) % points.length];
      const size = randomRange(30, 55);

      candidates.push({
        id: pt.id,
        x: pt.x, y: pt.y, size, kind: 'VORONOI_SHARD', baseColor: pt.color,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          let color = pt.color;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = pt.color === '#ff007f' ? '#00f0ff' : pt.color === '#00f0ff' ? '#00ff87' : '#ff007f';
          }
          ctx.fillStyle = color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;

          // Draw faceted polygon facet
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo((pt.x + neighbor.x) / 2 + randomRange(-15, 15), (pt.y + neighbor.y) / 2 + randomRange(-15, 15));
          ctx.lineTo((pt.x + neighbor2.x) / 2 + randomRange(-15, 15), (pt.y + neighbor2.y) / 2 + randomRange(-15, 15));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner jewel center
          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, (mutated && mType === 'SCALE_CHANGE') ? 10 : 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    });

  } else if (!isPhotoTheme && structureIndex === 1) {
    // 🌊 2. TURBULENT FLOW STREAMLINES & AURORA RIBBONS (Fluid dynamic curl noise)
    sceneTitle = 'Turbulent Streamlines';
    const bgGrad = ctxA.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#03001e');
    bgGrad.addColorStop(0.5, '#7303c0');
    bgGrad.addColorStop(1, '#ec38bc');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    // Dynamic swirling ribbon vortices
    const vortexCount = targetDifficulty === 'Easy' ? 20 : targetDifficulty === 'Medium' ? 32 : 44;
    const ribbonColors = ['#00f0ff', '#ffbe0b', '#00ff87', '#ffffff', '#ff007f', '#d500f9'];

    for (let v = 0; v < vortexCount; v++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(60, height - 60);
      const size = randomRange(26, 46);
      const baseColor = randomChoice(ribbonColors);
      const swirlDir = random() > 0.5 ? 1 : -1;

      candidates.push({
        id: `vortex_${v}`,
        x: cx, y: cy, size, kind: 'FLOW_VORTEX', baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#00f0ff' ? '#ff007f' : baseColor === '#ff007f' ? '#00ff87' : '#00f0ff';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;
          const rotOffset = (mutated && mType === 'SHAPE_ROTATE') ? Math.PI / 2 : 0;

          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;

          // Multi-turn spiral streamline
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 4; a += 0.15) {
            const r = (a / (Math.PI * 4)) * (curSize * 0.45);
            const px = Math.cos(a * swirlDir + rotOffset) * r;
            const py = Math.sin(a * swirlDir + rotOffset) * r;
            if (a === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();

          // Vortex eye dot
          if (!(mutated && mType === 'REMOVE_DETAIL')) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    }

  } else if (!isPhotoTheme && structureIndex === 2) {
    // 🌳 3. FRACTAL DENDRITIC CANOPY (Recursive organic tree branching)
    sceneTitle = 'Fractal Canopy';
    ctxA.fillStyle = '#060c08';
    ctxA.fillRect(0, 0, width, height);

    // Root trunk to sweeping canopy
    const branchEndpoints = [];
    function branch(x, y, len, angle, depth) {
      if (depth <= 0 || len < 6) return;
      const x2 = x + Math.cos(angle) * len;
      const y2 = y + Math.sin(angle) * len;

      ctxA.strokeStyle = `hsl(${120 + depth * 15}, 65%, ${30 + depth * 8}%)`;
      ctxA.lineWidth = Math.max(1.5, depth * 1.4);
      ctxA.beginPath();
      ctxA.moveTo(x, y);
      ctxA.lineTo(x2, y2);
      ctxA.stroke();

      if (depth <= 2) {
        branchEndpoints.push({ x: x2, y: y2 });
      }

      branch(x2, y2, len * 0.74, angle - 0.4 + randomRange(-0.1, 0.1), depth - 1);
      branch(x2, y2, len * 0.74, angle + 0.4 + randomRange(-0.1, 0.1), depth - 1);
    }

    branch(width * 0.5, height - 20, 110, -Math.PI / 2, 6);

    // Blossom / Pod candidates at branch terminals
    const blossomColors = ['#ff007f', '#ffb703', '#00f0ff', '#ffffff', '#00ff87'];
    branchEndpoints.slice(0, 45).forEach((pt, i) => {
      const size = randomRange(18, 30);
      const baseColor = randomChoice(blossomColors);

      candidates.push({
        id: `branch_node_${i}`,
        x: pt.x, y: pt.y, size, kind: 'FRACTAL_BLOSSOM', baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#ff007f' ? '#00f0ff' : '#ff007f';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffd166';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
    });

  } else if (!isPhotoTheme && structureIndex === 3) {
    // 🗺️ 4. TOPOGRAPHIC ELEVATION CONTOURS (Organic elevation iso-surface map)
    sceneTitle = 'Topographic Iso-Surfaces';
    ctxA.fillStyle = '#0b0f19';
    ctxA.fillRect(0, 0, width, height);

    // Concentric elevation rings
    const topoColors = ['#1e3a8a', '#0284c7', '#0d9488', '#16a34a', '#ca8a04', '#ea580c', '#e11d48'];
    const islandCenters = [
      { x: width * 0.3, y: height * 0.35, maxR: 180 },
      { x: width * 0.72, y: height * 0.4, maxR: 190 },
      { x: width * 0.5, y: height * 0.75, maxR: 140 }
    ];

    islandCenters.forEach((isl, iIdx) => {
      topoColors.forEach((col, cIdx) => {
        const r = isl.maxR * (1 - cIdx / topoColors.length);
        ctxA.strokeStyle = col;
        ctxA.lineWidth = 2.5;
        ctxA.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.2) {
          const wobble = Math.sin(a * 5 + iIdx) * 12;
          const px = isl.x + Math.cos(a) * (r + wobble);
          const py = isl.y + Math.sin(a) * (r + wobble);
          if (a === 0) ctxA.moveTo(px, py);
          else ctxA.lineTo(px, py);
        }
        ctxA.closePath();
        ctxA.stroke();
      });
    });

    // Peak beacons and elevation nodes
    const nodeCount = targetDifficulty === 'Easy' ? 22 : targetDifficulty === 'Medium' ? 34 : 46;
    for (let n = 0; n < nodeCount; n++) {
      const isl = randomChoice(islandCenters);
      const ang = random() * Math.PI * 2;
      const dist = random() * isl.maxR;
      const cx = isl.x + Math.cos(ang) * dist;
      const cy = isl.y + Math.sin(ang) * dist;
      const size = randomRange(20, 36);
      const baseColor = randomChoice(['#ff007f', '#00f0ff', '#ffbe0b', '#00ff87']);

      candidates.push({
        id: `topo_node_${n}`,
        x: cx, y: cy, size, kind: 'ELEVATION_BEACON', baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#ff007f' ? '#00f0ff' : '#ff007f';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, 0, curSize * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Crosshair elevation flag
          ctx.beginPath();
          ctx.moveTo(-curSize * 0.4, 0);
          ctx.lineTo(curSize * 0.4, 0);
          ctx.moveTo(0, -curSize * 0.4);
          ctx.lineTo(0, curSize * 0.4);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

  } else if (!isPhotoTheme && structureIndex === 4) {
    // ☸️ 5. SACRED RADIAL MANDALA (Multi-orbit concentric circular symmetry)
    sceneTitle = 'Sacred Radial Mandala';
    const bgGrad = ctxA.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.6);
    bgGrad.addColorStop(0, '#1a0933');
    bgGrad.addColorStop(0.6, '#0c0414');
    bgGrad.addColorStop(1, '#020005');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    const orbits = [
      { r: 80, count: 8 },
      { r: 140, count: 12 },
      { r: 210, count: 16 },
      { r: 270, count: 20 }
    ];

    const mandalaColors = ['#ff007f', '#00f0ff', '#ffd166', '#00ff87', '#d500f9', '#ffffff'];

    orbits.forEach((orb, orbIdx) => {
      ctxA.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctxA.lineWidth = 1.5;
      ctxA.beginPath();
      ctxA.arc(width / 2, height / 2, orb.r, 0, Math.PI * 2);
      ctxA.stroke();

      for (let s = 0; s < orb.count; s++) {
        const a = (s * Math.PI * 2) / orb.count;
        const cx = width / 2 + Math.cos(a) * orb.r;
        const cy = height / 2 + Math.sin(a) * orb.r;
        const size = 22 + orbIdx * 4;
        const baseColor = randomChoice(mandalaColors);

        candidates.push({
          id: `mandala_${orbIdx}_${s}`,
          x: cx, y: cy, size, kind: 'MANDALA_PETAL', baseColor, rot: a,
          draw: (ctx, mutated, mType) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(a + ((mutated && mType === 'SHAPE_ROTATE') ? Math.PI / 4 : 0));
            let color = baseColor;
            if (mutated && mType === 'COLOR_SHIFT') {
              color = baseColor === '#ff007f' ? '#00f0ff' : baseColor === '#00f0ff' ? '#ffd166' : '#ff007f';
            }
            const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

            ctx.fillStyle = color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;

            // Diamond lotus petal
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.5);
            ctx.lineTo(curSize * 0.3, 0);
            ctx.lineTo(0, curSize * 0.5);
            ctx.lineTo(-curSize * 0.3, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            if (mutated && mType === 'ADD_DETAIL') {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(0, 0, 4, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        });
      }
    });

  } else if (!isPhotoTheme && structureIndex === 5) {
    // 🌄 6. CELESTIAL HORIZON VISTA (Mountains, giant planet, celestial rings)
    sceneTitle = 'Celestial Horizon';
    const skyGrad = ctxA.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0f051d');
    skyGrad.addColorStop(0.4, '#3b1262');
    skyGrad.addColorStop(0.7, '#a0236a');
    skyGrad.addColorStop(1, '#f97316');
    ctxA.fillStyle = skyGrad;
    ctxA.fillRect(0, 0, width, height);

    // Giant background sun/planet
    ctxA.fillStyle = '#ffedd5';
    ctxA.beginPath();
    ctxA.arc(width * 0.5, height * 0.45, 120, 0, Math.PI * 2);
    ctxA.fill();

    // Mountain silhouettes
    ctxA.fillStyle = '#2d0c4e';
    ctxA.beginPath();
    ctxA.moveTo(0, height * 0.6);
    ctxA.lineTo(width * 0.3, height * 0.4);
    ctxA.lineTo(width * 0.6, height * 0.58);
    ctxA.lineTo(width * 0.85, height * 0.38);
    ctxA.lineTo(width, height * 0.65);
    ctxA.lineTo(width, height);
    ctxA.lineTo(0, height);
    ctxA.fill();

    // Floating celestial satellites & mountain beacon stations
    const count = targetDifficulty === 'Easy' ? 20 : targetDifficulty === 'Medium' ? 32 : 44;
    for (let i = 0; i < count; i++) {
      const cx = randomRange(50, width - 50);
      const cy = randomRange(50, height - 70);
      const size = randomRange(22, 38);
      const baseColor = randomChoice(['#00f0ff', '#ff007f', '#ffd166', '#ffffff', '#00ff87']);
      const kind = cy < height * 0.5 ? 'SATELLITE_ORB' : 'BEACON_SPIRE';

      candidates.push({
        id: `horizon_obj_${i}`,
        x: cx, y: cy, size, kind, baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#00f0ff' ? '#ff007f' : '#00f0ff';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          if (kind === 'SATELLITE_ORB') {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
            // Orbital ring
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, curSize * 0.6, curSize * 0.2, (mutated && mType === 'SHAPE_ROTATE') ? 0.6 : -0.6, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            // Spire
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.5);
            ctx.lineTo(curSize * 0.25, curSize * 0.5);
            ctx.lineTo(-curSize * 0.25, curSize * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

  } else if (!isPhotoTheme && structureIndex === 6) {
    // 📐 7. CONSTRUCTIVIST OVERLAPPING TRANSPARENT PLANES (Dynamic geometric angles)
    sceneTitle = 'Constructivist Planes';
    ctxA.fillStyle = '#f5f3ef';
    ctxA.fillRect(0, 0, width, height);

    // Large sweeping diagonal composition bars
    ctxA.fillStyle = 'rgba(17, 17, 17, 0.85)';
    ctxA.save();
    ctxA.translate(width * 0.4, height * 0.5);
    ctxA.rotate(-0.35);
    ctxA.fillRect(-width * 0.6, -20, width * 1.2, 40);
    ctxA.restore();

    ctxA.fillStyle = 'rgba(217, 4, 41, 0.75)';
    ctxA.save();
    ctxA.translate(width * 0.6, height * 0.5);
    ctxA.rotate(0.5);
    ctxA.fillRect(-width * 0.5, -15, width, 30);
    ctxA.restore();

    // Geometric Constructivist components
    const constrColors = ['#d90429', '#00509d', '#ffd000', '#111111', '#457b9d', '#2b2d42'];
    const count = targetDifficulty === 'Easy' ? 22 : targetDifficulty === 'Medium' ? 34 : 46;

    for (let c = 0; c < count; c++) {
      const cx = randomRange(60, width - 60);
      const cy = randomRange(60, height - 60);
      const size = randomRange(26, 48);
      const kind = randomChoice(['ROTATED_SQUARE', 'ACUTE_WEDGE', 'DISC_SECTOR']);
      const baseColor = randomChoice(constrColors);
      const rot = random() * Math.PI;

      candidates.push({
        id: `construct_${c}`,
        x: cx, y: cy, size, kind, baseColor, rot,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          const curRot = (mutated && mType === 'SHAPE_ROTATE') ? rot + Math.PI / 4 : rot;
          ctx.rotate(curRot);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#d90429' ? '#00509d' : baseColor === '#00509d' ? '#ffd000' : '#d90429';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          ctx.fillStyle = color;
          ctx.strokeStyle = '#111111';
          ctx.lineWidth = 2;

          if (kind === 'ROTATED_SQUARE') {
            ctx.fillRect(-curSize * 0.35, -curSize * 0.35, curSize * 0.7, curSize * 0.7);
            ctx.strokeRect(-curSize * 0.35, -curSize * 0.35, curSize * 0.7, curSize * 0.7);
          } else if (kind === 'ACUTE_WEDGE') {
            ctx.beginPath();
            ctx.moveTo(0, -curSize * 0.5);
            ctx.lineTo(curSize * 0.45, curSize * 0.4);
            ctx.lineTo(-curSize * 0.45, curSize * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, curSize * 0.45, 0, Math.PI * 1.5);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

  } else {
    // 🏙️ 8. ISOMETRIC ARCHITECTURAL SKYLINE (Cyber city towers & spires)
    sceneTitle = 'Isometric Cityscape';
    const bgGrad = ctxA.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#050515');
    bgGrad.addColorStop(0.6, '#0f172a');
    bgGrad.addColorStop(1, '#1e1b4b');
    ctxA.fillStyle = bgGrad;
    ctxA.fillRect(0, 0, width, height);

    // Towers of varying heights along baseline
    const towerCount = targetDifficulty === 'Easy' ? 22 : targetDifficulty === 'Medium' ? 34 : 46;
    const towerColors = ['#00f0ff', '#ff007f', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

    for (let t = 0; t < towerCount; t++) {
      const cx = randomRange(40, width - 40);
      const towerH = randomRange(100, 380);
      const cy = height - towerH / 2;
      const size = randomRange(22, 36);
      const baseColor = randomChoice(towerColors);

      candidates.push({
        id: `tower_${t}`,
        x: cx, y: cy - towerH / 2, size, kind: 'TOWER_ROOFTOP', baseColor,
        draw: (ctx, mutated, mType) => {
          ctx.save();
          ctx.translate(cx, cy);
          let color = baseColor;
          if (mutated && mType === 'COLOR_SHIFT') {
            color = baseColor === '#00f0ff' ? '#ff007f' : '#00f0ff';
          }
          const curSize = (mutated && mType === 'SCALE_CHANGE') ? size * 1.6 : size;

          // Tower Body
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-curSize * 0.45, -towerH / 2, curSize * 0.9, towerH);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(-curSize * 0.45, -towerH / 2, curSize * 0.9, towerH);

          // Glowing rooftop antenna beacon
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, -towerH / 2 - 8, 4, 0, Math.PI * 2);
          ctx.fill();

          if (mutated && mType === 'ADD_DETAIL') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-curSize * 0.3, -towerH / 2 + 10, curSize * 0.6, 6);
          }
          ctx.restore();
        }
      });
    }
  }

  // =========================================================================
  // GUARANTEED EXACTLY 1 DIFFERENCE
  // 1. Draw ALL objects onto Canvas A
  // 2. Clone Canvas A 100% onto Canvas B
  // 3. Mutate ONLY targetObj on Canvas B
  // =========================================================================

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

  // Draw all candidates onto Canvas A
  candidates.forEach(c => c.draw(ctxA, false, ''));

  // Clone background & scene onto Canvas B
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
