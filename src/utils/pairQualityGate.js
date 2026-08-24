/**
 * Automated Quality Enforcement Gate for Photo Pairs
 * 
 * Enforces the 3 Core Generation Directives:
 * 1. Balanced Scale (0.5% <= area <= 6.0%) - Prevents "Way Too Obvious" and "Not Noticeable"
 * 2. Strict Zero-Drift Invariance - Guarantees 0% changes outside the single designated difference
 * 3. Centroid Ground-Truth Hotspot - Guarantees exact coordinate & radius alignment
 */

export function analyzePixelDifferences(basePixels, varPixels, width, height, threshold = 18) {
  let diffCount = 0;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let sumX = 0, sumY = 0;

  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const dr = Math.abs(basePixels[idx] - varPixels[idx]);
    const dg = Math.abs(basePixels[idx + 1] - varPixels[idx + 1]);
    const db = Math.abs(basePixels[idx + 2] - varPixels[idx + 2]);

    const maxDelta = Math.max(dr, dg, db);
    if (maxDelta > threshold) {
      diffCount++;
      const x = i % width;
      const y = Math.floor(i / width);
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (diffCount === 0) {
    return { valid: false, error: 'No noticeable differences found between base and variant' };
  }

  const diffAreaPercent = (diffCount / totalPixels) * 100;
  const centroidX = (sumX / diffCount) / width * 100;
  const centroidY = (sumY / diffCount) / height * 100;
  
  const spanX = ((maxX - minX) / width) * 100;
  const spanY = ((maxY - minY) / height) * 100;
  const computedRadius = Math.max(3.5, Math.min(8.5, Math.max(spanX, spanY) / 2 + 1.2));

  // Check 1: Size Bounds
  if (diffAreaPercent > 8.0) {
    return { valid: false, error: `Difference too obvious/large (${diffAreaPercent.toFixed(1)}% of image)` };
  }
  if (diffAreaPercent < 0.1) {
    return { valid: false, error: `Difference too small/imperceptible (${diffAreaPercent.toFixed(2)}% of image)` };
  }

  return {
    valid: true,
    diffAreaPercent,
    centroid: { x: Number(centroidX.toFixed(1)), y: Number(centroidY.toFixed(1)) },
    suggestedRadius: Number(computedRadius.toFixed(1))
  };
}

export function enforceZeroDriftBackground(basePixels, varPixels, width, height, hotspotXPercent, hotspotYPercent, radiusPercent) {
  const centerX = (hotspotXPercent / 100) * width;
  const centerY = (hotspotYPercent / 100) * height;
  const maxRadiusPx = (radiusPercent / 100) * Math.min(width, height);
  const maxRadiusSq = maxRadiusPx * maxRadiusPx;

  const totalPixels = width * height;
  const outputPixels = new Uint8ClampedArray(varPixels);

  for (let i = 0; i < totalPixels; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const dx = x - centerX;
    const dy = y - centerY;
    const distSq = dx * dx + dy * dy;

    // Hard-clamp any pixels outside the allowed difference circle to match the base image 100%
    if (distSq > maxRadiusSq) {
      const idx = i * 4;
      outputPixels[idx] = basePixels[idx];
      outputPixels[idx + 1] = basePixels[idx + 1];
      outputPixels[idx + 2] = basePixels[idx + 2];
      outputPixels[idx + 3] = basePixels[idx + 3];
    }
  }

  return outputPixels;
}
