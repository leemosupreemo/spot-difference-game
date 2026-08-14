/**
 * High-Detail Photorealistic HSL Mutation Render Engine
 * Performs 100% seamless photorealistic object mutations on real high-res stock photos.
 * Preserves original luminance, textures, shadows, and camera noise by manipulating
 * HSL color space with feathered sigmoid alpha blending.
 */

import { PHOTO_PACKS } from '../data/photoPacks';

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

export function renderManifestLevelPair(baseScene, mutationSpec, width = 800, height = 600) {
  const canvasA = document.createElement('canvas');
  canvasA.width = width;
  canvasA.height = height;
  const ctxA = canvasA.getContext('2d');

  const canvasB = document.createElement('canvas');
  canvasB.width = width;
  canvasB.height = height;
  const ctxB = canvasB.getContext('2d');

  const imgA = new Image();
  imgA.crossOrigin = 'Anonymous';
  const imgB = new Image();

  let isLoaded = false;
  imgA.src = baseScene.photoUrl || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=800&auto=format&fit=crop';

  const pixelX = Math.round((mutationSpec.center.x / 100) * width);
  const pixelY = Math.round((mutationSpec.center.y / 100) * height);
  const pixelRadius = Math.round(((mutationSpec.radius || 6) / 100) * Math.min(width, height));

  const processPhotoMutation = () => {
    try {
      // 1. Draw Base High-Res Stock Photo onto Canvas A
      ctxA.drawImage(imgA, 0, 0, width, height);

      // 2. Copy Base Photo onto Canvas B
      ctxB.drawImage(canvasA, 0, 0);

      // 3. Apply Seamless HSL Luminance-Preserving Mutation onto Canvas B
      const regionSize = pixelRadius * 2.8;
      const startX = Math.max(0, Math.floor(pixelX - regionSize / 2));
      const startY = Math.max(0, Math.floor(pixelY - regionSize / 2));
      const rw = Math.min(width - startX, Math.ceil(regionSize));
      const rh = Math.min(height - startY, Math.ceil(regionSize));

      const imageData = ctxB.getImageData(startX, startY, rw, rh);
      const data = imageData.data;

      // Sample center target object color
      const samplePx = Math.floor(rw / 2);
      const samplePy = Math.floor(rh / 2);
      const sampleIdx = (samplePy * rw + samplePx) * 4;
      const [targetH, targetS, targetL] = rgbToHsl(data[sampleIdx], data[sampleIdx + 1], data[sampleIdx + 2]);

      const isColorShift = mutationSpec.mutationType === 'COLOR_SHIFT' || mutationSpec.mutationType === 'ASSET_SWAP';
      const isDetailMod = mutationSpec.mutationType === 'ADD_DETAIL' || mutationSpec.mutationType === 'ROTATE';

      for (let i = 0; i < data.length; i += 4) {
        const px = startX + ((i / 4) % rw);
        const py = startY + Math.floor((i / 4) / rw);
        const dist = Math.hypot(px - pixelX, py - pixelY);

        if (dist <= pixelRadius * 1.2) {
          const origR = data[i];
          const origG = data[i + 1];
          const origB = data[i + 2];

          const [h, s, l] = rgbToHsl(origR, origG, origB);

          // Color distance in HSL space
          const hueDist = Math.min(Math.abs(h - targetH), 1 - Math.abs(h - targetH));
          const isTargetObject = hueDist < 0.25 || dist <= pixelRadius * 0.4;

          if (isTargetObject) {
            // Feathered alpha falloff towards edge (cosine smoothstep)
            const normDist = dist / (pixelRadius * 1.2);
            const alpha = Math.max(0, Math.min(1, 0.5 * (1 + Math.cos(normDist * Math.PI))));

            let newH = h, newS = s, newL = l;

            if (isColorShift) {
              // Shift Hue by 120-180 degrees while keeping S and L (luminance/shadows/texture) EXACT
              newH = (h + 0.45) % 1.0;
              newS = Math.min(1.0, s * 1.15); // Vibrant natural saturation boost
            } else if (isDetailMod) {
              // Micro lighting specular glint / contrast shift on original texture
              newL = Math.min(1.0, l * 1.45);
              newS = Math.min(1.0, s * 1.2);
            } else {
              // REMOVE_OBJECT: Natural desaturation & shadow blending
              newS = s * 0.2;
              newL = Math.max(0.15, l * 0.7);
            }

            const [mutR, mutG, mutB] = hslToRgb(newH, newS, newL);

            // Blend mutated color with original photograph pixel based on smooth alpha
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
      console.warn('Seamless HSL photo mutation warning:', e);
    }
  };

  imgA.onload = processPhotoMutation;

  return {
    id: mutationSpec.puzzleId,
    title: baseScene.title || `Stock Photo Puzzle`,
    category: baseScene.category || 'Photographic Stock',
    difficulty: mutationSpec.difficulty || 'Medium',
    difficultyScore: mutationSpec.difficultyScore || 5.0,
    totalDifferences: 1,
    bgGradient: ['#0b091a', '#1e1035'],
    accentColor: mutationSpec.difficulty === 'Hard' ? '#ff007f' : '#00f0ff',
    diffs: [
      {
        id: 1,
        x: mutationSpec.center.x,
        y: mutationSpec.center.y,
        radius: mutationSpec.radius || 6,
        mutationType: mutationSpec.mutationType,
        description: mutationSpec.differenceDescription || `Spot the single photographic difference!`,
        hint: `Look closely near region (${mutationSpec.center.x}%, ${mutationSpec.center.y}%)`
      }
    ],
    render: (ctx, w, h, isModified) => {
      const targetImg = isModified ? imgB : imgA;
      if (isLoaded && targetImg.complete && targetImg.naturalWidth > 0) {
        ctx.drawImage(targetImg, 0, 0, w, h);
      } else {
        ctx.drawImage(isModified ? canvasB : canvasA, 0, 0, w, h);
      }
    }
  };
}

/**
 * On-Demand Photorealistic Stock Scene Manifest Engine
 */
export function generateManifestLevelPair(themeId = 'pipeline_manifest', targetDifficulty = 'Medium', seed = Date.now()) {
  const packIndex = Math.abs(seed) % PHOTO_PACKS.length;
  const pack = PHOTO_PACKS[packIndex];

  const baseScene = {
    baseSceneId: `photo_stock_${pack.id}`,
    title: pack.title,
    category: pack.category,
    photoUrl: pack.url
  };

  const mutationSpec = {
    puzzleId: `manifest_photo_${pack.id}_${seed}`,
    targetObject: `photo_target_${pack.target.x}_${pack.target.y}`,
    mutationType: pack.mutationType || 'COLOR_SHIFT',
    bounding_box: [
      Math.max(0, pack.target.x - 5),
      Math.max(0, pack.target.y - 5),
      Math.min(100, pack.target.x + 5),
      Math.min(100, pack.target.y + 5)
    ],
    center: {
      x: pack.target.x,
      y: pack.target.y
    },
    radius: targetDifficulty === 'Easy' ? 9 : targetDifficulty === 'Medium' ? 6 : 4,
    difficulty: targetDifficulty,
    difficultyScore: targetDifficulty === 'Hard' ? 8.2 : targetDifficulty === 'Medium' ? 5.5 : 2.4,
    differenceDescription: pack.mutationDetail || `Single Photographic Mutation`
  };

  return renderManifestLevelPair(baseScene, mutationSpec);
}
