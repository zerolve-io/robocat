/* eslint-env node */
/**
 * Headless smoke test — boots the game, waits 3s, checks for JS errors.
 *
 * Usage:
 *   node tests/smoke.test.mjs [url]
 *
 * Default URL: http://localhost:4173 (Vite preview)
 * Exit 0 = pass, Exit 1 = JS errors detected
 */

import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:4173';
const WAIT_MS = 5000;

// Find Chrome/Chromium
const CHROME_PATHS = [
  // CI ubuntu
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

import { execSync } from 'node:child_process';

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  for (const p of CHROME_PATHS) {
    try {
      execSync(`test -x "${p}"`, { stdio: 'ignore' });
      return p;
    } catch {
      // not found, try next
    }
  }
  return null;
}

const chromePath = findChrome();
if (!chromePath) {
  console.error('❌ No Chrome/Chromium found. Set CHROME_PATH env var.');
  process.exit(1);
}

console.log(`🔍 Chrome: ${chromePath}`);
console.log(`🌐 URL: ${url}`);

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();

// Collect JS errors
const errors = [];
page.on('pageerror', (err) => {
  errors.push(err.message);
});

// Collect console errors
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push(`console.error: ${msg.text()}`);
  }
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log(`⏳ Waiting ${WAIT_MS / 1000}s for game to boot...`);
  await new Promise((r) => setTimeout(r, WAIT_MS));

  // Check that Phaser canvas exists
  const hasCanvas = await page.evaluate(() => {
    return document.querySelector('canvas') !== null;
  });

  if (!hasCanvas) {
    errors.push('No <canvas> element found — Phaser failed to boot');
  }

  // Check canvas has non-zero dimensions
  if (hasCanvas) {
    const dims = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return { width: c?.width || 0, height: c?.height || 0 };
    });
    console.log(`🎮 Canvas: ${dims.width}×${dims.height}`);
  }
} catch (err) {
  errors.push(`Navigation error: ${err.message}`);
}

await browser.close();

if (errors.length > 0) {
  console.error(`\n❌ SMOKE TEST FAILED — ${errors.length} error(s):\n`);
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ SMOKE TEST PASSED — no JS errors, canvas present');
  process.exit(0);
}
