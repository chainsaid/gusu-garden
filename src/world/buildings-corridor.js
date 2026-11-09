// ---------------------------------------------------------------------------
// KAIRO — the enclosing roofed corridor. Instanced bay units + column lines +
// deduplicated columns; non-instanced L-shaped corner pieces (hip outside,
// valley inside) that also contain one bay of each run.
// Unit frame: x along the run (0..bay), z across (-z = OUTER side with wall), y up.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LB, m4, beamM, chamferBox, block, lathe, sweep, rectProfile, roundProfile, roofSurface, tileCapGeos, tileParams, armGeo, extrude, hash3, buildIx } from './buildings-kit.js';
import { ridgeProfile, rafterField, linePath } from './buildings-arch.js';
import { lotusBlockShape } from './hall-orn.js';
import { createGualuo } from '../../shared/gualuo-h10.js';
import { createMeikao } from '../../shared/meikao.js';

export const CW = 2.68;          // tile eave half width
const TIP = 0.08;                // rafter tip line inset from the tile eave
const COLZ = 1.5;                // column rows at z = +-1.5
const COL_R = 0.15;
const Y_PL = 0.45;               // plinth top
const Y_COLTOP = 3.35;
const Y_PLATE = 3.80;            // wall plate top (= rafter bottom at the column line)
const S_RAF = 0.42;
const RAF = [0.08, 0.1];
const FASCIA_H = 0.1;
const yRB = (d) => Y_PLATE + S_RAF * (d - (CW - COLZ));
const yRT = (d) => yRB(d) + RAF[1];
const TILE = { p: 3.6 / 13, c: 0.3, rw: 0.13, rh: 0.055, pd: 0.016, lip: 0.05, thR: 0.02, thP: 0.012, detail: 0 };
const Y0 = yRT(TIP) + FASCIA_H + TILE.lip + TILE.pd;
const prof = (d) => 0.42 * d + 0.045 * d * d;
export const CORRIDOR_RIDGE_Y = Y0 + prof(CW);

// ---------------------------------------------------------------------------
// body of one bay (no columns, no roof): plinth, beams, ridge beam, outer wall, inner rail
// ---------------------------------------------------------------------------
function body(lb, K, bay, { wall = true, rail = true } = {}) {
  const half = bay / 2;
  // plinth: two courses of blocks + top slabs
  for (let i = 0; i < 2; i++) {
    const x = half * (i + 0.5);
    lb.box(K.stone, half - 0.01, 0.5, 4.3, [x, -0.2, 0], [0, 0, 0], 0.03);
    lb.box(K.stone, half - 0.01, 0.28, 4.3, [x, 0.19, 0], [0, 0, 0], 0.025);
    for (let j = 0; j < 3; j++) lb.box(K.stoneClean, half - 0.012, 0.12, 4.3 / 3 - 0.012, [x, 0.39, -4.3 / 3 + j * (4.3 / 3)], [0, 0, 0], 0.012);
  }
  for (const s of [-1, 1]) {
    lb.box(K.red, bay, 0.22, 0.12, [half, Y_COLTOP - 0.11, s * COLZ], [0, 0, 0], 0.012);
    lb.box(K.red, bay, 0.16, 0.15, [half, Y_PLATE - 0.08, s * COLZ], [0, 0, 0], 0.012);
  }
  lb.box(K.red, bay, 0.18, 0.17, [half, yRB(CW) - 0.09, 0], [0, 0, 0], 0.012);
  if (wall) outerWall(lb, K, COL_R, bay - COL_R, -COLZ, true);

  // inner garden-facing side: Jiangnan promenade low sitting rail (苏式游廊坐槛)
  // (omitted where a meikao segment takes its place)
  if (rail) {
    const L_in = bay - 2 * COL_R;
    lb.box(K.redDark, L_in, 0.08, 0.10, [half, Y_PL + 0.04, COLZ], [0, 0, 0], 0.008);
    lb.box(K.red, L_in, 0.07, 0.14, [half, Y_PL + 0.44, COLZ], [0, 0, 0], 0.012);
    const nStruts = Math.floor(L_in / 0.42);
    for (let i = 1; i < nStruts; i++) {
      lb.box(K.redDark, 0.045, 0.34, 0.06, [COL_R + (L_in * i) / nStruts, Y_PL + 0.24, COLZ], [0, 0, 0], 0.005);
    }
  }
}

// Jiangnan openwork leak window (苏式镂空透花漏窗)
function leakWindow(lb, K, cx, cy, cz, style = 0) {
  const w = 1.14, h = 1.14;
  const hw = w / 2, hh = h / 2;
  const th = 0.024, dp = 0.05;

  // Molded inner subframe
  lb.box(K.redDark, w, 0.03, dp + 0.01, [cx, cy - hh + 0.015, cz], [0, 0, 0], 0.004);
  lb.box(K.redDark, w, 0.03, dp + 0.01, [cx, cy + hh - 0.015, cz], [0, 0, 0], 0.004);
  lb.box(K.redDark, 0.03, h, dp + 0.01, [cx - hw + 0.015, cy, cz], [0, 0, 0], 0.004);
  lb.box(K.redDark, 0.03, h, dp + 0.01, [cx + hw - 0.015, cy, cz], [0, 0, 0], 0.004);

  const slat = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    lb.add(chamferBox(len, th, dp, 0.002), K.lattice,
      new THREE.Matrix4().makeRotationZ(ang).setPosition(cx + mx, cy + my, cz));
  };

  if (style === 0) {
    // Style 0: 八角套方漏窗 (Octagonal fret with diamond center)
    const c = 0.28;
    slat(-hw + c, -hh, -hw, -hh + c);
    slat(hw - c, -hh, hw, -hh + c);
    slat(-hw + c, hh, -hw, hh - c);
    slat(hw - c, hh, hw, hh - c);
    const d = 0.36;
    slat(0, -d, d, 0);
    slat(d, 0, 0, d);
    slat(0, d, -d, 0);
    slat(-d, 0, 0, -d);
    slat(-hw, 0, -d, 0);
    slat(d, 0, hw, 0);
    slat(0, -hh, 0, -d);
    slat(0, d, 0, hh);
    slat(-d * 0.45, 0, d * 0.45, 0);
    slat(0, -d * 0.45, 0, d * 0.45);
  } else if (style === 1) {
    // Style 1: 冰裂纹漏窗 (Ice-crackle / Binglie-wen)
    const pts = [
      [-0.12, -0.08], [0.15, -0.05], [0.08, 0.16], [-0.14, 0.14],
      [-0.32, -0.28], [0.28, -0.32], [0.35, 0.25], [-0.28, 0.32],
    ];
    slat(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
    slat(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    slat(pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    slat(pts[3][0], pts[3][1], pts[0][0], pts[0][1]);
    slat(pts[0][0], pts[0][1], pts[4][0], pts[4][1]);
    slat(pts[1][0], pts[1][1], pts[5][0], pts[5][1]);
    slat(pts[2][0], pts[2][1], pts[6][0], pts[6][1]);
    slat(pts[3][0], pts[3][1], pts[7][0], pts[7][1]);
    slat(pts[4][0], pts[4][1], pts[5][0], pts[5][1]);
    slat(pts[5][0], pts[5][1], pts[6][0], pts[6][1]);
    slat(pts[6][0], pts[6][1], pts[7][0], pts[7][1]);
    slat(pts[7][0], pts[7][1], pts[4][0], pts[4][1]);
    slat(pts[4][0], pts[4][1], -hw, pts[4][1] * 0.8);
    slat(pts[4][0], pts[4][1], pts[4][0] * 0.8, -hh);
    slat(pts[5][0], pts[5][1], hw, pts[5][1] * 0.8);
    slat(pts[5][0], pts[5][1], pts[5][0] * 0.8, -hh);
    slat(pts[6][0], pts[6][1], hw, pts[6][1] * 0.8);
    slat(pts[6][0], pts[6][1], pts[6][0] * 0.8, hh);
    slat(pts[7][0], pts[7][1], -hw, pts[7][1] * 0.8);
    slat(pts[7][0], pts[7][1], pts[7][0] * 0.8, hh);
  } else {
    // Style 2: 步步锦连环漏窗 (Stepped geometric fret)
    const s1 = 0.42, s2 = 0.22;
    slat(-s1, -s1, s1, -s1);
    slat(s1, -s1, s1, s1);
    slat(s1, s1, -s1, s1);
    slat(-s1, s1, -s1, -s1);
    slat(-s2, -s2, s2, -s2);
    slat(s2, -s2, s2, s2);
    slat(s2, s2, -s2, s2);
    slat(-s2, s2, -s2, -s2);
    slat(-hw, 0, -s1, 0);
    slat(s1, 0, hw, 0);
    slat(0, -hh, 0, -s1);
    slat(0, s1, 0, hh);
    slat(-hw, -s1, -s1, -s1);
    slat(hw, -s1, s1, -s1);
    slat(-hw, s1, -s1, s1);
    slat(hw, s1, s1, s1);
  }
}

// wall between a and b (along x) at z = zw: pristine white plaster with openwork leak window
function outerWall(lb, K, a, b, zw) {
  const L = b - a, x = (a + b) / 2;
  const style = Math.floor(Math.abs(x * 1.3) + Math.abs(zw * 2.1)) % 3;
  const yBot = Y_PL + 0.12;
  const yTop = Y_COLTOP - 0.12;
  const wallH = yTop - yBot;

  // Base sill beam (下槛)
  lb.box(K.redDark, L, 0.12, 0.14, [x, Y_PL + 0.06, zw], [0, 0, 0], 0.01);
  // Upper lintel beam (上枋)
  lb.box(K.redDark, L, 0.12, 0.14, [x, Y_COLTOP - 0.06, zw], [0, 0, 0], 0.01);

  // Leak window dimensions
  const wW = 1.25, wH = 1.25;
  const yMid = 1.88;
  const yWin0 = yMid - wH / 2;
  const yWin1 = yMid + wH / 2;
  const wSide = (L - wW) / 2;

  // White plaster walls (白粉墙)
  // Left wall
  lb.box(K.plaster, wSide, wallH, 0.10, [a + wSide / 2, (yBot + yTop) / 2, zw]);
  // Right wall
  lb.box(K.plaster, wSide, wallH, 0.10, [b - wSide / 2, (yBot + yTop) / 2, zw]);
  // Bottom wall below window
  lb.box(K.plaster, wW + 0.004, yWin0 - yBot, 0.10, [x, (yBot + yWin0) / 2, zw]);
  // Top wall above window
  lb.box(K.plaster, wW + 0.004, yTop - yWin1, 0.10, [x, (yWin1 + yTop) / 2, zw]);

  // Window outer casing (外框)
  lb.box(K.redDark, wW + 0.06, 0.045, 0.12, [x, yWin0 + 0.02, zw], [0, 0, 0], 0.005);
  lb.box(K.redDark, wW + 0.06, 0.045, 0.12, [x, yWin1 - 0.02, zw], [0, 0, 0], 0.005);
  lb.box(K.redDark, 0.045, wH, 0.12, [x - wW / 2 + 0.02, yMid, zw], [0, 0, 0], 0.005);
  lb.box(K.redDark, 0.045, wH, 0.12, [x + wW / 2 - 0.02, yMid, zw], [0, 0, 0], 0.005);

  // Openwork lattice (镂空花心)
  leakWindow(lb, K, x, yMid, zw, style);
}

// roof package over faces: tiles, caps, soffit, rafters
function roofPackage(lb, K, faces, T, detail, { rafSp = 0.26, eave = false, lift = null } = {}) {
  const L = lift || (() => 0);
  const tf = faces.map((F) => ({ ...F, y0: Y0, prof, lip: F.lip !== false }));
  const { geo, caps } = roofSurface(tf, T, L);
  lb.addIx(geo, K.tileVC);
  const [cd, cg] = tileCapGeos(T.rw * 0.55, T.detail);
  for (const c of caps) {
    const mm = m4(c.pos, [0, Math.atan2(c.out[0], c.out[1]), 0]);
    lb.add(cd, K.tile, mm); lb.add(cg, K.cap, mm);
  }
  const sf = faces.map((F) => ({ ...F, y0: 0, prof: yRT, dmin: (u) => Math.max(TIP, F.dmin ? F.dmin(u) : 0) }));
  const s = roofSurface(sf, null, L, { flip: true, du: detail.gap(0.4), dd: detail.gap(0.4) }).geo;
  s.deleteAttribute('color');
  lb.add(s, K.soffit);
  rafterField(lb, faces, { sp: rafSp, w: RAF[0], h: RAF[1], yBot: yRB, dStart: TIP, lift: L, mat: K.red, capMat: K.capPaint, lo: true });
  if (eave) eaveDress(lb, K, tf, T, lift);
}

// ---------------------------------------------------------------------------
// Suzhou eave dressing (?eave=jiangnan):
//   瓦口板 — the narrow board that carries the eave tile row, proud of the
//            封檐板 and just under the tile edge, split where a valley cuts in;
//   滴水瓦 — one drip tile in every pan-tile trough, between the round 勾头,
//            hanging slightly forward so its pointed lower edge clears the board.
// Both are additions only: with the switch off the eave is untouched.
// ---------------------------------------------------------------------------
function dripGeo() {
  const s = new THREE.Shape();
  s.moveTo(-0.070, 0); s.lineTo(0.070, 0);
  s.lineTo(0.070, -0.068);
  s.lineTo(0.028, -0.100);
  s.lineTo(0, -0.128);
  s.lineTo(-0.028, -0.100);
  s.lineTo(-0.070, -0.068);
  s.closePath();
  return extrude(s, 0.013, 0.002, 'dripTile', 2);
}

function eaveDress(lb, K, faces, T, L = null) {
  const lift = L || (() => 0);
  const boardH = 0.060, boardD = 0.024, boardOut = 0.0065;
  const boardY = Y0 - 0.042;   // top ≈ 3.592, just under the tile edge at 3.604
  const drip = dripGeo();
  for (const F of faces) {
    if (F.lip === false) continue;
    const th = Math.atan2(-F.a[1], F.a[0]);
    const out = [-F.n[0], -F.n[1]];
    const dm = (u) => (F.dmin ? F.dmin(u) : 0);
    const ok = (u) => dm(u) <= 1e-6 && F.dmax(u) >= 0.05;
    // 瓦口板: short strips along the eave line (each strip stays a straight run)
    // strips get shorter where the eave curls up, so they follow the corner lift
    const step = L ? 0.16 : 0.32;
    for (let ua = F.u0; ua < F.u1 - 1e-4; ua += step) {
      const ub = Math.min(F.u1, ua + step);
      if (!ok(ua + 1e-3) || !ok((ua + ub) / 2) || !ok(ub - 1e-3)) continue;
      const um = (ua + ub) / 2;
      const off = boardOut - boardD / 2;
      const bx = F.O[0] + F.a[0] * um + out[0] * off, bz = F.O[1] + F.a[1] * um + out[1] * off;
      lb.box(K.red, ub - ua + 0.006, boardH, boardD,
        [bx, boardY + lift(F.O[0] + F.a[0] * um, F.O[1] + F.a[1] * um), bz], [0, th, 0], 0.003);
    }
    // 滴水瓦: half a pitch off the 勾头 line, only where the eave edge exists
    if (!T) continue;
    const k0 = Math.ceil((F.u0 - T.phase) / T.p - 0.5);
    const k1 = Math.floor((F.u1 - T.phase) / T.p - 0.5);
    for (let k = k0; k <= k1; k++) {
      const u = T.phase + (k + 0.5) * T.p;
      if (u < F.u0 + T.rw * 0.4 || u > F.u1 - T.rw * 0.4) continue;
      if (!ok(u)) continue;
      const px = F.O[0] + F.a[0] * u + out[0] * 0.024, pz = F.O[1] + F.a[1] * u + out[1] * 0.024;
      const pos = [px, Y0 - 0.018 + lift(px, pz), pz];
      lb.add(drip, K.tile, m4(pos, [-0.10, th, 0]));
    }
  }
}
function fascia(lb, K, pts, inside, lift = null) {
  const p3 = [];
  if (!lift) {
    for (const [x, z] of pts) p3.push(new THREE.Vector3(x, yRT(TIP), z));
  } else {
    // densify so the board follows the corner lift instead of cutting the corner
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      if (i === 0) { p3.push(new THREE.Vector3(x, yRT(TIP) + lift(x, z), z)); continue; }
      const [x0, z0] = pts[i - 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x - x0, z - z0) / 0.15));
      for (let j = 1; j <= n; j++) {
        const xx = x0 + ((x - x0) * j) / n, zz = z0 + ((z - z0) * j) / n;
        p3.push(new THREE.Vector3(xx, yRT(TIP) + lift(xx, zz), zz));
      }
    }
  }
  const prof = [[-0.045, 0], [0.045, 0], [0.045, FASCIA_H - 0.02], [0.13, FASCIA_H - 0.02], [0.13, FASCIA_H], [-0.045, FASCIA_H]];
  lb.add(sweep(p3, prof, { inside }), K.red);
}

// ---------------------------------------------------------------------------
// The repeating bay unit (built for bay = 3.6, instanced with x-scale)
// ---------------------------------------------------------------------------
function unitBay(lb, K, detail, jn, eave, rail = true) {
  const bay = 3.6;
  body(lb, K, bay, { rail });
  const T = tileParams({ ...TILE, phase: 0 }, detail);
  const faces = [
    { O: [0, CW], a: [1, 0], n: [0, -1], u0: 0, u1: bay, dmax: () => CW },
    { O: [0, -CW], a: [-1, 0], n: [0, 1], u0: -bay, u1: 0, dmax: () => CW },
  ];
  roofPackage(lb, K, faces, T, detail, { rafSp: bay / 14, eave });
  for (const s of [-1, 1]) fascia(lb, K, [[0, s * (CW - TIP - 0.045)], [bay, s * (CW - TIP - 0.045)]], [bay / 2, 0]);
  lb.add(sweep(linePath([0, 0], [bay, 0], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), ridgeProfile(0.42, 0.36, 4, 0.08, 0.3)), K.tile);
}
// column line: 虹梁 (rainbow beam) across, 荷叶墩 (jiangnan build; default: 蛙股),
// ridge block, funa肘木 on both columns
function unitLine(lb, K, detail, jn) {
  // 虹梁
  const top = Y_PLATE;
  const s = new THREE.Shape();
  s.moveTo(-1.82, top - 0.26); s.lineTo(-1.5, top - 0.28);
  s.quadraticCurveTo(0, top - 0.17, 1.5, top - 0.28); s.lineTo(1.82, top - 0.26);
  s.lineTo(1.86, top - 0.12); s.lineTo(1.8, top); s.lineTo(-1.8, top); s.lineTo(-1.86, top - 0.12); s.lineTo(-1.82, top - 0.26);
  lb.add(extrude(s, 0.17, 0.012, 'koryo', 4), K.red, m4([0, 0, 0], [0, Math.PI / 2, 0]));
  for (const sz of [-1, 1]) lb.add(chamferBox(0.18, 0.2, 0.012, 0.003), K.cap, m4([0, top - 0.13, sz * 1.86]));
  const kh = yRB(CW) - 0.18 - 0.11 - 0.14 - top;
  if (jn) {
    // 江南: 真荷叶墩（荷叶轮廓，非蛙腿）
    const sh = lotusBlockShape(0.8, kh);
    lb.add(extrude(sh, 0.16, 0.008, 'lotus' + kh.toFixed(3), 6), K.red, m4([0, top, 0], [0, Math.PI / 2, 0]));
    lb.add(chamferBox(0.3, 0.028, 0.3, 0.004), K.red, m4([0, top + kh + 0.014, 0]));
  } else {
    // 蛙股 (frog-leg strut) from 虹梁 top to the ridge 大斗
    const k = new THREE.Shape();
    k.moveTo(-0.42, 0); k.lineTo(-0.3, 0);
    k.bezierCurveTo(-0.2, kh * 0.45, -0.1, kh * 0.6, -0.07, kh); k.lineTo(0.07, kh);
    k.bezierCurveTo(0.1, kh * 0.6, 0.2, kh * 0.45, 0.3, 0); k.lineTo(0.42, 0);
    k.bezierCurveTo(0.3, kh * 0.55, 0.16, kh * 0.8, 0.12, kh + 0.02); k.lineTo(-0.12, kh + 0.02);
    k.bezierCurveTo(-0.16, kh * 0.8, -0.3, kh * 0.55, -0.42, 0);
    lb.add(extrude(k, 0.11, 0, 'kaeru' + kh.toFixed(3), 3), K.red, m4([0, top, 0], [0, Math.PI / 2, 0]));
  }
  lb.add(block(0.26, 0.14, 0.26), K.red, m4([0, top + kh + 0.02, 0]));
  lb.add(armGeo(0.9, 0.11, 0.12, true), K.red, m4([0, top + kh + 0.16, 0]));
  // funa肘木 on the column 大斗, along the run
  for (const sz of [-1, 1]) lb.add(armGeo(1.24, 0.12, 0.13, true), K.red, m4([0, Y_COLTOP + 0.17, sz * COLZ]));
}
function unitColumn(lb, K) {
  lb.add(lathe([[0, -0.05], [0.25, -0.05], [0.25, 0.02], [0.22, 0.05], [0.18, 0.07], [0, 0.07]], 10, 'csos'), K.stoneClean, m4([0, Y_PL, 0]));
  lb.add(new THREE.CylinderGeometry(COL_R, COL_R * 1.02, Y_COLTOP - Y_PL - 0.07, 16, 1), K.col, m4([0, (Y_COLTOP + Y_PL + 0.07) / 2, 0]));
  lb.add(block(0.32, 0.17, 0.32), K.red, m4([0, Y_COLTOP, 0]));
}

// ---------------------------------------------------------------------------
// Suzhou corner (嫩戗发戗), outer corner of the hip, canonical frame:
// corner at (+CW,-CW), inward diagonal to (0,0).
// The last CRUN metres of the two roof faces, their soffit, rafters,
// fascia and eave dressing all curl up by the same radial lift, so the eave
// rises into the corner instead of staying flat. The 戗脊 follows that lift
// and dies out at the same distance; 老戗 / 嫩戗 hang under it, and the tip is
// closed with a 瓦作收头 tile.  Off by default: ?corner=jiangnan
// ---------------------------------------------------------------------------
const CRUN = 1.15;       // how far back from the eave corner the lift dies out
const CRISE = 0.20;      // eave-corner rise
const CDIR = [-Math.SQRT1_2, Math.SQRT1_2];
// s = plan distance along the hip, measured inward from the eave corner
// (s = 0 at the tile corner, s < 0 out over the tip)
const cpt = (s) => [CW + CDIR[0] * s, -CW + CDIR[1] * s];
const clift = (s) => (s < CRUN ? CRISE * ((1 - s / CRUN) ** 2) : 0);
const cridge = (s) => prof(Math.max(0, s) / Math.SQRT2) - 0.02 + clift(s);
const cliftAt = (x, z) => clift(Math.hypot(x - CW, z + CW));

function cornerDress(lb, K) {
  // members are built in the vertical plane along the outward diagonal,
  // hanging just under the lifted soffit; s is positive inwards from the corner
  const cm = m4([CW, Y0, -CW], [0, -Math.PI * 3 / 4, 0]);
  const under = (s) => yRT(s / Math.SQRT2) - Y0 + clift(s);
  const band = (s0, s1, up, dn, th, key) => {
    const n = 16, pts = [];
    for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; pts.push([s, up(s)]); }
    for (let i = n; i >= 0; i--) { const s = s0 + ((s1 - s0) * i) / n; pts.push([s, dn(s)]); }
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    lb.add(extrude(sh, th, 0.006, key, 2), K.red, cm);
  };
  // 嫩戗: the short member at the tip, stacked on top of the 老戗; it runs out
  // past the 戗脊 end so its curled tip is what you see under the corner
  band(-0.36, 0.90, (s) => under(s) - 0.004, (s) => under(s) - 0.084, 0.085, 'nnq');
  // 老戗: the heavy main corner beam, running back under the roof
  band(-0.06, 1.70, (s) => under(s) - 0.086, (s) => under(s) - 0.206, 0.14, 'lqq');
  // 瓦作收头: one closing tile riding up the end of the 戗脊
  const rt = Y0 + cridge(-0.18);
  const tp = cpt(-0.13);
  const mm = new THREE.Matrix4().makeRotationY(Math.PI * 0.25).multiply(new THREE.Matrix4().makeRotationZ(0.5));
  mm.setPosition(tp[0], rt + 0.275, tp[1]);
  lb.add(chamferBox(0.20, 0.045, 0.14, 0.008), K.tile, mm);
}

// ---------------------------------------------------------------------------
// Corner piece (canonical): corner at the origin; run A extends toward -x,
// run B toward +z; outer quadrant (+x,-z). Includes one bay of each run.
// ---------------------------------------------------------------------------
function cornerPiece(lb, K, bayA, bayB, detail, eave, corner, rail = true) {
  const W = CW;
  const Lx = COLZ + bayA, Lz = COLZ + bayB;
  // bodies of the two included bays
  body(lb.child(m4([-Lx, 0, 0])), K, bayA, { rail });
  body(lb.child(m4([0, 0.003, COLZ], [0, -Math.PI / 2, 0])), K, bayB, { rail });
  // corner square plinth: region x in [-1.5, 2.15], z in [-2.15, 1.5] (the bays cover the rest)
  {
    const sx = 3.65, cxp = 0.325, czp = -0.325;
    lb.box(K.stone, sx - 0.01, 0.5, sx - 0.01, [cxp, -0.2, czp], [0, 0, 0], 0.03);
    lb.box(K.stone, sx - 0.01, 0.28, sx - 0.01, [cxp, 0.19, czp], [0, 0, 0], 0.025);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) lb.box(K.stoneClean, sx / 3 - 0.012, 0.12, sx / 3 - 0.012, [cxp - sx / 3 + i * sx / 3, 0.39, czp - sx / 3 + j * sx / 3], [0, 0, 0], 0.012);
  }
  for (const s of [-1, 1]) {
    lb.box(K.red, 2 * COLZ, 0.22, 0.12, [0, Y_COLTOP - 0.11, s * COLZ], [0, 0, 0], 0.012);
    lb.box(K.red, 0.12, 0.22, 2 * COLZ, [s * COLZ, Y_COLTOP - 0.11, 0], [0, 0, 0], 0.012);
    lb.box(K.red, 2 * COLZ + 0.15, 0.16, 0.15, [0, Y_PLATE - 0.08, s * COLZ], [0, 0, 0], 0.012);
    lb.box(K.red, 0.15, 0.16, 2 * COLZ + 0.15, [s * COLZ, Y_PLATE - 0.08, 0], [0, 0, 0], 0.012);
  }
  lb.box(K.red, COLZ + 0.1, 0.18, 0.17, [-COLZ / 2, yRB(CW) - 0.09, 0], [0, 0, 0], 0.012);
  lb.box(K.red, 0.17, 0.18, COLZ + 0.1, [0, yRB(CW) - 0.09, COLZ / 2], [0, 0, 0], 0.012);
  lb.add(block(0.3, 0.3, 0.3), K.red, m4([0, yRB(CW) - 0.18 - 0.3, 0]));
  lb.add(new THREE.CylinderGeometry(0.09, 0.09, yRB(CW) - 0.48 - Y_PLATE, 12), K.col, m4([0, (yRB(CW) - 0.48 + Y_PLATE) / 2, 0]));
  outerWall(lb, K, -COLZ + COL_R, COLZ - COL_R, -COLZ);
  outerWall(lb.child(m4([0, 0, 0], [0, -Math.PI / 2, 0])), K, -COLZ + COL_R, COLZ - COL_R, -COLZ);
  // roof faces (hip on the outer diagonal, valley on the inner diagonal)
  const faces = [
    { O: [0, -W], a: [1, 0], n: [0, 1], u0: -Lx, u1: W, dmax: (u) => (u <= 0 ? W : W - u), phase: -COLZ, p: bayA / 13 },
    { O: [0, W], a: [1, 0], n: [0, -1], u0: -Lx, u1: 0, dmin: (u) => Math.max(0, u + W), dmax: () => W, phase: -COLZ, p: bayA / 13 },
    { O: [W, 0], a: [0, 1], n: [-1, 0], u0: -W, u1: Lz, dmax: (u) => (u < 0 ? u + W : W), phase: COLZ, p: bayB / 13 },
    { O: [-W, 0], a: [0, 1], n: [1, 0], u0: 0, u1: Lz, dmin: (u) => Math.max(0, W - u), dmax: () => W, phase: COLZ, p: bayB / 13 },
  ];
  const cLift = corner ? cliftAt : null;
  for (const F of faces) {
    const T = tileParams({ ...TILE, p: F.p, phase: F.phase }, detail);
    roofPackage(lb, K, [F], T, detail, { rafSp: 0.26, eave, lift: cLift });
  }
  // fascia L's
  const f = CW - TIP - 0.045;
  fascia(lb, K, [[-Lx, -f], [f, -f], [f, Lz]], [0, 0], cLift);
  fascia(lb, K, [[-Lx, f], [-f, f], [-f, Lz]], [0, 0], cLift);
  // ridges: A, B, hip
  const rp = ridgeProfile(0.42, 0.36, 4, 0.08, 0.3);
  lb.add(sweep(linePath([-Lx, 0], [0.12, 0], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), rp), K.tile);
  lb.add(sweep(linePath([0, -0.12], [0, Lz], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), rp), K.tile);
  const hp = ridgeProfile(0.3, 0.26, 3, 0.065, 0.18);
  if (corner) {
    // hip: unchanged inbound, but the last run is replaced by the raised 戗脊
    const q = cpt(CRUN);
    lb.add(sweep(linePath([0.05, -0.05], q, (x, z) => Y0 + prof(W - Math.max(x, -z)) - 0.02, 0.2), hp), K.tile);
    const tip = cpt(-0.18);
    const sAt = (x, z) => Math.hypot(x - tip[0], z - tip[1]) - 0.18;
    lb.add(sweep(linePath(tip, q, (x, z) => Y0 + cridge(sAt(x, z)), 0.12), hp), K.tile);
    cornerDress(lb, K);
  } else {
    lb.add(sweep(linePath([0.05, -0.05], [W + 0.03, -W - 0.03], (x, z) => Y0 + prof(W - Math.max(x, -z)) - 0.02, 0.2), hp), K.tile);
    // corner ridge end upturn (江南小青瓦滴水脊头)
    const oy = Y0 - 0.04;
    lb.add(chamferBox(0.22, 0.24, 0.12, 0.015), K.tile, m4([W + 0.06, oy + 0.12, -W - 0.06], [0, Math.PI * 0.75, 0]));
  }
  // valley channel (dark metal)
  lb.add(sweep(linePath([-W, W], [-0.15, 0.15], (x, z) => Y0 + prof(W - Math.min(-x, z)) - 0.035, 0.25), rectProfile(0.14, 0.02)), K.black);
}

// ---------------------------------------------------------------------------
// Optional 挂落 (shared/gualuo-h10.js): one per bay, hung from the underside of
// the inner 檐枋 and spanning between the two column shafts (net span = bay − 2·COL_R).
// Placed in the run's unit frame (local +x along the run, local +z inward), so
// the module's centred origin needs no extra fiddling: matrix = rotY(yaw) + translation.
// ---------------------------------------------------------------------------
const Y_GUALUO_TOP = Y_COLTOP - 0.22;   // underside of the bay beam at z = +COLZ

function addGualuo(ctx, K, parent, runs) {
  const T = ctx.THREE;
  const sets = new Map();
  let bays = 0;
  for (const r of runs) {
    const span = r.bay - 2 * COL_R;
    const key = span.toFixed(4);
    let set = sets.get(key);
    if (!set) {
      set = { probe: createGualuo(T, { span: span * 1000, material: K.red }), mats: [] };
      sets.set(key, set);
    }
    const h = set.probe.userData.meta.size.height / 1000;  // mm -> m
    for (let i = 0; i < r.n; i++) {
      // only openings with a column at both ends: the two gate-end bays die
      // into the gate's plaster firewall (no column head to hang an end from)
      if ((i === 0 && r.startLine === false) || (i === r.n - 1 && r.endLine === false)) continue;
      const x = r.P0[0] + r.dir[0] * r.bay * (i + 0.5) + Math.sin(r.yaw) * COLZ;
      const z = r.P0[1] + r.dir[1] * r.bay * (i + 0.5) + Math.cos(r.yaw) * COLZ;
      // the shared module builds in millimetres; the scene is in metres
      set.mats.push(new T.Matrix4().compose(
        new T.Vector3(x, Y_GUALUO_TOP - h / 2, z),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), r.yaw),
        new T.Vector3(0.001, 0.001, 0.001)));
      bays++;
    }
  }
  let tris = 0;
  for (const { probe, mats } of sets.values()) {
    for (const mesh of probe.children) {
      const im = new T.InstancedMesh(mesh.geometry, mesh.material, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true;
      im.name = 'gualuoH10_' + mesh.name;
      im.computeBoundingSphere(); im.computeBoundingBox?.();
      parent.add(im);
      tris += (mesh.geometry.getAttribute('position').count / 3) * mats.length;
    }
  }
  console.log(`[buildings] corridor gualuo: bays=${bays} spans=${[...sets.keys()].map((k) => (+k).toFixed(3)).join('/')}m tris~${Math.round(tris / 1000)}k`);
}

// ---------------------------------------------------------------------------
// 美人靠 mounting (?meikao=mount): one shared segment per open bay, built to
// that bay's actual clear span between column faces — never x-scaled, so the
// section keeps its proportions. Each segment's local +Z is the seat / walkway
// side, so the instance yaw is the run yaw turned by pi: the seat faces the
// corridor, the backrest leans out toward the garden. The low wall sits on the
// corridor floor (Y_PL = plinth top); its end faces are flush with the columns.
// The bay's own plain sitting rail is omitted whenever a segment is mounted.
// ---------------------------------------------------------------------------
const Y_MEIKAO = Y_PL;          // module origin (floor) = corridor plinth top
const MEIKAO_Z = 1.30;          // unit +z (open side) of the seat front edge

function addMeikao(ctx, K, parent, runs) {
  const T = ctx.THREE;
  const mats = {
    wood: K.redDark, woodSeat: K.redDark,
    stone: K.plaster, stoneCap: K.stoneClean, stoneCore: K.stone,
  };
  const sets = new Map();
  let bays = 0;
  for (const r of runs) {
    const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    for (let i = 0; i < r.n; i++) {
      // a bay that dies into the gate's plaster firewall has a column at one
      // end only; its segment runs flush from that column face to the wall
      const gateStart = i === 0 && r.startLine === false;
      const gateEnd = i === r.n - 1 && r.endLine === false;
      const span = r.bay - (gateStart || gateEnd ? 1 : 2) * COL_R;
      const shift = gateStart ? -COL_R / 2 : gateEnd ? COL_R / 2 : 0;
      const key = span.toFixed(4);
      let set = sets.get(key);
      if (!set) {
        const length = span * 1000;                            // mm
        const probe = createMeikao(T, { length, materials: mats });
        const barCount = probe.userData.meta?.section?.barCount ?? 0;
        set = { probe, mats: [], length, barCount };
        sets.set(key, set);
      }
      const bx = r.P0[0] + r.dir[0] * (r.bay * (i + 0.5) + shift);
      const bz = r.P0[1] + r.dir[1] * (r.bay * (i + 0.5) + shift);
      set.mats.push(new T.Matrix4().compose(
        new T.Vector3(bx + s * MEIKAO_Z, Y_MEIKAO, bz + c * MEIKAO_Z),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), r.yaw + Math.PI),
        new T.Vector3(0.001, 0.001, 0.001)));
      bays++;
    }
  }
  let tris = 0;
  const spans = [];
  for (const { probe, mats: list, length, barCount } of sets.values()) {
    spans.push(`${(length / 1000).toFixed(3)}m/${barCount}根`);
    // bake the part's local transform into its geometry: InstancedMesh only
    // carries the geometry, not the mesh offsets inside the shared module
    probe.updateMatrixWorld(true);
    const parts = [];
    probe.traverse((o) => {
      if (!o.isMesh) return;
      parts.push({ geo: o.geometry.clone().applyMatrix4(o.matrixWorld), mat: o.material, name: o.name });
    });
    for (const part of parts) {
      const im = new T.InstancedMesh(part.geo, part.mat, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true;
      im.name = 'meikao_' + part.name;
      im.computeBoundingSphere(); im.computeBoundingBox?.();
      parent.add(im);
      tris += (part.geo.index ? part.geo.index.count / 3 : part.geo.attributes.position.count / 3) * list.length;
    }
  }
  console.log(`[buildings] corridor meikao: bays=${bays} spans=${spans.join(' ')} tris~${Math.round(tris / 1000)}k`);
}

// ---------------------------------------------------------------------------
export function buildCorridor(ctx, K, parent) {
  const { geom, L } = ctx;
  const detail = ctx.detail;
  const R = L.corridor.rect;
  const gate = L.gate;
  const gx0 = gate.center[0] - 5.14, gx1 = gate.center[0] + 5.14; // corridor ends flush at the gate side walls
  // runs: P0 column line, dir, count, yaw (unit +x -> dir, unit -z -> outer)
  const runs = [
    { name: 'N', P0: [R.minX + COLZ, R.minZ], dir: [1, 0], len: (R.maxX - COLZ) - (R.minX + COLZ), yaw: 0, skip0: 1, skip1: 1, lines: true, endLine: true },
    { name: 'SE', P0: [R.maxX - COLZ, R.maxZ], dir: [-1, 0], len: (R.maxX - COLZ) - gx1, yaw: Math.PI, skip0: 1, skip1: 0, endLine: false },
    { name: 'SW', P0: [gx0, R.maxZ], dir: [-1, 0], len: gx0 - (R.minX + COLZ), yaw: Math.PI, skip0: 0, skip1: 1, startLine: false, endLine: true },
    { name: 'W', P0: [R.minX, R.maxZ - COLZ], dir: [0, -1], len: (R.maxZ - COLZ) - (R.minZ + COLZ), yaw: Math.PI / 2, skip0: 1, skip1: 1, endLine: true },
    { name: 'E', P0: [R.maxX, R.minZ + COLZ], dir: [0, 1], len: (R.maxZ - COLZ) - (R.minZ + COLZ), yaw: -Math.PI / 2, skip0: 1, skip1: 1, endLine: true },
  ];
  const unitM = [], lineM = [], colPos = new Map();
  const meikaoOn = ctx.opts.meikao === 'mount';
  const addCol = (x, z) => { const k = `${x.toFixed(2)},${z.toFixed(2)}`; if (!colPos.has(k)) colPos.set(k, [x, z]); };
  for (const r of runs) {
    r.n = Math.max(1, Math.round(r.len / 3.6));
    r.bay = r.len / r.n;
    const out = [r.dir[1], -r.dir[0]]; // not used directly; yaw encodes it
    for (let i = 0; i <= r.n; i++) {
      const p = [r.P0[0] + r.dir[0] * r.bay * i, r.P0[1] + r.dir[1] * r.bay * i];
      const isStart = i === 0, isEnd = i === r.n;
      if (i < r.n && i >= r.skip0 && i < r.n - r.skip1) {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(p[0], 0, p[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.yaw), new THREE.Vector3(r.bay / 3.6, 1, 1));
        unitM.push(m);
      }
      if ((isStart && r.startLine === false) || (isEnd && r.endLine === false)) continue;
      lineM.push(new THREE.Matrix4().compose(new THREE.Vector3(p[0], 0, p[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.yaw), new THREE.Vector3(1, 1, 1)));
      // two columns: unit z = +-COLZ -> world
      const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
      for (const zz of [-COLZ, COLZ]) addCol(p[0] + s * zz, p[1] + c * zz);
    }
  }
  // corner pieces
  const byName = Object.fromEntries(runs.map((r) => [r.name, r]));
  const corners = [
    { at: [R.maxX, R.minZ], yaw: 0, A: byName.N.bay, B: byName.E.bay },
    { at: [R.minX, R.minZ], yaw: Math.PI / 2, A: byName.W.bay, B: byName.N.bay },
    { at: [R.minX, R.maxZ], yaw: Math.PI, A: byName.SW.bay, B: byName.W.bay },
    { at: [R.maxX, R.maxZ], yaw: -Math.PI / 2, A: byName.E.bay, B: byName.SE.bay },
  ];
  const cb = new geom.Builder(); const cix = new Map();
  const eaveOn = ctx.opts.eave === 'jiangnan';
  const cornerOn = ctx.opts.corner === 'jiangnan';
  for (const c of corners) {
    const base = new THREE.Matrix4().makeRotationY(c.yaw).setPosition(c.at[0], 0, c.at[1]);
    const lb = new LB(cb, base, cix);
    cornerPiece(lb, K, c.A, c.B, detail, eaveOn, cornerOn, !meikaoOn);
    // outer corner column
    const oc = new THREE.Vector3(COLZ, 0, -COLZ).applyMatrix4(base);
    addCol(oc.x, oc.z);
  }
  const cg = cb.build({ name: 'corridorCorners' });
  buildIx(cix, cg);
  parent.add(cg);
  // instanced sets
  const jn = ctx.opts.bracket === 'jiangnan';
  const mkInst = (fn, mats, name, rail = true) => {
    const b = new geom.Builder(); const ix = new Map();
    fn(new LB(b, new THREE.Matrix4(), ix), K, detail, jn, eaveOn, rail);
    const g = b.build({ name: name + 'Proto' });
    const meshes = [];
    g.children.forEach((m) => meshes.push({ geo: m.geometry, mat: m.material }));
    for (const { mat, geos } of ix.values()) {
      const merged = ctx.geom.mergeGeometries(geos, false);
      meshes.push({ geo: merged, mat });
    }
    for (const { geo, mat } of meshes) {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true; im.name = name;
      im.computeBoundingSphere(); im.computeBoundingBox?.();
      parent.add(im);
    }
    let tris = 0; for (const { geo } of meshes) tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    return tris * mats.length;
  };
  const colM = [...colPos.values()].map(([x, z]) => new THREE.Matrix4().makeTranslation(x, 0, z));
  const t1 = meikaoOn ? mkInst(unitBay, unitM, 'corridorBayMeikao', false) : mkInst(unitBay, unitM, 'corridorBay', true);
  const t2 = mkInst(unitLine, lineM, 'corridorLine');
  const t3 = mkInst(unitColumn, colM, 'corridorColumn');
  if (ctx.opts.gualuo === 'h10') addGualuo(ctx, K, parent, runs);
  if (meikaoOn) addMeikao(ctx, K, parent, runs);
  console.log(`[buildings] corridor: bays=${unitM.length}${meikaoOn ? ' (meikao)' : ''} lines=${lineM.length} cols=${colM.length} tris~${Math.round((t1 + t2 + t3) / 1000)}k`);
}
