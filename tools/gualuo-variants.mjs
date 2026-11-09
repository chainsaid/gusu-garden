// ---------------------------------------------------------------------------
// 挂落参数化变体 · 实拍校核版（线稿，不进入三维场景、不碰成片基准）
//
// 依据：
//   out/reference/A-挂落花牙子雀替/A02_柱头与挂落交接_高清裁切.jpg  → 回纹骨架、柱头折角收头、贴梁不贴柱
//   out/reference/A-挂落花牙子雀替/A04_整条挂落_高清裁切.jpg        → 整段连续、中心花牙（同格条厚，非嵌板）、平直下缘
//   第1/4张商品图（纹样谱系）、第2张转角实拍、第3张施工实拍（山字下缘）
//
// 尺寸取自园子本体：开间 3.6、柱径 0.30、柱面净跨 3.30（buildings-corridor.js / gallery 默认 bayLen）。
// 挂落高按 A02/A04 实拍比例取 0.52（可调，不是硬编码进场景）。
//
// 五个可调项：
//   骨架 skeleton : huiwen | guaizi | ruyi
//   中心 center   : none | huaya | round | fan
//   下缘 bottom   : flat | sag | wave | step
//   端头 end      : straight | fold | curl | huaya
//   疏密 density  : fine | coarse
//
// usage: node tools/gualuo-variants.mjs
// out:   out/gualuo/gualuo-variants.png
// ---------------------------------------------------------------------------
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out', 'gualuo');
fs.mkdirSync(OUT, { recursive: true });

// ---- 园子实际尺寸 -----------------------------------------------------------
const D = {
  bay: 3.6,        // 柱中距（开间）
  colR: 0.15,      // 柱半径（柱径 0.30）
  clear: 3.3,      // 柱面净跨
  topRail: 0.06,   // 挂落上枋（吊在梁底）
  band: 0.40,      // 格条带高
  hang: 0.52,      // 枋底至下缘（平直时）
  barFine: 0.020,
  barCoarse: 0.030,
};
const BAND = { xL: 0.26, xR: D.bay - 0.26 };   // 格条带两端让开柱头，留折角位置
const XC = (BAND.xL + BAND.xR) / 2;            // 中心线 1.800

// 现状代码实测值（corridor-run.js guaLuo()）
const NOW = {
  bandSpan: D.bay - 2 * D.colR,                // 3.300
  nBars: Math.max(4, Math.floor((D.bay - 0.3) / 0.17)), // 19
  notch: 2 * D.colR,                           // 0.300
};
NOW.pitch = NOW.bandSpan / NOW.nBars;

// ---- 小工具 -----------------------------------------------------------------
const f = (v) => String(Math.round(v * 1e5) / 1e5);
const pt = ([x, y]) => `${f(x)},${f(y)}`;
const P = (pts, close = false) => `M${pts.map(pt).join('L')}${close ? 'Z' : ''}`;
const pathEl = (d, w, extra = '') =>
  `<path d="${d}" stroke-width="${f(w)}" ${extra}/>`;

function circlePts(cx, cy, r, n = 40, a0 = 0, a1 = Math.PI * 2) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
const circlePath = (cx, cy, r, n, a0, a1) => P(circlePts(cx, cy, r, n, a0, a1), a1 - a0 >= Math.PI * 1.999);

function volute(cx, cy, r0, r1, turns = 1.35, a0 = 0, n = 44) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + turns * Math.PI * 2 * t;
    const r = r0 + (r1 - r0) * t;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return P(out);
}

// 下缘轮廓（绝对 y；top=上枋底，band 底=0.46）
function profileFn(kind) {
  const top = D.topRail, H = D.band, base = top + H;
  return (x) => {
    const d = Math.abs(x - XC);
    if (kind === 'step') {
      if (d > 0.55) return base;
      if (d > 0.36) return base + 0.04;
      if (d > 0.17) return base + 0.08;
      return base + 0.12;
    }
    if (kind === 'sag') {
      return base + (d < 0.66 ? 0.12 * 0.5 * (1 + Math.cos(Math.PI * d / 0.66)) : 0);
    }
    if (kind === 'wave') {
      // 两弧下垂、中央起峰（图1① 的 M 形）；两侧平滑收回，不留竖台阶
      if (d > 0.62) return base;
      if (d <= 0.45) return base + 0.10 * 0.5 * (1 - Math.cos(Math.PI * d / 0.45));
      return base + 0.10 * 0.5 * (1 + Math.cos(Math.PI * (d - 0.45) / 0.17));
    }
    return base;
  };
}

function clipRegion(prof) {
  const top = D.topRail, n = 90;
  const pts = [[BAND.xL, top], [BAND.xR, top], [BAND.xR, prof(BAND.xR)]];
  for (let i = 1; i <= n; i++) {
    const x = BAND.xR - (BAND.xR - BAND.xL) * (i / n);
    pts.push([x, prof(x)]);
  }
  return P(pts, true);
}

// ---- 骨架 -------------------------------------------------------------------
// 直角回纹：一排方形回纹，上接通长细枋，左右交替镜像
function skelHuiwen(w, density = 'fine') {
  const top = D.topRail, H = D.band;
  const out = [];
  const target = density === 'coarse' ? 0.72 : 0.52;
  const n = Math.max(3, Math.round((BAND.xR - BAND.xL) / target));
  const u = (BAND.xR - BAND.xL) / n;
  const cy = top + H / 2 - 0.005;
  const a = u * 0.37, b = H / 2 - 0.060, g = density === 'coarse' ? 0.090 : 0.078;
  for (let i = 0; i < n; i++) {
    const cx = BAND.xL + (i + 0.5) * u;
    const m = i % 2 ? -1 : 1;
    const pts = [
      [cx - m * a, cy + 0.32 * b],
      [cx - m * a, cy - b],
      [cx + m * a, cy - b],
      [cx + m * a, cy + b],
      [cx - m * (a - g), cy + b],
      [cx - m * (a - g), cy - b + g],
      [cx + m * (a - g), cy - b + g],
      [cx + m * (a - g), cy + b - g],
      [cx - m * (a - 2 * g), cy + b - g],
    ];
    out.push(pathEl(P(pts), w));
  }
  out.push(pathEl(`M${f(BAND.xL)} ${f(top + 0.012)}H${f(BAND.xR)}`, 0.016)); // 上接细枋
  return out;
}

// 拐子：粗壮的 L 形拐子，上下交替咬合
function skelGuaizi(w, density = 'fine') {
  const top = D.topRail, H = D.band;
  const out = [];
  const target = density === 'coarse' ? 0.66 : 0.56;
  const n = Math.max(4, Math.round((BAND.xR - BAND.xL) / target));
  const u = (BAND.xR - BAND.xL) / n;
  const yT = top + 0.07, yB = top + H - 0.07;
  for (let i = 0; i < n; i++) {
    const cx = BAND.xL + (i + 0.5) * u;
    const m = i % 2 ? -1 : 1;
    const a = u * 0.42;
    out.push(pathEl(P([
      [cx - m * a, yT], [cx + m * a, yT], [cx + m * a, yT + 0.10],
      [cx + m * a * 0.35, yT + 0.10], [cx + m * a * 0.35, yT + 0.24],
    ]), w));
    out.push(pathEl(P([
      [cx + m * a, yB], [cx - m * a, yB], [cx - m * a, yB - 0.10],
      [cx - m * a * 0.35, yB - 0.10], [cx - m * a * 0.35, yB - 0.24],
    ]), w));
  }
  out.push(pathEl(`M${f(BAND.xL)} ${f(yT)}H${f(BAND.xR)}`, 0.012));
  out.push(pathEl(`M${f(BAND.xL)} ${f(yB)}H${f(BAND.xR)}`, 0.012));
  return out;
}

// 如意云头：连续弧线 + 云头（三瓣卷）
function skelRuyi(w, density = 'fine') {
  const top = D.topRail, H = D.band;
  const out = [];
  const y0 = top + H / 2;
  const lam = density === 'coarse' ? 0.82 : 0.62;
  const amp = 0.105;
  const n = 160;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = BAND.xL + (BAND.xR - BAND.xL) * (i / n);
    pts.push([x, y0 + amp * Math.sin((x - BAND.xL) / lam * Math.PI * 2)]);
  }
  out.push(pathEl(P(pts), w));
  // 峰谷处云头：三瓣 + 小卷心
  const heads = Math.floor((BAND.xR - BAND.xL) / (lam / 2));
  for (let k = 1; k < heads; k++) {
    const x = BAND.xL + (lam / 2) * k;
    const y = y0 + amp * Math.sin((x - BAND.xL) / lam * Math.PI * 2);
    const r = 0.050;
    out.push(pathEl(circlePath(x - 0.060, y, r * 0.72, 20), w * 0.85));
    out.push(pathEl(circlePath(x, y, r, 24), w));
    out.push(pathEl(circlePath(x + 0.060, y, r * 0.72, 20), w * 0.85));
    out.push(pathEl(circlePath(x, y, r * 0.28, 12), w * 0.7));
  }
  return out;
}

const SKELETONS = {
  huiwen: skelHuiwen,
  guaizi: skelGuaizi,
  ruyi: skelRuyi,
};

// ---- 端头 -------------------------------------------------------------------
function endMarks(kind, w) {
  const top = D.topRail, prof = profileFn('flat');
  const out = [];
  if (kind === 'straight') {
    out.push(pathEl(`M${f(BAND.xL)} ${f(top)}V${f(prof(BAND.xL))}`, w));
    out.push(pathEl(`M${f(BAND.xR)} ${f(top)}V${f(prof(BAND.xR))}`, w));
    return out;
  }
  if (kind === 'fold') {
    // A02 实拍：到柱头向下折到底，再收直角（带一级小台阶）
    const yb = top + D.band;
    out.push(pathEl(P([
      [BAND.xL, top + 0.02], [BAND.xL, yb + 0.02], [BAND.xL - 0.03, yb + 0.02],
      [BAND.xL - 0.03, yb + 0.07], [BAND.xL - 0.13, yb + 0.07],
    ]), w * 1.15));
    out.push(pathEl(P([
      [BAND.xR, top + 0.02], [BAND.xR, yb + 0.02], [BAND.xR + 0.03, yb + 0.02],
      [BAND.xR + 0.03, yb + 0.07], [BAND.xR + 0.13, yb + 0.07],
    ]), w * 1.15));
    return out;
  }
  if (kind === 'curl') {
    out.push(pathEl(volute(BAND.xL + 0.13, D.topRail + D.band - 0.11, 0.075, 0.016, 1.3, Math.PI), w));
    out.push(pathEl(volute(BAND.xR - 0.13, D.topRail + D.band - 0.11, 0.075, 0.016, 1.3, 0), w));
    out.push(pathEl(`M${f(BAND.xL)} ${f(top)}V${f(prof(BAND.xL))}`, w));
    out.push(pathEl(`M${f(BAND.xR)} ${f(top)}V${f(prof(BAND.xR))}`, w));
    return out;
  }
  if (kind === 'huaya') {
    // 柱头花牙子：贴柱的云头托（角牙），not 独立挂片
    const mk = (cx, d) => {
      const p = P([
        [cx, top + 0.01], [cx + d * 0.19, top + 0.01], [cx + d * 0.18, top + 0.09],
        [cx + d * 0.12, top + 0.15], [cx + d * 0.06, top + 0.19],
        [cx + d * 0.02, top + 0.23], [cx, top + 0.26],
      ], true);
      return `<path d="${p}" stroke-width="${f(w * 0.9)}" style="fill:#ececec"/>` +
        pathEl(volute(cx + d * 0.105, top + 0.095, 0.030, 0.009, 1.15, d > 0 ? -Math.PI * 0.5 : Math.PI * 0.5), w * 0.55);
    };
    out.push(mk(0.15, 1));
    out.push(mk(D.bay - 0.15, -1));
    return out;
  }
  return out;
}

// ---- 中心件 -----------------------------------------------------------------
function centerPiece(kind, w) {
  const top = D.topRail, yb = top + D.band;
  if (kind === 'none') return '';
  if (kind === 'huaya') {
    // A04 实拍：中心花牙，与格条同厚，不是嵌板；收窄成垂饰，略低于下缘
    const yEnd = yb + 0.13;
    const half = [
      [XC - 0.15, top + 0.01], [XC - 0.15, top + 0.10],
      [XC - 0.185, top + 0.18], [XC - 0.160, top + 0.27],
      [XC - 0.085, top + 0.32], [XC - 0.115, top + 0.385],
      [XC - 0.055, top + 0.405], [XC - 0.045, top + 0.49],
      [XC - 0.020, top + 0.545], [XC, top + 0.555],
    ];
    const outline = P([
      ...half,
      ...half.slice().reverse().map(([x, y]) => [2 * XC - x, y]),
    ], true);
    return `<path d="${outline}" stroke-width="${f(w * 1.1)}" style="fill:#ececec"/>` +
      pathEl(circlePath(XC, top + 0.13, 0.034, 18), 0.012) +
      pathEl(circlePath(XC, top + 0.13, 0.014, 12), 0.009) +
      pathEl(circlePath(XC - 0.075, top + 0.28, 0.022, 14), 0.009) +
      pathEl(circlePath(XC + 0.075, top + 0.28, 0.022, 14), 0.009) +
      pathEl(`M${f(XC)} ${f(top + 0.20)}V${f(yb - 0.02)}`, 0.009) +
      pathEl(circlePath(XC, yEnd - 0.03, 0.018, 14), 0.009);
  }
  if (kind === 'round') {
    const cy = top + D.band / 2 - 0.01;
    const r = 0.135;
    return `<path d="${circlePath(XC, cy, r, 48, 0, Math.PI * 2)}" stroke-width="0.012" style="fill:#fff"/>` +
      pathEl(circlePath(XC, cy, r - 0.018, 44, 0, Math.PI * 2), 0.009) +
      pathEl(circlePath(XC, cy, r * 0.55, 32, 0, Math.PI * 2), 0.008) +
      // 牌心：小回纹
      pathEl(P([
        [XC - 0.045, cy - 0.045], [XC + 0.045, cy - 0.045],
        [XC + 0.045, cy + 0.045], [XC - 0.045, cy + 0.045],
        [XC - 0.045, cy - 0.012], [XC + 0.020, cy - 0.012],
        [XC + 0.020, cy + 0.020],
      ]), w * 0.75) +
      pathEl(`M${f(XC)} ${f(cy - r)}V${f(cy - r + 0.020)}`, w * 0.6) +
      pathEl(`M${f(XC)} ${f(cy + r - 0.020)}V${f(cy + r)}`, w * 0.6);
  }
  if (kind === 'fan') {
    const cy = top + 0.02, r = 0.215;
    const a0 = Math.PI * 0.17, a1 = Math.PI * 0.83;
    let d = pathEl(P(circlePts(XC, cy, r, 40, a0, a1)), w * 1.25);
    d += pathEl(P(circlePts(XC, cy, r - 0.020, 40, a0, a1)), w);
    d += pathEl(P(circlePts(XC, cy, 0.060, 20, a0, a1)), w);
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (a1 - a0) * (i / 6);
      d += pathEl(P([[XC + Math.cos(a) * 0.060, cy + Math.sin(a) * 0.060],
        [XC + Math.cos(a) * (r - 0.020), cy + Math.sin(a) * (r - 0.020)]]), w * 0.6);
    }
    d += `<path d="${circlePath(XC, cy + 0.095, 0.030, 18, 0, Math.PI * 2)}" stroke-width="${f(w * 0.8)}" style="fill:#fff"/>`;
    return d;
  }
  return '';
}

// ---- 单开间变体 -------------------------------------------------------------
function variantSVG(v, i) {
  const p = v.p;
  const prof = profileFn(p.bottom);
  const w = p.density === 'coarse' ? D.barCoarse : D.barFine;
  const cid = `clip${i}`;
  const skeletons = SKELETONS[p.skeleton](w, p.density).join('');
  const bottomPts = [];
  for (let j = 0; j <= 96; j++) {
    const x = BAND.xL + (BAND.xR - BAND.xL) * (j / 96);
    bottomPts.push([x, prof(x)]);
  }
  const dimY = 0.80;

  return `<svg class="elev" viewBox="-0.34 -0.22 4.34 1.14" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="${cid}"><path d="${clipRegion(prof)}"/></clipPath></defs>
    <!-- 梁：贴梁不贴柱，通长 -->
    <rect x="-0.12" y="-0.15" width="3.84" height="0.15" fill="#f4f4f4" stroke="none"/>
    <path d="M-0.12 -0.15H3.72M-0.12 0H3.72" stroke-width="0.006" stroke="#999"/>
    <!-- 通长上枋（跨柱连续） -->
    <rect x="-0.12" y="${f(D.topRail * 0)}" width="3.84" height="${f(D.topRail)}" fill="#ededed" stroke="none"/>
    <path d="M-0.12 0H3.72M-0.12 ${f(D.topRail)}H3.72" stroke-width="0.010"/>
    <!-- 柱：只画上部 -->
    ${[0, D.bay].map((cx) => `
      <rect x="${f(cx - D.colR)}" y="0" width="${f(2 * D.colR)}" height="0.86" fill="#fbfbfb" stroke="none"/>
      <path d="M${f(cx - D.colR)} 0V0.86M${f(cx + D.colR)} 0V0.86" stroke-width="0.008" stroke="#888"/>
      <path d="M${f(cx - D.colR)} 0.02H${f(cx + D.colR)}" stroke-width="0.008" stroke="#666"/>`).join('')}
    <!-- 柱头花牙子先铺底，格条后画 -->
    ${endMarks(p.end, w).join('')}
    <!-- 格条带 -->
    <g clip-path="url(#${cid})">${skeletons}</g>
    <path d="${P(bottomPts)}" stroke-width="0.019"/>
    ${centerPiece(p.center, w)}
    <!-- 尺寸 -->
    <g class="dim">
      <path d="M0 ${f(dimY)}H${f(D.bay)}" stroke-width="0.003" stroke="#777"/>
      <path d="M0 ${f(dimY - 0.03)}V${f(dimY + 0.03)}M${f(D.bay)} ${f(dimY - 0.03)}V${f(dimY + 0.03)}" stroke-width="0.006" stroke="#777"/>
      <text x="${f(D.bay / 2)}" y="${f(dimY - 0.035)}" text-anchor="middle" font-size="0.055" fill="#444">开间 3.600（柱中距）</text>
      <path d="M${f(D.colR)} ${f(dimY + 0.09)}H${f(D.bay - D.colR)}" stroke-width="0.003" stroke="#777"/>
      <path d="M${f(D.colR)} ${f(dimY + 0.06)}V${f(dimY + 0.12)}M${f(D.bay - D.colR)} ${f(dimY + 0.06)}V${f(dimY + 0.12)}" stroke-width="0.006" stroke="#777"/>
      <text x="${f(D.bay / 2)}" y="${f(dimY + 0.145)}" text-anchor="middle" font-size="0.045" fill="#666">柱面净跨 3.300 · 柱径 0.300</text>
      <path d="M-0.15 ${f(D.topRail)}V${f(D.topRail + D.hang)}" stroke-width="0.003" stroke="#777"/>
      <path d="M-0.18 ${f(D.topRail)}H-0.12M-0.18 ${f(D.topRail + D.hang)}H-0.12" stroke-width="0.006" stroke="#777"/>
      <text x="-0.20" y="${f(D.topRail + D.hang / 2)}" text-anchor="middle" font-size="0.048" fill="#444" transform="rotate(-90 -0.20 ${f(D.topRail + D.hang / 2)})">挂落 0.520</text>
    </g>
  </svg>`;
}

// ---- 中心牌两方向备用 -------------------------------------------------------
function plaqueSVG(kind) {
  const top = 0.10, band = 0.40;
  const prof = (x) => top + band;
  const w = D.barFine;
  const cid = `plq${kind}`;
  const bars = [];
  for (let i = 0; i <= 6; i++) {
    const x = 0.14 + (1.02 - 0.14) * (i / 6);
    bars.push(pathEl(`M${f(x)} ${f(top)}V${f(prof(x))}`, 0.020));
  }
  const cy = top + band / 2;
  let piece = '';
  if (kind === 'round') {
    const r = 0.145;
    piece = `<path d="${circlePath(0.58, cy, r, 40, 0, Math.PI * 2)}" stroke-width="0.016" style="fill:#fff"/>` +
      pathEl(circlePath(0.58, cy, r - 0.020, 36, 0, Math.PI * 2), 0.010) +
      pathEl(circlePath(0.58, cy, 0.060, 24, 0, Math.PI * 2), 0.008) +
      pathEl(P([[0.535, cy - 0.045], [0.625, cy - 0.045], [0.625, cy + 0.045], [0.535, cy + 0.045], [0.535, cy - 0.015], [0.600, cy - 0.015]]), 0.008);
  } else {
    const cyf = top + 0.02, r = 0.205;
    const a0 = Math.PI * 0.17, a1 = Math.PI * 0.83;
    piece = pathEl(P(circlePts(0.58, cyf, r, 36, a0, a1)), 0.016) +
      pathEl(P(circlePts(0.58, cyf, r - 0.020, 36, a0, a1)), 0.010) +
      pathEl(P(circlePts(0.58, cyf, 0.055, 18, a0, a1)), 0.010);
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (a1 - a0) * (i / 6);
      piece += pathEl(P([[0.58 + Math.cos(a) * 0.055, cyf + Math.sin(a) * 0.055],
        [0.58 + Math.cos(a) * (r - 0.020), cyf + Math.sin(a) * (r - 0.020)]]), 0.007);
    }
    piece += `<path d="${circlePath(0.58, cyf + 0.100, 0.028, 16, 0, Math.PI * 2)}" stroke-width="0.008" style="fill:#fff"/>`;
  }
  return `<svg class="plaque" viewBox="0 0 1.16 0.66" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.10" y="${top}" width="0.96" height="${band}" fill="#fafafa" stroke="none"/>
    <defs><clipPath id="${cid}"><rect x="0.10" y="${top}" width="0.96" height="${band}"/></clipPath></defs>
    <path d="M0.10 ${top}H1.06M0.10 ${top + band}H1.06" stroke-width="0.013"/>
    <g clip-path="url(#${cid})">${bars.join('')}</g>
    <path d="M0.14 ${top}H1.02" stroke-width="0.012" stroke="#333"/>
    ${piece}
    <path d="M0.10 ${top}V${top + band}M1.06 ${top}V${top + band}" stroke-width="0.010"/>
  </svg>`;
}

// ---- 转角：平面 -------------------------------------------------------------
function planSVG(mode) {
  const S = D.bay;                 // 只画转角两侧各一开间
  const off = -0.18;               // 挂落所在檐面（柱外）
  const bw = 0.10;
  const cols = [[0, 0], [S, 0], [0, S]];
  const strips = [];
  if (mode === 'now') {
    strips.push({ x: D.colR, y: off - bw / 2, w: S - 2 * D.colR, h: bw });
    strips.push({ x: off - bw / 2, y: D.colR, w: bw, h: S - 2 * D.colR });
  } else {
    // 通长 L 形：沿两跑檐面绕角柱外侧连续
    strips.push(`<path d="M${f(S)} ${f(off)}H${f(off)}V${f(S)}" stroke-width="${f(bw)}" stroke="#666" fill="none"/>`);
    strips.push(pathEl(`M${f(S)} ${f(off - bw / 2)}H${f(off - bw / 2)}V${f(S)}`, 0.007, 'stroke="#222"'));
    strips.push(pathEl(`M${f(S)} ${f(off + bw / 2)}H${f(off + bw / 2)}V${f(S)}`, 0.007, 'stroke="#222"'));
  }
  return `<svg class="plan" viewBox="-0.55 -0.55 4.95 4.95" xmlns="http://www.w3.org/2000/svg">
    <!-- 两跑轴线与梁，末端虚线示意廊继续 -->
    <path d="M0 0H4.3M0 0V4.3" stroke-width="0.09" stroke="#ececec"/>
    <path d="M-0.11 0H4.35M0 -0.11V4.35" stroke-width="0.004" stroke="#aaa"/>
    <path d="M3.6 0H4.35M0 3.6V4.35" stroke-width="0.004" stroke="#bbb" stroke-dasharray="0.04 0.03"/>
    ${mode === 'now' ? strips.map((r) => `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="#666" stroke="none"/>`).join('') : strips.join('')}
    ${cols.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(D.colR)}" fill="#fff" stroke="#222" stroke-width="0.008"/>`).join('')}
    ${mode === 'now' ? `
      <path d="M${f(D.colR)} ${f(off)}H${f(off)}V${f(D.colR)}" stroke-width="0.010" stroke="#c0392b" stroke-dasharray="0.035 0.025" fill="none"/>
      <text x="0.52" y="1.02" font-size="0.18" fill="#c0392b">每柱断 0.300（柱径）</text>
      <text x="0.52" y="1.30" font-size="0.14" fill="#777">逐间独立，端头平切于柱面</text>`
    : `
      <text x="0.52" y="1.02" font-size="0.18" fill="#1a5fb4">通长枋绕柱成 L 形</text>
      <text x="0.52" y="1.30" font-size="0.14" fill="#777">柱头同标高、同模数、镜像对齐</text>
      <text x="${f(off * 0.55)}" y="-0.40" font-size="0.13" fill="#1a5fb4" text-anchor="middle">花牙子</text>`}
    <text x="${f(S / 2)}" y="4.18" font-size="0.16" fill="#444" text-anchor="middle">${mode === 'now' ? '现状 · 两跑各自断开' : '建议 · 两跑同标高镜像交圈'}</text>
  </svg>`;
}

// ---- 转角：展开立面 ---------------------------------------------------------
function unfoldSVG(mode) {
  const S = D.bay, L = 2 * S;
  const top = 0.06, H = D.band;
  const w = D.barFine;
  const bands = mode === 'now'
    ? [{ x0: 0.15, x1: S - 0.15 }, { x0: S + 0.15, x1: L - 0.15 }]
    : [{ x0: 0.15, x1: S - 0.15 }, { x0: S + 0.15, x1: L - 0.15 }];
  const drawBand = (x0, x1, phase) => {
    const n = Math.max(4, Math.round((x1 - x0) / 0.52));
    const u = (x1 - x0) / n, cy = top + H / 2, a = u * 0.37, b = H / 2 - 0.045, g = 0.075;
    let s = '';
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + 0.5) * u, m = (i + phase) % 2 ? -1 : 1;
      s += pathEl(P([
        [cx - m * a, cy + 0.32 * b], [cx - m * a, cy - b], [cx + m * a, cy - b],
        [cx + m * a, cy + b], [cx - m * (a - g), cy + b], [cx - m * (a - g), cy - b + g],
        [cx + m * (a - g), cy - b + g], [cx + m * (a - g), cy + b - g],
        [cx - m * (a - 2 * g), cy + b - g],
      ]), w);
    }
    return s;
  };
  return `<svg class="unfold" viewBox="-0.30 -0.30 7.80 1.02" xmlns="http://www.w3.org/2000/svg">
    <rect x="-0.12" y="-0.16" width="7.44" height="0.16" fill="#f4f4f4" stroke="none"/>
    <path d="M-0.12 -0.16H7.32M-0.12 0H7.32" stroke-width="0.005" stroke="#999"/>
    ${mode === 'now'
      ? `<g>${bands.map((b) => `<rect x="${f(b.x0)}" y="0" width="${f(b.x1 - b.x0)}" height="${f(top)}" fill="#e6e6e6" stroke="none"/>
         <path d="M${f(b.x0)} ${f(top)}H${f(b.x1)}M${f(b.x0)} 0H${f(b.x1)}" stroke-width="0.010"/>`).join('')}</g>`
      : `<rect x="-0.12" y="0" width="7.44" height="${f(top)}" fill="#ededed" stroke="none"/>
         <path d="M-0.12 0H7.32M-0.12 ${f(top)}H7.32" stroke-width="0.010"/>`}
    ${bands.map((b, k) => `<g>${drawBand(b.x0, b.x1, mode === 'now' ? k : 0)}</g>
      <path d="M${f(b.x0)} ${f(top)}V${f(top + H)}M${f(b.x1)} ${f(top)}V${f(top + H)}" stroke-width="0.014"/>
      <path d="M${f(b.x0)} ${f(top + H)}H${f(b.x1)}" stroke-width="0.016"/>`).join('')}
    <!-- 柱 -->
    ${[0, S, L].map((cx) => `
      <rect x="${f(cx - D.colR)}" y="0" width="${f(2 * D.colR)}" height="0.74" fill="#fbfbfb" stroke="none"/>
      <path d="M${f(cx - D.colR)} 0V0.74M${f(cx + D.colR)} 0V0.74" stroke-width="0.008" stroke="#888"/>`).join('')}
    ${mode === 'now' ? `
      <g stroke="#c0392b" fill="none">
        <rect x="${f(S - 0.15)}" y="0" width="0.30" height="${f(top + H)}" stroke-width="0.004" stroke-dasharray="0.035 0.025"/>
        <path d="M${f(S - 0.15)} 0.62V0.82M${f(S + 0.15)} 0.62V0.82" stroke-width="0.004" stroke-dasharray="0.03 0.02"/>
      </g>
      <text x="${f(S)}" y="0.72" font-size="0.055" fill="#c0392b" text-anchor="middle">断口 0.300</text>
      <text x="${f(S)}" y="0.86" font-size="0.045" fill="#c0392b" text-anchor="middle">两间各自起算，端头无折角</text>`
    : `
      <g stroke="#1a5fb4" fill="none" stroke-width="0.004" stroke-dasharray="0.05 0.03">
        <path d="M-0.06 ${f(top)}H${f(L + 0.06)}"/>
        <path d="M-0.06 ${f(top + H)}H${f(L + 0.06)}"/>
      </g>
      <path d="M${f(S - 0.15)} ${f(top + 0.02)}V${f(top + H + 0.05)}H${f(S)}" stroke-width="0.012"/>
      <path d="M${f(S + 0.15)} ${f(top + 0.02)}V${f(top + H + 0.05)}H${f(S)}" stroke-width="0.012"/>
      <text x="${f(S)}" y="0.72" font-size="0.055" fill="#1a5fb4" text-anchor="middle">同标高 / 同模数 / 镜像折角</text>
      <text x="${f(S)}" y="0.86" font-size="0.045" fill="#1a5fb4" text-anchor="middle">通长枋跨柱，花牙子左右各一</text>`}
    <text x="${f(L)}" y="${f(top + H + 0.18)}" font-size="0.045" fill="#666" text-anchor="end">展开长度 7.200（两侧各一开间）</text>
  </svg>`;
}

// ---- 变体定义 ---------------------------------------------------------------

const PARAM_LEGEND = [
  ['骨架', '直角回纹 / 拐子 / 带弧如意云头'],
  ['中心', '留空 / 花牙 / 圆牌（雕） / 扇牌（雕）'],
  ['下缘', '平直 / 弧垂 / 波浪 / 阶梯山字'],
  ['端头', '直落 / 折角收头 / 卷收 / 接花牙子'],
  ['疏密', '粗疏（格条 30）/ 细密（格条 20）'],
];

const VARIANTS = [
  {
    id: 'A', name: 'A · 柱头折角基准', ref: '参考 A02 高清裁切（拙政园廊檐）／第2张转角实拍',
    p: { skeleton: 'huiwen', center: 'none', bottom: 'flat', end: 'fold', density: 'fine' },
    note: '通长上枋、贴梁不贴柱；格条到柱头向下折到底再收直角；下缘平直。',
  },
  {
    id: 'B', name: 'B · 整段与中心花牙', ref: '参考 A04 高清裁切（耦园水阁）',
    p: { skeleton: 'huiwen', center: 'huaya', bottom: 'flat', end: 'huaya', density: 'fine' },
    note: '中心件为花牙（与格条同厚，不是嵌板花牌）；两端柱头接花牙子；下缘平直无垂弧。',
  },
  {
    id: 'C', name: 'C · 施工实拍山字下缘', ref: '第3张施工实拍（bbe7…）',
    p: { skeleton: 'huiwen', center: 'none', bottom: 'step', end: 'fold', density: 'fine' },
    note: '中段阶梯下沉成“山”字形；端头垂直小收头；格条密。',
  },
  {
    id: 'D', name: 'D · 商品谱系（仅纹样）', ref: '第1张①／第4张谱系（只取纹样，不取打光配色）',
    p: { skeleton: 'guaizi', center: 'round', bottom: 'wave', end: 'curl', density: 'coarse' },
    note: '拐子骨架；中心圆牌（有雕饰，备用方向）；双弧下垂；端头卷收；格条粗疏。',
  },
];

const cards = VARIANTS.map((v, i) => `
  <article class="card">
    <div class="draw">${variantSVG(v, i)}</div>
    <div class="cap">
      <div class="name"><span class="idx">${v.id}</span>${v.name.replace(/^[A-D] · /, '')}</div>
      <div class="ref">${v.ref}</div>
      <div class="chips">
        <span>骨架 ${v.p.skeleton}</span><span>中心 ${v.p.center}</span>
        <span>下缘 ${v.p.bottom}</span><span>端头 ${v.p.end}</span>
        <span>疏密 ${v.p.density}</span>
      </div>
      <div class="note">${v.note}</div>
    </div>
  </article>`).join('');

const legend = PARAM_LEGEND.map(([k, v]) => `<div class="pl"><b>${k}</b><span>${v}</span></div>`).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;background:#fff}
  body{width:1920px;font-family:"PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif;color:#1a1a1a;padding:60px 64px 40px}
  header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1a1a1a;padding-bottom:16px}
  h1{margin:0;font-size:35px;font-weight:600;letter-spacing:2px}
  .eyebrow{font:12px/1 "SF Mono",Menlo,monospace;letter-spacing:2px;color:#777;margin-bottom:10px}
  .meta{font-size:13px;line-height:1.7;color:#555;text-align:right}
  .legend{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0 0;padding:12px 0;border-bottom:1px solid #ddd}
  .pl b{display:block;font-size:12px;letter-spacing:1px;color:#111;margin-bottom:4px}
  .pl span{font-size:12.5px;color:#555;line-height:1.45}
  .sec{display:flex;align-items:baseline;gap:14px;margin:26px 0 12px}
  .sec .no{font:12px/1 "SF Mono",Menlo,monospace;color:#999;letter-spacing:1px}
  .sec h2{margin:0;font-size:19px;font-weight:600;letter-spacing:1px}
  .sec .hint{font-size:12.5px;color:#666}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px 28px}
  .card{border-top:2px solid #111;padding-top:10px;min-width:0}
  .draw{width:100%;height:250px}
  .draw svg{width:100%;height:100%;display:block}
  svg path{fill:none;stroke:#1a1a1a;stroke-linejoin:miter;stroke-linecap:butt}
  svg text{font-family:"PingFang SC","Hiragino Sans GB",sans-serif}
  .cap{padding:8px 2px 0}
  .cap .name{font-size:17px;font-weight:600;letter-spacing:.5px;display:flex;align-items:baseline;gap:9px}
  .idx{font:12px/1 "SF Mono",Menlo,monospace;background:#111;color:#fff;padding:3px 5px;border-radius:2px}
  .ref{font-size:12.5px;color:#666;margin-top:5px}
  .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
  .chips span{font-size:11.5px;color:#333;border:1px solid #ccc;border-radius:2px;padding:2px 6px}
  .note{font-size:12.5px;color:#444;line-height:1.55;margin-top:6px}
  .pairrow{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:4px}
  .pane{border-top:1px solid #bbb;padding-top:8px}
  .pane .ptitle{font-size:14px;font-weight:600;letter-spacing:.5px}
  .pane .ptitle em{font-style:normal;font:11px/1 "SF Mono",Menlo,monospace;color:#999;margin-left:8px}
  .pane svg{width:100%;display:block}
  .planwrap{height:420px}
  .planwrap svg{height:100%}
  .unfoldwrap{height:150px}
  .unfoldwrap svg{height:100%}
  .plaqueRow{display:grid;grid-template-columns:210px 210px 1fr;gap:30px;align-items:center;margin-top:10px;border-top:1px solid #ccc;padding-top:14px}
  .plq .d{height:120px}
  .plq svg{width:100%;height:100%;display:block}
  .plq .t{font-size:12.5px;color:#333;margin-top:4px}
  .plq .t small{display:block;color:#888;font-size:11px;margin-top:2px}
  .plqnote{font-size:12.5px;color:#555;line-height:1.7}
  .notes{display:grid;grid-template-columns:1.05fr .95fr;gap:26px;margin-top:20px}
  .notes .box{border-top:2px solid #111;padding-top:10px}
  .notes h3{margin:0 0 8px;font-size:15px;letter-spacing:1px}
  .notes h3 em{font-style:normal;font:11px/1 "SF Mono",Menlo,monospace;color:#999;margin-left:8px}
  .notes .box.bad h3{color:#c0392b}
  .notes .box.good h3{color:#1a5fb4}
  .notes li{font-size:12.5px;line-height:1.7;color:#333;margin:0 0 5px}
  .notes ul{margin:0;padding-left:18px}
  code{font:11.5px/1.4 "SF Mono",Menlo,monospace;background:#f4f4f4;padding:1px 4px}
  footer{margin-top:24px;border-top:1px solid #bbb;padding-top:12px;display:flex;justify-content:space-between;font-size:12px;color:#666}
</style></head><body>
<header>
  <div>
    <div class="eyebrow">GUSU GARDEN · CORRIDOR HANGING LATTICE</div>
    <h1>挂落参数化变体 · 实拍校核线稿</h1>
  </div>
  <div class="meta">开间 3.600 · 柱径 0.300 · 柱面净跨 3.300 · 挂落高 0.520<br>
  尺寸取自 buildings-corridor.js；挂落比例按 A02／A04 实拍推定</div>
</header>

<div class="legend">${legend}</div>

<div class="sec"><span class="no">01</span><h2>四个代表组合（同比例正视，白底黑线）</h2>
<span class="hint">每组注明参考来源与五参数取值；A/B 为实拍可核实做法，C 为施工实拍，D 仅取商品图纹样</span></div>
<div class="grid">${cards}</div>

<div class="plaqueRow">
  <div class="plq"><div class="d">${plaqueSVG('round')}</div><div class="t">备用方向 1 · 圆牌（有雕饰）<small>未定项，仅作选型备用</small></div></div>
  <div class="plq"><div class="d">${plaqueSVG('fan')}</div><div class="t">备用方向 2 · 扇牌（有雕饰）<small>未定项，仅作选型备用</small></div></div>
  <div class="plqnote">中心件两个方向各做一件备用：<b>留空</b>（A/C）与<b>有牌</b>（D 圆牌 + 扇牌）。
  但 A04 实拍已确认：耦园水阁中心是<b>花牙</b>（与格条同厚、非嵌板），因此 B 按花牙做；
  圆牌／扇牌只是候选，不写成既有做法。</div>
</div>

<div class="sec"><span class="no">02</span><h2>转角校核：现状接不上 vs 绕柱 L 形</h2>
<span class="hint">90° 转角，只画檐下挂落一侧；展开图把两跑摊平，便于看柱头是否对齐</span></div>
<div class="pairrow">
  <div class="pane"><div class="ptitle">现状（gallery 逐开间生成）<em>NOW</em></div><div class="planwrap">${planSVG('now')}</div></div>
  <div class="pane"><div class="ptitle">建议（通长跨柱、柱头镜像）<em>PROPOSED</em></div><div class="planwrap">${planSVG('prop')}</div></div>
</div>
<div class="pairrow">
  <div class="pane"><div class="ptitle">展开立面 · 现状<em>每柱断 0.300，两间相位各自起算</em></div><div class="unfoldwrap">${unfoldSVG('now')}</div></div>
  <div class="pane"><div class="ptitle">展开立面 · 建议<em>通长枋 + 同模数镜像折角</em></div><div class="unfoldwrap">${unfoldSVG('prop')}</div></div>
</div>

<div class="notes">
  <div class="box bad">
    <h3>现状核实 <em>CODE-CHECKED</em></h3>
    <ul>
      <li>每开间独立生成：<code>guaLuo()</code> 的 x 从 <code>COL_R</code> 到 <code>bay-COL_R</code>，即 0.15–3.45；两端止于柱面，端头平切。</li>
      <li>格条 <code>n = floor(3.3/0.17) = 19</code>，首末各一根，间距 <b>${NOW.pitch.toFixed(4)} m</b>；每间从本间起点重新起算，跨柱不接续。</li>
      <li>转角共享柱处，两腿各让 0.15，合计 <b>0.300 m</b> 缺口；上枋在柱头断开，两向格条不镜像对齐，无花牙子。</li>
      <li>端头直接止于柱面，没有 A02 实拍的“向下折到底再收直角”。</li>
      <li><code>queti()</code> 每间两端各生成一次，角柱处两腿叠加重复；<code>buildings-corridor.js</code> 本体与 <code>cornerPiece()</code> 均不含挂落。</li>
      <li>结论：现有廊的挂落在转角<b>接不上</b>，端头做法也与实拍不符。</li>
    </ul>
  </div>
  <div class="box good">
    <h3>建议做法 <em>PER A02 / A04</em></h3>
    <ul>
      <li>挂落吊在<b>通长上枋底</b>，贴梁不贴柱；上枋在转角连续（L 形，柱头两向共用）。</li>
      <li>两跑挂落<b>同标高、同模数</b>，在柱头镜像对齐；不再逐间重置相位。</li>
      <li>端头：格条到柱头<b>向下折到底，再收直角</b>，留 10–15 mm 离柱面缝隙。</li>
      <li>角柱两侧各接一件<b>花牙子</b>，左右不重叠；中心件按 A04 用花牙，圆牌／扇牌待定。</li>
      <li>建议把挂落生成改到跑级（跨柱连续），并复用现有梁轴线；本次只出线稿，不改进 <code>src/world</code> 与成片路径。</li>
    </ul>
  </div>
</div>

<footer>
  <div>白底线稿 · 未渲染、未改场景、未动默认路径与 51 帧基准</div>
  <div>1 m 比例尺见图；4 组同比例，可直接叠合比较</div>
</footer>
</body></html>`;

// ---- 自检 -------------------------------------------------------------------
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
assert(Math.abs(D.bay - 3.6) < 1e-9, 'bay 必须是园子实际 3.6');
assert(Math.abs(D.clear - (D.bay - 2 * D.colR)) < 1e-9, '净跨必须等于 3.3');
assert(NOW.notch === 0.3, '转角缺口应等于柱径 0.30');
assert(Math.abs(NOW.pitch - 3.3 / 19) < 1e-9, '现状格条间距应为 0.1737');
for (const v of VARIANTS) {
  assert(['huiwen', 'guaizi', 'ruyi'].includes(v.p.skeleton), `${v.id} skeleton`);
  assert(['none', 'huaya', 'round', 'fan'].includes(v.p.center), `${v.id} center`);
  assert(['flat', 'sag', 'wave', 'step'].includes(v.p.bottom), `${v.id} bottom`);
  assert(['straight', 'fold', 'curl', 'huaya'].includes(v.p.end), `${v.id} end`);
  assert(['fine', 'coarse'].includes(v.p.density), `${v.id} density`);
}
const usedSkel = new Set(VARIANTS.map((v) => v.p.skeleton));
const usedCenter = new Set(VARIANTS.map((v) => v.p.center));
console.log('尺寸：bay=%s clear=%s notch=%s pitch=%s', D.bay, D.clear, NOW.notch, NOW.pitch.toFixed(4));
console.log('四个组合覆盖骨架:', [...usedSkel].join(','), '| 中心:', [...usedCenter].join(','), '(+ fan 备用)');
console.log('每页覆盖下缘/端头/疏密:',
  [...new Set(VARIANTS.map((v) => v.p.bottom))].join(','), '|',
  [...new Set(VARIANTS.map((v) => v.p.end))].join(','), '|',
  [...new Set(VARIANTS.map((v) => v.p.density))].join(','));
assert(!html.includes('NaN'), 'HTML 中出现 NaN');
assert(html.includes('开间 3.600'), '缺少实际开间标注');

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: 'new',
  args: ['--force-device-scale-factor=2'],
  defaultViewport: { width: 1920, height: 1400, deviceScaleFactor: 2 },
  protocolTimeout: 180000,
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const h = await page.evaluate(() => document.body.scrollHeight);
const file = path.join(OUT, 'gualuo-variants.png');
await page.screenshot({ path: file, type: 'png', fullPage: true });
await browser.close();
console.log('page height', h, '→ wrote', path.relative(ROOT, file));
