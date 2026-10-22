// ---------------------------------------------------------------------------
// interior-scholar.js — Ming-Style Literati Interior Furnishings (文人雅集陈设)
// Transforms the hall into a classical Jiangnan scholar's reception hall:
//   - Central Reception (中堂): Landscape hanging scroll + couplets + long altar table + armchairs
//   - Guqin Alcove (琴台): Seven-string Guqin zither on dedicated table
//   - Daybed (罗汉床): Reclining daybed with low tea table and cushions
//   - Curio Shelves (博古架): Asymmetric display case with antiques and books
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { rbox } from './interior-geo.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function mat4(pos, rot = [0, 0, 0], s = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  const sc = typeof s === 'number' ? V3(s, s, s) : V3(...s);
  return new THREE.Matrix4().compose(V3(...pos), q, sc);
}

// ---------------------------------------------------------------------------
// Procedural Ink Landscape Painting & Couplets (水墨山水轴与对联)
// ---------------------------------------------------------------------------
export function createZhongtangTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d');

  // 1. Aged silk / paper mounting (宣纸古绢底色)
  ctx.fillStyle = '#eedfc8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Silk border mounting (裱绢锦绫边框)
  ctx.fillStyle = '#bfa588';
  ctx.fillRect(0, 0, canvas.width, 140); // Top mounting (天头)
  ctx.fillRect(0, canvas.height - 180, canvas.width, 180); // Bottom mounting (地脚)
  ctx.fillRect(0, 0, 90, canvas.height); // Left border
  ctx.fillRect(canvas.width - 90, 0, 90, canvas.height); // Right border

  // Fine gold silk inlay line (绫牙惊燕)
  ctx.strokeStyle = '#8c6d48';
  ctx.lineWidth = 4;
  ctx.strokeRect(90, 140, canvas.width - 180, canvas.height - 320);

  // 2. Painting core (画心)
  const cx0 = 94, cy0 = 144, cw = canvas.width - 188, ch = canvas.height - 328;
  const grad = ctx.createLinearGradient(0, cy0, 0, cy0 + ch);
  grad.addColorStop(0, '#f2ede0');
  grad.addColorStop(0.5, '#ede4d2');
  grad.addColorStop(1, '#dfd2ba');
  ctx.fillStyle = grad;
  ctx.fillRect(cx0, cy0, cw, ch);

  // 3. Ink Wash Mountains (水墨远山 - 墨分五色)
  // Distant mountains (淡墨群峰)
  ctx.fillStyle = 'rgba(100, 108, 115, 0.28)';
  ctx.beginPath();
  ctx.moveTo(cx0, cy0 + ch * 0.45);
  ctx.bezierCurveTo(cx0 + cw * 0.2, cy0 + ch * 0.22, cx0 + cw * 0.4, cy0 + ch * 0.35, cx0 + cw * 0.55, cy0 + ch * 0.20);
  ctx.bezierCurveTo(cx0 + cw * 0.7, cy0 + ch * 0.12, cx0 + cw * 0.85, cy0 + ch * 0.28, cx0 + cw, cy0 + ch * 0.38);
  ctx.lineTo(cx0 + cw, cy0 + ch);
  ctx.lineTo(cx0, cy0 + ch);
  ctx.fill();

  // Midground peaks (重峦叠嶂)
  ctx.fillStyle = 'rgba(60, 68, 72, 0.52)';
  ctx.beginPath();
  ctx.moveTo(cx0, cy0 + ch * 0.65);
  ctx.bezierCurveTo(cx0 + cw * 0.18, cy0 + ch * 0.42, cx0 + cw * 0.32, cy0 + ch * 0.52, cx0 + cw * 0.45, cy0 + ch * 0.38);
  ctx.bezierCurveTo(cx0 + cw * 0.58, cy0 + ch * 0.28, cx0 + cw * 0.72, cy0 + ch * 0.48, cx0 + cw * 0.88, cy0 + ch * 0.50);
  ctx.lineTo(cx0 + cw, cy0 + ch);
  ctx.lineTo(cx0, cy0 + ch);
  ctx.fill();

  // Foreground crag & pines (浓墨焦墨近石与苍松)
  ctx.fillStyle = 'rgba(28, 32, 35, 0.85)';
  ctx.beginPath();
  ctx.moveTo(cx0 + cw * 0.1, cy0 + ch);
  ctx.lineTo(cx0 + cw * 0.18, cy0 + ch * 0.72);
  ctx.bezierCurveTo(cx0 + cw * 0.28, cy0 + ch * 0.65, cx0 + cw * 0.38, cy0 + ch * 0.75, cx0 + cw * 0.48, cy0 + ch * 0.68);
  ctx.lineTo(cx0 + cw * 0.65, cy0 + ch);
  ctx.fill();

  // Pine branches (虬曲松枝)
  ctx.strokeStyle = 'rgba(20, 24, 26, 0.9)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx0 + cw * 0.28, cy0 + ch * 0.75);
  ctx.bezierCurveTo(cx0 + cw * 0.22, cy0 + ch * 0.62, cx0 + cw * 0.15, cy0 + ch * 0.55, cx0 + cw * 0.32, cy0 + ch * 0.48);
  ctx.stroke();

  // Pine needles (松针簇)
  ctx.fillStyle = 'rgba(18, 22, 24, 0.88)';
  for (let i = 0; i < 28; i++) {
    const px = cx0 + cw * (0.22 + Math.sin(i * 1.7) * 0.12);
    const py = cy0 + ch * (0.48 + Math.cos(i * 2.3) * 0.08);
    ctx.beginPath();
    ctx.arc(px, py, 14 + (i % 5) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Waterfall / stream mist (飞瀑流泉云气)
  ctx.fillStyle = 'rgba(240, 235, 222, 0.6)';
  ctx.beginPath();
  ctx.ellipse(cx0 + cw * 0.52, cy0 + ch * 0.60, 60, 160, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // 4. Inscription and Seals (诗文题跋与朱文印章)
  ctx.fillStyle = '#9c2420'; // Vermilion seal ink (朱砂印泥)
  // Artist seal (名章)
  ctx.fillRect(cx0 + cw * 0.80, cy0 + ch * 0.22, 42, 42);
  ctx.fillRect(cx0 + cw * 0.80, cy0 + ch * 0.26 + 10, 42, 42);
  // Collection seal (收藏引首章)
  ctx.fillRect(cx0 + cw * 0.08, cy0 + ch * 0.18, 32, 54);

  // Black calligraphy title & poem (墨题)
  ctx.fillStyle = '#1a1816';
  ctx.font = '24px serif';
  ctx.fillText('姑苏烟峦图', cx0 + cw * 0.72, cy0 + ch * 0.15);
  ctx.font = '16px serif';
  ctx.fillText('岁在丙午秋日 拟宋人遗意', cx0 + cw * 0.72, cy0 + ch * 0.18);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCoupletTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d');

  // Dark lacquered wood board with gold leaf incised characters
  ctx.fillStyle = '#1c1511';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Inner carved line border
  ctx.strokeStyle = '#c49a45';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 24, canvas.width - 36, canvas.height - 48);

  // Gold incised calligraphy (金字对联)
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 54px serif';
  ctx.textAlign = 'center';
  const chars = text.split('');
  const startY = 160;
  const stepY = (canvas.height - 280) / chars.length;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], canvas.width / 2, startY + i * stepY);
  }

  // Red seal at the bottom
  ctx.fillStyle = '#a62b25';
  ctx.fillRect(canvas.width / 2 - 20, canvas.height - 110, 40, 40);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------------------------------------------------------------------------
// Ming-Style Furniture Builders (明式家具程序化建模)
// ---------------------------------------------------------------------------

// 1. Long Altar Table (红木翘头条案)
export function buildAltarTable(B, woodMat, { x = 0, y = 0, z = 0, w = 4.2, d = 0.65, h = 0.95 } = {}) {
  const box = (bw, bh, bd, px, py, pz, bev = 0.005) => {
    B.add(rbox(bw, bh, bd, bev, 2), woodMat, mat4([x + px, y + py, z + pz]));
  };

  const topH = 0.06;
  // Main tabletop
  box(w, topH, d, 0, h - topH * 0.5, 0, 0.008);
  // Upturned ends (翘头)
  const qW = 0.04, qH = 0.06;
  box(qW, qH, d, -w * 0.5 + qW * 0.5, h + qH * 0.5, 0, 0.006);
  box(qW, qH, d, w * 0.5 - qW * 0.5, h + qH * 0.5, 0, 0.006);

  // Apron and spandrels (牙板与牙头)
  const apronH = 0.08, apronD = 0.035;
  box(w - 0.25, apronH, apronD, 0, h - topH - apronH * 0.5, d * 0.5 - apronD * 0.5);
  box(w - 0.25, apronH, apronD, 0, h - topH - apronH * 0.5, -d * 0.5 + apronD * 0.5);

  // Legs (案腿 - 四足立柱)
  const legW = 0.08, legD = 0.08, legH = h - topH;
  const lx = w * 0.5 - 0.35, lz = d * 0.5 - 0.12;
  box(legW, legH, legD, -lx, legH * 0.5, -lz);
  box(legW, legH, legD, lx, legH * 0.5, -lz);
  box(legW, legH, legD, -lx, legH * 0.5, lz);
  box(legW, legH, legD, lx, legH * 0.5, lz);

  // Side stretchers (双档管脚枨)
  const strH = 0.04, strW = 0.03;
  box(strW, strH, lz * 2, -lx, 0.16, 0);
  box(strW, strH, lz * 2, lx, 0.16, 0);
  box(strW, strH, lz * 2, -lx, 0.28, 0);
  box(strW, strH, lz * 2, lx, 0.28, 0);
}

// 2. Official's Hat Armchair (明式官帽椅 / 太师椅)
export function buildArmchair(B, woodMat, { x = 0, y = 0, z = 0, ry = 0, scale = 1 } = {}) {
  const box = (bw, bh, bd, px, py, pz, rot = [0, 0, 0]) => {
    const p = new THREE.Vector3(px, py, pz).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    B.add(rbox(bw * scale, bh * scale, bd * scale, 0.003 * scale, 2), woodMat, mat4([x + p.x, y + p.y, z + p.z], [rot[0], rot[1] + ry, rot[2]]));
  };

  const w = 0.62, d = 0.55, seatH = 0.50, backH = 0.58;

  // Seat frame (椅盘)
  box(w, 0.04, d, 0, seatH, 0, [0, 0, 0]);

  // Four legs (椅腿)
  const lw = 0.036, lh = seatH;
  const lx = w * 0.5 - 0.05, lz = d * 0.5 - 0.05;
  box(lw, lh, lw, -lx, lh * 0.5, -lz);
  box(lw, lh, lw, lx, lh * 0.5, -lz);
  box(lw, lh, lw, -lx, lh * 0.5, lz);
  box(lw, lh, lw, lx, lh * 0.5, lz);

  // Stepped stretchers (步步高赶枨)
  box(w - 0.06, 0.025, lw, 0, 0.10, lz); // Front footrest stretcher
  box(lw, 0.025, d - 0.06, -lx, 0.14, 0); // Side
  box(lw, 0.025, d - 0.06, lx, 0.14, 0); // Side
  box(w - 0.06, 0.025, lw, 0, 0.18, -lz); // Back

  // Backrest top crest rail (搭脑)
  const crestW = w + 0.12, crestH = 0.04, crestD = 0.05;
  box(crestW, crestH, crestD, 0, seatH + backH, -lz, [0, 0, 0]);

  // Back stiles (后腿上延)
  box(lw, backH, lw, -lx + 0.02, seatH + backH * 0.5, -lz);
  box(lw, backH, lw, lx - 0.02, seatH + backH * 0.5, -lz);

  // S-curved central splat (S型靠背板)
  box(0.18, backH - 0.04, 0.02, 0, seatH + backH * 0.5, -lz + 0.02);

  // Armrests (扶手)
  const armL = d + 0.08, armH = 0.035, armW = 0.035;
  box(armW, armH, armL, -lx - 0.01, seatH + backH * 0.45, 0);
  box(armW, armH, armL, lx + 0.01, seatH + backH * 0.45, 0);

  // Front arm posts (鹅脖)
  box(lw, backH * 0.45, lw, -lx, seatH + backH * 0.22, lz - 0.05);
  box(lw, backH * 0.45, lw, lx, seatH + backH * 0.22, lz - 0.05);
}

// 3. Eight Immortals Square Table (八仙方桌)
export function buildSquareTable(B, woodMat, { x = 0, y = 0, z = 0, size = 1.05, h = 0.86 } = {}) {
  const box = (bw, bh, bd, px, py, pz) => {
    B.add(rbox(bw, bh, bd, 0.005, 2), woodMat, mat4([x + px, y + py, z + pz]));
  };

  const topH = 0.05;
  box(size, topH, size, 0, h - topH * 0.5, 0);

  // Apron (牙板)
  const apH = 0.065, apD = 0.03;
  box(size - 0.16, apH, apD, 0, h - topH - apH * 0.5, size * 0.5 - apD * 0.5);
  box(size - 0.16, apH, apD, 0, h - topH - apH * 0.5, -size * 0.5 + apD * 0.5);
  box(apD, apH, size - 0.16, size * 0.5 - apD * 0.5, h - topH - apH * 0.5, 0);
  box(apD, apH, size - 0.16, -size * 0.5 + apD * 0.5, h - topH - apH * 0.5, 0);

  // Legs with horse-hoof feet (马蹄足腿)
  const lw = 0.065, lh = h - topH;
  const lx = size * 0.5 - lw * 0.5 - 0.02;
  box(lw, lh, lw, -lx, lh * 0.5, -lx);
  box(lw, lh, lw, lx, lh * 0.5, -lx);
  box(lw, lh, lw, -lx, lh * 0.5, lx);
  box(lw, lh, lw, lx, lh * 0.5, lx);

  // Low humped stretchers (罗锅枨)
  box(size - 0.20, 0.035, 0.025, 0, h * 0.45, lx - 0.01);
  box(size - 0.20, 0.035, 0.025, 0, h * 0.45, -lx + 0.01);
  box(0.025, 0.035, size - 0.20, lx - 0.01, h * 0.45, 0);
  box(0.025, 0.035, size - 0.20, -lx + 0.01, h * 0.45, 0);
}

// 4. Luohan Daybed (明式罗汉床)
export function buildLuohanBed(B, woodMat, { x = 0, y = 0, z = 0, w = 2.15, d = 1.25, h = 0.50, railH = 0.42 } = {}) {
  const box = (bw, bh, bd, px, py, pz) => {
    B.add(rbox(bw, bh, bd, 0.006, 2), woodMat, mat4([x + px, y + py, z + pz]));
  };

  // Base platform (床身)
  const seatH = 0.06;
  box(w, seatH, d, 0, h - seatH * 0.5, 0);

  // Heavy legs (三弯鼓腿马蹄)
  const lw = 0.11, lh = h - seatH;
  const lx = w * 0.5 - lw * 0.5 - 0.04, lz = d * 0.5 - lw * 0.5 - 0.04;
  box(lw, lh, lw, -lx, lh * 0.5, -lz);
  box(lw, lh, lw, lx, lh * 0.5, -lz);
  box(lw, lh, lw, -lx, lh * 0.5, lz);
  box(lw, lh, lw, lx, lh * 0.5, lz);

  // Three-sided solid wood railings (三面围子)
  const railThick = 0.045;
  // Back rail
  box(w, railH, railThick, 0, h + railH * 0.5, -d * 0.5 + railThick * 0.5);
  // Left rail
  box(railThick, railH, d - railThick, -w * 0.5 + railThick * 0.5, h + railH * 0.5, railThick * 0.5);
  // Right rail
  box(railThick, railH, d - railThick, w * 0.5 - railThick * 0.5, h + railH * 0.5, railThick * 0.5);

  // Low tea table on bed (炕几)
  const kw = 0.75, kd = 0.42, kh = 0.25;
  box(kw, 0.03, kd, 0, h + 0.01 + kh, 0);
  box(0.04, kh, 0.04, -kw * 0.5 + 0.03, h + 0.01 + kh * 0.5, -kd * 0.5 + 0.03);
  box(0.04, kh, 0.04, kw * 0.5 - 0.03, h + 0.01 + kh * 0.5, -kd * 0.5 + 0.03);
  box(0.04, kh, 0.04, -kw * 0.5 + 0.03, h + 0.01 + kh * 0.5, kd * 0.5 - 0.03);
  box(0.04, kh, 0.04, kw * 0.5 - 0.03, h + 0.01 + kh * 0.5, kd * 0.5 - 0.03);
}

// 5. Curio Shelves / Bookcase (博古架 / 万卷宝格)
export function buildCurioShelf(B, woodMat, { x = 0, y = 0, z = 0, w = 1.85, d = 0.42, h = 2.45 } = {}) {
  const box = (bw, bh, bd, px, py, pz) => {
    B.add(rbox(bw, bh, bd, 0.004, 2), woodMat, mat4([x + px, y + py, z + pz]));
  };

  const th = 0.03;
  // Outer frame
  box(w, th, d, 0, th * 0.5, 0); // Bottom
  box(w, th, d, 0, h - th * 0.5, 0); // Top
  box(th, h, d, -w * 0.5 + th * 0.5, h * 0.5, 0); // Left side
  box(th, h, d, w * 0.5 - th * 0.5, h * 0.5, 0); // Right side

  // Asymmetric shelves (多宝格错落隔板)
  // Shelf tiers
  box(w * 0.55, th, d, -w * 0.22, h * 0.32, 0);
  box(w * 0.55, th, d, w * 0.22, h * 0.48, 0);
  box(w * 0.45, th, d, -w * 0.25, h * 0.65, 0);
  box(w * 0.65, th, d, w * 0.15, h * 0.78, 0);

  // Vertical dividers (竖立隔板)
  box(th, h * 0.32, d, 0.05, h * 0.16, 0);
  box(th, h * 0.33, d, -w * 0.12, h * 0.48, 0);
  box(th, h * 0.30, d, w * 0.15, h * 0.63, 0);

  // Lower drawers (下层双抽屉)
  box(w * 0.45, 0.22, d * 0.9, -w * 0.24, 0.14, 0);
  box(w * 0.45, 0.22, d * 0.9, w * 0.24, 0.14, 0);
}

// 6. Guqin Table & Seven-String Guqin (琴案与七弦古琴)
export function buildGuqinSet(B, woodMat, blackLacquerMat, { x = 0, y = 0, z = 0, ry = 0 } = {}) {
  const box = (bw, bh, bd, px, py, pz, m = woodMat) => {
    const p = new THREE.Vector3(px, py, pz).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    B.add(rbox(bw, bh, bd, 0.003, 2), m, mat4([x + p.x, y + p.y, z + p.z], [0, ry, 0]));
  };

  const w = 1.35, d = 0.45, h = 0.74;

  // Narrow Zither Desk (琴桌)
  box(w, 0.04, d, 0, h, 0);
  const lw = 0.045, lh = h;
  const lx = w * 0.5 - 0.08, lz = d * 0.5 - 0.08;
  box(lw, lh, lw, -lx, lh * 0.5, -lz);
  box(lw, lh, lw, lx, lh * 0.5, -lz);
  box(lw, lh, lw, -lx, lh * 0.5, lz);
  box(lw, lh, lw, lx, lh * 0.5, lz);
  // Stretcher
  box(w - 0.12, 0.025, 0.025, 0, 0.14, -lz);
  box(w - 0.12, 0.025, 0.025, 0, 0.14, lz);

  // Guqin Instrument (七弦古琴)
  // Tapered body: 1.22m long, 0.20m wide at forehead, 0.14m at tail
  const qL = 1.18, qW = 0.18, qH = 0.045;
  box(qL, qH, qW, 0, h + 0.025, 0, blackLacquerMat);
  // Guqin bridge & nuts (岳山与龙龈)
  box(0.015, 0.015, qW * 0.85, -qL * 0.42, h + 0.05, 0, woodMat);
  box(0.015, 0.010, qW * 0.65, qL * 0.42, h + 0.048, 0, woodMat);

  // Stool (琴凳)
  const sw = 0.48, sd = 0.32, sh = 0.46;
  box(sw, 0.035, sd, 0, sh, 0.45);
  box(0.035, sh, 0.035, -sw * 0.5 + 0.04, sh * 0.5, 0.45 - sd * 0.5 + 0.04);
  box(0.035, sh, 0.035, sw * 0.5 - 0.04, sh * 0.5, 0.45 - sd * 0.5 + 0.04);
  box(0.035, sh, 0.035, -sw * 0.5 + 0.04, sh * 0.5, 0.45 + sd * 0.5 - 0.04);
  box(0.035, sh, 0.035, sw * 0.5 - 0.04, sh * 0.5, 0.45 + sd * 0.5 - 0.04);
}
