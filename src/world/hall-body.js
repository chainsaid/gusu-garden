// ---------------------------------------------------------------------------
// hall-body: stone podium (台基), stairs, columns, walls & facades,
// veranda (en) with railings, interior floor/ceiling shell, upper storey,
// bracket-set placement. Hall-local coordinates.
// ---------------------------------------------------------------------------
import { cbox, beam, lathe, extrude, sweep, bar, xf, basis, mul, v3, clamp, lerp, sstep } from './hall-lib.js';
import { lotusFinial } from "./hall-orn.js";
import { bracketSet, bracketBeams } from './hall-bracket.js';
import { hinge, pullRing } from './hall-detail.js';

export const HB = {
  pod: { hx: 18, hz: 13.5, h: 1.6 },
  colX: [-13, -9.2857, -5.5714, -1.8571, 1.8571, 5.5714, 9.2857, 13],
  colZ: [-8.5, -5.1, -1.7, 1.7, 5.1, 8.5],
  colR: 0.32, colBase: 1.6, colTop: 8.0,
  floorY: 2.1, ceilY: 9.2,
  ver: { x: 15.4, z: 10.9 },
  up: { xs: [-9.2857, -5.5714, -1.8571, 1.8571, 5.5714, 9.2857], zs: [-4.8, -1.6, 1.6, 4.8], r: 0.27, top: 12.9, base: 10.4 },
  stair: { hw: 5.0, rise: 0.16, run: 0.31, n: 10, sideW: 0.8 },
  frontSteps: { z0: 10.9, n: 3, run: 0.28 },
};

// ------------------------------------------------------------------ podium
export function buildPodium(acc, mats, R) {
  const { hx, hz, h } = HB.pod;
  const g = acc.m(mats.granite), gm = acc.m(mats.graniteMoss), gc = acc.m(mats.stone);
  const courses = [
    { y0: 0, y1: 0.24, proj: 0.07, ms: gm, lmin: 0.9, lmax: 1.5 },
    { y0: 0.24, y1: 0.62, proj: 0, ms: gm, lmin: 0.8, lmax: 1.7 },
    { y0: 0.62, y1: 1.0, proj: 0, ms: g, lmin: 0.8, lmax: 1.7 },
    { y0: 1.0, y1: 1.36, proj: 0, ms: g, lmin: 0.8, lmax: 1.7 },
    { y0: 1.36, y1: 1.6, proj: 0.06, ms: g, lmin: 1.1, lmax: 2.0, coping: true },
  ];
  const stairHole = HB.stair.hw + HB.stair.sideW + 0.02;
  // each side: run along the edge
  const sides = [
    { o: [0, 0, 1], t: [1, 0, 0], e: hz, L: hx },
    { o: [0, 0, -1], t: [-1, 0, 0], e: hz, L: hx },
    { o: [1, 0, 0], t: [0, 0, -1], e: hx, L: hz },
    { o: [-1, 0, 0], t: [0, 0, 1], e: hx, L: hz },
  ];
  for (const S of sides) {
    const front = S.o[2] === 1;
    for (const [ci, C] of courses.entries()) {
      const depth = C.coping ? 0.55 : 0.45;
      let a = -S.L - C.proj + (ci % 2 ? R.range(0.2, 0.6) : 0);
      const aEnd = S.L + C.proj;
      // first block starts flush at the corner
      let first = true;
      a = -S.L - C.proj;
      while (a < aEnd - 0.01) {
        let len = first && ci % 2 ? R.range(C.lmin * 0.5, C.lmin) : R.range(C.lmin, C.lmax);
        first = false;
        let b = Math.min(a + len, aEnd);
        if (aEnd - b < 0.35) b = aEnd;
        // stair opening at the front
        if (front && b > -stairHole && a < stairHole) {
          if (a < -stairHole) b = -stairHole; else { a = stairHole; continue; }
        }
        const mid = (a + b) / 2, hl = (b - a) / 2 - 0.004;
        const outOff = R.range(-0.006, 0.01);
        const e = S.e + C.proj - depth / 2 + outOff;
        const yaw = R.range(-0.003, 0.003);
        const c = [S.t[0] * mid + S.o[0] * e, (C.y0 + C.y1) / 2, S.t[2] * mid + S.o[2] * e];
        const ax = S.t, az = S.o;
        const M = mul(basis(c, ax, [0, 1, 0], az), xf([0, 0, 0], yaw));
        cbox(C.ms, M, hl, (C.y1 - C.y0) / 2 - 0.003, depth / 2, C.coping ? 0.035 : 0.028);
        a = b;
      }
    }
  }
  // hidden fill
  cbox(g, xf([0, 0.78, 0]), hx - 0.4, 0.78, hz - 0.4, 0, { skip: new Set(['-y']) });
  // top paving: strip from coping inward to the wall line (and under veranda)
  const pv = (x0, x1, z0, z1, sw, sd, along) => {
    // slabs in rows; along = 'x' rows run in x
    const A0 = along === 'x' ? x0 : z0, A1 = along === 'x' ? x1 : z1;
    const B0 = along === 'x' ? z0 : x0, B1 = along === 'x' ? z1 : x1;
    let bb = B0, row = 0;
    while (bb < B1 - 0.05) {
      const be = Math.min(bb + sd, B1);
      let aa = A0 + (row % 2 ? -sw * 0.5 : 0);
      while (aa < A1 - 0.05) {
        const ae = Math.min(aa + sw * R.range(0.8, 1.25), A1);
        const a0 = Math.max(aa, A0);
        if (ae - a0 > 0.08) {
          const cA = (a0 + ae) / 2, cB = (bb + be) / 2;
          const c = along === 'x' ? [cA, 1.6 - 0.06 + R.range(-0.004, 0.003), cB] : [cB, 1.6 - 0.06 + R.range(-0.004, 0.003), cA];
          const hA = (ae - a0) / 2 - 0.006, hB = (be - bb) / 2 - 0.006;
          cbox(gc, xf(c, R.range(-0.003, 0.003)), along === 'x' ? hA : hB, 0.06, along === 'x' ? hB : hA, 0.018);
        }
        aa = ae;
      }
      bb = be; row++;
    }
  };
  const cz = hz - 0.55, cx = hx - 0.55;
  pv(-cx, cx, 8.6, cz, 0.95, 0.62, 'x');
  pv(-cx, cx, -cz, -8.6, 0.95, 0.62, 'x');
  pv(13.1, cx, -8.6, 8.6, 0.95, 0.62, 'z');
  pv(-cx, -13.1, -8.6, 8.6, 0.95, 0.62, 'z');
  // drip-line cobbles under the lower eaves: rounded stones in a shallow channel
  const dripMs = acc.m(mats.graniteMoss);
  const drip = (p0, p1) => {
    const L = v3.len(v3.sub(p1, p0)); const n = Math.floor(L / 0.16);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; const p = v3.lerp(p0, p1, t);
      for (const off of [-0.09, 0.09]) {
        const dir = v3.norm(v3.sub(p1, p0)); const side = [-dir[2], 0, dir[0]];
        const q = v3.add(p, v3.scale(side, off + R.range(-0.025, 0.025)));
        const r = R.range(0.055, 0.08);
        lathe(dripMs, xf([q[0], 1.6 - 0.02, q[2]], R.range(0, 6), 0, 0, [1, R.range(0.45, 0.6), R.range(0.75, 1.1)]), [[0, 0], [r, 0], [r * 0.95, r * 0.5], [r * 0.6, r * 0.9], [0, r]], 7);
      }
    }
  };
  drip([-16.8, 0, 12.3], [-stairHole, 0, 12.3]); drip([stairHole, 0, 12.3], [16.8, 0, 12.3]);
  drip([-16.8, 0, -12.3], [16.8, 0, -12.3]);
  drip([16.8, 0, -12.2], [16.8, 0, 12.2]); drip([-16.8, 0, -12.2], [-16.8, 0, 12.2]);
}

// ------------------------------------------------------------------ stairs
export function buildStairs(acc, mats, R) {
  const S = HB.stair;
  const gc = acc.m(mats.stone), g = acc.m(mats.granite), gm = acc.m(mats.graniteMoss);
  const z0 = HB.pod.hz; // top edge of main stair at podium front
  for (let i = 1; i <= S.n; i++) {
    const yTop = S.rise * i;
    const zf = z0 + (S.n - i) * S.run;
    // split into stones
    let a = -S.hw; const cuts = [];
    while (a < S.hw - 0.01) { let b = Math.min(a + R.range(1.7, 3.0), S.hw); if (S.hw - b < 0.8) b = S.hw; cuts.push([a, b]); a = b; }
    for (const [a0, a1] of cuts) {
      const d = S.run + 0.12;
      cbox(gc, xf([(a0 + a1) / 2, yTop / 2 - 0.0, zf - d / 2 + 0.02], R.range(-0.002, 0.002)), (a1 - a0) / 2 - 0.004, yTop / 2, d / 2, 0.022);
    }
  }
  // side walls (袖石) + end posts
  for (const sx of [-1, 1]) {
    const x0 = sx * S.hw, x1 = sx * (S.hw + S.sideW);
    const zTop = z0, zBot = z0 + (S.n - 1) * S.run + 0.15;
    const yT = HB.pod.h + 0.32, yB = 0.5;
    // sloped wall as extruded profile in (z,y)
    const prof = [[zTop - 0.1, 0], [zBot, 0], [zBot, yB], [zTop, yT], [zTop - 0.1, yT]];
    const X = basis([Math.min(x0, x1), 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0]);
    extrude(g, X, prof, [], 0, S.sideW);
    // coping along slope
    const pA = [(x0 + x1) / 2, yT + 0.06, zTop - 0.05], pB = [(x0 + x1) / 2, yB + 0.06, zBot];
    beam(gc, pA, pB, S.sideW + 0.08, 0.13, 0.03);
    // bottom post
    // low plinth under the vermilion newel post (hall.js / hall-stair.js)
    cbox(gm, xf([(x0 + x1) / 2, 0.235, zBot + 0.14]), S.sideW / 2 + 0.06, 0.235, 0.27, 0.04);
    cbox(gc, xf([(x0 + x1) / 2, 0.475, zBot + 0.14]), S.sideW / 2 + 0.1, 0.03, 0.31, 0.02);
  }
  // 苏式青石台阶（直通大殿门庭，取代原日式木台阶）
  const F = HB.frontSteps;
  const stone = acc.m(mats.stone), granite = acc.m(mats.granite);
  for (let j = 1; j <= F.n; j++) {
    const y = HB.pod.h + ((HB.floorY - HB.pod.h) * j) / F.n;
    const zf = F.z0 + (F.n - j + 1) * F.run;
    // 整块青石踏步面
    cbox(stone, xf([0, y - 0.05, zf - F.run / 2]), S.hw - 0.15, 0.05, F.run / 2 + 0.02, 0.015);
    // 青石踢脚垂直立板
    cbox(granite, xf([0, (y - 0.1 + HB.pod.h) / 2, zf - 0.01]), S.hw - 0.18, (y - 0.1 - HB.pod.h) / 2 + 0.001, 0.03, 0.01);
  }
  // 两侧青石垂带石与抱鼓石基础 (Stone plinths & balustrade runners)
  for (const sx of [-1, 1]) {
    const x = sx * (S.hw - 0.08);
    // 倾斜石质垂带
    beam(stone, [x, HB.floorY + 0.04, F.z0 - 0.04], [x, HB.pod.h + 0.12, F.z0 + F.n * F.run + 0.12], 0.18, 0.28, 0.02);
    // 垂带底端青石抱鼓石台座
    cbox(granite, xf([x, HB.pod.h + 0.24, F.z0 + F.n * F.run + 0.22]), 0.14, 0.24, 0.22, 0.03);
    lathe(stone, xf([x, HB.pod.h + 0.52, F.z0 + F.n * F.run + 0.22], 0, 0, Math.PI / 2), [[0, -0.06], [0.16, -0.06], [0.18, 0], [0.16, 0.06], [0, 0.06]], 16);
  }
}

// --------------------------------------------------------------- railings
// generic railing (苏式勾栏/寻杖栏杆) between posts along a polyline of post positions
// (each [x, yBase, z]); 中式素方覆斗顶与仰覆莲柱头，无日式拟宝珠
export function railing(acc, mats, posts, opts = {}) {
  const red = acc.m(mats.red), redA = acc.m(mats.redA || mats.red);
  const H = opts.h || 0.85, pw = opts.postW || 0.14;
  posts.forEach((p, i) => {
    const top = p[1] + H + 0.05;
    // 望柱身
    cbox(red, xf([p[0], (p[1] + top) / 2, p[2]]), pw / 2, (top - p[1]) / 2, pw / 2, 0.012);
    // 中式素平顶覆斗式柱头 (Square Lotus / Beveled Cap)
    cbox(redA, xf([p[0], top + 0.015, p[2]]), pw / 2 + 0.015, 0.015, pw / 2 + 0.015, 0.005);
    cbox(red, xf([p[0], top + 0.035, p[2]]), pw / 2 - 0.01, 0.012, pw / 2 - 0.01, 0.004);
  });
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i], b = posts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (opts.skip && opts.skip.has(i)) continue;
    // 寻杖（圆木扶手）、腰枋（中档）、地栿
    bar(red, [a[0], a[1] + H, a[2]], [b[0], b[1] + H, b[2]], 0.046, 12, true);
    beam(red, [a[0], a[1] + H * 0.5, a[2]], [b[0], b[1] + H * 0.5, b[2]], 0.065, 0.10, 0.01);
    beam(red, [a[0], a[1] + 0.07, a[2]], [b[0], b[1] + 0.07, b[2]], 0.09, 0.09, 0.01);
    const dir = v3.norm(v3.sub(b, a));
    // 中式短枨与净瓶透空短棂
    const n = Math.max(1, Math.round(L / 0.58));
    for (let k = 1; k < n; k++) {
      const t = k / n; const p = v3.lerp(a, b, t);
      cbox(red, basis([p[0], p[1] + H * 0.75, p[2]], dir, [0, 1, 0], v3.cross(dir, [0, 1, 0])), 0.026, H * 0.25, 0.026, 0.005);
      cbox(red, basis([p[0], p[1] + H * 0.285, p[2]], dir, [0, 1, 0], v3.cross(dir, [0, 1, 0])), 0.022, H * 0.17, 0.022, 0.004);
    }
  }
}

// ------------------------------------------------------- 苏式美人靠 (吴王靠 / 鹅颈靠)
export function meirenkao(acc, mats, p0, p1, out, opts = {}) {
  const red = acc.m(mats.red), redD = acc.m(mats.redDark), redA = acc.m(mats.redA || mats.red);
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (L < 0.4) return;
  const ax = [(p1[0] - p0[0]) / L, 0, (p1[1] - p0[1]) / L];
  const o = [out[0], 0, out[1]];
  const midX = (p0[0] + p1[0]) / 2, midZ = (p0[1] + p1[1]) / 2;
  const yBase = opts.yBase || 1.6;
  const seatY = yBase + 0.44;
  const seatW = 0.36;
  const railH = 0.50;
  const outCurve = 0.16;

  const M = (u, y, w) => basis([midX + ax[0] * u + o[0] * w, y, midZ + ax[2] * u + o[2] * w], ax, [0, 1, 0], o);

  // 1. 实木宽厚坐板 (熟漆栗壳色)
  cbox(redD, M(0, seatY, seatW / 2 - 0.04), L / 2 - 0.02, 0.025, seatW / 2, 0.008);

  // 2. 坐板下方地栿与木雕支托牛腿 (立于月台青石地面上)
  cbox(redA, M(0, yBase + 0.04, seatW / 2 - 0.04), L / 2 - 0.02, 0.04, 0.05, 0.006);
  const nLegs = Math.max(2, Math.round(L / 1.5));
  for (let i = 0; i <= nLegs; i++) {
    const u = -L / 2 + 0.08 + (i * (L - 0.16)) / nLegs;
    cbox(red, M(u, (yBase + seatY - 0.025) / 2, seatW / 2 - 0.04), 0.04, (seatY - yBase - 0.025) / 2, 0.04, 0.005);
    cbox(redA, M(u, yBase + 0.22, seatW * 0.65), 0.03, 0.10, 0.05, 0.004);
  }

  // 3. 鹅颈弧形靠背与圆木靠手 (Goose-neck curved rail)
  const topP0 = [p0[0] + out[0] * (seatW + outCurve), seatY + railH, p0[1] + out[1] * (seatW + outCurve)];
  const topP1 = [p1[0] + out[0] * (seatW + outCurve), seatY + railH, p1[1] + out[1] * (seatW + outCurve)];
  bar(red, topP0, topP1, 0.042, 12, true);

  // 靠背腰档中梁
  const midP0 = [p0[0] + out[0] * (seatW + outCurve * 0.62), seatY + railH * 0.46, p0[1] + out[1] * (seatW + outCurve * 0.62)];
  const midP1 = [p1[0] + out[0] * (seatW + outCurve * 0.62), seatY + railH * 0.46, p1[1] + out[1] * (seatW + outCurve * 0.62)];
  beam(redA, midP0, midP1, 0.04, 0.055, 0.006);

  // 靠背竖向透光木棂条
  const nSlats = Math.max(3, Math.round(L / 0.18));
  for (let k = 1; k < nSlats; k++) {
    const t = k / nSlats;
    const u = -L / 2 + t * L;
    const y1 = seatY + 0.025, y2 = seatY + railH * 0.46;
    const w1 = seatW - 0.02, w2 = seatW + outCurve * 0.62;
    cbox(redA, M(u, (y1 + y2) / 2, (w1 + w2) / 2), 0.015, (y2 - y1) / 2, 0.015, 0.003);
    const y3 = seatY + railH;
    const w3 = seatW + outCurve;
    cbox(redA, M(u, (y2 + y3) / 2, (w2 + w3) / 2), 0.015, (y3 - y2) / 2, 0.015, 0.003);
  }

  // 4. 开间端部抱框立柱
  for (const s of [-1, 1]) {
    const endU = s * (L / 2 - 0.04);
    cbox(red, M(endU, (yBase + seatY + railH + 0.06) / 2, seatW / 2), 0.05, (seatY + railH + 0.06 - yBase) / 2, 0.05, 0.006);
  }
}

// ------------------------------------------------------- 苏州园林月台与回廊 (实心青石月台 + 美人靠)
export function buildVeranda(acc, mats, R) {
  const { x: vx, z: vz } = HB.ver;
  const yPod = HB.pod.h; // 1.6m

  // 注：月台顶面青石铺装统一由 buildPodium() 完成（已铺至 |x| ≤ 17.45 / |z| ≤ 12.95，
  // 顶面 y = 1.60），此处不再重复铺设，避免重叠几何与共面 z-fighting。

  // 江南古典园林美人靠（吴王靠）配置
  const inset = 0.12;
  const ex = vx - inset, ez = vz - inset;

  // (A) 西檐廊与东檐廊：整排江南美人靠
  for (const sx of [-1, 1]) {
    const xPos = sx * ex;
    meirenkao(acc, mats, [xPos, -8.4], [xPos, 8.4], [sx, 0], { yBase: yPod });
  }

  // (B) 北檐廊（后檐）：两侧各设一段美人靠，中间明间留出后门通道
  meirenkao(acc, mats, [-12.8, -ez], [-3.2, -ez], [0, -1], { yBase: yPod });
  meirenkao(acc, mats, [3.2, -ez], [12.8, -ez], [0, -1], { yBase: yPod });

  // (C) 南檐廊（前檐两侧）：次间与梢间前设美人靠/寻杖勾栏，中央对准石阶的大明间（-5.2 到 +5.2）完全开敞，展现江南高台大厅的开朗气度
  meirenkao(acc, mats, [-ex, ez], [-5.25, ez], [0, 1], { yBase: yPod });
  meirenkao(acc, mats, [5.25, ez], [ex, ez], [0, 1], { yBase: yPod });

  // 转角处连接小望柱
  const red = acc.m(mats.red);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cbox(red, xf([sx * ex, yPod + 0.52, sz * ez]), 0.065, 0.52, 0.065, 0.008);
  }
}

// ------------------------------------------------------- columns
export function column(acc, mats, x, z, y0, y1, r, opts = {}) {
  const red = acc.m(mats.redA || mats.red), black = acc.m(mats.black);
  lathe(red, xf([x, y0, z]), [[0, 0], [r, 0], [r * 0.995, (y1 - y0) * 0.5], [r * 0.975, y1 - y0], [0, y1 - y0]], 28, { hardDeg: 20 });
  if (opts.foot) {
    lathe(black, xf([x, y0, z]), [[r + 0.012, 0], [r + 0.012, 0.3], [0, 0.3]], 28);
  }
  if (opts.soseki) {
    lathe(acc.m(mats.granite), xf([x, opts.soseki, z]), [[0, 0], [r + 0.3, 0], [r + 0.3, 0.06], [r + 0.2, y0 - opts.soseki - 0.02], [r + 0.05, y0 - opts.soseki], [0, y0 - opts.soseki]], 24);
  }
}

// ------------------------------------------------------- walls
// Wall between two columns. p0,p1 = [x,z] of columns; out = outward unit [x,z].
// type: panel | open | 竖棂窗 | board | door
function bay(acc, mats, R, p0, p1, out, type, ctx2) {
  const red = acc.m(mats.red), redD = acc.m(mats.redDark), black = acc.m(mats.black), white = acc.m(mats.plaster), gold = acc.m(mats.gold);
  const redA = acc.m(mats.redA || mats.red);
  const inW = acc.m(mats.intWall), inP = acc.m(mats.intPlaster);
  const r = HB.colR;
  const fy = HB.floorY;
  const ax = v3.norm([p1[0] - p0[0], 0, p1[1] - p0[1]]);
  const o = [out[0], 0, out[1]];
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const cx = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
  const half = L / 2 - r * 0.6; // between columns (into the columns a bit)
  const at = (u, y, w) => [cx + ax[0] * u + o[0] * w, y, cz + ax[2] * u + o[2] * w];
  const M = (u, y, w) => basis(at(u, y, w), ax, [0, 1, 0], o);
  const panel = (ms, u0, u1, y0, y1, w0, w1, c = 0.01) => cbox(ms, M((u0 + u1) / 2, (y0 + y1) / 2, (w0 + w1) / 2), (u1 - u0) / 2, (y1 - y0) / 2, (w1 - w0) / 2, c);
  const Y = { sill0: fy, sill1: fy + 0.26, koshi: 2.95, kn1: 3.12, nag0: 5.9, nag1: 6.15, kn0: 7.35, kh1: 7.65, top: HB.colTop };
  // --- structural beams (柱间额枋与穿枋，平接柱身，无凸出柱外的日式长押)
  panel(redA, -half, half, Y.kn0, Y.kh1, -0.09, 0.09, 0.015); // 大额枋 (阑额)
  panel(redA, -half, half, Y.top - 0.17, Y.top, -0.11, 0.11, 0.015); // 普拍枋
  if (type !== 'open') panel(redA, -half, half, Y.sill0, Y.sill1, -0.10, 0.10, 0.015); // 下槛枋
  else panel(redA, -half, half, Y.sill0, Y.sill0 + 0.1, -0.10, 0.10, 0.01); // 门槛木
  // 中式穿枋 (穿插枋，平齐柱面)
  panel(redA, -half, half, Y.nag0, Y.nag1, -0.07, 0.07, 0.012);
  panel(redA, -half, half, Y.sill1 - 0.01, Y.sill1 + 0.12, -0.07, 0.07, 0.01);

  // --- 中式木雕雀替 (Sparrow Braces / Consoles) — 柱头额枋交角倒三角木雕卷草雀替
  const spW = Math.min(0.52, half * 0.42), spH = 0.35, spT = 0.065;
  for (const sx of [-1, 1]) {
    const spX = sx * (half - spW / 2);
    panel(redD, spX - spW / 2, spX + spW / 2, Y.kn0 - spH, Y.kn0, -spT / 2, spT / 2, 0.008);
  }

  // --- upper wall: plaster between 额枋 and 普拍枋 (由额垫板与白粉抹灰)
  panel(white, -half, half, Y.kh1, Y.top - 0.17, 0.0, 0.06, 0.006);
  panel(inP, -half, half, Y.kh1, HB.ceilY + 0.08, -0.06, 0.0, 0.006);
  // 额枋下中式花牙与棂条
  if (type === 'open') {
    // 苏式挂落与棂子楣杆 (Lattice transom)
    panel(red, -half, half, Y.nag1, Y.nag1 + 0.08, -0.06, 0.06, 0.008);
    for (let u = -half + 0.12; u < half - 0.08; u += 0.16) panel(red, u - 0.02, u + 0.02, Y.nag1 + 0.08, Y.kn0, -0.025, 0.025, 0.005);
    for (const y of [Y.nag1 + 0.42, Y.nag1 + 0.82]) panel(red, -half, half, y - 0.018, y + 0.018, -0.025, 0.025, 0.004);
    panel(inP, -half, half, Y.kn0 - 0.02, Y.kh1, -0.06, -0.0, 0.004);
  } else {
    panel(white, -half, half, Y.nag1, Y.kn0, 0.0, 0.06, 0.006);
    panel(inP, -half, half, Y.nag1, Y.kn0, -0.06, 0.0, 0.006);
  }
  // --- main zone
  if (type === 'panel') {
    // ---- 苏式落地长窗（4扇一组格扇门，Four-leaf Jiangnan Changchuang）----
    const nLeaves = 4;
    const leafW = (2 * half) / nLeaves;
    const fw = 0.052; // 边梃宽度
    const ySkirt = 3.22; // 裙板上口
    const yWaist = 3.52; // 绦环板上口

    // 底层内衬：暗色内壁（格心透出的是幽暗室内 / 明瓦灰光，不是白粉墙 —— 白格子是障子做法）
    panel(inW, -half, half, Y.sill1, Y.nag0, 0.03, 0.045, 0.002);
    panel(inW, -half, half, Y.sill1, Y.nag0, -0.06, 0.0, 0.004);

    for (let li = 0; li < nLeaves; li++) {
      const u0 = -half + li * leafW + 0.008;
      const u1 = -half + (li + 1) * leafW - 0.008;

      // 1. 门扇外框（边梃与抹头）
      panel(red, u0, u0 + fw, Y.sill1, Y.nag0, 0.035, 0.085, 0.008); // 左边梃
      panel(red, u1 - fw, u1, Y.sill1, Y.nag0, 0.035, 0.085, 0.008); // 右边梃
      panel(red, u0, u1, Y.sill1, Y.sill1 + 0.055, 0.035, 0.085, 0.008); // 下抹头
      panel(red, u0, u1, Y.nag0 - 0.055, Y.nag0, 0.035, 0.085, 0.008); // 上抹头
      panel(red, u0, u1, ySkirt - 0.04, ySkirt, 0.035, 0.085, 0.008); // 裙板上抹头
      panel(red, u0, u1, yWaist - 0.04, yWaist, 0.035, 0.085, 0.008); // 绦环板上抹头

      // 2. 裙板（障板，下段实木栗壳色面板）
      panel(redD, u0 + fw, u1 - fw, Y.sill1 + 0.055, ySkirt - 0.04, 0.045, 0.075, 0.004);

      // 3. 绦环板（腰段实木窄板）
      panel(redD, u0 + fw, u1 - fw, ySkirt, yWaist - 0.04, 0.045, 0.075, 0.004);

      // 4. 格心（上部高挑透光花格：步步锦棂花构架）
      const gx0 = u0 + fw + 0.015, gx1 = u1 - fw - 0.015;
      const gy0 = yWaist + 0.02, gy1 = Y.nag0 - 0.075;
      // 竖向棂条 (3 vertical bars)
      const nV = 3;
      const du = (gx1 - gx0) / (nV + 1);
      for (let vi = 1; vi <= nV; vi++) {
        const vx = gx0 + vi * du;
        panel(redA, vx - 0.012, vx + 0.012, gy0, gy1, 0.048, 0.078, 0.003);
      }
      // 横向棂条 (8 horizontal crossbars)
      const nH = 8;
      const dy = (gy1 - gy0) / (nH + 1);
      for (let hi = 1; hi <= nH; hi++) {
        const hy = gy0 + hi * dy;
        panel(redA, gx0, gx1, hy - 0.012, hy + 0.012, 0.048, 0.078, 0.003);
      }

      // 5. 门环（中间两扇相遇处加素雅小拉手）
      if (li === 1 || li === 2) {
        const ringU = li === 1 ? u1 - fw - 0.04 : u0 + fw + 0.04;
        pullRing(black, M(ringU, (ySkirt + yWaist) / 2, 0.088), 0.038, 0.005);
      }
    }
  } else if (type === 'open') {
    // 敞开明间：两对隔扇长窗折叠收拢在两侧柱旁
    for (const s of [-1, 1]) {
      const u = s * (half - 0.06);
      for (const k of [0, 1]) {
        const uu = u - s * (0.02 + k * 0.065);
        panel(red, uu - 0.025, uu + 0.025, Y.sill1, Y.nag0, 0.12, 0.95, 0.006);
        panel(redD, uu - 0.022, uu + 0.022, Y.sill1 + 0.06, 3.22, 0.14, 0.93, 0.004); // 裙板
        for (let w = 0.22; w < 0.9; w += 0.16) {
          panel(redA, uu - 0.018, uu + 0.018, 3.52, Y.nag0 - 0.08, w - 0.015, w + 0.015, 0.003);
        }
      }
    }
  } else if (type === 'renji' || type === 'window') {
    // ---- 苏式半窗（白粉矮墙 + 步步锦花窗，彻底取代日式連子窓）----
    panel(white, -half, half, Y.sill1, Y.koshi, 0.0, 0.06, 0.006);
    panel(inP, -half, half, Y.sill0, Y.koshi, -0.06, 0.0, 0.006);
    panel(redA, -half, half, Y.koshi, Y.kn1, -0.08, 0.08, 0.012);
    const fw = 0.065;
    panel(red, -half, -half + fw, Y.kn1, Y.nag0, -0.06, 0.06, 0.01);
    panel(red, half - fw, half, Y.kn1, Y.nag0, -0.06, 0.06, 0.01);
    panel(red, -half, half, Y.nag0 - 0.06, Y.nag0, -0.06, 0.06, 0.01);
    panel(white, -half + fw, half - fw, Y.kn1 + 0.02, Y.nag0 - 0.06, 0.0, 0.02, 0.002);
    const nLeaves = 4;
    const lW = (2 * (half - fw)) / nLeaves;
    for (let li = 0; li < nLeaves; li++) {
      const u0 = -half + fw + li * lW + 0.006;
      const u1 = -half + fw + (li + 1) * lW - 0.006;
      panel(red, u0, u0 + 0.035, Y.kn1 + 0.02, Y.nag0 - 0.06, 0.02, 0.05, 0.005);
      panel(red, u1 - 0.035, u1, Y.kn1 + 0.02, Y.nag0 - 0.06, 0.02, 0.05, 0.005);
      panel(red, u0, u1, Y.kn1 + 0.02, Y.kn1 + 0.055, 0.02, 0.05, 0.005);
      panel(red, u0, u1, Y.nag0 - 0.095, Y.nag0 - 0.06, 0.02, 0.05, 0.005);
      const nV = 2;
      for (let vi = 1; vi <= nV; vi++) {
        const vx = u0 + (vi * (u1 - u0)) / (nV + 1);
        panel(redA, vx - 0.01, vx + 0.01, Y.kn1 + 0.055, Y.nag0 - 0.095, 0.025, 0.045, 0.003);
      }
      for (let hi = 1; hi <= 5; hi++) {
        const hy = Y.kn1 + 0.055 + (hi * (Y.nag0 - 0.15 - Y.kn1)) / 6;
        panel(redA, u0 + 0.035, u1 - 0.035, hy - 0.01, hy + 0.01, 0.025, 0.045, 0.003);
      }
    }
    panel(inW, -half, half, Y.nag0, Y.nag1, -0.06, 0.0, 0.004);
  } else if (type === 'door') {
    // ---- 苏式双开实木雕花大门（带中式黑铁铺首拉环）----
    const jw = 0.08;
    panel(red, -half, -half + jw, Y.sill1, Y.nag0, -0.06, 0.06, 0.01);
    panel(red, half - jw, half, Y.sill1, Y.nag0, -0.06, 0.06, 0.01);
    panel(red, -half, half, Y.nag0 - 0.08, Y.nag0, -0.06, 0.06, 0.01);
    const dHalf = half - jw;
    for (const sx of [-1, 1]) {
      const du0 = sx > 0 ? 0.005 : -dHalf + 0.005;
      const du1 = sx > 0 ? dHalf - 0.005 : -0.005;
      panel(redD, du0, du1, Y.sill1 + 0.02, Y.nag0 - 0.08, 0.01, 0.06, 0.008);
      panel(red, du0 + 0.02, du1 - 0.02, 3.2, 3.28, 0.062, 0.075, 0.004);
      const ringX = sx * 0.18;
      pullRing(black, M(ringX, (Y.sill1 + Y.nag0) / 2, 0.075), 0.042, 0.006);
    }
  } else if (type === 'board' || type === 'leak') {
    // ---- 苏式白粉墙开漏窗（移步换景，取代原日式粗厚板墙）----
    panel(white, -half, half, Y.sill1, Y.nag0, 0.0, 0.05, 0.006);
    panel(inP, -half, half, Y.sill1, Y.nag0, -0.05, 0.0, 0.006);
    const winW = Math.min(1.2, half * 1.2), winH = 1.35;
    const winY = (Y.sill1 + Y.nag0) / 2 + 0.15;
    panel(black, -winW / 2, winW / 2, winY - winH / 2, winY + winH / 2, 0.052, 0.072, 0.008);
    panel(acc.m(mats.woodDark), -winW / 2 + 0.05, winW / 2 - 0.05, winY - winH / 2 + 0.05, winY + winH / 2 - 0.05, -0.02, 0.055, 0.004);
    for (let u = -winW / 2 + 0.18; u <= winW / 2 - 0.18; u += 0.24) {
      panel(redA, u - 0.012, u + 0.012, winY - winH / 2 + 0.05, winY + winH / 2 - 0.05, 0.056, 0.075, 0.003);
    }
    for (let yOff = -winH / 2 + 0.22; yOff <= winH / 2 - 0.22; yOff += 0.26) {
      panel(redA, -winW / 2 + 0.05, winW / 2 - 0.05, winY + yOff - 0.012, winY + yOff + 0.012, 0.056, 0.075, 0.003);
    }
  }
  // interior skin top band above 腰枋 for open bays handled; for others continuous
  if (type === 'open') panel(inP, -half, half, Y.nag1, Y.kn0, -0.06, -0.035, 0.004);
  void ctx2; void R;
}

export function buildWalls(acc, mats, R, frontTypes, backTypes, westTypes, eastTypes) {
  const X = HB.colX, Z = HB.colZ;
  for (let i = 0; i < X.length - 1; i++) {
    bay(acc, mats, R, [X[i], 8.5], [X[i + 1], 8.5], [0, 1], frontTypes[i]);
    bay(acc, mats, R, [X[i + 1], -8.5], [X[i], -8.5], [0, -1], backTypes[i]);
  }
  for (let j = 0; j < Z.length - 1; j++) {
    bay(acc, mats, R, [-13, Z[j]], [-13, Z[j + 1]], [-1, 0], westTypes[j]);
    bay(acc, mats, R, [13, Z[j + 1]], [13, Z[j]], [1, 0], eastTypes[j]);
  }
  // columns with 础石
  for (const x of X) for (const z of Z) {
    const edge = Math.abs(x) === 13 || Math.abs(z) === 8.5;
    if (!edge) continue;
    column(acc, mats, x, z, HB.colBase + 0.14, HB.colTop, HB.colR, { foot: true, soseki: HB.colBase - 0.02 });
  }
  // 木鼻 (plain beam ends) projecting at the corner columns
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const c = [sx * 13, 7.5, sz * 8.5];
      const e = [c[0] + sx * dx * 0.75, 7.5, c[2] + sz * dz * 0.75];
      beam(acc.m(mats.red), c, e, 0.2, 0.3, 0.02);
    }
  }
}

// --------------------------------------------------------- interior shell
export function buildInterior(acc, mats, R) {
  const fl = acc.m(mats.intFloor);
  const fy = HB.floorY;
  // long polished planks along x (0.36 wide), random lengths & butt joints, tiny bevel
  const pw = 0.36;
  for (let z = -8.5; z < 8.5 - 0.01; z += pw) {
    const z1 = Math.min(z + pw, 8.5);
    let x = -13 - R.range(0, 4.5);
    while (x < 13 - 0.01) {
      const xe = Math.min(x + R.range(4.0, 7.5), 13); const xs = Math.max(x, -13);
      if (xe - xs > 0.1) cbox(fl, xf([(xs + xe) / 2, fy - 0.05 + R.range(-0.0015, 0.0008), (z + z1) / 2]), (xe - xs) / 2 - 0.0015, 0.05, (z1 - z) / 2 - 0.0015, 0.0025);
      x = xe;
    }
  }
  // ceiling slab (flat), perimeter moulding
  const ce = acc.m(mats.intCeil);
  cbox(ce, xf([0, HB.ceilY + 0.06, 0]), 13.0, 0.06, 8.5, 0, { skip: new Set(['+y']) });
  for (const s of [-1, 1]) {
    cbox(acc.m(mats.intWall), xf([0, HB.ceilY - 0.09, s * 8.35]), 12.9, 0.09, 0.09, 0.01);
    cbox(acc.m(mats.intWall), xf([s * 12.85, HB.ceilY - 0.09, 0]), 0.09, 0.09, 8.4, 0.01);
  }
}

// ------------------------------------------------------- upper storey
export function buildUpper(acc, mats, R) {
  const U = HB.up;
  const red = acc.m(mats.red), redD = acc.m(mats.redDark), white = acc.m(mats.plaster);
  const redA = acc.m(mats.redA || mats.red);
  const xi = U.xs[U.xs.length - 1], zi = U.zs[U.zs.length - 1];
  for (const x of U.xs) for (const z of U.zs) {
    if (Math.abs(x) !== xi && Math.abs(z) !== zi) continue;
    column(acc, mats, x, z, U.base, U.top, U.r, {});
  }
  // walls between upper columns
  const sides = [];
  for (let i = 0; i < U.xs.length - 1; i++) { sides.push([[U.xs[i], zi], [U.xs[i + 1], zi], [0, 1]]); sides.push([[U.xs[i + 1], -zi], [U.xs[i], -zi], [0, -1]]); }
  for (let j = 0; j < U.zs.length - 1; j++) { sides.push([[-xi, U.zs[j]], [-xi, U.zs[j + 1]], [-1, 0]]); sides.push([[xi, U.zs[j + 1]], [xi, U.zs[j]], [1, 0]]); }
  for (const [p0, p1, out] of sides) {
    const ax = v3.norm([p1[0] - p0[0], 0, p1[1] - p0[1]]); const o = [out[0], 0, out[1]];
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); const cx = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
    const half = L / 2 - U.r * 0.6;
    const M = (u, y, w) => basis([cx + ax[0] * u + o[0] * w, y, cz + ax[2] * u + o[2] * w], ax, [0, 1, 0], o);
    const panel = (ms, u0, u1, y0, y1, w0, w1, c = 0.01) => cbox(ms, M((u0 + u1) / 2, (y0 + y1) / 2, (w0 + w1) / 2), (u1 - u0) / 2, (y1 - y0) / 2, (w1 - w0) / 2, c);
    panel(redD, -half, half, U.base, 11.3, -0.05, 0.05, 0.005);
    panel(redA, -L / 2, L / 2, 11.12, 11.34, -0.11, 0.11, 0.012); // sill
    // 竖棂窗 window with white 明瓦 backing
    panel(white, -half, half, 11.34, 12.28, -0.06, -0.02, 0.004);
    const fw = 0.12;
    panel(red, -half, -half + fw, 11.34, 12.28, -0.06, 0.08, 0.01);
    panel(red, half - fw, half, 11.34, 12.28, -0.06, 0.08, 0.01);
    for (let u = -half + fw + 0.09; u < half - fw - 0.04; u += 0.17) cbox(red, mul(M(u, 11.81, 0.02), xf([0, 0, 0], Math.PI / 4)), 0.03, 0.47, 0.03, 0.004);
    // 腰枋 (proud red band)
    panel(redA, -L / 2 - 0.04, L / 2 + 0.04, 12.28, 12.46, U.r - 0.03, U.r + 0.07, 0.015);
    for (const s of [-1, 1]) {
      panel(redA, s * (L / 2 - U.r - 0.13) - 0.11, s * (L / 2 - U.r - 0.13) + 0.11, 12.27, 12.47, U.r + 0.068, U.r + 0.082, 0.004);
    }
    panel(white, -half, half, 12.46, 12.55, -0.05, 0.05, 0.004);
    panel(redA, -L / 2, L / 2, 12.55, 12.78, -0.1, 0.1, 0.012); // kashiranuki
    for (const yy of [12.59, 12.74]) panel(redA, -L / 2 + U.r, L / 2 - U.r, yy - 0.007, yy + 0.007, 0.098, 0.107, 0.003);
    panel(redA, -L / 2, L / 2, U.top - 0.15, U.top, -0.12, 0.12, 0.012); // daiwa
    panel(white, -half, half, 12.78, U.top - 0.15, -0.05, 0.05, 0.004);
  }
  // balcony (腰墙-gumi): floor + small brackets + railing
  const bo = 1.0; const by = 11.36;
  const bx = xi + bo, bz = zi + bo;
  const wx = acc.m(mats.woodX), wz = acc.m(mats.woodZ);
  for (const sz of [-1, 1]) cbox(wx, xf([0, by, sz * (zi + bo / 2 + 0.05)]), bx, 0.06, bo / 2 - 0.05, 0.01);
  for (const sx of [-1, 1]) cbox(wz, xf([sx * (xi + bo / 2 + 0.05), by, 0]), bo / 2 - 0.05, 0.06, zi + 0.0, 0.01);
  // fascia board of the balcony
  const ring = [[-bx, bz], [bx, bz], [bx, -bz], [-bx, -bz], [-bx, bz]];
  for (let i = 0; i < 4; i++) beam(red, [ring[i][0], by - 0.1, ring[i][1]], [ring[i + 1][0], by - 0.1, ring[i + 1][1]], 0.12, 0.2, 0.012);
  // support brackets at each column (two-step cantilever)
  for (const x of U.xs) for (const z of U.zs) {
    if (Math.abs(x) !== xi && Math.abs(z) !== zi) continue;
    const dirs = [];
    if (Math.abs(z) === zi) dirs.push([0, Math.sign(z)]);
    if (Math.abs(x) === xi) dirs.push([Math.sign(x), 0]);
    for (const [dx, dz] of dirs) {
      beam(red, [x, by - 0.24, z], [x + dx * (bo + 0.02), by - 0.24, z + dz * (bo + 0.02)], 0.16, 0.18, 0.012);
      beam(red, [x, by - 0.5, z], [x + dx * (bo * 0.6), by - 0.5, z + dz * (bo * 0.6)], 0.14, 0.16, 0.012);
      cbox(red, xf([x + dx * bo * 0.55, by - 0.36, z + dz * bo * 0.55]), 0.09, 0.07, 0.09, 0.01, { taper: [0.8, 0.8] });
      cbox(red, xf([x + dx * (bo + 0.025), by - 0.24, z + dz * (bo + 0.025)]), dx ? 0.006 : 0.09, 0.095, dz ? 0.006 : 0.09, 0.003);
    }
  }
  // railing
  const ins = 0.1;
  const rx = bx - ins, rz = bz - ins;
  const xs = [-rx, ...U.xs, ...U.xs.slice(0, -1).map((x, i) => (x + U.xs[i + 1]) / 2), rx].sort((a, b) => a - b);
  const zs = [-rz, ...U.zs, ...U.zs.slice(0, -1).map((z, i) => (z + U.zs[i + 1]) / 2), rz].sort((a, b) => a - b);
  const yb = by + 0.06;
  railing(acc, mats, xs.map((x) => [x, yb, rz]), { h: 0.72, postW: 0.12 });
  railing(acc, mats, xs.map((x) => [x, yb, -rz]), { h: 0.72, postW: 0.12 });
  railing(acc, mats, zs.map((z) => [rx, yb, z]), { h: 0.72, postW: 0.12 });
  railing(acc, mats, zs.map((z) => [-rx, yb, z]), { h: 0.72, postW: 0.12 });
}

// ------------------------------------------------------- bracket placement
// ring of columns xs (sorted) at z=+-zw and zs at x=+-xw, column top y.
export function placeBrackets(acc, mats, xs, zs, top, type, opts = {}) {
  const xw = xs[xs.length - 1], zw = zs[zs.length - 1];
  const flatFront = opts.flatFront || (() => false);
  const sets = [];
  // front/back (outward +-z)
  for (const sz of [-1, 1]) {
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const t = sz > 0 && flatFront(x) ? 'flat' : type;
      sets.push([x, sz * zw, [0, sz], t, false]);
      if (i < xs.length - 1) { const xm = (x + xs[i + 1]) / 2; sets.push([xm, sz * zw, [0, sz], t, true]); }
    }
  }
  for (const sx of [-1, 1]) {
    for (let j = 0; j < zs.length; j++) {
      const z = zs[j];
      if (Math.abs(z) !== zw) sets.push([sx * xw, z, [sx, 0], type, false]);
      else sets.push([sx * xw, z, [sx, 0], type, false]);
      if (j < zs.length - 1) { const zm = (z + zs[j + 1]) / 2; sets.push([sx * xw, zm, [sx, 0], type, true]); }
    }
  }
  for (const [x, z, o, t, inter] of sets) {
    const ax = [o[0], 0, o[1]];
    const X = basis([x, top, z], ax, [0, 1, 0], v3.cross(ax, [0, 1, 0]));
    bracketSet(acc, mats, X, t, { inter: inter && !opts.fullInter, kw: opts.kw, lat: inter && opts.fullInter ? 0.56 : undefined });
  }
  // diagonal corner sets
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const d = v3.norm([sx, 0, sz]);
    const X = mul(basis([sx * xw, top, sz * zw], d, [0, 1, 0], v3.cross(d, [0, 1, 0])), xf([0, 0, 0], 0, 0, 0, [1.414, 1, 1]));
    bracketSet(acc, mats, X, type, { lat: 0.3 });
  }
  // continuous beams along each side (extended to cross at corners)
  const P = 0.44;
  for (const sz of [-1, 1]) {
    const segs = opts.frontSpans && sz > 0 ? opts.frontSpans : [[-xw, xw]];
    for (const [a, b] of segs) {
      const ext0 = a <= -xw + 1e-3 ? 0.9 : 0, ext1 = b >= xw - 1e-3 ? 0.9 : 0;
      bracketBeams(acc, mats, [a - ext0, top, sz * zw], [b + ext1, top, sz * zw], [0, 0, sz], type);
    }
    if (opts.frontSpans && sz > 0) for (const [a, b] of opts.frontGaps || []) bracketBeams(acc, mats, [a, top, zw], [b, top, zw], [0, 0, 1], 'flat');
  }
  for (const sx of [-1, 1]) bracketBeams(acc, mats, [sx * xw, top, -zw - 0.9], [sx * xw, top, zw + 0.9], [sx, 0, 0], type);
  void P;
}

// 栱眼壁 plaster walls behind bracket sets (wall plane), from column top to y1
export function kentoku(acc, mats, xw, zw, y0, y1, colR) {
  const white = acc.m(mats.plaster), inP = acc.m(mats.intPlaster);
  for (const sz of [-1, 1]) cbox(white, xf([0, (y0 + y1) / 2, sz * zw]), xw, (y1 - y0) / 2, 0.06, 0.004);
  for (const sx of [-1, 1]) cbox(white, xf([sx * xw, (y0 + y1) / 2, 0]), 0.06, (y1 - y0) / 2, zw, 0.004);
  void inP; void colR;
}
