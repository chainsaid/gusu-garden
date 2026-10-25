// ---------------------------------------------------------------------------
// lotus-flowers.js — 荷塘盛开水芝荷花系统 (Nelumbo Nucifera)
// 经典江南重瓣荷花：舟形内卷白里透红花瓣、中央嫩黄莲蓬与金黄雄蕊，自然掩映于千顷碧波荷叶间。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_Y } from './water.js';
import { L } from '../../../shared/layout.js';

const TAU = Math.PI * 2;

// 水岸边界与岛屿碰撞多边形判别，确保荷花严格生长在真实水域内部
function pointInPoly(x, z, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    const intersect = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPondWater(x, z) {
  if (!L.pond || !L.pond.outline) return true;
  if (!pointInPoly(x, z, L.pond.outline)) return false;
  if (L.pond.island && pointInPoly(x, z, L.pond.island)) return false;
  // 严格避开小飞虹拱桥桥身走道与桥台
  if (Math.abs(x - 10.0) < 1.95 && z > 4.5 && z < 27.5) return false;
  return true;
}

// 构建真实植物学尺度单片三维舟形荷花花瓣 (长约 16 cm，宽约 7.8 cm，中肋内卷勺状尖梢)
function makeLotusPetalGeo() {
  const PW = [
    [0.00, 0.16], [0.06, 0.35], [0.16, 0.60], [0.30, 0.85],
    [0.45, 0.98], [0.58, 1.00], [0.70, 0.95], [0.80, 0.82],
    [0.88, 0.62], [0.94, 0.38], [0.98, 0.16], [1.00, 0.00]
  ];
  function getWidth(u) {
    for (let k = 1; k < PW.length; k++) {
      if (u <= PW[k][0]) {
        const a = PW[k - 1], b = PW[k];
        const t = (u - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return 0;
  }

  const nu = 14, nv = 8;
  const L = 0.165, W = 0.082;
  const pos = [], uv = [], idx = [];

  // 沿中肋积分中线弯曲与内卷抱心勺状尖梢
  const midPoints = [];
  let curY = 0, curZ = 0;
  const bend = 0.36, hood = 0.44;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const th = bend * Math.pow(u, 1.3) + hood * Math.pow(Math.max(0, (u - 0.60) / 0.40), 1.6);
    midPoints.push({ y: curY, z: curZ, th });
    curY += Math.cos(th) * (L / nu);
    curZ += Math.sin(th) * (L / nu);
  }

  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const mp = midPoints[i];
    const w = W * getWidth(u);
    const cosTh = Math.cos(mp.th), sinTh = Math.sin(mp.th);

    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1; // -1 .. 1
      const x = v * w * 0.5;
      const av = Math.abs(v);

      // 抱水凹陷与外拱脊线
      let zLocal = 0.68 * av * av * (w * 0.5);
      zLocal += 0.0022 * Math.sin(u * 14.0) * av * av; // 边缘轻微波折
      zLocal -= 0.0032 * Math.exp(-v * v * 20.0) * Math.sin(u * Math.PI); // 外侧背脊凸起

      // 转换至花瓣空间 (x 横向, y 纵向展向, z 弯曲向内)
      const y = mp.y - sinTh * zLocal;
      const z = mp.z + cosTh * zLocal;

      pos.push(x, y, z);
      uv.push(v * 0.5 + 0.5, u);
    }
  }

  const row = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = (i + 1) * row + j;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 绘制程序化荷花花瓣白玉透粉至瓣尖绯红渐变贴图 (含平行细致叶脉)
function createLotusPetalTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  // 柔美花瓣基底：自基部温润羊脂玉白，向上晕染至柔嫩桃粉，瓣尖经典胭脂红
  const grad = ctx.createLinearGradient(0, S, 0, 0);
  grad.addColorStop(0.0, '#fffef2'); // 象牙羊脂玉白
  grad.addColorStop(0.20, '#faedf0'); // 清透初粉
  grad.addColorStop(0.55, '#f48fb1'); // 娇嫩水粉
  grad.addColorStop(0.82, '#e91e63'); // 瓣尖鲜明洋红
  grad.addColorStop(1.0, '#ba1244'); // 尖端深沉胭脂

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // 极细腻平行的纵向花瓣微脉
  ctx.strokeStyle = 'rgba(215, 65, 105, 0.15)';
  ctx.lineWidth = 1.2;
  const nVeins = 36;
  for (let i = 0; i < nVeins; i++) {
    const u = (i / (nVeins - 1)) * 2 - 1; // -1 .. 1
    const x0 = S * (0.5 + u * 0.42);
    const xMid = S * (0.5 + u * 0.48);
    const xTip = S * (0.5 + u * 0.08);

    ctx.beginPath();
    ctx.moveTo(x0, S);
    ctx.quadraticCurveTo(xMid, S * 0.5, xTip, 0);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 构建中央莲蓬与环形金黄花蕊复合几何体
function makeLotusCoreGeo() {
  const pod = new THREE.CylinderGeometry(0.024, 0.012, 0.034, 12);
  pod.translate(0, 0.017, 0);

  // 环状密集雄蕊金丝
  const stamenGeos = [pod];
  const nStamens = 24;
  for (let i = 0; i < nStamens; i++) {
    const ang = (i / nStamens) * TAU;
    const rad = 0.024;
    const s = new THREE.CylinderGeometry(0.0014, 0.0014, 0.018, 4);
    s.rotateX(0.28);
    s.rotateY(ang);
    s.translate(Math.cos(ang) * rad, 0.016, Math.sin(ang) * rad);
    stamenGeos.push(s);
  }

  return mergeGeometries(stamenGeos, false);
}

export function createJiangnanLotusFlowers(scene) {
  const flowerRoot = new THREE.Group();
  flowerRoot.name = 'jiangnan_lotus_flowers';

  // 1. 娇嫩粉白花瓣材质 (贴图渐变 + 透光微粉，瓣尖绯红，带次表面微弱逆光漫射)
  const petalTex = createLotusPetalTexture();
  const petalMat = new THREE.MeshStandardMaterial({
    map: petalTex,
    color: 0xffffff,
    emissive: 0x3d0818, // 模拟花瓣逆光微透光散射 (Subsurface scattering look)
    roughness: 0.38,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 2. 嫩黄莲蓬与金黄花蕊
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xf5cc36, // 娇嫩莲蓬初黄微带蜜金
    roughness: 0.52,
    metalness: 0.06,
  });
  const coreGeo = makeLotusCoreGeo();

  // 3. 挺水花茎 (长 1.0m，向下深扎入水)
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x3d6e50,
    roughness: 0.65,
    metalness: 0.02,
  });
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.012, 1.0, 5).translate(0, -0.50, 0);

  // 对齐原版 src/ 规模：总花量提升至 320 株 (原版含花苞共 300 株)
  const FLOWER_COUNT = 320;
  const basePetalGeo = makeLotusPetalGeo();

  const PETALS_PER_FLOWER = 22; // 4 层花瓣 (7 + 6 + 5 + 4)
  const totalPetals = FLOWER_COUNT * PETALS_PER_FLOWER;
  const petalInst = new THREE.InstancedMesh(basePetalGeo, petalMat, totalPetals);
  const coreInst = new THREE.InstancedMesh(coreGeo, coreMat, FLOWER_COUNT);
  const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, FLOWER_COUNT);

  petalInst.castShadow = true;
  petalInst.receiveShadow = true;
  coreInst.castShadow = true;
  stemInst.castShadow = true;

  const dummy = new THREE.Object3D();
  let fIdx = 0;
  let pGlobalIdx = 0;

  // 严格从 shared/layout.js 统一读取 17 处标准荷花群落生态区 (与 src/ 离线电影系统保持同源同构)
  const colonies = L.pond.colonies || [];

  colonies.forEach((c) => {
    // 按各群落面积与密度权重分配花朵数量，确保桥头与水榭台前盛开浓密
    const area = Math.PI * c.rx * c.rz * (c.d || 1.0);
    const nFlowers = Math.max(6, Math.round(area * 0.78));

    for (let i = 0; i < nFlowers && fIdx < FLOWER_COUNT; i++) {
      const ang = Math.random() * TAU;
      const dist = Math.sqrt(Math.random()) * 0.92;
      const x = c.x + Math.cos(ang) * c.rx * dist;
      const z = c.z + Math.sin(ang) * c.rz * dist;

      if (!isPondWater(x, z)) continue;

      // 关键：花朵高度必须挺立在荷叶上方 (原版 src/ 高度为 0.35 ~ 0.85m)，杜绝被叶片遮挡淹没
      const isHero = Math.abs(c.x - 14.0) < 6.0 && Math.abs(c.z - 17.0) < 6.0;
      const y = WATER_Y + (0.35 + Math.random() * 0.45);
      const s = isHero ? (1.20 + Math.random() * 0.30) : (0.95 + Math.random() * 0.35);

      // 花蕊
      dummy.position.set(x, y, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * TAU, (Math.random() - 0.5) * 0.12);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      coreInst.setMatrixAt(fIdx, dummy.matrix);

      // 茎 (向下深扎入水下 15cm，挺立水面)
      const stemLen = y - WATER_Y + 0.15;
      dummy.position.set(x, y, z);
      dummy.scale.set(1, stemLen / 1.0, 1);
      dummy.updateMatrix();
      stemInst.setMatrixAt(fIdx, dummy.matrix);

      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      const baseFlowerMatrix = dummy.matrix.clone();

      // 第一层 (外轮 7 片盛开大花瓣)
      for (let k = 0; k < 7; k++) {
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, (k / 7) * TAU + Math.random() * 0.06, 0);
        dummy.rotateX(0.52 + Math.random() * 0.08);
        dummy.scale.set(1.18, 1.18, 1.18);
        dummy.updateMatrix();
        const finalM = new THREE.Matrix4().multiplyMatrices(baseFlowerMatrix, dummy.matrix);
        petalInst.setMatrixAt(pGlobalIdx++, finalM);
      }

      // 第二层 (次外轮 6 片舒展花瓣)
      for (let k = 0; k < 6; k++) {
        dummy.position.set(0, 0.008, 0);
        dummy.rotation.set(0, (k / 6) * TAU + 0.35 + Math.random() * 0.06, 0);
        dummy.rotateX(0.36 + Math.random() * 0.07);
        dummy.scale.set(1.05, 1.05, 1.05);
        dummy.updateMatrix();
        const finalM = new THREE.Matrix4().multiplyMatrices(baseFlowerMatrix, dummy.matrix);
        petalInst.setMatrixAt(pGlobalIdx++, finalM);
      }

      // 第三层 (次内轮 5 片微拢花瓣)
      for (let k = 0; k < 5; k++) {
        dummy.position.set(0, 0.015, 0);
        dummy.rotation.set(0, (k / 5) * TAU + 0.70 + Math.random() * 0.06, 0);
        dummy.rotateX(0.22 + Math.random() * 0.06);
        dummy.scale.set(0.92, 0.92, 0.92);
        dummy.updateMatrix();
        const finalM = new THREE.Matrix4().multiplyMatrices(baseFlowerMatrix, dummy.matrix);
        petalInst.setMatrixAt(pGlobalIdx++, finalM);
      }

      // 第四层 (内轮 4 片抱心小花瓣)
      for (let k = 0; k < 4; k++) {
        dummy.position.set(0, 0.022, 0);
        dummy.rotation.set(0, (k / 4) * TAU + 1.05 + Math.random() * 0.06, 0);
        dummy.rotateX(0.10 + Math.random() * 0.05);
        dummy.scale.set(0.76, 0.76, 0.76);
        dummy.updateMatrix();
        const finalM = new THREE.Matrix4().multiplyMatrices(baseFlowerMatrix, dummy.matrix);
        petalInst.setMatrixAt(pGlobalIdx++, finalM);
      }

      fIdx++;
    }
  });

  petalInst.count = pGlobalIdx;
  coreInst.count = fIdx;
  stemInst.count = fIdx;

  petalInst.instanceMatrix.needsUpdate = true;
  coreInst.instanceMatrix.needsUpdate = true;
  stemInst.instanceMatrix.needsUpdate = true;

  flowerRoot.add(stemInst);
  flowerRoot.add(petalInst);
  flowerRoot.add(coreInst);

  scene.add(flowerRoot);

  return {
    group: flowerRoot,
    setVisible: (visible) => {
      flowerRoot.visible = visible;
    }
  };
}
