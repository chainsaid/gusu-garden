// ---------------------------------------------------------------------------
// trees.js — 姑苏园林古木树阵系统 (严格对齐母本 src/layout.js 权威植物志与造园规范)
// 包含：
//   1. 苍古罗汉松/黑松 (Podocarpus/Pine) — 多层轻盈针叶云盘 (Alpha-tested 真实针叶贴图)
//   2. 霜叶朱砂红枫 (Red Maple) — 鸡爪槭七裂羽状掌叶，全园严格限 4 株点睛
//   3. 苍翠青枫香樟 (Green Maple/Camphor) — 苍翠挺秀，掩映白粉高墙
//   4. 水榭月台照影海棠 (Crabapple Blossom) — 白粉相间娇嫩花瓣
//   5. 驳岸踏波垂柳 (Weeping Willow) — 依水临波，柔条拂水
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from '../../../shared/layout.js';

const TAU = Math.PI * 2;

// 1. 程序化绘制 512x512 罗汉松/黑松松针簇贴图 (带放射状针叶、自然光泽与透光尖端)
function createPineNeedleTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  // 中心小木质枝梗
  ctx.strokeStyle = '#2d1e16';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(S * 0.5, S * 0.96);
  ctx.lineTo(S * 0.5, S * 0.65);
  ctx.stroke();

  // 辐射向上放射的松针扇面 (75~90 根密集松针)
  const nNeedles = 88;
  for (let i = 0; i < nNeedles; i++) {
    const u = (i / nNeedles) * 2 - 1; // -1 ~ 1
    const angle = u * (Math.PI * 0.44) - Math.PI * 0.5; // 向上扇形散开
    const length = S * (0.36 + Math.random() * 0.28) * (1.0 - 0.26 * Math.pow(Math.abs(u), 1.6));
    const startY = S * (0.70 + Math.random() * 0.18);
    const startX = S * (0.5 + (Math.random() - 0.5) * 0.08);

    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;
    const ctrlX = startX + Math.cos(angle) * length * 0.5 + (Math.random() - 0.5) * 12;
    const ctrlY = startY + Math.sin(angle) * length * 0.5 + 8;

    const grad = ctx.createLinearGradient(startX, startY, endX, endY);
    const baseGreen = Math.random() < 0.5 ? '#142518' : '#1c3420';
    const tipGreen = Math.random() < 0.6 ? '#2c4e2e' : '#3c6237';
    grad.addColorStop(0.0, baseGreen);
    grad.addColorStop(0.75, tipGreen);
    grad.addColorStop(1.0, '#587a48');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 2. 程序化绘制 512x512 鸡爪枫掌状叶簇贴图 (支持红枫与苍翠青枫)
function createMapleSprayTexture(isRed = true) {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  ctx.strokeStyle = isRed ? '#581816' : '#322216';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(S * 0.5, S * 0.95);
  ctx.quadraticCurveTo(S * 0.48, S * 0.6, S * 0.5, S * 0.35);
  ctx.stroke();

  function drawMapleLeaf(cx, cy, r, rot, leafColor, tipColor) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    const lobeAngles = [-85, -55, -25, 0, 25, 55, 85].map(d => (d * Math.PI) / 180);
    const lobeLens = [0.55, 0.78, 0.96, 1.0, 0.96, 0.78, 0.55];

    ctx.strokeStyle = isRed ? '#8a1810' : '#4a6020';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let k = 0; k < 7; k++) {
      const a = lobeAngles[k] - Math.PI * 0.5;
      const len = r * lobeLens[k];
      const tipX = Math.cos(a) * len;
      const tipY = Math.sin(a) * len;
      const midA1 = a - 0.12;
      const midA2 = a + 0.12;
      const w = len * 0.28;

      ctx.lineTo(Math.cos(midA1) * (len * 0.5) - Math.sin(midA1) * w * 0.5, Math.sin(midA1) * (len * 0.5) + Math.cos(midA1) * w * 0.5);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(Math.cos(midA2) * (len * 0.5) + Math.sin(midA2) * w * 0.5, Math.sin(midA2) * (len * 0.5) - Math.cos(midA2) * w * 0.5);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(0, 0, 0, 0, -r * 0.5, r);
    grad.addColorStop(0.0, leafColor);
    grad.addColorStop(0.7, tipColor);
    grad.addColorStop(1.0, isRed ? '#e25c18' : '#729838');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = isRed ? '#621008' : '#223c14';
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 7; k++) {
      const a = lobeAngles[k] - Math.PI * 0.5;
      const len = r * lobeLens[k];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * len * 0.85, Math.sin(a) * len * 0.85);
      ctx.stroke();
    }

    ctx.restore();
  }

  const leaves = [
    { x: S * 0.5, y: S * 0.22, r: 64, rot: -0.1 },
    { x: S * 0.35, y: S * 0.36, r: 58, rot: -0.6 },
    { x: S * 0.65, y: S * 0.38, r: 56, rot: 0.5 },
    { x: S * 0.24, y: S * 0.52, r: 54, rot: -0.9 },
    { x: S * 0.72, y: S * 0.54, r: 52, rot: 0.8 },
    { x: S * 0.42, y: S * 0.50, r: 50, rot: -0.2 },
    { x: S * 0.58, y: S * 0.52, r: 48, rot: 0.3 },
    { x: S * 0.32, y: S * 0.68, r: 46, rot: -1.1 },
    { x: S * 0.68, y: S * 0.70, r: 44, rot: 1.0 },
  ];

  leaves.forEach((l) => {
    const col = isRed
      ? (Math.random() < 0.6 ? '#8c1510' : '#b22214')
      : (Math.random() < 0.6 ? '#28461f' : '#385e28');
    const tip = isRed
      ? (Math.random() < 0.5 ? '#cf3216' : '#dd581c')
      : (Math.random() < 0.5 ? '#50782e' : '#689238');
    drawMapleLeaf(l.x, l.y, l.r, l.rot + (Math.random() - 0.5) * 0.2, col, tip);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 3. 程序化绘制 512x512 海棠枝花贴图
function createBlossomSprayTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  ctx.strokeStyle = '#38241c';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(S * 0.5, S * 0.98);
  ctx.quadraticCurveTo(S * 0.48, S * 0.6, S * 0.52, S * 0.2);
  ctx.stroke();

  function drawBlossom(cx, cy, r, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      const petX = Math.cos(a) * r * 0.65;
      const petY = Math.sin(a) * r * 0.65;
      const grad = ctx.createRadialGradient(0, 0, 0, petX, petY, r);
      grad.addColorStop(0.0, '#fffdfa');
      grad.addColorStop(0.6, '#fde8ef');
      grad.addColorStop(0.9, '#f48fb1');
      grad.addColorStop(1.0, '#e91e63');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(petX, petY, r * 0.6, r * 0.42, a, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  const blossoms = [
    { x: S * 0.50, y: S * 0.22, r: 42, rot: 0.1 },
    { x: S * 0.38, y: S * 0.38, r: 46, rot: -0.4 },
    { x: S * 0.62, y: S * 0.42, r: 44, rot: 0.6 },
    { x: S * 0.32, y: S * 0.58, r: 48, rot: -0.7 },
    { x: S * 0.68, y: S * 0.62, r: 45, rot: 0.5 },
  ];
  blossoms.forEach(b => drawBlossom(b.x, b.y, b.r, b.rot));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 4. 垂柳柔条贴图
function createWillowStrandTexture() {
  const W = 128, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // 垂直细柔柳条
  ctx.strokeStyle = '#4a6828';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W * 0.5, 0);
  ctx.quadraticCurveTo(W * 0.48, H * 0.5, W * 0.5, H);
  ctx.stroke();

  // 沿柳条交互散布披针形狭长柳叶
  const nLeaves = 32;
  for (let i = 0; i < nLeaves; i++) {
    const t = i / nLeaves;
    const y = H * (0.05 + t * 0.90);
    const side = (i % 2 === 0) ? 1 : -1;
    const lx = W * 0.5;
    const len = 28 + Math.random() * 12;
    const droop = 16 + Math.random() * 8;

    ctx.save();
    ctx.translate(lx, y);
    ctx.rotate(side * 0.55 + 0.3);

    const grad = ctx.createLinearGradient(0, 0, side * len, droop);
    grad.addColorStop(0.0, '#36541c');
    grad.addColorStop(0.7, '#629238');
    grad.addColorStop(1.0, '#7aa842');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(side * len * 0.5, droop * 0.5, len * 0.5, 4.5, side * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCrossQuadGeo(w = 1.2, h = 1.2) {
  const p1 = new THREE.PlaneGeometry(w, h);
  const p2 = new THREE.PlaneGeometry(w, h);
  p2.rotateY(Math.PI / 3);
  const p3 = new THREE.PlaneGeometry(w, h);
  p3.rotateY((Math.PI * 2) / 3);
  const p4 = new THREE.PlaneGeometry(w * 0.95, w * 0.95);
  p4.rotateX(Math.PI / 2);
  return mergeGeometries([p1, p2, p3, p4], false);
}

export function createJiangnanTrees(scene) {
  const treeRoot = new THREE.Group();
  treeRoot.name = 'jiangnan_trees';

  // 树皮材质
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x36281e,
    roughness: 0.88,
    metalness: 0.02,
  });

  // 松针材质
  const pineNeedleTex = createPineNeedleTexture();
  const pineNeedleMat = new THREE.MeshStandardMaterial({
    map: pineNeedleTex,
    alphaTest: 0.35,
    roughness: 0.50,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });

  // 红枫材质 (全园严格限 4 株点睛)
  const mapleTex = createMapleSprayTexture(true);
  const mapleMat = new THREE.MeshStandardMaterial({
    map: mapleTex,
    alphaTest: 0.35,
    roughness: 0.52,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 苍翠青枫香樟材质
  const greenMapleTex = createMapleSprayTexture(false);
  const greenMapleMat = new THREE.MeshStandardMaterial({
    map: greenMapleTex,
    alphaTest: 0.35,
    roughness: 0.55,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 海棠花枝材质
  const blossomTex = createBlossomSprayTexture();
  const blossomSprayMat = new THREE.MeshStandardMaterial({
    map: blossomTex,
    alphaTest: 0.38,
    roughness: 0.48,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 垂柳柔条材质
  const willowTex = createWillowStrandTexture();
  const willowMat = new THREE.MeshStandardMaterial({
    map: willowTex,
    alphaTest: 0.30,
    roughness: 0.45,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });

  const pineClusterGeo = createCrossQuadGeo(1.45, 1.25);
  const mapleClusterGeo = createCrossQuadGeo(1.48, 1.28);
  const greenClusterGeo = createCrossQuadGeo(1.42, 1.20);
  const blossomCardGeo = new THREE.PlaneGeometry(0.88, 0.88);
  const willowStrandGeo = new THREE.PlaneGeometry(0.55, 2.6);
  willowStrandGeo.translate(0, -1.3, 0); // 锚点定在顶端

  // 严格忠实原版 src/layout.js 权威名木列表 (18 株核心园林名木 + 1 株月台海棠)
  const treeSpots = [
    { x: 19.2, z: -6.4, h: 5.2, lean: 0.45, dir: -2.6, type: 'blossom', cards: 52 },
    ...(L.trees || []).map((t) => ({
      x: t.at[0],
      z: t.at[1],
      h: t.h || 6.5,
      lean: 0.30,
      dir: (t.at[0] * 0.17 + t.at[1] * 0.23) % Math.PI,
      type: t.type === 'maple' ? 'greenMaple' : t.type, // 'pine', 'greenMaple', 'mapleRed' (仅4株)
    })),
  ];

  const trunkGeos = [];
  const pineMatrices = [];
  const mapleMatrices = [];
  const greenMapleMatrices = [];
  const blossomMatrices = [];
  const willowMatrices = [];

  // 1. 生成 18 株古典园林核心名木 (苍古曲干与舒展林冠)
  treeSpots.forEach((t) => {
    const curvePts = [
      new THREE.Vector3(t.x, 0, t.z),
      new THREE.Vector3(t.x + Math.cos(t.dir) * (t.h * 0.12), t.h * 0.36, t.z + Math.sin(t.dir) * (t.h * 0.12)),
      new THREE.Vector3(t.x + Math.cos(t.dir) * (t.h * 0.32), t.h * 0.72, t.z + Math.sin(t.dir) * (t.h * 0.32)),
      new THREE.Vector3(t.x + Math.cos(t.dir) * (t.h * 0.42), t.h, t.z + Math.sin(t.dir) * (t.h * 0.42)),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const trunkRadius = Math.max(0.16, t.h * 0.032);
    const trunkTube = new THREE.TubeGeometry(curve, 16, trunkRadius, 6, false);
    trunkGeos.push(trunkTube);

    // 海棠
    if (t.type === 'blossom') {
      const nCards = t.cards || 36;
      for (let k = 0; k < nCards; k++) {
        const frac = 0.38 + (k / nCards) * 0.62;
        const pt = curve.getPoint(frac);
        const ang = (k * 137.5 * Math.PI) / 180;
        const bLen = 0.65 + Math.random() * 1.1;
        const bx = pt.x + Math.cos(ang) * bLen;
        const bz = pt.z + Math.sin(ang) * bLen;
        const by = pt.y + (Math.random() - 0.4) * 0.6;

        const bCurve = new THREE.CatmullRomCurve3([
          pt,
          new THREE.Vector3((pt.x + bx) / 2, (pt.y + by) / 2 + 0.06, (pt.z + bz) / 2),
          new THREE.Vector3(bx, by, bz),
        ]);
        trunkGeos.push(new THREE.TubeGeometry(bCurve, 5, 0.024, 4, false));

        const scale = 0.75 + Math.random() * 0.35;
        const m = new THREE.Matrix4()
          .makeRotationFromEuler(new THREE.Euler(Math.random() * 0.5, Math.random() * TAU, (Math.random() - 0.5) * 0.5))
          .scale(new THREE.Vector3(scale, scale, scale))
          .setPosition(bx, by, bz);
        blossomMatrices.push(m);
      }
      return;
    }

    // 苍松 (Pine)：中上部分层舒展云盘
    if (t.type === 'pine') {
      const nPads = 9;
      const crownTop = curve.getPoint(1.0);
      for (let k = 1; k <= nPads; k++) {
        const frac = 0.38 + (k / nPads) * 0.60;
        const pt = curve.getPoint(frac);
        const angle = (k * 137.5 * Math.PI) / 180 + t.dir;
        const branchLen = 1.1 + (k % 3) * 0.55;
        const bx = pt.x + Math.cos(angle) * branchLen;
        const bz = pt.z + Math.sin(angle) * branchLen;
        const by = pt.y + ((k % 2) - 0.35) * 0.22;

        const branchCurve = new THREE.CatmullRomCurve3([
          pt,
          new THREE.Vector3((pt.x + bx) / 2, (pt.y + by) / 2 + 0.10, (pt.z + bz) / 2),
          new THREE.Vector3(bx, by, bz),
        ]);
        trunkGeos.push(new THREE.TubeGeometry(branchCurve, 5, trunkRadius * 0.38, 4, false));

        for (let c = 0; c < 5; c++) {
          const offX = (Math.random() - 0.5) * 0.75;
          const offY = (Math.random() - 0.5) * 0.25;
          const offZ = (Math.random() - 0.5) * 0.75;
          const sc = (1.0 + Math.random() * 0.45) * Math.max(0.9, t.h / 6.5);
          const m = new THREE.Matrix4()
            .makeRotationFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, Math.random() * TAU, (Math.random() - 0.5) * 0.4))
            .scale(new THREE.Vector3(sc, sc, sc))
            .setPosition(bx + offX, by + offY, bz + offZ);
          pineMatrices.push(m);
        }
      }

      for (let topK = 0; topK < 8; topK++) {
        const topSc = (1.1 + Math.random() * 0.45) * Math.max(0.9, t.h / 6.5);
        const m = new THREE.Matrix4()
          .makeRotationFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.3, Math.random() * TAU, (Math.random() - 0.5) * 0.3))
          .scale(new THREE.Vector3(topSc, topSc, topSc))
          .setPosition(crownTop.x + (Math.random() - 0.5) * 0.9, crownTop.y + (Math.random() - 0.2) * 0.5, crownTop.z + (Math.random() - 0.5) * 0.9);
        pineMatrices.push(m);
      }
      return;
    }

    // 阔叶树种 (仅 4 株红枫与 5 株苍翠青枫)
    const isRedMaple = t.type === 'mapleRed';
    const nMainBranches = isRedMaple ? 7 : 6;
    const crownTop = curve.getPoint(1.0);
    const crownRadius = Math.max(1.8, t.h * 0.36);

    for (let b = 0; b < nMainBranches; b++) {
      const bFrac = 0.35 + b * 0.10;
      const bPt = curve.getPoint(bFrac);
      const bAng = (b / nMainBranches) * TAU + t.dir;
      const bReach = crownRadius * (0.85 + Math.random() * 0.35);
      const bEnd = new THREE.Vector3(
        bPt.x + Math.cos(bAng) * bReach,
        bPt.y + (Math.random() * 0.30 + 0.15) * crownRadius,
        bPt.z + Math.sin(bAng) * bReach
      );
      const bCurve = new THREE.CatmullRomCurve3([
        bPt,
        new THREE.Vector3((bPt.x + bEnd.x) / 2, (bPt.y + bEnd.y) / 2 + 0.12, (bPt.z + bEnd.z) / 2),
        bEnd,
      ]);
      trunkGeos.push(new THREE.TubeGeometry(bCurve, 5, trunkRadius * 0.34, 4, false));

      const nLeafClusters = isRedMaple ? 8 : 7;
      for (let lc = 0; lc < nLeafClusters; lc++) {
        const cFrac = 0.20 + (lc / nLeafClusters) * 0.80;
        const cp = bCurve.getPoint(cFrac);
        const sc = (0.90 + Math.random() * 0.38) * (crownRadius * 0.52);
        const m = new THREE.Matrix4()
          .makeRotationFromEuler(new THREE.Euler(Math.random() * 0.5, Math.random() * TAU, (Math.random() - 0.5) * 0.5))
          .scale(new THREE.Vector3(sc, sc, sc))
          .setPosition(
            cp.x + (Math.random() - 0.5) * 0.6,
            cp.y + (Math.random() - 0.4) * 0.4,
            cp.z + (Math.random() - 0.5) * 0.6
          );

        if (isRedMaple) mapleMatrices.push(m);
        else greenMapleMatrices.push(m);
      }
    }

    for (let tk = 0; tk < 8; tk++) {
      const sc = (0.90 + Math.random() * 0.35) * (crownRadius * 0.50);
      const m = new THREE.Matrix4()
        .makeRotationFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, Math.random() * TAU, (Math.random() - 0.5) * 0.4))
        .scale(new THREE.Vector3(sc, sc, sc))
        .setPosition(
          crownTop.x + (Math.random() - 0.5) * 0.9,
          crownTop.y + (Math.random() - 0.2) * 0.45,
          crownTop.z + (Math.random() - 0.5) * 0.9
        );
      if (isRedMaple) mapleMatrices.push(m);
      else greenMapleMatrices.push(m);
    }
  });

  // 2. 忠实移植母本 src/world/vegetation-willow.js：6 株驳岸临波垂柳
  const willowSpots = [
    { x: -16, z: 6.2, yaw: 0.4, scale: 1.15 },
    { x: 34, z: 6.8, yaw: -0.5, scale: 1.1 },
    { x: 42, z: 14.0, yaw: -1.2, scale: 1.05 },
    { x: 38, z: 28.0, yaw: -2.1, scale: 1.12 },
    { x: -22, z: 28.0, yaw: 2.2, scale: 1.08 },
    { x: -2, z: 18.0, yaw: 0.8, scale: 0.95 }, // 湖心小岛垂柳
  ];

  willowSpots.forEach((ws) => {
    const s = ws.scale;
    const h = 4.4 * s;
    const leanZ = 1.8 * s;
    // 弯曲树干直探水面
    const curvePts = [
      new THREE.Vector3(ws.x, 0, ws.z),
      new THREE.Vector3(ws.x + Math.cos(ws.yaw) * (leanZ * 0.35), h * 0.45, ws.z + Math.sin(ws.yaw) * (leanZ * 0.35)),
      new THREE.Vector3(ws.x + Math.cos(ws.yaw) * (leanZ * 0.85), h * 0.82, ws.z + Math.sin(ws.yaw) * (leanZ * 0.85)),
      new THREE.Vector3(ws.x + Math.cos(ws.yaw) * leanZ, h, ws.z + Math.sin(ws.yaw) * leanZ),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePts);
    trunkGeos.push(new THREE.TubeGeometry(curve, 12, 0.18 * s, 6, false));

    const crownPt = curve.getPoint(1.0);
    // 悬挂柔长柳条 (以圆环散开，垂直下垂拂水)
    const nStrands = 48;
    for (let k = 0; k < nStrands; k++) {
      const ang = (k / nStrands) * TAU;
      const rad = (0.6 + Math.random() * 1.8) * s;
      const px = crownPt.x + Math.cos(ang) * rad;
      const pz = crownPt.z + Math.sin(ang) * rad;
      const py = crownPt.y + (Math.random() - 0.4) * 0.6;

      const scY = 0.85 + Math.random() * 0.35;
      const scXZ = 0.80 + Math.random() * 0.30;
      const m = new THREE.Matrix4()
        .makeRotationFromEuler(new THREE.Euler(
          (Math.random() - 0.5) * 0.12,
          Math.random() * TAU,
          (Math.random() - 0.5) * 0.12
        ))
        .scale(new THREE.Vector3(scXZ, scY, scXZ))
        .setPosition(px, py, pz);
      willowMatrices.push(m);
    }
  });

  // 合并树干网格
  if (trunkGeos.length > 0) {
    const mergedTrunk = mergeGeometries(trunkGeos, false);
    const trunkMesh = new THREE.Mesh(mergedTrunk, trunkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeRoot.add(trunkMesh);
  }

  // 1. 松针实例合批 (9 株古松)
  if (pineMatrices.length > 0) {
    const pineInst = new THREE.InstancedMesh(pineClusterGeo, pineNeedleMat, pineMatrices.length);
    pineInst.castShadow = true;
    pineInst.receiveShadow = true;
    pineMatrices.forEach((m, idx) => pineInst.setMatrixAt(idx, m));
    pineInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(pineInst);
  }

  // 2. 霜叶红枫实例合批 (严格限 4 株点睛)
  if (mapleMatrices.length > 0) {
    const mapleInst = new THREE.InstancedMesh(mapleClusterGeo, mapleMat, mapleMatrices.length);
    mapleInst.castShadow = true;
    mapleInst.receiveShadow = true;
    mapleMatrices.forEach((m, idx) => mapleInst.setMatrixAt(idx, m));
    mapleInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(mapleInst);
  }

  // 3. 苍翠青枫实例合批 (5 株)
  if (greenMapleMatrices.length > 0) {
    const greenInst = new THREE.InstancedMesh(greenClusterGeo, greenMapleMat, greenMapleMatrices.length);
    greenInst.castShadow = true;
    greenInst.receiveShadow = true;
    greenMapleMatrices.forEach((m, idx) => greenInst.setMatrixAt(idx, m));
    greenInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(greenInst);
  }

  // 4. 海棠花枝卡片实例合批 (1 株)
  if (blossomMatrices.length > 0) {
    const blossomInst = new THREE.InstancedMesh(blossomCardGeo, blossomSprayMat, blossomMatrices.length);
    blossomInst.castShadow = true;
    blossomInst.receiveShadow = true;
    blossomMatrices.forEach((m, idx) => blossomInst.setMatrixAt(idx, m));
    blossomInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(blossomInst);
  }

  // 5. 岸边垂柳柔条实例合批 (6 株)
  if (willowMatrices.length > 0) {
    const willowInst = new THREE.InstancedMesh(willowStrandGeo, willowMat, willowMatrices.length);
    willowInst.castShadow = true;
    willowInst.receiveShadow = true;
    willowMatrices.forEach((m, idx) => willowInst.setMatrixAt(idx, m));
    willowInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(willowInst);
  }

  scene.add(treeRoot);

  return {
    group: treeRoot,
    setVisible: (visible) => {
      treeRoot.visible = visible;
    }
  };
}
