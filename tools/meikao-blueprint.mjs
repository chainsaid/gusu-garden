import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { findChrome, gpuArgs } from './lib/chrome.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'out/meikao');
const TARGET_PNG = path.join(OUT, '美人靠_标准施工图纸_A3图幅.png');

const W = 3300, H = 2333;

const HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; background: #0a1624; font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
  canvas { display: block; }
</style>
</head>
<body>
<canvas id="cv" width="${W}" height="${H}"></canvas>
<script>
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

// --- 蓝图配色体系 (GB/T 建筑施工图纸标准风格) ---
const C = {
  bg: '#0a1624',         // 经典深蓝图底色
  grid: '#102235',       // 细底网格
  border: '#3b6a94',     // 图框粗线
  borderInner: '#224363',// 图框细线
  obj: '#ffffff',        // 实体构件轮廓线 (纯白)
  objSec: '#5dade2',     // 剖切构件主轮廓 (浅青蓝)
  objFill: 'rgba(93, 173, 226, 0.18)', // 剖面轻填充
  objHatch: 'rgba(93, 173, 226, 0.55)', // 剖面木质/型材剖面线
  dim: '#f39c12',        // 尺寸标注与尺寸线 (金黄)
  dimAux: '#7f8c8d',     // 尺寸界线 (中灰)
  axis: '#e74c3c',       // 轴线/标高线/悬挑基准 (砖红)
  text: '#ffffff',       // 标注文字
  subText: '#95a5a6',    // 次级文字/注释
  title: '#00d2d3',      // 标题强调 (青绿)
};

// 1. 绘制背景与工程网格
ctx.fillStyle = C.bg;
ctx.fillRect(0, 0, W, H);

ctx.strokeStyle = C.grid;
ctx.lineWidth = 1;
const GRID_STEP = 50;
for (let x = 0; x < W; x += GRID_STEP) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
}
for (let y = 0; y < H; y += GRID_STEP) {
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
}

// 2. A3 标准图框 (25mm 装订边，其余 10mm)
const MARGIN_LEFT = 70;
const MARGIN_TOP = 40;
const MARGIN_RIGHT = 40;
const MARGIN_BOTTOM = 40;

ctx.strokeStyle = C.border;
ctx.lineWidth = 3.5;
ctx.strokeRect(MARGIN_LEFT, MARGIN_TOP, W - MARGIN_LEFT - MARGIN_RIGHT, H - MARGIN_TOP - MARGIN_BOTTOM);

ctx.strokeStyle = C.borderInner;
ctx.lineWidth = 1.2;
ctx.strokeRect(MARGIN_LEFT + 8, MARGIN_TOP + 8, W - MARGIN_LEFT - MARGIN_RIGHT - 16, H - MARGIN_TOP - MARGIN_BOTTOM - 16);

// 3. 右下角图签 (Title Block)
const TB_W = 620, TB_H = 180;
const TB_X = W - MARGIN_RIGHT - 8 - TB_W;
const TB_Y = H - MARGIN_BOTTOM - 8 - TB_H;

ctx.fillStyle = 'rgba(10, 22, 36, 0.96)';
ctx.fillRect(TB_X, TB_Y, TB_W, TB_H);
ctx.strokeStyle = C.border;
ctx.lineWidth = 2;
ctx.strokeRect(TB_X, TB_Y, TB_W, TB_H);

ctx.strokeStyle = C.borderInner;
ctx.lineWidth = 1.2;
const rows = [TB_Y + 45, TB_Y + 90, TB_Y + 135];
for (const ry of rows) {
  ctx.beginPath(); ctx.moveTo(TB_X, ry); ctx.lineTo(TB_X + TB_W, ry); ctx.stroke();
}
const cols = [TB_X + 115, TB_X + 355, TB_X + 465];
for (const cx of cols) {
  ctx.beginPath(); ctx.moveTo(cx, TB_Y); ctx.lineTo(cx, TB_Y + TB_H); ctx.stroke();
}

ctx.font = 'bold 15px -apple-system, sans-serif';
ctx.fillStyle = C.subText;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

ctx.fillText('工程名称', TB_X + 57.5, TB_Y + 22.5);
ctx.fillText('子项名称', TB_X + 57.5, TB_Y + 67.5);
ctx.fillText('图纸名称', TB_X + 57.5, TB_Y + 112.5);
ctx.fillText('设计 / 比例', TB_X + 57.5, TB_Y + 157.5);

ctx.fillStyle = C.text;
ctx.textAlign = 'left';
ctx.font = '16px -apple-system, sans-serif';
ctx.fillText('姑苏古典园林营造工程', TB_X + 130, TB_Y + 22.5);
ctx.fillText('环池游廊临水悬挑靠背', TB_X + 130, TB_Y + 67.5);
ctx.font = 'bold 18px -apple-system, sans-serif';
ctx.fillStyle = C.title;
ctx.fillText('美人靠（飞来椅）标准构造大样图', TB_X + 130, TB_Y + 112.5);

ctx.fillStyle = C.subText;
ctx.font = '15px -apple-system, sans-serif';
ctx.fillText('古建工程深化设计组', TB_X + 130, TB_Y + 157.5);
ctx.fillText('1:15 / 1:10', TB_X + 270, TB_Y + 157.5);

ctx.textAlign = 'center';
ctx.fillText('图号', TB_X + 410, TB_Y + 22.5);
ctx.fillText('版本', TB_X + 410, TB_Y + 67.5);
ctx.fillText('日期', TB_X + 410, TB_Y + 112.5);
ctx.fillText('审核', TB_X + 410, TB_Y + 157.5);

ctx.fillStyle = C.text;
ctx.font = 'bold 16px Consolas, monospace';
ctx.fillText('GS-MK-01', TB_X + 542, TB_Y + 22.5);
ctx.fillText('REV C (悬挑)', TB_X + 542, TB_Y + 67.5);
ctx.font = '15px -apple-system, sans-serif';
ctx.fillText('2026.11', TB_X + 542, TB_Y + 112.5);
ctx.fillText('香山帮大师室', TB_X + 542, TB_Y + 157.5);

// 辅助绘图函数
function drawTitle(zh, en, x, y) {
  ctx.fillStyle = C.title;
  ctx.font = 'bold 22px "PingFang SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(zh, x, y);

  ctx.fillStyle = C.subText;
  ctx.font = '13px Consolas, monospace';
  ctx.fillText(en, x, y + 28);

  ctx.strokeStyle = C.title;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y + 48);
  ctx.lineTo(x + 360, y + 48);
  ctx.stroke();

  ctx.strokeStyle = C.borderInner;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 52);
  ctx.lineTo(x + 420, y + 52);
  ctx.stroke();
}

function drawLevel(valStr, x, y, alignLeft = true) {
  ctx.strokeStyle = C.axis;
  ctx.lineWidth = 1.2;
  const h = 10, w = 12;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - w / 2, y - h);
  ctx.lineTo(x + w / 2, y - h);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(alignLeft ? x + 95 : x - 95, y);
  ctx.stroke();

  ctx.fillStyle = C.axis;
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.textAlign = alignLeft ? 'left' : 'right';
  ctx.fillText(valStr, alignLeft ? x + 10 : x - 10, y - 4);
}

function drawDimH(y, x0, x1, text, offY = -10) {
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  const tick = 6;
  for (const x of [x0, x1]) {
    ctx.beginPath();
    ctx.moveTo(x - tick, y + tick);
    ctx.lineTo(x + tick, y - tick);
    ctx.stroke();
  }
  ctx.fillStyle = C.dim;
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, (x0 + x1) / 2, y + offY);
}

function drawDimV(x, y0, y1, text, offX = 14) {
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  const tick = 6;
  for (const y of [y0, y1]) {
    ctx.beginPath();
    ctx.moveTo(x - tick, y + tick);
    ctx.lineTo(x + tick, y - tick);
    ctx.stroke();
  }
  ctx.fillStyle = C.dim;
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.textAlign = offX > 0 ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + offX, (y0 + y1) / 2);
}

function drawLeader(text, x0, y0, x1, y1) {
  ctx.strokeStyle = C.subText;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(x0, y0, 3, 0, Math.PI * 2);
  ctx.fillStyle = C.title;
  ctx.fill();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  const L = 180;
  ctx.lineTo(x1 + (x1 > x0 ? L : -L), y1);
  ctx.stroke();
  ctx.fillStyle = C.text;
  ctx.font = '13.5px -apple-system, sans-serif';
  ctx.textAlign = x1 > x0 ? 'left' : 'right';
  ctx.fillText(text, x1 + (x1 > x0 ? 8 : -8), y1 - 4);
}

// ===========================================================================
// 一、 正立面图 (1:15 比例绘制，左上)
// ===========================================================================
const EL_X0 = 230, EL_Y0 = 990;
const S15 = 0.70; // 1800mm -> 1260px

drawTitle('正 立 面 图', 'FRONT ELEVATION · 比例 1:15', EL_X0 - 70, 95);

// 地面线
ctx.strokeStyle = C.axis;
ctx.lineWidth = 2.2;
ctx.beginPath();
ctx.moveTo(EL_X0 - 65, EL_Y0);
ctx.lineTo(EL_X0 + 1800 * S15 + 40, EL_Y0);
ctx.stroke();
drawLevel('±0.000', EL_X0 - 70, EL_Y0, false);

const ey = (mm) => EL_Y0 - mm * S15;
const ex = (mm) => EL_X0 + mm * S15;

// 1. 基台矮墙与坐板
ctx.fillStyle = 'rgba(255,255,255,0.06)';
ctx.fillRect(ex(0), ey(424), 1800 * S15, 424 * S15);
ctx.strokeStyle = C.obj;
ctx.lineWidth = 1.8;
ctx.strokeRect(ex(0), ey(424), 1800 * S15, 424 * S15);

ctx.fillStyle = 'rgba(93, 173, 226, 0.18)';
ctx.fillRect(ex(0), ey(460), 1800 * S15, 36 * S15);
ctx.strokeRect(ex(0), ey(460), 1800 * S15, 36 * S15);
drawLevel('+0.460 (坐板面)', EL_X0 - 70, ey(460), false);

// 2. 望柱 (两端，顺坡微倾，贯通锁定)
const POST_W = 64, POST_H = 1060 - 460;
for (const px of [0, 1800 - POST_W]) {
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(ex(px), ey(1040 + 20), POST_W * S15, POST_H * S15);
  ctx.strokeStyle = C.obj;
  ctx.lineWidth = 2;
  ctx.strokeRect(ex(px), ey(1040 + 20), POST_W * S15, POST_H * S15);
  // 方柱帽
  ctx.beginPath();
  ctx.moveTo(ex(px - 4), ey(1060));
  ctx.lineTo(ex(px + POST_W / 2), ey(1080));
  ctx.lineTo(ex(px + POST_W + 4), ey(1060));
  ctx.closePath();
  ctx.stroke();
}
drawLevel('+1.060 (柱顶)', ex(1800) + 10, ey(1060), true);

// 3. 通透地脚与上部短档：严格依据下部弯条轴线对齐 (依档对位，非机械按长度平分)
const CLEAR_W = 1800 - 2 * POST_W;
const N_BARS = 19;
const PITCH = CLEAR_W / N_BARS;
const BAR_W = 38;
const BAR_XS = [];
for (let i = 0; i < N_BARS; i++) {
  BAR_XS.push(POST_W + (i + 0.5) * PITCH);
}
// 依下部弯条对齐：选取第 5 档 (idx 4)、第 10 档 (idx 9，正中)、第 15 档 (idx 14)
const STRUT_INDICES = [4, 9, 14];
const STRUT_XS = STRUT_INDICES.map((idx) => BAR_XS[idx]);
const FEET_X = STRUT_XS;
for (const fx of FEET_X) {
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(ex(fx - 36), ey(468), 72 * S15, 8 * S15);
  ctx.strokeRect(ex(fx - 36), ey(468), 72 * S15, 8 * S15);
  ctx.fillRect(ex(fx - 21), ey(515), 42 * S15, 47 * S15);
  ctx.strokeRect(ex(fx - 21), ey(515), 42 * S15, 47 * S15);
}
drawLevel('+0.515 (底枋底)', EL_X0 - 70, ey(515), false);

// 4. 底枋
ctx.strokeRect(ex(POST_W), ey(555), CLEAR_W * S15, 40 * S15);
drawLevel('+0.555 (底枋顶)', EL_X0 - 70, ey(555), false);

// 5. 二道中横枋 (整体外挑100mm)
ctx.strokeRect(ex(POST_W), ey(922), CLEAR_W * S15, 32 * S15);
drawLevel('+0.890 (中枋底)', ex(1800) + 10, ey(890), true);
drawLevel('+0.922 (中枋顶)', ex(1800) + 10, ey(922), true);

// 6. 顶枋扶手 (整体外挑140mm)
ctx.strokeRect(ex(POST_W), ey(1040), CLEAR_W * S15, 45 * S15);
drawLevel('+1.040 (扶手顶)', ex(1800) + 10, ey(1040), true);

// 7. 天窗格短立档 (全长仅设 3 根主短档，形成 4 大通透开阔天窗)
for (const sx of STRUT_XS) {
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(ex(sx - BAR_W / 2), ey(995), BAR_W * S15, 73 * S15);
  ctx.strokeStyle = C.obj;
  ctx.lineWidth = 2.0;
  ctx.strokeRect(ex(sx - BAR_W / 2), ey(995), BAR_W * S15, 73 * S15);
}

// 8. 下部鹅颈弯条正投影 (19 档密排托背)
for (let i = 0; i < N_BARS; i++) {
  const bx = POST_W + (i + 0.5) * PITCH;
  ctx.fillStyle = 'rgba(93, 173, 226, 0.16)';
  ctx.fillRect(ex(bx - BAR_W / 2), ey(890), BAR_W * S15, 335 * S15);
  ctx.strokeStyle = C.obj;
  ctx.strokeRect(ex(bx - BAR_W / 2), ey(890), BAR_W * S15, 335 * S15);

  // 弯曲阴影线 (表现腰部向前/向外挺出的 3D 轮廓)
  ctx.strokeStyle = 'rgba(93, 173, 226, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ex(bx - BAR_W / 2 + 5), ey(890));
  ctx.quadraticCurveTo(ex(bx - BAR_W / 2 + 10), ey(710), ex(bx - BAR_W / 2 + 5), ey(555));
  ctx.moveTo(ex(bx + BAR_W / 2 - 5), ey(890));
  ctx.quadraticCurveTo(ex(bx + BAR_W / 2), ey(710), ex(bx + BAR_W / 2 - 5), ey(555));
  ctx.stroke();
  ctx.strokeStyle = C.obj;
  ctx.lineWidth = 1.8;
}

// 正立面尺寸标注
const DIM_Y1 = ey(1120);
const DIM_Y2 = ey(1180);
drawDimH(DIM_Y1, ex(0), ex(POST_W), '64');
drawDimH(DIM_Y1, ex(POST_W), ex(1800 - POST_W), '净跨 1672 (19档 @88mm)');
drawDimH(DIM_Y1, ex(1800 - POST_W), ex(1800), '64');
drawDimH(DIM_Y2, ex(0), ex(1800), '总长 1800');

const VDIM_X = ex(1800) + 125;
drawDimV(VDIM_X, ey(0), ey(460), '460', 10);
drawDimV(VDIM_X, ey(460), ey(515), '55', 10);
drawDimV(VDIM_X, ey(515), ey(555), '40', 10);
drawDimV(VDIM_X, ey(555), ey(890), '335', 10);
drawDimV(VDIM_X, ey(890), ey(922), '32', 10);
drawDimV(VDIM_X, ey(922), ey(995), '73', 10);
drawDimV(VDIM_X, ey(995), ey(1040), '45', 10);

const VDIM_X2 = ex(1800) + 185;
drawDimV(VDIM_X2, ey(460), ey(1040), '栏净高 580', 10);
drawDimV(VDIM_X2, ey(0), ey(1040), '总高 1040', 10);

// ===========================================================================
// 二、 1-1 侧剖面构造大样 (1:10 比例绘制，右上核心图)
// ===========================================================================
const SEC_X0 = 2460, SEC_Y0 = 1240;
const S10 = 1.0;

drawTitle('1-1 侧 剖 面 构 造 大 样', 'SECTION 1-1 · 比例 1:10', SEC_X0 - 240, 95);

const sx = (z_mm) => SEC_X0 + z_mm * S10;
const sy = (y_mm) => SEC_Y0 - y_mm * S10;

// 地面线
ctx.strokeStyle = C.axis;
ctx.lineWidth = 2.2;
ctx.beginPath();
ctx.moveTo(sx(-540), sy(0));
ctx.lineTo(sx(120), sy(0));
ctx.stroke();

// 1. 基座矮墙与坐凳板剖面
ctx.fillStyle = C.objFill;
ctx.fillRect(sx(-400), sy(424), 320 * S10, 424 * S10);
ctx.strokeStyle = C.objSec;
ctx.lineWidth = 2;
ctx.strokeRect(sx(-400), sy(424), 320 * S10, 424 * S10);

ctx.fillStyle = 'rgba(93, 173, 226, 0.28)';
ctx.fillRect(sx(-400), sy(460), 400 * S10, 36 * S10);
ctx.strokeRect(sx(-400), sy(460), 400 * S10, 36 * S10);

// 2. 地脚码剖面 (安装中心在 FZ = -320)
const FZ = -320;
ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
ctx.fillRect(sx(FZ - 36), sy(468), 72 * S10, 8 * S10);
ctx.strokeRect(sx(FZ - 36), sy(468), 72 * S10, 8 * S10);
ctx.fillRect(sx(FZ - 21), sy(515), 42 * S10, 47 * S10);
ctx.strokeRect(sx(FZ - 21), sy(515), 42 * S10, 47 * S10);

ctx.strokeStyle = C.dim;
ctx.lineWidth = 1.5;
ctx.beginPath();
ctx.moveTo(sx(FZ - 24), sy(468)); ctx.lineTo(sx(FZ - 24), sy(410));
ctx.moveTo(sx(FZ + 24), sy(468)); ctx.lineTo(sx(FZ + 24), sy(410));
ctx.stroke();

// 3. 底枋剖面 (45宽 x 40高，水平安装在 Z = -320)
ctx.fillStyle = C.objFill;
ctx.fillRect(sx(FZ - 22.5), sy(555), 45 * S10, 40 * S10);
ctx.strokeStyle = C.objSec;
ctx.lineWidth = 2;
ctx.strokeRect(sx(FZ - 22.5), sy(555), 45 * S10, 40 * S10);

// ---------------------------------------------------------------------------
// 4. 鹅颈反 S 弯条【实物 1:1 悬挑双曲实体放样，腰挺 119mm】
// ---------------------------------------------------------------------------
const Z_SEC2 = FZ - 100; // 二道枋中心 Z = -420 (悬挑 100mm)
const Z_TOP = FZ - 140;  // 顶枋中心 Z = -460 (悬挑 140mm)
const BAR_THICK = 26;    // 弯条实测法向实体厚度 26mm

function getSlatCenter(t) {
  const y = 555 + (890 - 555) * t;
  const h01 = -2.0 * t**3 + 3.0 * t**2;
  const h11 = t**3 - t**2;
  const zBase = -100.0 * h01 + (-100.0) * h11;
  const bulge = -65.0 * (Math.sin(Math.PI * t) ** 1.6) * (1.0 + 0.35 * (1.0 - t));
  const z = FZ + zBase + bulge;
  return { z, y };
}

const N_SAMPLES = 50;
const ptsIn = [];
const ptsOut = [];
const ptsCenter = [];

for (let i = 0; i <= N_SAMPLES; i++) {
  const t = i / N_SAMPLES;
  const p = getSlatCenter(t);
  ptsCenter.push(p);

  const dt = 0.005;
  const t1 = Math.max(0, t - dt);
  const t2 = Math.min(1, t + dt);
  const p1 = getSlatCenter(t1);
  const p2 = getSlatCenter(t2);
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dz, dy);
  const ny = -dz / len;
  const nz = dy / len;

  ptsIn.push({ z: p.z + (BAR_THICK / 2) * nz, y: p.y + (BAR_THICK / 2) * ny });
  ptsOut.push({ z: p.z - (BAR_THICK / 2) * nz, y: p.y - (BAR_THICK / 2) * ny });
}

// 绘制具有实体截面的鹅颈弯条闭合多边形
ctx.beginPath();
const bottomTenonY = 545;
ctx.moveTo(sx(ptsIn[0].z), sy(bottomTenonY));
ctx.lineTo(sx(ptsIn[0].z), sy(ptsIn[0].y));
ptsIn.forEach((pt) => ctx.lineTo(sx(pt.z), sy(pt.y)));
const topTenonY = 902;
ctx.lineTo(sx(Z_SEC2 + BAR_THICK / 2), sy(topTenonY));
ctx.lineTo(sx(Z_SEC2 - BAR_THICK / 2), sy(topTenonY));
ctx.lineTo(sx(ptsOut[ptsOut.length - 1].z), sy(ptsOut[ptsOut.length - 1].y));
for (let i = ptsOut.length - 1; i >= 0; i--) {
  ctx.lineTo(sx(ptsOut[i].z), sy(ptsOut[i].y));
}
ctx.lineTo(sx(ptsOut[0].z), sy(bottomTenonY));
ctx.closePath();

ctx.fillStyle = C.objFill;
ctx.fill();
ctx.strokeStyle = C.objSec;
ctx.lineWidth = 2.2;
ctx.stroke();

// 绘制实体截面斜剖面线
ctx.save();
ctx.clip();
ctx.strokeStyle = C.objHatch;
ctx.lineWidth = 1.0;
for (let d = -800; d < 800; d += 16) {
  ctx.beginPath();
  ctx.moveTo(sx(FZ - 300 + d), sy(450));
  ctx.lineTo(sx(FZ - 300 + d + 300), sy(450 + 300));
  ctx.stroke();
}
ctx.restore();

// 绘制弯条中心线
ctx.strokeStyle = C.axis;
ctx.lineWidth = 1.2;
ctx.setLineDash([6, 4]);
ctx.beginPath();
ptsCenter.forEach((pt, idx) => {
  if (idx === 0) ctx.moveTo(sx(pt.z), sy(pt.y));
  else ctx.lineTo(sx(pt.z), sy(pt.y));
});
ctx.stroke();
ctx.setLineDash([]);

// 5. 二道中横枋剖面 (46宽 x 32高，水平放置在 Z = -420，悬挑 100mm)
ctx.fillStyle = C.objFill;
ctx.fillRect(sx(Z_SEC2 - 23), sy(922), 46 * S10, 32 * S10);
ctx.strokeStyle = C.objSec;
ctx.lineWidth = 2;
ctx.strokeRect(sx(Z_SEC2 - 23), sy(922), 46 * S10, 32 * S10);

// 6. 天窗格短立档 (26厚 x 73高，顺坡斜接二道枋与顶枋)
ctx.fillStyle = 'rgba(255,255,255,0.18)';
ctx.beginPath();
ctx.moveTo(sx(Z_SEC2 + 13), sy(922));
ctx.lineTo(sx(Z_TOP + 13), sy(995));
ctx.lineTo(sx(Z_TOP - 13), sy(995));
ctx.lineTo(sx(Z_SEC2 - 13), sy(922));
ctx.closePath();
ctx.fill();
ctx.strokeStyle = C.obj;
ctx.lineWidth = 2;
ctx.stroke();

// 7. 顶枋扶手（寻杖）剖面 (76宽 x 45高，水平放置在 Z = -460，悬挑 140mm)
const RW = 76 * S10, RH = 45 * S10, RR = 14 * S10;
const RX0 = sx(Z_TOP) - RW / 2, RY0 = sy(1040);
ctx.beginPath();
ctx.moveTo(RX0, RY0 + RH);
ctx.lineTo(RX0 + RW, RY0 + RH);
ctx.lineTo(RX0 + RW, RY0 + RR);
ctx.quadraticCurveTo(RX0 + RW, RY0, RX0 + RW - RR, RY0);
ctx.lineTo(RX0 + RR, RY0);
ctx.quadraticCurveTo(RX0, RY0, RX0, RY0 + RR);
ctx.closePath();
ctx.fillStyle = C.objFill;
ctx.fill();
ctx.strokeStyle = C.objSec;
ctx.lineWidth = 2.2;
ctx.stroke();

// 扶手内部剖面线
ctx.save();
ctx.clip();
ctx.strokeStyle = C.objHatch;
ctx.lineWidth = 1.0;
for (let d = -200; d < 200; d += 14) {
  ctx.beginPath();
  ctx.moveTo(RX0 + d, RY0 + RH + 50);
  ctx.lineTo(RX0 + d + 80, RY0 - 30);
  ctx.stroke();
}
ctx.restore();

// 剖面尺寸标注
const SDIM_Y1 = sy(-50);
const SDIM_Y2 = sy(-95);
drawDimH(SDIM_Y1, sx(-400), sx(-80), '墙厚 320');
drawDimH(SDIM_Y1, sx(-80), sx(0), '挑出 80');
drawDimH(SDIM_Y2, sx(-400), sx(0), '坐板总深 400');
drawDimH(sy(485), sx(FZ), sx(0), '人坐净深 320 (座面宽松留空)');

// 立面铅垂基准中心线 (经过 Z = -320)
ctx.strokeStyle = C.axis;
ctx.lineWidth = 1.2;
ctx.setLineDash([6, 5]);
ctx.beginPath();
ctx.moveTo(sx(FZ), sy(460)); ctx.lineTo(sx(FZ), sy(1080));
ctx.stroke();
ctx.setLineDash([]);

// 标注顶枋寻杖悬挑 140mm
drawDimH(sy(1065), sx(Z_TOP), sx(FZ), '寻杖悬挑 140');
// 标注二道枋悬挑 100mm
drawDimH(sy(940), sx(Z_SEC2), sx(FZ), '二道枋悬挑 100');
// 标注腰部最大外挺 119mm
const PEAK_Z = FZ - 118.8;
drawDimH(sy(730), sx(PEAK_Z), sx(FZ), '腰挺 119');

drawLeader('实体法向厚度 26 (实体双弧放样)', sx(PEAK_Z + 13), sy(745), sx(PEAK_Z - 60), sy(770));
drawLeader('立面铅垂轴线 (安装基准 Z = -320)', sx(FZ), sy(1020), sx(FZ + 80), sy(1025));
drawLeader('宽面寻杖扶手 76×45 (R14倒圆，外挑140)', sx(Z_TOP), sy(1040), sx(Z_TOP - 90), sy(1065));
drawLeader('天窗格短立档 38×26×73 (顺坡斜接)', sx((Z_SEC2 + Z_TOP) / 2), sy(960), sx(Z_TOP - 90), sy(970));
drawLeader('二道中横枋 46×32 (外挑100)', sx(Z_SEC2 - 23), sy(910), sx(Z_SEC2 - 90), sy(910));
drawLeader('底枋横梁 45×40 (安装于 Z = -320)', sx(FZ - 22.5), sy(535), sx(FZ - 90), sy(535));
drawLeader('通透金属地脚码 (架空55mm自流排水)', sx(FZ - 21), sy(490), sx(FZ - 90), sy(490));
drawLeader('M10高强膨胀螺栓锚固', sx(FZ), sy(440), sx(FZ - 90), sy(440));

// ===========================================================================
// 三、 平 俯 视 图 (1:15 比例绘制，左下)
// ===========================================================================
const PLAN_X0 = 230, PLAN_Y0 = 1580;
drawTitle('平 俯 视 图', 'PLAN VIEW · 比例 1:15', PLAN_X0 - 70, 1420);

const px = (mm) => PLAN_X0 + mm * S15;
const py = (z_mm) => PLAN_Y0 - z_mm * S15;

// 坐板面投影 (Z 从 -400 到 0)
ctx.fillStyle = 'rgba(93, 173, 226, 0.12)';
ctx.fillRect(px(0), py(0), 1800 * S15, 400 * S15);
ctx.strokeStyle = C.obj;
ctx.lineWidth = 1.8;
ctx.strokeRect(px(0), py(0), 1800 * S15, 400 * S15);

// 墙身隐线投影 (Z 从 -400 到 -80)
ctx.strokeStyle = C.dimAux;
ctx.setLineDash([5, 5]);
ctx.strokeRect(px(0), py(-80), 1800 * S15, 320 * S15);
ctx.setLineDash([]);

// 两端望柱
for (const x of [0, 1800 - 64]) {
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(px(x), py(FZ + 32), 64 * S15, 64 * S15);
  ctx.strokeStyle = C.obj;
  ctx.lineWidth = 2;
  ctx.strokeRect(px(x), py(FZ + 32), 64 * S15, 64 * S15);
}

// 4 组地脚
for (const fx of FEET_X) {
  ctx.strokeRect(px(fx - 36), py(FZ + 36), 72 * S15, 72 * S15);
  ctx.strokeRect(px(fx - 21), py(FZ + 21), 42 * S15, 42 * S15);
  ctx.fillStyle = C.dim;
  for (const dx of [-22, 22]) {
    for (const dz of [-22, 22]) {
      ctx.beginPath();
      ctx.arc(px(fx + dx), py(FZ + dz), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 底枋投影 (Z = -320，宽 45)
ctx.strokeStyle = C.dimAux;
ctx.setLineDash([4, 4]);
ctx.strokeRect(px(POST_W), py(FZ + 22.5), CLEAR_W * S15, 45 * S15);
ctx.setLineDash([]);

// 二道枋投影 (Z = -420，宽 46)
ctx.strokeStyle = C.dimAux;
ctx.strokeRect(px(POST_W), py(Z_SEC2 + 23), CLEAR_W * S15, 46 * S15);

// 顶枋寻杖投影 (Z = -460，宽 76，向外悬挑挑出座面后沿 60mm)
ctx.fillStyle = 'rgba(93, 173, 226, 0.22)';
ctx.fillRect(px(POST_W), py(Z_TOP + 38), CLEAR_W * S15, 76 * S15);
ctx.strokeStyle = C.objSec;
ctx.lineWidth = 2.0;
ctx.strokeRect(px(POST_W), py(Z_TOP + 38), CLEAR_W * S15, 76 * S15);

// 腰部最大外挺投影线 (Z = -438.8)
ctx.strokeStyle = C.axis;
ctx.setLineDash([8, 6]);
ctx.beginPath();
ctx.moveTo(px(POST_W), py(PEAK_Z));
ctx.lineTo(px(1800 - POST_W), py(PEAK_Z));
ctx.stroke();
ctx.setLineDash([]);

drawDimH(py(45), px(0), px(1800), '总长 1800');
drawDimV(px(1800) + 35, py(0), py(-80), '挑 80', 8);
drawDimV(px(1800) + 35, py(-80), py(-400), '墙 320', 8);
drawDimV(px(1800) + 90, py(0), py(-400), '座板进深 400', 8);
drawDimV(px(1800) + 90, py(-400), py(Z_TOP - 38), '寻杖外挑出座 98', 8);

drawLeader('坐板前沿 (人坐内沿)', px(350), py(0), px(350), py(75));
drawLeader('底枋安装轴线 (Z = -320)', px(650), py(FZ), px(650), py(FZ + 50));
drawLeader('腰部外挺峰值线 (Z = -439)', px(1050), py(PEAK_Z), px(1050), py(PEAK_Z - 50));
drawLeader('顶枋寻杖扶手 (Z = -460，挑出座板)', px(1450), py(Z_TOP), px(1450), py(Z_TOP - 50));

// ===========================================================================
// 四、 构件明细表与技术说明 (右下区域)
// ===========================================================================
const SCH_X = 1660, SCH_Y = 1420;
drawTitle('构 件 明 细 表', 'SCHEDULE OF COMPONENTS', SCH_X, 1380);

const TABLE_W = 1540;
const T_COLS = [80, 240, 280, 110, 230, 600];
const T_HEADER = ['序号', '构件名称', '断面规格 (mm)', '数量', '主要材质', '制造与工艺技术要求'];
const T_DATA = [
  ['MK-01', '宽面扶手顶枋(寻杖)', '宽 76 × 高 45 (通长)', '1 根', '深色仿古铝木/硬木', '微拱弧面(R14倒圆)，整体向外悬挑140mm，手握舒适，顺坡入端柱'],
  ['MK-02', '天窗短立档', '宽 38 × 厚 26 × 高 73', '3 根', '同上', '顺坡斜接二道枋与顶枋，与下部 3 组地脚柱上下同轴贯通，形成 4 组大跨度开阔通透天窗格（下密上疏）'],
  ['MK-03', '二道中横枋', '宽 46 × 高 32 (通长)', '1 根', '同上', '整体向外悬挑100mm，水平通长布置，承托短档并锁固弯条'],
  ['MK-04', '鹅颈反S靠背弯条', '看面 38 × 实体厚 26 × 高 335', '19 根', '专用高精双曲型材/模压', '标准反S双曲放样：腰挺119mm贴身承托，底端垂直平滑入槽，顶端内敛倾斜'],
  ['MK-05', '底枋下导梁', '宽 45 × 高 40 (通长)', '1 根', '同上', '水平安装于座面 Z = -320 处，顶面开承插盲槽固定弯条，底接立脚'],
  ['MK-06', '通透安装地脚码', '立管 42×42×55，底盘 72×8', '3 组', '结构金属 / 氟碳喷涂', '配 M10 膨胀螺栓锚固于石座板，与上部短档同轴受力，架空底枋55mm自流排水'],
  ['MK-07', '收口端立望柱', '方柱 64×64×600 (含方帽)', '2 根', '同上', '顺应靠背坡度向外微倾贯通锁定全部横枋与扶手，顶覆斗方帽'],
  ['MK-08', '坐席石面板/座板', '宽 400 × 厚 36 (挑出 80)', '1 块', '天然芝麻白/青石/防腐木', '平整打磨倒棱，前挑80mm滴水，留出净深320mm舒适坐面'],
];

let curY = SCH_Y + 15;
ctx.fillStyle = 'rgba(16, 36, 56, 0.95)';
ctx.fillRect(SCH_X, curY, TABLE_W, 35);
ctx.strokeStyle = C.border;
ctx.lineWidth = 1.5;
ctx.strokeRect(SCH_X, curY, TABLE_W, 35);

ctx.fillStyle = C.title;
ctx.font = 'bold 14px -apple-system, sans-serif';
ctx.textAlign = 'center';
let curX = SCH_X;
T_HEADER.forEach((h, i) => {
  ctx.fillText(h, curX + T_COLS[i] / 2, curY + 22);
  curX += T_COLS[i];
  if (i < T_COLS.length - 1) {
    ctx.beginPath(); ctx.moveTo(curX, curY); ctx.lineTo(curX, curY + 35 + T_DATA.length * 36); ctx.stroke();
  }
});

curY += 35;
ctx.font = '13px -apple-system, sans-serif';
T_DATA.forEach((row, ri) => {
  ctx.fillStyle = ri % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.18)';
  ctx.fillRect(SCH_X, curY, TABLE_W, 36);
  ctx.strokeStyle = C.borderInner;
  ctx.strokeRect(SCH_X, curY, TABLE_W, 36);

  curX = SCH_X;
  row.forEach((cell, ci) => {
    ctx.fillStyle = ci === 0 ? C.dim : ci === 5 ? C.subText : C.text;
    ctx.textAlign = ci <= 3 ? 'center' : 'left';
    ctx.fillText(cell, ci <= 3 ? curX + T_COLS[ci] / 2 : curX + 12, curY + 23);
    curX += T_COLS[ci];
  });
  curY += 36;
});

// 施工技术要点说明
const NOTE_Y = curY + 20;
ctx.fillStyle = C.title;
ctx.font = 'bold 15px -apple-system, sans-serif';
ctx.textAlign = 'left';
ctx.fillText('施工与装配技术要求：', SCH_X, NOTE_Y);

const NOTES = [
  '1. 整体向外悬挑倾斜架构：顶枋寻杖整体向外悬挑 140mm（Z = -460），二道中枋向外悬挑 100mm（Z = -420），形成正宗江南吴王靠倚坐后仰体态；',
  '2. 鹅颈反 S 曲线放样：弯条按实测实体厚度 26mm 双弧线精密放样，腰挺 119mm 温润饱满，两端榫接平滑咬合进底枋与二道枋槽口；',
  '3. 下密上疏天窗形制：全长仅设 3 根主受力短立档（MK-02），与下层 3 组地脚支撑立柱严格垂直同轴贯通对齐，形成 4 组大跨度开阔通透天窗格，彻底杜绝上部密排小栅栏的呆滞感，完美呈现正统江南吴王靠『下密上疏、虚实分明』的建筑艺术节奏。',
  '4. 底枋架空防腐排水：底枋通过金属脚码垫高 55mm，座面雨水与落叶顺畅自流排泄；构件接缝采用结构耐候胶密封并暗螺栓紧固。',
];
ctx.font = '13px -apple-system, sans-serif';
ctx.fillStyle = C.text;
NOTES.forEach((txt, idx) => {
  ctx.fillText(txt, SCH_X + 10, NOTE_Y + 26 + idx * 22);
});

window.__done = true;
</script>
</body>
</html>
`;

async function run() {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    args: [...gpuArgs(), '--no-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  page.on('console', (m) => console.log(m.text()));
  page.on('pageerror', (e) => console.error(e.message));
  await page.setViewport({ width: W, height: H });
  await page.setContent(HTML);
  await page.waitForFunction(() => window.__done === true);

  const canvas = await page.$('#cv');
  await canvas.screenshot({ path: TARGET_PNG, type: 'png' });
  console.log('Blueprint PNG written:', TARGET_PNG, fs.statSync(TARGET_PNG).size, 'bytes');

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
