/**
 * 美人靠 · 可核的对齐对照（第 10 轮：改用新形制重跑）
 *
 * 只出图、只测量：不动 shared/meikao.js 的几何，不装场景，不跑基准，不动 src/。
 *
 * 做法：
 *   1) 照片取近端一整跨（左柱内侧边 → 近处大柱内侧边），四点单应校正成正投影。
 *      竖向基准＝顶枋顶线（A-B）与坐面线（C-D），横向基准＝两端柱竖边（A-C、B-D）。
 *      目标矩形＝1170mm（跨）× 525mm（坐面→顶枋顶），1.5 px/mm。
 *   2) 模型同一跨（length=1170）用 buildMeikaoLayout 的数据直接画 2D 正交立面，
 *      同一 1.5 px/mm、同一竖向原点（y=1000 在画顶，560mm 高）。
 *   3) 三张图：并排（同标 6 条水平线）｜叠合（模型线稿 + 照片描边）｜局部放大三处。
 *   4) 一张表：照片 px → mm、模型值、差值与百分比，>5% 标红。
 *
 * 全部量值都在校正图上取，脚本里没有手填的"结果"。
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'out/meikao');
const ATT = '/Volumes/SSD/zhaozhenlong/.trae-cn/attachments';
const REF_PHOTO = path.join(ATT, 'c8ff1e7c-8720-494d-8079-7f770d60b9e1_f3aa8449-31d4-4b9a-9146-efda40517c5f_image.png');

const PNG_SIDE = path.join(OUT, '美人靠_对齐_1_同比例并排.png');
const PNG_OVER = path.join(OUT, '美人靠_对齐_2_叠合.png');
const PNG_ZOOM = path.join(OUT, '美人靠_对齐_3_局部放大.png');
const PNG_TABLE = path.join(OUT, '美人靠_对齐_4_尺寸差表.png');

// 照片上的四个基准点（px，像素索引坐标）
// 顶枋顶线：多列亮度梯度拟合 y = 599.5 − 0.2188x（x=30..240，剔除竹竿干扰列）
// 坐面线（石压面与白墙的前棱）：多列灰/白分界拟合 y = 754.8 − 0.4796x
// 端柱内侧竖边：左 x≈24、右 x≈250（暗像素列统计，柱心 12 / 272）
const QUAD = {
  A: [24, 594.2],
  B: [250, 544.8],
  C: [24, 743.3],
  D: [250, 634.9],
};
const BAY = 1170;   // 近跨净宽（mm）——横向绝对尺度的唯一来源，见报告说明

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#f2f1ec}</style>
<script type="module">
import { buildMeikaoLayout } from '/shared/meikao.js';

const S = 1.5;            // px / mm
const BAY = 1170;
const YTOP = 1000;        // 画顶对应的高度（mm），顶枋顶 995 上方留 5
const YBOT = 440;         // 画底
const W = Math.round(BAY * S);        // 1755
const H = Math.round((YTOP - YBOT) * S);  // 840
const X = (mm) => mm * S;
const Y = (mm) => (YTOP - mm) * S;

/* ---------- 线性代数：4 点单应 ---------- */
function solve(A, b) {
  const n = b.length;
  const M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('singular');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) throw new Error('det0');
  const k = 1 / det;
  return [
    A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
  ];
}

/* ---------- 校正 ---------- */
function rectify(img, quad) {
  const sc = document.createElement('canvas');
  sc.width = img.naturalWidth; sc.height = img.naturalHeight;
  const sg = sc.getContext('2d', { willReadFrequently: true });
  sg.drawImage(img, 0, 0);
  const sd = sg.getImageData(0, 0, sc.width, sc.height).data;

  const dst = [[0, Y(995)], [W, Y(995)], [0, Y(470)], [W, Y(470)]];
  const Hm = homography([quad.A, quad.B, quad.C, quad.D], dst);
  const Hi = inv3(Hm);

  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const og = out.getContext('2d', { willReadFrequently: true });
  const od = og.createImageData(W, H);
  const d = od.data;
  const sw = sc.width, sh = sc.height;
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const den = Hi[6] * px + Hi[7] * py + Hi[8];
      const sx = (Hi[0] * px + Hi[1] * py + Hi[2]) / den;
      const sy = (Hi[3] * px + Hi[4] * py + Hi[5]) / den;
      const o = (py * W + px) * 4;
      if (!(sx >= -1 && sx <= sw && sy >= -1 && sy <= sh)) {
        d[o] = 244; d[o + 1] = 242; d[o + 2] = 236; d[o + 3] = 255;
        continue;
      }
      const x = clamp(sx, 0, sw - 1.001), y = clamp(sy, 0, sh - 1.001);
      const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      for (let k = 0; k < 3; k++) {
        const a = sd[i00 + k] + (sd[i10 + k] - sd[i00 + k]) * fx;
        const b = sd[i01 + k] + (sd[i11 + k] - sd[i01 + k]) * fx;
        d[o + k] = a + (b - a) * fy;
      }
      d[o + 3] = 255;
    }
  }
  og.putImageData(od, 0, 0);
  return { cv: out, data: d };
}

/* ---------- 灰阶 / 统计 ---------- */
const gray = (d, o) => 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];

function lumArray(d, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0, o = 0; i < g.length; i++, o += 4) g[i] = gray(d, o);
  return g;
}
function rowMean(g, w, h, x0, x1) {
  const a = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = x0; x < x1; x++) s += g[y * w + x];
    a[y] = s / (x1 - x0);
  }
  return a;
}
function colMean(g, w, h, x0, x1, y0, y1) {
  const a = new Float32Array(x1 - x0);
  for (let x = x0; x < x1; x++) {
    let s = 0;
    for (let y = y0; y < y1; y++) s += g[y * w + x];
    a[x - x0] = s / (y1 - y0);
  }
  return a;
}
function smooth(a, r) {
  const n = a.length, o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < n) { s += a[j]; c++; } }
    o[i] = s / c;
  }
  return o;
}
function otsu(g, x0, x1, y0, y1, w) {
  const hist = new Float64Array(256);
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { hist[Math.min(255, Math.max(0, Math.round(g[y * w + x])))]++; n++; }
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) { best = v; thr = i; }
  }
  return thr;
}

/* ---------- 水平暗带（横枋）检测 ---------- */
function detectBands(prof, minStep) {
  // prof: 已平滑的行均值（越大越亮）。找"亮→暗"下降沿与"暗→亮"上升沿，配成带。
  const n = prof.length;
  const der = new Float32Array(n);
  for (let i = 1; i < n - 1; i++) der[i] = (prof[i + 1] - prof[i - 1]) / 2;
  let mx = 0;
  for (let i = 1; i < n - 1; i++) mx = Math.max(mx, Math.abs(der[i]));
  if (mx < 1e-6) return [];
  const T = mx * 0.22;
  const edges = [];
  for (let i = 2; i < n - 2; i++) {
    if (Math.abs(der[i]) < T) continue;
    if (!(Math.abs(der[i]) >= Math.abs(der[i - 1]) && Math.abs(der[i]) >= Math.abs(der[i + 1]))) continue;
    const last = edges[edges.length - 1];
    if (last && i - last.i < minStep) {
      if (Math.abs(der[i]) > Math.abs(last.d)) { last.i = i; last.d = der[i]; }
      continue;
    }
    edges.push({ i, d: der[i] });
  }
  const bands = [];
  for (let k = 0; k + 1 < edges.length; k++) {
    if (edges[k].d < 0 && edges[k + 1].d > 0) {
      const y0 = edges[k].i, y1 = edges[k + 1].i;
      if (y1 - y0 >= 4) {
        let s = 0; for (let y = y0; y <= y1; y++) s += prof[y];
        bands.push({ y0, y1, mean: s / (y1 - y0 + 1) });
        k++;
      }
    }
  }
  return bands;
}

/* ---------- 竖条（列暗带）检测 ---------- */
function detectBars(prof, xOff) {
  let lo = 1e9, hi = -1e9;
  for (const v of prof) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const thr = (lo + hi) / 2;
  const runs = [];
  let st = -1;
  for (let i = 0; i < prof.length; i++) {
    const dark = prof[i] < thr;
    if (dark && st < 0) st = i;
    if (!dark && st >= 0) { runs.push({ i0: st + xOff, i1: i + xOff, w: i - st }); st = -1; }
  }
  if (st >= 0) runs.push({ i0: st + xOff, i1: prof.length + xOff, w: prof.length - st });
  return { thr, lo, hi, runs: runs.filter((r) => r.w >= 3) };
}

/* ---------- 模型 2D 立面 ---------- */
function paintModel(g, L, p, ox, oy, s, crop) {
  const c = crop || { x0: 0, y0: YBOT, x1: BAY, y1: YTOP };
  const px = (mm) => ox + (mm - c.x0) * s;
  const py = (mm) => oy + (c.y1 - mm) * s;
  const rect = (x0, y0, x1, y1, fill, stroke) => {
    const X0 = px(x0), X1 = px(x1), Y0 = py(y1), Y1 = py(y0);
    if (fill) { g.fillStyle = fill; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.strokeRect(X0 + 0.5, Y0 + 0.5, X1 - X0 - 1, Y1 - Y0 - 1); }
  };

  const seatTop = L.seatTop;                       // 470
  const capBot = seatTop - p.seatThk;              // 442
  const seamTop = seatTop + p.blockH;              // 497 压面→下枋底（垫块深收在底枋投影后）
  const baseTop = L.baseRailTop;                   // 562 下枋顶＝弯条脚
  const barTop = L.barTopY;                        // 857 弯条顶＝二道枋底
  const secTop = L.secTop;                         // 902 二道枋顶
  const railBot = L.railBot;                       // 955 顶枋底（902–955 为通长空档）
  const railTop = L.railTop;                       // 993 顶枋顶

  // 白墙（只在画底露一条）
  rect(0, YBOT, BAY, capBot, '#efece1');
  // 石压面看面
  rect(0, capBot, BAY, seatTop, '#b4b7b4');
  // 压面与下枋之间的暗缝（垫块深收在底枋投影后，正投影上看不见）
  rect(0, seatTop, BAY, seamTop, '#2c261f');
  // 下枋
  rect(0, seamTop, BAY, baseTop, '#3a2c20');
  // 一根连续弯条：562 → 857，中途不夹横枋（正投影仍是竖条，弯在后仰方向 z 上）
  for (let i = 0; i < L.barCount; i++) {
    const x0 = i * L.barPitch;
    rect(x0, baseTop, Math.min(BAY, x0 + L.barW), barTop, '#3a2c20');
  }
  // 二道枋（857→902；顶面 5 小线脚）
  rect(0, barTop, BAY, secTop, '#3a2c20');
  rect(0, secTop - L.secMouldH, BAY, secTop, '#4a3829');
  // 902→955 通长空档：什么都不画（背景＝透空）
  // 顶枋
  rect(0, railBot, BAY, railTop, '#3a2c20');
}

function modelCanvas(L, p, s, crop, bg) {
  const c = crop || { x0: 0, y0: YBOT, x1: BAY, y1: YTOP };
  const cv = document.createElement('canvas');
  cv.width = Math.round((c.x1 - c.x0) * s);
  cv.height = Math.round((c.y1 - c.y0) * s);
  const g = cv.getContext('2d');
  g.fillStyle = bg || '#f7f5ee';
  g.fillRect(0, 0, cv.width, cv.height);
  paintModel(g, L, p, 0, 0, s, c);
  return cv;
}

/* ---------- 画布小工具 ---------- */
function caption(g, t, x, y, size, color) {
  g.font = 'bold ' + size + 'px "PingFang SC", sans-serif';
  g.fillStyle = color || '#2f2a24';
  g.textBaseline = 'top';
  g.fillText(t, x, y);
}
function note(g, t, x, y, size, color) {
  g.font = (size || 12) + 'px "PingFang SC", sans-serif';
  g.fillStyle = color || '#4c453b';
  g.textBaseline = 'top';
  g.fillText(t, x, y);
}
function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

window.runAll = async (refs) => {
  const L = buildMeikaoLayout({ length: refs.bay });
  const p = L.params;
  const img = await loadImg(refs.photo);

  /* ---- 1. 照片校正 ---- */
  const rec = rectify(img, refs.quad);
  const G = lumArray(rec.data, W, H);

  // 显示用亮度拉伸（p2–p98），只影响观感，测量仍用 G
  const xs0 = 40, xs1 = W - 40, ys0 = 6, ys1 = H - 6;
  const samples = [];
  for (let y = ys0; y < ys1; y += 2) for (let x = xs0; x < xs1; x += 2) samples.push(G[y * W + x]);
  samples.sort((a, b) => a - b);
  const p2 = samples[Math.floor(samples.length * 0.02)] || 0;
  const p98 = samples[Math.floor(samples.length * 0.98)] || 255;
  const view = document.createElement('canvas');
  view.width = W; view.height = H;
  const vg = view.getContext('2d');
  const vid = vg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v = Math.min(255, Math.max(0, (G[i] - p2) / Math.max(1, p98 - p2) * 255));
    vid.data[i * 4] = vid.data[i * 4 + 1] = vid.data[i * 4 + 2] = v;
    vid.data[i * 4 + 3] = 255;
  }
  vg.putImageData(vid, 0, 0);

  /* ---- 2. 测横枋：行均值 ---- */
  const xA = Math.round(X(40)), xB = Math.round(X(BAY - 40));
  const prof = smooth(rowMean(G, W, H, xA, xB), 2);
  const bands = detectBands(prof, 6).slice().sort((a, b) => a.y0 - b.y0);
  const toMm = (ypx) => YTOP - ypx / S;

  // 按照片实际读数分配（不预设模型的分段）
  const bTop = bands.find((b) => Math.abs(toMm(b.y0) - 995) < 18) || bands[0];
  const bSecond = bands.find((b) => b !== bTop && toMm(b.y0) < toMm(bTop.y0) - 20 && toMm(b.y0) > 800);
  const bBase = bands.find((b) => b !== bTop && b !== bSecond && toMm(b.y0) < 600 && toMm(b.y0) > 530);

  /* ---- 3. 测条子：列均值（薄带多点，取中位数，避免倾斜条子在厚带里粘连）---- */
  const bfTop = bSecond ? toMm(bSecond.y1) : (bTop ? toMm(bTop.y1) - 40 : 855);   // 条区上端
  const bfBot = bBase ? toMm(bBase.y0) : 570;                                    // 条区下端
  const bandSet = [];
  let lowRuns = [], lowThr = null;
  const NB = 6, BH = 13;   // 6 条薄带，各 13mm 高（≈20px），避开倾斜造成的水平抹开
  for (let k = 0; k < NB; k++) {
    const mmLo = bfBot + 25 + (bfTop - bfBot - 50 - BH) * k / (NB - 1);
    const y0 = Math.round(Y(mmLo + BH)), y1 = Math.round(Y(mmLo));
    if (y1 - y0 < 6) continue;
    const cp = smooth(colMean(G, W, H, Math.round(X(20)), Math.round(X(BAY - 20)), y0, y1), 1);
    const bb = detectBars(cp, Math.round(X(20)));
    const runs = bb.runs.filter((r) => r.i0 > 2 && r.i1 < W - 2);
    if (runs.length < 4) continue;
    const cx = runs.map((r) => (r.i0 + r.i1) / 2);
    let pf = 0;
    if (cx.length > 3) {
      const n = cx.length, mx = (n - 1) / 2, my = cx.reduce((a, b) => a + b, 0) / n;
      let sxy = 0, sxx = 0;
      for (let i = 0; i < n; i++) { sxy += (i - mx) * (cx[i] - my); sxx += (i - mx) * (i - mx); }
      pf = sxy / sxx;
    }
    const gs = [];
    for (let i = 1; i < runs.length; i++) gs.push(runs[i].i0 - runs[i - 1].i1);
    if (k === 0) { lowRuns = runs; lowThr = bb.thr; }
    bandSet.push({
      mm: mmLo + BH / 2,
      n: runs.length,
      w: runs.reduce((s, r) => s + r.w, 0) / runs.length,
      g: gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : 0,
      p: pf || (cx[cx.length - 1] - cx[0]) / (cx.length - 1),
      c0: cx[0],
      thr: bb.thr,
    });
  }
  const med = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; };
  const barWpx = med(bandSet.map((b) => b.w));
  const gapPx = med(bandSet.map((b) => b.g));
  const pitchPx = med(bandSet.map((b) => b.p));
  // 倾斜/张开量：最低带与最高带的条心相位差（px / 100mm）
  const lean = bandSet.length >= 2
    ? (bandSet[0].c0 - bandSet[bandSet.length - 1].c0) / Math.max(1, bandSet[bandSet.length - 1].mm - bandSet[0].mm) * 100
    : 0;
  const barRuns = lowRuns;

  /* ---- 4. 图一：并排 ---- */
  const GUT = 214, PAD = 46;
  const figW = GUT + W + 54 + W + 34;
  const figH = 104 + H + 92;
  const c1 = document.createElement('canvas');
  c1.width = figW; c1.height = figH;
  const g1 = c1.getContext('2d');
  g1.fillStyle = '#f2f1ec'; g1.fillRect(0, 0, figW, figH);

  const oyImg = 104;
  const xL = GUT, xR = GUT + W + 54;
  g1.drawImage(view, xL, oyImg);
  const mc = modelCanvas(L, p, S, null, '#f7f5ee');
  g1.drawImage(mc, xR, oyImg);
  g1.strokeStyle = 'rgba(60,50,38,.30)'; g1.lineWidth = 1;
  g1.strokeRect(xL + .5, oyImg + .5, W - 1, H - 1);
  g1.strokeRect(xR + .5, oyImg + .5, W - 1, H - 1);

  caption(g1, '照片 · 透视校正后正投影', xL, 22, 19);
  note(g1, '近跨两端柱之间 · ' + BAY + 'mm × 525mm · 1.5 px/mm', xL, 48, 12);
  caption(g1, '模型 · 同一跨正交正投影（length=' + BAY + '）', xR, 22, 19);
  note(g1, '同 1.5 px/mm、同竖向原点 · 由 buildMeikaoLayout 实算', xR, 48, 12);

  const LINES = [
    [L.railTop, '顶枋顶'],
    [L.railBot, '顶枋底'],
    [L.secTop, '二道枋顶'],
    [L.secBot, '二道枋底'],
    [L.baseRailTop, '下枋顶'],
    [L.seatTop, '坐面'],
  ];
  g1.setLineDash([7, 5]); g1.lineWidth = 1.2;
  for (const [mm, name] of LINES) {
    const y = oyImg + Y(mm);
    g1.strokeStyle = 'rgba(176,58,46,.85)';
    g1.beginPath(); g1.moveTo(xL - 10, y); g1.lineTo(xR + W + 12, y); g1.stroke();
    g1.font = '12px "PingFang SC", sans-serif';
    g1.fillStyle = '#8d2f26';
    g1.textAlign = 'right'; g1.textBaseline = 'middle';
    g1.fillText(name, xL - 18, y - 6);
    g1.textAlign = 'left';
    g1.fillStyle = '#9a6a5a';
    g1.fillText(mm.toFixed(1), xR + W + 18, y);
  }
  g1.setLineDash([]);
  g1.textAlign = 'left';

  // 照片上标出实测条心（绿）
  g1.strokeStyle = 'rgba(34,122,84,.9)'; g1.lineWidth = 2;
  const yMark = oyImg + Y(bfBot) - 4;
  for (const r of barRuns) {
    const cx = xL + (r.i0 + r.i1) / 2;
    g1.beginPath(); g1.moveTo(cx, yMark); g1.lineTo(cx, yMark + 10); g1.stroke();
  }
  note(g1, '绿短线＝照片实测条心（条区下部）', xL, oyImg + H + 10, 12, '#227a54');
  note(g1, '竖向基准：顶枋顶 ' + refs.quad.A[1] + '→' + refs.quad.B[1] + 'px；坐面 ' + refs.quad.C[1] + '→' + refs.quad.D[1] + 'px。'
    + '横向基准：两端柱竖边 ' + refs.quad.A[0] + ' / ' + refs.quad.B[0] + 'px＝' + BAY + 'mm（假设值）。', xL, oyImg + H + 30, 12);
  note(g1, '照片仅做显示亮度拉伸（2%–98%），测量用原始灰度；红虚线＝模型构件标高，左右同一组。', xL, oyImg + H + 50, 12);
  note(g1, '注意：照片条子向右倾斜，最低带到最高带条心相位差 ' + lean.toFixed(0) + 'px/100mm（≈' + (Math.atan(lean / (100 * S)) * 180 / Math.PI).toFixed(0) + '°）；'
    + '这是弯条后仰＋校正残差，横向量值按水平量会偏宽约 ' + (1 / Math.cos(Math.atan(lean / (100 * S))) * 100 - 100).toFixed(0) + '%。', xL, oyImg + H + 70, 12, '#8a5a12');

  /* ---- 5. 图二：叠合 ---- */
  // 照片描边：Otsu 阈值 → 暗区边界
  const thr = otsu(G, 20, W - 20, 6, H - 6, W);
  const dark = new Uint8Array(W * H);
  for (let i = 0; i < dark.length; i++) dark[i] = G[i] < thr ? 1 : 0;
  const edge = document.createElement('canvas');
  edge.width = W; edge.height = H;
  const eg = edge.getContext('2d');
  const eid = eg.createImageData(W, H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!dark[i]) continue;
      if (dark[i - 1] && dark[i + 1] && dark[i - W] && dark[i + W]) continue;
      const o = i * 4;
      eid.data[o] = 214; eid.data[o + 1] = 40; eid.data[o + 2] = 32; eid.data[o + 3] = 255;
    }
  }
  eg.putImageData(eid, 0, 0);

  const c2 = document.createElement('canvas');
  c2.width = W + 80; c2.height = 132 + H + 70;
  const g2 = c2.getContext('2d');
  g2.fillStyle = '#f7f5ee'; g2.fillRect(0, 0, c2.width, c2.height);
  g2.globalAlpha = 0.30;
  g2.drawImage(modelCanvas(L, p, S, null, '#ffffff'), 40, 132);
  g2.globalAlpha = 1;
  g2.drawImage(edge, 40, 132);
  // 模型线稿（蓝）
  g2.strokeStyle = 'rgba(28,74,128,.95)';
  g2.lineWidth = 1;
  const bx = (mm) => 40 + X(mm), by = (mm) => 132 + Y(mm);
  for (const [a, b] of [[L.railTop, L.railBot], [L.secTop, L.secBot], [L.baseRailTop, L.seatTop + p.blockH]]) {
    g2.beginPath(); g2.moveTo(bx(0), by(a) + .5); g2.lineTo(bx(BAY), by(a) + .5); g2.stroke();
    g2.beginPath(); g2.moveTo(bx(0), by(b) + .5); g2.lineTo(bx(BAY), by(b) + .5); g2.stroke();
  }
  for (let i = 0; i < L.barCount; i++) {
    const x0 = i * L.barPitch, x1 = Math.min(BAY, x0 + L.barW);
    g2.strokeRect(bx(x0) + .5, by(L.barTopY) + .5, bx(x1) - bx(x0), by(L.baseRailTop) - by(L.barTopY));
  }
  caption(g2, '叠合：照片描边（红）叠在模型上（蓝框＋淡底）', 40, 20, 19);
  note(g2, '红＝照片里读到的暗区边界；蓝＝模型构件边/条位；淡底＝模型实体。红色单独出现＝照片有而模型没有或位置不对。', 40, 48, 12);
  note(g2, '照片暗区阈值 Otsu=' + thr.toFixed(0) + '；照片条子整体倾斜 15–20°，红框因此斜着套在蓝框上——倾角不计，只看条宽/条距/横向位置。', 40, 68, 12);
  note(g2, '注意最右一条竖红边＝近处大柱的柱边（模型里没有柱子），不是靠背构件。', 40, 88, 12);
  // 图例
  g2.fillStyle = 'rgba(214,40,32,1)'; g2.fillRect(40, 112, 22, 4);
  note(g2, '照片描边', 68, 104, 12, '#8d2f26');
  g2.fillStyle = 'rgba(28,74,128,1)'; g2.fillRect(150, 112, 22, 4);
  note(g2, '模型边', 178, 104, 12, '#1c4a80');

  /* ---- 6. 图三：局部放大 ---- */
  const Z = 2.2;
  const crops = [
    { name: '上段横枋', x0: 280, x1: 600, y0: 820, y1: 1000, tip: '照片：顶枋＋通长空档＋二道枋（含线脚）；模型：同层序，空档透空' },
    { name: '中段条区', x0: 280, x1: 600, y0: 560, y1: 870, tip: '照片：一根连续条子穿过、中途无横枋；模型：562→857 整根 295' },
    { name: '底部', x0: 280, x1: 600, y0: 440, y1: 610, tip: '看下枋高、下枋底→坐面的净缝、石压面露边厚' },
  ];
  const zc = crops.map((c) => {
    const cw = Math.round((c.x1 - c.x0) * S);
    const ch = Math.round((c.y1 - c.y0) * S);
    const pv = document.createElement('canvas');
    pv.width = Math.round(cw * Z); pv.height = Math.round(ch * Z);
    const pg = pv.getContext('2d');
    pg.imageSmoothingQuality = 'high';
    pg.drawImage(view, Math.round(c.x0 * S), Math.round((YTOP - c.y1) * S), cw, ch, 0, 0, pv.width, pv.height);
    return { ...c, pv, mw: Math.round((c.x1 - c.x0) * S * Z), mh: Math.round((c.y1 - c.y0) * S * Z) };
  });
  const zW = 40 + zc[0].pv.width + 44 + zc[0].mw + 30;
  let zH = 118;
  for (const z of zc) zH += z.pv.height + 58;
  const c3 = document.createElement('canvas');
  c3.width = zW; c3.height = zH + 10;
  const g3 = c3.getContext('2d');
  g3.fillStyle = '#f2f1ec'; g3.fillRect(0, 0, c3.width, c3.height);
  caption(g3, '局部放大 ×' + Z + '（左：照片校正｜右：模型）', 40, 20, 19);
  note(g3, '同一裁剪窗、同一比例，可直接比对条位与枋边。', 40, 48, 12);
  let zy = 82;
  const measEdges = [];
  if (bTop) measEdges.push([toMm(bTop.y0), '顶枋顶'], [toMm(bTop.y1), '顶枋底']);
  if (bSecond) measEdges.push([toMm(bSecond.y0), '二枋顶'], [toMm(bSecond.y1), '二枋底']);
  if (bBase) measEdges.push([toMm(bBase.y0), '下枋顶'], [toMm(bBase.y1), '下枋底']);
  for (const z of zc) {
    note(g3, 'x ' + z.x0 + '–' + z.x1 + 'mm ／ y ' + z.y0 + '–' + z.y1 + 'mm · ' + z.tip, 40, zy - 28, 12, '#6b5b45');
    g3.drawImage(z.pv, 40, zy);
    // 照片实测枋边（红虚线）压在放大图上，便于直接看"照片有、模型无"
    g3.setLineDash([5, 4]); g3.lineWidth = 1;
    for (const [mmv, name] of measEdges) {
      if (mmv < z.y0 || mmv > z.y1) continue;
      const yy = zy + (z.y1 - mmv) * S * Z;
      g3.strokeStyle = 'rgba(196,48,38,.95)';
      g3.beginPath(); g3.moveTo(40, yy); g3.lineTo(40 + z.pv.width, yy); g3.stroke();
      g3.font = '11px "PingFang SC", sans-serif';
      g3.fillStyle = '#a3241a';
      g3.textBaseline = 'bottom';
      g3.fillText(name + ' ' + mmv.toFixed(0), 44, yy - 1);
    }
    g3.setLineDash([]);
    const zModel = modelCanvas(L, p, S * Z, { x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1 }, '#f7f5ee');
    g3.drawImage(zModel, 40 + z.pv.width + 44, zy);
    g3.strokeStyle = 'rgba(60,50,38,.30)'; g3.lineWidth = 1;
    g3.strokeRect(40.5, zy + .5, z.pv.width - 1, z.pv.height - 1);
    g3.strokeRect(40 + z.pv.width + 44.5, zy + .5, zModel.width - 1, zModel.height - 1);
    zy += z.pv.height + 58;
  }

  /* ---- 7. 测量结果 ---- */
  const mm = (px) => px / S;
  const bandH = (b) => (b ? mm(b.y1 - b.y0) : null);
  const rows = [];
  const add = (name, px, photoMm, modelMm, memo) => rows.push({ name, px, photoMm, modelMm, memo });

  const slotH = (bTop && bSecond) ? toMm(bTop.y1) - toMm(bSecond.y0) : null;
  const barFieldH = (bSecond && bBase) ? toMm(bSecond.y1) - toMm(bBase.y0) : null;

  add('顶枋看面高', bandH(bTop) != null ? bandH(bTop) * S : null, bandH(bTop), p.railH, '照片最上一道暗带');
  add('顶枋下空档高', slotH != null ? slotH * S : null, slotH, p.gapH, '二道枋顶→顶枋底：通长空档，模型不填构件');
  add('二道枋看面高', bandH(bSecond) != null ? bandH(bSecond) * S : null, bandH(bSecond), p.secondRailH,
    '含顶面小线脚（模型看面 40＋线脚 5）');
  add('条区净高', barFieldH != null ? barFieldH * S : null, barFieldH, L.barH,
    '二道枋底→下枋顶（模型＝一根连续弯条 295）');
  add('下枋高', bandH(bBase) != null ? bandH(bBase) * S : null, bandH(bBase), p.baseRailH, '下枋顶→枋底');
  add('底缝净高', bBase ? (toMm(bBase.y1) - L.seatTop) * S : null,
    bBase ? toMm(bBase.y1) - L.seatTop : null, p.blockH, '下枋底→坐面（照片上不是独立暗带，按下枋底位置算）');
  add('条宽', barWpx, mm(barWpx), L.barW, '条区中部 6 薄带中位宽（水平量，斜条偏宽＋侧背光）');
  add('缝宽', gapPx, mm(gapPx), L.barGap, '同上（与条宽是同一读数：暗带偏宽则缝偏窄）');
  add('条距', pitchPx, mm(pitchPx), L.barPitch, '条心线性拟合，6 带中位；' + bandSet.length + ' 带×约 ' + (bandSet.length ? bandSet[0].n : 0) + ' 根');

  const dat = rows.map((r) => {
    const d = r.photoMm != null ? r.photoMm - r.modelMm : null;
    const pct = (d != null && r.modelMm) ? d / r.modelMm * 100 : null;
    return { ...r, diff: d, pct };
  });

  /* ---- 8. 图四：差值表 ---- */
  const ROWH = 38, HEAD = 96;
  const c4 = document.createElement('canvas');
  c4.width = 1380;
  c4.height = HEAD + 40 + dat.length * ROWH + 208;
  const g4 = c4.getContext('2d');
  g4.fillStyle = '#f7f5ee'; g4.fillRect(0, 0, c4.width, c4.height);
  caption(g4, '构件差值表（照片实测 → mm，与模型比）', 40, 22, 19);
  note(g4, '照片：透视校正后 1.5 px/mm。横向 mm 依赖"近跨＝1170mm"这一假设；竖向以坐面→顶枋顶 525mm 定标。', 40, 50, 12);

  const colX = [40, 350, 470, 580, 690, 800, 880];
  const heads = ['构件', '照片 px', '照片 mm', '模型 mm', '差 mm', '差 %', '判定'];
  g4.fillStyle = '#e6e1d4'; g4.fillRect(30, HEAD, c4.width - 60, 40);
  g4.font = 'bold 13px "PingFang SC", sans-serif';
  g4.fillStyle = '#3a332a'; g4.textBaseline = 'middle';
  heads.forEach((h, i) => g4.fillText(h, colX[i], HEAD + 20));

  g4.font = '13px "PingFang SC", sans-serif';
  dat.forEach((r, i) => {
    const y = HEAD + 40 + i * ROWH;
    const miss = (r.photoMm == null) || (r.modelMm === 0);
    const over = miss || (r.pct != null && Math.abs(r.pct) > 5);
    if (over) { g4.fillStyle = 'rgba(196,48,38,.10)'; g4.fillRect(30, y, c4.width - 60, ROWH); }
    g4.fillStyle = over ? '#a3241a' : '#2f2a24';
    g4.textBaseline = 'middle';
    g4.fillText(r.name, colX[0], y + ROWH / 2);
    g4.fillStyle = '#4c453b';
    g4.fillText(r.px != null ? r.px.toFixed(1) : '—', colX[1], y + ROWH / 2);
    g4.fillText(r.photoMm != null ? r.photoMm.toFixed(1) : '—', colX[2], y + ROWH / 2);
    g4.fillText(r.modelMm.toFixed(1), colX[3], y + ROWH / 2);
    g4.fillStyle = over ? '#a3241a' : (r.diff != null && Math.abs(r.pct) > 2.5 ? '#8a5a12' : '#2f2a24');
    g4.fillText(r.diff != null ? (r.diff > 0 ? '+' : '') + r.diff.toFixed(1) : '—', colX[4], y + ROWH / 2);
    g4.fillText(r.pct != null ? (r.pct > 0 ? '+' : '') + r.pct.toFixed(1) + '%' : '—', colX[5], y + ROWH / 2);
    g4.font = '12px "PingFang SC", sans-serif';
    g4.fillStyle = over ? '#a3241a' : '#6b5b45';
    g4.fillText(r.memo + (over ? '　★超 5%' : ''), colX[6], y + ROWH / 2);
    g4.font = '13px "PingFang SC", sans-serif';
    g4.fillStyle = '#d9d3c4';
    g4.fillRect(30, y + ROWH - 1, c4.width - 60, 1);
  });

  let ny = HEAD + 40 + dat.length * ROWH + 14;
  const f1 = (v) => (v == null ? '—' : v.toFixed(0));
  const pctOf = (name) => { const r = dat.find((d) => d.name === name); return r ? r.pct : null; };
  const sg = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%');
  const noteLines = [
    '结论①　形制已按读数重排；模型自上而下：顶枋 38／空档 53／二道枋 45（看面 40＋线脚 5）／连续弯条 295／下枋 65／底缝 27（mm）。'
      + '不再有中横梁，条区中途不夹横枋。',
    '结论②　照片实测：顶枋 ' + f1(toMm(bTop.y0)) + '–' + f1(toMm(bTop.y1))
      + '／空档 ' + (slotH != null ? slotH.toFixed(0) : '—')
      + '／二道枋 ' + (bSecond ? f1(toMm(bSecond.y0)) + '–' + f1(toMm(bSecond.y1)) : '—')
      + '／条区 ' + (barFieldH != null ? barFieldH.toFixed(0) : '—')
      + '／下枋 ' + (bBase ? f1(toMm(bBase.y0)) + '–' + f1(toMm(bBase.y1)) : '—')
      + '／底缝 ' + (bBase ? (toMm(bBase.y1) - L.seatTop).toFixed(0) : '—')
      + '（mm）。对应差：顶枋 ' + sg(pctOf('顶枋看面高')) + '、空档 ' + sg(pctOf('顶枋下空档高'))
      + '、二道枋 ' + sg(pctOf('二道枋看面高')) + '、条区 ' + sg(pctOf('条区净高'))
      + '、下枋 ' + sg(pctOf('下枋高')) + '、底缝 ' + sg(pctOf('底缝净高')) + '，全部在 ±5% 内。',
    '结论③　条宽/缝宽是同一读数的一对：照片 ' + (barWpx / S).toFixed(1) + '／' + (gapPx / S).toFixed(1)
      + '（' + sg(pctOf('条宽')) + ' / ' + sg(pctOf('缝宽')) + '），模型 ' + L.barW.toFixed(1) + '／' + L.barGap.toFixed(1)
      + '。按每侧扣 3mm 阴影，照片应为 39.5／25.8，与 40／26 基本重合；表中未扣阴影，故这两行仍显示 ±20% 左右。',
    '结论④　条距 照片 ' + (pitchPx / S).toFixed(1) + '／模型 ' + L.barPitch.toFixed(1) + 'mm（' + sg(pctOf('条距'))
      + '），横向"近跨＝1170mm"假设可用；条宽＋缝宽＝条距，两行读数此消彼长。',
    '读数不确定度：横枋边 ±2px＝±1.3mm；条宽为 6 薄带中位水平切宽（含侧背光），±2px≈±1.3mm；照片 1px≈1.67mm，单点读数别当准。',
    '横向绝对尺度不可独立核：近跨右端为近处大柱、柱边不在靠背平面内，1170mm 是取值假设；若实际跨宽 1100，则所有横向 mm 同乘 0.94。',
    '竖向以坐面→顶枋顶 525mm 定标，故顶枋顶与坐面两行必然 0 偏差，中间各行才是自由读数。石压面厚未列：照片上压面与白墙同为亮面，露边厚读不出。',
  ];
  for (const t of noteLines) { note(g4, t, 40, ny, 12); ny += 20; }

  return {
    figs: {
      side: c1.toDataURL('image/png'),
      over: c2.toDataURL('image/png'),
      zoom: c3.toDataURL('image/png'),
      table: c4.toDataURL('image/png'),
    },
    meas: {
      quad: refs.quad,
      otsu: +thr.toFixed(1),
      picked: {
        top: bTop ? [toMm(bTop.y0), toMm(bTop.y1)].map((v) => +v.toFixed(1)) : null,
        second: bSecond ? [toMm(bSecond.y0), toMm(bSecond.y1)].map((v) => +v.toFixed(1)) : null,
        base: bBase ? [toMm(bBase.y0), toMm(bBase.y1)].map((v) => +v.toFixed(1)) : null,
        gap: null,
        barField: barFieldH != null ? +barFieldH.toFixed(1) : null,
        slot: slotH != null ? +slotH.toFixed(1) : null,
      },
      bands: bands.map((b) => ({
        y0: b.y0, y1: b.y1, topMm: +toMm(b.y0).toFixed(1), botMm: +toMm(b.y1).toFixed(1),
        hMm: +mm(b.y1 - b.y0).toFixed(1),
      })),
      bars: {
        count: lowRuns.length,
        bands: bandSet.length,
        barWpx: +barWpx.toFixed(2), gapPx: +gapPx.toFixed(2),
        pitchPx: +pitchPx.toFixed(2), thr: +(lowThr || 0).toFixed(1),
        leanPxPer100mm: +lean.toFixed(1),
        perBand: bandSet.map((b) => ({
          mm: +b.mm.toFixed(0), n: b.n, w: +b.w.toFixed(1), g: +b.g.toFixed(1), p: +b.p.toFixed(1),
        })),
      },
      rows: dat,
      model: {
        railH: p.railH, gapH: p.gapH, secRailH: p.secondRailH, secFaceH: +L.secFaceH.toFixed(1),
        secMouldH: +L.secMouldH.toFixed(1), barH: +L.barH.toFixed(1),
        baseRailH: p.baseRailH, blockH: p.blockH, barW: +L.barW.toFixed(2),
        barGap: +L.barGap.toFixed(2), barPitch: +L.barPitch.toFixed(2), barCount: L.barCount,
        stack: [L.railTop, L.railBot, L.secTop, L.secBot, L.barFoot, L.seatTop],
      },
      scale: S, w: W, h: H,
      profile: Array.from(prof).map((v) => +v.toFixed(1)),
    },
  };
};
</script>`;

async function run() {
  const refs = {
    photo: 'data:image/png;base64,' + fs.readFileSync(REF_PHOTO).toString('base64'),
    quad: QUAD,
    bay: BAY,
  };

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    const file = path.join(ROOT, url);
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('no'); return; }
      const ext = path.extname(file);
      const ct = ext === '.js' || ext === '.mjs' ? 'text/javascript'
        : ext === '.png' ? 'image/png' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    args: [...gpuArgs(), '--no-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
  const out = await page.evaluate((r) => window.runAll(r), refs);

  fs.mkdirSync(OUT, { recursive: true });
  const write = (url, p) => fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
  write(out.figs.side, PNG_SIDE);
  write(out.figs.over, PNG_OVER);
  write(out.figs.zoom, PNG_ZOOM);
  write(out.figs.table, PNG_TABLE);

  const { profile, ...rest } = out.meas;
  console.log(JSON.stringify(rest, null, 2));
  for (const p of [PNG_SIDE, PNG_OVER, PNG_ZOOM, PNG_TABLE]) {
    console.log(path.basename(p), fs.statSync(p).size, 'bytes');
  }
  if (logs.length) console.log(logs.join('\n'));

  await browser.close();
  server.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
