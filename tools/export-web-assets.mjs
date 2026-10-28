// Headless GLB exporter for Gusu Garden Web Interactive project.
// Exports core garden models (hall, pagoda, bridge, props, buildings) to web/public/assets/gusu-garden.glb.
//
// usage:
//   node tools/export-web-assets.mjs
//
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5173;
const EXPORT_PORT = 5192;
const OUT_FILE = path.join(ROOT, 'web', 'public', 'assets', 'gusu-garden-core.glb');

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

let devServerProc = null;

async function ensureDevServer() {
  try {
    const res = await fetch(`http://localhost:${PORT}/export.html`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) return;
  } catch (e) {
    // start dev server in background
  }
  console.log('[exporter] 正在临时启动本地 Vite 开发服务器...');
  devServerProc = spawn('npx', ['vite', '--port', String(PORT)], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore'
  });
  // 等待启动
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      const res = await fetch(`http://localhost:${PORT}/export.html`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        console.log('[exporter] Vite 服务已就绪！');
        return;
      }
    } catch {}
  }
  throw new Error('无法连接至 Vite 开发服务器');
}

async function main() {
  console.log('====================================================');
  console.log('  姑苏园林核心资产自动化导出流水线 (Asset Exporter)  ');
  console.log('====================================================');

  const chromePath = findChrome();
  console.log('[exporter] 找到浏览器:', chromePath);
  const targetArg = process.argv.find((a) => a.startsWith('--asset='));
  const onlyAsset = targetArg ? targetArg.split('=')[1] : null;
  if (onlyAsset) console.log(`[exporter] 指定导出目标: [${onlyAsset}]`);

  // 借景北寺塔专用精度档位 (默认 0.25)。塔永久远观 150m+，原 0.38 档仍产出数百万面。
  // 注意: detail.js 的 gap() 分母下限为 0.25，低于此值构件间距不再变大，再调低只会减少分段数。
  // 用法: node tools/export-web-assets.mjs --asset=pagoda --pagoda-detail=0.25
  const detailArg = process.argv.find((a) => a.startsWith('--pagoda-detail='));
  const pagodaDetail = detailArg ? detailArg.split('=')[1] : '0.25';

  await ensureDevServer();

  const uploadedFiles = {};
  const compressedFiles = {};
  let uploadResolve = null;
  const uploadPromise = new Promise((resolve) => { uploadResolve = resolve; });

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/upload')) {
      const u = new URL(req.url, 'http://localhost');
      const assetType = u.searchParams.get('name') || 'core';
      const chunks = [];
      let receivedBytes = 0;
      req.on('data', (c) => {
        chunks.push(c);
        receivedBytes += c.length;
        if (receivedBytes % (50 * 1024 * 1024) < c.length) {
          console.log(`[exporter] 上传进度: ${(receivedBytes / 1024 / 1024).toFixed(1)} MB...`);
        }
      });
      req.on('end', async () => {
        const buf = Buffer.concat(chunks);
        uploadedFiles[assetType] = buf;
        console.log(`[exporter] 收到资产 [${assetType}] 上传，大小: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': '2',
          'Connection': 'close',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        });
        res.end('OK');

        setTimeout(async () => {
          // 处理 Draco 压缩
          const isCore = assetType === 'core';
          const targetFile = isCore 
            ? path.join(ROOT, 'web', 'public', 'assets', 'gusu-garden-core.glb')
            : path.join(ROOT, 'web', 'public', 'assets', 'beisi-pagoda.glb');
          const rawFile = targetFile.replace('.glb', '-raw.glb');

          fs.writeFileSync(rawFile, buf);
          try {
            const { execSync } = await import('node:child_process');
            execSync(`npx gltf-pipeline -i "${rawFile}" -o "${targetFile}" -d --draco.compressionLevel 7`, {
              cwd: ROOT,
              stdio: 'pipe'
            });
            const dracoSize = fs.statSync(targetFile).size;
            const dracoMB = (dracoSize / 1024 / 1024).toFixed(2);
            const ratio = ((1 - dracoSize / buf.length) * 100).toFixed(1);
            try { fs.unlinkSync(rawFile); } catch {}
            console.log(`✓ 资产 [${assetType}] Draco 压缩完成！最终文件: ${targetFile} (${dracoMB} MB, 削减 ${ratio}%)`);
          } catch (err) {
            console.warn(`[exporter:warn] Draco 压缩失败，保留原版:`, err.message);
            fs.writeFileSync(targetFile, buf);
          }

          compressedFiles[assetType] = true;
          // 当所需资产均处理完毕，结束等待
          if (onlyAsset) {
            if (compressedFiles[onlyAsset] && uploadResolve) uploadResolve();
          } else if (compressedFiles['core'] && compressedFiles['pagoda']) {
            if (uploadResolve) uploadResolve();
          }
        }, 50);
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(EXPORT_PORT);
  console.log(`[exporter] 资产上传中转服务运行于端口 ${EXPORT_PORT}...`);

  let browser;
  const tmpUserDataDir = path.join(os.tmpdir(), 'gusu-export-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      userDataDir: tmpUserDataDir,
      args: [...gpuArgs(), '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720'],
      defaultViewport: { width: 1280, height: 720 }
    });

    const page = await browser.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (!/\[vite\]|favicon/.test(text)) {
        console.log(' [浏览器] ' + text);
      }
    });
    page.on('pageerror', (err) => {
      console.error(' [浏览器页面异常] ' + (err.stack || err.message || err));
    });

    // 资产请求 URL: 借景北寺塔额外附带更低的精度档位
    const assetUrl = (name) =>
      name === 'pagoda'
        ? `http://localhost:${PORT}/export.html?asset=pagoda&detail=${pagodaDetail}`
        : `http://localhost:${PORT}/export.html?asset=${name}`;

    if (onlyAsset) {
      console.log(`[exporter] 正在独立导出资产 [${onlyAsset}]...`);
      await page.goto(assetUrl(onlyAsset), { waitUntil: 'load', timeout: 60000 });
      await Promise.race([
        uploadPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('导出超时 (240秒)')), 240000))
      ]);
    } else {
      console.log('[exporter] 阶段 1/2: 正在导出核心建筑群 (core)...');
      await page.goto(assetUrl('core'), { waitUntil: 'load', timeout: 60000 });
      // 等待 core 压缩完毕
      for (let i = 0; i < 480; i++) {
        if (compressedFiles['core']) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!compressedFiles['core']) throw new Error('核心建筑群导出超时');

      console.log(`\n[exporter] 阶段 2/2: 正在导出借景北寺塔 (pagoda, detail=${pagodaDetail})...`);
      await page.goto(assetUrl('pagoda'), { waitUntil: 'load', timeout: 60000 });
      // 等待 pagoda 压缩完毕
      for (let i = 0; i < 480; i++) {
        if (compressedFiles['pagoda']) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!compressedFiles['pagoda']) throw new Error('借景北寺塔导出超时');
    }

    console.log('====================================================');
    console.log(`✓ 全部核心资产自动化导出与压缩流水线圆满完成！`);
    console.log(`  - 核心建筑群: ${path.join(ROOT, 'web', 'public', 'assets', 'gusu-garden-core.glb')}`);
    console.log(`  - 借景北寺塔: ${path.join(ROOT, 'web', 'public', 'assets', 'beisi-pagoda.glb')}`);
    console.log('====================================================');
  } finally {
    if (browser) await browser.close();
    server.close();
    if (devServerProc) devServerProc.kill();
    try { fs.rmSync(tmpUserDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('[exporter:error]', err.message || err);
  process.exit(1);
});
