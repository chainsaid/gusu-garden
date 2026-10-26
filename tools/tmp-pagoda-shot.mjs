// 一次性脚本: 北寺塔近景对比截图 (对照 out/ref/pagoda_high.png 校型用)
// 流程: 渲染竖构图仰视全身 -> 与 ref 并排拼成 out/compare-pagoda.png
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

async function main() {
  const chromePath = findChrome();
  const PORT = 3006;
  const viteProc = spawn('npx', ['vite', 'web', '--port', String(PORT)], { shell: true, stdio: 'ignore' });
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try { const res = await fetch(`http://localhost:${PORT}/`); if (res.ok) break; } catch {}
  }
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [...gpuArgs(), '--window-size=900,1200'],
    defaultViewport: { width: 820, height: 1080 } // 竖构图, 对齐 ref 823x1080
  });
  const page = await browser.newPage();

  // 一比一对比: 基线机位距塔 ~69m, focal 由 26(85°广角) 改为 55(~47°), 与 ref 透视/占比对齐
  const shots = [
    {
      file: './out/check-pagoda.png',
      url: `http://localhost:${PORT}/?clean=1&trees=1&weather=morning&cam=18,3.5,-2&look=24,4.5,-6&focal=30`,
    },
  ];

  for (const shot of shots) {
    console.log(`[render] 加载 ${shot.file} ...`);
    await page.goto(shot.url, { waitUntil: 'networkidle0', timeout: 40000 });
    await page.waitForFunction(() => {
      const loader = document.getElementById('loading-screen');
      return loader && loader.classList.contains('fade-out');
    }, { timeout: 40000 });
    await new Promise((r) => setTimeout(r, 1800));
    await page.screenshot({ path: shot.file });
    console.log(`✓ 完成: ${shot.file}`);
  }

  // ---- 并排拼图: 左 ref 右当前渲染, 等高缩放 ----
  const fs = await import('node:fs');
  const grid = Array.from({ length: 11 }, (_, k) => {
    const y = k * 10;
    return `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="rgba(255,255,255,0.30)" stroke-width="0.15"/>` +
           `<text x="0.6" y="${y + 2.4}" fill="rgba(255,255,255,0.75)" font-size="2.3">${k * 10}</text>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#111;font:13px system-ui;color:#eee}
    .row{position:relative;display:flex;gap:8px;padding:8px;align-items:flex-start}
    .col{flex:1 1 0;position:relative}
    .col img{width:100%;display:block}
    .tag{position:absolute;top:6px;left:6px;background:#000a;padding:4px 10px;border-radius:4px}
  </style><div class="row">
    <div class="col"><img src="file:///E:/Programs/gusu-garden/out/ref/pagoda_high.png"><div class="tag">REF 报恩寺塔实物</div></div>
    <div class="col"><img src="file:///E:/Programs/gusu-garden/out/check-pagoda.png"><div class="tag">当前模型</div></div>
    <svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 100 100" preserveAspectRatio="none" pointer-events="none">
      ${grid}
      <line x1="25" y1="0" x2="25" y2="100" stroke="rgba(120,200,255,0.55)" stroke-width="0.2"/>
      <line x1="75" y1="0" x2="75" y2="100" stroke="rgba(120,200,255,0.55)" stroke-width="0.2"/>
    </svg>
  </div>`;
  fs.writeFileSync('./out/_compare.html', html);
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1200, height: 820 });
  await page2.goto('file:///E:/Programs/gusu-garden/out/_compare.html');
  await new Promise((r) => setTimeout(r, 500));
  await page2.screenshot({ path: './out/compare-pagoda.png', fullPage: true });
  console.log('✓ 对比图: ./out/compare-pagoda.png');

  await browser.close();
  try { process.kill(-viteProc.pid); } catch {}
  try { viteProc.kill(); } catch {}
  process.exit(0);
}
main().catch((err) => { console.error('[render] 异常:', err); process.exit(1); });
