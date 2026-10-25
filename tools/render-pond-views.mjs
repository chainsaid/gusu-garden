import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

async function main() {
  const chromePath = findChrome();
  const PORT = 3006;
  const viteProc = spawn('npx', ['vite', 'web', '--port', String(PORT)], {
    shell: true,
    stdio: 'ignore'
  });

  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) break;
    } catch {}
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [...gpuArgs(), '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  const shots = [
    {
      name: '小飞虹拱桥与近景荷塘 (对齐用户原图透视)',
      file: './out/pond-render-bridge.png',
      url: `http://localhost:${PORT}/?clean=1&cam=19.5,2.4,14.5&look=10.0,0.8,16.0&focal=32`,
    },
    {
      name: '贴水荷香特写 (碧波水镜、荷叶浅碟、胭脂荷花与水下锦鲤)',
      file: './out/pond-render-macro.png',
      url: `http://localhost:${PORT}/?clean=1&cam=15.8,0.32,18.2&look=11.2,0.5,15.6&focal=42`,
    },
    {
      name: '水榭主殿南眺荷塘全景',
      file: './out/pond-render-panoramic.png',
      url: `http://localhost:${PORT}/?clean=1&cam=10.0,3.2,6.5&look=10.0,0.6,18.0&focal=28`,
    },
    {
      name: '旷世借景 · 隔池北寺塔与波光倒影',
      file: './out/pond-render-pagoda.png',
      url: `http://localhost:${PORT}/?clean=1&cam=26.0,3.0,24.0&look=-24.0,22.0,-20.0&focal=35`,
    },
  ];

  for (const shot of shots) {
    console.log(`[render] 正在加载并渲染: ${shot.name}...`);
    await page.goto(shot.url, { waitUntil: 'networkidle0', timeout: 35000 });
    await page.waitForFunction(() => {
      const loader = document.getElementById('loading-screen');
      return loader && loader.classList.contains('fade-out');
    }, { timeout: 35000 });

    // 等待水体着色器和波光动画完全就绪稳定
    await new Promise((r) => setTimeout(r, 2200));

    await page.screenshot({ path: shot.file });
    console.log(`✓ 渲染完成并已导出: ${shot.file}`);
  }

  await browser.close();
  try { process.kill(-viteProc.pid); } catch {}
  try { viteProc.kill(); } catch {}
  console.log('[render] 全部荷塘多视角电影级渲染任务完成！');
  process.exit(0);
}

main().catch((err) => {
  console.error('[render] 异常:', err);
  process.exit(1);
});

