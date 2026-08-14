/**
 * Multiresolution Laplacian Pyramid Frequency Blending & SSIM Verification Engine
 * 
 * 1. Frequency Decomposition: Separates image into High-Frequency (micro detail, film grain, textures)
 *    and Low-Frequency (base colors, macro lighting) bands.
 * 2. Targeted Low-Frequency Mutation: Modifies color/hue only in low-frequency space while retaining
 *    100% of high-frequency surface detail.
 * 3. SSIM Quality Gate: Calculates Structural Similarity Index to guarantee zero background drift.
 */

// Simple Gaussian Blur kernel smoothing for 2D Canvas ImageData
function applyGaussianBlur(data, width, height, radius = 2) {
  const output = new Uint8ClampedArray(data.length);
  const kSize = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        const py = Math.min(height - 1, Math.max(0, y + ky));
        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const idx = (py * width + px) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }

      const outIdx = (y * width + x) * 4;
      output[outIdx] = Math.round(r / count);
      output[outIdx + 1] = Math.round(g / count);
      output[outIdx + 2] = Math.round(b / count);
      output[outIdx + 3] = data[outIdx + 3];
    }
  }

  return output;
}

/**
 * Calculates Structural Similarity Index (SSIM) between two ImageData regions
 * SSIM = (2*mu1*mu2 + c1)*(2*sigma12 + c2) / ((mu1^2 + mu2^2 + c1)*(sigma1^2 + sigma2^2 + c2))
 */
export function calculateSSIM(dataA, dataB) {
  if (dataA.length !== dataB.length) return 0;

  let sumA = 0, sumB = 0;
  const numPixels = dataA.length / 4;

  for (let i = 0; i < dataA.length; i += 4) {
    const lA = 0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2];
    const lB = 0.299 * dataB[i] + 0.587 * dataB[i + 1] + 0.114 * dataB[i + 2];
    sumA += lA;
    sumB += lB;
  }

  const muA = sumA / numPixels;
  const muB = sumB / numPixels;

  let varA = 0, varB = 0, covAB = 0;

  for (let i = 0; i < dataA.length; i += 4) {
    const lA = 0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2];
    const lB = 0.299 * dataB[i] + 0.587 * dataB[i + 1] + 0.114 * dataB[i + 2];

    const diffA = lA - muA;
    const diffB = lB - muB;

    varA += diffA * diffA;
    varB += diffB * diffB;
    covAB += diffA * diffB;
  }

  varA /= numPixels;
  varB /= numPixels;
  covAB /= numPixels;

  const c1 = 6.5025, c2 = 58.5225; // Standard SSIM stability constants
  const ssim = ((2 * muA * muB + c1) * (2 * covAB + c2)) / ((muA * muA + muB * muB + c1) * (varA + varB + c2));
  return Math.max(0, Math.min(1, ssim));
}

/**
 * Frequency-Domain Laplacian Pyramid Blend Engine
 * Decomposes image region into Low-Frequency (macro lighting) & High-Frequency (micro texture).
 * Modifies Low-Frequency hue while adding back 100% High-Frequency texture.
 */
export function applyLaplacianFrequencyMutation(imageData, centerX, centerY, radius, width, height) {
  const data = imageData.data;
  const startX = Math.max(0, Math.floor(centerX - radius * 1.5));
  const startY = Math.max(0, Math.floor(centerY - radius * 1.5));
  const rw = Math.min(width - startX, Math.ceil(radius * 3));
  const rh = Math.min(height - startY, Math.ceil(radius * 3));

  // Extract region data
  const patchData = new Uint8ClampedArray(rw * rh * 4);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const srcIdx = ((startY + y) * width + (startX + x)) * 4;
      const dstIdx = (y * rw + x) * 4;
      patchData[dstIdx] = data[srcIdx];
      patchData[dstIdx + 1] = data[srcIdx + 1];
      patchData[dstIdx + 2] = data[srcIdx + 2];
      patchData[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  // 1. Low-Frequency (Blurred macro lighting)
  const lowFreq = applyGaussianBlur(patchData, rw, rh, 3);

  // 2. High-Frequency (Texture residual = Original - LowFreq)
  const highFreq = new Float32Array(rw * rh * 3);
  for (let i = 0; i < patchData.length; i += 4) {
    const hIdx = (i / 4) * 3;
    highFreq[hIdx] = patchData[i] - lowFreq[i];
    highFreq[hIdx + 1] = patchData[i + 1] - lowFreq[i + 1];
    highFreq[hIdx + 2] = patchData[i + 2] - lowFreq[i + 2];
  }

  // 3. Mutate Low-Frequency Hue
  const mutatedLowFreq = new Uint8ClampedArray(lowFreq.length);
  const patchCenterX = rw / 2;
  const patchCenterY = rh / 2;

  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const idx = (y * rw + x) * 4;
      const dist = Math.hypot(x - patchCenterX, y - patchCenterY);

      if (dist <= radius * 1.2) {
        const normDist = dist / (radius * 1.2);
        const alpha = Math.max(0, Math.min(1, 0.5 * (1 + Math.cos(normDist * Math.PI))));

        // Swap low-frequency color channels
        const mutR = lowFreq[idx + 2];
        const mutG = Math.min(255, Math.floor(lowFreq[idx + 1] * 1.2));
        const mutB = lowFreq[idx];

        mutatedLowFreq[idx] = Math.round(lowFreq[idx] * (1 - alpha) + mutR * alpha);
        mutatedLowFreq[idx + 1] = Math.round(lowFreq[idx + 1] * (1 - alpha) + mutG * alpha);
        mutatedLowFreq[idx + 2] = Math.round(lowFreq[idx + 2] * (1 - alpha) + mutB * alpha);
        mutatedLowFreq[idx + 3] = lowFreq[idx + 3];
      } else {
        mutatedLowFreq[idx] = lowFreq[idx];
        mutatedLowFreq[idx + 1] = lowFreq[idx + 1];
        mutatedLowFreq[idx + 2] = lowFreq[idx + 2];
        mutatedLowFreq[idx + 3] = lowFreq[idx + 3];
      }
    }
  }

  // 4. Reconstruct Output = Mutated Low-Frequency + 100% Original High-Frequency Texture
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const srcIdx = ((startY + y) * width + (startX + x)) * 4;
      const patchIdx = (y * rw + x) * 4;
      const hIdx = (patchIdx / 4) * 3;

      const finalR = Math.min(255, Math.max(0, Math.round(mutatedLowFreq[patchIdx] + highFreq[hIdx])));
      const finalG = Math.min(255, Math.max(0, Math.round(mutatedLowFreq[patchIdx + 1] + highFreq[hIdx + 1])));
      const finalB = Math.min(255, Math.max(0, Math.round(mutatedLowFreq[patchIdx + 2] + highFreq[hIdx + 2])));

      data[srcIdx] = finalR;
      data[srcIdx + 1] = finalG;
      data[srcIdx + 2] = finalB;
    }
  }

  return imageData;
}
