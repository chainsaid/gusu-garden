import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

const W = 1280, H = 720;

async function main() {
  const chromePath = findChrome();
  console.log('[snap-web-plan] 启动 Web 端平面图拍摄...');

  const PORT_WEB = 3008;
  const viteWebProc = spawn('npx', ['vite', 'web', '--port', String(PORT_WEB)], {
    shell: true,
    stdio: 'ignore'
  });

  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch(`http://localhost:${PORT_WEB}/`);
      if (res.ok) {
        console.log(`[snap-web-plan] Web 服务端口 ${PORT_WEB} 已连接！`);
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

  // 1. 渲染 Web 版正顶视总平面图
  const webPlanUrl = `http://localhost:${PORT_WEB}/?clean=1&cam=0,160,0.1&look=0,0,0&focal=24`;
  console.log(`[snap-web-plan] 正在渲染 Web 版总平面图...`);
  await page.goto(webPlanUrl, { waitUntil: 'networkidle0', timeout: 35000 });
  await page.waitForFunction(() => {
    const loader = document.getElementById('loading-screen');
    return loader && loader.classList.contains('fade-out');
  }, { timeout: 35000 });
  await new Promise(r => setTimeout(r, 3000));

  const outWeb = './out/plan-web.png';
  await page.screenshot({ path: outWeb });
  console.log(`✓ Web 版总平面图已保存: ${outWeb}`);

  // 2. 渲染 Web 版高空鸟瞰透视图
  const webAerialUrl = `http://localhost:${PORT_WEB}/?clean=1&cam=10,95,78&look=10,0,8&focal=28`;
  console.log(`[snap-web-plan] 正在渲染 Web 版高空鸟瞰透视图...`);
  await page.goto(webAerialUrl, { waitUntil: 'networkidle0', timeout: 35000 });
  await page.waitForFunction(() => {
    const loader = document.getElementById('loading-screen');
    return loader && loader.classList.contains('fade-out');
  }, { timeout: 35000 });
  await new Promise(r => setTimeout(r, 3000));

  const outWebAerial = './out/plan-web-aerial.png';
  await page.screenshot({ path: outWebAerial });
  console.log(`✓ Web 版鸟瞰透视图已保存: ${outWebAerial}`);

  await browser.close();
  try { process.kill(-viteWebProc.pid); } catch {}
  try { viteWebProc.kill(); } catch {}

  console.log('[snap-web-plan] 任务全部完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('[snap-web-plan] 错误:', err);
  process.exit(1);
});

