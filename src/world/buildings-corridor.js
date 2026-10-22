// ---------------------------------------------------------------------------
// KAIRO — the enclosing roofed corridor. Instanced bay units + column lines +
// deduplicated columns; non-instanced L-shaped corner pieces (hip outside,
// valley inside) that also contain one bay of each run.
// Unit frame: x along the run (0..bay), z across (-z = OUTER side with wall), y up.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LB, m4, beamM, chamferBox, block, lathe, colBand, sweep, rectProfile, roundProfile, roofSurface, tileCapGeos, tileParams, armGeo, extrude, rosette, hash3, buildIx } from './buildings-kit.js';
import { ridgeProfile, rafterField, linePath } from './buildings-arch.js';

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
function body(lb, K, bay, { wall = true } = {}) {
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
  const L_in = bay - 2 * COL_R;
  lb.box(K.redDark, L_in, 0.08, 0.10, [half, Y_PL + 0.04, COLZ], [0, 0, 0], 0.008);
  lb.box(K.red, L_in, 0.07, 0.14, [half, Y_PL + 0.44, COLZ], [0, 0, 0], 0.012);
  const nStruts = Math.floor(L_in / 0.42);
  for (let i = 1; i < nStruts; i++) {
    lb.box(K.redDark, 0.045, 0.34, 0.06, [COL_R + (L_in * i) / nStruts, Y_PL + 0.24, COLZ], [0, 0, 0], 0.005);
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
function roofPackage(lb, K, faces, T, { rafSp = 0.26 } = {}) {
  const tf = faces.map((F) => ({ ...F, y0: Y0, prof, lip: F.lip !== false }));
  const { geo, caps } = roofSurface(tf, T, () => 0);
  lb.addIx(geo, K.tileVC);
  const [cd, cg] = tileCapGeos(T.rw * 0.55, T.detail);
  for (const c of caps) {
    const mm = m4(c.pos, [0, Math.atan2(c.out[0], c.out[1]), 0]);
    lb.add(cd, K.tile, mm); lb.add(cg, K.cap, mm);
  }
  const sf = faces.map((F) => ({ ...F, y0: 0, prof: yRT, dmin: (u) => Math.max(TIP, F.dmin ? F.dmin(u) : 0) }));
  const s = roofSurface(sf, null, () => 0, { flip: true, du: 0.4, dd: 0.4 }).geo;
  s.deleteAttribute('color');
  lb.add(s, K.soffit);
  rafterField(lb, faces, { sp: rafSp, w: RAF[0], h: RAF[1], yBot: yRB, dStart: TIP, mat: K.red, capMat: K.capPaint, lo: true });
}
function fascia(lb, K, pts, inside) {
  const path = pts.map(([x, z]) => new THREE.Vector3(x, yRT(TIP), z));
  const prof = [[-0.045, 0], [0.045, 0], [0.045, FASCIA_H - 0.02], [0.13, FASCIA_H - 0.02], [0.13, FASCIA_H], [-0.045, FASCIA_H]];
  lb.add(sweep(path, prof, { inside }), K.red);
}

// ---------------------------------------------------------------------------
// The repeating bay unit (built for bay = 3.6, instanced with x-scale)
// ---------------------------------------------------------------------------
function unitBay(lb, K) {
  const bay = 3.6;
  body(lb, K, bay);
  const T = tileParams({ ...TILE, phase: 0 });
  const faces = [
    { O: [0, CW], a: [1, 0], n: [0, -1], u0: 0, u1: bay, dmax: () => CW },
    { O: [0, -CW], a: [-1, 0], n: [0, 1], u0: -bay, u1: 0, dmax: () => CW },
  ];
  roofPackage(lb, K, faces, T, { rafSp: bay / 14 });
  for (const s of [-1, 1]) fascia(lb, K, [[0, s * (CW - TIP - 0.045)], [bay, s * (CW - TIP - 0.045)]], [bay / 2, 0]);
  lb.add(sweep(linePath([0, 0], [bay, 0], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), ridgeProfile(0.42, 0.36, 4, 0.08, 0.3)), K.tile);
}
// column line: koryo (rainbow beam) across, kaerumata, ridge block, funahijiki on both columns
function unitLine(lb, K) {
  // koryo
  const top = Y_PLATE;
  const s = new THREE.Shape();
  s.moveTo(-1.82, top - 0.26); s.lineTo(-1.5, top - 0.28);
  s.quadraticCurveTo(0, top - 0.17, 1.5, top - 0.28); s.lineTo(1.82, top - 0.26);
  s.lineTo(1.86, top - 0.12); s.lineTo(1.8, top); s.lineTo(-1.8, top); s.lineTo(-1.86, top - 0.12); s.lineTo(-1.82, top - 0.26);
  lb.add(extrude(s, 0.17, 0.012, 'koryo', 4), K.red, m4([0, 0, 0], [0, Math.PI / 2, 0]));
  for (const sz of [-1, 1]) lb.add(chamferBox(0.18, 0.2, 0.012, 0.003), K.cap, m4([0, top - 0.13, sz * 1.86]));
  // kaerumata (frog-leg strut) from koryo top to the ridge daito
  const kh = yRB(CW) - 0.18 - 0.11 - 0.14 - top;
  const k = new THREE.Shape();
  k.moveTo(-0.42, 0); k.lineTo(-0.3, 0);
  k.bezierCurveTo(-0.2, kh * 0.45, -0.1, kh * 0.6, -0.07, kh); k.lineTo(0.07, kh);
  k.bezierCurveTo(0.1, kh * 0.6, 0.2, kh * 0.45, 0.3, 0); k.lineTo(0.42, 0);
  k.bezierCurveTo(0.3, kh * 0.55, 0.16, kh * 0.8, 0.12, kh + 0.02); k.lineTo(-0.12, kh + 0.02);
  k.bezierCurveTo(-0.16, kh * 0.8, -0.3, kh * 0.55, -0.42, 0);
  lb.add(extrude(k, 0.11, 0, 'kaeru' + kh.toFixed(3), 3), K.red, m4([0, top, 0], [0, Math.PI / 2, 0]));
  lb.add(rosette(0.045, 6, 0.01, true), K.cap, m4([0.06, top + kh * 0.35, 0], [0, Math.PI / 2, 0]));
  lb.add(rosette(0.045, 6, 0.01, true), K.cap, m4([-0.06, top + kh * 0.35, 0], [0, -Math.PI / 2, 0]));
  lb.add(block(0.26, 0.14, 0.26), K.red, m4([0, top + kh + 0.02, 0]));
  lb.add(armGeo(0.9, 0.11, 0.12, true), K.red, m4([0, top + kh + 0.16, 0]));
  // funahijiki on the column daito, along the run
  for (const sz of [-1, 1]) lb.add(armGeo(1.24, 0.12, 0.13, true), K.red, m4([0, Y_COLTOP + 0.17, sz * COLZ]));
}
function unitColumn(lb, K) {
  lb.add(lathe([[0, -0.05], [0.25, -0.05], [0.25, 0.02], [0.22, 0.05], [0.18, 0.07], [0, 0.07]], 10, 'csos'), K.stoneClean, m4([0, Y_PL, 0]));
  lb.add(new THREE.CylinderGeometry(COL_R, COL_R * 1.02, Y_COLTOP - Y_PL - 0.07, 16, 1), K.col, m4([0, (Y_COLTOP + Y_PL + 0.07) / 2, 0]));
  lb.add(block(0.32, 0.17, 0.32), K.red, m4([0, Y_COLTOP, 0]));
}

// ---------------------------------------------------------------------------
// Corner piece (canonical): corner at the origin; run A extends toward -x,
// run B toward +z; outer quadrant (+x,-z). Includes one bay of each run.
// ---------------------------------------------------------------------------
function cornerPiece(lb, K, bayA, bayB) {
  const W = CW;
  const Lx = COLZ + bayA, Lz = COLZ + bayB;
  // bodies of the two included bays
  body(lb.child(m4([-Lx, 0, 0])), K, bayA);
  body(lb.child(m4([0, 0.003, COLZ], [0, -Math.PI / 2, 0])), K, bayB);
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
  for (const F of faces) {
    const T = tileParams({ ...TILE, p: F.p, phase: F.phase });
    roofPackage(lb, K, [F], T, { rafSp: 0.26 });
  }
  // fascia L's
  const f = CW - TIP - 0.045;
  fascia(lb, K, [[-Lx, -f], [f, -f], [f, Lz]], [0, 0]);
  fascia(lb, K, [[-Lx, f], [-f, f], [-f, Lz]], [0, 0]);
  // ridges: A, B, hip
  const rp = ridgeProfile(0.42, 0.36, 4, 0.08, 0.3);
  lb.add(sweep(linePath([-Lx, 0], [0.12, 0], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), rp), K.tile);
  lb.add(sweep(linePath([0, -0.12], [0, Lz], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), rp), K.tile);
  const hp = ridgeProfile(0.3, 0.26, 3, 0.065, 0.18);
  lb.add(sweep(linePath([0.05, -0.05], [W + 0.03, -W - 0.03], (x, z) => Y0 + prof(W - Math.max(x, -z)) - 0.02, 0.2), hp), K.tile);
  // corner ridge end upturn (江南小青瓦滴水脊头)
  const oy = Y0 - 0.04;
  lb.add(chamferBox(0.22, 0.24, 0.12, 0.015), K.tile, m4([W + 0.06, oy + 0.12, -W - 0.06], [0, Math.PI * 0.75, 0]));
  // valley channel (dark metal)
  lb.add(sweep(linePath([-W, W], [-0.15, 0.15], (x, z) => Y0 + prof(W - Math.min(-x, z)) - 0.035, 0.25), rectProfile(0.14, 0.02)), K.black);
}

// ---------------------------------------------------------------------------
export function buildCorridor(ctx, K, parent) {
  const { geom, L } = ctx;
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
  const addCol = (x, z) => { const k = `${x.toFixed(2)},${z.toFixed(2)}`; if (!colPos.has(k)) colPos.set(k, [x, z]); };
  for (const r of runs) {
    r.n = Math.max(1, Math.round(r.len / 3.6));
    r.bay = r.len / r.n;
    const out = [r.dir[1], -r.dir[0]]; // not used directly; yaw encodes it
    for (let i = 0; i <= r.n; i++) {
      const p = [r.P0[0] + r.dir[0] * r.bay * i, r.P0[1] + r.dir[1] * r.bay * i];
      const isStart = i === 0, isEnd = i === r.n;
      if (i < r.n && i >= r.skip0 && i < r.n - r.skip1) unitM.push(new THREE.Matrix4().compose(new THREE.Vector3(p[0], 0, p[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.yaw), new THREE.Vector3(r.bay / 3.6, 1, 1)));
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
  for (const c of corners) {
    const base = new THREE.Matrix4().makeRotationY(c.yaw).setPosition(c.at[0], 0, c.at[1]);
    const lb = new LB(cb, base, cix);
    cornerPiece(lb, K, c.A, c.B);
    // outer corner column
    const oc = new THREE.Vector3(COLZ, 0, -COLZ).applyMatrix4(base);
    addCol(oc.x, oc.z);
  }
  const cg = cb.build({ name: 'corridorCorners' });
  buildIx(cix, cg);
  parent.add(cg);
  // instanced sets
  const mkInst = (fn, mats, name) => {
    const b = new geom.Builder(); const ix = new Map();
    fn(new LB(b, new THREE.Matrix4(), ix), K);
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
  const t1 = mkInst(unitBay, unitM, 'corridorBay');
  const t2 = mkInst(unitLine, lineM, 'corridorLine');
  const t3 = mkInst(unitColumn, colM, 'corridorColumn');
  console.log(`[buildings] corridor: bays=${unitM.length} lines=${lineM.length} cols=${colM.length} tris~${Math.round((t1 + t2 + t3) / 1000)}k`);
}
