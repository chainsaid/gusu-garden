// ---------------------------------------------------------------------------
// Architectural assemblies for buildings.js: eaves (rafters, soffits, fascia,
// corner rafters), bracket sets, 歇山 roof (tiles, ridges, 螭吻,
// gable, 破风(已移除), 蟇股(已替换为悬鱼)), plain timber columns and 栏杆 railings.
// Everything in building-LOCAL coordinates (x along facade, z depth, +z front).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {
  LB, m4, beamM, chamferBox, block, taper, extrude, lathe, armGeo, lotusFinial,
  sweep, rectProfile, roundProfile, roofSurface, tileCapGeos, makeLift, sstep, clamp, hash3, ni,
} from './buildings-kit.js';

const V3 = THREE.Vector3;

export function loopPath(hx, hz, yFn, step = 0.3) {
  const pts = [];
  const corners = [[hx, hz], [-hx, hz], [-hx, -hz], [hx, -hz]];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) { const t = k / n; const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; pts.push(new V3(x, yFn(x, z), z)); }
  }
  return pts;
}
export function linePath(a, b, yFn, step = 0.25) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / step));
  const pts = [];
  for (let k = 0; k <= n; k++) { const t = k / n; const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; pts.push(new V3(x, yFn(x, z), z)); }
  return pts;
}

// ridge stack profile (熨斗瓦 layers + round 冠木 cap); drop = skirt below the ridge line
export function ridgeProfile(w, h, layers, capR, drop) {
  const P = [];
  P.push([-w * 0.62, -drop], [w * 0.62, -drop]);
  let yy = 0; const lh = (h - capR * 1.2) / layers;
  for (let i = 0; i < layers; i++) {
    const ww = w / 2 - i * (w * 0.035);
    P.push([ww, yy + lh * 0.12], [ww + 0.012, yy + lh * 0.55], [ww, yy + lh]);
    yy += lh;
  }
  for (let i = 0; i <= 8; i++) { const ang = (i / 8) * Math.PI; P.push([Math.cos(ang) * capR * 1.15, yy + capR * 0.35 + Math.sin(ang) * capR]); }
  for (let i = layers - 1; i >= 0; i--) {
    const ww = w / 2 - i * (w * 0.035);
    const y1 = (i + 1) * lh, y0 = i * lh;
    P.push([-ww, y1], [-ww - 0.012, y0 + lh * 0.55], [-ww, y0 + lh * 0.12]);
  }
  return P;
}

// rafters over a set of roof faces: along each face's inward direction n, spaced sp along u.
// yBot(d) = rafter bottom height at distance d from that face's eave (lift added).
export function rafterField(lb, faces, { sp, w, h, yBot, dStart, lift = () => 0, mat, capMat = null, offset = 0.5, lo = false }) {
  for (const F of faces) {
    const k0 = Math.ceil((F.u0 + 0.05) / sp - offset), k1 = Math.floor((F.u1 - 0.05) / sp - offset);
    for (let k = k0; k <= k1; k++) {
      const u = (k + offset) * sp;
      const dmin = Math.max(dStart, (F.dmin ? F.dmin(u) : 0) + w * 0.6);
      const dmax = F.dmax(u) - w * 0.6;
      if (dmax - dmin < 0.08) continue;
      const P = (d) => { const x = F.O[0] + F.a[0] * u + F.n[0] * d, z = F.O[1] + F.a[1] * u + F.n[1] * d; return [x, yBot(d) + lift(x, z) + h / 2, z]; };
      const a = P(dmin), b = P(dmax);
      const { m, len, x } = beamM(a, b);
      lb.add(chamferBox(len, h, w, lo ? 0 : Math.min(0.01, w * 0.12)), mat, m);
      if (capMat && dmin <= dStart + 1e-6) {
        const mc = beamM([a[0] - x.x * 0.004, a[1] - x.y * 0.004, a[2] - x.z * 0.004], [a[0] + x.x * 0.006, a[1] + x.y * 0.006, a[2] + x.z * 0.006]).m;
        lb.add(chamferBox(0.01, h + 0.01, w + 0.01, lo ? 0 : 0.002), capMat, mc);
      }
    }
  }
}

// the four hip sides of a rectangle (half extents hx, hz)
export function hipSides(hx, hz) {
  return [
    { O: [0, hz], a: [1, 0], n: [0, -1], half: hx, yaw: 0 },
    { O: [0, -hz], a: [-1, 0], n: [0, 1], half: hx, yaw: Math.PI },
    { O: [hx, 0], a: [0, -1], n: [-1, 0], half: hz, yaw: Math.PI / 2 },
    { O: [-hx, 0], a: [0, 1], n: [1, 0], half: hz, yaw: -Math.PI / 2 },
  ];
}

// ---------------------------------------------------------------------------
// EAVES: rafters (one or two tiers), soffit boards, 木负, fascia, purlin,
// wall plate, corner rafters. Returns levels + bell hook points.
// E = { cx, cz, ov, yWall, sBase, d1, rB:[w,h], 木负H, sFly, rF:[w,h], sp, fasciaH,
//       proj, lift, twoTier, K:{rafter, soffit, cap, beam}, capGold, 老角梁:true }
// ---------------------------------------------------------------------------
export function eaves(lb, E) {
  const K = E.K;
  const lift = E.lift || (() => 0);
  const ov = E.ov;
  const yBB = (d) => E.yWall - E.sBase * (ov - d);
  const yBT = (d) => yBB(d) + E.rB[1];
  const two = E.twoTier !== false;
  const d1 = two ? E.d1 : 0;
  const yFB = (d) => yBT(d1) + E.kioiH - E.sFly * (d1 - d);
  const yFT = (d) => yFB(d) + E.rF[1];
  const yTipTop = two ? yFT(0) : yBT(0);
  const fasciaTop = yTipTop + E.fasciaH;
  const sides = hipSides(E.cx + ov, E.cz + ov);
  const hooks = [];
  const capT = 0.008;

  const rafter = (S, u, dA, dB, yBot, w, h, gold) => {
    const pA = [S.O[0] + S.a[0] * u + S.n[0] * dA, 0, S.O[1] + S.a[1] * u + S.n[1] * dA];
    const pB = [S.O[0] + S.a[0] * u + S.n[0] * dB, 0, S.O[1] + S.a[1] * u + S.n[1] * dB];
    pA[1] = yBot(dA) + lift(pA[0], pA[2]) + h / 2; pB[1] = yBot(dB) + lift(pB[0], pB[2]) + h / 2;
    const { m, len, x } = beamM(pA, pB);
    lb.add(chamferBox(len, h, w, E.lo ? 0 : Math.min(0.012, w * 0.12)), K.rafter, m);
  };

  for (const S of sides) {
    const half = S.half;
    const kmax = Math.floor((half - 0.1) / E.sp);
    for (let k = -kmax; k <= kmax; k++) {
      const u = k * E.sp;
      const dclip = half - Math.abs(u);
      if (two) {
        const dEF = Math.min(d1 + 0.12, dclip - E.rF[0] * 0.7);
        if (dEF > 0.1) rafter(S, u, 0, dEF, yFB, E.rF[0], E.rF[1], E.capGold);
        const dsB = d1 - 0.13;
        const dEB = Math.min(ov + 0.12, dclip - E.rB[0] * 0.7);
        if (dEB - dsB > 0.1) rafter(S, u, dsB, dEB, yBB, E.rB[0], E.rB[1], E.capGold);
      } else {
        const dEB = Math.min(ov + 0.12, dclip - E.rB[0] * 0.7);
        if (dEB > 0.1) rafter(S, u, 0, dEB, yBB, E.rB[0], E.rB[1], E.capGold);
      }
    }
  }
  // soffit boards (face down)
  const soff = (prof, dmin, dmax) => {
    const faces = sides.map((S) => ({ O: S.O, a: S.a, n: S.n, u0: -S.half, u1: S.half, y0: 0, prof,
      dmin: (u) => dmin, dmax: (u) => Math.min(dmax, S.half - Math.abs(u)) }));
    const { geo } = roofSurface(faces, null, lift, { flip: true, du: 0.25, dd: 0.3 });
    geo.deleteAttribute('color');
    lb.add(geo, K.soffit);
  };
  if (two) { soff(yFT, 0, d1); soff(yBT, d1 - 0.005, ov + 0.06); } else soff(yBT, 0, ov + 0.06);
  // 木负 + infill boards
  if (two) {
    const hx = E.cx + ov - d1, hz = E.cz + ov - d1;
    const path = loopPath(hx, hz, (x, z) => yBT(d1) + lift(x, z), 0.3);
    lb.add(sweep(path, rectProfile(0.13, E.kioiH), { closed: true, outward: true }), K.beam);
    lb.add(sweep(path, rectProfile(0.035, yFT(d1) - yBT(d1) + 0.01, 0), { closed: true, outward: true }), K.soffit);
  }
  // fascia (连檐) with a top shelf reaching under the tile lip
  {
    const hx = E.cx + ov - 0.045, hz = E.cz + ov - 0.045;
    const path = loopPath(hx, hz, (x, z) => yTipTop + lift(x, z), 0.25);
    const prof = [[-0.045, 0], [0.045, 0], [0.045, E.fasciaH - 0.025], [0.15, E.fasciaH - 0.025], [0.15, E.fasciaH], [-0.045, E.fasciaH]];
    lb.add(sweep(path, prof, { closed: true, outward: true }), K.beam);
  }
  // purlin on the bracket ends + wall plate
  if (E.proj) {
    const dp = ov - E.proj;
    const hx = E.cx + E.proj, hz = E.cz + E.proj;
    lb.add(sweep(loopPath(hx, hz, (x, z) => yBB(dp) - 0.17 + lift(x, z), 0.3), rectProfile(0.15, 0.17), { closed: true, outward: true }), K.beam);
  }
  lb.add(sweep(loopPath(E.cx, E.cz, (x, z) => E.yWall - 0.17 + lift(x, z), 0.3), rectProfile(0.17, 0.17), { closed: true, outward: true }), K.beam);

  // corner rafters (老角梁)
  if (E.sumigi !== false) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const Q = (t) => [sx * (E.cx + t), sz * (E.cz + t)];
      const path = (t0, t1, yf, dy = 0) => {
        const pts = []; const n = Math.max(2, Math.ceil((t1 - t0) / 0.15));
        for (let i = 0; i <= n; i++) { const t = t0 + ((t1 - t0) * i) / n; const q = Q(t); pts.push(new V3(q[0], yf(ov - t) + lift(q[0], q[1]) + dy, q[1])); }
        return pts;
      };
      const tip = ov + (E.tipOut ?? 0.36);
      if (two) {
        lb.add(sweep(path(-0.2, ov - d1 + 0.05, yBT), rectProfile(0.19, 0.27, -0.27)), K.beam);
        lb.add(sweep(path(ov - d1 - 0.3, tip, yFT), rectProfile(0.17, 0.22, -0.22)), K.beam);
      } else {
        lb.add(sweep(path(-0.2, tip, yBT), rectProfile(0.17, 0.24, -0.24)), K.beam);
      }
      const ytop = (two ? yFT : yBT)(ov - tip);
      const q = Q(tip); const qi = Q(tip - 0.05);
      const yq = ytop + lift(q[0], q[1]);
      const dir = new V3(q[0] - qi[0], 0, q[1] - qi[1]).normalize();
      const yaw = Math.atan2(dir.x, dir.z);
      // slope of the tip
      const q2 = Q(tip - 0.3); const y2 = (two ? yFT : yBT)(ov - tip + 0.3) + lift(q2[0], q2[1]);
      const pitch = Math.atan2(yq - y2, 0.3 * Math.SQRT2);
      const hh = two ? 0.22 : 0.24;
      lb.add(chamferBox(0.2, hh + 0.02, 0.016, 0.004), K.cap, m4([q[0] + dir.x * 0.004, yq - hh / 2, q[1] + dir.z * 0.004], [-pitch, yaw, 0]));
      lb.add(chamferBox(0.2, hh + 0.02, 0.1, 0.004), K.cap, m4([q[0] - dir.x * 0.05, yq - hh / 2, q[1] - dir.z * 0.05], [-pitch, yaw, 0]).multiply(new THREE.Matrix4().makeScale(1.04, 1.04, 1)));
      hooks.push({ local: [q[0] - dir.x * 0.08, yq - hh - 0.01, q[1] - dir.z * 0.08], corner: [sx, sz] });
    }
  }
  return { yBB, yBT, yFB, yFT, fasciaTop, yTipTop, hooks };
}

// ---------------------------------------------------------------------------
// BRACKET SET (组物). Frame: origin at the plate top over the column,
// +x along the wall, +z outward. tiers: 1..3. corner: arms along +z, +x, diag.
// S = { tiers, proj:[p1,p2], armH, armW, blockH, 大斗:[w,h], mak:[w,h], wall:[L1,L2,L3], inner, corner, K }
// returns total height
// ---------------------------------------------------------------------------
export function bracketSet(lb, frame, S) {
  const K = S.K;
  const b = lb.child(frame);
  const aH = S.armH, aW = S.armW, bH = S.blockH;
  const [dW, dH] = S.daito, [mW] = S.mak;
  // 大斗
  b.add(block(dW, dH, dW), K.wood);
  let y = dH;
  const tiers = S.tiers;
  const mak = (x, z, yy, front = false, rotY = 0) => {
    b.add(block(mW, bH, mW), K.wood, m4([x, yy, z], [0, rotY, 0]));
  };
  const projArm = (L0, L1, yy, rotY = 0, gcap = true) => {
    // arm along local direction rotY (0 -> +z), from -L0 to +L1
    const L = L0 + L1, mid = (L1 - L0) / 2;
    const c = Math.cos(rotY), s = Math.sin(rotY);
    b.add(armGeo(L, aH, aW, S.lo), K.wood, m4([s * mid, yy, c * mid], [0, rotY - Math.PI / 2, 0]));
  };
  for (let t = 0; t < tiers; t++) {
    const isLast = t === tiers - 1;
    const pz = t < S.proj.length ? S.proj[t] : null;
    // wall-parallel arm
    const L = S.wall[t];
    if (!S.corner) {
      b.add(armGeo(L, aH, aW, S.lo), K.wood, m4([0, y, 0]));
    } else {
      // corner: half arms along -x and -z
      b.add(armGeo(L * 0.5 + 0.1, aH, aW, S.lo), K.wood, m4([-(L * 0.25) + 0.05, y, 0]));
      b.add(armGeo(L * 0.5 + 0.1, aH, aW, S.lo), K.wood, m4([0, y, -(L * 0.25) + 0.05], [0, Math.PI / 2, 0]));
    }
    if (pz !== null) {
      const back = S.inner ? pz : 0.12;
      if (!S.corner) projArm(back, pz + 0.1, y, 0);
      else {
        projArm(0.12, pz + 0.1, y, 0); projArm(0.12, pz + 0.1, y, Math.PI / 2);
        projArm(0.1, pz * Math.SQRT2 + 0.12, y, Math.PI / 4);
      }
    }
    y += aH;
    // blocks
    if (!S.corner) {
      mak(L / 2 - mW * 0.55, 0, y); mak(-L / 2 + mW * 0.55, 0, y); mak(0, 0, y);
    } else {
      mak(-L / 2 + mW * 0.55, 0, y); mak(0, -L / 2 + mW * 0.55, y); mak(0, 0, y);
    }
    if (pz !== null) {
      if (!S.corner) { mak(0, pz, y, true); if (S.inner) mak(0, -pz, y); }
      else {
        mak(0, pz, y, true); mak(pz, 0, y, true, Math.PI / 2);
        mak(pz * 0.72, pz * 0.72, y, true, Math.PI / 4);
      }
    }
    y += bH;
  }
  return y;
}

// ---------------------------------------------------------------------------
// COLUMN with an optional stone base; the timber shaft remains unbanded.
// ---------------------------------------------------------------------------
export function column(lb, K, x, z, yb, yt, r, o = {}) {
  lb.add(new THREE.CylinderGeometry(r, r * 1.01, yt - yb, o.seg || 28, 1), K.col, m4([x, (yb + yt) / 2, z]));
  if (o.base) {
    // stone base (础石) with a round rim
    const R = r * 1.55;
    lb.add(lathe([[0, -0.3], [R * 1.05, -0.3], [R * 1.05, -0.02], [R, 0.0], [r * 1.25, 0.03], [r * 1.12, o.baseH || 0.08], [0, o.baseH || 0.08]], 24, 'soseki' + r), K.stone, m4([x, yb - (o.baseH || 0.08), z]));
  }
}

// ---------------------------------------------------------------------------
// 歇山屋顶: tiles, ridges, 螭吻, gable (山花), 破风(已移除), 悬鱼.
// R = { ex, ez, y0, prof(d), gd, ov, lift, T, K, ridge:{h,w}, hip:{w,h}, chiwen:{s}, gableDeco }
// ---------------------------------------------------------------------------
export function irimoyaRoof(lb, R) {
  const K = R.K, T = R.T, lift = R.lift;
  const { ex, ez, gd, ov } = R;
  const xg = ex - gd, xv = xg + ov, zb = ez - gd, zj = ez - (gd - ov);
  const yAt = (x, z, d) => R.y0 + R.prof(d) + lift(x, z);
  const yFront = (x, z) => yAt(x, z, ez - Math.abs(z));
  const ySide = (x, z) => yAt(x, z, ex - Math.abs(x));
  const yRidge = R.y0 + R.prof(ez);
  const faces = [];
  for (const [sgn, O, a, n] of [[1, [0, ez], [1, 0], [0, -1]], [-1, [0, -ez], [-1, 0], [0, 1]]]) {
    const hip = (u) => ex - Math.abs(u);
    faces.push({ O, a, n, y0: R.y0, prof: R.prof, lip: true, u0: -ex, u1: -xv, dmax: hip });
    faces.push({ O, a, n, y0: R.y0, prof: R.prof, lip: true, u0: -xv, u1: xv, dmax: () => ez });
    faces.push({ O, a, n, y0: R.y0, prof: R.prof, lip: true, u0: xv, u1: ex, dmax: hip });
  }
  for (const [O, a, n] of [[[ex, 0], [0, -1], [-1, 0]], [[-ex, 0], [0, 1], [1, 0]]]) {
    faces.push({ O, a, n, y0: R.y0, prof: R.prof, lip: true, u0: -ez, u1: ez, dmax: (u) => Math.min(gd, ez - Math.abs(u)) });
  }
  const { geo, caps } = roofSurface(faces, T, lift);
  lb.addIx(geo, K.tileVC);
  // round tile end caps
  const [cd, cg] = tileCapGeos(T.rw * 0.55, T.detail);
  for (const c of caps) {
    const yaw = Math.atan2(c.out[0], c.out[1]);
    const mm = m4(c.pos, [0, yaw, 0]);
    lb.add(cd, K.tile, mm); lb.add(cg, R.capGoldMat || K.tile, mm);
  }
  // ---- ridges
  const rw = R.ridge.w, rh = R.ridge.h;
  const ridgeProf = (w, h, layers, capR, drop) => {
    const P = [];
    P.push([-w * 0.62, -drop], [w * 0.62, -drop]);
    let yy = 0; const lh = (h - capR * 1.2) / layers;
    for (let i = 0; i < layers; i++) {
      const ww = w / 2 - i * (w * 0.035);
      P.push([ww, yy + lh * 0.12], [ww + 0.012, yy + lh * 0.55], [ww, yy + lh]);
      yy += lh;
    }
    const cr = capR;
    for (let i = 0; i <= 8; i++) { const ang = (i / 8) * Math.PI; P.push([Math.cos(ang) * cr * 1.15, yy + cr * 0.35 + Math.sin(ang) * cr]); }
    for (let i = layers - 1; i >= 0; i--) {
      const ww = w / 2 - i * (w * 0.035);
      const y1 = (i + 1) * lh, y0 = i * lh;
      P.push([-ww, y1], [-ww - 0.012, y0 + lh * 0.55], [-ww, y0 + lh * 0.12]);
    }
    return P;
  };
  // main ridge
  const mainProf = ridgeProf(rw, rh, R.ridge.layers || 6, R.ridge.capR || 0.11, R.ridge.drop || 0.42);
  lb.add(sweep(linePath([-xv - 0.1, 0], [xv + 0.1, 0], () => yRidge - 0.02, 0.5), mainProf), K.tile);
  // descending ridges (kudarimune) along the verges, and hip ridges (sumimune)
  const hipProf = ridgeProf(R.hip.w, R.hip.h, R.hip.layers || 4, R.hip.capR || 0.075, R.hip.drop || 0.2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const xk = sx * (xv - R.hip.w * 0.55);
    lb.add(sweep(linePath([xk, 0], [xk, sz * (zj - 0.12)], (x, z) => yFront(x, z) - 0.02, 0.2), hipProf), K.tile);
    // hip ridge from J to the eave corner
    const J = [sx * (xv - 0.05), sz * (zj - 0.05)], C = [sx * (ex + 0.04), sz * (ez + 0.04)];
    lb.add(sweep(linePath(J, C, (x, z) => Math.min(yFront(x, z), ySide(x, z)) - 0.02, 0.15), hipProf), K.tile);
  }
  // mizukiri ridge at the gable base + gable
  for (const sx of [-1, 1]) {
    const x = sx * (xg + 0.08);
    lb.add(sweep(linePath([x, -zb + 0.05], [x, zb - 0.05], () => R.y0 + R.prof(gd) - 0.02, 0.5), ridgeProf(0.18, 0.12, 2, 0.05, 0.1)), K.tile);
  }
  // ---- 螭吻 (chiwen) — the dragon-head ridge-end ornament.
  // Silhouette: a flaring jaw, the mouth line, wide cheekbones, a brow, two
  // horns curling up over a crown. (was: 鬼瓦(已替换为螭吻) + tori-busuma)
  const chiwenGeo = (s) => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.43 * s, 0); sh.lineTo(0.43 * s, 0);
    sh.lineTo(0.49 * s, 0.13 * s);
    sh.quadraticCurveTo(0.40 * s, 0.20 * s, 0.41 * s, 0.25 * s);          // mouth line
    sh.quadraticCurveTo(0.53 * s, 0.33 * s, 0.49 * s, 0.50 * s);          // cheekbone
    sh.quadraticCurveTo(0.51 * s, 0.63 * s, 0.44 * s, 0.72 * s);          // brow
    sh.quadraticCurveTo(0.33 * s, 0.89 * s, 0.22 * s, 1.00 * s);          // horn
    sh.quadraticCurveTo(0.12 * s, 0.94 * s, 0, 0.85 * s);                 // crown between the horns
    sh.quadraticCurveTo(-0.12 * s, 0.94 * s, -0.22 * s, 1.00 * s);
    sh.quadraticCurveTo(-0.33 * s, 0.89 * s, -0.44 * s, 0.72 * s);
    sh.quadraticCurveTo(-0.51 * s, 0.63 * s, -0.49 * s, 0.50 * s);
    sh.quadraticCurveTo(-0.53 * s, 0.33 * s, -0.41 * s, 0.25 * s);
    sh.quadraticCurveTo(-0.40 * s, 0.20 * s, -0.49 * s, 0.13 * s);
    sh.lineTo(-0.43 * s, 0);
    const body = extrude(sh, 0.16 * s, 0.025 * s, 'chiwen' + s, 8);
    const rim = new THREE.Shape();
    rim.moveTo(-0.36 * s, 0.13 * s); rim.lineTo(0.36 * s, 0.13 * s); rim.lineTo(0.40 * s, 0.32 * s);
    rim.quadraticCurveTo(0.42 * s, 0.60 * s, 0.30 * s, 0.74 * s);
    rim.quadraticCurveTo(0.20 * s, 0.84 * s, 0.16 * s, 0.90 * s); rim.lineTo(0, 0.79 * s); rim.lineTo(-0.16 * s, 0.90 * s);
    rim.quadraticCurveTo(-0.20 * s, 0.84 * s, -0.30 * s, 0.74 * s);
    rim.quadraticCurveTo(-0.42 * s, 0.60 * s, -0.40 * s, 0.32 * s); rim.lineTo(-0.36 * s, 0.13 * s);
    const inner = extrude(rim, 0.05 * s, 0.012 * s, 'chiwenr' + s, 8).translate(0, 0, 0.09 * s);
    return [body, inner];
  };
  const placeChiwen = (pos, yaw, s) => {
    const [body, inner] = chiwenGeo(s);
    const mm = m4(pos, [0, yaw, 0]);
    lb.add(body, K.tile, mm); lb.add(inner, K.tile, mm);
    // bulging eyes
    for (const sx of [-1, 1]) {
      const e = new THREE.SphereGeometry(0.075 * s, 10, 6);
      e.scale(1, 1, 0.7); e.translate(sx * 0.21 * s, 0.54 * s, 0.10 * s);
      lb.add(e, K.tile, mm);
    }
    // 剑把 — the sword hilt that pins the dragon to the ridge
    const guard = new THREE.BoxGeometry(0.17 * s, 0.035 * s, 0.06 * s); guard.translate(0, 0.86 * s, -0.02 * s);
    const grip = new THREE.BoxGeometry(0.055 * s, 0.19 * s, 0.05 * s); grip.translate(0, 0.95 * s, -0.02 * s);
    lb.add(guard, K.tile, mm); lb.add(grip, K.tile, mm);
  };
  for (const sx of [-1, 1]) {
    placeChiwen([sx * (xv + 0.14), yRidge - 0.32, 0], sx * Math.PI / 2, R.chiwen.s);
    for (const sz of [-1, 1]) {
      // corner beast (hip ends)
      const cxp = sx * (ex + 0.08), czp = sz * (ez + 0.08);
      placeChiwen([cxp, Math.min(yFront(cxp, czp), ySide(cxp, czp)) - 0.08, czp], Math.atan2(sx, sz), R.chiwen.s * 0.55);
      // descending-ridge lower end beast
      const xk = sx * (xv - R.hip.w * 0.55), zk = sz * (zj - 0.05);
      placeChiwen([xk, yFront(xk, zk) - 0.1, zk], sz > 0 ? 0 : Math.PI, R.chiwen.s * 0.5);
    }
  }
  // ---- gable: 破风(已移除) bargeboards, verge round tiles, 蟇股(已替换为悬鱼), verge soffit, 山花 wall
  for (const sx of [-1, 1]) {
    const xh = sx * (xv + 0.035);
    const vy = (z) => yFront(sx * xv, z);
    const vpath = linePath([xh, -zj + 0.02], [xh, zj - 0.02], (x, z) => vy(z) - 0.06, 0.12);
    lb.add(sweep(vpath, rectProfile(0.07, R.hafuH || 0.38, -(R.hafuH || 0.38))), K.red);
    // verge round tile (kerabagawara)
    lb.add(sweep(linePath([sx * (xv - 0.02), -zj], [sx * (xv - 0.02), zj], (x, z) => vy(z) + T.rh * 0.35, 0.12), roundProfile(T.rw * 0.55, 0, 8), { smooth: true }), K.tile);
    // studs on the 破风(已移除): dark wood
    const darkMat = K.redDark || K.red;
    for (const zz of [-zj * 0.7, -zj * 0.4, zj * 0.4, zj * 0.7]) {
      lb.add(chamferBox(0.03, 0.03, 0.01, 0.003), darkMat, m4([sx * (xv + 0.072), vy(zz) - 0.06 - (R.hafuH || 0.38) * 0.5, zz], [0, sx * Math.PI / 2, 0]));
    }
    // 破风(已移除) ends: wood fittings
    for (const sz of [-1, 1]) {
      const zz = sz * (zj - 0.12);
      lb.add(chamferBox(0.085, (R.hafuH || 0.38) + 0.02, 0.22, 0.008), darkMat, m4([xh, vy(zz) - 0.06 - (R.hafuH || 0.38) / 2, zz]));
    }
    // 悬鱼 (xuanyu / pendant fish ornament) at the gable apex: carved wood
    const gs = R.xuanyu || R.gegyo || 0.6;
    const gsh = new THREE.Shape();
    gsh.moveTo(0, 0.05 * gs);
    gsh.bezierCurveTo(0.25 * gs, 0.0, 0.5 * gs, -0.05 * gs, 0.55 * gs, -0.22 * gs);
    gsh.bezierCurveTo(0.45 * gs, -0.18 * gs, 0.38 * gs, -0.26 * gs, 0.3 * gs, -0.2 * gs);
    gsh.bezierCurveTo(0.22 * gs, -0.36 * gs, 0.1 * gs, -0.42 * gs, 0, -0.62 * gs);
    gsh.bezierCurveTo(-0.1 * gs, -0.42 * gs, -0.22 * gs, -0.36 * gs, -0.3 * gs, -0.2 * gs);
    gsh.bezierCurveTo(-0.38 * gs, -0.26 * gs, -0.45 * gs, -0.18 * gs, -0.55 * gs, -0.22 * gs);
    gsh.bezierCurveTo(-0.5 * gs, -0.05 * gs, -0.25 * gs, 0.0, 0, 0.05 * gs);
    const gg = extrude(gsh, 0.05, 0.012, 'xuanyu' + gs, 10);
    lb.add(gg, darkMat, m4([sx * (xv + 0.08), vy(0) - 0.06 - (R.hafuH || 0.38) * 0.6, 0], [0, sx * Math.PI / 2, 0]));
    // verge soffit (underside of the gable overhang)
    const vfaces = [];
    for (const [O, a, n] of [[[0, ez], [1, 0], [0, -1]], [[0, -ez], [-1, 0], [0, 1]]]) {
      const ua = sx > 0 ? xg - 0.05 : -xv, ub = sx > 0 ? xv : -xg + 0.05;
      const u0 = a[0] > 0 ? ua : -ub, u1 = a[0] > 0 ? ub : -ua;
      vfaces.push({ O, a, n, y0: R.y0, prof: R.prof, u0, u1, dmin: (u) => ex - Math.abs(u) + 0.12, dmax: () => ez });
    }
    const vs = roofSurface(vfaces, null, lift, { flip: true, du: 0.2, dd: 0.25, yOff: -0.24 }).geo;
    vs.deleteAttribute('color');
    lb.add(vs, K.soffit);
    // purlin ends through the gable
    for (const zz of [0, -zb * 0.55, zb * 0.55]) {
      const yy = yFront(sx * xv, zz) - 0.24 - 0.1;
      lb.add(chamferBox(ov + 0.12, 0.18, 0.15, 0.012), K.red, m4([sx * (xg + ov / 2 - 0.02), yy, zz]));
      lb.add(chamferBox(0.012, 0.19, 0.16, 0.003), K.gold, m4([sx * (xv - 0.0), yy, zz]));
    }
    // 山花 (gable wall): plaster triangle + vermilion frame + gold
    const nz = 16;
    const tri = [];
    const gx = sx * xg;
    const yb0 = R.y0 + R.prof(gd) + 0.02;
    const topY = (z) => Math.max(yb0, yFront(gx, z) - 0.26);
    const pos = [];
    for (let i = 0; i < nz; i++) {
      const z0 = -zb + (2 * zb * i) / nz, z1 = -zb + (2 * zb * (i + 1)) / nz;
      const q = [[gx, yb0, z0], [gx, yb0, z1], [gx, topY(z1), z1], [gx, topY(z0), z0]];
      if (sx > 0) pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
      else pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.computeVertexNormals();
    lb.add(tg, K.plaster);
    // frame: base beam, struts, tie beam, sloped rafters (clipped to stay under the roof)
    const fx = gx + sx * 0.04;
    const zClip = (yNeed) => { let lo = 0, hi = zb; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (yFront(gx, m) - 0.3 >= yNeed) lo = m; else hi = m; } return lo; };
    const zB = zClip(yb0 + 0.24);
    lb.add(chamferBox(0.12, 0.24, 2 * zB, 0.015), K.red, m4([fx, yb0 + 0.12, 0]));
    const yTie = yb0 + (topY(0) - yb0) * 0.45;
    const zt = Math.min(zb * 0.62, zClip(yTie + 0.1));
    lb.add(chamferBox(0.11, 0.18, 2 * zt, 0.015), K.red, m4([fx, yTie, 0]));
    for (const zz of [0, -zt * 0.55, zt * 0.55]) {
      const yt = topY(zz);
      lb.add(chamferBox(0.11, yt - yb0 - 0.24, 0.12, 0.012), K.red, m4([fx, (yb0 + 0.24 + yt) / 2, zz]));
    }
    for (const sz of [-1, 1]) {
      const pts = linePath([fx, sz * zB], [fx, 0], (x, z) => yFront(gx, z) - 0.31, 0.25);
      lb.add(sweep(pts, rectProfile(0.11, 0.16, -0.08)), K.red);
    }
    if (R.gableLattice) {
      // kitsune-goshi: vertical lattice in the upper triangle
      for (let zz = -zt + 0.1; zz <= zt - 0.1; zz += 0.14) {
        const yt = topY(zz) - 0.12;
        if (yt - yTie < 0.2) continue;
        lb.add(chamferBox(0.04, yt - yTie - 0.09, 0.035, 0.006), K.lattice, m4([fx + sx * 0.02, (yt + yTie + 0.09) / 2, zz]));
      }
    }
  }
  return { yRidge, xg, xv, zb, zj, yFront, ySide };
}

// ---------------------------------------------------------------------------
// KORAN railing along an open polyline (local plan points) at floor height y0.
// S = { H, post, gib, K, lotusEvery, panel }
// ---------------------------------------------------------------------------
export function railing(lb, pts, y0, S) {
  const K = S.K;
  const H = S.H || 0.85;
  const pw = S.post || 0.13;
  const posts = [];
  for (let i = 0; i < pts.length; i++) {
    posts.push(pts[i]);
    if (i < pts.length - 1) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(L / (S.spacing || 1.4)));
      for (let k = 1; k < n; k++) posts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, 'mid']);
    }
  }
  // posts: Jiangnan wooden baluster with lotus finial (苏式莲瓣望柱头)
  const darkPost = K.redDark || K.red;
  for (const p of posts) {
    const yTop = y0 + H + 0.04;
    lb.add(chamferBox(pw, yTop - y0, pw, 0.012), K.red, m4([p[0], (y0 + yTop) / 2, p[1]]));
    lb.add(chamferBox(pw + 0.02, 0.025, pw + 0.02, 0.005), darkPost, m4([p[0], yTop + 0.012, p[1]]));
    lb.add(lathe([[0, 0], [pw * 0.42, 0], [pw * 0.46, 0.022], [pw * 0.38, 0.055], [pw * 0.18, 0.09], [0, 0.11]], 12, 'lotusFinial'), darkPost, m4([p[0], yTop + 0.025, p[1]]));
  }
  // rails
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // top rail (round)
    lb.add(new THREE.CylinderGeometry(0.042, 0.042, L, 16, 1), K.red, m4([mid[0], y0 + H - 0.05, mid[1]], [Math.PI / 2, yaw, 0]));
    // mid rail (flat) and bottom rail
    lb.add(chamferBox(0.05, 0.085, L, 0.01), K.red, m4([mid[0], y0 + (S.midY || 0.5), mid[1]], [0, yaw, 0]));
    lb.add(chamferBox(0.08, 0.1, L, 0.012), K.red, m4([mid[0], y0 + 0.07, mid[1]], [0, yaw, 0]));
    // short struts between top & mid rail (or gilt relief panels), panels between mid & bottom rail
    const n = S.K.relief ? 0 : Math.max(2, Math.round(L / 0.45));
    for (let k = 1; k < n; k++) {
      const t = k / n; const x = a[0] + dx * t, z = a[1] + dz * t;
      const isPost = posts.some((p) => Math.hypot(p[0] - x, p[1] - z) < 0.2);
      if (isPost) continue;
      lb.add(chamferBox(0.04, H - 0.05 - (S.midY || 0.5) - 0.04, 0.04, 0.005), K.red,
        m4([x, (y0 + (S.midY || 0.5) + y0 + H - 0.05) / 2, z], [0, yaw, 0]));
    }
    // panel boards
    const segs = posts.filter((p) => {
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (L * L);
      const dist = Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L;
      return t >= -1e-3 && t <= 1 + 1e-3 && dist < 0.02;
    }).map((p) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (L * L)).sort((x, y) => x - y);
    for (let k = 0; k < segs.length - 1; k++) {
      const t0 = segs[k], t1 = segs[k + 1];
      const len = (t1 - t0) * L - pw;
      if (len < 0.2) continue;
      const tc = (t0 + t1) / 2; const x = a[0] + dx * tc, z = a[1] + dz * tc;
      const ph = (S.midY || 0.5) - 0.12 - 0.04;
      lb.add(chamferBox(0.03, ph, len, 0.006), K.redDark, m4([x, y0 + 0.12 + ph / 2, z], [0, yaw, 0]));
      if (S.panelGold !== false) {
        const gw = Math.min(len * 0.55, 0.5);
        lb.add(chamferBox(0.012, ph * 0.55, gw, 0.002), K.red, m4([x, y0 + 0.12 + ph / 2, z], [0, yaw, 0]));
      }
    }
  }
}
