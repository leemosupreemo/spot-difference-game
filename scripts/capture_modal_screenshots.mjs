import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { preview, build } from 'vite';
import { SCREENSHOT_MODALS } from '../src/components/screenshotModals.js';

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASELINE_DIR = path.resolve('screenshots/modals');
const CHECK_MODE = process.argv.includes('--check');
const OUTPUT_DIR = CHECK_MODE ? path.join(BASELINE_DIR, '.visual-check', 'candidate') : BASELINE_DIR;
const DIFF_DIR = path.join(BASELINE_DIR, '.visual-check', 'diff');
const PREVIEW_PORT = 4177;

// Per-channel intensity delta above which a pixel counts as "changed".
const PIXEL_DELTA_THRESHOLD = 32;
// Share of changed pixels above which a screenshot is flagged as a regression.
const DIFF_RATIO_THRESHOLD = Number(process.env.VISUAL_DIFF_THRESHOLD || 0.002);

async function loadRawRgba(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function compareAgainstBaseline(baselinePath, candidatePath, diffPath, diffThreshold = DIFF_RATIO_THRESHOLD) {
  if (!fs.existsSync(baselinePath)) {
    return { status: 'new', diffRatio: null };
  }

  const [baseline, candidate] = await Promise.all([
    loadRawRgba(baselinePath),
    loadRawRgba(candidatePath)
  ]);

  if (baseline.width !== candidate.width || baseline.height !== candidate.height) {
    return {
      status: 'regression',
      diffRatio: 1,
      reason: `size changed from ${baseline.width}x${baseline.height} to ${candidate.width}x${candidate.height}`
    };
  }

  const { width, height } = baseline;
  const pixelCount = width * height;
  const diffBuffer = Buffer.alloc(pixelCount * 4);
  let changedPixels = 0;

  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const dr = Math.abs(baseline.data[o] - candidate.data[o]);
    const dg = Math.abs(baseline.data[o + 1] - candidate.data[o + 1]);
    const db = Math.abs(baseline.data[o + 2] - candidate.data[o + 2]);

    if (Math.max(dr, dg, db) > PIXEL_DELTA_THRESHOLD) {
      changedPixels++;
      diffBuffer[o] = 255;
      diffBuffer[o + 1] = 0;
      diffBuffer[o + 2] = 64;
      diffBuffer[o + 3] = 255;
    } else {
      const gray = Math.round(((candidate.data[o] + candidate.data[o + 1] + candidate.data[o + 2]) / 3) * 0.35);
      diffBuffer[o] = gray;
      diffBuffer[o + 1] = gray;
      diffBuffer[o + 2] = gray;
      diffBuffer[o + 3] = 255;
    }
  }

  const diffRatio = changedPixels / pixelCount;

  if (diffRatio > 0) {
    await sharp(diffBuffer, { raw: { width, height, channels: 4 } }).png().toFile(diffPath);
  }

  return { status: diffRatio > diffThreshold ? 'regression' : 'pass', diffRatio };
}

async function assertDailyBannerTextAlignment(page) {
  const alignment = await page.evaluate(() => {
    const findTextNode = (text) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.textContent.trim() === text) return walker.currentNode;
      }
      return null;
    };

    const textLeft = (node) => {
      if (!node) return null;
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().left;
    };

    const headingLeft = textLeft(findTextNode('Set of the Day'));
    const descriptionLeft = textLeft(findTextNode('3-Image Daily Sequence • Never Repeated'));
    return {
      headingLeft,
      descriptionLeft,
      delta: headingLeft === null || descriptionLeft === null
        ? null
        : Math.abs(headingLeft - descriptionLeft)
    };
  });

  if (alignment.delta === null) {
    throw new Error('Could not measure the Set of the Day heading and description text');
  }
  if (alignment.delta > 0.5) {
    throw new Error(`Set of the Day text is misaligned by ${alignment.delta.toFixed(1)}px`);
  }
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (CHECK_MODE) {
  fs.rmSync(DIFF_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIFF_DIR, { recursive: true });
}

async function run() {
  console.log('🔍 Checking Google Chrome at:', CHROME_PATH);
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome executable not found at "${CHROME_PATH}". Set CHROME_PATH environment variable.`);
  }

  // Ensure production build exists
  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    console.log('📦 Building Vite client production bundle...');
    await build();
  }

  console.log(`🚀 Starting preview server on port ${PREVIEW_PORT}...`);
  const server = await preview({
    preview: {
      port: PREVIEW_PORT,
      host: '127.0.0.1',
      open: false
    }
  });

  const baseUrl = `http://127.0.0.1:${PREVIEW_PORT}`;
  console.log(`🌐 Server running at: ${baseUrl}`);

  console.log('📱 Launching Chrome headless...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars'
    ]
  });

  const page = await browser.newPage();

  // Standard iPhone 15/16 Pro Viewport
  await page.setViewport({
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false
  });

  console.log(`📸 Capturing ${SCREENSHOT_MODALS.length} modals and special menus...\n`);

  const results = [];

  for (let i = 0; i < SCREENSHOT_MODALS.length; i++) {
    const item = SCREENSHOT_MODALS[i];
    const indexStr = String(i + 1).padStart(2, '0');
    const filename = `${indexStr}_${item.id}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    process.stdout.write(`  [${indexStr}/${SCREENSHOT_MODALS.length}] 📷 ${item.name}... `);

    try {
      const url = `${baseUrl}/?screenshotModal=${encodeURIComponent(item.id)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('[data-testid="screenshot-harness"]', { timeout: 5000 }).catch(() => {});

      // Settle time for CSS transitions / modal split animations
      await new Promise(r => setTimeout(r, 450));

      // Extra settle time for fanfare particles
      if (item.id === 'victory-fanfare') {
        await new Promise(r => setTimeout(r, 400));
      }

      if (item.id.startsWith('daily-banner-')) {
        await assertDailyBannerTextAlignment(page);
      }

      await page.screenshot({ path: outputPath, fullPage: false });

      const stat = fs.statSync(outputPath);
      const sizeKb = (stat.size / 1024).toFixed(1);

      if (CHECK_MODE) {
        const baselinePath = path.join(BASELINE_DIR, filename);
        const diffPath = path.join(DIFF_DIR, filename);
        const comparison = await compareAgainstBaseline(baselinePath, outputPath, diffPath, item.diffThreshold);
        results.push({ ...item, filename, sizeKb, success: true, ...comparison });
        const label = comparison.status === 'regression'
          ? `❌ REGRESSION (${(comparison.diffRatio * 100).toFixed(2)}% changed)`
          : comparison.status === 'new'
            ? '🆕 no baseline yet'
            : `✅ (${(comparison.diffRatio * 100).toFixed(3)}% changed)`;
        console.log(label);
      } else {
        results.push({ ...item, filename, sizeKb, success: true, status: 'pass' });
        console.log(`✅ (${sizeKb} KB)`);
      }
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      results.push({ ...item, filename, error: err.message, success: false, status: 'error' });
    }
  }

  // Generate HTML Gallery Report
  console.log('\n📄 Generating visual HTML report...');
  const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diff Hunter - Modal & Menu Screenshots</title>
  <style>
    :root {
      --bg: #0d0f18;
      --card-bg: rgba(26, 32, 53, 0.75);
      --border: rgba(255, 255, 255, 0.12);
      --accent: #00f0ff;
      --accent-gold: #ffb703;
      --text: #f0f4f8;
      --text-muted: #8e9bb0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 32px 20px;
    }
    header {
      max-width: 1400px;
      margin: 0 auto 36px auto;
      text-align: center;
    }
    h1 {
      font-size: 2.4rem;
      font-weight: 900;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #fff 40%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    p.subtitle {
      font-size: 1.05rem;
      color: var(--text-muted);
    }
    .stats-bar {
      display: inline-flex;
      gap: 16px;
      margin-top: 14px;
      padding: 8px 18px;
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--accent);
    }
    .grid {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
    }
    .card.regression {
      border-color: #ff3860;
      box-shadow: 0 0 0 1px #ff3860, 0 12px 30px rgba(255, 56, 96, 0.25);
    }
    .triptych {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      width: 100%;
    }
    .triptych figure {
      margin: 0;
    }
    .triptych figcaption {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 4px;
      text-align: center;
    }
    .card-img-wrap .triptych img {
      width: 100%;
      height: 160px;
      object-fit: contain;
      border-radius: 8px;
      background: #05070d;
    }
    .card-img-wrap {
      background: #05070d;
      padding: 12px;
      display: flex;
      align-items: center;
      justifyContent: center;
      border-bottom: 1px solid var(--border);
    }
    .card-img-wrap img {
      max-width: 100%;
      height: 380px;
      object-fit: contain;
      border-radius: 12px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.6);
      cursor: zoom-in;
    }
    .card-body {
      padding: 16px 18px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .card-tag {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--accent-gold);
      margin-bottom: 6px;
    }
    .card-title {
      font-size: 1.15rem;
      font-weight: 900;
      margin-bottom: 6px;
      color: #fff;
    }
    .card-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.4;
      flex: 1;
    }
    .card-footer {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: monospace;
    }
  </style>
</head>
<body>
  <header>
    <h1>Diff Hunter Visual Modals & Menus</h1>
    <p class="subtitle">${CHECK_MODE
      ? 'Visual regression check: current build vs. the committed baseline gallery.'
      : 'Automated visual snapshot report of all modals, special menus, and victory states.'}</p>
    <div class="stats-bar">
      <span>Total Captured: ${results.filter(r => r.success).length}/${results.length}</span>
      ${CHECK_MODE ? `<span>•</span><span>Regressions: ${results.filter(r => r.status === 'regression').length}</span>` : ''}
      <span>•</span>
      <span>Resolution: 786×1704 (@2x iPhone)</span>
      <span>•</span>
      <span>Date: ${new Date().toLocaleDateString()}</span>
    </div>
  </header>

  <main class="grid">
    ${results.map(r => `
      <article class="card${r.status === 'regression' ? ' regression' : ''}">
        <div class="card-img-wrap">
          ${CHECK_MODE ? `
            <div class="triptych">
              <figure><figcaption>Baseline</figcaption><img src="../${r.filename}" alt="baseline" loading="lazy" onerror="this.replaceWith('n/a')"></figure>
              <figure><figcaption>Current</figcaption><img src="candidate/${r.filename}" alt="current" loading="lazy"></figure>
              <figure><figcaption>Diff</figcaption><img src="diff/${r.filename}" alt="diff" loading="lazy" onerror="this.replaceWith('no change')"></figure>
            </div>
          ` : `
            <a href="${r.filename}" target="_blank">
              <img src="${r.filename}" alt="${r.name}" loading="lazy">
            </a>
          `}
        </div>
        <div class="card-body">
          <div class="card-tag">${r.category}${CHECK_MODE ? ` · ${r.status.toUpperCase()}` : ''}</div>
          <h2 class="card-title">${r.name}</h2>
          <p class="card-desc">${r.description}</p>
          <div class="card-footer">
            <span>${r.filename}</span>
            <span>${CHECK_MODE && r.diffRatio != null ? `${(r.diffRatio * 100).toFixed(3)}% changed` : `${r.sizeKb || 0} KB`}</span>
          </div>
        </div>
      </article>
    `).join('')}
  </main>
</body>
</html>`;

  const reportPath = CHECK_MODE
    ? path.join(BASELINE_DIR, '.visual-check', 'report.html')
    : path.join(OUTPUT_DIR, 'index.html');
  fs.writeFileSync(reportPath, htmlReport);
  console.log(`✅ Visual report written to: ${reportPath}`);

  await browser.close();
  await server.close();

  const failures = results.filter(result => !result.success);
  if (failures.length > 0) {
    throw new Error(`${failures.length} screenshot capture${failures.length === 1 ? '' : 's'} failed`);
  }

  if (CHECK_MODE) {
    const regressions = results.filter(r => r.status === 'regression');
    const newBaselines = results.filter(r => r.status === 'new');
    if (newBaselines.length > 0) {
      console.log(`\n🆕 ${newBaselines.length} modal(s) have no baseline yet: ${newBaselines.map(r => r.filename).join(', ')}`);
    }
    if (regressions.length > 0) {
      console.log(`\n❌ ${regressions.length} VISUAL REGRESSION(S) DETECTED:`);
      for (const r of regressions) {
        console.log(`   - ${r.filename}: ${(r.diffRatio * 100).toFixed(2)}% of pixels changed${r.reason ? ` (${r.reason})` : ''}`);
      }
      console.log(`\n   Review the report, then if the change is intentional run:`);
      console.log(`   npm run test:screenshots   # regenerates the committed baseline`);
      throw new Error(`${regressions.length} visual regression(s) found — see ${reportPath}`);
    }
    console.log('\n🎉 NO VISUAL REGRESSIONS DETECTED');
    return;
  }

  console.log('\n🎉 ALL SCREENSHOTS SUCCESSFULLY CAPTURED!');
  console.log(`📁 Files saved in: ${OUTPUT_DIR}/`);
}

run().catch(err => {
  console.error('Fatal error during screenshot capture:', err);
  process.exit(1);
});
