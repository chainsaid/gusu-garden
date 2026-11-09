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
  LB, m4, block, lathe, sweep, chamferBox, rectProfile, roofSurface, tileCapGeos, tileParams, sstep,
} from '../../world/buildings-kit.js';
import { rafterField, linePath, ridgeProfile } from '../../world/buildings-arch.js';
import { Builder } from '../../core/geom.js';
import { buildIx } from '../../world/buildings-kit.js';
import { createGualuo } from '../../../shared/gualuo-h10.js';
import { createMeikao } from '../../../shared/meikao.js';

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
function queti(lb, K, bay, z) {
  for (const cx of [COL_R, bay - COL_R]) {
    for (const s of [-1, 1]) {
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
  const n = 16;
  for (let i = 0; i < n; i++) {
    const z = -COLZ + (i + 0.5) * (2 * COLZ / n);
    const yTop = Y0 + prof(CW - Math.abs(z)) + lift(x, z) - 0.04;
    const h = yTop - Y_COLTOP;
    if (h > 0) lb.box(K.plaster, 0.10, h, 2 * COLZ / n, [x, Y_COLTOP + h / 2, z]);
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
    for (let j = 0; j < 3; j++) {
      lb.box(K.stoneClean, L - 0.012, 0.12, 4.3 / 3 - 0.012, [L / 2, 0.39, -4.3 / 3 + j * (4.3 / 3)], [0, 0, 0], 0.012);
    }

    // ---- beams
    for (const s of [-1, 1]) {
      lb.box(K.red, L, 0.22, 0.12, [L / 2, Y_COLTOP - 0.11, s * COLZ], [0, 0, 0], 0.012);
      lb.box(K.red, L, 0.16, 0.15, [L / 2, Y_PLATE - 0.08, s * COLZ], [0, 0, 0], 0.012);
    }
    lb.box(K.red, L, 0.18, 0.17, [L / 2, yRB(CW) - 0.09, 0], [0, 0, 0], 0.012);

    // ---- bays: outer wall + water-side railing
    for (let i = 0; i < leg.nBays; i++) {
      const x0 = i * leg.bayLen;
      const bayLb = lb.child(new THREE.Matrix4().makeTranslation(x0, 0, 0));

      // 白粉墙设在靠园墙侧 (-COLZ)，嵌以海棠/镂空漏窗
      outerWall(bayLb, K, COL_R, leg.bayLen - COL_R, -COLZ, lattice, "haitang");

      // 雀替
      queti(bayLb, K, leg.bayLen, COLZ);

      // 挂落与美人靠
      const clearSpan = leg.bayLen - 2 * COL_R;
      const spanMm = clearSpan * 1000;
      const bx = x0 + leg.bayLen / 2;
      const bz = COLZ;
      const c = Math.cos(leg.yaw), s = Math.sin(leg.yaw);

      // 1) 狮子林 H10 经典雕花回纹挂落
      const gl = createGualuo(THREE, { span: spanMm, material: K.redDark });
      gl.scale.set(0.001, 0.001, 0.001);
      const gh = (gl.userData?.meta?.size?.height ?? 527.6) / 1000;
      gl.position.set(
        leg.start[0] + c * bx + s * bz,
        leg.y + Y_COLTOP - 0.22 - gh / 2,
        leg.start[1] - s * bx + c * bz
      );
      gl.rotation.y = leg.yaw;
      extraMeshes.push(gl);

      // 2) 临水美人靠 / 坐槛
      if (rail === "meirenkao") {
        const mk = createMeikao(THREE, {
          length: spanMm,
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
          leg.start[0] + c * bx + s * bz,
          leg.y + Y_PL,
          leg.start[1] - s * bx + c * bz
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

    // ---- columns
    for (let i = 0; i <= leg.nBays; i++) {
      if (i === 0 && li > 0) continue; // shared with the previous leg
      const cx = i * leg.bayLen;
      column(lb.child(new THREE.Matrix4().makeTranslation(cx, 0, 0)), K);
    }

    // ---- roof: authentic classical Jiangnan mitered joint at turns
    const dYawNext = li < legs.length - 1 ? (legs[li + 1].yaw - leg.yaw) : 0;
    const dYawPrev = li > 0 ? (leg.yaw - legs[li - 1].yaw) : 0;
    const tNext = Math.tan(dYawNext / 2);
    const tPrev = Math.tan(dYawPrev / 2);
    const f = CW - TIP - 0.045;

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

    // 翼角起翘: strongest at the corridor ends, plus subtle corner lift
    const liftFn = (x, z) => {
      let t = 0;
      if (li === 0 && x < 2.4) t = Math.max(t, Math.pow(1 - Math.max(0, x) / 2.4, 2));
      if (li === legs.length - 1 && x > L - 2.4) t = Math.max(t, Math.pow(1 - Math.max(0, L - x) / 2.4, 2));
      return 0.52 * t * Math.pow(Math.abs(z) / CW, 1.6);
    };

    roofPackage(lb, K, faces, T, detail, { rafSp: 0.26, lift: liftFn });

    // fascia ends meet at the exact miter point without crossing
    fascia(lb, K, [[xInner0, -f], [xInner1, -f]], [L / 2, 0], liftFn);
    fascia(lb, K, [[xOuter0, f], [xOuter1, f]], [L / 2, 0], liftFn);

    // main ridge along the corridor run
    lb.add(sweep(linePath([0, 0], [L, 0], () => RIDGE_Y - 0.02, 0.9), ridgeProfile(0.42, 0.36, 4, 0.08, 0.3)), K.tile);

    // 戗脊 (hip ridge) & 天沟 (valley) at the miter joint
    if (li < legs.length - 1 && Math.abs(dYawNext) > 1e-4) {
      const hp = ridgeProfile(0.18, 0.12, 2, 0.03, 0.06);
      if (dYawNext > 0) {
        const qRidge = [L, 0];
        const qCorner = [L + CW * tNext, CW];
        lb.add(sweep(linePath(qRidge, qCorner, (x, z) => {
          const d = CW - z;
          return Y0 + prof(d) + liftFn(x, z) - 0.02;
        }, 0.2), hp), K.tile);
        const yCorner = Y0 + prof(0) + liftFn(qCorner[0], qCorner[1]);
        
        const vInner = [L - CW * tNext, -CW];
        lb.add(sweep(linePath(vInner, [L, 0], (x, z) => {
          const d = CW + z;
          return Y0 + prof(d) - 0.035;
        }, 0.25), rectProfile(0.16, 0.025)), K.black);
      } else {
        const qRidge = [L, 0];
        const qCorner = [L + (-CW) * tNext, -CW];
        lb.add(sweep(linePath(qRidge, qCorner, (x, z) => {
          const d = CW + z;
          return Y0 + prof(d) + liftFn(x, z) - 0.02;
        }, 0.2), hp), K.tile);

        const vInner = [L - (-CW) * tNext, CW];
        lb.add(sweep(linePath(vInner, [L, 0], (x, z) => {
          const d = CW - z;
          return Y0 + prof(d) - 0.035;
        }, 0.25), rectProfile(0.16, 0.025)), K.black);
      }
    }

    if (li === 0) gableEnd(lb, K, 0, liftFn);
    if (li === legs.length - 1) gableEnd(lb, K, L, liftFn);

    // ---- joint platform (hides the overlapping plinth wedge at a turn)
    if (li > 0) {
      const sx = 3.65;
      lb.box(K.stone, sx - 0.01, 0.5, sx - 0.01, [0, -0.2 + leg.y, 0], [0, 0, 0], 0.03);
      lb.box(K.stoneClean, sx - 0.01, 0.12, sx - 0.01, [0, 0.456, 0], [0, 0, 0], 0.012);
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
