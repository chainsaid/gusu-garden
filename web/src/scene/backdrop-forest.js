// ---------------------------------------------------------------------------
// backdrop-forest.js — 园外环抱郁葱林海系统 (Backdrop Forest & 借景林冠)
// 与院内名木同源: 用母本 src/world/vegetation-tree.js 的几何生成器在低细节档
// 预生成 14 株"变体树"(香樟/青枫/古松, 真实递归分枝 + 叶卡壳 + BarkAccum 树皮),
// 每株合并为单个几何体, 再以 InstancedMesh 散布 ~300 次 —— 真实树形 + 少量 draw call。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { genTiered, genPine, BarkAccum, trunkDisp, sampleBranch, perpOf, randUnit } from '../../../src/world/vegetation-tree.js';
import { makeMapleAtlas, makePineAtlas } from '../../../src/world/vegetation-tex.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const TAU = Math.PI * 2;
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

// 数据通道贴图 → 亮度烘焙 (等价母本解码, 见 trees.js 同名逻辑)
function bakeAtlasLuminance(tex, kind) {
  const d = tex.image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let L;
    if (kind === 'maple') {
      const shade = d[i] / 255, blotch = d[i + 2] / 255;
      L = (0.42 + 0.9 * shade) * (0.88 + 0.24 * blotch);
    } else {
      const shade = d[i] / 255, along = d[i + 1] / 255;
      L = (0.35 + 0.75 * shade) * (0.3 + 1.05 * along * along * (3 - 2 * along));
    }
    const v = Math.max(0, Math.min(255, Math.round(L * 255)));
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  tex.needsUpdate = true;
}

// 叶卡四边形汤: 直接写顶点 (带逐叶颜色), 合并为单个几何体供 InstancedMesh 复用
class QuadSoup {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.idx = []; this.vc = 0; }
  addQuad(p, X, Y, Z, s, cell, col) {
    const cellX = (cell % 2) * 0.5, cellY = Math.floor(cell / 2) * 0.5;
    const base = this.vc;
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    for (const [a, b, u, v] of corners) {
      this.pos.push(
        p.x + (X.x * a + Y.x * b) * s * 0.5,
        p.y + (X.y * a + Y.y * b) * s * 0.5,
        p.z + (X.z * a + Y.z * b) * s * 0.5
      );
      this.nrm.push(Z.x, Z.y, Z.z);
      this.uv.push(cellX + u * 0.5, cellY + 0.5 - v * 0.5);
      this.col.push(col[0], col[1], col[2]);
      this.vc++;
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  get count() { return this.idx.length / 6; }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

function envRhoLocal(p, env) {
  const dx = (p.x - env.c.x) / env.r.x, dy = (p.y - env.c.y) / env.r.y, dz = (p.z - env.c.z) / env.r.z;
  return Math.min(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
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

function pickPal(rng, pal, expo) {
  const ws = pal.map((e) => e.w * (0.25 + 0.75 * (e.ex * expo + (1 - e.ex) * (1 - expo))));
  const tot = ws.reduce((a, b) => a + b, 0);
  let r = rng.next() * tot;
  for (let i = 0; i < pal.length; i++) { r -= ws[i]; if (r <= 0) return pal[i].c; }
  return pal[pal.length - 1].c;
}

// 远景调色板 (线性 RGB) —— 香樟墨绿 / 远枫黄绿 / 松针蓝绿
const BROAD_PAL = [
  { w: 2.2, c: [0.055, 0.14, 0.026], ex: 0.3 },
  { w: 2.6, c: [0.085, 0.185, 0.032], ex: 0.6 },
  { w: 1.6, c: [0.115, 0.225, 0.04], ex: 1 },
  { w: 1.2, c: [0.04, 0.105, 0.024], ex: 0.0 },
  { w: 0.7, c: [0.14, 0.24, 0.045], ex: 1 },
];
const MAPLE_PAL = [
  { w: 2.0, c: [0.075, 0.16, 0.024], ex: 0.3 },
  { w: 2.5, c: [0.105, 0.205, 0.031], ex: 0.6 },
  { w: 1.6, c: [0.14, 0.225, 0.042], ex: 1 },
  { w: 1.2, c: [0.05, 0.125, 0.026], ex: 0.0 },
  { w: 0.8, c: [0.17, 0.25, 0.048], ex: 1 },
];
const PINE_PAL = [
  { w: 2.0, c: [0.034, 0.066, 0.034], ex: 0.5 },
  { w: 2.4, c: [0.045, 0.078, 0.032], ex: 0.8 },
  { w: 1.6, c: [0.03, 0.058, 0.036], ex: 0.2 },
  { w: 1.0, c: [0.055, 0.085, 0.028], ex: 1 },
];

// 低细节变体树: kind 'broad'(香樟/阔叶 tiered) | 'pine'
function buildVariant(seed, kind, h) {
  let r = buildVariantInner(seed, kind, h, 1);
  const cap = kind === 'pine' ? 3500 : 5500;
  let mul = 1;
  for (let pass = 0; pass < 3 && r.quads > cap; pass++) {
    mul *= Math.max(1.4, Math.sqrt(r.quads / cap));
    r = buildVariantInner(seed, kind, h, mul);
  }
  return r;
}
function buildVariantInner(seed, kind, h, mul) {
  const rng = makeRng(seed);
  const base = V3(0, 0, 0);
  let tree, pal, leafS, nodeSp;
  if (kind === 'pine') {
    tree = genPine(rng, { h, base, lean: 0.3, nBranches: 4, padScale: 1, reach: 1, topBack: 0.2, hStart: 0.6, avoid: [], keepOut: [] });
    pal = PINE_PAL; leafS = 0.58; nodeSp = 0.16;
    // genPine 不返回 env: 由 crown pads 包围盒合成 (供叶色 expo 计算)
    let minY = 1e9, maxY = -1e9, rMax = 0.5;
    for (const pad of tree.pads) {
      minY = Math.min(minY, pad.c.y - pad.ry);
      maxY = Math.max(maxY, pad.c.y + pad.ry);
      rMax = Math.max(rMax, Math.hypot(pad.c.x, pad.c.z) + pad.rx);
    }
    tree.env = { c: V3(0, (minY + maxY) / 2, 0), r: V3(rMax, Math.max(0.5, (maxY - minY) / 2), rMax) };
  } else {
    tree = genTiered(rng, { h, base, spread: 0.5, detail: 0.25, leaders: 2, padR: 0.55, gaps: 0.22, twigDens: 0.8, species: 'maple', keepOut: [] });
    pal = kind === 'maple' ? MAPLE_PAL : BROAD_PAL;
    leafS = 0.52; nodeSp = 0.3;
    for (const P of tree.pads) {
      const hy = clamp((P.c.y - (tree.env.c.y - tree.env.r.y)) / (2 * tree.env.r.y), 0, 1);
      P.expo = clamp(P.shade * 0.75 + hy * 0.35 - 0.1, 0, 1);
      P.col = pickPal(rng, pal, P.expo); P.col2 = pickPal(rng, pal, P.expo); P.v = rng.range(0.85, 1.15);
    }
  }
  const env = tree.env;
  const soup = new QuadSoup();
  const cell = rng.int(0, 3);

  const emit = (p, Ydir, Zhint, s, col) => {
    const Z = Zhint.clone().normalize();
    const Y = Ydir.clone(); Y.y -= 0.25; Y.addScaledVector(Z, -Y.dot(Z));
    if (Y.lengthSq() < 1e-5) Y.copy(perpOf(Z));
    Y.normalize();
    const X = V3().crossVectors(Y, Z).normalize();
    if (Z.dot(SUN) < 0) { Z.negate(); X.negate(); }
    soup.addQuad(p, X, Y, Z, s, cell, col);
  };

  for (const tw of (tree.twigs || [])) {
    if (mul > 1 && rng.chance(1 - 1 / mul)) continue; // 重试档: 整枝跳过压预算
    const br = tw.br;
    const curPad = tw.pad || null;
    const len = br.pd[br.pd.length - 1] - br.pd[0];
    const span = len * (1 - tw.t0);
    const nn = Math.max(1, Math.round(span / (nodeSp * mul)));
    const hy0 = (p) => (p.y - (env.c.y - env.r.y)) / (2 * env.r.y);
    const leafCol = (p, P) => {
      let c, v;
      if (P) {
        c = rng.chance(0.22) ? P.col2 : P.col;
        v = P.v * (0.85 + rng.next() * 0.3) * (0.85 + 0.25 * clamp((p.y - (P.c.y - P.ry)) / (2 * P.ry), 0, 1));
      } else {
        const hy = clamp(hy0(p), 0, 1);
        c = pal[Math.floor(rng.next() * pal.length)].c;
        v = (0.82 + rng.next() * 0.36) * (0.75 + 0.35 * hy);
      }
      return [c[0] * v, c[1] * v, c[2] * v];
    };
    const hint = (p) => curPad
      ? UP.clone().multiplyScalar(0.9).add(randUnit(rng).multiplyScalar(0.8))
      : envNormalLocal(p, env).multiplyScalar(1.0).addScaledVector(UP, 0.5).add(randUnit(rng).multiplyScalar(0.85));
    for (let k = 0; k < nn; k++) {
      const t = tw.t0 + ((k + 0.5) / nn) * (1 - tw.t0);
      const s = sampleBranch(br, t);
      const H = V3().crossVectors(s.T, UP); if (H.lengthSq() < 1e-4) H.copy(perpOf(s.T)); H.normalize();
      const col = leafCol(s.p, curPad);
      for (const side of [-1, 1]) {
        if (rng.chance(0.12)) continue;
        const pdir = H.clone().multiplyScalar(side).addScaledVector(s.T, rng.range(0.15, 0.6)).add(randUnit(rng).multiplyScalar(0.3));
        pdir.y = pdir.y * 0.3 + rng.range(-0.15, 0.1); pdir.normalize();
        emit(s.p, pdir, hint(s.p), leafS * rng.range(0.85, 1.15) * (1 - 0.15 * t), col);
      }
    }
    const e = sampleBranch(br, 1);
    const nt = tw.shell ? rng.int(3, 5) : rng.int(2, 4);
    const H = V3().crossVectors(e.T, UP); if (H.lengthSq() < 1e-4) H.copy(perpOf(e.T)); H.normalize();
    const colT = leafCol(e.p, curPad);
    for (let j = 0; j < nt; j++) {
      const a = ((j / Math.max(1, nt - 1)) - 0.5) * 1.8 + rng.range(-0.2, 0.2);
      const Yd = e.T.clone().multiplyScalar(Math.cos(a)).addScaledVector(H, Math.sin(a));
      Yd.y = Yd.y * 0.3 + rng.range(-0.1, 0.12);
      emit(e.p, Yd, hint(e.p), leafS * rng.range(0.7, 1.0), colT);
    }
  }

  // 松: genPine 无 twigs, 针叶从 crown pads 表面采样 (radial/fan cell)
  if (kind === 'pine') {
    for (const pad of tree.pads) {
      const cy = Math.cos(pad.yaw), sy = Math.sin(pad.yaw);
      const lb = pad.lobes || [0.1, 0.06, 0.04, 0, 1, 2];
      const Rf = (th) => 1 + lb[0] * Math.sin(3 * th + lb[3]) + lb[1] * Math.sin(5 * th + lb[4]) + lb[2] * Math.sin(8 * th + lb[5]);
      const topY = (q) => Math.sqrt(Math.max(0, 1 - Math.min(q, 1) ** 2));
      const toW = (lx, ly, lz) => V3(pad.c.x + lx * cy - lz * sy, pad.c.y + ly, pad.c.z + lx * sy + lz * cy);
      const area = Math.PI * pad.rx * pad.rz;
      const nTuft = Math.round((area * 14) / (mul * mul));
      for (let ci = 0; ci < nTuft; ci++) {
        const th = rng.range(0, TAU), R = Rf(th);
        const q = Math.min(1.03, Math.sqrt(rng.next()) * 1.04), rim = q > 0.8;
        const ox = Math.cos(th), oz = Math.sin(th);
        const outW = V3(ox * cy - oz * sy, 0, ox * sy + oz * cy);
        const yT = pad.ry * topY(q);
        let cyl, n;
        if (!rim) { cyl = yT - leafS * 0.18; n = UP.clone().addScaledVector(outW, 0.45 * q).normalize(); }
        else {
          const v = rng.range(-0.25, 1.0);
          cyl = Math.max(-pad.ry * 0.4, yT * v - pad.ry * 0.15);
          n = outW.clone().multiplyScalar(0.9).addScaledVector(UP, 0.35 + 0.4 * Math.max(0, v)).normalize();
        }
        const p = toW(ox * q * R * pad.rx, cyl, oz * q * R * pad.rz);
        const hy = clamp((p.y - (env.c.y - env.r.y)) / (2 * env.r.y), 0, 1);
        const g = pal[Math.floor(rng.next() * pal.length)].c;
        const v = (0.75 + rng.next() * 0.4) * (0.7 + 0.4 * hy) * (rim ? 1.05 : 1);
        const col = [g[0] * v, g[1] * v, g[2] * v];
        const axis = n.clone().addScaledVector(UP, rim ? 0.15 : 0.25).add(randUnit(rng).multiplyScalar(0.22)).normalize();
        emit(p, randUnit(rng), axis, leafS * rng.range(0.85, 1.2) * (rim ? 1.08 : 1), col);
      }
    }
  }

  // 远景树皮: 只保留主干部 (level<=1 且足够粗), 细枝在远距离不可见
  const bark = new BarkAccum();
  for (const br of tree.branches) {
    if (br.level > 1 || !br.rads[0] || br.rads[0] < 0.03) continue;
    bark.addBranch(br, { flexOf: () => 0, seed: seed % 97, cellW: 0.18, disp: br.level === 0 ? trunkDisp({ seed: seed % 53 }) : null });
  }
  return { leafGeo: soup.toGeometry(), barkGeo: bark.toGeometry(), h, quads: soup.count };
}

export function createBackdropForest() {
  const root = new THREE.Group();
  root.name = 'gusu_backdrop_forest';

  // 程序化贴图 + 亮度烘焙 (与院内名木同一套)
  const texRng = makeRng(0x5eedbacc);
  const mapleAtlas = makeMapleAtlas(texRng, 2048);
  bakeAtlasLuminance(mapleAtlas, 'maple');
  const pineAtlas = makePineAtlas(texRng, 1024);
  bakeAtlasLuminance(pineAtlas, 'pine');

  const leafBroadMat = new THREE.MeshLambertMaterial({
    map: mapleAtlas, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true,
    emissive: new THREE.Color(0x0d1608),
  });
  const leafPineMat = new THREE.MeshLambertMaterial({
    map: pineAtlas, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true,
    emissive: new THREE.Color(0x0e1a0a),
  });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x3a2f24, roughness: 0.94, metalness: 0.0 });

  // ---- 14 株变体树 (真实分枝, 低细节档) ----
  const variantSpecs = [
    { kind: 'broad', h: 11 }, { kind: 'broad', h: 12 }, { kind: 'broad', h: 13 }, { kind: 'broad', h: 14 },
    { kind: 'maple', h: 10 }, { kind: 'maple', h: 11 }, { kind: 'maple', h: 12 },
    { kind: 'pine', h: 9 }, { kind: 'pine', h: 10 }, { kind: 'pine', h: 11 }, { kind: 'pine', h: 13 },
    { kind: 'broad', h: 9 }, { kind: 'maple', h: 9 }, { kind: 'pine', h: 8 },
  ];
  const variants = variantSpecs.map((sp, i) => ({ ...buildVariant(0xbeef00 + i * 7919, sp.kind, sp.h), kind: sp.kind }));

  // ---- 散布坐标 (保留原四区规划) ----
  const treeTransforms = [];
  // A. 北寺塔借景周边核心林海 (簇拥塔基, 高 13~20m)
  for (let i = 0; i < 55; i++) {
    const ang = Math.random() * TAU;
    const r = 18 + Math.random() * 55;
    const x = -105 + Math.cos(ang) * r;
    const z = -48 + Math.sin(ang) * r;
    if (Math.hypot(x - (-105), z - (-48)) < 15) continue;
    treeTransforms.push({ x, z, totalH: 13 + Math.random() * 7, zone: 'pagoda' });
  }
  // B. 北墙粉墙外借景林带 (连续绿屏, 高 8.5~12.5m)
  for (let i = 0; i < 75; i++) {
    treeTransforms.push({ x: -55 + Math.random() * 120, z: -50 - Math.random() * 32, totalH: 8.5 + Math.random() * 4.0, zone: 'north' });
  }
  // C. 西侧围墙外山林绿障
  for (let i = 0; i < 48; i++) {
    const x = -53 - Math.random() * 35;
    const z = -35 + Math.random() * 78;
    if (Math.hypot(x - (-105), z - (-48)) < 30) continue;
    treeTransforms.push({ x, z, totalH: 8.0 + Math.random() * 4.5, zone: 'west' });
  }
  // D. 东侧围墙外林带
  for (let i = 0; i < 34; i++) {
    treeTransforms.push({ x: 67 + Math.random() * 26, z: -42 + Math.random() * 84, totalH: 8.0 + Math.random() * 4.0, zone: 'east' });
  }

  // ---- 变体分配 + 按变体分桶实例化 ----
  const broadH = variants.map((v, i) => ({ i, kind: v.kind, h: v.h }));
  const pickVariant = (t) => {
    const rngv = Math.random();
    if (t.zone === 'pagoda') {
      // 塔基周边: 偏高大阔叶 + 少量松
      const pool = broadH.filter((v) => v.h >= 11 || v.kind === 'pine');
      return pool[Math.floor(rngv * pool.length)].i;
    }
    return Math.floor(rngv * variants.length);
  };

  const perVariant = variants.map(() => []);
  for (const t of treeTransforms) {
    const vi = pickVariant(t);
    perVariant[vi].push(t);
  }

  const dummy = new THREE.Object3D();
  variants.forEach((v, vi) => {
    const list = perVariant[vi];
    if (!list.length) return;
    const leafMat = v.kind === 'pine' ? leafPineMat : leafBroadMat;
    const leafInst = new THREE.InstancedMesh(v.leafGeo, leafMat, list.length);
    const barkInst = new THREE.InstancedMesh(v.barkGeo, barkMat, list.length);
    leafInst.castShadow = false;   // 远景叶影进不了阴影相机, 省 60 万三角形阴影开销
    leafInst.receiveShadow = false;
    barkInst.castShadow = false;
    barkInst.receiveShadow = false;
    list.forEach((t, k) => {
      const scale = (t.totalH / v.h) * (0.9 + Math.random() * 0.25);
      dummy.position.set(t.x, 0, t.z);
      dummy.rotation.set((Math.random() - 0.5) * 0.06, Math.random() * TAU, (Math.random() - 0.5) * 0.06);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      leafInst.setMatrixAt(k, dummy.matrix);
      barkInst.setMatrixAt(k, dummy.matrix);
    });
    leafInst.instanceMatrix.needsUpdate = true;
    barkInst.instanceMatrix.needsUpdate = true;
    root.add(leafInst);
    root.add(barkInst);
  });

  return root;
}
