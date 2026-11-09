// ---------------------------------------------------------------------------
// 挂落纹样二维样本页（纯二维，不进入三维场景、不碰成片基准）。
//
// 八式各自按构造规则生成线稿：万字回纹 / 冰裂纹 / 回纹 / 一根藤 /
// 灯笼锦 / 海棠 / 灵芝 / 直棂。同一 2:1 开间正视、白底黑线、统一线宽。
//
// usage: node tools/gualuo-samples.mjs
// out:   out/gualuo/gualuo-sample-sheet.png  (A4 横向比例)
// ---------------------------------------------------------------------------
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out', 'gualuo');
fs.mkdirSync(OUT, { recursive: true });

// 面板坐标系：x ∈ [0,2]，y ∈ [0,1]（y 向下）。所有纹样只在这一块里画。
const FRAME = 'M0.03 0.03 H1.97 V0.97 H0.03 Z';
const TOP_RAIL = 'M0.07 0.115 H1.93';

const seg = (x0, y0, x1, y1) => `M${x0} ${y0}L${x1} ${y1}`;
const poly = (pts, close = false) =>
  `M${pts.map((p) => `${p[0]} ${p[1]}`).join('L')}${close ? 'Z' : ''}`;

function circle(cx, cy, r, n = 48, a0 = 0, a1 = Math.PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

// 藤蔓卷须：半径由外向内收，末端不闭合，读成“卷”而不是“环”。
function spiral(cx, cy, r0, r1, turns = 1.6, a0 = 0, n = 56) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + turns * Math.PI * 2 * t;
    const r = r0 + (r1 - r0) * t;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

// --- 1. 万字回纹 ------------------------------------------------------------
// 一排四个卍字：竖脊 + 四出勾，勾头一律收方；上勾用细线相连成“一笔连”。
function wanzi() {
  const main = [];
  const thin = [];
  const cy = 0.52;
  const n = 4;
  const x0 = 0.06;
  const cell = 0.47;
  const s = 0.20;
  const h = 0.105;
  for (let i = 0; i < n; i++) {
    const cx = x0 + cell * (i + 0.5);
    // 横脊不再通长，卍字四臂才读得出来
    main.push(seg(cx - s, cy, cx + s, cy));
    main.push(seg(cx, cy - s, cx, cy + s));
    main.push(seg(cx + s, cy, cx + s, cy - h));
    main.push(seg(cx, cy - s, cx - h, cy - s));
    main.push(seg(cx - s, cy, cx - s, cy + h));
    main.push(seg(cx, cy + s, cx + h, cy + s));
    // 上一字的上勾与下一字的上臂以细线相连，形成“一笔连”
    if (i < n - 1) thin.push(seg(cx + h, cy + s, cx + cell, cy + s));
  }
  return { main, thin };
}

// --- 2. 冰裂纹 --------------------------------------------------------------
// 不规则折线网：顶点全抖动，格子大小与角度都不一样；没有一条通长水平线。
function binglie() {
  // 3×3 不规则四边格：顶点全部抖动，格子大小与角度都不一样；
  // 再在四个格内加斜裂，避免读成规则三角网。
  const cols = [0.10, 0.62, 1.16, 1.90];
  const rows = [0.15, 0.43, 0.70, 0.91];
  const jx = [
    [0.02, -0.10, 0.06, 0.00],
    [-0.06, 0.08, -0.02, 0.10],
    [0.04, -0.04, 0.10, -0.08],
    [-0.02, 0.06, -0.08, 0.04],
  ];
  const jy = [
    [0.00, 0.02, -0.03, 0.00],
    [0.00, 0.06, -0.04, 0.02],
    [0.00, -0.03, 0.04, 0.00],
    [0.00, 0.02, -0.02, 0.00],
  ];
  const P = (r, c) => [cols[c] + jx[r][c], rows[r] + jy[r][c]];
  const out = [];
  // 格边界
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length - 1; c++) {
      out.push(seg(...P(r, c), ...P(r, c + 1)));
    }
  }
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols.length; c++) {
      out.push(seg(...P(r, c), ...P(r + 1, c)));
    }
  }
  // 格内斜裂：位置错开，形成大小不一的冰裂块
  const diag = [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]];
  for (const [r, c] of diag) {
    out.push(seg(...P(r, c), ...P(r + 1, c + 1)));
  }
  return out;
}

// --- 3. 回纹 --------------------------------------------------------------
// 上下两排方回：外方套内方，每方留一个缺口；同排用横条相连，密而齐。
function huiwen() {
  const out = [];
  const n = 5;
  const cell = 0.36;
  const x0 = 0.28;
  const rows = [0.31, 0.73];
  for (const cy of rows) {
    out.push(`M${x0 - 0.15} ${cy}H${x0 + cell * (n - 1) + 0.15}`);
    for (let i = 0; i < n; i++) {
      const cx = x0 + cell * i;
      const w = 0.145;
      const h = 0.105;
      // 外方：左下角留缺口
      out.push(poly([
        [cx - w, cy - h], [cx + w, cy - h], [cx + w, cy + h],
        [cx - w, cy + h], [cx - w, cy - h + 0.035],
      ]));
      // 内方：右上角留缺口
      out.push(poly([
        [cx - w * 0.5, cy - h * 0.5], [cx + w * 0.5, cy - h * 0.5],
        [cx + w * 0.5, cy + h * 0.5], [cx - w * 0.5, cy + h * 0.5],
        [cx - w * 0.5, cy - h * 0.5],
      ]));
    }
  }
  return out;
}

// --- 4. 一根藤 -------------------------------------------------------------
// 一条连续藤蔓横贯；四个波峰波谷各生一卷，卷须起点都落在藤身上。
function yigenteng() {
  const pts = [];
  const N = 96;
  const waveY = (x) => 0.52
    + 0.205 * Math.sin(Math.PI * 2 * (x - 0.10) / 0.90)
    + 0.018 * Math.sin(Math.PI * 6 * (x - 0.10) / 0.90);
  for (let i = 0; i <= N; i++) {
    const x = 0.10 + 1.80 * (i / N);
    pts.push([x, waveY(x)]);
  }
  const out = [poly(pts)];
  // 卷须必须从藤身长出：起点落在主藤上，再向外收成螺旋，读完仍是一根。
  const anchors = [0.325, 0.775, 1.225, 1.675];
  anchors.forEach((x, i) => {
    const y = waveY(x);
    const outY = y > 0.52 ? 1 : -1;          // 谷向下卷，峰向上卷
    const outX = i % 2 === 0 ? 0.018 : -0.018;
    const cx = x + outX;
    const cy = y + outY * 0.060;
    const r0 = Math.hypot(x - cx, y - cy);
    const a0 = Math.atan2(y - cy, x - cx);
    out.push(spiral(cx, cy, r0, 0.014, 1.55, a0));
  });
  return out;
}

// --- 5. 灯笼锦 -------------------------------------------------------------
// 四只灯笼并排，灯笼之间以绳结相连；灯身内收菱形花心，灯下垂三缕穗。
function denglongjin() {
  const out = [];
  const n = 4;
  const x0 = 0.27;
  const gap = 0.49;
  const cy = 0.52;
  const body = [
    [-0.08, 0.24], [0.08, 0.24], [0.14, 0.11],
    [0.14, -0.11], [0.08, -0.24], [-0.08, -0.24],
    [-0.14, -0.11], [-0.14, 0.11],
  ];
  for (let i = 0; i < n; i++) {
    const cx = x0 + gap * i;
    out.push(poly(body.map(([dx, dy]) => [cx + dx, cy + dy]), true));
    // 上下灯托（上方挂绳、下方垂穗）
    out.push(seg(cx - 0.10, cy - 0.27, cx + 0.10, cy - 0.27));
    out.push(seg(cx - 0.10, cy + 0.27, cx + 0.10, cy + 0.27));
    // 灯身内菱形花心 + 中心小圆
    out.push(poly([
      [cx, cy + 0.10], [cx + 0.055, cy], [cx, cy - 0.10], [cx - 0.055, cy], [cx, cy + 0.10],
    ]));
    out.push(circle(cx, cy, 0.022, 20));
    // 三缕穗
    for (const dx of [-0.045, 0, 0.045]) {
      const yEnd = cy + 0.44 - Math.abs(dx) * 0.7;
      out.push(seg(cx + dx, cy + 0.28, cx + dx, yEnd));
      out.push(circle(cx + dx, yEnd, 0.014, 12));
    }
    // 灯间绳结（挂在灯托上方）
    if (i < n - 1) {
      out.push(seg(cx + 0.10, cy - 0.27, cx + gap - 0.10, cy - 0.27));
      out.push(circle((cx + cx + gap) / 2, cy - 0.27, 0.026, 16));
    }
  }
  return out;
}

// --- 6. 海棠 ---------------------------------------------------------------
// 四瓣海棠：极坐标四瓣弧框，瓣间留凹口；花心一个小圆 + 十字。
function haitang() {
  const out = [];
  const centers = [0.30, 0.77, 1.23, 1.70];
  const cy = 0.52;
  const R = 0.145;
  for (const cx of centers) {
    const pts = [];
    const N = 96;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = R * (0.78 + 0.30 * Math.cos(4 * a));
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    out.push(poly(pts, true));
    out.push(circle(cx, cy, 0.034, 24));
    out.push(seg(cx - 0.055, cy, cx + 0.055, cy));
    out.push(seg(cx, cy - 0.055, cx, cy + 0.055));
    // 与下一朵之间一小段花茎
    if (cx < 1.70) out.push(seg(cx + R * 0.95, cy, cx + 0.34, cy));
  }
  return out;
}

// --- 7. 灵芝 ---------------------------------------------------------------
// 三朵灵芝云头：心形云头 + 两侧向内卷的螺旋；中间大、两边小，左右对称。
function lingzhiHead(cx, cy, w, h) {
  const out = [];
  out.push(`M${cx} ${cy - 0.50 * h}C${cx - 0.18 * w} ${cy - 0.50 * h},${cx - 0.50 * w} ${cy - 0.16 * h},${cx - 0.50 * w} ${cy + 0.12 * h}C${cx - 0.50 * w} ${cy + 0.42 * h},${cx - 0.20 * w} ${cy + 0.52 * h},${cx} ${cy + 0.22 * h}C${cx + 0.20 * w} ${cy + 0.52 * h},${cx + 0.50 * w} ${cy + 0.42 * h},${cx + 0.50 * w} ${cy + 0.12 * h}C${cx + 0.50 * w} ${cy - 0.16 * h},${cx + 0.18 * w} ${cy - 0.50 * h},${cx} ${cy - 0.50 * h}Z`);
  // 两侧内卷
  out.push(circle(cx - 0.27 * w, cy + 0.10 * h, 0.045 * h * 2, 28, Math.PI * 0.5, Math.PI * 2.1));
  out.push(circle(cx + 0.27 * w, cy + 0.10 * h, 0.045 * h * 2, 28, Math.PI * 1.5, Math.PI * 0.9));
  // 云头下短茎
  out.push(seg(cx, cy + 0.22 * h, cx, cy + 0.50 * h));
  return out;
}
function lingzhi() {
  const out = [];
  out.push(...lingzhiHead(1.00, 0.58, 0.44, 0.42));
  out.push(...lingzhiHead(0.32, 0.54, 0.32, 0.34));
  out.push(...lingzhiHead(1.68, 0.54, 0.32, 0.34));
  // 三朵之间的蔓：S 形，不上直角
  out.push(`M0.48 0.62C0.56 0.46,0.62 0.46,0.70 0.62`);
  out.push(`M1.30 0.62C1.38 0.46,1.44 0.46,1.52 0.62`);
  return out;
}

// --- 8. 直棂 ---------------------------------------------------------------(最简)
// 等距竖棂，上下各一道横枨；不加花心，作为其余七式的对照基线。
function zhiling() {
  const out = [];
  const n = 11;
  const x0 = 0.13;
  const x1 = 1.87;
  const y0 = 0.16;
  const y1 = 0.88;
  out.push(seg(x0, y1, x1, y1));
  out.push(seg(x0, y0, x1, y0));
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * (i / (n - 1));
    out.push(seg(x, y0, x, y1));
  }
  return out;
}

const WANZI = wanzi();
const PATTERNS = [
  { key: 'wanzi', name: '万字回纹', feature: '一笔连万字，转角收方', sw: 0.016, d: WANZI.main, thin: WANZI.thin },
  { key: 'binglie', name: '冰裂纹', feature: '无规则冰裂，疏密自然', sw: 0.010, d: binglie() },
  { key: 'huiwen', name: '回纹', feature: '方回套叠，横竖收口', sw: 0.012, d: huiwen() },
  { key: 'yigenteng', name: '一根藤', feature: '一根藤蔓到底，回旋打卷', sw: 0.010, cap: 'round', d: yigenteng() },
  { key: 'denglong', name: '灯笼锦', feature: '灯笼套环，中心垂穗', sw: 0.010, d: denglongjin() },
  { key: 'haitang', name: '海棠', feature: '四瓣海棠，弧框套叠', sw: 0.010, d: haitang() },
  { key: 'lingzhi', name: '灵芝', feature: '灵芝云头，对称卷曲', sw: 0.010, d: lingzhi() },
  { key: 'zhiling', name: '直棂', feature: '直棂等距，收分最简', sw: 0.012, d: zhiling() },
];

// --- 自检：统计各类线条，确保八式不是换名字 --------------------------------
function signature(p) {
  let lines = 0; let curves = 0; let h = 0; let v = 0; let diag = 0;
  for (const d of p.d) {
    const subs = d.split('M').filter(Boolean);
    for (const s of subs) {
      if (/[CZ]/.test(s)) { curves++; continue; }
      const parts = s.split('L').filter(Boolean);
      if (parts.length === 1) {
        const [a, b] = parts[0].trim().split(/[ ,]+/).map(Number);
        if (Math.abs(b[1] - a[1]) < 1e-3) h++;
        else if (Math.abs(b[0] - a[0]) < 1e-3) v++;
        else diag++;
        lines++;
      } else {
        for (let i = 1; i < parts.length; i++) {
          const a = parts[i - 1].trim().split(/[ ,]+/).map(Number);
          const b = parts[i].trim().split(/[ ,]+/).map(Number);
          if (Math.abs(a[1] - b[1]) < 1e-3) h++;
          else if (Math.abs(a[0] - b[0]) < 1e-3) v++;
          else diag++;
          lines++;
        }
      }
    }
  }
  return { lines, curves, h, v, diag, paths: p.d.length };
}
for (const p of PATTERNS) {
  const s = signature(p);
  console.log(`${p.key.padEnd(10)} paths=${s.paths} lines=${s.lines} curves=${s.curves} H=${s.h} V=${s.v} D=${s.diag}`);
}

function panelSVG(p) {
  const body = p.d.map((d) => `<path d="${d}" />`).join('');
  const thin = (p.thin || []).map((d) => `<path d="${d}" />`).join('');
  return `<svg viewBox="0 0 2 1" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="2" height="1" fill="#ffffff"/>
    <path d="${FRAME}" fill="none" stroke-width="0.008" stroke="#111"/>
    <path d="${TOP_RAIL}" fill="none" stroke-width="0.020" stroke="#111"/>
    <g fill="none" stroke="#111" stroke-width="${p.sw}"
       stroke-linejoin="${p.cap ? 'round' : 'miter'}"
       stroke-linecap="${p.cap || 'butt'}">${body}</g>
    ${thin ? `<g fill="none" stroke="#111" stroke-width="0.007">${thin}</g>` : ''}
  </svg>`;
}

const cards = PATTERNS.map((p, i) => `
  <article class="card">
    <div class="panel">${panelSVG(p)}</div>
    <div class="caption">
      <div class="name"><span class="idx">${String(i + 1).padStart(2, '0')}</span>${p.name}</div>
      <div class="feature">${p.feature}</div>
    </div>
  </article>`).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1920px; height: 1358px; background: #fff; }
  body {
    font-family: "PingFang SC", "Hiragino Sans GB", "Heiti SC", "Songti SC", sans-serif;
    color: #111; padding: 64px 72px 48px;
    display: flex; flex-direction: column;
  }
  header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 34px; }
  h1 { margin: 0; font-size: 38px; font-weight: 600; letter-spacing: 2px; }
  .sub { font-size: 17px; color: #444; letter-spacing: 1px; }
  .note { font-size: 15px; color: #666; letter-spacing: .5px; }
  .grid { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: max-content; gap: 52px 26px; align-content: center; }
  .card { display: flex; flex-direction: column; min-height: 0; }
  .panel { width: 100%; aspect-ratio: 2 / 1; border: 0; }
  .panel svg { width: 100%; height: 100%; display: block; }
  .caption { padding: 14px 2px 0; }
  .name { font-size: 23px; font-weight: 600; letter-spacing: 1px; display: flex; align-items: baseline; gap: 10px; }
  .idx { font: 13px/1 "SF Mono", Menlo, monospace; color: #888; letter-spacing: 1px; }
  .feature { margin-top: 6px; font-size: 15px; color: #555; letter-spacing: .6px; }
  footer { margin-top: 26px; padding-top: 16px; border-top: 1px solid #bbb; display: flex; justify-content: space-between; font-size: 14px; color: #555; }
</style></head><body>
<header>
  <h1>挂落纹样样本 · 八式</h1>
  <div class="sub">同一开间 · 2:1 正视 · 只画格条 · 白底黑线</div>
</header>
<div class="grid">${cards}</div>
<footer>
  <div class="note">八式按各自构造规则生成，不是同一纹样改名或变形；用于选定后再做三维变体。</div>
  <div class="note">第 1 批二维定稿样片 · 未做透视 / 未上色</div>
</footer>
</body></html>`;

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: 'new',
  args: ['--force-device-scale-factor=2'],
  defaultViewport: { width: 1920, height: 1358, deviceScaleFactor: 2 },
  protocolTimeout: 120000,
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const file = path.join(OUT, 'gualuo-sample-sheet.png');
await page.screenshot({ path: file, type: 'png', fullPage: false });
await browser.close();
console.log('wrote', path.relative(ROOT, file));
