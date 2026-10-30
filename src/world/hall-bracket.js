// ---------------------------------------------------------------------------
// hall-bracket: 组物 / tokyō bracket sets. Local frame at the column top
// centre: +X outward (perpendicular to the wall), +Z along the wall, +Y up.
// ---------------------------------------------------------------------------
import { cbox, extrude, xf, basis, mul } from './hall-lib.js';
import { lotusBlock } from './hall-orn.js';

const C = 0.014; // chamfer

// Bracket arm (肘木) along local Z with curved undersides at the ends.
function armZ(ms, X, x, y, z, half, h = 0.19, w = 0.19) {
  const pts = [[-half, h], [-half, h * 0.45]];
  const n = 5;
  for (let i = 1; i <= n; i++) { const t = i / n; const a = (t * Math.PI) / 2; pts.push([-half + 0.2 * (1 - Math.cos(a)), h * 0.45 * (1 - Math.sin(a))]); }
  for (let i = 0; i <= n; i++) { const a = (1 - i / n) * Math.PI / 2; pts.push([half - 0.2 * (1 - Math.cos(a)), h * 0.45 * (1 - Math.sin(a))]); }
  pts.push([half, h]);
  // shape XY = (z, y), extrude along x
  const t0 = ms.tint; ms.tint = 1;
  extrude(ms, mul(X, basis([x - w / 2, y, z], [0, 0, 1], [0, 1, 0], [1, 0, 0])), pts.map(([a, b]) => [a, b]), [], 0, w);
  ms.tint = t0;
}
// Arm along local X from x0 to x1 (outer end curved).
function armX(ms, X, x0, x1, y, z, h = 0.19, w = 0.19) {
  const L = x1 - x0;
  const pts = [[0, h], [0, 0]];
  const n = 5;
  for (let i = 0; i <= n; i++) { const a = (1 - i / n) * Math.PI / 2; pts.push([L - 0.2 * (1 - Math.cos(a)), h * 0.45 * (1 - Math.sin(a))]); }
  pts.push([L, h]);
  // shape XY = (x, y), extrude along z ; basis x->X, y->Y, z->Z
  const t0 = ms.tint; ms.tint = 1;
  extrude(ms, mul(X, basis([x0, y, z - w / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1])), pts, [], 0, w);
  ms.tint = t0;
}

function makito(red, gold, X, x, y, z, s = 0.15, h = 0.15, goldFace = true) {
  cbox(red, mul(X, xf([x, y + h / 2, z])), s, h / 2, s, C, { taper: [0.8, 0.8] });
}

// 斗拱出跳制（清式踩数）：'qimai' 七踩 (3 出跳)、'sanmai' 三踩 (1 出跳)、'flat' 不出跳
// opts.inter: 补间铺作（坐于荷叶墩之上，而非柱头）
export function bracketSet(acc, mats, X, type = 'qimai', opts = {}) {
  const red = acc.m(mats.bkt || mats.red), gold = acc.m(mats.gold), redD = acc.m(mats.redDark), redA = acc.m(mats.redA || mats.red);
  const AH = 0.19, MH = 0.15; // arm height, makito height
  const steps = type === 'qimai' ? 3 : type === 'sanmai' ? 1 : 0;
  const P = 0.44; // projection per step
  const lat = opts.lat || 0.62; // lateral arm half length
  let y = 0;
  red.tint = 0; // blocks / 荷叶墩: plain lacquer (arms set their own paint code)
  if (opts.inter) {
    lotusBlock(red, gold, mul(X, basis([0.0, 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0])), opts.kw || 1.0, 0.45, 0.18);
    makito(red, gold, X, 0, 0.45, 0, 0.17, 0.15);
    return 0.6;
  } else {
    // 大斗 (bearing block)
    cbox(red, mul(X, xf([0, 0.13, 0])), 0.20, 0.13, 0.20, C, { taper: [0.8, 0.8] });
    y = 0.26;
  }
  // level 1: lateral arm at wall line + outward arm
  armZ(red, X, 0, y, 0, lat);
  if (steps > 0) { armX(red, X, -0.5, P + 0.18, y, 0); }
  y += AH;
  makito(red, gold, X, 0, y, -lat + 0.16, 0.15, MH, false);
  makito(red, gold, X, 0, y, lat - 0.16, 0.15, MH, false);
  makito(red, gold, X, 0, y, 0, 0.15, MH, steps === 0);
  if (steps > 0) makito(red, gold, X, P, y, 0);
  y += MH;
  for (let s = 1; s <= steps; s++) {
    // lateral arm at projection s*P, outward arm continuing
    const xs = s * P;
    armZ(red, X, xs, y, 0, lat * (s === steps ? 1.05 : 0.95));
    if (s < steps) { armX(red, X, -0.2 + (s - 1) * P, (s + 1) * P + 0.18, y, 0); }
    y += AH;
    makito(red, gold, X, xs, y, -lat + 0.16);
    makito(red, gold, X, xs, y, lat - 0.16);
    makito(red, gold, X, xs, y, 0);
    if (s < steps) makito(red, gold, X, (s + 1) * P, y, 0);
    y += MH;
  }
  // 中式下昂（批竹昂嘴 / 斜下昂）：sloping cantilever through the set
  if (steps === 3) {
    // 昂身由内向外斜下探出 (slopes downward from interior tail to exterior beak)
    const p0 = [-0.72, 1.08, 0], p1 = [3 * P + 0.36, 0.86, 0];
    const d = [p1[0] - p0[0], p1[1] - p0[1], 0]; const L = Math.hypot(d[0], d[1]);
    const ax = [d[0] / L, d[1] / L, 0];
    const M = mul(X, basis([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0], ax, [-ax[1], ax[0], 0], [0, 0, 1]));
    cbox(redA, M, L / 2, 0.12, 0.13, 0.02);
    // 批竹昂嘴 (beveled bamboo-cut beak, 清水木雕本色，去鎏金铜套帽)
    const tip = [p1[0] + ax[0] * 0.04, p1[1] + ax[1] * 0.04, 0];
    cbox(redA, mul(X, basis(tip, ax, [-ax[1], ax[0], 0], [0, 0, 1])), 0.04, 0.11, 0.125, 0.01);
  }
  return y; // top height of the set (purlin bottom)
}

// Continuous lateral members connecting bracket sets along a wall (toshi-肘木
// / 手先桁). Called by the wall builder with world endpoints.
// p0,p1: wall-line points at column-top height (y of p0/p1 = column top).
export function bracketBeams(acc, mats, p0, p1, outward, type) {
  const red = acc.m(mats.bkt || mats.red);
  const AH = 0.19, P = 0.44;
  const steps = type === 'qimai' ? 3 : type === 'sanmai' ? 1 : 0;
  const levels = [];
  for (let s = 0; s < Math.max(1, steps); s++) levels.push([s * P, 0.6 + s * 0.34]);
  for (const [off, yb] of levels) {
    const a = [p0[0] + outward[0] * off, p0[1] + yb + AH / 2, p0[2] + outward[2] * off];
    const b = [p1[0] + outward[0] * off, p1[1] + yb + AH / 2, p1[2] + outward[2] * off];
    const d = [b[0] - a[0], 0, b[2] - a[2]]; const L = Math.hypot(d[0], d[2]);
    if (L < 0.3) continue;
    const ax = [d[0] / L, 0, d[2] / L];
    const side = [-ax[2], 0, ax[0]];
    const M = basis([(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2], ax, [0, 1, 0], side);
    red.tint = 2; // gunjō-blue soffit code for the paint shader
    cbox(red, M, L / 2, AH / 2, 0.095, C);
    red.tint = 1;
  }
}
