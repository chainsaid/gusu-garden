import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

const W = 1920, H = 1080;

async function main() {
  const chromePath = findChrome();
  console.log('[snap-zoom] 启动 Web 端高保真放大平面图拍摄...');

  const PORT_WEB = 3009;
  const viteWebProc = spawn('npx', ['vite', 'web', '--port', String(PORT_WEB)], {
    shell: true,
    stdio: 'ignore'
  });

  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch(`http://localhost:${PORT_WEB}/`);
      if (res.ok) {
        console.log(`[snap-zoom] Web 服务端口 ${PORT_WEB} 已连接！`);
        break;
      }
    } catch {}
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [...gpuArgs(), `--window-size=${W},${H}`, '--force-device-scale-factor=1'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }
  });

  const page = await browser.newPage();

  // 渲染 Web 版核心荷池与水榭高清晰度放大顶视平面图
  const webZoomUrl = `http://localhost:${PORT_WEB}/?clean=1&cam=10,75,12.1&look=10,0,12&focal=28`;
  console.log(`[snap-zoom] 正在渲染 Web 版放大平面图 (${webZoomUrl})...`);
  await page.goto(webZoomUrl, { waitUntil: 'networkidle0', timeout: 35000 });
  await page.waitForFunction(() => {
    const loader = document.getElementById('loading-screen');
    return loader && loader.classList.contains('fade-out');
  }, { timeout: 35000 });
  await new Promise(r => setTimeout(r, 3000));

  const outWeb = './out/plan-zoom-web.png';
  await page.screenshot({ path: outWeb });
  console.log(`✓ Web 版放大平面图已保存: ${outWeb}`);

  await browser.close();
  try { process.kill(-viteWebProc.pid); } catch {}
  try { viteWebProc.kill(); } catch {}

  console.log('[snap-zoom] 全部完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('[snap-zoom] 错误:', err);
  process.exit(1);
});
