// ---------------------------------------------------------------------------
// hall-orn: ornaments — 莲瓣望柱头 post caps, 5-petal mon crest,
// 蛙股(已替换为荷叶墩) frog-leg struts, 蟇股(已替换为悬鱼) gable pendants, 螭吻 ridge-end ornaments,
// eave tile end discs. All emitted into an Acc in a given local frame X.
// Local frame convention for flat ornaments: the ornament faces local +Z,
// lies in the local XY plane, origin at its centre (or bottom where noted).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { cbox, lathe, extrude, sweep, bar, xf, basis, mul, v3, circlePts, clamp, lerp } from './hall-lib.js';
import { ridge2, scroll, leaf, peony, bead, cloud } from './hall-carve.js';
import { lotusDisc } from './hall-detail.js';

// 莲瓣望柱头 (lotus-bud railing post cap) standing on local origin, total
// height H, radius R. A necking, a flared ring of lotus petals, then a bud
// closing to a blunt tip. `seg` is left low on purpose: the flat facets read
// as the petals. (was: 拟宝珠(已替换为莲瓣望柱头), the Japanese onion finial)
export function lotusFinial(ms, X, R = 0.12, H = 0.42, seg = 12) {
  const prof = [
    [0, 0], [R * 0.95, 0], [R * 0.95, H * 0.05], [R * 0.80, H * 0.08], [R * 0.78, H * 0.15],
    [R * 0.86, H * 0.22], [R * 1.00, H * 0.31], [R * 1.08, H * 0.39], [R * 1.00, H * 0.50],
    [R * 0.82, H * 0.62], [R * 0.62, H * 0.74], [R * 0.44, H * 0.85], [R * 0.26, H * 0.94],
    [R * 0.12, H * 0.98], [0, H],
  ];
  lathe(ms, X, prof, seg, { hardDeg: 62 });
}

// 莲花瓦当 (lotus tile-end disc), small. Disc axis = local +Y.
// The gilt option is gone: a Chinese eave tile end is unglazed grey tile.
export function tileDisc(msTile, msGold, X, R = 0.115, th = 0.045, gold = true) {
  void msGold; void gold;
  lotusDisc(msTile, null, X, R, th);
}

// 2D outline helpers -------------------------------------------------------
function bez(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}

// 荷叶墩 (lotus-leaf bearing block) outline. Width W, height H, bottom centre
// at origin. A flared foot, waisted flanks, and a top edge that rises into two
// lotus lobes with a shallow dip between them.
// (was: 蛙股(已替换为荷叶墩)Shape, the Japanese frog-leg strut)
export function lotusBlockShape(W = 0.9, H = 0.46) {
  const w = W / 2;
  const left = [[-w, 0]];
  left.push(...bez([-w, 0], [-w * 1.02, H * 0.30], [-w * 0.98, H * 0.62], [-w * 0.86, H * 0.86], 8));
  left.push(...bez([-w * 0.86, H * 0.86], [-w * 0.70, H * 1.02], [-w * 0.44, H * 1.06], [-w * 0.26, H * 0.98], 8));
  left.push(...bez([-w * 0.26, H * 0.98], [-w * 0.13, H * 0.93], [-w * 0.04, H * 0.95], [0, H * 0.96], 5));
  const right = left.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  return [...left, ...right];
}

// 荷叶墩 / 柁墩 — the bearing block that sits on a beam and carries the one
// above. Carved in the clear (清水木雕): bare oiled wood, no gilding.
export function lotusBlock(msWood, msGold, X, W = 0.9, H = 0.46, T = 0.16) {
  const sh = lotusBlockShape(W, H);
  extrude(msWood, X, sh, [], -T / 2, T / 2);
  // a curling 卷草 spray carved on both faces
  for (const zf of [1, -1]) {
    const F = mul(X, xf([0, 0, 0], 0, 0, 0, [1, 1, zf]));
    for (const s of [-1, 1]) scroll(msWood, F, s * W * 0.30, H * 0.34, W * 0.075, s > 0 ? Math.PI : 0, s, 1.15, W * 0.018, T * 0.08, { z0: T / 2 });
  }
  // seat on top: the block carries the beam above it
  cbox(msWood, mul(X, xf([0, H + 0.005, 0])), W * 0.5, 0.01, T * 0.6, 0.003);
  void msGold;
}

// 悬鱼 — the carved wooden fish pendant hung under a gable apex (faces +Z),
// width W, height H, origin at the top centre. Broad shoulders tapering to a
// notched fish tail, with 惹草 curls and a 联珠 on the breast.
// (was: 蟇股(已替换为悬鱼), the Japanese gilt gable pendant with a central peony)
export function xuanyu(msWood, msBack, X, W = 1.6, H = 1.3, T = 0.12, msCarve = null) {
  const w = W / 2;
  const right = [];
  right.push(...bez([0, 0], [w * 0.45, -H * 0.04], [w * 0.90, -H * 0.14], [w * 1.00, -H * 0.30], 8));
  right.push(...bez([w * 1.00, -H * 0.30], [w * 1.06, -H * 0.48], [w * 0.86, -H * 0.62], [w * 0.58, -H * 0.70], 8));
  right.push(...bez([w * 0.58, -H * 0.70], [w * 0.40, -H * 0.78], [w * 0.26, -H * 0.90], [w * 0.30, -H * 0.99], 8));
  right.push(...bez([w * 0.30, -H * 0.99], [w * 0.20, -H * 1.02], [w * 0.10, -H * 0.95], [0, -H * 0.86], 5));
  const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  const outline = [[0, 0], ...right, ...left];
  extrude(msWood, X, outline, [], -T / 2, T / 2);
  const mc = msCarve || msWood;
  const z0 = T / 2;
  const sw = Math.max(0.012, W * 0.017);
  const rim = outline.map(([x, y]) => [x * 0.94, (y + H * 0.5) * 0.94 - H * 0.5]);
  rim.push(rim[0], rim[1]);
  ridge2(mc, X, rim, sw * 0.9, sw * 0.85, 5, { z0 });
  // 惹草: a curling spray either side, on both faces
  for (const Xs of [X, mul(X, xf([0, 0, 0], 0, 0, 0, [-1, 1, 1]))]) {
    scroll(mc, Xs, w * 0.44, -H * 0.30, Math.min(w * 0.16, H * 0.10), Math.PI * 1.05, -1, 1.3, sw, sw * 0.95, { z0 });
    scroll(mc, Xs, w * 0.26, -H * 0.62, Math.min(w * 0.11, H * 0.07), Math.PI * 0.1, 1, 1.2, sw * 0.8, sw * 0.8, { z0 });
  }
  bead(mc, X, 0, -H * 0.40, W * 0.04, W * 0.045, 12, z0);
  if (msBack) {
    // backing plate so the pendant reads as a board hung off the wall
    const back = outline.map(([x, y]) => [x * 1.05, y * 1.04 + H * 0.02]);
    extrude(msBack, X, back, [], -T / 2 - 0.03, -T / 2 + 0.01);
  }
}

// 螭吻 (chiwen) — the dragon-head ridge-end ornament that bites the ridge:
// a flaring jaw with an open mouth, bulging eyes under brow ridges, two horns
// curling up over a crown, and the 剑把 sword hilt that pins it to the ridge.
// Local: origin at bottom centre of the ridge end, faces +Z (outward along the
// ridge), width W, height H, thickness T.
// (was: 鬼瓦(已替换为螭吻), the Japanese ogre-face tile with 鯱 fins and a flame finial)
export function chiwen(msTile, msGold, X, W = 0.9, H = 1.2, T = 0.22, opts = {}) {
  const w = W / 2;
  // silhouette: flared jaw foot, the mouth line, wide cheekbones, a brow, then
  // two horns rising and curling inward over a crown that dips between them
  const right = [[w * 0.86, 0]];
  right.push(...bez([w * 0.86, 0], [w * 1.00, H * 0.03], [w * 1.05, H * 0.07], [w * 0.98, H * 0.13], 5));
  right.push(...bez([w * 0.98, H * 0.13], [w * 0.82, H * 0.17], [w * 0.72, H * 0.21], [w * 0.80, H * 0.25], 5));  // mouth line
  right.push(...bez([w * 0.80, H * 0.25], [w * 1.02, H * 0.31], [w * 1.07, H * 0.38], [w * 0.99, H * 0.50], 6));  // cheekbone
  right.push(...bez([w * 0.99, H * 0.50], [w * 0.95, H * 0.58], [w * 1.02, H * 0.63], [w * 0.88, H * 0.72], 5));  // brow -> temple
  right.push(...bez([w * 0.88, H * 0.72], [w * 0.80, H * 0.80], [w * 0.66, H * 0.89], [w * 0.43, H * 1.00], 7));  // horn
  right.push(...bez([w * 0.43, H * 1.00], [w * 0.32, H * 0.97], [w * 0.19, H * 0.91], [0, H * 0.85], 5));         // crown
  const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  const outline = [...right, ...left];
  // open mouth: a hole through the plate with a dark throat set behind it
  const upper = bez([-w * 0.60, H * 0.155], [-w * 0.34, H * 0.30], [w * 0.34, H * 0.30], [w * 0.60, H * 0.155], 12);
  const lower = bez([w * 0.60, H * 0.155], [w * 0.36, H * 0.095], [-w * 0.36, H * 0.095], [-w * 0.60, H * 0.155], 12);
  const mouth = [...upper, ...lower.slice(0, -1)];
  extrude(msTile, X, outline, [mouth], -T, 0);
  extrude(msTile, X, mouth, [], -T * 0.66, -T * 0.56);            // throat, in shadow behind the gap
  // raised border band (front relief) + recessed field
  const band = outline.map(([x, y]) => [x * 0.84, y * 0.84 + H * 0.06]);
  extrude(msTile, X, outline, [band], 0, 0.04);
  const field = outline.map(([x, y]) => [x * 0.62, y * 0.6 + H * 0.16]);
  extrude(msTile, X, field, [], 0, 0.025);
  // eyes: bulging tile bosses with a darker pupil, under a curled brow ridge
  const er = W * 0.125;
  for (const s of [-1, 1]) {
    const ex = s * w * 0.42, ey = H * 0.56;
    lathe(msTile, mul(X, xf([ex, ey, 0.02], 0, Math.PI / 2)), [[0, 0], [er, 0], [er, 0.02], [er * 0.86, 0.05], [er * 0.42, 0.078], [0, 0.088]], 20);
    if (msGold) lathe(msGold, mul(X, xf([ex, ey, 0.088], 0, Math.PI / 2)), [[0, 0], [er * 0.42, 0], [er * 0.38, 0.014], [0, 0.022]], 16);
    const brow = bez([s * w * 0.16, H * 0.68], [s * w * 0.38, H * 0.72], [s * w * 0.58, H * 0.67], [s * w * 0.74, H * 0.56], 8);
    ridge2(msTile, X, brow, W * 0.036, W * 0.03, 5, { z0: 0.02 });
    // nostril: a small curled scroll above the mouth line
    scroll(msTile, X, s * w * 0.17, H * 0.34, W * 0.045, s > 0 ? Math.PI : 0, s, 1.1, W * 0.010, 0.014, { z0: 0.025 });
    // gilt edge along the horn so the silhouette reads against the sky
    if (msGold) {
      const horn = bez([s * w * 0.88, H * 0.72], [s * w * 0.80, H * 0.80], [s * w * 0.66, H * 0.89], [s * w * 0.43, H * 1.00], 8);
      ridge2(msGold, X, horn.map(([x, y]) => [x * 0.94, y * 0.94 + H * 0.02]), W * 0.028, W * 0.024, 5, { z0: 0.03 });
    }
  }
  // 联珠 bead string around the raised border
  if (opts.relief !== false) {
    const nb = 18;
    const mid = outline.map(([x, y]) => [x * 0.92, y * 0.92 + H * 0.03]);
    const seg = []; let tot = 0;
    for (let i = 0; i < mid.length; i++) { const a = mid[i], b = mid[(i + 1) % mid.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); tot += l; }
    for (let k = 0; k < nb; k++) {
      let d = ((k + 0.5) / nb) * tot, i = 0;
      while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
      const a = mid[i], b = mid[(i + 1) % mid.length], t = seg[i] > 0 ? d / seg[i] : 0;
      const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      if (py < H * 0.05) continue;
      bead(msTile, X, px, py, W * 0.022, W * 0.02, 8, 0.04);
    }
  }
  // 剑把 — the sword hilt standing on the crown (the Ming/Qing marker of a chiwen)
  const ySw = H * 0.85, swW = W * 0.055;
  cbox(msTile, mul(X, xf([0, ySw + H * 0.075, 0])), swW, H * 0.15, T * 0.34, 0.004);
  cbox(msTile, mul(X, xf([0, ySw + H * 0.012, 0])), swW * 2.7, H * 0.024, T * 0.44, 0.004);
  if (opts.goldEdge && msGold) {
    const inner = outline.map(([x, y]) => [x * 0.955, y * 0.955 + H * 0.016]);
    extrude(msGold, X, outline, [inner], 0.0, 0.055);
  }
}

export { bez };
