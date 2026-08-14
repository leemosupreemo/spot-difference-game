// High-Precision Photographic Scene Generator & Seamless HSL Mutation Engine
// Loads Real High-Res Unsplash Photographs -> Applies HSL Luminance-Preserving Object Mutation

import { PHOTO_PACKS } from '../data/photoPacks';
import { generateProceduralLevelPair as generateFallbackPair } from './proceduralGenerator';
import { generateManifestLevelPair } from './manifestRenderEngine';

// Helper: RGB [0-255] to HSL [0-1]
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

// Helper: HSL [0-1] to RGB [0-255]
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function generatePhotographicLevelPair(themeId = 'find_the_sniper', targetDifficulty = 'Medium', seed = Date.now()) {
  if (themeId === 'pipeline_manifest') {
    return generateManifestLevelPair(themeId, targetDifficulty, seed);
  }

  const matchingPacks = PHOTO_PACKS.filter(p => p.theme === themeId);
  const pack = matchingPacks.length > 0
    ? matchingPacks[Math.floor(seed % matchingPacks.length)]
    : PHOTO_PACKS[Math.floor(seed % PHOTO_PACKS.length)];

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

  const pixelX = Math.round((pack.target.x / 100) * width);
  const pixelY = Math.round((pack.target.y / 100) * height);
  const radiusPercent = targetDifficulty === 'Easy' ? 12 : targetDifficulty === 'Medium' ? 8 : 5;
  const pixelRadius = Math.round((radiusPercent / 100) * Math.min(width, height));

  const diffs = [
    {
      id: `photo_diff_${seed}_1`,
      x: pack.target.x,
      y: pack.target.y,
      radius: radiusPercent,
      mutationType: pack.mutationType,
      description: pack.mutationDetail || `Spot the 1 difference!`,
      hint: `Look closely near (${pack.target.x}%, ${pack.target.y}%)`
    }
  ];

  const imgA = new Image();
  imgA.crossOrigin = 'Anonymous';
  const imgB = new Image();

  let isLoaded = false;
  imgA.src = pack.url;

  const processPhotoMutation = () => {
    try {
      ctxA.drawImage(imgA, 0, 0, width, height);
      ctxB.drawImage(canvasA, 0, 0);

      const regionSize = pixelRadius * 2.8;
      const startX = Math.max(0, Math.floor(pixelX - regionSize / 2));
      const startY = Math.max(0, Math.floor(pixelY - regionSize / 2));
      const rw = Math.min(width - startX, Math.ceil(regionSize));
      const rh = Math.min(height - startY, Math.ceil(regionSize));

      const imageData = ctxB.getImageData(startX, startY, rw, rh);
      const data = imageData.data;

      const samplePx = Math.floor(rw / 2);
      const samplePy = Math.floor(rh / 2);
      const sampleIdx = (samplePy * rw + samplePx) * 4;
      const [targetH] = rgbToHsl(data[sampleIdx], data[sampleIdx + 1], data[sampleIdx + 2]);

      for (let i = 0; i < data.length; i += 4) {
        const px = startX + ((i / 4) % rw);
        const py = startY + Math.floor((i / 4) / rw);
        const dist = Math.hypot(px - pixelX, py - pixelY);

        if (dist <= pixelRadius * 1.2) {
          const origR = data[i];
          const origG = data[i + 1];
          const origB = data[i + 2];

          const [h, s, l] = rgbToHsl(origR, origG, origB);
          const hueDist = Math.min(Math.abs(h - targetH), 1 - Math.abs(h - targetH));

          if (hueDist < 0.25 || dist <= pixelRadius * 0.4) {
            const normDist = dist / (pixelRadius * 1.2);
            const alpha = Math.max(0, Math.min(1, 0.5 * (1 + Math.cos(normDist * Math.PI))));

            let newH = h, newS = s, newL = l;

            if (pack.mutationType === 'COLOR_SHIFT') {
              // Shift Hue by 120-180 degrees, keeping Lightness (shadows/textures/grain) EXACT
              newH = (h + 0.45) % 1.0;
              newS = Math.min(1.0, s * 1.15);
            } else {
              // ADD_DETAIL: Specular lighting highlight on original object texture
              newL = Math.min(1.0, l * 1.45);
              newS = Math.min(1.0, s * 1.2);
            }

            const [mutR, mutG, mutB] = hslToRgb(newH, newS, newL);

            // Cosine smoothstep alpha blending with original photograph
            data[i] = Math.round(origR * (1 - alpha) + mutR * alpha);
            data[i + 1] = Math.round(origG * (1 - alpha) + mutG * alpha);
            data[i + 2] = Math.round(origB * (1 - alpha) + mutB * alpha);
          }
        }
      }

      ctxB.putImageData(imageData, startX, startY);
      imgB.src = canvasB.toDataURL('image/png');
      isLoaded = true;
    } catch (e) {
      console.warn('Canvas CORS photographic mutation warning:', e);
    }
  };

  imgA.onload = processPhotoMutation;

  const fallbackPair = generateFallbackPair(themeId, targetDifficulty, seed);

  return {
    id: `photo_${pack.id}_${seed}`,
    title: pack.title,
    category: pack.category,
    difficulty: targetDifficulty,
    totalDifferences: 1,
    bgGradient: ['#0b091a', '#1e1035'],
    accentColor: '#00f0ff',
    diffs,
    render: (ctx, w, h, isModified) => {
      const targetImg = isModified ? imgB : imgA;
      if (isLoaded && targetImg.complete && targetImg.naturalWidth > 0) {
        ctx.drawImage(targetImg, 0, 0, w, h);
      } else {
        fallbackPair.render(ctx, w, h, isModified);
      }
    }
  };
}
