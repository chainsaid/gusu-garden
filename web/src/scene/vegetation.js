import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_Y } from './water.js';
import { L } from '../../../shared/layout.js';

const TAU = Math.PI * 2;

// 水岸边界与岛屿碰撞多边形判别，确保水生植被严格生成在真实水体内
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

// 经典江南修竹“个/介”字形披针形竹叶簇几何体 (5 片放射状竹叶)
function makeBambooLeafGeo() {
  const pos = [], nrm = [], uv = [];
  const idx = [];

  const addLeaf = (x0, y0, z0, len, wid, yaw, pitch, droop = 0.06) => {
    const base = pos.length / 3;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const fwd = new THREE.Vector3(cosY * cosP, sinP, sinY * cosP).normalize();
    const right = new THREE.Vector3(-sinY, 0, cosY).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();

    const p0 = new THREE.Vector3(x0, y0, z0);
    const p1 = p0.clone().addScaledVector(fwd, len * 0.45).addScaledVector(right, -wid * 0.5).addScaledVector(up, -droop * 0.3);
    const p2 = p0.clone().addScaledVector(fwd, len * 0.45).addScaledVector(right, wid * 0.5).addScaledVector(up, -droop * 0.3);
    const p3 = p0.clone().addScaledVector(fwd, len).addScaledVector(up, -droop);

    for (const p of [p0, p1, p2, p3]) {
      pos.push(p.x, p.y, p.z);
      nrm.push(up.x, up.y, up.z);
    }
    uv.push(0.5, 0.0, 0.0, 0.5, 1.0, 0.5, 0.5, 1.0);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };

  // "个" / "介" 字竹叶簇
  addLeaf(0, 0, 0, 0.36, 0.055, 0, 0.12, 0.05);
  addLeaf(0, 0, 0, 0.30, 0.048, -0.45, 0.08, 0.04);
  addLeaf(0, 0, 0, 0.30, 0.048, 0.45, 0.08, 0.04);
  addLeaf(0, 0, 0, 0.25, 0.042, -0.85, 0.02, 0.03);
  addLeaf(0, 0, 0, 0.25, 0.042, 0.85, 0.02, 0.03);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 真实自然三维微凹浅碟形挺水立叶 (Nelumbo emergent peltate leaf with wavy margin & radiating veins)
function makeEmergentPadGeo() {
  const segs = 48;
  const rings = 10;
  const r = 0.48; // 展开直径约 1 米
  const pos = [], uv = [], idx = [];
  pos.push(0, 0.015, 0); // 中心柄脐微凹基准
  uv.push(0.5, 0.5);

  for (let k = 1; k <= rings; k++) {
    const rr = k / rings;
    const rad = rr * r;
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * TAU;
      // 微凹浅碟身 + 辐射叶脉微棱 + 边缘自然起伏褶皱
      const cup = 0.032 * (0.35 * rr + 0.65 * rr * rr);
      const wave = Math.pow(rr, 2.5) * (Math.sin(6 * th) * 0.015 + Math.sin(12 * th) * 0.006);
      const veins = 0.0028 * rr * (0.5 - 0.5 * Math.cos(22 * th)) * Math.min(1.0, rr * 3.0);
      const y = Math.max(0.005, 0.012 + cup + wave + veins);

      pos.push(rad * Math.cos(th), y, rad * Math.sin(th));
      uv.push(0.5 + 0.5 * rr * Math.cos(th), 0.5 + 0.5 * rr * Math.sin(th));
    }
  }

  const row = segs + 1;
  for (let j = 0; j < segs; j++) idx.push(0, 1 + j + 1, 1 + j);
  for (let k = 1; k < rings; k++) {
    const a0 = 1 + (k - 1) * row, a1 = 1 + k * row;
    for (let j = 0; j < segs; j++) {
      const a = a0 + j, b = a0 + j + 1, c = a1 + j, d = a1 + j + 1;
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

// 贴水平铺圆盘浮叶 (Nelumbo floating pad，微卷边缘，绝对水平贴浮于水面)
function makeFloatingPadGeo() {
  const segs = 36;
  const rings = 6;
  const r = 0.38;
  const pos = [], uv = [], idx = [];
  pos.push(0, 0.003, 0);
  uv.push(0.5, 0.5);

  for (let k = 1; k <= rings; k++) {
    const rr = k / rings;
    const rad = rr * r;
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * TAU;
      // 边缘微卷起防止切片穿模
      const lip = 0.006 * Math.pow(rr, 3.0) * (0.7 + 0.3 * Math.sin(4 * th));
      const y = 0.002 + lip;

      pos.push(rad * Math.cos(th), y, rad * Math.sin(th));
      uv.push(0.5 + 0.5 * rr * Math.cos(th), 0.5 + 0.5 * rr * Math.sin(th));
    }
  }

  const row = segs + 1;
  for (let j = 0; j < segs; j++) idx.push(0, 1 + j + 1, 1 + j);
  for (let k = 1; k < rings; k++) {
    const a0 = 1 + (k - 1) * row, a1 = 1 + k * row;
    for (let j = 0; j < segs; j++) {
      const a = a0 + j, b = a0 + j + 1, c = a1 + j, d = a1 + j + 1;
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

export function createJiangnanFoliage(scene) {
  const foliageGroup = new THREE.Group();
  foliageGroup.name = 'jiangnan_foliage';

  // 1. GPU 实例合批：挺水立叶 (Emergent Pads) + 贴水浮叶 (Floating Pads) + 挺水荷茎 (Stems)
  const emergentGeo = makeEmergentPadGeo();
  const floatingGeo = makeFloatingPadGeo();

  const emergentMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.54, // 荷叶天然微蜡质粉霜漫反射
    metalness: 0.01,
    side: THREE.DoubleSide,
  });

  const floatingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42, // 水平浮叶受水浸润微润光泽
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const stemGeom = new THREE.CylinderGeometry(0.007, 0.011, 1.0, 5);
  stemGeom.translate(0, -0.50, 0); // 锚点定在茎顶端
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x243e22,
    roughness: 0.65,
    metalness: 0.02,
  });

  const MAX_EMERGENT = 1200;
  const MAX_FLOATING = 1000;
  const emergentInst = new THREE.InstancedMesh(emergentGeo, emergentMat, MAX_EMERGENT);
  const floatingInst = new THREE.InstancedMesh(floatingGeo, floatingMat, MAX_FLOATING);
  const stemInst = new THREE.InstancedMesh(stemGeom, stemMat, MAX_EMERGENT);

  emergentInst.castShadow = true;
  emergentInst.receiveShadow = true;
  floatingInst.receiveShadow = true;
  stemInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const stemDummy = new THREE.Object3D();

  // 严格从 shared/layout.js 统一读取 17 处标准荷花群落生态区 (与 src/ 离线电影系统保持同源同构)
  const colonies = L.pond.colonies || [];
  let eIdx = 0;
  let fIdx = 0;

  colonies.forEach((c) => {
    const area = Math.PI * c.rx * c.rz * (c.d || 1.0);
    const nEmergent = Math.max(22, Math.round(area * 3.4));
    const nFloating = Math.max(16, Math.round(area * 2.5));

    // A. 生成挺水立叶 (Emergent Leaves)
    for (let i = 0; i < nEmergent && eIdx < MAX_EMERGENT; i++) {
      const ang = Math.random() * TAU;
      const dist = Math.sqrt(Math.random()) * 0.96;
      const x = c.x + Math.cos(ang) * c.rx * dist;
      const z = c.z + Math.sin(ang) * c.rz * dist;

      if (!isPondWater(x, z)) continue;

      const tilt = 0.06 + Math.random() * 0.22;
      const s = 0.90 + Math.random() * 0.38;
      const rLeaf = 0.48 * s;
      // 关键物理抬升：倾斜引起的最大向下下垂量为 rLeaf * sin(tilt)，必须额外抬升确保最低点高出水面至少 3cm，杜绝水面切片
      const minClearance = rLeaf * Math.sin(tilt) + 0.03;
      const hAbove = 0.12 + Math.random() * 0.52; // 挺水高度 12cm ~ 64cm
      const y = WATER_Y + minClearance + hAbove;

      dummy.position.set(x, y, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * tilt,
        Math.random() * TAU,
        (Math.random() - 0.5) * tilt
      );
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      emergentInst.setMatrixAt(eIdx, dummy.matrix);

      // 经典江南青碧翠荷色相 (~124°，健康生机勃勃翠绿，适度明度对比)
      const col = new THREE.Color().setHSL(
        0.33 + (Math.random() - 0.5) * 0.035,
        0.56 + (Math.random() - 0.5) * 0.10,
        0.30 + Math.random() * 0.08
      );
      emergentInst.setColorAt(eIdx, col);

      // 对应挺水细茎 (自叶脐直扎入水下 15cm)
      const stemLen = y - (WATER_Y - 0.15);
      stemDummy.position.set(x, y, z);
      stemDummy.rotation.set((Math.random() - 0.5) * 0.05, Math.random() * TAU, (Math.random() - 0.5) * 0.05);
      stemDummy.scale.set(1, stemLen, 1);
      stemDummy.updateMatrix();
      stemInst.setMatrixAt(eIdx, stemDummy.matrix);

      eIdx++;
    }

    // B. 生成贴水平铺浮叶 (Floating Leaves)
    for (let i = 0; i < nFloating && fIdx < MAX_FLOATING; i++) {
      const ang = Math.random() * TAU;
      const dist = Math.sqrt(Math.random()) * 1.05;
      const x = c.x + Math.cos(ang) * c.rx * dist;
      const z = c.z + Math.sin(ang) * c.rz * dist;

      if (!isPondWater(x, z)) continue;

      const s = 0.82 + Math.random() * 0.35;
      const y = WATER_Y + 0.005 + Math.random() * 0.004;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.random() * TAU, 0); // 严格水平，杜绝切入水下
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      floatingInst.setMatrixAt(fIdx, dummy.matrix);

      const fCol = new THREE.Color().setHSL(
        0.33 + (Math.random() - 0.5) * 0.03,
        0.58 + (Math.random() - 0.5) * 0.08,
        0.24 + Math.random() * 0.05
      );
      floatingInst.setColorAt(fIdx, fCol);

      fIdx++;
    }
  });

  // 睡莲小叶补足
  const lilyPatches = L.pond.lilyPatches || [];
  lilyPatches.forEach((c) => {
    const area = Math.PI * c.rx * c.rz * (c.d || 1.0);
    const nLilies = Math.max(14, Math.round(area * 2.2));
    for (let i = 0; i < nLilies && fIdx < MAX_FLOATING; i++) {
      const ang = Math.random() * TAU;
      const dist = Math.sqrt(Math.random());
      const x = c.x + Math.cos(ang) * c.rx * dist;
      const z = c.z + Math.sin(ang) * c.rz * dist;

      if (!isPondWater(x, z)) continue;

      const s = 0.60 + Math.random() * 0.28;
      const y = WATER_Y + 0.005 + Math.random() * 0.003;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.random() * TAU, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      floatingInst.setMatrixAt(fIdx, dummy.matrix);
      const fCol = new THREE.Color().setHSL(0.33, 0.60, 0.22);
      floatingInst.setColorAt(fIdx, fCol);
      fIdx++;
    }
  });

  emergentInst.count = eIdx;
  floatingInst.count = fIdx;
  stemInst.count = eIdx;

  emergentInst.instanceMatrix.needsUpdate = true;
  if (emergentInst.instanceColor) emergentInst.instanceColor.needsUpdate = true;
  floatingInst.instanceMatrix.needsUpdate = true;
  if (floatingInst.instanceColor) floatingInst.instanceColor.needsUpdate = true;
  stemInst.instanceMatrix.needsUpdate = true;

  foliageGroup.add(emergentInst);
  foliageGroup.add(floatingInst);
  foliageGroup.add(stemInst);

  // 2. GPU 实例合批：白粉墙下修竹丛 (Bamboos) + 竹叶披针花叶
  const culmGeom = new THREE.CylinderGeometry(0.038, 0.052, 6.0, 5);
  culmGeom.translate(0, 3.0, 0);

  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0x2b4224,
    roughness: 0.68,
    metalness: 0.02,
  });

  const leafGeom = makeBambooLeafGeo();
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x529438, // 苍翠透光竹青
    roughness: 0.45,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 竹竿与竹叶 GPU 微风顶点摆动
  const setupSwayShader = (mat) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      mat.userData.shader = shader;
      shader.vertexShader = `
        uniform float uTime;
        ${shader.vertexShader}
      `;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `
          #include <begin_vertex>
          float hFrac = clamp(transformed.y / 6.0, 0.0, 1.0);
          float sway = sin(uTime * 1.5 + position.x * 0.8 + position.z * 0.5) * hFrac * hFrac * 0.16;
          transformed.x += sway;
          transformed.z += sway * 0.5;
        `
      );
    };
  };

  setupSwayShader(bambooMat);
  setupSwayShader(leafMat);

  const BAMBOO_COUNT = 160;
  const bambooInst = new THREE.InstancedMesh(culmGeom, bambooMat, BAMBOO_COUNT);
  bambooInst.castShadow = true;
  bambooInst.receiveShadow = true;

  const LEAF_CLUSTERS_PER_STEM = 8;
  const totalLeafClusters = BAMBOO_COUNT * LEAF_CLUSTERS_PER_STEM;
  const leafInst = new THREE.InstancedMesh(leafGeom, leafMat, totalLeafClusters);
  leafInst.castShadow = true;
  leafInst.receiveShadow = true;

  // 沿外围粉墙、漏窗后与院落角落散布 (严格对齐母本 src/world/vegetation-bamboo.js 规范，坚决不堵塞石桥借景北寺塔通道)
  const bambooSpots = [
    // 北廊漏窗外修竹景致
    { x0: 10, z0: -48.5, len: 4.5, dx: 1, dz: 0, n: 28 },
    { x0: -18, z0: -48.5, len: 3.5, dx: 1, dz: 0, n: 20 },
    { x0: 38, z0: -48.5, len: 4.0, dx: 1, dz: 0, n: 24 },
    // 西侧回廊粉墙外修竹
    { x0: -52.5, z0: -15, len: 3.8, dx: 0, dz: 1, n: 22 },
    { x0: -52.5, z0: 12, len: 4.0, dx: 0, dz: 1, n: 24 },
    // 东侧水榭转角后
    { x0: 55, z0: 22, len: 3.2, dx: 1, dz: 0, n: 16 },
    { x0: 64, z0: 8, len: 3.5, dx: 0, dz: 1, n: 16 },
    // 水榭主殿东西次院幽僻角落
    { x0: -14, z0: -16, len: 2.2, dx: 1, dz: 0, n: 10 },
    { x0: 34, z0: -16, len: 2.2, dx: 1, dz: 0, n: 10 },
  ];

  let bIdx = 0;
  let lIdx = 0;

  bambooSpots.forEach((sp) => {
    for (let i = 0; i < sp.n && bIdx < BAMBOO_COUNT; i++) {
      const t = Math.random();
      const x = sp.x0 + sp.dx * sp.len * t + (Math.random() - 0.5) * 0.8;
      const z = sp.z0 + sp.dz * sp.len * t + (Math.random() - 0.5) * 0.8;
      const hScale = 0.75 + Math.random() * 0.5;
      const caneH = 6.0 * hScale;

      dummy.position.set(x, 0.2, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.06, Math.random() * Math.PI, (Math.random() - 0.5) * 0.06);
      dummy.scale.set(1, hScale, 1);
      dummy.updateMatrix();

      bambooInst.setMatrixAt(bIdx, dummy.matrix);
      bIdx++;

      // 为每根竹竿布置 8 组向上散开的竹叶披针簇
      for (let k = 0; k < LEAF_CLUSTERS_PER_STEM; k++) {
        const hFrac = 0.45 + (k / LEAF_CLUSTERS_PER_STEM) * 0.52;
        const ly = 0.2 + caneH * hFrac;
        const yaw = (k * 2.39996) + (Math.random() - 0.5) * 0.5;
        const distOut = 0.12 + Math.random() * 0.22;
        const lx = x + Math.cos(yaw) * distOut;
        const lz = z + Math.sin(yaw) * distOut;
        const lScale = 0.85 + Math.random() * 0.45;

        dummy.position.set(lx, ly, lz);
        dummy.rotation.set((Math.random() - 0.5) * 0.2, yaw, (Math.random() - 0.5) * 0.2);
        dummy.scale.set(lScale, lScale, lScale);
        dummy.updateMatrix();

        leafInst.setMatrixAt(lIdx, dummy.matrix);
        lIdx++;
      }
    }
  });

  bambooInst.instanceMatrix.needsUpdate = true;
  leafInst.instanceMatrix.needsUpdate = true;
  foliageGroup.add(bambooInst);
  foliageGroup.add(leafInst);

  // 3. GPU 实例合批：石隙剪形黄杨灌木 (Boxwood Shrubs) 与阴生凤尾蕨 (Ferns)
  // (与母本 src/world/vegetation.js 对齐，消除粉墙脚与驳岸石头根部生硬缝隙)
  const shrubGeo = new THREE.SphereGeometry(0.75, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
  shrubGeo.scale(1.0, 0.65, 1.0);
  const shrubMat = new THREE.MeshStandardMaterial({
    color: 0x3d5a22, // 剪形黄杨温润深绿
    roughness: 0.62,
    metalness: 0.02,
  });

  const fernFrondGeo = new THREE.PlaneGeometry(0.24, 0.95);
  fernFrondGeo.translate(0, 0.45, 0);
  fernFrondGeo.rotateX(0.45);
  const fernFronds = [];
  for (let k = 0; k < 5; k++) {
    const fg = fernFrondGeo.clone();
    fg.rotateY((k / 5) * Math.PI * 2);
    fernFronds.push(fg);
  }
  const fernGeo = mergeGeometries(fernFronds, false);
  const fernMat = new THREE.MeshStandardMaterial({
    color: 0x487a2a, // 阴生石缝青翠凤尾草
    roughness: 0.52,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });

  const shrubSpots = [
    // 桥头两侧护坡石隙
    { x: 8.2, z: 5.6 }, { x: 11.8, z: 5.6 }, { x: 8.2, z: 26.4 }, { x: 11.8, z: 26.4 },
    { x: 7.2, z: 7.2 }, { x: 12.8, z: 7.2 }, { x: 7.2, z: 24.8 }, { x: 12.8, z: 24.8 },
    // 水榭远香堂月台基座与踏步两翼
    { x: 14.5, z: -6.2 }, { x: 16.2, z: -6.2 }, { x: 23.8, z: -6.2 }, { x: 25.5, z: -6.2 },
    { x: 12.8, z: -3.8 }, { x: 27.2, z: -3.8 }, { x: 13.5, z: 0.5 }, { x: 26.5, z: 0.5 },
    // 冠云峰与立峰周边伴生
    { x: 21.2, z: -4.2 }, { x: 22.8, z: -2.8 }, { x: 33.8, z: 7.8 }, { x: 35.2, z: 9.2 },
    { x: 41.2, z: 3.8 }, { x: 42.8, z: 5.2 },
    // 西侧回廊白粉墙脚与漏窗下
    { x: -47.0, z: -32 }, { x: -47.0, z: -16 }, { x: -47.0, z: 0 }, { x: -47.0, z: 16 }, { x: -47.0, z: 32 },
    // 东侧回廊白粉墙脚
    { x: 61.0, z: -32 }, { x: 61.0, z: -16 }, { x: 61.0, z: 0 }, { x: 61.0, z: 16 }, { x: 61.0, z: 32 },
    // 北廊漏窗下
    { x: -10, z: -47.8 }, { x: 10, z: -47.8 }, { x: 30, z: -47.8 },
    // 南门草坪与汀步周边
    { x: -13.5, z: -5.0 }, { x: -16.0, z: -8.0 }, { x: -11.0, z: 2.5 },
  ];

  const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubSpots.length);
  const fernInst = new THREE.InstancedMesh(fernGeo, fernMat, shrubSpots.length);
  shrubInst.castShadow = true;
  shrubInst.receiveShadow = true;
  fernInst.castShadow = true;
  fernInst.receiveShadow = true;

  shrubSpots.forEach((sp, idx) => {
    const sScale = 0.75 + Math.random() * 0.45;
    dummy.position.set(sp.x + (Math.random() - 0.5) * 0.4, 0.05, sp.z + (Math.random() - 0.5) * 0.4);
    dummy.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * TAU, (Math.random() - 0.5) * 0.1);
    dummy.scale.set(sScale, sScale, sScale);
    dummy.updateMatrix();
    shrubInst.setMatrixAt(idx, dummy.matrix);

    const fScale = 0.65 + Math.random() * 0.35;
    dummy.position.set(sp.x + (Math.random() - 0.5) * 0.6, 0.05, sp.z + (Math.random() - 0.5) * 0.6);
    dummy.rotation.set(0, Math.random() * TAU, 0);
    dummy.scale.set(fScale, fScale, fScale);
    dummy.updateMatrix();
    fernInst.setMatrixAt(idx, dummy.matrix);
  });

  shrubInst.instanceMatrix.needsUpdate = true;
  fernInst.instanceMatrix.needsUpdate = true;
  foliageGroup.add(shrubInst);
  foliageGroup.add(fernInst);

  scene.add(foliageGroup);

  return {
    group: foliageGroup,
    emergentLotus: emergentInst,
    floatingLotus: floatingInst,
    bamboo: bambooInst,
    leaves: leafInst,
    setLotusVisible: (visible) => {
      emergentInst.visible = visible;
      floatingInst.visible = visible;
      stemInst.visible = visible;
    },
    setBambooVisible: (visible) => {
      bambooInst.visible = visible;
      leafInst.visible = visible;
    },
    update: (time) => {
      if (bambooMat.userData.shader) {
        bambooMat.userData.shader.uniforms.uTime.value = time;
      }
      if (leafMat.userData.shader) {
        leafMat.userData.shader.uniforms.uTime.value = time;
      }
    }
  };
}
