import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

async function run() {
  const chromePath = findChrome();
  const PORT = 3003;
  const viteProc = spawn('npx', ['vite', 'web', '--port', String(PORT)], {
    shell: true,
    stdio: 'ignore'
  });

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) break;
    } catch {}
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [...gpuArgs(), '--window-size=1280,720'],
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', err => console.error('PAGE_ERR:', err));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => {
    const loader = document.getElementById('loading-screen');
    return loader && loader.classList.contains('fade-out');
  }, { timeout: 30000 });

  await new Promise((r) => setTimeout(r, 2000));

  // Click point 1 (小飞虹拱桥)
  await page.click('button[data-point="1"]');

  // Wait 4 seconds for camera smooth transition
  await new Promise((r) => setTimeout(r, 4000));

  await page.screenshot({ path: './out/web-preview-bridge-real.png' });
  console.log('Saved to ./out/web-preview-bridge-real.png');

  await browser.close();
  try { process.kill(-viteProc.pid); } catch {}
  try { viteProc.kill(); } catch {}
  process.exit(0);
}
run();

