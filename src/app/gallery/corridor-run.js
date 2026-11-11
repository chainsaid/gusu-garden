// ---------------------------------------------------------------------------
// Gallery-only corridor sample: a straight as-built run (现状) and a Jiangnan
// promenade variant (曲廊 + 美人靠) built side by side through one switch.
//
// This file is a NEW consumer of the existing building kit. It does not touch
// src/world/buildings-corridor.js, so the film and its frame benchmarks stay
// byte-identical. Measurements below are copied from that module so the 现状
// sample reads as the same corridor (columns at ±1.5, eave half width 2.68,
// plinth 0.45, column top 3.35, wall plate 3.80).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {
  LB, m4, block, lathe, sweep, chamferBox, rectProfile, roofSurface, tileCapGeos, tileParams, sstep, extrude,
} from '../../world/buildings-kit.js';
import { rafterField, linePath, ridgeProfile } from '../../world/buildings-arch.js';
import { Builder } from '../../core/geom.js';
import { buildIx } from '../../world/buildings-kit.js';
import { createGualuo } from '../../../shared/gualuo-h10.js';
import { createMeikao } from '../../../shared/meikao.js';

// 香山帮正统戗兽（脊兽/螭吻）：龙吻张口吞脊、剑把插顶、回纹翻卷
function createQianshou(s = 0.5) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.43 * s, 0); sh.lineTo(0.43 * s, 0);
  sh.lineTo(0.49 * s, 0.13 * s);
  sh.quadraticCurveTo(0.40 * s, 0.20 * s, 0.41 * s, 0.25 * s);
  sh.quadraticCurveTo(0.53 * s, 0.33 * s, 0.49 * s, 0.50 * s);
  sh.quadraticCurveTo(0.51 * s, 0.63 * s, 0.44 * s, 0.72 * s);
  sh.quadraticCurveTo(0.33 * s, 0.89 * s, 0.22 * s, 1.00 * s);
  sh.quadraticCurveTo(0.12 * s, 0.94 * s, 0, 0.85 * s);
  sh.quadraticCurveTo(-0.12 * s, 0.94 * s, -0.22 * s, 1.00 * s);
  sh.quadraticCurveTo(-0.33 * s, 0.89 * s, -0.44 * s, 0.72 * s);
  sh.quadraticCurveTo(-0.51 * s, 0.63 * s, -0.49 * s, 0.50 * s);
  sh.quadraticCurveTo(-0.53 * s, 0.33 * s, -0.41 * s, 0.25 * s);
  sh.quadraticCurveTo(-0.40 * s, 0.20 * s, -0.49 * s, 0.13 * s);
  sh.lineTo(-0.43 * s, 0);
  const body = extrude(sh, 0.16 * s, 0.02 * s, "qianshou_b", 6);
  const rim = new THREE.Shape();
  rim.moveTo(-0.36 * s, 0.13 * s); rim.lineTo(0.36 * s, 0.13 * s); rim.lineTo(0.40 * s, 0.32 * s);
  rim.quadraticCurveTo(0.42 * s, 0.60 * s, 0.30 * s, 0.74 * s);
  rim.quadraticCurveTo(0.20 * s, 0.84 * s, 0.16 * s, 0.90 * s); rim.lineTo(0, 0.79 * s); rim.lineTo(-0.16 * s, 0.90 * s);
  rim.quadraticCurveTo(-0.20 * s, 0.84 * s, -0.30 * s, 0.74 * s);
  rim.quadraticCurveTo(-0.42 * s, 0.60 * s, -0.40 * s, 0.32 * s); rim.lineTo(-0.36 * s, 0.13 * s);
  const inner = extrude(rim, 0.05 * s, 0.01 * s, "qianshou_r", 6).translate(0, 0, 0.08 * s);
  return [body, inner];
}

const CW = 2.68;          // tile eave half width
const TIP = 0.08;
const COLZ = 1.5;
const COL_R = 0.15;
const Y_PL = 0.45;
const Y_COLTOP = 3.35;
const Y_PLATE = 3.80;
const S_RAF = 0.42;
const RAF = [0.08, 0.1];
const FASCIA_H = 0.1;
const f = CW - TIP - 0.045;
const CRUN = 1.8;
const CRISE = 0.52; // 净起翘 520mm，飞檐挺拔灵动
const soar = (s) => Math.pow(Math.max(0, Math.min(1, s)), 2.2);
const TILE = { p: 3.6 / 13, c: 0.3, rw: 0.13, rh: 0.055, pd: 0.016, lip: 0.05, thR: 0.02, thP: 0.012, detail: 0 };
const yRB = (d) => Y_PLATE + S_RAF * (d - (CW - COLZ));
const yRT = (d) => yRB(d) + RAF[1];
const Y0 = yRT(TIP) + FASCIA_H + TILE.lip + TILE.pd;
const prof = (d) => 0.42 * d + 0.045 * d * d;
const RIDGE_Y = Y0 + prof(CW);

// 美人靠 cross-section: goose-neck (鹅颈) from the seat up to the top rail.
// Positive z is the water side; the back leans away from the water (landward).
const MK_Y0 = Y_PL + 0.46;
const MK_Y1 = Y_PL + 1.10;
const goose = (t) => 0.10 * Math.sin(Math.PI * t) - 0.28 * t;

function makeK(ctx) {
  const { M, mat } = ctx;
  const K = {
    red: M.lacquerRed,
    redDark: M.lacquerRedDark,
    col: M.lacquerRed,
    cap: M.lacquerRedDark,
    stone: M.granite,
    stoneClean: M.graniteClean,
    plaster: M.plaster,
    lattice: M.latticeGreen,
    wood: M.lacquerRed,
    black: M.blackLacquer,
    tile: M.roofTile,
  };
  K.tileVC = mat.std({ color: 0xffffff, roughness: 0.42, metalness: 0.12, vertexColors: true }, mat.PROC.roofTile());
  K.tileVC.name = 'corridorTileVC';
  return K;
}

// ---------------------------------------------------------------------------
// roof package over one run (tiles, caps, soffit, rafters)
// ---------------------------------------------------------------------------
function roofPackage(lb, K, faces, T, detail, { rafSp = 0.26, lift = () => 0 } = {}) {
  const tf = faces.map((F) => ({ ...F, y0: Y0, prof, lip: true }));
  const { geo, caps } = roofSurface(tf, T, lift);
  lb.addIx(geo, K.tileVC);
  const [cd, cg] = tileCapGeos(T.rw * 0.55, T.detail);
  for (const c of caps) {
    const mm = m4(c.pos, [0, Math.atan2(c.out[0], c.out[1]), 0]);
    lb.add(cd, K.tile, mm);
    lb.add(cg, K.cap, mm);
  }
  const sf = faces.map((F) => ({ ...F, y0: 0, prof: yRT, dmin: (u) => Math.max(TIP, F.dmin ? F.dmin(u) : 0) }));
  const s = roofSurface(sf, null, lift, { flip: true, du: detail.gap(0.4), dd: detail.gap(0.4) }).geo;
  s.deleteAttribute('color');
  lb.add(s, K.redDark);
  rafterField(lb, faces, { sp: rafSp, w: RAF[0], h: RAF[1], yBot: yRB, dStart: TIP, mat: K.red, capMat: K.cap, lo: true, lift });
}

function fascia(lb, K, pts, inside, lift = () => 0) {
  const p3 = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    if (i === 0) { p3.push(new THREE.Vector3(x, yRT(TIP) + lift(x, z), z)); continue; }
    const [x0, z0] = pts[i - 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x - x0, z - z0) / 0.12));
    for (let j = 1; j <= n; j++) {
      const xx = x0 + ((x - x0) * j) / n, zz = z0 + ((z - z0) * j) / n;
      p3.push(new THREE.Vector3(xx, yRT(TIP) + lift(xx, zz), zz));
    }
  }
  const p = [[-0.045, 0], [0.045, 0], [0.045, FASCIA_H - 0.02], [0.13, FASCIA_H - 0.02], [0.13, FASCIA_H], [-0.045, FASCIA_H]];
  lb.add(sweep(p3, p, { inside }), K.red);
}

// ---------------------------------------------------------------------------
// openwork patterns (格心). u,v run -1..1 across the panel.
// ---------------------------------------------------------------------------
function patternSegs(kind) {
  const S = [];
  if (kind === 'zhiling') {
    for (let i = -4; i <= 4; i++) S.push([i / 5, -1, i / 5, 1]);
    return S;
  }
  if (kind === 'binglie') {
    // Deterministic crackle network (same family as the 冰裂纹漏窗).
    const P = [
      [-0.18, -0.12], [0.20, -0.08], [0.11, 0.22], [-0.19, 0.19],
      [-0.42, -0.42], [0.42, -0.44], [0.46, 0.38], [-0.40, 0.44],
      [0.0, 0.02],
    ];
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4],
      [4, 8], [5, 8], [6, 8], [7, 8], [0, 8], [2, 8]];
    for (const [a, b] of E) S.push([P[a][0], P[a][1], P[b][0], P[b][1]]);
    return S;
  }
  if (kind === 'wanzi') {
    // 万字纹: repeated 卍 motif on a 3x2 cell grid.
    const nx = 3, ny = 2, cw = 2 / nx, ch = 2 / ny;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const cx = -1 + (i + 0.5) * cw, cy = -1 + (j + 0.5) * ch;
        const sx = cw * 0.38, sy = ch * 0.38;
        const seg = (a, b, c, d) => S.push([cx + a * sx, cy + b * sy, cx + c * sx, cy + d * sy]);
        seg(0, -1, 0, 1);
        seg(-1, 0, 1, 0);
        seg(0, 1, -0.45, 1); seg(-0.45, 1, -0.45, 0.5);
        seg(0, -1, 0.45, -1); seg(0.45, -1, 0.45, -0.5);
        seg(-1, 0, -1, 0.5); seg(-1, 0.5, -0.45, 0.5);
        seg(1, 0, 1, -0.5); seg(1, -0.5, 0.45, -0.5);
      }
    }
    return S;
  }
  if (kind === 'bajiao') {
    // as-built 八角套方漏窗 (kept for the 现状 sample)
    const c = 0.5, d = 0.62;
    S.push([-1, -1, -c, -1], [1, -1, c, -1], [-1, 1, -c, 1], [1, 1, c, 1]);
    S.push([-c, -1, -c, -c], [c, -1, c, -c], [-c, 1, -c, c], [c, 1, c, c]);
    S.push([0, -d, d, 0], [d, 0, 0, d], [0, d, -d, 0], [-d, 0, 0, -d]);
    S.push([-1, 0, -d, 0], [d, 0, 1, 0], [0, -1, 0, -d], [0, d, 0, 1]);
    S.push([-0.28, 0, 0.28, 0], [0, -0.28, 0, 0.28]);
    return S;
  }
  return S;
}

// bar pattern in a vertical plane (x to the right, y up, fixed z)
function flatPattern(lb, K, cx, cy, cz, hw, hh, kind, bar = 0.032) {
  for (const [u0, v0, u1, v1] of patternSegs(kind)) {
    lb.beam(K, [cx + u0 * hw, cy + v0 * hh, cz], [cx + u1 * hw, cy + v1 * hh, cz], bar, bar);
  }
}

// ---------------------------------------------------------------------------
// outer wall (white plaster + one openwork leak window per bay)
// ---------------------------------------------------------------------------
function outerWall(lb, K, a, b, zw, kind, frame = 'rect') {
  const L = b - a;
  const x = (a + b) / 2;
  const yBot = Y_PL + 0.12;
  const yTop = Y_COLTOP - 0.12;
  const wallH = yTop - yBot;
  const wW = 1.25, wH = 1.25, yMid = 1.88;

  lb.box(K.redDark, L, 0.12, 0.14, [x, Y_PL + 0.06, zw], [0, 0, 0], 0.01);
  lb.box(K.redDark, L, 0.12, 0.14, [x, Y_COLTOP - 0.06, zw], [0, 0, 0], 0.01);

  const yW0 = yMid - wH / 2, yW1 = yMid + wH / 2;
  const wSide = (L - wW) / 2;
  lb.box(K.plaster, wSide, wallH, 0.10, [a + wSide / 2, (yBot + yTop) / 2, zw]);
  lb.box(K.plaster, wSide, wallH, 0.10, [b - wSide / 2, (yBot + yTop) / 2, zw]);
  lb.box(K.plaster, wW + 0.004, yW0 - yBot, 0.10, [x, (yBot + yW0) / 2, zw]);
  lb.box(K.plaster, wW + 0.004, yTop - yW1, 0.10, [x, (yW1 + yTop) / 2, zw]);

  if (frame === 'haitang') {
    // 海棠形窗框: four-lobed outline drawn with short beams, no rectangular casing.
    const hw = wW / 2, hh = wH / 2, N = 28;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const r = 0.80 + 0.20 * Math.cos(4 * th);
      const p = [x + Math.cos(th) * hw * r, yMid + Math.sin(th) * hh * r, zw];
      if (prev) lb.beam(K.redDark, prev, p, 0.040, 0.040);
      prev = p;
    }
    flatPattern(lb, K.lattice, x, yMid, zw, 0.40, 0.40, kind, 0.030);
  } else {
    lb.box(K.redDark, wW + 0.06, 0.045, 0.12, [x, yW0 + 0.02, zw], [0, 0, 0], 0.005);
    lb.box(K.redDark, wW + 0.06, 0.045, 0.12, [x, yW1 - 0.02, zw], [0, 0, 0], 0.005);
    lb.box(K.redDark, 0.045, wH, 0.12, [x - wW / 2 + 0.02, yMid, zw], [0, 0, 0], 0.005);
    lb.box(K.redDark, 0.045, wH, 0.12, [x + wW / 2 - 0.02, yMid, zw], [0, 0, 0], 0.005);
    flatPattern(lb, K.lattice, x, yMid, zw, 0.56, 0.56, kind);
  }
}

// ---------------------------------------------------------------------------
// as-built inner sitting rail (坐槛 + 直棂): one bay, garden/water side
// ---------------------------------------------------------------------------
function sittingRail(lb, K, bay, z = COLZ) {
  const L = bay - 2 * COL_R;
  lb.box(K.redDark, L, 0.08, 0.10, [COL_R + L / 2, Y_PL + 0.04, z], [0, 0, 0], 0.008);
  lb.box(K.red, L, 0.07, 0.14, [COL_R + L / 2, Y_PL + 0.44, z], [0, 0, 0], 0.012);
  const n = Math.floor(L / 0.42);
  for (let i = 1; i < n; i++) {
    lb.box(K.redDark, 0.045, 0.34, 0.06, [COL_R + (L * i) / n, Y_PL + 0.24, z], [0, 0, 0], 0.005);
  }
}

// 挂落: hanging openwork under the beam between columns
function guaLuo(lb, K, bay, z) {
  const y0 = Y_COLTOP - 0.50, y1 = Y_COLTOP - 0.18;
  const n = Math.max(4, Math.floor((bay - 0.3) / 0.17));
  for (let i = 0; i <= n; i++) {
    const x = COL_R + (i / n) * (bay - 2 * COL_R);
    lb.box(K.redDark, 0.030, y1 - y0, 0.035, [x, (y0 + y1) / 2, z]);
  }
  lb.box(K.redDark, bay - 2 * COL_R, 0.042, 0.05, [bay / 2, y1, z]);
  lb.box(K.redDark, bay - 2 * COL_R, 0.042, 0.05, [bay / 2, y0, z]);
  for (let i = 0; i < n; i += 2) {
    const xm = COL_R + ((i + 0.5) / n) * (bay - 2 * COL_R);
    lb.box(K.redDark, 0.11, 0.028, 0.032, [xm, y1 - 0.055, z]);
  }
}

// 雀替: small brackets at the column heads
function queti(lb, K, bay, z, isTurnEnd = false, isTurnStart = false) {
  for (const cx of [COL_R, bay - COL_R]) {
    for (const s of [-1, 1]) {
      if (cx === bay - COL_R && s === 1 && isTurnEnd) continue;
      if (cx === COL_R && s === -1 && isTurnStart) continue;
      lb.box(K.red, 0.30, 0.10, 0.085, [cx + s * 0.17, Y_COLTOP - 0.31, z], [0, 0, 0], 0.006);
      lb.box(K.redDark, 0.12, 0.05, 0.075, [cx + s * 0.34, Y_COLTOP - 0.34, z], [0, 0, 0], 0.004);
    }
  }
}

// ---------------------------------------------------------------------------
// 美人靠: outward seat board + goose-neck backrest + openwork infill
// ---------------------------------------------------------------------------
function meirenkao(lb, K, bay, latticeKind) {
  const W = bay - 0.18;
  const x0 = (bay - W) / 2;
  const xm = bay / 2;

  // outward-cantilevered seat board (外挑坐板)
  lb.box(K.red, W, 0.07, 0.50, [xm, MK_Y0 - 0.035, COLZ + 0.19], [0, 0, 0], 0.012);
  lb.box(K.redDark, W, 0.06, 0.05, [xm, MK_Y0 - 0.065, COLZ + 0.455], [0, 0, 0], 0.01);
  lb.box(K.redDark, W, 0.05, 0.04, [xm, MK_Y0 - 0.10, COLZ - 0.045], [0, 0, 0], 0.008);
  // three brackets back to the column line
  for (const t of [0.2, 0.5, 0.8]) {
    const x = x0 + t * W;
    lb.beam(K.redDark, [x, MK_Y0 - 0.06, COLZ + 0.36], [x, Y_PL + 0.10, COLZ - 0.04], 0.07, 0.09);
  }

  // goose-neck backrest: top rail + curved end posts + 格心 infill
  lb.box(K.red, W, 0.075, 0.085, [xm, MK_Y1, COLZ + goose(1)], [0, 0, 0], 0.014);
  for (const px of [x0, x0 + W]) {
    for (let i = 0; i < 4; i++) {
      const t0 = i / 4, t1 = (i + 1) / 4;
      lb.beam(K.red,
        [px, MK_Y0 + t0 * (MK_Y1 - MK_Y0), COLZ + goose(t0)],
        [px, MK_Y0 + t1 * (MK_Y1 - MK_Y0), COLZ + goose(t1)], 0.07, 0.07);
    }
  }

  // infill: 格心 pattern mapped onto the goose-neck surface
  const map = (u, v) => [
    x0 + ((u + 1) / 2) * W,
    MK_Y0 + ((v + 1) / 2) * (MK_Y1 - MK_Y0),
    COLZ + goose((v + 1) / 2),
  ];
  for (const [u0, v0, u1, v1] of patternSegs(latticeKind)) {
    const p0 = map(u0, v0), p1 = map(u1, v1);
    lb.beam(K.red, p0, p1, 0.028, 0.028);
  }
  // bottom rail follows the seat line
  lb.box(K.redDark, W, 0.06, 0.06, [xm, MK_Y0 + 0.02, COLZ], [0, 0, 0], 0.008);
}

// white gable infill above the plate on a free end (closes the open roof end)
function gableEnd(lb, K, x, lift = () => 0) {
  // 山面端头山花板壁与随梁枋（符合江南园林穿斗山面木作，杜绝悬空三角白块）
  lb.beam(K.redDark, [x, Y_COLTOP - 0.08, -COLZ], [x, Y_COLTOP - 0.08, COLZ], 0.16, 0.20);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const z = -COLZ + (i + 0.5) * (2 * COLZ / n);
    const yTop = Y0 + prof(CW - Math.abs(z)) + lift(x, z) - 0.04;
    const h = yTop - Y_COLTOP;
    if (h > 0) {
      // 内部山花板壁（深色木望板贴面，质感统一自然）
      lb.box(K.redDark, 0.08, h, 2 * COLZ / n, [x, Y_COLTOP + h / 2, z]);
    }
  }
}

// ---------------------------------------------------------------------------
// one column with stone base
// ---------------------------------------------------------------------------
function column(lb, K) {
  lb.add(lathe([[0, -0.05], [0.25, -0.05], [0.25, 0.02], [0.22, 0.05], [0.18, 0.07], [0, 0.07]], 10, 'csos'), K.stoneClean, m4([0, Y_PL, 0]));
  lb.add(new THREE.CylinderGeometry(COL_R, COL_R * 1.02, Y_COLTOP - Y_PL - 0.07, 16, 1), K.col, m4([0, (Y_COLTOP + Y_PL + 0.07) / 2, 0]));
  lb.add(block(0.32, 0.17, 0.32), K.red, m4([0, Y_COLTOP, 0]));
}

// ---------------------------------------------------------------------------
// plan: 现状 = one straight 3-bay run; 江南化 = three legs with a non-right
// turn (and an optional rise on the last leg).
// ---------------------------------------------------------------------------
function makeLegs(form, bayLen, turnDeg, levels) {
  const nBays = form === 'jiangnan' ? 2 : 3;
  const len = nBays * bayLen;
  const th = (form === 'jiangnan' ? turnDeg : 0) * Math.PI / 180;
  const specs = form === 'jiangnan' ? [0, th, 0] : [0];
  const legs = [];
  let p = [0, 0];
  specs.forEach((yaw, i) => {
    const y = form === 'jiangnan' && levels && i === 2 ? 0.34 : 0;
    legs.push({ start: [p[0], p[1]], yaw, len, nBays, bayLen, y });
    p = [p[0] + Math.cos(yaw) * len, p[1] - Math.sin(yaw) * len];
  });
  return legs;
}

// ---------------------------------------------------------------------------
export function buildCorridorRun(params, ctx) {
  const K = makeK(ctx);
  const detail = ctx.detail;
  const form = params.form === 'jiangnan' ? 'jiangnan' : 'current';
  const bayLen = +params.bayLen || 3.6;
  const rail = form === 'jiangnan' && params.rail === 'zhiling' ? 'zhiling' : 'meirenkao';
  const lattice = form === 'jiangnan'
    ? (['wanzi', 'binglie', 'zhiling'].includes(params.lattice) ? params.lattice : 'wanzi')
    : 'bajiao';
  const legs = makeLegs(form, bayLen, +params.turn || 0, !!params.levels);

  const b = new Builder();
  const ix = new Map();
  const root = new LB(b, new THREE.Matrix4(), ix);

  const T = tileParams({ ...TILE, phase: 0 }, detail);
  const anchors = {};
  const extraMeshes = [];

  legs.forEach((leg, li) => {
    const lb = root.child(m4([leg.start[0], leg.y, leg.start[1]], [0, leg.yaw, 0]));
    const L = leg.len;
    const ext0 = li === 0 ? 0 : COLZ;
    const ext1 = li === legs.length - 1 ? 0 : COLZ;

    // ---- plinth (full run; joints get a slightly raised square platform)
    for (let c = 0; c < 2; c++) {
      const h = c === 0 ? 0.5 : 0.28, y = c === 0 ? -0.2 : 0.19;
      lb.box(K.stone, L - 0.01, h, 4.3, [L / 2, y, 0], [0, 0, 0], c === 0 ? 0.03 : 0.025);
    }
    // 整平青石板铺装（规整对缝，杜绝细碎穿帮破缝）
    lb.box(K.stoneClean, L + 0.02, 0.12, 4.28, [L / 2, 0.39, 0], [0, 0, 0], 0.008);

    // ---- authentic Jiangnan miter angles
    const dYawNext = li < legs.length - 1 ? (legs[li + 1].yaw - leg.yaw) : 0;
    const dYawPrev = li > 0 ? (leg.yaw - legs[li - 1].yaw) : 0;
    const tNext = Math.tan(dYawNext / 2);
    const tPrev = Math.tan(dYawPrev / 2);

    // ---- bays: outer wall + water-side railing
    for (let i = 0; i < leg.nBays; i++) {
      const x0 = i * leg.bayLen;
      const bayLb = lb.child(new THREE.Matrix4().makeTranslation(x0, 0, 0));

      // 白粉墙设在靠园墙侧 (-COLZ)，嵌以海棠/镂空漏窗（精准对齐角平分线转角内柱面）
      const isLastBay = (i === leg.nBays - 1);
      const isFirstBay = (i === 0);
      const wallEnd = (isLastBay && li < legs.length - 1 && Math.abs(dYawNext) > 1e-4)
        ? (leg.bayLen - COL_R - COLZ * tNext)
        : (leg.bayLen - COL_R);
      const wallStart = (isFirstBay && li > 0 && Math.abs(dYawPrev) > 1e-4)
        ? (COL_R - COLZ * tPrev)
        : COL_R;
      outerWall(bayLb, K, wallStart, wallEnd, -COLZ, lattice, "haitang");

      // 雀替
      const isTurnEnd = (i === leg.nBays - 1) && (li < legs.length - 1) && Math.abs(dYawNext) > 1e-4;
      const isTurnStart = (i === 0) && (li > 0) && Math.abs(dYawPrev) > 1e-4;
      queti(bayLb, K, leg.bayLen, COLZ, isTurnEnd, isTurnStart);

      // 挂落与美人靠
      const clearSpan = leg.bayLen - 2 * COL_R;
      const bx = x0 + leg.bayLen / 2;
      const bz = COLZ;
      const c = Math.cos(leg.yaw), s = Math.sin(leg.yaw);

      // 当处于转角连接开间时，延长开间构件并位移使其直接与角平分线转角立柱相接
      const extEnd = (isTurnEnd && dYawNext > 0) ? (COLZ * tNext) : 0;
      const extStart = (isTurnStart && dYawPrev > 0) ? (COLZ * tPrev) : 0;
      const actualSpanMm = (clearSpan + extEnd + extStart) * 1000;
      const actualBx = bx + extEnd / 2 - extStart / 2;

      // 1) 狮子林 H10 经典雕花回纹挂落（严格对齐柱面，消除角部缺口）
      const gl = createGualuo(THREE, { span: actualSpanMm, material: K.redDark });
      gl.scale.set(0.001, 0.001, 0.001);
      const gh = (gl.userData?.meta?.size?.height ?? 527.6) / 1000;
      gl.position.set(
        leg.start[0] + c * actualBx + s * bz,
        leg.y + Y_COLTOP - 0.22 - gh / 2,
        leg.start[1] - s * actualBx + c * bz
      );
      gl.rotation.y = leg.yaw;
      extraMeshes.push(gl);

      // 2) 临水美人靠 / 坐槛
      if (rail === "meirenkao") {
        const mk = createMeikao(THREE, {
          length: actualSpanMm,
          materials: {
            wood: K.redDark,
            woodSeat: K.redDark,
            stone: K.plaster,
            stoneCap: K.stoneClean,
            stoneCore: K.stone,
          },
        });
        mk.scale.set(0.001, 0.001, 0.001);
        mk.position.set(
          leg.start[0] + c * actualBx + s * bz,
          leg.y + Y_PL,
          leg.start[1] - s * actualBx + c * bz
        );
        mk.rotation.y = leg.yaw + Math.PI;
        extraMeshes.push(mk);
      } else {
        sittingRail(bayLb, K, leg.bayLen);
      }

      if (rail === "meirenkao" && li === 0 && i === 1 && !anchors.meirenkao) {
        anchors.meirenkao = [x0 + leg.bayLen / 2, MK_Y0 + 0.28, COLZ + 0.30];
      }
    }

    // ---- columns (转角柱置于角平分线 miter 节点)
    for (let i = 0; i <= leg.nBays; i++) {
      if (i === 0 && li > 0) continue; // shared with the previous leg
      if (i === leg.nBays && li < legs.length - 1 && Math.abs(dYawNext) > 1e-4) {
        for (const s of [-1, 1]) {
          const z = s * COLZ;
          const xj = L + z * tNext;
          lb.cyl(K.col, COL_R, COL_R, Y_COLTOP - Y_PL, [xj, (Y_COLTOP + Y_PL) / 2, z], [0, 0, 0], 20);
          lb.cyl(K.stone, COL_R * 1.5, COL_R * 1.5, 0.16, [xj, Y_PL + 0.08, z], [0, 0, 0], 24);
          lb.cyl(K.stoneClean, COL_R * 1.25, COL_R * 1.25, 0.08, [xj, Y_PL + 0.20, z], [0, 0, 0], 24);

          // 正统香山帮柱头坐斗（大斗与升）：稳妥承托角平分线两向斜切额枋
          lb.box(K.col, 0.36, 0.14, 0.36, [xj, Y_COLTOP + 0.07, z], [0, dYawNext / 2, 0], 0.015);
          lb.box(K.col, 0.42, 0.08, 0.42, [xj, Y_COLTOP + 0.15, z], [0, dYawNext / 2, 0], 0.015);
        }

        // 外角柱美人靠转角闭合件（平顺环抱角柱，圆润扶手与坐板完整交圈）
        if (dYawNext > 0 && rail === "meirenkao") {
          const xjOuter = L + COLZ * tNext;
          const rotAngle = dYawNext / 2;
          // 台基石槛包角与白石压板
          lb.box(K.plaster, 0.60, 0.44, 0.60, [xjOuter, Y_PL + 0.22, COLZ], [0, rotAngle, 0], 0.02);
          lb.box(K.stoneClean, 0.68, 0.06, 0.68, [xjOuter, Y_PL + 0.45, COLZ], [0, rotAngle, 0], 0.015);
          // 坐板包角（外挑宽坐板，微弧圆顺衔接两向坐板）
          lb.box(K.redDark, 0.76, 0.07, 0.64, [xjOuter, Y_PL + 0.46 + 0.035, COLZ + 0.22], [0, rotAngle, 0], 0.015);
          // 鹅颈靠背转角圆顺寻杖扶手（平滑过渡，消除硬拼生硬感）
          const pMidRail = [xjOuter, Y_PL + 1.025, COLZ + 0.46];
          lb.box(K.redDark, 0.58, 0.055, 0.14, pMidRail, [0, rotAngle, 0], 0.02);
          // 转角抱柱支撑立档
          for (const sDir of [-1, 1]) {
            lb.beam(K.redDark, [xjOuter + sDir * 0.22, Y_PL + 1.02, COLZ + 0.46], [xjOuter, Y_PL + 1.02, COLZ + 0.28], 0.06, 0.07);
            lb.beam(K.redDark, [xjOuter + sDir * 0.16, Y_PL + 0.52, COLZ + 0.22], [xjOuter + sDir * 0.16, Y_PL + 1.00, COLZ + 0.44], 0.045, 0.05);
          }
        }
      } else {
        const cx = i * leg.bayLen;
        for (const s of [-1, 1]) {
          const cz = s * COLZ;
          column(lb.child(new THREE.Matrix4().makeTranslation(cx, 0, cz)), K);
        }
      }
    }

    // 转角内侧白粉墙阴角通顶密封（严密咬合两向粉墙与角柱，通顶至檩下/天沟底，杜绝漏光与虚空）
    if (li < legs.length - 1 && Math.abs(dYawNext) > 1e-4) {
      const yBot = Y_PL + 0.12;
      const yTop = Y_PLATE + 0.18; // 通顶至檩下/天沟底
      const wallH = yTop - yBot;
      const xjInner = L - COLZ * tNext;
      // 沿角平分线 (dYawNext / 2) 放置转角闭合厚墙体，完美咬合两向粉墙与内角柱
      lb.box(K.plaster, 0.72, wallH, 0.30, [xjInner, yBot + wallH / 2, -COLZ], [0, dYawNext / 2, 0], 0.015);
      // 内角下槛与上枋封包
      lb.box(K.redDark, 0.68, 0.12, 0.26, [xjInner, Y_PL + 0.06, -COLZ], [0, dYawNext / 2, 0], 0.01);
      lb.box(K.redDark, 0.68, 0.12, 0.26, [xjInner, Y_COLTOP - 0.06, -COLZ], [0, dYawNext / 2, 0], 0.01);
      // 檐枋交接封檐
      lb.beam(K.redDark, [xjInner - 0.35, Y_COLTOP + 0.12, -COLZ], [xjInner + 0.35, Y_COLTOP + 0.12, -COLZ], 0.14, 0.16);
    }

    // ---- roof: authentic classical Jiangnan mitered joint at turns

    // Outer edge (front, z = +f) and Inner edge (back, z = -f)
    const xOuter0 = li === 0 ? 0 : -f * tPrev;
    const xOuter1 = li === legs.length - 1 ? L : L + f * tNext;
    const xInner0 = li === 0 ? 0 : +f * tPrev;
    const xInner1 = li === legs.length - 1 ? L : L - f * tNext;

    // Face 0: z in [0, CW], d = CW - z (d=0 at z=CW, d=CW at z=0)
    const u0_f0 = Math.min(xOuter0, 0);
    const u1_f0 = Math.max(xOuter1, L);
    const dmin_f0 = (u) => {
      let dm = 0;
      if (tNext < 0 && u > L) dm = Math.max(dm, CW - (u - L) / tNext);
      if (tPrev < 0 && u < 0) dm = Math.max(dm, CW + u / tPrev);
      return Math.max(0, dm);
    };
    const dmax_f0 = (u) => {
      let dm = CW;
      if (tNext > 0 && u > L) dm = Math.min(dm, CW - (u - L) / tNext);
      if (tPrev > 0 && u < 0) dm = Math.min(dm, CW + u / tPrev);
      return Math.max(0, dm);
    };

    // Face 1: z in [-CW, 0], d = CW + z (d=0 at z=-CW, d=CW at z=0)
    const u0_f1 = -Math.max(xInner1, L);
    const u1_f1 = -Math.min(xInner0, 0);
    const dmin_f1 = (u) => {
      const x = -u;
      let dm = 0;
      if (tNext > 0 && x > L) dm = Math.max(dm, CW + (x - L) / tNext);
      if (tPrev > 0 && x < 0) dm = Math.max(dm, CW - x / tPrev);
      return Math.max(0, dm);
    };
    const dmax_f1 = (u) => {
      const x = -u;
      let dm = CW;
      if (tNext < 0 && x > L) dm = Math.min(dm, CW + (x - L) / tNext);
      if (tPrev < 0 && x < 0) dm = Math.min(dm, CW - x / tPrev);
      return Math.max(0, dm);
    };

    const faces = [
      { O: [0, CW], a: [1, 0], n: [0, -1], u0: u0_f0, u1: u1_f0, dmin: dmin_f0, dmax: dmax_f0 },
      { O: [0, -CW], a: [-1, 0], n: [0, 1], u0: u0_f1, u1: u1_f1, dmin: dmin_f1, dmax: dmax_f1 },
    ];

    // 翼角起翘 (正统香山帮嫩戗发戗反宇曲面):
    // 参照建施-17《小沧浪亭》与建施-18《四时潇洒亭》：
    // 采用五次平滑阶跃曲线 (Quintic Hermite: C2 连续可微)，在转折开间 (1.8m 半开间范围) 内渐进式生起，
    // 形成从正身卷棚温润平顺到戗角飞檐高挺飞扬的完整反宇双曲面。
    const qstep = (s) => {
      s = Math.max(0, Math.min(1, s));
      return s * s * s * (s * (s * 6 - 15) + 10);
    };

    // 正统香山帮反宇幂次曲线：自平身渐进生起，至翼角戗尖单调加速冲拔，彻底消除 Hermite 样条角点斜率归零导致的“双驼峰/中间下凹”畸变
    const liftFn = (x, z) => {
      let t = 0;
      if (li < legs.length - 1 && dYawNext > 0 && z > 0 && x > L - CRUN) {
        t = Math.max(t, soar((CRUN - Math.max(0, L - x)) / CRUN));
      }
      if (li > 0 && dYawPrev > 0 && z > 0 && x < CRUN) {
        t = Math.max(t, soar((CRUN - Math.max(0, x)) / CRUN));
      }
      return CRISE * t * Math.pow(Math.abs(z) / CW, 1.35);
    };

    roofPackage(lb, K, faces, T, detail, { rafSp: 0.26, lift: liftFn });

    // fascia ends meet at the exact miter point without crossing
    // fascia swept globally below
    // fascia swept globally below

    // main ridge along the corridor run
    // main ridge swept globally with mitered turns below

    // 戗脊 (hip ridge) & 天沟 (valley) & 香山帮嫩戗发戗大木作体系（对齐建施-17/18/19）
    if (li < legs.length - 1 && Math.abs(dYawNext) > 1e-4) {
      
      const isConvexOuter = dYawNext > 0;
      const signZ = isConvexOuter ? 1 : -1;
      const qRidge = [L, 0];
      const qCorner = [L + signZ * CW * tNext, signZ * CW];
      const clen = Math.hypot(signZ * CW * tNext, signZ * CW);
      const ux = (signZ * CW * tNext) / clen, uz = (signZ * CW) / clen;
      // 嫩戗向外出挑 0.14m，戗尖与戗兽自然凸出滴水檐口（严格对齐建施-17《小沧浪亭》1:10 详图）
      const tipExt = 0.14;
      const qTip = [qCorner[0] + ux * tipExt, qCorner[1] + uz * tipExt];

      // 翼角起拔：檐口基准高度与高挺飞翘的戗尖高度（瓦面与戗脊严密咬合，消除骨肉分离）
      const yCorner = Y0 + prof(0) + liftFn(qCorner[0], qCorner[1]);
      const yTip = yCorner + 0.06;

      // 1) 戗脊：紧密骑缝贴伏于屋面瓦垄相交缝（消除 24cm 灰色悬空水泥板）
      const p0 = RIDGE_Y - 0.02;
      const p1 = RIDGE_Y - 0.28;
      const p2 = yCorner + 0.04;
      const p3 = yTip + 0.04;
      const ridgeSagH = (u) => {
        const b0 = (1 - u) ** 3;
        const b1 = 3 * (1 - u) ** 2 * u;
        const b2 = 3 * (1 - u) * u ** 2;
        const b3 = u ** 3;
        return b0 * p0 + b1 * p1 + b2 * p2 + b3 * p3;
      };

      // 戗脊截面：drop 设为 0.04m（贴伏瓦垄，杜绝悬空灰色厚墙）
      const hpSnug = ridgeProfile(0.22, 0.14, 3, 0.045, 0.04);
      lb.add(sweep(linePath(qRidge, qTip, (x, z) => {
        const u = Math.min(1, Math.hypot(x - qRidge[0], z - qRidge[1]) / (clen + tipExt));
        return ridgeSagH(u);
      }, 0.05), hpSnug), K.tile);

      // 2) 香山帮经典大木作体系（严格对齐建施-17实测标注）
      // 外转折角柱柱头坐斗中心
      const xjOuter = L + signZ * COLZ * tNext;
      const zjOuter = signZ * COLZ;
      const pOldBase = [xjOuter, Y_COLTOP + 0.18, zjOuter];

      // a. 老角梁（老戗）：断面 120×120 (建施-17标注)，真实自角柱柱头向外斜挑至檐角
      const pOldTip = [qCorner[0] + ux * 0.10, yCorner - 0.16, qCorner[1] + uz * 0.10];
      lb.beam(K.redDark, pOldBase, pOldTip, 0.13, 0.15);

      // b. 嫩戗（仔角戗）：断面 50×70 (建施-17标注)，嵌立于老戗之上昂然向上冲出翼角
      const pNenBase = [xjOuter + ux * 0.42, Y_COLTOP + 0.28, zjOuter + uz * 0.42];
      const pNenTip = [qTip[0], yCorner - 0.10, qTip[1]];
      lb.beam(K.red, pNenBase, pNenTip, 0.08, 0.12);

      // c. 菱角木（戗山木）：老戗与嫩戗之间的受力三角承托木
      const pLingBase = [xjOuter + ux * 0.85, Y_COLTOP + 0.25, zjOuter + uz * 0.85];
      const pLingTop = [xjOuter + ux * 0.95, Y_COLTOP + 0.48, zjOuter + uz * 0.95];
      lb.beam(K.redDark, pLingBase, pLingTop, 0.10, 0.12);

      // d. 扁担木：横向抱箍锁紧老戗与嫩戗交接部
      const sideX = -uz, sideZ = ux;
      lb.beam(K.redDark,
        [pNenBase[0] - sideX * 0.22, pNenBase[1] + 0.03, pNenBase[2] - sideZ * 0.22],
        [pNenBase[0] + sideX * 0.22, pNenBase[1] + 0.03, pNenBase[2] + sideZ * 0.22],
        0.08, 0.10
      );

      // e. 木插角大样（建施-17 1:10 木插角雕花构件）
      const pChaBase = [qCorner[0] - ux * 0.50, yCorner - 0.28, qCorner[1] - uz * 0.50];
      const pChaTip = [qCorner[0] + ux * 0.20, yCorner - 0.08, qCorner[1] + uz * 0.20];
      lb.beam(K.redDark, pChaBase, pChaTip, 0.05, 0.16);

      // 翼角角梁生头木与角望板：密闭翼角下层空间，杜绝露骨穿刺与漏天
      const pSoffitBase = [xjOuter, Y_COLTOP + 0.18, zjOuter];
      const pSoffitTip = [qCorner[0], yCorner - 0.10, qCorner[1]];
      lb.beam(K.redDark, pSoffitBase, pSoffitTip, 0.22, 0.08);

      // g. 正统香山帮立体卷草回纹戗角脊兽（左右端正垂直，背沿脊线自然微仰，杜绝歪斜倾倒）
      const [qBody, qRim] = createQianshou(0.55);
      const widthVec = new THREE.Vector3(-uz, 0, ux).normalize();
      const normalVec = new THREE.Vector3(ux, 0, uz).normalize();
      const pitchAng = 0.32; // 沿戗脊仰角 18°，神采奕奕
      const pitchedNormal = normalVec.clone().applyAxisAngle(widthVec, pitchAng);
      const pitchedUp = new THREE.Vector3(0, 1, 0).applyAxisAngle(widthVec, pitchAng);
      const mQian = new THREE.Matrix4().makeBasis(widthVec, pitchedUp, pitchedNormal);
      mQian.setPosition(qTip[0], yTip + 0.02, qTip[1]);
      lb.add(qBody, K.tile, mQian);
      lb.add(qRim, K.tile, mQian);
      // 剑把（螭吻背上宝剑把柄，纯正古建瓦灰质感，端正稳固立于脊兽中轴）
      const hiltBase = [qTip[0], yTip + 0.22, qTip[1]];
      const hiltTip = [
        qTip[0] + pitchedUp.x * 0.32,
        yTip + 0.22 + pitchedUp.y * 0.32,
        qTip[1] + pitchedUp.z * 0.32
      ];
      lb.beam(K.tile, hiltBase, hiltTip, 0.035, 0.035);

      // 瓦当与滴水已由 roofPackage/roofSurface 统一依据真实瓦垄准确生成，消除悬空游离构件

      // 3) 内角阴角天沟 (Valley Gutter)
      const vInner = [L - signZ * CW * tNext, -signZ * CW];
      lb.add(sweep(linePath(vInner, [L, 0], (x, z) => {
        const d = signZ > 0 ? (CW + z) : (CW - z);
        return Y0 + prof(d) - 0.035;
      }, 0.12), rectProfile(0.16, 0.025)), K.black);
    }
    if (li === 0) gableEnd(lb, K, 0, liftFn);
    if (li === legs.length - 1) gableEnd(lb, K, L, liftFn);

    // ---- 苏州名园夹道天井与对景粉墙（消除漏窗黑洞虚空，提供古典园林透景/框景）
    if (form === "jiangnan") {
      const cyW = leg.len + 3.6;
      const cx0 = leg.len / 2 + (li === 0 ? 0.6 : (li === legs.length - 1 ? 0.6 : 0));
      const cyZ = -COLZ - 1.80; // 天井进深 1.8m
      // 1) 夹弄青石铺地
      lb.box(K.stoneClean, cyW, 0.08, 3.0, [cx0, Y_PL - 0.04, cyZ + 1.0], [0, 0, 0], 0.01);
      // 2) 院墙粉壁（白灰抹灰墙身，高度 3.5m）
      lb.box(K.plaster, cyW, 3.5, 0.20, [cx0, Y_PL + 1.75, cyZ], [0, 0, 0]);
      // 3) 院墙黛瓦压顶与滴水
      lb.box(K.tile, cyW + 0.10, 0.16, 0.36, [cx0, Y_PL + 3.5 + 0.08, cyZ], [0, 0, 0], 0.02);

      // 转角天井外墙封堵闭合（沿角平分线咬合两向外院墙，彻底消除转角暗洞）
      if (Math.abs(dYawNext) > 1e-4) {
        lb.box(K.plaster, 4.2, 3.5, 0.36, [leg.len + 0.8, Y_PL + 1.75, cyZ + 0.3], [0, dYawNext / 2, 0]);
        lb.box(K.tile, 4.4, 0.16, 0.46, [leg.len + 0.8, Y_PL + 3.5 + 0.08, cyZ + 0.3], [0, dYawNext / 2, 0], 0.02);
        lb.box(K.stoneClean, 4.2, 0.08, 3.6, [leg.len + 0.8, Y_PL - 0.04, cyZ + 1.1], [0, dYawNext / 2, 0], 0.01);
      }
      if (li === 0) {
        lb.box(K.plaster, 0.20, 3.5, 3.2, [-1.2, Y_PL + 1.75, cyZ + 1.2], [0, 0, 0]);
        lb.box(K.tile, 0.36, 0.16, 3.3, [-1.2, Y_PL + 3.5 + 0.08, cyZ + 1.2], [0, 0, 0], 0.02);
      }

      // 4) 漏窗外框景翠竹小品（透过海棠镂空漏窗观赏，竹影婆娑，意境幽雅）
      for (let bi = 0; bi < leg.nBays; bi++) {
        const wx = (bi + 0.5) * leg.bayLen;
        const bz0 = -COLZ - 0.85;
        const bOffsets = [[-0.22, 0.0, 2.4], [-0.08, -0.15, 2.7], [0.12, 0.05, 2.2], [0.25, -0.10, 2.5]];
        for (const [bx, bz, bh] of bOffsets) {
          lb.cyl(K.lattice, 0.016, 0.016, bh, [wx + bx, Y_PL + bh / 2, bz0 + bz], [0, 0, 0], 8);
          lb.box(K.lattice, 0.30, 0.06, 0.22, [wx + bx, Y_PL + bh * 0.72, bz0 + bz], [0, 0.4, 0.15]);
          lb.box(K.lattice, 0.36, 0.06, 0.25, [wx + bx, Y_PL + bh * 0.88, bz0 + bz], [0, -0.45, -0.12]);
        }
      }

      // 5) 临水驳岸条石与水面（临水侧外侧）
      const rwZ = COLZ + 0.55;
      lb.box(K.stone, cyW, 0.42, 0.36, [cx0, Y_PL - 0.21, rwZ], [0, 0, 0], 0.02);
      // 水面（微光泽暗绿池水，倒映游廊与立柱）
      lb.box(K.tile, cyW + 0.8, 0.04, 4.8, [cx0, Y_PL - 0.22, rwZ + 2.4], [0, 0, 0]);

      // 临水转角水面与驳岸角石无缝交圈（封堵外转折角部 V 形水面暗洞）
      if (li > 0 && Math.abs(dYawPrev) > 1e-4) {
        lb.box(K.tile, 6.5, 0.041, 6.5, [0, Y_PL - 0.22, rwZ + 2.4], [0, dYawPrev / 2, 0]);
        lb.box(K.stone, 1.2, 0.422, 0.65, [0, Y_PL - 0.21, rwZ], [0, dYawPrev / 2, 0], 0.02);
      }

      // 6) 游廊端头园门（月洞门照壁，让廊内视线有景可落，彻底消除虚空黑洞）
      if (li === legs.length - 1) {
        const gX = leg.len + 0.05;
        lb.box(K.plaster, 0.18, Y_COLTOP - Y_PL, 1.15, [gX, (Y_COLTOP + Y_PL) / 2, -COLZ + 0.575]);
        lb.box(K.plaster, 0.18, Y_COLTOP - Y_PL, 1.15, [gX, (Y_COLTOP + Y_PL) / 2, COLZ - 0.575]);
        lb.box(K.plaster, 0.18, 0.45, 2 * COLZ, [gX, Y_COLTOP - 0.225, 0]);
        lb.beam(K.redDark, [gX, Y_COLTOP, -COLZ], [gX, Y_COLTOP, COLZ], 0.18, 0.18);
        // 门后庭院对景粉墙与绿竹衬底
        lb.box(K.plaster, 0.18, 3.5, 4.2, [gX + 2.5, Y_PL + 1.75, 0]);
        lb.box(K.tile, 0.26, 0.14, 4.4, [gX + 2.5, Y_PL + 3.5 + 0.07, 0]);
        lb.box(K.stoneClean, 2.6, 0.08, 4.2, [gX + 1.3, Y_PL - 0.04, 0]);
        for (const [bx, bz, bh] of [[1.8, -0.6, 2.5], [2.1, 0.4, 2.7], [1.9, 0.9, 2.3]]) {
          lb.cyl(K.lattice, 0.018, 0.018, bh, [gX + bx, Y_PL + bh / 2, bz], [0, 0, 0], 8);
          lb.box(K.lattice, 0.35, 0.06, 0.25, [gX + bx, Y_PL + bh * 0.8, bz], [0, 0.3, 0.2]);
        }
      }
    }

    // ---- joint platform (hides the overlapping plinth wedge at a turn, perfectly level with floor)
    if (li > 0) {
      const sx = 4.35;
      lb.box(K.stone, sx, 0.5, sx, [0, -0.2 + leg.y, 0], [0, dYawPrev / 2, 0], 0.03);
      lb.box(K.stoneClean, sx, 0.121, sx, [0, 0.3905 + leg.y, 0], [0, dYawPrev / 2, 0], 0.008);
    }
  });

  // ---- step between the level legs (optional 高差)
  if (form === 'jiangnan' && params.levels && legs.length === 3) {
    const leg = legs[2];
    const lb = root.child(m4([leg.start[0], 0, leg.start[1]], [0, leg.yaw, 0]));
    for (let i = 0; i < 3; i++) {
      const h = 0.12 + i * 0.11;
      lb.box(K.stoneClean, 1.4 - i * 0.15, h, 0.34, [0.55 + i * 0.17, h / 2, 2.0], [0, 0, 0], 0.01);
    }
  }

  // ---- global continuous mitered beams running through all turns
  for (const s of [-1, 1]) {
    const zOff = s * COLZ;
    const pLower = [];
    const pUpper = [];
    legs.forEach((leg, li) => {
      const dYawNext = li < legs.length - 1 ? (legs[li + 1].yaw - leg.yaw) : 0;
      const tNext = Math.tan(dYawNext / 2);
      const toWorld = (lx, lz, y) => [
        leg.start[0] + lx * Math.cos(leg.yaw) + lz * Math.sin(leg.yaw),
        leg.y + y,
        leg.start[1] - lx * Math.sin(leg.yaw) + lz * Math.cos(leg.yaw)
      ];
      if (li === 0) {
        pLower.push(toWorld(0, zOff, Y_COLTOP - 0.11));
        pUpper.push(toWorld(0, zOff, Y_PLATE - 0.08));
      }
      const xEnd = li < legs.length - 1 ? leg.len + zOff * tNext : leg.len;
      pLower.push(toWorld(xEnd, zOff, Y_COLTOP - 0.11));
      pUpper.push(toWorld(xEnd, zOff, Y_PLATE - 0.08));
    });
    root.add(sweep(pLower, rectProfile(0.12, 0.22), { miter: true, caps: true }), K.red);
    root.add(sweep(pUpper, rectProfile(0.15, 0.16), { miter: true, caps: true }), K.red);
  }

  // Central ridge purlin (脊檩)
  const pRidgePurlin = [];
  legs.forEach((leg, li) => {
    const toWorld = (lx, lz, y) => [
      leg.start[0] + lx * Math.cos(leg.yaw) + lz * Math.sin(leg.yaw),
      leg.y + y,
      leg.start[1] - lx * Math.sin(leg.yaw) + lz * Math.cos(leg.yaw)
    ];
    if (li === 0) pRidgePurlin.push(toWorld(0, 0, yRB(CW) - 0.09));
    pRidgePurlin.push(toWorld(leg.len, 0, yRB(CW) - 0.09));
  });
  root.add(sweep(pRidgePurlin, rectProfile(0.17, 0.18), { miter: true, caps: true }), K.red);


  // ---- 全局连续正脊（Sweep with Miter）：消除转折处两坡脊筒硬切与接缝破面
  const pGlobalRidge = [];
  legs.forEach((leg, li) => {
    const toWorld = (lx, lz, y) => [
      leg.start[0] + lx * Math.cos(leg.yaw) + lz * Math.sin(leg.yaw),
      leg.y + y,
      leg.start[1] - lx * Math.sin(leg.yaw) + lz * Math.cos(leg.yaw)
    ];
    const n = Math.max(1, Math.ceil(leg.len / 0.3));
    if (li === 0) pGlobalRidge.push(toWorld(0, 0, RIDGE_Y - 0.02));
    for (let j = 1; j <= n; j++) {
      pGlobalRidge.push(toWorld((j * leg.len) / n, 0, RIDGE_Y - 0.02));
    }
  });
  root.add(sweep(pGlobalRidge, ridgeProfile(0.42, 0.36, 4, 0.08, 0.28), { miter: true, caps: true }), K.tile);

  // ---- 全局连续封檐板（内外檐口无缝转角）：消除两段封檐板高低错位与断头破口
  for (const s of [-1, 1]) {
    const zEave = s * f;
    const pFascia = [];
    legs.forEach((leg, li) => {
      const dYawNext = li < legs.length - 1 ? (legs[li + 1].yaw - leg.yaw) : 0;
      const dYawPrev = li > 0 ? (leg.yaw - legs[li - 1].yaw) : 0;
      const tNext = Math.tan(dYawNext / 2);
      const tPrev = Math.tan(dYawPrev / 2);
      const toWorld = (lx, lz, y) => [
        leg.start[0] + lx * Math.cos(leg.yaw) + lz * Math.sin(leg.yaw),
        leg.y + y,
        leg.start[1] - lx * Math.sin(leg.yaw) + lz * Math.cos(leg.yaw)
      ];
      const lift = (x, z) => {
        let t = 0;
        if (li < legs.length - 1 && dYawNext > 0 && z > 0 && x > leg.len - CRUN) {
          t = Math.max(t, soar((CRUN - Math.max(0, leg.len - x)) / CRUN));
        }
        if (li > 0 && dYawPrev > 0 && z > 0 && x < CRUN) {
          t = Math.max(t, soar((CRUN - Math.max(0, x)) / CRUN));
        }
        return CRISE * t * Math.pow(Math.abs(z) / CW, 1.35);
      };

      const xStart = li === 0 ? 0 : -zEave * tPrev;
      const xEnd = li === legs.length - 1 ? leg.len : leg.len + zEave * tNext;
      const n = Math.max(1, Math.ceil((xEnd - xStart) / 0.12));
      if (li === 0) pFascia.push(toWorld(xStart, zEave, yRT(TIP) + lift(xStart, zEave)));
      for (let j = 1; j <= n; j++) {
        const xx = xStart + ((xEnd - xStart) * j) / n;
        pFascia.push(toWorld(xx, zEave, yRT(TIP) + lift(xx, zEave)));
      }
    });
    const pProfile = [[-0.045, 0], [0.045, 0], [0.045, FASCIA_H - 0.02], [0.13, FASCIA_H - 0.02], [0.13, FASCIA_H], [-0.045, FASCIA_H]];
    root.add(sweep(pFascia, pProfile, { miter: true, caps: true }), K.red);
  }

  const group = b.build({ name: 'corridor-run' });
  buildIx(ix, group);
  for (const m of extraMeshes) group.add(m);

  // anchor in the built object's local frame
  if (anchors.meirenkao) {
    const leg = legs[0];
    const [lx, ly, lz] = anchors.meirenkao;
    const c = Math.cos(leg.yaw), s = Math.sin(leg.yaw);
    anchors.meirenkao = new THREE.Vector3(
      leg.start[0] + c * lx + s * lz,
      ly,
      leg.start[1] - s * lx + c * lz,
    );
  }
  group.userData.anchors = anchors;
  return group;
}
