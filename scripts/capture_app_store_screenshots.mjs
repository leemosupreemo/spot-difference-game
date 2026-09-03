import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR_6_7 = path.resolve('screenshots/app_store_6.7_inch_landscape');
const OUTPUT_DIR_6_5 = path.resolve('screenshots/app_store_6.5_inch_landscape');

fs.mkdirSync(OUTPUT_DIR_6_7, { recursive: true });
fs.mkdirSync(OUTPUT_DIR_6_5, { recursive: true });

async function capture() {
  console.log('🚀 Starting Vite preview server...');
  const server = await preview({
    preview: {
      port: 4174,
      host: '127.0.0.1',
      open: false
    }
  });

  const baseUrl = 'http://127.0.0.1:4174';
  console.log(`🌐 Server running at: ${baseUrl}`);

  console.log('📱 Launching Chrome headless in Landscape (2796x1290)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--force-device-scale-factor=3',
      '--hide-scrollbars'
    ]
  });

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  
  // Exact iPhone 15/16 Pro Max Landscape Viewport (932 x 430 * 3 = 2796 x 1290)
  await page.setViewport({
    width: 932,
    height: 430,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: true
  });

  // 1. Capture Main Menu
  console.log('📸 1. Capturing 01_main_menu.png...');
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR_6_7, '01_main_menu.png') });

  // 2. Capture Photography Gameplay
  console.log('📸 2. Capturing 02_gameplay_photography.png...');
  await page.evaluate(() => {
    const startBtn = document.querySelector('.glass-btn-primary');
    if (startBtn) startBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUTPUT_DIR_6_7, '02_gameplay_photography.png') });

  // 3. Capture Zoom / Magnifier Mode
  console.log('📸 3. Capturing 03_zoom_precision.png...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const zoomBtn = buttons.find(b => b.textContent.includes('Zoom'));
    if (zoomBtn) zoomBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  
  // Touch point near center of left canvas in landscape
  await page.touchscreen.tap(230, 240);
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR_6_7, '03_zoom_precision.png') });

  // 4. Capture Scores & Live Leaderboard
  console.log('📸 4. Capturing 04_scores_leaderboard.png...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const backBtn = buttons.find(b => b.title === 'Back to Menu' || b.querySelector('svg.lucide-arrow-left'));
    if (backBtn) backBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const scoresBtn = buttons.find(b => b.textContent.includes('Scores'));
    if (scoresBtn) scoresBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR_6_7, '04_scores_leaderboard.png') });

  // 5. Capture Abstract Generative Art Gameplay
  console.log('📸 5. Capturing 05_gameplay_abstract.png...');
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));
  
  await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('.glass-panel'));
    const abstractPanel = panels.find(p => p.textContent.includes('Abstract') || p.textContent.includes('PROCEDURAL'));
    if (abstractPanel) abstractPanel.click();
  });
  await new Promise(r => setTimeout(r, 400));
  
  await page.evaluate(() => {
    const startBtn = document.querySelector('.glass-btn-primary');
    if (startBtn) startBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUTPUT_DIR_6_7, '05_gameplay_abstract.png') });

  console.log('✨ Generating 6.5" Landscape resized screenshots (2688x1242)...');
  const sharp = (await import('sharp')).default;
  const files_6_7 = fs.readdirSync(OUTPUT_DIR_6_7).filter(f => f.endsWith('.png'));

  for (const file of files_6_7) {
    const inputPath = path.join(OUTPUT_DIR_6_7, file);
    const outputPath = path.join(OUTPUT_DIR_6_5, file);
    await sharp(inputPath)
      .resize(2688, 1242, { fit: 'fill' })
      .toFile(outputPath);
  }

  await browser.close();
  await server.close();
  console.log('🎉 Landscape App Store screenshots successfully generated!');
}

capture().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
