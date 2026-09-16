import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { preview, build } from 'vite';
import { SCREENSHOT_MODALS } from '../src/components/screenshotModals.js';

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = path.resolve('screenshots/modals');
const PREVIEW_PORT = 4177;

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
      results.push({ ...item, filename, sizeKb, success: true });
      console.log(`✅ (${sizeKb} KB)`);
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      results.push({ ...item, filename, error: err.message, success: false });
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
    <p class="subtitle">Automated visual snapshot report of all modals, special menus, and victory states.</p>
    <div class="stats-bar">
      <span>Total Captured: ${results.filter(r => r.success).length}/${results.length}</span>
      <span>•</span>
      <span>Resolution: 786×1704 (@2x iPhone)</span>
      <span>•</span>
      <span>Date: ${new Date().toLocaleDateString()}</span>
    </div>
  </header>

  <main class="grid">
    ${results.map(r => `
      <article class="card">
        <div class="card-img-wrap">
          <a href="${r.filename}" target="_blank">
            <img src="${r.filename}" alt="${r.name}" loading="lazy">
          </a>
        </div>
        <div class="card-body">
          <div class="card-tag">${r.category}</div>
          <h2 class="card-title">${r.name}</h2>
          <p class="card-desc">${r.description}</p>
          <div class="card-footer">
            <span>${r.filename}</span>
            <span>${r.sizeKb || 0} KB</span>
          </div>
        </div>
      </article>
    `).join('')}
  </main>
</body>
</html>`;

  const reportPath = path.join(OUTPUT_DIR, 'index.html');
  fs.writeFileSync(reportPath, htmlReport);
  console.log(`✅ Visual report written to: ${reportPath}`);

  await browser.close();
  await server.close();

  const failures = results.filter(result => !result.success);
  if (failures.length > 0) {
    throw new Error(`${failures.length} screenshot capture${failures.length === 1 ? '' : 's'} failed`);
  }

  console.log('\n🎉 ALL SCREENSHOTS SUCCESSFULLY CAPTURED!');
  console.log(`📁 Files saved in: ${OUTPUT_DIR}/`);
}

run().catch(err => {
  console.error('Fatal error during screenshot capture:', err);
  process.exit(1);
});
