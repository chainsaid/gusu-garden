// 江南园林名木系统 (Web 实时版)
// ---------------------------------------------------------------------------
// 移植母本 src/world/vegetation-tree.js 的几何生成器 (递归分枝骨架 + BarkAccum 树皮管)
// 与 src/world/vegetation-tex.js 的程序化叶贴图, 在 Web 端复刻电影级树冠。
// 叶卡用小尺寸密排的 InstancedMesh (每叶独立朝向), 树冠内嵌暗色 CushionAccum 内核
// 以避免从缝隙看穿。垂柳柔条保留原移植实现。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../../../shared/layout.js';
import {
  genMaple, genPine, genTiered, genCrabapple,
  BarkAccum, trunkDisp, sampleBranch, padLocal, padNormal, padTopF,
  randUnit, vnoise3, perpOf,
} from '../../../src/world/vegetation-tree.js';
import { CushionAccum, naturalCrownPoint } from '../../../src/world/vegetation-core.js';
import { makeMapleAtlas, makePineAtlas, makeBlossomAtlas } from '../../../src/world/vegetation-tex.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const TAU = Math.PI * 2;
// 晨曦阳光方向 (用于叶卡法线朝向太阳半球, 保持透射观感)
const SUN = V3(0.35, 0.72, 0.6).normalize();

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    sphere: () => {
      const z = next() * 2 - 1, a = next() * TAU, r = Math.sqrt(Math.max(0, 1 - z * z));
      return [r * Math.cos(a), z, r * Math.sin(a)];
    },
  };
}

function orthoBasis(axis) {
  const Z = axis.clone().normalize();
  const t = Math.abs(Z.y) < 0.95 ? UP : V3(1, 0, 0);
  const X = new THREE.Vector3().crossVectors(Z, t).normalize();
  const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
  return [X, Y, Z];
}

// 单叶片卡片几何: 平面位于 XY、法线 +Z, uv 映射到 atlas 的指定 2x2 cell
function cardGeo(cell) {
  const g = new THREE.PlaneGeometry(1, 1);
  const cellX = (cell % 2) * 0.5, cellY = Math.floor(cell / 2) * 0.5;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, cellX + 0.5 * u, cellY + 0.5 - 0.5 * v);
  }
  uv.needsUpdate = true;
  return g;
}

// 叶卡累积器: 按 atlas cell 分桶, 最后合批为多个 InstancedMesh
class LeafBank {
  constructor() { this.cells = []; this.mats = []; this.cols = []; }
  push(cell, m, col) { this.cells.push(cell); this.mats.push(m); this.cols.push(col); }
  get count() { return this.mats.length; }
}

// 松针数据贴图 → 亮度烘焙: 默认 map_fragment 会把 r=shade × g=along × b=tint 三通道连乘,
// 针叶基部 (along=0) 直接黑掉。母本用 shader 提亮针尖, 这里等价地把解码结果烘进 RGB。
function bakePineAtlasLuminance(tex) {
  const d = tex.image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const shade = d[i] / 255, along = d[i + 1] / 255;
    const L = (0.35 + 0.75 * shade) * (0.3 + 1.05 * along * along * (3 - 2 * along));
    const v = Math.max(0, Math.min(255, Math.round(L * 255)));
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  tex.needsUpdate = true;
}

// 枫叶数据贴图 → 亮度烘焙: 等价母本解码 col *= (0.42+0.9*shade)*(0.88+0.24*blotch),
// 但不乘 g=grad (叶基->叶尖梯度, 连乘会把半片叶压到近黑)
function bakeMapleAtlasLuminance(tex) {
  const d = tex.image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const shade = d[i] / 255, blotch = d[i + 2] / 255;
    const L = (0.42 + 0.9 * shade) * (0.88 + 0.24 * blotch);
    const v = Math.max(0, Math.min(255, Math.round(L * 255)));
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  tex.needsUpdate = true;
}

// ---- 材质 ----
// 不用 onBeforeCompile 注入 (与 EffectComposer/UnrealBloom 的 RT 管线相冲导致黑屏)。
// 数据通道贴图 (r=shade, g=沿叶梯度, b=噪点) 直接经默认 map_fragment 以灰度调制 diffuse,
// 色相全部由 instanceColor (逐叶烘焙) 提供 —— 观感接近母本的通道解码方案。
function makeFoliageMaterial(atlas, kind, emissive) {
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, transparent: false });
  mat.map = atlas;
  if (emissive) {
    // 廉价透光补偿: 母本 foliage shader 有背光透射项, 密排列冠的背光面靠它保持可见;
    // Web 端用微弱自发光抬升暗部, 避免树冠读作黑团
    mat.emissive = new THREE.Color(emissive);
  }
  return mat;
}

function makeBarkMaterial(color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });
  return mat;
}

// ---- 调色板 (线性 RGB, 取自母本 vegetation.js) ----
const RED_PAL = [
  { w: 3.0, c: [0.42, 0.022, 0.012], ex: 1 },
  { w: 3.0, c: [0.30, 0.010, 0.018], ex: 1 },
  { w: 1.6, c: [0.19, 0.006, 0.012], ex: 0.6 },
  { w: 0.9, c: [0.32, 0.02, 0.014], ex: 0.85 },
  { w: 0.5, c: [0.10, 0.09, 0.02], ex: 0.2 },
  { w: 0.35, c: [0.1, 0.15, 0.025], ex: 0.0 },
];
const GREEN_PAL_FAR = [
  { w: 2.0, c: [0.065, 0.16, 0.029], ex: 0.3 },
  { w: 2.5, c: [0.098, 0.215, 0.035], ex: 0.6 },
  { w: 1.6, c: [0.137, 0.254, 0.039], ex: 1 },
  { w: 1.3, c: [0.046, 0.124, 0.026], ex: 0.0 },
  { w: 0.6, c: [0.18, 0.26, 0.044], ex: 1 },
];
const GREEN_PAL = [
  { w: 2.0, c: [0.09, 0.195, 0.026], ex: 0.3 },
  { w: 2.5, c: [0.13, 0.247, 0.035], ex: 0.6 },
  { w: 1.6, c: [0.17, 0.273, 0.039], ex: 1 },
  { w: 1.3, c: [0.065, 0.156, 0.033], ex: 0.0 },
  { w: 0.7, c: [0.21, 0.286, 0.049], ex: 1 },
];
const TONES = [[0.6, 0.78, 0.8], [1, 1, 1], [1.12, 1.04, 0.82], [0.75, 0.92, 1.0]];

function pickPal(rng, pal, expo) {
  const ws = pal.map((e) => e.w * (0.25 + 0.75 * (e.ex * expo + (1 - e.ex) * (1 - expo))));
  const tot = ws.reduce((a, b) => a + b, 0);
  let r = rng.next() * tot;
  for (let i = 0; i < pal.length; i++) { r -= ws[i]; if (r <= 0) return pal[i].c; }
  return pal[pal.length - 1].c;
}

function barkFromBranches(branches, id, disp) {
  const bark = new BarkAccum();
  for (const br of branches) {
    bark.addBranch(br, {
      flexOf: () => 0,
      seed: (id || 1) * 7 + 1,
      cellW: 0.07,
      disp: br.level === 0 && disp ? disp : null,
    });
  }
  return bark.toGeometry();
}

// 叶卡推送 (含红枫 accent 烘焙到颜色)
function pushLeaf(rng, bank, env, leafS, nodeSp, pal, red, tone, treeHue, accentP, curPad, tw) {
  const br = tw.br;
  curPad = tw.pad || null;
  const len = br.pd[br.pd.length - 1] - br.pd[0];
  const span = len * (1 - tw.t0);
  const nn = Math.max(1, Math.round(span / nodeSp));
  const leafHint = (p) => curPad
    ? padNormal(curPad, p).multiplyScalar(0.7).addScaledVector(UP, 0.75).add(randUnit(rng).multiplyScalar(0.8))
    : envNormalLocal(p, env).multiplyScalar(1.0).addScaledVector(UP, 0.5).add(randUnit(rng).multiplyScalar(0.85));
  const emit = (p, Ydir, Zhint, s) => {
    const Z = Zhint.clone().normalize();
    const Y = Ydir.clone(); Y.y -= 0.25; Y.addScaledVector(Z, -Y.dot(Z));
    if (Y.lengthSq() < 1e-5) Y.copy(perpOf(Z));
    Y.normalize();
    const X = V3().crossVectors(Y, Z).normalize();
    if (Z.dot(SUN) < 0) { Z.negate(); X.negate(); }
    const hy = (p.y - (env.c.y - env.r.y)) / (2 * env.r.y);
    let ao, col;
    if (curPad) {
      const P = curPad, l = padLocal(P, p), topF = padTopF(P, p), rim = Math.min(1, Math.hypot(l.x, l.z));
      ao = clamp((0.22 + 0.78 * topF) * (0.8 + 0.2 * rim) * P.shade, 0.1, 1);
      const c = rng.chance(0.22) ? P.col2 : P.col;
      const v = P.v * (0.82 + rng.next() * 0.36) * (0.85 + 0.25 * topF);
      col = [c[0] * v * (1 + treeHue) * tone[0], c[1] * v * (red ? 0.8 + 0.4 * rng.next() : 1) * tone[1], c[2] * v * (1 - treeHue) * tone[2]];
    } else {
      const rho = envRhoLocal(p, env);
      ao = clamp((0.3 + 0.75 * Math.min(1, Math.max(0, (rho - 0.35) / 0.65))) * (0.7 + 0.35 * Math.min(1, Math.max(0, hy))), 0.18, 1);
      const entry = pal[Math.floor(rng.next() * pal.length)];
      const c = entry.c;
      const v = 0.82 + rng.next() * 0.36;
      const sunny = Math.max(0, Math.min(1, (hy - 0.5) * 2)) * 0.25;
      col = [c[0] * v * (1 + treeHue + sunny * 0.6), c[1] * v * (1 + sunny * 0.3), c[2] * v * (1 - treeHue)];
    }
    let accent = rng.chance(accentP) ? rng.range(0.3, 1.0) : rng.range(0, 0.15);
    if (red && rng.chance(0.65)) accent = -accent;
    const accC = accent >= 0 ? [0.55, 0.22, 0.06] : [0.12, 0.02, 0.02];
    col = [mix(col[0], accC[0], Math.abs(accent) * 0.55), mix(col[1], accC[1], Math.abs(accent) * 0.55), mix(col[2], accC[2], Math.abs(accent) * 0.55)];
    col = [clamp(col[0], 0, 4), clamp(col[1], 0, 4), clamp(col[2], 0, 4)];
    const cell = rng.int(0, 3);
    const m = new THREE.Matrix4().makeBasis(X.multiplyScalar(s), Y.multiplyScalar(s), Z.multiplyScalar(s)).setPosition(p);
    bank.push(cell, m, new THREE.Color(col[0], col[1], col[2]));
  };
  for (let k = 0; k < nn; k++) {
    const t = tw.t0 + ((k + 0.5) / nn) * (1 - tw.t0);
    const s = sampleBranch(br, t);
    const H = V3().crossVectors(s.T, UP); if (H.lengthSq() < 1e-4) H.copy(perpOf(s.T)); H.normalize();
    if (k % 2 === 0 || rng.chance(0.3)) {
      for (const side of [-1, 1]) {
        if (rng.chance(0.08)) continue;
        const pdir = H.clone().multiplyScalar(side).addScaledVector(s.T, rng.range(0.15, 0.6)).add(randUnit(rng).multiplyScalar(0.3));
        pdir.y = pdir.y * 0.3 + rng.range(-0.15, 0.1); pdir.normalize();
        emit(s.p, pdir, leafHint(s.p), leafS * rng.range(0.8, 1.15) * (1 - 0.15 * t));
      }
    } else {
      const side = rng.chance(0.5) ? 1 : -1;
      const spur = H.clone().multiplyScalar(side * 0.8).addScaledVector(UP, 0.5).addScaledVector(s.T, 0.3).normalize();
      const sp = s.p.clone().addScaledVector(spur, rng.range(0.02, 0.06));
      const nw = rng.int(3, 5), a0 = rng.range(0, TAU);
      for (let j = 0; j < nw; j++) {
        const a = a0 + (j / nw) * TAU + rng.range(-0.3, 0.3);
        const Yd = H.clone().multiplyScalar(Math.cos(a)).addScaledVector(s.T, Math.sin(a));
        Yd.y = rng.range(-0.2, 0.15);
        emit(sp, Yd, leafHint(sp), leafS * rng.range(0.75, 1.1));
      }
    }
  }
  const e = sampleBranch(br, 1);
  const nt = tw.shell ? rng.int(4, 7) : rng.int(2, 4);
  const H = V3().crossVectors(e.T, UP); if (H.lengthSq() < 1e-4) H.copy(perpOf(e.T)); H.normalize();
  for (let j = 0; j < nt; j++) {
    const a = ((j / Math.max(1, nt - 1)) - 0.5) * 1.8 + rng.range(-0.2, 0.2);
    const Yd = e.T.clone().multiplyScalar(Math.cos(a)).addScaledVector(H, Math.sin(a));
    Yd.y = Yd.y * 0.3 + rng.range(-0.1, 0.12);
    emit(e.p, Yd, leafHint(e.p), leafS * rng.range(0.7, 1.0));
  }
}

function envNormalLocal(p, env) {
  const n = V3(p.x - env.c.x, 0, p.z - env.c.z);
  if (n.lengthSq() < 1e-6) n.set(0, 1, 0);
  const len = n.length(); n.normalize();
  const rr = Math.hypot(p.x - env.c.x, p.z - env.c.z) / env.r.x;
  const ry = (p.y - env.c.y) / env.r.y;
  const k = 1 - rr * rr - ry * ry;
  const y = k > 0 ? Math.sqrt(k) * env.r.y / (env.r.x * len + 1e-6) : 0;
  return V3(n.x, y, n.z).normalize();
}
function envRhoLocal(p, env) {
  const dx = (p.x - env.c.x) / env.r.x, dy = (p.y - env.c.y) / env.r.y, dz = (p.z - env.c.z) / env.r.z;
  return Math.min(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
}

// ---- 阔叶树 (红枫 / 青枫) ----
function buildMaple(rng, spec, sink) {
  const base = V3(spec.x, 0, spec.z);
  const red = spec.type === 'mapleRed';
  let tree, pal, treeHue = 0, accentP = 0.25, leafS, nodeSp, tone = [1, 1, 1];
  if (red) {
    tree = genMaple(rng, { h: spec.h, base, spread: 0.62, detail: 0.85, leafLen: 0.5, leaders: 3, red: true, seed: spec.id });
    pal = RED_PAL; leafS = 0.16; nodeSp = 0.06;
  } else {
    tree = genTiered(rng, { h: spec.h, base, spread: 0.5, detail: 0.8, leaders: 4, padR: 0.55, gaps: 0.32, twigDens: 3.0, species: 'maple', keepOut: [] });
    pal = spec.h > 8 ? GREEN_PAL : GREEN_PAL_FAR; leafS = 0.26; nodeSp = 0.065;
    tone = TONES[rng.int(0, 3)];
    for (const P of tree.pads) {
      const hy = clamp((P.c.y - (tree.env.c.y - tree.env.r.y)) / (2 * tree.env.r.y), 0, 1);
      P.expo = clamp(P.shade * 0.75 + hy * 0.35 - 0.1, 0, 1);
      P.col = pickPal(rng, pal, P.expo); P.col2 = pickPal(rng, pal, P.expo); P.v = rng.range(0.85, 1.15);
    }
  }
  const env = tree.env;
  for (const tw of tree.twigs) pushLeaf(rng, sink.bank, env, leafS, nodeSp, pal, red, tone, treeHue, accentP, null, tw);

  // 暗色内核 (避免缝隙看穿)
  const cores = sink.cores;
  if (red) {
    const sprays = tree.shellSprays || [];
    for (let i = 0; i < sprays.length; i += 3) {
      const p = sprays[i];
      cores.add(p, 0, (th, phi) => {
        const s = Math.sin(phi);
        return [Math.cos(th) * s * 0.4, Math.cos(phi) * 0.4, Math.sin(th) * s * 0.4];
      }, () => [0.04, 0.06, 0.03], 0, 8, 5);
    }
  } else {
    for (const P of tree.pads) {
      const lb = P.lobes || [0.1, 0.06, 0.04, 0, 1, 2];
      const Rf = (th) => 1 + lb[0] * Math.sin(3 * th + lb[3]) + lb[1] * Math.sin(5 * th + lb[4]) + lb[2] * Math.sin(8 * th + lb[5]);
      const g = [0.05, 0.1, 0.03];
      cores.add(P.c, P.yaw, (th, phi) => naturalCrownPoint(th, phi, P.rx * 0.7, P.ry * 0.74, P.rz * 0.7, Rf(th)),
        () => [g[0], g[1], g[2]], 0, P.rx > 0.8 ? 14 : 10, P.rx > 0.8 ? 8 : 6);
    }
  }
  sink.trunkGeos.push(barkFromBranches(tree.branches, spec.id, trunkDisp({ seed: (spec.id || 1) * 13 })));
}

// ---- 古松 ----
function buildPine(rng, spec, sink) {
  const base = V3(spec.x, 0, spec.z);
  const tree = genPine(rng, { h: spec.h, base, leanAz: spec.leanAz, lean: spec.lean, nBranches: spec.nBranches, hStart: spec.hStart, padScale: spec.padScale, reach: spec.reach, topBack: spec.topBack, avoid: [], keepOut: [] });
  const bank = sink.bank, cores = sink.cores;
  const dens = (spec.tuftDensity ?? 150) * Math.min(1, Math.pow(7.5 / spec.h, 1.3));
  const ts = (spec.tuftSize ?? 0.34) * Math.max(1, Math.sqrt(spec.h / 7.5));
  const greens = [[0.034, 0.062, 0.032], [0.044, 0.072, 0.03], [0.03, 0.055, 0.034], [0.052, 0.078, 0.026]];
  const treeTint = rng.range(0.9, 1.12);
  const gseed = rng.int(0, 9999);
  const pushTuft = (p, axis, sc, ao, col) => {
    const [X, Y, Z] = orthoBasis(axis);
    if (Z.dot(SUN) < 0) { Z.negate(); X.negate(); }
    const cell = rng.chance(0.5) ? 0 : 2;
    const m = new THREE.Matrix4().makeBasis(X.multiplyScalar(sc), Y.multiplyScalar(sc), Z.multiplyScalar(sc)).setPosition(p);
    bank.push(cell, m, new THREE.Color(col[0], col[1], col[2]));
  };
  for (const pad of tree.pads) {
    const cy = Math.cos(pad.yaw), sy = Math.sin(pad.yaw);
    const lb = pad.lobes || [0.1, 0.06, 0.04, 0, 1, 2];
    const Rf = (th) => 1 + lb[0] * Math.sin(3 * th + lb[3]) + lb[1] * Math.sin(5 * th + lb[4]) + lb[2] * Math.sin(8 * th + lb[5]);
    const topY = (q) => Math.sqrt(Math.max(0, 1 - Math.min(q, 1) ** 2));
    const toW = (lx, ly, lz) => V3(pad.c.x + lx * cy - lz * sy, pad.c.y + ly, pad.c.z + lx * sy + lz * cy);
    const area = Math.PI * pad.rx * pad.rz;
    const nTuft = area * dens, per = 6, nC = Math.round((nTuft / per) * 1.25);
    const cr = Math.max(0.1, ts * 0.62);
    const gf = 1.5 / Math.max(0.6, Math.sqrt(pad.rx));
    const pv = rng.range(0.8, 1.18), pw = rng.range(-1, 1);
    const padTone = [pv * (1 + 0.2 * pw), pv, pv * (1 - 0.18 * pw)];
    const g = greens[rng.int(0, 3)];
    const cv = 0.5 * treeTint * rng.range(0.9, 1.1);
    const tint = [g[0] * cv * padTone[0], g[1] * cv * padTone[1], g[2] * cv * padTone[2]];
    cores.add(pad.c, pad.yaw, (th, phi) => naturalCrownPoint(th, phi, pad.rx * 0.72, pad.ry * 0.76, pad.rz * 0.72, Rf(th)),
      (th, phi) => { const k = 1 - 0.6 * Math.min(1, Math.max(0, (phi / Math.PI - 0.38) / 0.4)); return [tint[0] * k, tint[1] * k, tint[2] * k]; },
      0, pad.rx > 0.8 ? 14 : 10, pad.rx > 0.8 ? 8 : 6);
    for (let ci = 0; ci < nC; ci++) {
      const th = rng.range(0, TAU), R = Rf(th);
      const q = Math.min(1.03, Math.sqrt(rng.next()) * 1.04), rim = q > 0.8;
      const ox = Math.cos(th), oz = Math.sin(th);
      const lx = ox * q * R * pad.rx, lz = oz * q * R * pad.rz;
      const outW = V3(ox * cy - oz * sy, 0, ox * sy + oz * cy);
      const yT = pad.ry * topY(q);
      const wc = toW(lx, 0, lz);
      const gn = vnoise3(wc.x * gf, pad.c.y * 0.9, wc.z * gf, gseed) * 0.75 + vnoise3(wc.x * gf * 2.3, pad.c.y, wc.z * gf * 2.3, gseed + 1) * 0.25;
      const gap = gn < (rim ? 0.3 : 0.4);
      const g2 = greens[rng.int(0, 3)];
      const cv2 = rng.range(0.82, 1.18) * treeTint * (gap ? 0.7 : 1);
      if (gap) {
        if (!rng.chance(0.15)) continue;
        const p = toW(lx, yT - pad.ry * rng.range(0.55, 0.9), lz);
        pushTuft(p, UP.clone().addScaledVector(outW, 0.4 * q).add(randUnit(rng).multiplyScalar(0.3)).normalize(), ts * rng.range(0.8, 1.05), rng.range(0.1, 0.2), [g2[0] * cv2, g2[1] * cv2, g2[2] * cv2]);
        continue;
      }
      let cyl, n;
      if (!rim) { cyl = yT - ts * 0.18; n = UP.clone().addScaledVector(outW, 0.45 * q).normalize(); }
      else { const v = rng.range(-0.25, 1.0); cyl = Math.max(-pad.ry * 0.4, yT * v - pad.ry * 0.15); n = outW.clone().multiplyScalar(0.9).addScaledVector(UP, 0.35 + 0.4 * Math.max(0, v)).normalize(); }
      const k = rng.int(per - 2, per + 2);
      const cT = perpOf(n), cB = V3().crossVectors(n, cT);
      const lc = toW(lx, cyl, lz);
      const clusterV = rng.range(0.85, 1.15);
      const hy = Math.min(1, Math.max(0, (cyl / pad.ry + 0.4) / 1.4));
      for (let j = 0; j < k; j++) {
        const a = rng.range(0, TAU), rr = cr * Math.sqrt(rng.next()), depth = rng.next();
        const p = lc.clone().addScaledVector(cT, Math.cos(a) * rr).addScaledVector(cB, Math.sin(a) * rr).addScaledVector(n, -depth * ts * 0.45);
        const splay = cT.clone().multiplyScalar(Math.cos(a)).addScaledVector(cB, Math.sin(a)).multiplyScalar(0.55 * rr / cr);
        const axis = n.clone().add(splay).addScaledVector(UP, rim ? 0.15 : 0.25).add(randUnit(rng).multiplyScalar(0.22)).normalize();
        const sc = ts * rng.range(0.85, 1.25) * (rim ? 1.08 : 1);
        const ao = Math.min(1, (rim ? 0.42 + 0.45 * hy : 0.62 + 0.38 * (1 - 0.35 * q)) * (1 - 0.45 * depth));
        const v = cv2 * clusterV * (1 - 0.25 * depth);
        const col = [g2[0] * v * padTone[0], g2[1] * v * padTone[1], g2[2] * v * padTone[2] * rng.range(0.9, 1.15)];
        pushTuft(p, axis, sc, ao, col);
      }
    }
    const nU = Math.round(nTuft * 0.09);
    for (let i = 0; i < nU; i++) {
      const th = rng.range(0, TAU), q = Math.sqrt(rng.next()) * 0.85 * Rf(th);
      const ox = Math.cos(th), oz = Math.sin(th);
      const outW = V3(ox * cy - oz * sy, 0, ox * sy + oz * cy);
      const p = toW(ox * q * pad.rx, -pad.ry * rng.range(0.25, 0.5), oz * q * pad.rz);
      const g2 = greens[rng.int(0, 3)], v = rng.range(0.7, 1.0) * treeTint;
      pushTuft(p, outW.clone().multiplyScalar(0.7).addScaledVector(UP, -0.5).add(randUnit(rng).multiplyScalar(0.3)).normalize(), ts * rng.range(0.7, 0.95), rng.range(0.14, 0.24), [g2[0] * v, g2[1] * v, g2[2] * v]);
    }
  }
  sink.trunkGeos.push(barkFromBranches(tree.branches, spec.id, trunkDisp({ seed: (spec.id || 1) * 13 })));
}

// ---- 海棠 ( flowering, 用 blossom atlas ) ----
function buildBlossom(rng, spec, sink) {
  const base = V3(spec.x, 0, spec.z);
  const lean = V3(Math.cos(spec.dir) * 0.3, 0, Math.sin(spec.dir) * 0.3);
  const tree = genCrabapple(rng, { h: spec.h, base, lean, spread: 0.7, detail: 0.8, leaders: 4, padR: 0.5, gaps: 0.34, twigDens: 3.0, keepOut: [] });
  const bank = sink.bank, cores = sink.cores;
  const env = tree.env;
  const TINTS = [[1.02, 0.94, 0.97], [1.0, 0.88, 0.93], [1.0, 0.82, 0.9], [0.97, 0.76, 0.86]];
  for (const P of tree.pads) {
    const g = [0.09, 0.05, 0.06]; // 枯枝褐色 (近黑会像污块从花缝里外露)
    cores.add(P.c, P.yaw, (th, phi) => naturalCrownPoint(th, phi, P.rx * 0.62, P.ry * 0.68, P.rz * 0.62, 1), () => g, 0, 12, 7);
    const tint = P.tint || TINTS[rng.int(0, 3)];
    const n = Math.max(10, Math.round(P.rx * P.rz * 6));
    for (let i = 0; i < n; i++) {
      const th = rng.range(0, TAU), q = Math.sqrt(rng.next());
      const lx = Math.cos(th) * q * P.rx, lz = Math.sin(th) * q * P.rz;
      const ly = P.ry * Math.sqrt(Math.max(0, 1 - q * q));
      const p = V3(P.c.x + lx * Math.cos(P.yaw) - lz * Math.sin(P.yaw), P.c.y + ly, P.c.z + lx * Math.sin(P.yaw) + lz * Math.cos(P.yaw));
      const outV = V3(lx, ly * 0.5, lz).normalize();
      const Z = outV.multiplyScalar(0.7).addScaledVector(UP, 0.6).add(randUnit(rng).multiplyScalar(0.6)).normalize();
      const Y = randUnit(rng);
      const X = V3().crossVectors(Y, Z).normalize();
      const Yn = V3().crossVectors(Z, X).normalize();
      if (Z.dot(SUN) < 0) { Z.negate(); X.negate(); }
      const s = rng.range(0.5, 0.9), cell = rng.int(0, 3);
      const m = new THREE.Matrix4().makeBasis(X.multiplyScalar(s), Yn.multiplyScalar(s), Z.multiplyScalar(s)).setPosition(p);
      const v = rng.range(0.85, 1.1);
      bank.push(cell, m, new THREE.Color(tint[0] * v, tint[1] * v, tint[2] * v));
    }
  }
  sink.trunkGeos.push(barkFromBranches(tree.branches, spec.id, trunkDisp({ seed: (spec.id || 1) * 13 })));
}

export const createJiangnanTrees = (scene, rng) => {
  const treeRoot = new THREE.Group();
  const master = makeRng(0x9e3779b1);

  // 程序化贴图 (纯 canvas / data, 无电影管线依赖)
  const mapleAtlas = makeMapleAtlas(master, 2048);
  bakeMapleAtlasLuminance(mapleAtlas);
  const pineAtlas = makePineAtlas(master, 1024);
  bakePineAtlasLuminance(pineAtlas);
  const blossomAtlas = makeBlossomAtlas(master, 1024); blossomAtlas.colorSpace = THREE.SRGBColorSpace;

  const mapleMat = makeFoliageMaterial(mapleAtlas, 'maple', 0x200604);
  const greenMapleMat = makeFoliageMaterial(mapleAtlas, 'maple', 0x1a2c10);
  const pineMat = makeFoliageMaterial(pineAtlas, 'pine', 0x182a14);
  const blossomMat = makeFoliageMaterial(blossomAtlas, 'rgb', 0x20101a);
  const barkRed = makeBarkMaterial(0x4a3326);
  const barkGreen = makeBarkMaterial(0x46392a);
  const barkPine = makeBarkMaterial(0x3a2c20);
  // 白底 + 顶点色直接着色 (aTint 即线性 RGB) —— 深色底 hex 经 sRGB->线性会变成近黑
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x060d05, roughness: 1, metalness: 0, vertexColors: true, side: THREE.DoubleSide });

  const treeSpots = [
    { x: 19.2, z: -6.4, h: 5.2, dir: -2.6, type: 'blossom', id: 91 },
    ...(L.trees || []).map((t) => ({
      x: t.at[0], z: t.at[1], h: t.h || 6.5,
      dir: (t.at[0] * 0.17 + t.at[1] * 0.23) % Math.PI,
      type: t.type === 'maple' ? 'greenMaple' : t.type,
      id: Math.floor((t.at[0] + t.at[1]) * 31) + 7,
    })),
  ];

  const banks = { mapleRed: new LeafBank(), mapleGreen: new LeafBank(), pine: new LeafBank(), blossom: new LeafBank() };
  const cores = { maple: new CushionAccum(), pine: new CushionAccum(), blossom: new CushionAccum() };
  const trunkGeos = { red: [], green: [], pine: [], blossom: [] };

  for (const t of treeSpots) {
    const r = makeRng((Math.floor(t.x * 73856093) ^ Math.floor(t.z * 19349663) ^ (t.id || 0)) >>> 0);
    const spec = { x: t.x, z: t.z, h: t.h, dir: t.dir, id: t.id,
      leanAz: undefined, lean: 0.3, nBranches: 7, padScale: 1, reach: 1, topBack: 0.2, hStart: 0.6 };
    if (t.type === 'pine') {
      buildPine(r, spec, { bank: banks.pine, cores: cores.pine, trunkGeos: trunkGeos.pine });
    } else if (t.type === 'mapleRed') {
      buildMaple(r, { ...spec, type: 'mapleRed' }, { bank: banks.mapleRed, cores: cores.maple, trunkGeos: trunkGeos.red });
    } else if (t.type === 'greenMaple') {
      buildMaple(r, { ...spec, type: 'greenMaple' }, { bank: banks.mapleGreen, cores: cores.maple, trunkGeos: trunkGeos.green });
    } else if (t.type === 'blossom') {
      buildBlossom(r, spec, { bank: banks.blossom, cores: cores.blossom, trunkGeos: trunkGeos.blossom });
    }
  }

  // 干皮网格 (按物种分材质)
  const barkMats = { red: barkRed, green: barkGreen, pine: barkPine, blossom: barkRed };
  for (const key of Object.keys(trunkGeos)) {
    if (!trunkGeos[key].length) continue;
    const merged = mergeGeometries(trunkGeos[key], false);
    const mesh = new THREE.Mesh(merged, barkMats[key]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    treeRoot.add(mesh);
  }

  // 暗色内核
  for (const key of Object.keys(cores)) {
    const g = cores[key].toGeometry(THREE);
    if (!g) continue;
    if (g.getAttribute('aTint')) { g.setAttribute('color', g.getAttribute('aTint')); g.deleteAttribute('aTint'); }
    g.deleteAttribute('aFlex');
    const mesh = new THREE.Mesh(g, coreMat);
    mesh.castShadow = false; mesh.receiveShadow = false;
    treeRoot.add(mesh);
  }

  // 叶卡合批 (按 atlas cell 拆 InstancedMesh)
  const buildBank = (bank, material) => {
    if (!bank.count) return;
    const byCell = {};
    for (let i = 0; i < bank.count; i++) (byCell[bank.cells[i]] ||= []).push(i);
    for (const cs of Object.keys(byCell)) {
      const idxs = byCell[cs];
      const inst = new THREE.InstancedMesh(cardGeo(parseInt(cs)), material, idxs.length);
      const c = new THREE.Color();
      idxs.forEach((src, k) => {
        inst.setMatrixAt(k, bank.mats[src]);
        c.copy(bank.cols[src]);
        inst.setColorAt(k, c);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.castShadow = false;
      treeRoot.add(inst);
    }
  };
  buildBank(banks.mapleRed, mapleMat);
  buildBank(banks.mapleGreen, greenMapleMat);
  buildBank(banks.pine, pineMat);
  buildBank(banks.blossom, blossomMat);

  // ---- 6 株驳岸临波垂柳 (保留原移植) ----
  const willowSpots = [
    { x: -16, z: 6.2, yaw: 0.4, scale: 1.15 },
    { x: 34, z: 6.8, yaw: -0.5, scale: 1.1 },
    { x: 42, z: 14.0, yaw: -1.2, scale: 1.05 },
    { x: 38, z: 28.0, yaw: -2.1, scale: 1.12 },
    { x: -22, z: 28.0, yaw: 2.2, scale: 1.08 },
    { x: -2, z: 18.0, yaw: 0.8, scale: 0.95 },
  ];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.9, metalness: 0.0 });
  const willowTex = createWillowStrandTexture();
  const willowMat = new THREE.MeshStandardMaterial({ map: willowTex, alphaTest: 0.30, roughness: 0.45, metalness: 0.01, side: THREE.DoubleSide });
  const willowStrandGeo = new THREE.PlaneGeometry(0.55, 2.6);
  willowStrandGeo.translate(0, -1.3, 0);
  const willowMatrices = [];
  const willowTrunkGeos = [];
  willowSpots.forEach((ws) => {
    const s = ws.scale, h = 4.4 * s, leanZ = 1.8 * s;
    const curvePts = [
      new THREE.Vector3(ws.x, 0, ws.z),
      new THREE.Vector3(ws.x + Math.cos(ws.yaw) * (leanZ * 0.35), h * 0.45, ws.z + Math.sin(ws.yaw) * (leanZ * 0.35)),
      new THREE.Vector3(ws.x + Math.cos(ws.yaw) * (leanZ * 0.85), h * 0.82, ws.z + Math.sin(ws.yaw) * (leanZ * 0.85)),
      new THREE.Vector3(ws.x + Math.cos(ws.yaw) * leanZ, h, ws.z + Math.sin(ws.yaw) * leanZ),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePts);
    willowTrunkGeos.push(new THREE.TubeGeometry(curve, 12, 0.18 * s, 6, false));
    const crownPt = curve.getPoint(1.0);
    const nStrands = 48;
    for (let k = 0; k < nStrands; k++) {
      const ang = (k / nStrands) * TAU, rad = (0.6 + Math.random() * 1.8) * s;
      const px = crownPt.x + Math.cos(ang) * rad, pz = crownPt.z + Math.sin(ang) * rad, py = crownPt.y + (Math.random() - 0.4) * 0.6;
      const scY = 0.85 + Math.random() * 0.35, scXZ = 0.80 + Math.random() * 0.30;
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.12, Math.random() * TAU, (Math.random() - 0.5) * 0.12))
        .scale(new THREE.Vector3(scXZ, scY, scXZ)).setPosition(px, py, pz);
      willowMatrices.push(m);
    }
  });
  if (willowTrunkGeos.length) {
    const mesh = new THREE.Mesh(mergeGeometries(willowTrunkGeos, false), trunkMat);
    mesh.castShadow = true; treeRoot.add(mesh);
  }
  if (willowMatrices.length) {
    const inst = new THREE.InstancedMesh(willowStrandGeo, willowMat, willowMatrices.length);
    willowMatrices.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    treeRoot.add(inst);
  }

  scene.add(treeRoot);
  return {
    group: treeRoot,
    setVisible: (visible) => { treeRoot.visible = visible; },
  };
};

// 垂柳柔条贴图 (保留)
function createWillowStrandTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 64, 256);
  g.strokeStyle = '#6f9a4a';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = 10 + Math.random() * 44;
    g.beginPath();
    g.moveTo(x, 0);
    g.quadraticCurveTo(x + (Math.random() - 0.5) * 16, 140, x + (Math.random() - 0.5) * 10, 256);
    g.stroke();
  }
  g.strokeStyle = '#a7c46b';
  g.lineWidth = 2;
  for (let i = 0; i < 22; i++) {
    const x = 8 + Math.random() * 48;
    g.beginPath();
    g.moveTo(x, 0);
    g.quadraticCurveTo(x + (Math.random() - 0.5) * 14, 150, x + (Math.random() - 0.5) * 8, 256);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
