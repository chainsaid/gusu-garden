// ---------------------------------------------------------------------------
// Generic 歇山 hall (columns, walls, bracket sets, eaves, roof) and the
// south gate (楼门), bell tower (钟亭) and side halls built from it.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LB, m4, beamM, chamferBox, block, lathe, lotusFinial, sweep, rectProfile, roundProfile, tileParams, tileCapGeos, makeLift, extrude, hash3, armGeo, ni, kibanaGeo, scrollPlate } from './buildings-kit.js';
import { eaves, bracketSet, column, xieshanRoof, railing, loopPath, linePath, ridgeProfile } from './buildings-arch.js';
import { gap, seg as dseg } from '../core/detail.js';

const V3 = THREE.Vector3;

// ---------------------------------------------------------------------------
// Wall infill of one bay, built in a side frame: x along the side (a..b),
// wall plane z = c, outward +z. Y = { y0, yN (腰枋 bottom), yK (kashira-穿枋 bottom) }
// ---------------------------------------------------------------------------
export function wallBay(lb, K, a, b, c, type, Y, o = {}) {
  if (type === 'open') return;
  const L = b - a, x = (a + b) / 2, t = 0.12;
  const { y0, yN, yK } = Y;
  const lo = !!o.lo;
  // ji-腰枋 (base sill), uchinori-腰枋, both proud of the wall
  lb.box(K.red, L, 0.18, t + 0.08, [x, y0 + 0.09, c], [0, 0, 0], 0.014);
  lb.box(K.red, L, 0.18, t + 0.08, [x, yN + 0.09, c], [0, 0, 0], 0.014);
  // kokabe (plaster above the 腰枋)
  if (yK - (yN + 0.18) > 0.05) lb.box(K.plaster, L, yK - (yN + 0.18), t, [x, (yK + yN + 0.18) / 2, c]);
  const y1 = y0 + 0.18;
  if (type === 'plaster') {
    lb.box(K.plaster, L, yN - y1, t, [x, (yN + y1) / 2, c]);
    // 间柱 vertical stud in long bays
    if (L > 2.6) lb.box(K.red, 0.14, yN - y1, t + 0.04, [x, (yN + y1) / 2, c], [0, 0, 0], 0.01);
  } else if (type === 'window') {
    const yk = y1 + Math.min(0.75, (yN - y1) * 0.36);
    lb.box(K.plaster, L, yk - y1, t, [x, (yk + y1) / 2, c]);
    lb.box(K.red, L, 0.12, t + 0.05, [x, yk + 0.06, c], [0, 0, 0], 0.01);
    const w0 = yk + 0.12, w1 = yN - 0.02;
    const inset = Math.max(0.12, L * 0.14);
    // plaster jambs left/right of the window
    lb.box(K.plaster, inset, w1 - w0, t, [a + inset / 2, (w0 + w1) / 2, c]);
    lb.box(K.plaster, inset, w1 - w0, t, [b - inset / 2, (w0 + w1) / 2, c]);
    const wa = a + inset, wb = b - inset;
    for (const xx of [wa + 0.04, wb - 0.04]) lb.box(K.red, 0.08, w1 - w0, t + 0.04, [xx, (w0 + w1) / 2, c], [0, 0, 0], 0.008);
    lb.box(K.red, wb - wa, 0.06, t + 0.04, [(wa + wb) / 2, w0 + 0.03, c], [0, 0, 0], 0.008);
    const n = Math.floor((wb - wa - 0.16) / 0.12);
    for (let i = 1; i < n; i++) lb.add(chamferBox(0.05, w1 - w0 - 0.06, 0.05, lo ? 0 : 0.006), K.lattice, m4([wa + 0.08 + ((wb - wa - 0.16) * i) / n, (w0 + w1 + 0.06) / 2, c], [0, Math.PI / 4, 0]));
    // dark backing (障子 closed behind the bars)
    lb.box(K.dark, wb - wa, w1 - w0, 0.02, [(wa + wb) / 2, (w0 + w1) / 2, c - 0.05]);
  } else if (type === 'door') {
    // two-leaf door (sankarado style): frame + panels + gold studs, threshold
    const w0 = y1, w1 = yN;
    for (const s of [-1, 1]) {
      const cxp = x + s * L / 4;
      lb.box(K.red, L / 2 - 0.02, w1 - w0, 0.09, [cxp, (w0 + w1) / 2, c], [0, 0, 0], 0.01);
      // raised frame rails
      for (const yy of [w0 + 0.12, w0 + (w1 - w0) * 0.5, w1 - 0.12]) lb.box(K.redDark, L / 2 - 0.1, 0.08, 0.03, [cxp, yy, c + 0.055], [0, 0, 0], 0.008);
      for (const xx of [cxp - L / 4 + 0.07, cxp + L / 4 - 0.07]) lb.box(K.redDark, 0.08, w1 - w0 - 0.1, 0.03, [xx, (w0 + w1) / 2, c + 0.055], [0, 0, 0], 0.008);
      // plain pull plate; structural pins are concealed in the joinery
      if (!lo) lb.box(K.gold, 0.1, 0.24, 0.02, [x + s * 0.06, (w0 + w1) / 2, c + 0.06], [0, 0, 0], 0.004);
    }
  } else if (type === 'lattice') {
    // kongo-goshi: thick vertical bars, low wall below
    const yk = y1 + 0.55;
    lb.box(K.plaster, L, yk - y1, t, [x, (yk + y1) / 2, c]);
    lb.box(K.red, L, 0.1, t + 0.06, [x, yk + 0.05, c], [0, 0, 0], 0.01);
    lb.box(K.red, L, 0.1, t + 0.06, [x, yN - 0.05, c], [0, 0, 0], 0.01);
    const n = Math.floor(L / 0.16);
    for (let i = 1; i < n; i++) lb.box(K.red, 0.07, yN - yk - 0.2, 0.07, [a + (L * i) / n, (yN + yk) / 2, c + 0.02], [0, 0, 0], 0.01);
    lb.box(K.red, L - 0.1, 0.06, 0.06, [x, (yN + yk) / 2, c + 0.06], [0, 0, 0], 0.008);
    lb.box(K.dark, L, yN - yk, 0.03, [x, (yN + yk) / 2, c - 0.25]);
  }
}

// ---------------------------------------------------------------------------
// Generic 歇山 hall. lb in the building frame (origin at ground center).
// ---------------------------------------------------------------------------
export function hallBuilding(lb, K, S) {
  const xs = S.xs, zs = S.zs;
  const cx = Math.max(...xs), cz = Math.max(...zs);
  const colR = S.colR, y0 = S.y0, yct = S.yct;
  const knH = S.knH || 0.27, plH = 0.15;
  const yPlate = yct + plH;
  const lo = !!S.lo;
  const perim = [];
  for (const x of xs) for (const z of zs) if (Math.abs(x) === cx || Math.abs(z) === cz || S.interior) perim.push([x, z]);
  // columns
  for (const [x, z] of perim) {
    column(lb, K, x, z, S.colBase ?? y0, yct, colR, { seg: lo ? 20 : 28, base: S.soseki, baseH: 0.08, bands: S.bands || [{ y: y0, h: 0.14, studs: lo ? 0 : 10 }], lo });
  }
  // kashira-穿枋 + daiwa loops with 木鼻 ends
  for (const s of [-1, 1]) {
    lb.box(K.red, 2 * cx + 0.16, knH, 0.14, [0, yct - knH / 2, s * cz], [0, 0, 0], 0.014);
    lb.box(K.red, 0.14, knH, 2 * cz + 0.16, [s * cx, yct - knH / 2, 0], [0, 0, 0], 0.014);
    lb.box(K.red, 2 * cx + 0.46, plH, 0.26, [0, yPlate - plH / 2, s * cz], [0, 0, 0], 0.014);
    lb.box(K.red, 0.26, plH, 2 * cz + 0.46, [s * cx, yPlate - plH / 2, 0], [0, 0, 0], 0.014);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {

    // carved 木鼻 ends with gold scroll plates
    for (const [px, pz, yaw] of [[sx * cx, sz * cz, sx > 0 ? 0 : Math.PI], [sx * cx, sz * cz, sz > 0 ? -Math.PI / 2 : Math.PI / 2]]) {
      const kb = lb.child(m4([px, yct - knH, pz], [0, yaw, 0]));
      kb.add(kibanaGeo(0.4, knH, 0.14), K.red, m4([0.05, 0, 0]));
      kb.add(scrollPlate(0.055), K.cap, m4([0.3, knH * 0.5, 0.14 / 2 + 0.006]));
      kb.add(scrollPlate(0.055), K.cap, m4([0.3, knH * 0.5, -0.14 / 2 - 0.006], [0, Math.PI, 0]));
    }
  }
  // walls per bay (side frames: front +z, back -z, right +x, left -x)
  const Y = { y0, yN: S.yN ?? (y0 + (yct - knH - y0) * 0.74), yK: yct - knH };
  const sideDefs = [
    { name: 'front', yaw: 0, pos: xs, c: cz }, { name: 'back', yaw: Math.PI, pos: xs, c: cz },
    { name: 'right', yaw: Math.PI / 2, pos: zs, c: cx }, { name: 'left', yaw: -Math.PI / 2, pos: zs, c: cx },
  ];
  for (const sd of sideDefs) {
    const fr = lb.child(m4([0, 0, 0], [0, sd.yaw, 0]));
    const P = [...sd.pos].sort((p, q) => p - q);
    for (let i = 0; i < P.length - 1; i++) {
      const type = S.walls ? S.walls(sd.name, i, P.length - 1) : 'open';
      wallBay(fr, K, P[i] + colR, P[i + 1] - colR, sd.c, type, Y, { lo });
    }
  }
  // bracket sets
  const BS = { ...S.BS, lo: S.lo || S.BS.lo };
  const bsH = BS.daito[1] + BS.tiers * (BS.armH + BS.blockH);
  const sidesB = [
    { pts: xs.map((x) => [x, cz]), yaw: 0 }, { pts: xs.map((x) => [x, -cz]), yaw: Math.PI },
    { pts: zs.map((z) => [cx, z]), yaw: Math.PI / 2 }, { pts: zs.map((z) => [-cx, z]), yaw: -Math.PI / 2 },
  ];
  for (const sb of sidesB) {
    for (let i = 0; i < sb.pts.length; i++) {
      const p = sb.pts[i];
      const isCorner = Math.abs(p[0]) === cx && Math.abs(p[1]) === cz;
      if (!isCorner) bracketSet(lb, m4([p[0], yPlate, p[1]], [0, sb.yaw, 0]), BS);
      if (S.inter !== false && i < sb.pts.length - 1) {
        const q = sb.pts[i + 1];
        const gap = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const n = gap > 3.2 ? 2 : 1;
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1);
          bracketSet(lb, m4([p[0] + (q[0] - p[0]) * t, yPlate, p[1] + (q[1] - p[1]) * t], [0, sb.yaw, 0]), { ...BS, goldDaito: false });
        }
      }
    }
  }
  for (const [sx, sz, yaw] of [[1, 1, 0], [-1, 1, -Math.PI / 2], [-1, -1, Math.PI], [1, -1, Math.PI / 2]]) {
    bracketSet(lb, m4([sx * cx, yPlate, sz * cz], [0, yaw, 0]), { ...BS, corner: true });
  }
  // plaster infill between the bracket sets (closed halls), above the plate
  if (S.infill) {
    const hI = bsH - 0.02;
    for (const s2 of [-1, 1]) {
      lb.box(K.plaster, 2 * cx, hI, 0.08, [0, yPlate + hI / 2, s2 * cz]);
      lb.box(K.plaster, 0.08, hI, 2 * cz, [s2 * cx, yPlate + hI / 2, 0]);
    }
  }
  // eaves
  const ov = S.ov;
  const exT = cx + ov + 0.08, ezT = cz + ov + 0.08;
  const lift = makeLift(exT, ezT, S.liftL ?? 0.4, 0.45, 2.3);
  const yWall = yPlate + bsH + 0.17;
  const E = eaves(lb, {
    cx, cz, ov, yWall, sBase: S.sBase ?? 0.31, d1: S.d1 ?? 0.8, rB: S.rB || [0.095, 0.11], kioiH: 0.09, sFly: 0.18, rF: S.rF || [0.09, 0.1],
    sp: S.sp || 0.25, fasciaH: S.fasciaH || 0.12, proj: BS.proj[BS.proj.length - 1], lift, twoTier: S.twoTier !== false, capGold: false,
    tipOut: S.tipOut, lo,
    K: { rafter: K.rafter, soffit: K.soffit, cap: K.cap, beam: K.beam, rafterCap: K.capPaint },
  });
  // ceiling (open buildings)
  if (S.ceiling) {
    const yC = yWall + 0.13;
    const g = new THREE.PlaneGeometry(2 * cx, 2 * cz).rotateX(Math.PI / 2);
    lb.add(g, S.ceilingMat || K.soffit, m4([0, yC, 0]));
    const nx = Math.max(2, Math.round((2 * cx) / 0.5)), nz = Math.max(2, Math.round((2 * cz) / 0.5));
    for (let i = 0; i <= nx; i++) lb.box(K.black, 0.06, 0.07, 2 * cz, [-cx + (2 * cx * i) / nx, yC - 0.035, 0], [0, 0, 0], 0.006);
    for (let j = 0; j <= nz; j++) lb.box(K.black, 2 * cx, 0.07, 0.06, [0, yC - 0.035, -cz + (2 * cz * j) / nz], [0, 0, 0], 0.006);
    lb.add(sweep(loopPath(cx - 0.1, cz - 0.1, () => yC - 0.12, 0.6), rectProfile(0.12, 0.12), { closed: true, outward: true }), K.red);
  }
  // roof
  const T = tileParams({ p: S.tileP || 0.28, c: 0.27, detail: S.tileDetail ?? 2 });
  const ry0 = E.fasciaTop + T.lip + T.pd;
  const a0 = S.slope0 ?? 0.4;
  const b2 = (S.roofRise - a0 * ezT) / (ezT * ezT);
  const prof = (d) => a0 * d + b2 * d * d;
  const roof = xieshanRoof(lb, {
    ex: exT, ez: ezT, y0: ry0, prof, gd: S.gd ?? Math.min(ezT * 0.42, 2.6), ov: S.ovG ?? 0.6, lift, T,
    K: { tileVC: K.tileVC, tile: K.tile, gold: K.red, red: K.red, soffit: K.soffit, plaster: K.plaster, lattice: K.lattice },
    ridge: S.ridge || { w: 0.62, h: 0.58, layers: 6, capR: 0.11, drop: 0.45 }, hip: S.hip || { w: 0.34, h: 0.34, layers: 4, capR: 0.08, drop: 0.22 },
    chiwen: S.chiwen || { s: 0.9 }, xuanyu: S.xuanyu || S.gegyo || 0.65, hafuH: S.hafuH || 0.38, capGoldMat: K.cap, gableLattice: S.gableLattice ?? true, lo,
  });
  return { E, roof, lift, yWall, cx, cz, exT, ezT };
}

// ---------------------------------------------------------------------------
// SUZHOU CLASSICAL GARDEN SOUTH GATE (姑苏园林南大门 / 照壁砖雕门楼)
// 形制：江南古典私家园林照壁式水磨砖雕门楼 + 单檐卷棚歇山门厅 + 世家黑漆大门
// （青石须弥座抱鼓石、八角雕花木门簪、兽首衔环铜铺首、三叠苏式马头墙、海棠漏窗）
// 彻底去除日本楼门（Rōmon）、八双金物板扉、外挑阳台、连子窗与乳金物泡钉。
// ---------------------------------------------------------------------------
const _dg = new Map();
const dgc = (k, fn) => { let g = _dg.get(k); if (!g) { g = fn(); _dg.set(k, g); } return g; };

// 中式八角兽面衔环铺首底座 (Pushou Base Plate & Beast Face)
function pushouGeo() {
  return dgc('chinese_pushou', () => {
    // 八角形青铜/黄铜底板 (八角菊花座)
    const basePlate = new THREE.CylinderGeometry(0.10, 0.11, 0.016, 8).rotateX(Math.PI / 2);
    // 椒图兽首鼻梁与额顶凸起
    const snout = new THREE.SphereGeometry(0.042, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 0.85, 1.3).translate(0, 0, 0.016);
    // 兽角与眉棱
    const brow = new THREE.BoxGeometry(0.08, 0.024, 0.022).translate(0, 0.028, 0.018);
    return mergeGeometries([ni(basePlate), ni(snout), ni(brow)]);
  });
}

// 中式兽首衔口门环 (Bronze Door Pull Ring)
function pushouRingGeo() {
  return dgc('chinese_pushou_ring', () => {
    return new THREE.TorusGeometry(0.068, 0.013, 10, 24).translate(0, -0.052, 0.022);
  });
}

// 苏式世家黑漆将军门实榻大门 (Jiangnan Black-Lacquer Solid Timber Door Leaves)
function gateLeaf(dl, K, s, dw, dh) {
  const core = 0.08, st = 0.14, lay = 0.018;
  // 厚实黑色大漆门芯基底
  dl.box(K.black, dw, dh, core, [-s * dw / 2, dh / 2, 0], [0, 0, 0], 0.008);
  for (const f of [-1, 1]) {
    const zF = f * (core / 2 + lay / 2);
    const zT = f * (core / 2 + lay); // 门框正面外表面
    // 边梃与抹头框架 (Thick Stiles and Rails)
    dl.box(K.black, st, dh, lay, [-s * st / 2, dh / 2, zF], [0, 0, 0], 0.006); // 吊樘梃 (Hinge stile)
    dl.box(K.black, st, dh, lay, [-s * (dw - st / 2), dh / 2, zF], [0, 0, 0], 0.006); // 边梃 (Meeting stile)
    dl.box(K.black, dw - 2 * st, 0.18, lay, [-s * dw / 2, dh - 0.09, zF], [0, 0, 0], 0.006); // 上抹头
    dl.box(K.black, dw - 2 * st, 0.16, lay, [-s * dw / 2, dh * 0.46, zF], [0, 0, 0], 0.006); // 腰抹头
    dl.box(K.black, dw - 2 * st, 0.24, lay, [-s * dw / 2, 0.12, zF], [0, 0, 0], 0.006); // 下抹头 (裙板抹头)

    // 门心板 (Upper & Lower Flush Panels)
    const pw = dw - 2 * st - 0.02;
    const ph1 = (dh - 0.18) - (dh * 0.46 + 0.08) - 0.02; // 上门心高度
    const ph2 = (dh * 0.46 - 0.08) - 0.24 - 0.02; // 裙板高度
    dl.box(K.redDark, pw, ph1, lay * 0.6, [-s * dw / 2, dh * 0.46 + 0.08 + ph1 / 2, f * (core / 2 + lay * 0.3)], [0, 0, 0], 0.003);
    dl.box(K.redDark, pw, ph2, lay * 0.6, [-s * dw / 2, 0.24 + ph2 / 2, f * (core / 2 + lay * 0.3)], [0, 0, 0], 0.003);

    // 中式铜铺首衔环 (Pushou & Ring Pull)
    const xr = -s * (dw - st / 2 - 0.02);
    const yr = dh * 0.52; // 舒适推门黄金高度 (~1.62m)
    if (f > 0) {
      // 外立面：精工兽首与厚铜门环
      dl.add(pushouGeo(), K.capPaint || K.cap, m4([xr, yr, zT + 0.008]));
      dl.add(pushouRingGeo(), K.bronze || K.cap, m4([xr, yr, zT + 0.008]));
    } else {
      // 内立面：素面铜推板与内扣门环 + 门背后方木门栓
      dl.box(K.cap, 0.12, 0.26, 0.012, [xr, yr, zT - 0.006], [0, 0, 0], 0.003);
      dl.add(pushouRingGeo(), K.bronze || K.cap, m4([xr, yr, zT - 0.008]));
      // 实木门栓木 (Door Bolt on the meeting stile)
      dl.box(K.redDark, 0.48, 0.09, 0.065, [-s * (dw - 0.22), yr - 0.15, -core / 2 - 0.045], [0, 0, 0], 0.006);
    }
  }
}

// 江南古典园林青石雕花抱鼓石 (Sumeru Drum Stone / 门枕石)
function drumStone(lb, K, x, y, z, s) {
  // 1. 下部须弥座 (Sumeru Base)
  lb.box(K.stoneClean, 0.38, 0.12, 0.74, [x, y + 0.06, z], [0, 0, 0], 0.015); // 圭脚
  lb.box(K.stone, 0.32, 0.15, 0.66, [x, y + 0.195, z], [0, 0, 0], 0.01); // 束腰
  lb.box(K.stoneClean, 0.40, 0.12, 0.76, [x, y + 0.33, z], [0, 0, 0], 0.015); // 仰覆莲上枋

  // 2. 上部圆鼓 (Drum Body)
  const drumR = 0.26, drumThick = 0.22;
  const drumY = y + 0.39 + drumR;
  const drumGeo = dgc('gate_drum_body', () => {
    const d = new THREE.CylinderGeometry(drumR, drumR, drumThick, 28).rotateZ(Math.PI / 2);
    // 外侧鼓面螺旋涡纹/回纹浮雕
    const whorl = new THREE.CylinderGeometry(drumR * 0.8, drumR * 0.86, 0.02, 28).rotateZ(Math.PI / 2).translate(s * drumThick * 0.51, 0, 0);
    return mergeGeometries([ni(d), ni(whorl)]);
  });
  lb.add(drumGeo, K.stoneClean, m4([x, drumY, z]));

  // 3. 鼓顶卷云冠 / 卧兽 (Cloud Crest / Mythical Beast)
  lb.box(K.stoneClean, 0.18, 0.14, 0.34, [x, drumY + drumR + 0.06, z + 0.02], [0, 0, 0], 0.02);
  lb.box(K.stoneClean, 0.14, 0.09, 0.22, [x, drumY + drumR + 0.16, z + 0.06], [0, 0, 0], 0.02);

  // 4. 后方锚固门枕石 (Anchor Block into Door Frame)
  lb.box(K.stone, 0.32, 0.68, 0.30, [x, y + 0.36, z - 0.34], [0, 0, 0], 0.01);
}

// 八角形雕花木门簪 (Octagonal Carved Timber Door Pins / 门当)
function menzan(lb, K, x, y, z) {
  const pinGeo = dgc('gate_menzan_pin', () => {
    // 八角柱身
    const pin = new THREE.CylinderGeometry(0.075, 0.075, 0.16, 8).rotateX(Math.PI / 2);
    // 八角端面雕花盖帽
    const cap = new THREE.CylinderGeometry(0.082, 0.082, 0.025, 8).rotateX(Math.PI / 2).translate(0, 0, 0.085);
    return mergeGeometries([ni(pin), ni(cap)]);
  });
  lb.add(pinGeo, K.capPaint || K.cap, m4([x, y, z]));
}

// 苏式水磨青砖砖雕门楼 (Water-Polished Brick-Carving Gate Tower / 字牌门罩)
function brickGateTower(lb, K, y0) {
  const z0 = 0.18; // 突出照墙表面

  // 1. 下枋与垂花挂落 (Bottom Brick Lintel & Hanging Lotus Pendants)
  lb.box(K.stoneClean, 4.5, 0.16, 0.24, [0, 3.82, z0 + 0.10], [0, 0, 0], 0.012);
  // 左右一对水磨青砖垂莲柱 (Hanging Lotus Pendants)
  for (const s of [-1, 1]) {
    const px = s * 2.05;
    // 八角悬柱柱身
    lb.add(new THREE.CylinderGeometry(0.06, 0.065, 0.44, 8), K.stoneClean, m4([px, 3.48, z0 + 0.12]));
    // 垂花莲瓣与莲珠 (Lotus Pod Finial)
    const pod = lathe([[0, -0.14], [0.075, -0.11], [0.085, -0.04], [0.045, 0.02], [0, 0.04]], 16);
    lb.add(pod, K.stoneClean, m4([px, 3.22, z0 + 0.12]));
    // 砖雕倒三角镂空卷草雀替 (Carved Sparrow Braces)
    lb.box(K.stoneClean, 0.38, 0.18, 0.09, [s * 1.82, 3.66, z0 + 0.10], [0, 0, 0], 0.01);
  }
  // 通长砖雕挂落花牙
  lb.box(K.stoneClean, 3.2, 0.08, 0.06, [0, 3.68, z0 + 0.10], [0, 0, 0], 0.008);

  // 2. 题额字牌 "紫气东来" (Calligraphy Plaque "Zi Qi Dong Lai")
  // 外层万字锦纹水磨青砖边框
  lb.box(K.stoneClean, 2.50, 0.78, 0.12, [0, 4.42, z0 + 0.10], [0, 0, 0], 0.015);
  // 凹陷匾额心板
  lb.box(K.stoneClean, 2.22, 0.56, 0.04, [0, 4.42, z0 + 0.16], [0, 0, 0], 0.006);
  // 四字浮雕题额 "紫气东来"
  for (let i = 0; i < 4; i++) {
    const cx = -0.75 + i * 0.50;
    // 题额字块浮雕
    lb.box(K.cap, 0.34, 0.36, 0.016, [cx, 4.42, z0 + 0.185], [0, 0, 0], 0.004);
  }
  // 左右两侧砖雕博风贴面 (Flanking Brick Relief Panels)
  lb.box(K.stoneClean, 0.75, 0.72, 0.10, [-1.75, 4.42, z0 + 0.09], [0, 0, 0], 0.012);
  lb.box(K.stoneClean, 0.75, 0.72, 0.10, [ 1.75, 4.42, z0 + 0.09], [0, 0, 0], 0.012);

  // 3. 仿木水磨砖雕牌科 (Brick Bracket Sets - 一斗三升)
  lb.box(K.stoneClean, 4.6, 0.12, 0.26, [0, 4.88, z0 + 0.12], [0, 0, 0], 0.01);
  const nBrackets = 7;
  for (let i = 0; i < nBrackets; i++) {
    const bx = -1.8 + i * (3.6 / (nBrackets - 1));
    // 栌斗 (Lu Dou)
    lb.box(K.stoneClean, 0.20, 0.08, 0.24, [bx, 4.98, z0 + 0.14], [0, 0, 0], 0.008);
    // 卷草栱 (Gong Arm)
    lb.box(K.stoneClean, 0.44, 0.065, 0.14, [bx, 5.05, z0 + 0.16], [0, 0, 0], 0.008);
    // 三升 (Three Small Sheng Blocks)
    lb.box(K.stoneClean, 0.08, 0.05, 0.12, [bx, 5.11, z0 + 0.16], [0, 0, 0], 0.005);
    lb.box(K.stoneClean, 0.08, 0.05, 0.12, [bx - 0.16, 5.11, z0 + 0.16], [0, 0, 0], 0.005);
    lb.box(K.stoneClean, 0.08, 0.05, 0.12, [bx + 0.16, 5.11, z0 + 0.16], [0, 0, 0], 0.005);
  }

  // 4. 水磨青砖牙砖叠涩出挑 (Corbelled Brick Eaves Courses)
  lb.box(K.stoneClean, 4.7, 0.06, 0.34, [0, 5.18, z0 + 0.18], [0, 0, 0], 0.008);
  lb.box(K.stoneClean, 4.8, 0.06, 0.42, [0, 5.24, z0 + 0.24], [0, 0, 0], 0.008);
  lb.box(K.stoneClean, 4.9, 0.06, 0.50, [0, 5.30, z0 + 0.30], [0, 0, 0], 0.008);
  lb.box(K.stoneClean, 5.0, 0.06, 0.58, [0, 5.36, z0 + 0.36], [0, 0, 0], 0.008);

  // 5. 小青瓦小歇山飞檐门罩 (Little Gable-and-Hip Roof Hood with Flying Rafters)
  // 坡面小青瓦 (Tiled Slope)
  const hoodW = 5.2, hoodD = 0.95;
  lb.box(K.tileVC || K.tile, hoodW, 0.08, hoodD, [0, 5.56, z0 + 0.40], [-0.32, 0, 0], 0.015);
  // 檐口瓦当与滴水 (Eaves Drip Tiles)
  lb.box(K.tile, hoodW + 0.08, 0.045, 0.08, [0, 5.38, z0 + 0.82], [0, 0, 0], 0.008);
  // 两侧嫩戗飞檐起翘 (Upturned Flying Eaves Tips)
  for (const s of [-1, 1]) {
    lb.box(K.tile, 0.22, 0.06, 0.42, [s * (hoodW / 2 + 0.06), 5.46, z0 + 0.78], [-0.22, s * 0.15, s * 0.28], 0.01);
  }
  // 正脊甘草顶与两端鳌鱼吻 (Main Ridge & Chiwen Ends)
  lb.box(K.tile, 4.6, 0.12, 0.15, [0, 5.76, z0 + 0.14], [0, 0, 0], 0.012);
  for (const s of [-1, 1]) {
    lb.box(K.tile, 0.15, 0.22, 0.18, [s * 2.35, 5.88, z0 + 0.14], [0, 0, s * 0.32], 0.015);
  }
}

// ---------------------------------------------------------------------------
// SOUTH GATE: 苏州古典私家园林大门
// 规制：白粉封火山墙照壁 + 水磨青砖砖雕门楼 + 单檐卷棚歇山门厅 + 黑漆世家大门
// （抱鼓石、八角门簪、兽首衔环铜铺首、海棠漏窗、三叠苏式马头墙）
// ---------------------------------------------------------------------------
export function buildGate(ctx, K, lb, anchors, toW) {
  const yP = 0.48; // 台基顶面 (与游廊地面平齐)

  // 1. 实心青石基座与方砖铺地 (Solid Granite Podium & Paved Passage)
  lb.box(K.stone, 11.6, 0.48, 6.2, [0, yP - 0.24, 0], [0, 0, 0], 0.03); // 台基基座
  lb.box(K.stoneClean, 11.8, 0.06, 6.4, [0, yP - 0.03, 0], [0, 0, 0], 0.02); // 压边条石
  // 中央过道规整青石方砖铺地 (Paved Center Walkway)
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 6; j++) {
      lb.box(K.stoneClean, 3.6 / 5 - 0.012, 0.02, 5.8 / 6 - 0.012, [-1.8 + (i + 0.5) * (3.6 / 5), yP + 0.01, -2.9 + (j + 0.5) * (5.8 / 6)], [0, 0, 0], 0.005);
    }
  }

  // 2. 南北青石条石台阶 (South & North Stone Steps)
  for (const [s, zPos] of [[1, 3.1], [-1, -3.1]]) {
    // 3级规整青石条石踏步
    for (let step = 0; step < 3; step++) {
      const stepW = 4.2 - step * 0.15;
      const stepY = yP - 0.16 * (step + 1) + 0.08;
      const stepZ = zPos + s * (0.35 * (step + 1));
      lb.box(K.stoneClean, stepW, 0.16, 0.38, [0, stepY, stepZ], [0, 0, 0], 0.015);
    }
    // 台阶两侧青石垂带石 (Step Side Ramps)
    for (const sx of [-1, 1]) {
      lb.box(K.stoneClean, 0.24, 0.48, 1.25, [sx * 2.22, yP - 0.24, zPos + s * 0.70], [-s * 0.35, 0, 0], 0.02);
    }
  }

  // 3. 门洞与水磨青砖包框 + 青石门槛 (Gate Opening, Jambs & Threshold)
  const doorW = 2.8, doorH = 3.25;
  // 厚实青石门槛 (Solid Stone Threshold)
  lb.box(K.stoneClean, doorW + 0.24, 0.22, 0.28, [0, yP + 0.11, 0], [0, 0, 0], 0.015);
  // 门洞左右水磨青砖立颊框 (Door Jambs)
  for (const s of [-1, 1]) {
    lb.box(K.stoneClean, 0.28, doorH + 0.24, 0.38, [s * (doorW / 2 + 0.14), yP + (doorH + 0.24) / 2, 0], [0, 0, 0], 0.015);
  }
  // 门楣上方红木大枋 (Main Lintel Beam)
  lb.box(K.red, doorW + 0.8, 0.26, 0.28, [0, yP + doorH + 0.13, 0], [0, 0, 0], 0.014);

  // 4. 青石雕花抱鼓石 (Drum Stones / 门枕石)
  for (const s of [-1, 1]) {
    drumStone(lb, K, s * (doorW / 2 + 0.22), yP, 0.36, s);
  }

  // 5. 门楣八角形雕花木门簪 (4 Carved Timber Door Pins / 门当)
  for (const xPin of [-0.88, -0.30, 0.30, 0.88]) {
    menzan(lb, K, xPin, yP + doorH + 0.13, 0.18);
  }

  // 6. 苏式黑漆世家大门 (Jiangnan Black-Lacquer Doors)
  // 双扇大门呈迎客半启 75° 之势，既展现幽深中堂景深，又显露黑漆门面与铜兽首铺首
  const leafW = doorW / 2 - 0.02; // 每扇约 1.38m
  const leafH = doorH - 0.12;
  for (const s of [-1, 1]) {
    const hingeX = s * (doorW / 2);
    const ang = s * Math.PI * 0.42; // ~75度迎客微开
    const dl = lb.child(m4([hingeX, yP + 0.14, -0.06], [0, ang, 0]));
    gateLeaf(dl, K, s, leafW, leafH);
  }

  // 7. 苏式水磨青砖砖雕门楼 (Brick-Carving Gate Tower above Door Opening)
  brickGateTower(lb, K, yP);

  // 8. 东西白粉照墙、海棠漏窗与三叠马头墙 (Whitewashed Firewalls & Matouqiang)
  // 东西两侧照墙 (Plaster Firewall Wings)
  for (const s of [-1, 1]) {
    const wingX = s * (doorW / 2 + 0.28 + (5.2 - (doorW / 2 + 0.28)) / 2);
    const wingW = 5.2 - (doorW / 2 + 0.28);
    // 水磨青砖下碱 (Lower Brick Plinth)
    lb.box(K.stoneClean, wingW, 0.72, 0.38, [wingX, yP + 0.36, 0], [0, 0, 0], 0.012);
    // 白粉墙身 (Whitewashed Plaster Wall Body)
    lb.box(K.plaster, wingW, 4.4, 0.36, [wingX, yP + 0.72 + 2.2, 0]);

    // 次间苏式海棠砖雕透景漏窗 (Ornamental Leak Window)
    const winX = s * 3.4;
    const winY = yP + 2.35;
    // 水磨青砖海棠花外框
    lb.box(K.stoneClean, 1.15, 1.15, 0.40, [winX, winY, 0], [0, 0, 0], 0.02);
    lb.box(K.plaster, 0.92, 0.92, 0.42, [winX, winY, 0]);
    // 镂空万字/冰裂砖格 (Brick Open Lattice)
    for (let k = -2; k <= 2; k++) {
      if (k !== 0) {
        lb.box(K.stoneClean, 0.05, 0.88, 0.05, [winX + k * 0.18, winY, 0]);
        lb.box(K.stoneClean, 0.88, 0.05, 0.05, [winX, winY + k * 0.18, 0]);
      }
    }

    // 东西两端三叠苏式马头墙 (Stepped Matouqiang on East & West Outer Flanks)
    const endX = s * 5.22;
    // 一叠 (Tier 1: y = 4.8m)
    lb.box(K.plaster, 0.38, 4.8, 1.4, [endX, yP + 2.4, -0.6]);
    lb.box(K.tile, 0.44, 0.10, 1.5, [endX, yP + 4.85, -0.6], [0, 0, 0], 0.015);
    // 二叠 (Tier 2: y = 5.6m)
    lb.box(K.plaster, 0.38, 5.6, 1.6, [endX, yP + 2.8, 0]);
    lb.box(K.tile, 0.44, 0.10, 1.7, [endX, yP + 5.65, 0], [0, 0, 0], 0.015);
    // 三叠 (Tier 3: y = 6.3m, 顶峰)
    lb.box(K.plaster, 0.38, 6.3, 1.4, [endX, yP + 3.15, 0.6]);
    lb.box(K.tile, 0.44, 0.10, 1.5, [endX, yP + 6.35, 0.6], [0, 0, 0], 0.015);
    // 起翘马头印斗封头 (Upturned Matou Tips)
    for (const [tz, ty] of [[-1.3, 4.9], [0.8, 5.7], [1.3, 6.4]]) {
      lb.box(K.tile, 0.46, 0.12, 0.22, [endX, yP + ty, tz], [s * 0.25, 0, 0], 0.01);
    }
  }

  // 9. 门厅内部承重圆柱、轩梁与船篷轩天花 (Interior Timber Columns, Arched Ceiling)
  const colXs = [-1.8, 1.8], colZs = [-1.4, 1.4];
  const colR = 0.15;
  const yColTop = yP + 3.55;
  for (const cx of colXs) {
    for (const cz of colZs) {
      // 覆盆青石柱础
      lb.add(lathe([[0, -0.06], [0.28, -0.06], [0.28, 0.02], [0.24, 0.06], [0.18, 0.10], [0, 0.10]], 24), K.stoneClean, m4([cx, yP, cz]));
      // 楠木立柱 (Round Timber Columns)
      lb.add(new THREE.CylinderGeometry(colR, colR * 1.02, yColTop - yP - 0.10, 24), K.col, m4([cx, (yColTop + yP + 0.10) / 2, cz]));
    }
  }
  // 柱间大木穿枋与进深梁 (Tie Beams and Cross Beams)
  for (const cz of colZs) {
    lb.box(K.red, 2 * 1.8 + 0.5, 0.24, 0.16, [0, yColTop - 0.12, cz], [0, 0, 0], 0.012);
  }
  for (const cx of colXs) {
    lb.box(K.red, 0.16, 0.24, 2 * 1.4 + 0.5, [cx, yColTop - 0.12, 0], [0, 0, 0], 0.012);
  }
  // 梁柱交角雕花卷草雀替 (Sparrow Braces)
  for (const cx of colXs) {
    for (const cz of colZs) {
      const sx = cx > 0 ? -1 : 1, sz = cz > 0 ? -1 : 1;
      lb.box(K.red, 0.32, 0.16, 0.12, [cx + sx * 0.16, yColTop - 0.26, cz], [0, 0, 0], 0.008);
      lb.box(K.red, 0.12, 0.16, 0.32, [cx, yColTop - 0.26, cz + sz * 0.16], [0, 0, 0], 0.008);
    }
  }

  // 门厅过道传统船篷轩拱形木构天花 (Barrel-vaulted Boat-Deck Ceiling)
  const yC = yColTop + 0.06;
  const nRibs = 11;
  for (let i = 0; i < nRibs; i++) {
    const rz = -1.4 + (2.8 * i) / (nRibs - 1);
    // 弯椽拱条 (Arched Ribs)
    lb.box(K.redDark, 3.5, 0.07, 0.08, [0, yC + 0.15, rz], [0, 0, 0], 0.006);
  }
  lb.box(K.redDark, 3.6, 0.03, 2.9, [0, yC + 0.20, 0]);

  // 10. 远摄中堂框景挂灯锚点 (Passage Hanging Lantern for Shot 7)
  // 保持北侧 z = -1.3 处的挂灯锚点，与中堂轴线精确对齐
  {
    const z = -1.3, rod = 0.65;
    const yHook = yC + 0.18;
    lb.add(new THREE.CylinderGeometry(0.012, 0.012, rod, 8), K.capPaint || K.cap, m4([0, yHook - rod / 2, z]));
    lb.add(new THREE.CylinderGeometry(0.024, 0.018, 0.03, 12), K.capPaint || K.cap, m4([0, yHook - rod + 0.015, z]));
    lb.box(K.cap, 0.12, 0.02, 0.12, [0, yHook - 0.01, z], [0, 0, 0], 0.004);
    anchors.hangingLanterns.push({ pos: toW([0, yHook - rod, z]), scale: 1.15, rotY: 0 });
  }

  // 11. 门厅单檐歇山小青瓦屋顶 (Single-Eave Xieshan Roof)
  const cx = 4.8, cz = 2.4, ov = 0.85;
  const exT = cx + ov + 0.08, ezT = cz + ov + 0.08;
  const lift = makeLift(exT, ezT, 0.38, 0.42, 2.2);
  const yWall = yColTop + 0.45;
  const E = eaves(lb, {
    cx, cz, ov, yWall, sBase: 0.31, d1: 0.8, rB: [0.09, 0.10], kioiH: 0.08, sFly: 0.16, rF: [0.085, 0.095],
    sp: 0.24, fasciaH: 0.10, proj: 0.80, lift, twoTier: true, capGold: false,
    K: { rafter: K.rafter, soffit: K.soffit, cap: K.cap, beam: K.beam, rafterCap: K.capPaint },
  });

  const T = tileParams({ p: 0.26, c: 0.25, detail: 1 });
  const ry0 = E.fasciaTop + T.lip + T.pd;
  const a0 = 0.38;
  const b2 = (2.1 - a0 * ezT) / (ezT * ezT);
  const prof = (d) => a0 * d + b2 * d * d;
  const roof = xieshanRoof(lb, {
    ex: exT, ez: ezT, y0: ry0, prof, gd: 2.1, ov: 0.55, lift, T,
    K: { tileVC: K.tileVC, tile: K.tile, gold: K.red, red: K.red, soffit: K.soffit, plaster: K.plaster, lattice: K.lattice },
    ridge: { w: 0.54, h: 0.50, layers: 5, capR: 0.10, drop: 0.38 },
    hip: { w: 0.30, h: 0.30, layers: 4, capR: 0.075, drop: 0.20 },
    chiwen: { s: 0.85 }, xuanyu: 0.55, hafuH: 0.32, capGoldMat: K.tile, gableLattice: false, lo: true,
  });

  return { yRidge: roof ? roof.yRidge : yWall + 2.1 };
}

// 钟亭 (bell pavilion) with a Chinese bronze 钟 and its striker
// (was: 钟楼 with a Japanese bonsho — dragon-hook loop, 袈裟襷 ribs and
//  撞座 lotus striking medallions)
// ---------------------------------------------------------------------------
function zhong(lb, K, at, Rb = 0.5, Hb = 1.65) {
  // a Chinese temple bell: a flat crown plate, a broad shoulder that sweeps
  // out to the widest point a third of the way up, then a gentle taper
  const prof = [
    [0, 0.06], [Rb * 0.92, 0.06], [Rb * 0.97, 0.02], [Rb * 1.0, 0], [Rb * 1.02, 0.05], [Rb * 1.0, 0.12], [Rb * 0.97, 0.22],
    [Rb * 0.98, Hb * 0.34], [Rb * 1.0, Hb * 0.5], [Rb * 0.94, Hb * 0.8], [Rb * 0.84, Hb * 0.9], [Rb * 0.68, Hb * 0.96], [Rb * 0.46, Hb * 0.995], [0, Hb],
  ];
  const b = lb.child(m4(at));
  b.add(lathe(prof, 56, 'zhong'), K.bronze);
  // 凸弦: horizontal bands at the shoulder, the waist and the lip
  for (const yy of [0.3, Hb * 0.55, Hb * 0.57, Hb * 0.86]) {
    const r = Rb * (yy < Hb * 0.7 ? 0.965 : 0.93) + 0.012;
    b.add(new THREE.TorusGeometry(r, 0.014, 6, 56).rotateX(Math.PI / 2), K.bronze, m4([0, yy, 0]));
  }
  // 竖线: four vertical panel ribs down the body
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.add(chamferBox(0.05, Hb * 0.86 - 0.32, 0.03, 0.008), K.bronze, m4([Math.sin(a) * (Rb * 0.95 + 0.01), (Hb * 0.86 + 0.32) / 2, Math.cos(a) * (Rb * 0.95 + 0.01)], [0, a, 0]));
  }
  // boss rows in the four upper panels
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * Math.PI * 2 + Math.PI / 4;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const a = a0 + (c - 1.5) * 0.16 + Math.PI / 4;
      const yy = Hb * 0.66 + r * 0.075;
      const rr = Rb * (0.93 - r * 0.004) + 0.005;
      b.add(new THREE.SphereGeometry(0.024, 8, 6), K.bronze, m4([Math.sin(a) * rr, yy, Math.cos(a) * rr]));
    }
  }
  // 撞座: a plain raised striking seat at the lip (no lotus medallion)
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    b.add(new THREE.TorusGeometry(0.1, 0.03, 8, 20).rotateX(Math.PI / 2), K.bronze, m4([Math.sin(a) * (Rb * 0.96), 0.46, Math.cos(a) * (Rb * 0.96)], [0, a, 0]));
  }
  // 钟钮: the loop handle on the crown — two posts and a crossbar
  const hY = Hb + 0.02;
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.032, 0.04, 0.2, 10), K.bronze, m4([s * 0.14, hY + 0.1, 0]));
  b.add(new THREE.CylinderGeometry(0.038, 0.038, 0.34, 10), K.bronze, m4([0, hY + 0.2, 0], [0, 0, Math.PI / 2]));
  b.add(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), K.bronze, m4([0, hY + 0.03, 0]));
}

export function buildBellPavilion(ctx, K, lb, anchors, toW) {
  const yF = 1.3;
  // stone base: two courses + coping + stairs (south)
  lb.box(K.stone, 6.6, 0.7, 6.6, [0, 0.35 - 0.1, 0], [0, 0, 0], 0.04);
  lb.box(K.stone, 6.4, 0.55, 6.4, [0, 0.25 + 0.55 / 2 + 0.25, 0], [0, 0, 0], 0.035);
  lb.box(K.stoneClean, 6.7, 0.14, 6.7, [0, yF - 0.07, 0], [0, 0, 0], 0.03);
  for (let i = 0; i < 6; i++) {
    const y = (i + 1) * (yF / 6);
    lb.box(K.stoneClean, 2.2, 0.08, 0.36, [0, y - 0.04, 3.35 + (5 - i) * 0.32 + 0.16], [0, 0, 0], 0.015);
    lb.box(K.stone, 2.2, y - 0.08, 0.34, [0, (y - 0.08) / 2, 3.35 + (5 - i) * 0.32 + 0.16], [0, 0, 0], 0.015);
  }
  const H = hallBuilding(lb, K, {
    xs: [-1.95, 1.95], zs: [-1.95, 1.95], colR: 0.22, y0: yF, yct: yF + 4.1, knH: 0.26,
    walls: () => 'open', soseki: true,
    BS: { tiers: 3, proj: [0.42, 0.8], armH: 0.14, armW: 0.12, blockH: 0.11, daito: [0.34, 0.19], mak: [0.18, 0.11], wall: [0.85, 1.05, 1.25], inner: true, K: { wood: K.red, gold: K.red } },
    ov: 1.9, liftL: 0.45, roofRise: 2.7, gd: 1.7, ovG: 0.5, tileP: 0.26, tileDetail: 1, lo: true,
    ridge: { w: 0.56, h: 0.5, layers: 5, capR: 0.1, drop: 0.4 }, hip: { w: 0.3, h: 0.3, layers: 3, capR: 0.07, drop: 0.2 }, chiwen: { s: 0.8 }, xuanyu: 0.55, hafuH: 0.34,
    ceiling: true, ceilingMat: K.ceilingBell,
    bands: [{ y: yF, h: 0.15, studs: 10 }, { y: yF + 4.1 - 0.26 - 0.12, h: 0.1 }],
  });
  for (const h of H.E.hooks) anchors.bells.push({ pos: toW(h.local), scale: 1.0, rotY: 0 });
  // 穿枋 between columns at mid height + hanging beam for the bell
  for (const s of [-1, 1]) {
    lb.box(K.red, 3.9 + 0.5, 0.2, 0.12, [0, yF + 2.6, s * 1.95], [0, 0, 0], 0.012);
    lb.box(K.red, 0.12, 0.2, 3.9 + 0.5, [s * 1.95, yF + 2.6, 0], [0, 0, 0], 0.012);
  }
  const yHang = yF + 3.35;
  lb.box(K.red, 3.9, 0.26, 0.26, [0, yHang + 0.13, 0], [0, 0, 0], 0.02);
  lb.box(K.cap, 0.3, 0.3, 0.3, [0, yHang + 0.13, 0], [0, 0, 0], 0.01);
  lb.add(new THREE.TorusGeometry(0.09, 0.025, 8, 16), K.black, m4([0, yHang - 0.07, 0]));
  // the 钟
  const Hb = 1.8;
  zhong(lb, K, [0, yHang - 0.16 - Hb - 0.24, 0], 0.56, Hb);
  // striker (木槌) hung on ropes, pointing at the bell along x
  const ys = yHang - 0.16 - Hb - 0.24 + 0.5;
  const sx0 = 0.68, sl = 1.32;
  lb.add(new THREE.CylinderGeometry(0.11, 0.115, sl, 18, 1), K.woodRaw, m4([sx0 + sl / 2, ys, 0], [0, 0, Math.PI / 2]));
  lb.add(new THREE.CylinderGeometry(0.118, 0.118, 0.04, 18), K.black, m4([sx0 + 0.03, ys, 0], [0, 0, Math.PI / 2]));
  const rope = (a, b) => { const { m, len } = beamM(a, b, [1, 0, 0]); lb.add(new THREE.CylinderGeometry(0.014, 0.014, len, 6).rotateZ(Math.PI / 2), K.rope, m); };
  const yRB = yF + 4.1 - 0.26 - 0.09;
  for (const x of [sx0 + 0.25, sx0 + sl - 0.25]) {
    rope([x, ys + 0.11, 0], [x, yRB - 0.08, 0.55]);
    rope([x, ys + 0.11, 0], [x, yRB - 0.08, -0.55]);
    lb.box(K.red, 0.14, 0.16, 3.9, [x, yRB, 0], [0, 0, 0], 0.01);
  }
  lb.add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), K.rope, m4([sx0 + sl + 0.1, ys - 0.22, 0], [0, 0, 0.3]));
}

// ---------------------------------------------------------------------------
// 抱厦 (baosha) — [已停用·当前无调用] 见 buildSideHall :811：其「独立两柱+横梁+卷棚
// 小顶」读作鸟居，实为日式向拜/唐破风残留，江南厅前不设此制，故阶前抱厦已删除。
// (原注释) a step canopy on two posts in front of a hall: a
// straight-eaved lean-to roof whose front line is almost level and turns UP at
// the two ends, with a plain ridge.
// o = { W (roof half width), zb, zf (back / front of the roof), yE (side eave),
//       H (front rise), postX, postZ, yTop (post top), zWall (front wall face) }
// (was: karaKohai / 向拜(已移除) with a 唐破风(已移除) — a bell-curved convex crest with
//  concave flanks, which is a Japanese-only roof form)
// ---------------------------------------------------------------------------
function baosha(lb, K, o) {
  const { W, zb, zf, yE, H, postX, postZ, yTop, zWall } = o;
  // 中式檐口线：中间平直、两端起翘。u = |x|/W.
  const prof = (x) => {
    const u = Math.min(Math.abs(x) / W, 1);
    return yE + H * (0.10 * (1 - u) * (1 - u) + 0.90 * Math.pow(u, 3.0));
  };
  const cut = 0.1; // roof slab thickness
  // posts on stone bases, curved tie beams (虹梁) back to the wall
  for (const s of [-1, 1]) {
    const x = s * postX;
    lb.add(lathe([[0, -0.1], [0.28, -0.1], [0.28, 0.04], [0.25, 0.09], [0.2, 0.12], [0, 0.12]], 20, 'khbase'), K.stoneClean, m4([x, 0, postZ]));
    lb.add(new THREE.CylinderGeometry(0.155, 0.16, yTop - 0.12, 24, 1), K.col, m4([x, (yTop + 0.12) / 2, postZ]));
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new V3(x, yTop - 0.06 + 0.22 * Math.sin(t * Math.PI * 0.5) * t, postZ + (zWall - postZ) * t)); }
    lb.add(sweep(pts, rectProfile(0.12, 0.2, -0.2)), K.red);
    lb.add(block(0.32, 0.17, 0.32), K.red, m4([x, yTop, postZ]));
    lb.box(K.cap, 0.27, 0.08, 0.008, [x, yTop + 0.11, postZ + 0.164], [0, 0, 0], 0.002);
  }
  // 额枋 across the front, with a raised centre
  {
    const L = postX + 0.32, pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const x = -L + 2 * L * t; pts.push(new V3(x, yTop + 0.17 + 0.07 * Math.sin(Math.PI * t), postZ)); }
    lb.add(sweep(pts, rectProfile(0.15, 0.3, -0.3)), K.red);
    for (const s of [-1, 1]) {
      lb.box(K.cap, 0.3, 0.31, 0.16, [s * (L - 0.14), yTop + 0.02, postZ], [0, 0, 0], 0.004);
    }
  }
  // 荷叶墩 (bearing block) on the beam centre carrying the ridge beam
  const yBeamTop = yTop + 0.24;
  const yRidgeB = prof(0) - cut - 0.2;
  {
    const h = yRidgeB - yBeamTop, w = Math.min(1.2, W * 0.5);
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.bezierCurveTo(-w * 0.42, h * 0.55, -w * 0.12, h * 0.55, -w * 0.09, h * 0.8);
    s.lineTo(-w * 0.12, h); s.lineTo(w * 0.12, h); s.lineTo(w * 0.09, h * 0.8);
    s.bezierCurveTo(w * 0.12, h * 0.55, w * 0.42, h * 0.55, w / 2, 0);
    s.lineTo(w * 0.32, 0);
    s.bezierCurveTo(w * 0.26, h * 0.35, w * 0.1, h * 0.38, 0, h * 0.42);
    s.bezierCurveTo(-w * 0.1, h * 0.38, -w * 0.26, h * 0.35, -w * 0.32, 0);
    s.lineTo(-w / 2, 0);
    lb.add(extrude(s, 0.12, 0.012, null, 8), K.red, m4([0, yBeamTop, postZ]));
    lb.box(K.red, 0.3, 0.12, 0.3, [0, yRidgeB - 0.06, postZ], [0, 0, 0], 0.01);
  }
  // crest beam + side purlins along z (carry the roof)
  lb.box(K.red, 0.16, 0.2, zf - zb - 0.1, [0, yRidgeB + 0.1, (zb + zf) / 2], [0, 0, 0], 0.012);
  for (const s of [-1, 1]) {
    const xp = s * (postX + 0.05);
    lb.box(K.red, 0.16, 0.2, zf - zb - 0.1, [xp, prof(xp) - cut - 0.1, (zb + zf) / 2], [0, 0, 0], 0.012);
  }
  // roof slab: tiled top, soffit below (bell-curved section extruded along z)
  {
    const nx = 40, x0 = -W - 0.04, x1 = W + 0.04;
    const top = [], bot = [], nt = [], nb = [];
    const slope = (x) => (prof(x + 1e-3) - prof(x - 1e-3)) / 2e-3;
    for (let i = 0; i < nx; i++) {
      const xa = x0 + ((x1 - x0) * i) / nx, xb = x0 + ((x1 - x0) * (i + 1)) / nx;
      const ya = prof(xa), yb = prof(xb);
      const na = new V3(-slope(xa), 1, 0).normalize(), nB = new V3(-slope(xb), 1, 0).normalize();
      top.push(xa, ya, zb, xb, yb, zf, xb, yb, zb, xa, ya, zb, xa, ya, zf, xb, yb, zf);
      nt.push(...na.toArray(), ...nB.toArray(), ...nB.toArray(), ...na.toArray(), ...na.toArray(), ...nB.toArray());
      bot.push(xa, ya - cut, zb, xb, yb - cut, zb, xb, yb - cut, zf, xa, ya - cut, zb, xb, yb - cut, zf, xa, ya - cut, zf);
      const da = na.clone().negate(), dB = nB.clone().negate();
      nb.push(...da.toArray(), ...dB.toArray(), ...dB.toArray(), ...da.toArray(), ...dB.toArray(), ...da.toArray());
    }
    const mk = (arr, nrm) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(arr.length / 3 * 2), 2)); return g; };
    lb.add(mk(top, nt), K.tile); lb.add(mk(bot, nb), K.soffit);
    // rafters under the flanks
    for (let z = zb + 0.12; z < zf - 0.05; z += 0.24) for (const s of [-1, 1]) {
      const xa = s * (postX - 0.2), xb = s * (W - 0.02);
      const a = [xa, prof(xa) - cut - 0.05, z], b = [xb, prof(xb) - cut - 0.05, z];
      const { m, len } = beamM(a, b, [0, 1, 0]);
      lb.add(chamferBox(len, 0.08, 0.07, 0), K.rafter || K.red, m);
    }
  }
  // round-tile ribs running down both flanks, with plain end caps
  const [cd, cg] = tileCapGeos(0.062, 1);
  for (let z = zb + 0.14; z < zf - 0.06; z += gap(0.27)) {
    const pts = [];
    for (let i = 0; i <= dseg(36, 8); i++) { const x = -W + (2 * W * i) / dseg(36, 8); pts.push(new V3(x, prof(x) + 0.03, z)); }
    lb.add(sweep(pts, roundProfile(0.062, 0, 6), { smooth: true }), K.tile);
    for (const s of [-1, 1]) lb.add(cd, K.tile, m4([s * (W + 0.005), prof(W) + 0.03, z], [0, s * Math.PI / 2, 0])), lb.add(cg, K.cap, m4([s * (W + 0.005), prof(W) + 0.03, z], [0, s * Math.PI / 2, 0]));
  }
  // crest ridge along z
  lb.add(sweep(linePath([0, zb], [0, zf + 0.06], () => prof(0) + 0.02, 0.3), ridgeProfile(0.3, 0.2, 2, 0.075, 0.08)), K.tile);
  // side eave fascia
  for (const s of [-1, 1]) lb.add(sweep(linePath([s * (W + 0.02), zb], [s * (W + 0.02), zf + 0.04], () => prof(W) - cut - 0.02, 0.4), rectProfile(0.05, 0.13)), K.red);
  // 博风板 (bargeboard) along the front: oiled wood, no gilt edging
  {
    const pts = [];
    for (let i = 0; i <= 48; i++) { const x = -W - 0.06 + ((2 * W + 0.12) * i) / 48; pts.push(new V3(x, prof(x) + 0.05, zf + 0.04)); }
    lb.add(sweep(pts, rectProfile(0.07, 0.3, -0.3)), K.red);
    // plain timber end blocks; fixings are concealed mortise-and-tenon pins
    lb.box(K.cap, 0.36, 0.3, 0.09, [0, prof(0) - 0.1, zf + 0.04], [0, 0, 0], 0.01);
    for (const s of [-1, 1]) {
      lb.box(K.cap, 0.3, 0.32, 0.09, [s * (W - 0.08), prof(W) - 0.1, zf + 0.04], [0, 0, 0], 0.01);
    }
  }
  // 山墙 behind the bargeboard (above the 额枋)
  {
    const s = new THREE.Shape();
    const xa = W - 0.3, n = 24;
    s.moveTo(-xa, yBeamTop - 0.02);
    for (let i = 0; i <= n; i++) { const x = -xa + (2 * xa * i) / n; s.lineTo(x, prof(x) - cut - 0.02); }
    s.lineTo(xa, yBeamTop - 0.02); s.lineTo(-xa, yBeamTop - 0.02);
    lb.add(extrude(s, 0.04, 0, null, 2), K.plaster, m4([0, 0, zf - 0.2]));
  }
  return { prof, yBeamTop };
}

// ---------------------------------------------------------------------------
// SIDE HALL
// ---------------------------------------------------------------------------
export function buildSideHall(ctx, K, lb, anchors, toW, spec) {
  const nb = spec.w >= 13 ? 5 : 4;
  const bw = spec.w >= 13 ? 2.2 : 2.35;
  const xs = []; for (let i = 0; i <= nb; i++) xs.push(+(-nb * bw / 2 + i * bw).toFixed(3));
  const nd = 3, bd = spec.d >= 9 ? 2.1 : 1.95;
  const zs = []; for (let i = 0; i <= nd; i++) zs.push(+(-nd * bd / 2 + i * bd).toFixed(3));
  const cx = xs[xs.length - 1], cz = zs[zs.length - 1];
  const yF = 0.62;
  // 台基 (podium) with coping and front steps
  lb.box(K.stone, 2 * cx + 2.2, 0.6, 2 * cz + 2.2, [0, yF / 2 - 0.08, 0], [0, 0, 0], 0.04);
  lb.box(K.stoneClean, 2 * cx + 2.3, 0.1, 2 * cz + 2.3, [0, yF - 0.05, 0], [0, 0, 0], 0.025);
  for (let i = 0; i < 3; i++) {
    const y = (i + 1) * (yF / 3);
    lb.box(K.stoneClean, bw * 1.6, y, 0.34, [0, y / 2, cz + 1.15 + (2 - i) * 0.32 + 0.17], [0, 0, 0], 0.015);
  }
  const mid = Math.floor(nb / 2);
  // wooden veranda (檐廊) on the front with a 栏杆 railing (gap at the steps)
  {
    const vz0 = cz + 0.2, vz1 = cz + 1.05, vy = yF + 0.06;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const z = vz0 + ((vz1 - vz0) * (i + 0.5)) / n;
      lb.box(spec.facing[0] !== 0 ? K.floorZ : K.floorX, 2 * cx + 1.0, 0.04, (vz1 - vz0) / n - 0.006, [0, vy - 0.02, z], [0, 0, 0], 0.003);
    }
    lb.box(K.redDark, 2 * cx + 1.04, 0.16, 0.1, [0, vy - 0.1, vz1], [0, 0, 0], 0.01);
    const sw = bw * 0.8;
    const rx = cx + 0.45, rz = vz1 - 0.06;
    railing(lb, [[-sw, rz], [-rx, rz], [-rx, vz0 + 0.05]], vy, { H: 0.72, post: 0.11, spacing: 1.5, midY: 0.4, gibSeg: 16, lo: true, panelGold: false, K: { red: K.red, redDark: K.redDark, gold: K.red, gib: K.gib } });
    railing(lb, [[sw, rz], [rx, rz], [rx, vz0 + 0.05]], vy, { H: 0.72, post: 0.11, spacing: 1.5, midY: 0.4, gibSeg: 16, lo: true, panelGold: false, K: { red: K.red, redDark: K.redDark, gold: K.red, gib: K.gib } });
  }
  const H = hallBuilding(lb, K, {
    xs, zs, colR: 0.2, y0: yF, yct: yF + 3.55, knH: 0.26,
    walls: (side, i, n) => {
      if (side === 'front') return (n % 2 === 1 && i === mid) || (n % 2 === 0 && (i === n / 2 - 1 || i === n / 2)) ? 'door' : 'window';
      if (side === 'back') return i === 0 || i === n - 1 ? 'plaster' : 'window';
      return 'window';
    },
    BS: { tiers: 3, proj: [0.42, 0.8], armH: 0.14, armW: 0.12, blockH: 0.11, daito: [0.32, 0.19], mak: [0.18, 0.11], wall: [0.85, 1.05, 1.2], inner: false, goldCaps: false, goldMak: false, goldDaito: false, K: { wood: K.red, gold: K.red } },
    ov: 1.9, liftL: 0.42, roofRise: spec.w >= 13 ? 3.6 : 3.2, ovG: 0.6, tileP: 0.28, tileDetail: 1,
    chiwen: { s: 0.85 }, lo: true, gableLattice: true, infill: true,
  });
  for (const h of H.E.hooks) anchors.bells.push({ pos: toW(h.local), scale: 0.9, rotY: 0 });
  // 厅前不设独立两柱抱厦：原 baosha 为日式唐破风「向拜」残留（见 baosha 注释
  // "was: karaKohai / 向拜 with 唐破风"），其「独立两柱 + 横梁 + 卷棚小顶」读作鸟居。
  // 江南厅堂前制为「厅堂出檐 + 前檐廊(带栏杆) + 台阶」，前檐廊已在上方 :785 建成、
  // 且厅堂出檐 ov=1.9 已罩住廊深 0.85，故删除阶前这一独立两柱小顶。
  // lanterns under the front eave, one per bay (a rhythm of lanterns along the eaves)
  for (let i = 0; i < nb; i++) {
    const x = (xs[i] + xs[i + 1]) / 2;
    const d = 0.9, zl = cz + 1.9 - d;
    const yr = H.E.yBB(d) + H.lift(x, zl);
    lb.add(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), K.gold, m4([x, yr - 0.15, zl]));
    anchors.hangingLanterns.push({ pos: toW([x, yr - 0.3, zl]), scale: 0.95, rotY: 0 });
  }
}
