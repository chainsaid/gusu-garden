import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'out', 'benchmarks');
const BRAIN_DIR = 'C:/Users/lielo/.gemini/antigravity/brain/babb32d7-80d4-487f-b7dc-fe8c45b31634';
const PORT_ORIG = 5173;
const PORT_WEB = 3000;

fs.mkdirSync(OUT_DIR, { recursive: true });

// 8 组经典江南造园核心对齐基准机位 (涵盖水镜倒影、拱桥、借景、庭院、文人中堂、水榭美人靠、发戗飞檐与竹影游廊)
const BENCHMARKS = [
  {
    id: '01_main_hall_reflection',
    title: '水榭主厅隔池全景与水镜倒影',
    cam: [15.0, 2.8, 20.0],
    look: [8.5, 3.4, 2.0],
    focal: 30,
  },
  {
    id: '02_arch_bridge_water',
    title: '小飞虹青石单孔拱桥与荷塘修竹',
    cam: [24.0, 2.6, 13.5],
    look: [7.5, 1.8, 17.5],
    focal: 32,
  },
  {
    id: '03_beisi_pagoda_borrowing',
    title: '隔池远眺借景北寺塔',
    cam: [28.0, 1.6, 25.5],
    look: [-105.0, 32.0, -48.0],
    focal: 24,
  },
  {
    id: '04_banana_palms_plaster',
    title: '白粉墙角雨打芭蕉与长窗',
    cam: [23.5, 2.2, -6.8],
    look: [16.0, 2.8, -13.0],
    focal: 30,
  },
  {
    id: '05_scholar_hall_interior',
    title: '中堂明代文人雅集室内全景',
    cam: [10.0, 2.7, -15.5],
    look: [10.0, 3.1, -29.8],
    focal: 32,
  },
  {
    id: '06_water_pavilion_willow',
    title: '东岸水榭美人靠隔水顾盼',
    cam: [40.5, 1.35, 17.5],
    look: [28.0, 0.8, 19.0],
    focal: 30,
  },
  {
    id: '07_faqiang_flying_eaves',
    title: '重檐歇山嫩戗发戗特写与风铎',
    cam: [-14.6, 10.4, -3.0],
    look: [0.5, 9.4, -18.5],
    focal: 26,
  },
  {
    id: '08_winding_corridor_bamboo',
    title: '南游廊粉墙竹影与漏窗步道',
    cam: [-1.8, 1.65, 45.0],
    look: [6.0, 1.75, 38.0],
    focal: 28,
  },
  {
    id: '09_taihu_rockery_guanyun',
    title: '冠云峰太湖石透漏之美与隔池对望水榭',
    cam: [18.8, 2.0, -3.2],
    look: [32.0, 1.8, 6.0],
    focal: 32,
  },
  {
    id: '10_leak_window_framing',
    title: '竹林游廊漏窗框景与探出式长窗',
    cam: [64.2, 1.95, 24.3],
    look: [12.0, 2.3, 20.0],
    focal: 28,
  },
  {
    id: '11_morning_lotus_macro',
    title: '荷塘浮萍清晨微距与单孔石拱桥低角仰望',
    cam: [18.8, 0.42, 23.4],
    look: [5.5, 3.6, 7.5],
    focal: 26,
  },
  {
    id: '12_jiangnan_twilight_aerial',
    title: '姑苏全园鸟瞰俯瞰全景与借景北寺塔天际线',
    cam: [46.0, 18.0, 38.0],
    look: [-15.0, 2.0, -8.0],
    focal: 26,
  },
];

async function ensureServer(port, scriptCmd, name) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(600) });
    if (res.ok) {
      console.log(`[server] ${name} (端口 ${port}) 已在线运行`);
      return null;
    }
  } catch {}

  console.log(`[server] 正在启动 ${name} (端口 ${port})...`);
  const proc = spawn('npx', scriptCmd.split(' '), { cwd: ROOT, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(800) });
      if (res.ok) {
        console.log(`[server] ${name} (端口 ${port}) 启动就绪！`);
        return proc;
      }
    } catch {}
  }
  throw new Error(`无法启动服务: ${name}`);
}

async function main() {
  console.log('====================================================');
  console.log('  原版基准帧 vs Web 交互对比帧 1:1 精确对齐生成器   ');
  console.log('====================================================');

  const lockFile = path.join(ROOT, 'out', '.gpu.lock');
  if (fs.existsSync(lockFile)) {
    try { fs.unlinkSync(lockFile); } catch {}
  }

  // 1. 启动两端服务
  const procOrig = await ensureServer(PORT_ORIG, 'vite --port 5173 --strictPort', '原版电影渲染器');
  const procWeb = await ensureServer(PORT_WEB, 'vite web --port 3000', 'Web 交互端');

  const chromePath = findChrome();
  console.log('[browser] 使用浏览器:', chromePath);

  let browser;
  for (let attempt = 0; attempt < 10 && !browser; attempt++) {
    const profile = attempt < 6 ? path.join(ROOT, 'out', '.chrome-profile') : path.join(ROOT, 'out', `.chrome-profile-${process.pid}`);
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: [...gpuArgs(), '--window-size=1280,720', '--force-device-scale-factor=1'],
        defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
        protocolTimeout: 600000,
        userDataDir: profile,
      });
    } catch (e) {
      if (attempt === 9) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  try {
    const allBaselinesExist = BENCHMARKS.every((b) => fs.existsSync(path.join(OUT_DIR, `baseline_${b.id}.png`)));
    let pageOrig = null;

    if (!allBaselinesExist) {
      console.log(`\n[原版渲染器] 正在加载并编译场景母本 (端口 ${PORT_ORIG})...`);
      pageOrig = await browser.newPage();
      pageOrig.on('console', (msg) => {
        const txt = msg.text();
        if (/\[world\]|\[info\]|compiling/i.test(txt)) console.log(`  [src/] ${txt.slice(0, 140)}`);
      });
      pageOrig.on('pageerror', (err) => {
        console.error(`  [src:error] ${err.stack || err.message || err}`);
      });
      
      // 打开原版，skipfirst=1 允许跳过初次渲染，直接初始化好模型世界
      const origInitUrl = `http://localhost:${PORT_ORIG}/?mode=still&w=1280&h=720&q=preview&spp=1&skipfirst=1`;
      await pageOrig.goto(origInitUrl, { waitUntil: 'load', timeout: 180000 });
      await pageOrig.waitForFunction('window.__READY === true', { timeout: 180000, polling: 500 });
      console.log(`✓ [src/] 原版场景构建与着色器预热完毕！`);
    } else {
      console.log(`\n✓ 检测到所有 ${BENCHMARKS.length} 组原版电影基准帧均已存在于本地缓存，直接复用母本！`);
    }

    // 3. 打开 Web 端页面 (端口 3000)
    const pageWeb = await browser.newPage();
    pageWeb.on('pageerror', (e) => console.error('  [web:error]', e.message));

    // 4. 逐个机位精准抓取 1:1 基准帧与对比帧
    for (let i = 0; i < BENCHMARKS.length; i++) {
      const b = BENCHMARKS[i];
      console.log(`\n----------------------------------------------------`);
      console.log(`[机位 ${i + 1}/${BENCHMARKS.length}] ${b.title}`);
      console.log(`  机位参数: cam=[${b.cam.join(', ')}] look=[${b.look.join(', ')}] focal=${b.focal}`);

      const camParam = `cam=${b.cam.join(',')}&look=${b.look.join(',')}&focal=${b.focal}`;
      const origPng = path.join(OUT_DIR, `baseline_${b.id}.png`);
      const webPng = path.join(OUT_DIR, `web_${b.id}.png`);
      const diffPng = path.join(OUT_DIR, `comparison_${b.id}.png`);

      // 4.1 渲染原版电影基准帧 (如已有缓存则复用，否则通过 window.__renderView 毫秒级极速渲染)
      if (!fs.existsSync(origPng) && pageOrig) {
        console.log(`  (1) 正在渲染原版基准帧...`);
        const origDataUrl = await pageOrig.evaluate(async (qs) => {
          return window.__renderView(qs);
        }, camParam);

        if (origDataUrl) {
          fs.writeFileSync(origPng, Buffer.from(origDataUrl.split(',')[1], 'base64'));
          console.log(`  ✓ 原版基准帧已就绪: ${origPng}`);
        }
      } else {
        console.log(`  ✓ 原版基准帧已就绪 (复用母本): ${origPng}`);
      }

      // 4.2 渲染 Web 交互对比帧
      console.log(`  (2) 正在渲染 Web 对比帧...`);
      const webUrl = `http://localhost:${PORT_WEB}/?w=1280&h=720&clean=1&${camParam}`;
      await pageWeb.goto(webUrl, { waitUntil: 'load', timeout: 30000 });
      await pageWeb.waitForFunction('window.__READY === true', { timeout: 30000, polling: 300 });
      await new Promise((r) => setTimeout(r, 800));

      await pageWeb.screenshot({ path: webPng });
      console.log(`  ✓ Web 对比帧已就绪: ${webPng}`);

      // 4.3 使用 FFmpeg 拼接左右 1:1 对比合成图
      if (fs.existsSync(origPng) && fs.existsSync(webPng)) {
        console.log(`  (3) 正在拼接 1:1 左右对比大图...`);
        spawnSync('ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', origPng, '-i', webPng,
          '-filter_complex', '[0:v]scale=960:540[v0];[1:v]scale=960:540[v1];[v0][v1]hstack=inputs=2',
          diffPng
        ]);
        console.log(`  ✓ 左右对照大图已输出: ${diffPng}`);
      }
    }

    // 5. 同步所有成果至工件目录供直接查看
    if (fs.existsSync(BRAIN_DIR)) {
      console.log(`\n[sync] 正在将基准图与对比图同步至工件库...`);
      const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
      for (const f of files) {
        fs.copyFileSync(path.join(OUT_DIR, f), path.join(BRAIN_DIR, f));
      }
      console.log(`✓ 成功将 ${files.length} 张图片同步至工件目录！`);
    }

    console.log('\n====================================================');
    console.log('✓ 原版基准帧与 Web 对比帧 1:1 全域生成完毕！');
    console.log('====================================================');

  } finally {
    await browser.close().catch(() => {});
    if (procOrig) procOrig.kill();
    if (procWeb) procWeb.kill();
  }
}

main().catch((err) => {
  console.error('[compare] 发生异常:', err);
  process.exit(1);
});
