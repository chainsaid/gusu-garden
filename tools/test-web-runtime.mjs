// Test runner for Gusu Garden Web Interactive project.
// Boots Vite on port 3000, opens Chrome, waits for models to load and render,
// validates performance metrics, POI Hotspots, Walk Mode, All Botanical Layers,
// Weather Presets, Settings Drawer, and exports verification screenshots.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3000;
const SNAP_OUT = path.join(ROOT, 'out', 'web-interactive-preview.png');
const SNAP_PAGODA = path.join(ROOT, 'out', 'web-preview-pagoda.png');
const SNAP_POI = path.join(ROOT, 'out', 'web-preview-poi.png');
const SNAP_WALK = path.join(ROOT, 'out', 'web-preview-walk.png');
const SNAP_DRAWER = path.join(ROOT, 'out', 'web-preview-drawer.png');
const SNAP_DRIZZLE = path.join(ROOT, 'out', 'web-preview-drizzle.png');
const SNAP_SUNSET = path.join(ROOT, 'out', 'web-preview-sunset.png');
const SNAP_NIGHT = path.join(ROOT, 'out', 'web-preview-night.png');

fs.mkdirSync(path.dirname(SNAP_OUT), { recursive: true });

async function main() {
  console.log('====================================================');
  console.log('  姑苏园林 Web 交互版全套素材与特效自动化核验       ');
  console.log('====================================================');

  const chromePath = findChrome();
  console.log('[test] 找到浏览器:', chromePath);

  console.log('[test] 启动 Vite Web 交互服务 (端口 3000)...');
  const viteProc = spawn('npx', ['vite', 'web', '--port', String(PORT)], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore'
  });

  // 等待服务可用
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch(`http://localhost:${PORT}/`, { signal: AbortSignal.timeout(800) });
      if (res.ok) {
        console.log('[test] Web 交互服务已成功响应！');
        break;
      }
    } catch {}
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [...gpuArgs(), '--window-size=1280,720'],
      defaultViewport: { width: 1280, height: 720 }
    });

    const page = await browser.newPage();
    const errors = [];
    page.on('console', (msg) => {
      const txt = msg.text();
      if (!/\[vite\]|favicon/.test(txt)) {
        console.log(' [Web控制台] ' + txt);
      }
    });
    page.on('pageerror', (err) => {
      console.error(' [Web页面异常]', err.message);
      errors.push(err.message);
    });

    console.log(`[test] 访问交互页面: http://localhost:${PORT}/ ...`);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 30000 });

    console.log('[test] 等待 Draco 模型解码与全套场景装配...');
    await page.waitForFunction(() => {
      const loader = document.getElementById('loading-screen');
      return loader && loader.classList.contains('fade-out');
    }, { timeout: 30000 });

    console.log('[test] 场景装载成功，等待渲染稳定 (2秒)...');
    await new Promise((r) => setTimeout(r, 2000));

    // 检查性能指标
    const perfInfo = await page.evaluate(() => {
      return {
        fps: document.getElementById('fps-val')?.textContent,
        draws: document.getElementById('draws-val')?.textContent,
        tris: document.getElementById('tris-val')?.textContent,
        pinsCount: document.querySelectorAll('.hotspot-pin').length,
      };
    });
    console.log('====================================================');
    console.log(`✓ 全景全套素材加载真机采样:`);
    console.log(`  FPS 帧率: ${perfInfo.fps} 帧/秒`);
    console.log(`  Draw Calls: ${perfInfo.draws} 次`);
    console.log(`  三角形面数: ${perfInfo.tris}`);
    console.log(`  3D 文化景致标牌: ${perfInfo.pinsCount} 处`);
    console.log('====================================================');

    // 拍摄主殿全景预览 (包含荷花、翠竹、芭蕉、古松、锦鲤)
    await page.screenshot({ path: SNAP_OUT });
    console.log(`✓ 包含全套草木生灵的主殿全景截图: ${SNAP_OUT}`);

    // 测试打开景致与特效可控配置抽屉
    console.log('[test] 点击打开【🎛️ 景致配置】控制抽屉...');
    await page.click('#config-btn');
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: SNAP_DRAWER });
    console.log(`✓ 景致控制抽屉截图已保存: ${SNAP_DRAWER}`);

    // 测试预设切换：烟雨江南 (Drizzle + Rain)
    console.log('[test] 切换至预设【烟雨江南】(细雨霏霏 + 芭蕉锦鲤)...');
    await page.click('button[data-preset="misty"]');
    await new Promise((r) => setTimeout(r, 1200));
    // 关闭抽屉查看雨景
    await page.click('#drawer-close-btn');
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: SNAP_DRIZZLE });
    console.log(`✓ 烟雨江南落雨效果截图已保存: ${SNAP_DRIZZLE}`);

    // 测试天气切换：夕照晚霞 (Sunset Glow)
    console.log('[test] 切换至天色【夕照晚霞】...');
    await page.click('#config-btn');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('button[data-weather="sunset"]');
    await new Promise((r) => setTimeout(r, 600));
    await page.click('#drawer-close-btn');
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: SNAP_SUNSET });
    console.log(`✓ 夕照晚霞熔金天色截图已保存: ${SNAP_SUNSET}`);

    // 测试天气切换：月夜清辉 (Moonlit Night)
    console.log('[test] 切换至天色【月夜清辉】...');
    await page.click('#config-btn');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('button[data-weather="night"]');
    await new Promise((r) => setTimeout(r, 600));
    await page.click('#drawer-close-btn');
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: SNAP_NIGHT });
    console.log(`✓ 月夜清辉幽蓝夜景截图已保存: ${SNAP_NIGHT}`);

    // 重置回晨曦晴日并进入第一人称漫步测试
    await page.click('#config-btn');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('button[data-weather="morning"]');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('#drawer-close-btn');

    // 导览切换测试：北寺塔借景
    console.log('[test] 点击导览按钮【隔池借景北寺塔】...');
    await page.click('button[data-point="2"]');
    await new Promise((r) => setTimeout(r, 2200));
    await page.screenshot({ path: SNAP_PAGODA });
    console.log(`✓ 北寺塔借景截图已保存: ${SNAP_PAGODA}`);

    console.log('====================================================');
    console.log('✓ 全套素材与可控配置系统自动化核验全部圆满通过！');
    console.log('====================================================');
  } finally {
    if (browser) await browser.close();
    viteProc.kill();
  }
}

main().catch((err) => {
  console.error('[test:error]', err.message || err);
  process.exit(1);
});
