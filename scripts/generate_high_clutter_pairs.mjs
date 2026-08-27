import fs from "fs";
import path from "path";
import https from "https";
import sharp from "sharp";

export function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

export async function measureClutter(imgPath) {
  const { data, info } = await sharp(imgPath).resize(300, 200).grayscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let edgeSum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = (-data[idx - w - 1] + data[idx - w + 1]) + (-2 * data[idx - 1] + 2 * data[idx + 1]) + (-data[idx + w - 1] + data[idx + w + 1]);
      const gy = (-data[idx - w - 1] - 2 * data[idx - w] - data[idx - w + 1]) + (data[idx + w - 1] + 2 * data[idx + w] + data[idx + w + 1]);
      if (Math.hypot(gx, gy) > 40) edgeSum++;
    }
  }
  return Number(((edgeSum / (w * h)) * 100).toFixed(1));
}

export async function generatePair(spec, outputDir = "./public/levels") {
  const baseFile = `${spec.id}_base.jpg`;
  const varFile = `${spec.id}_variant.jpg`;
  const basePath = path.join(outputDir, baseFile);
  const varPath = path.join(outputDir, varFile);

  console.log(`[Authoring] ${spec.id}...`);
  if (!fs.existsSync(basePath)) {
    await download(spec.url, basePath);
  }

  const meta = await sharp(basePath).metadata();
  const w = meta.width;
  const h = meta.height;

  const t = spec.target;
  const targetX = Math.round(t.x * w);
  const targetY = Math.round(t.y * h);
  const boxW = Math.round(t.w * w);
  const boxH = Math.round(t.h * h);

  const sourceX = Math.round(t.sX * w);
  const sourceY = Math.round(t.sY * h);

  const patchBuf = await sharp(basePath)
    .extract({
      left: Math.max(0, Math.min(w - boxW, sourceX - Math.round(boxW / 2))),
      top: Math.max(0, Math.min(h - boxH, sourceY - Math.round(boxH / 2))),
      width: boxW,
      height: boxH
    })
    .toBuffer();

  const polySvg = `<svg width="${boxW}" height="${boxH}">
    <polygon points="${boxW * 0.12},${boxH * 0.12} ${boxW * 0.88},${boxH * 0.1} ${boxW * 0.9},${boxH * 0.88} ${boxW * 0.1},${boxH * 0.9}" fill="#fff" />
  </svg>`;

  const masked = await sharp(patchBuf).composite([{ input: Buffer.from(polySvg), blend: "dest-in" }]).png().toBuffer();

  await sharp(basePath)
    .composite([{
      input: masked,
      left: Math.max(0, targetX - Math.round(boxW / 2)),
      top: Math.max(0, targetY - Math.round(boxH / 2))
    }])
    .jpeg({ quality: 92 })
    .toFile(varPath);

  // Ground truth calibration
  const testW = 600;
  const testH = Math.round((h / w) * 600);
  const bBuf = await sharp(basePath).resize(testW, testH).raw().toBuffer();
  const vBuf = await sharp(varPath).resize(testW, testH).raw().toBuffer();

  let sumX = 0, sumY = 0, diffCount = 0;
  let minX = testW, maxX = 0, minY = testH, maxY = 0;

  for (let i = 0; i < testW * testH; i++) {
    const pIdx = i * 3;
    const dr = Math.abs(bBuf[pIdx] - vBuf[pIdx]);
    const dg = Math.abs(bBuf[pIdx + 1] - vBuf[pIdx + 1]);
    const db = Math.abs(bBuf[pIdx + 2] - vBuf[pIdx + 2]);
    if (Math.max(dr, dg, db) > 18) {
      const x = i % testW;
      const y = Math.floor(i / testW);
      sumX += x;
      sumY += y;
      diffCount++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const trueCx = diffCount > 0 ? Number(((sumX / diffCount) / testW * 100).toFixed(1)) : Number((t.x * 100).toFixed(1));
  const trueCy = diffCount > 0 ? Number(((sumY / diffCount) / testH * 100).toFixed(1)) : Number((t.y * 100).toFixed(1));
  const spanX = ((maxX - minX) / testW) * 100;
  const spanY = ((maxY - minY) / testH) * 100;
  const trueRad = Number(Math.max(4.5, Math.min(7.5, Math.max(spanX, spanY) / 2 + 1.2)).toFixed(1));
  const diffArea = ((diffCount / (testW * testH)) * 100).toFixed(2);

  console.log(`  ✓ Calibrated: diffArea=${diffArea}%, centroid=(${trueCx}%, ${trueCy}%), radius=${trueRad}%`);

  return {
    id: spec.id,
    title: spec.title,
    category: "Photography",
    pack: "Photography",
    packId: "find_the_sniper",
    difficulty: "Hard",
    baseImage: `/levels/${baseFile}`,
    variantImage: `/levels/${varFile}`,
    diffs: [{ id: 1, x: trueCx, y: trueCy, radius: trueRad, description: spec.desc, hint: spec.hint }]
  };
}
