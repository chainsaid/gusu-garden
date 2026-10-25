// ---------------------------------------------------------------------------
// trees.js — 姑苏园林古木树阵系统 (Classical Garden Tree Belt & Framing Canopies)
// 包含：
//   1. 苍古罗汉松/黑松 (Podocarpus/Pine) — 多层轻盈针叶云盘 (Alpha-tested 真实针叶贴图，杜绝实心飞碟)
//   2. 霜叶朱砂红枫 (Red Maple) — 鸡爪槭七裂羽状掌叶，深沉朱砂兼透落日红霞
//   3. 水榭月台照影海棠 (Crabapple Blossom) — 白粉相间娇嫩花瓣与微风铜绿初芽
//   4. 翠嶂香樟青枫 (Camphor/Green Maple) — 院墙后景深林，掩映白粉高墙
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
    // 幽深苍墨玉松绿到夕阳金绿尖梢
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

// 2. 程序化绘制 512x512 鸡爪红枫七裂掌状叶簇贴图 (朱砂、洋红、落日金橙与暗红叶脉)
function createMapleSprayTexture(isRed = true) {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  // 细瘦曲折小枝
  ctx.strokeStyle = isRed ? '#581816' : '#322216';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(S * 0.5, S * 0.95);
  ctx.quadraticCurveTo(S * 0.48, S * 0.6, S * 0.5, S * 0.35);
  ctx.stroke();

  // 绘制单片经典江南鸡爪枫掌状叶 (7 裂齿缘)
  function drawMapleLeaf(cx, cy, r, rot, leafColor, tipColor) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    const lobeAngles = [-85, -55, -25, 0, 25, 55, 85].map(d => (d * Math.PI) / 180);
    const lobeLens = [0.55, 0.78, 0.96, 1.0, 0.96, 0.78, 0.55];

    // 叶柄
    ctx.strokeStyle = isRed ? '#8a1810' : '#4a6020';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // 叶片轮廓
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

    // 掌状主脉
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

  // 散布 9 片错落交叠掌状红枫叶
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

// 3. 程序化绘制 512x512 海棠/早樱枝花贴图 (带柔嫩花瓣、花蕊与微枝，Alpha-tested)
function createBlossomSprayTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  // 弯曲深褐小枝
  ctx.strokeStyle = '#38241c';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(S * 0.1, S * 0.9);
  ctx.quadraticCurveTo(S * 0.45, S * 0.55, S * 0.85, S * 0.2);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(S * 0.4, S * 0.6);
  ctx.quadraticCurveTo(S * 0.3, S * 0.35, S * 0.2, S * 0.25);
  ctx.moveTo(S * 0.6, S * 0.4);
  ctx.quadraticCurveTo(S * 0.75, S * 0.45, S * 0.88, S * 0.55);
  ctx.stroke();

  // 幼嫩铜绿叶片
  for (let i = 0; i < 14; i++) {
    const lx = S * (0.2 + Math.random() * 0.65);
    const ly = S * (0.2 + Math.random() * 0.65);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(Math.random() * TAU);
    ctx.fillStyle = Math.random() < 0.5 ? '#6a7838' : '#7d5c38';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 24, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 绘制单朵江南海棠花
  function drawFlower(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // 5 片圆润娇嫩花瓣 (白中泛粉，瓣尖微绯)
    for (let k = 0; k < 5; k++) {
      ctx.save();
      ctx.rotate((k / 5) * TAU);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0.0, '#d85878');
      grad.addColorStop(0.35, '#f5b0c4');
      grad.addColorStop(0.85, '#fae6ee');
      grad.addColorStop(1.0, '#ffffff');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(r * 0.5, r * 0.3, r * 0.55, r * 0.85, 0, r);
      ctx.bezierCurveTo(-r * 0.55, r * 0.85, -r * 0.5, r * 0.3, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    // 金黄花蕊
    for (let s = 0; s < 14; s++) {
      const a = (s / 14) * TAU + Math.random() * 0.2;
      const l = r * (0.25 + Math.random() * 0.2);
      ctx.strokeStyle = '#f098aa';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l);
      ctx.stroke();

      ctx.fillStyle = '#e8c048';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * l, Math.sin(a) * l, 2.2, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = '#c83858';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  // 散布 32 朵盛开花朵与花苞
  for (let i = 0; i < 32; i++) {
    const fx = S * (0.15 + Math.random() * 0.72);
    const fy = S * (0.15 + Math.random() * 0.72);
    const fr = 22 + Math.random() * 16;
    drawFlower(fx, fy, fr, Math.random() * TAU);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 4. 构建三维全向交错叶片簇几何体 (3 组夹角 60° 相交平面，杜绝单薄视角缺失)
function createCrossQuadGeo(width = 1.0, height = 1.0) {
  const p1 = new THREE.PlaneGeometry(width, height);
  const p2 = new THREE.PlaneGeometry(width, height);
  p2.rotateY(Math.PI / 3);
  const p3 = new THREE.PlaneGeometry(width, height);
  p3.rotateY((Math.PI * 2) / 3);
  return mergeGeometries([p1, p2, p3], false);
}

export function createJiangnanTrees(scene) {
  const treeRoot = new THREE.Group();
  treeRoot.name = 'jiangnan_trees';

  // 材质套件
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x36261d, // 苍古深褐树干
    roughness: 0.88,
    metalness: 0.02,
  });

  // 1. 苍古罗汉松针叶材质 (Alpha 测试 + 双面光照)
  const pineTex = createPineNeedleTexture();
  const pineNeedleMat = new THREE.MeshStandardMaterial({
    map: pineTex,
    alphaTest: 0.36,
    roughness: 0.58,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 2. 霜叶红枫材质 (Alpha 测试 + 双面透光)
  const mapleTex = createMapleSprayTexture(true);
  const mapleMat = new THREE.MeshStandardMaterial({
    map: mapleTex,
    alphaTest: 0.35,
    roughness: 0.52,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 3. 苍翠青枫香樟材质 (Alpha 测试 + 双面透光)
  const greenMapleTex = createMapleSprayTexture(false);
  const greenMapleMat = new THREE.MeshStandardMaterial({
    map: greenMapleTex,
    alphaTest: 0.35,
    roughness: 0.55,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 4. 海棠花枝材质 (Alpha 测试 + 双面光照)
  const blossomTex = createBlossomSprayTexture();
  const blossomSprayMat = new THREE.MeshStandardMaterial({
    map: blossomTex,
    alphaTest: 0.38,
    roughness: 0.48,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const pineClusterGeo = createCrossQuadGeo(1.38, 1.18);
  const mapleClusterGeo = createCrossQuadGeo(1.48, 1.28);
  const greenClusterGeo = createCrossQuadGeo(1.42, 1.20);
  const blossomCardGeo = new THREE.PlaneGeometry(0.88, 0.88);

  // 1. 确定性伪随机数生成器 (保证树木阵列与树干偏角每帧/每次刷新严格稳定可复现)
  function makeLcg(seed = 12345) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      return (s = (s * 16807) % 2147483647) / 2147483647;
    };
  }
  const treeRng = makeLcg(42);

  // 2. 庭院焦点与造园景致名木 (以 Node 版权威源 shared/layout.js 的 L.trees 为基准派生)
  const treeSpots = [
    // 月台前景海棠 (保留用于近景特写与月台框景)
    { x: 19.2, z: -6.4, h: 5.2, lean: 0.45, dir: -2.6, type: 'blossom', cards: 52, isHero: true },
    ...(L.trees || []).map((t) => ({
      x: t.at[0],
      z: t.at[1],
      h: t.h || 6.5,
      lean: 0.32,
      dir: (t.at[0] * 0.17 + t.at[1] * 0.23) % Math.PI,
      type: t.type === 'maple' ? 'greenMaple' : t.type,
      isHero: true,
    })),
  ];

  // 3. 全园外围茂密环园林带 (对齐母本 terrain-forest.js 郁郁葱葱深林意境，完全消除空旷平地与视界露馅)
  // (A) 北侧后山古木深林 (主厅后方层峦叠翠)
  for (let z = -54; z >= -76; z -= 7) {
    for (let x = -58; x <= 72; x += 7.2) {
      const rx = x + (treeRng() - 0.5) * 2.8;
      const rz = z + (treeRng() - 0.5) * 2.8;
      const rnd = treeRng();
      const type = rnd < 0.68 ? 'greenMaple' : (rnd < 0.88 ? 'pine' : 'mapleRed');
      const h = 12.0 + treeRng() * 4.5;
      treeSpots.push({ x: rx, z: rz, h, lean: 0.16 + treeRng() * 0.12, dir: treeRng() * TAU, type, isOuter: true });
    }
  }

  // (B) 西侧北寺塔连绵深林带 (西回廊墙外至北寺塔前，彻底消除 View 02/03/09 院墙后景秃地)
  for (let x = -56; x >= -84; x -= 7) {
    for (let z = -54; z <= 52; z += 6.8) {
      if (Math.hypot(x - (-105), z - (-48)) < 18) continue;
      const rx = x + (treeRng() - 0.5) * 2.6;
      const rz = z + (treeRng() - 0.5) * 2.6;
      const rnd = treeRng();
      const type = rnd < 0.65 ? 'greenMaple' : (rnd < 0.88 ? 'pine' : 'mapleRed');
      const h = 12.5 + treeRng() * 4.2;
      treeSpots.push({ x: rx, z: rz, h, lean: 0.16 + treeRng() * 0.12, dir: treeRng() * TAU, type, isOuter: true });
    }
  }

  // (C) 东侧幽篁高樟林 (水榭与东廊外侧，Benchmark 06/12 后景)
  for (let x = 70; x <= 92; x += 7) {
    for (let z = -52; z <= 52; z += 6.8) {
      const rx = x + (treeRng() - 0.5) * 2.6;
      const rz = z + (treeRng() - 0.5) * 2.6;
      const rnd = treeRng();
      const type = rnd < 0.70 ? 'greenMaple' : (rnd < 0.90 ? 'pine' : 'mapleRed');
      const h = 12.0 + treeRng() * 4.0;
      treeSpots.push({ x: rx, z: rz, h, lean: 0.16 + treeRng() * 0.12, dir: treeRng() * TAU, type, isOuter: true });
    }
  }

  // (D) 南侧大门入口外围林带 (游廊南墙外侧)
  for (let z = 52; z <= 74; z += 7) {
    for (let x = -56; x <= 70; x += 7.2) {
      if (Math.abs(x - 10) < 6.8) continue; // 大门步道入口通透留白
      const rx = x + (treeRng() - 0.5) * 2.6;
      const rz = z + (treeRng() - 0.5) * 2.6;
      const rnd = treeRng();
      const type = rnd < 0.70 ? 'greenMaple' : (rnd < 0.90 ? 'pine' : 'mapleRed');
      const h = 11.5 + treeRng() * 3.8;
      treeSpots.push({ x: rx, z: rz, h, lean: 0.16 + treeRng() * 0.12, dir: treeRng() * TAU, type, isOuter: true });
    }
  }

  // (E) 院内回廊内侧点缀林带 (对齐母本 pushBand 规范，丰满白粉墙掩映)
  const innerBand = [
    // 西侧回廊内
    ...[-36, -28, -20, -12, -4, 4, 12, 20, 28].map(z => ({ x: -47.5, z, h: 7.5 + treeRng() * 2.5, type: treeRng() < 0.6 ? 'greenMaple' : 'mapleRed' })),
    // 东侧回廊内
    ...[-36, -28, -20, -12, -4, 4, 12, 20, 28].map(z => ({ x: 61.5, z, h: 7.5 + treeRng() * 2.5, type: treeRng() < 0.6 ? 'greenMaple' : 'mapleRed' })),
    // 北侧主厅两翼
    ...[-36, -28, 48, 56].map(x => ({ x, z: -43.5, h: 8.5 + treeRng() * 2.5, type: treeRng() < 0.7 ? 'greenMaple' : 'pine' })),
    // 南坪草坪内侧
    ...[-36, -28, -20, 24, 32, 48].map(x => ({ x, z: 41.5, h: 7.0 + treeRng() * 2.5, type: treeRng() < 0.6 ? 'greenMaple' : 'mapleRed' })),
  ];
  innerBand.forEach(ib => {
    treeSpots.push({
      x: ib.x + (treeRng() - 0.5) * 1.5,
      z: ib.z + (treeRng() - 0.5) * 1.5,
      h: ib.h,
      lean: 0.22,
      dir: treeRng() * TAU,
      type: ib.type,
      isOuter: false,
    });
  });

  const trunkGeos = [];
  const pineMatrices = [];
  const mapleMatrices = [];
  const greenMapleMatrices = [];
  const blossomMatrices = [];

  treeSpots.forEach((t) => {
    // 遒劲树干路径
    const curvePts = [
      new THREE.Vector3(t.x, 0, t.z),
      new THREE.Vector3(t.x + Math.cos(t.dir) * (t.h * 0.12), t.h * 0.36, t.z + Math.sin(t.dir) * (t.h * 0.12)),
      new THREE.Vector3(t.x + Math.cos(t.dir) * (t.h * 0.32), t.h * 0.72, t.z + Math.sin(t.dir) * (t.h * 0.32)),
      new THREE.Vector3(t.x + Math.cos(t.dir) * (t.h * 0.42), t.h, t.z + Math.sin(t.dir) * (t.h * 0.42)),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const trunkRadius = Math.max(0.14, t.h * (t.isOuter ? 0.026 : 0.032));
    const trunkTube = new THREE.TubeGeometry(curve, t.isOuter ? 8 : 16, trunkRadius, t.isOuter ? 5 : 6, false);
    trunkGeos.push(trunkTube);

    // 1. 海棠花树
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

        // 小分支
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

      // 额外为月台镜头 (Benchmark 04) 左上角极边缘点缀微量垂枝花梢 (绝不侵入长窗与月台视线)
      const framingSpots = [
        { x: 23.6, y: 3.7, z: -6.7 },
        { x: 23.3, y: 3.4, z: -6.8 },
        { x: 23.0, y: 3.1, z: -6.9 },
      ];

      framingSpots.forEach((fp) => {
        const sc = 0.68 + Math.random() * 0.24;
        const m = new THREE.Matrix4()
          .makeRotationFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.25, Math.random() * 0.4 - 0.9, (Math.random() - 0.5) * 0.25))
          .scale(new THREE.Vector3(sc, sc, sc))
          .setPosition(fp.x + (Math.random() - 0.5) * 0.10, fp.y + (Math.random() - 0.5) * 0.08, fp.z + (Math.random() - 0.5) * 0.10);
        blossomMatrices.push(m);
      });

      return;
    }

    // 2. 苍松 (Pine)：中上部分层遒劲伸展云盘
    if (t.type === 'pine') {
      const nPads = t.isOuter ? 5 : 8;
      const crownTop = curve.getPoint(1.0);
      for (let k = 1; k <= nPads; k++) {
        const frac = 0.42 + (k / nPads) * 0.56;
        const pt = curve.getPoint(frac);
        const angle = (k * 137.5 * Math.PI) / 180 + t.dir;
        const branchLen = (t.isOuter ? 1.4 : 0.85) + (k % 3) * 0.45;
        const bx = pt.x + Math.cos(angle) * branchLen;
        const bz = pt.z + Math.sin(angle) * branchLen;
        const by = pt.y + ((k % 2) - 0.35) * 0.22;

        const branchCurve = new THREE.CatmullRomCurve3([
          pt,
          new THREE.Vector3((pt.x + bx) / 2, (pt.y + by) / 2 + 0.10, (pt.z + bz) / 2),
          new THREE.Vector3(bx, by, bz),
        ]);
        trunkGeos.push(new THREE.TubeGeometry(branchCurve, t.isOuter ? 3 : 5, trunkRadius * 0.35, 4, false));

        const nNeedleClusters = t.isOuter ? 3 : 4;
        for (let c = 0; c < nNeedleClusters; c++) {
          const offX = (Math.random() - 0.5) * 0.65;
          const offY = (Math.random() - 0.5) * 0.25;
          const offZ = (Math.random() - 0.5) * 0.65;
          const sc = (0.85 + Math.random() * 0.45) * Math.max(0.9, t.h / 6.5);
          const m = new THREE.Matrix4()
            .makeRotationFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, Math.random() * TAU, (Math.random() - 0.5) * 0.4))
            .scale(new THREE.Vector3(sc, sc, sc))
            .setPosition(bx + offX, by + offY, bz + offZ);
          pineMatrices.push(m);
        }
      }
      // 树顶苍翠封顶
      for (let topK = 0; topK < (t.isOuter ? 4 : 6); topK++) {
        const topSc = (0.95 + Math.random() * 0.4) * Math.max(0.9, t.h / 6.5);
        const m = new THREE.Matrix4()
          .makeRotationFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.3, Math.random() * TAU, (Math.random() - 0.5) * 0.3))
          .scale(new THREE.Vector3(topSc, topSc, topSc))
          .setPosition(crownTop.x + (Math.random() - 0.5) * 0.8, crownTop.y + (Math.random() - 0.2) * 0.4, crownTop.z + (Math.random() - 0.5) * 0.8);
        pineMatrices.push(m);
      }
      return;
    }

    // 3. 阔叶树种 (红枫、青枫、香樟)：优雅横斜大枝 + 丰富羽状掌叶簇
    const isRedMaple = t.type === 'mapleRed';
    const isHeroRed = isRedMaple && t.x === -6.0 && t.z === -6.0;
    const nMainBranches = isHeroRed ? 8 : (t.isOuter ? 4 : (isRedMaple ? 6 : 5));
    const crownTop = curve.getPoint(1.0);
    const crownRadius = isHeroRed ? 3.4 : Math.max(1.5, t.h * (isRedMaple ? 0.32 : 0.32));

    for (let b = 0; b < nMainBranches; b++) {
      const bFrac = isHeroRed ? (0.30 + b * 0.08) : (0.42 + b * 0.12);
      const bPt = curve.getPoint(bFrac);
      const bAng = (b / nMainBranches) * TAU + t.dir;
      const bReach = crownRadius * (t.isOuter ? 1.05 : (0.8 + Math.random() * 0.35));
      const bEnd = new THREE.Vector3(
        bPt.x + Math.cos(bAng) * bReach,
        bPt.y + (Math.random() * 0.32 + 0.12) * crownRadius,
        bPt.z + Math.sin(bAng) * bReach
      );
      const bCurve = new THREE.CatmullRomCurve3([
        bPt,
        new THREE.Vector3((bPt.x + bEnd.x) / 2, (bPt.y + bEnd.y) / 2 + 0.12, (bPt.z + bEnd.z) / 2),
        bEnd,
      ]);
      trunkGeos.push(new THREE.TubeGeometry(bCurve, t.isOuter ? 3 : 5, trunkRadius * 0.32, 4, false));

      // 每根主枝散布交叠叶簇
      const nLeafClusters = isHeroRed ? 14 : (t.isOuter ? 4 : (isRedMaple ? 7 : 6));
      for (let lc = 0; lc < nLeafClusters; lc++) {
        const cFrac = 0.22 + (lc / nLeafClusters) * 0.78;
        const cp = bCurve.getPoint(cFrac);
        const sc = (t.isOuter ? 1.15 : (0.82 + Math.random() * 0.38)) * (crownRadius * 0.54);
        const m = new THREE.Matrix4()
          .makeRotationFromEuler(new THREE.Euler(Math.random() * 0.5, Math.random() * TAU, (Math.random() - 0.5) * 0.5))
          .scale(new THREE.Vector3(sc, sc, sc))
          .setPosition(
            cp.x + (Math.random() - 0.5) * 0.55,
            cp.y + (Math.random() - 0.4) * 0.40,
            cp.z + (Math.random() - 0.5) * 0.55
          );

        if (isRedMaple) mapleMatrices.push(m);
        else greenMapleMatrices.push(m);
      }
    }

    // 树冠顶部轻柔羽状封顶
    const nTop = isHeroRed ? 12 : (t.isOuter ? 4 : 6);
    for (let tk = 0; tk < nTop; tk++) {
      const sc = (t.isOuter ? 1.10 : (0.8 + Math.random() * 0.3)) * (crownRadius * 0.50);
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

  // 合并树干网格
  if (trunkGeos.length > 0) {
    const mergedTrunk = mergeGeometries(trunkGeos, false);
    const trunkMesh = new THREE.Mesh(mergedTrunk, trunkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeRoot.add(trunkMesh);
  }

  // 1. 松针实例合批 (真实松针贴图 + Alpha 测试)
  if (pineMatrices.length > 0) {
    const pineInst = new THREE.InstancedMesh(pineClusterGeo, pineNeedleMat, pineMatrices.length);
    pineInst.castShadow = true;
    pineInst.receiveShadow = true;
    pineMatrices.forEach((m, idx) => pineInst.setMatrixAt(idx, m));
    pineInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(pineInst);
  }

  // 2. 霜叶红枫实例合批 (掌叶贴图 + Alpha 测试)
  if (mapleMatrices.length > 0) {
    const mapleInst = new THREE.InstancedMesh(mapleClusterGeo, mapleMat, mapleMatrices.length);
    mapleInst.castShadow = true;
    mapleInst.receiveShadow = true;
    mapleMatrices.forEach((m, idx) => mapleInst.setMatrixAt(idx, m));
    mapleInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(mapleInst);
  }

  // 3. 苍翠青枫香樟实例合批
  if (greenMapleMatrices.length > 0) {
    const greenInst = new THREE.InstancedMesh(greenClusterGeo, greenMapleMat, greenMapleMatrices.length);
    greenInst.castShadow = true;
    greenInst.receiveShadow = true;
    greenMapleMatrices.forEach((m, idx) => greenInst.setMatrixAt(idx, m));
    greenInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(greenInst);
  }

  // 4. 海棠花枝卡片实例合批
  if (blossomMatrices.length > 0) {
    const blossomInst = new THREE.InstancedMesh(blossomCardGeo, blossomSprayMat, blossomMatrices.length);
    blossomInst.castShadow = true;
    blossomInst.receiveShadow = true;
    blossomMatrices.forEach((m, idx) => blossomInst.setMatrixAt(idx, m));
    blossomInst.instanceMatrix.needsUpdate = true;
    treeRoot.add(blossomInst);
  }

  scene.add(treeRoot);

  return {
    group: treeRoot,
    setVisible: (visible) => {
      treeRoot.visible = visible;
    }
  };
}
