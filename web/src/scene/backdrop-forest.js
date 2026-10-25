// ---------------------------------------------------------------------------
// backdrop-forest.js — 园外环抱郁葱林海系统 (Backdrop Forest & 借景林冠)
// 依据古典造园“一墙之外，郁郁葱葱”原则：
// 1. 北寺塔周边与北廊后方古木参天，使高塔破林而立；
// 2. 围墙外环抱樟枫橡栗苍翠树冠，绿荫自然漫过粉墙黛瓦；
// 3. 采用柔和有机曲面树冠几何体 + 真实树林比例尺度 + InstancedMesh 高性能合批。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

// 构造具有自然蓬松起伏感的有机阔叶树冠复合几何体
function createOrganicCrownGeometry() {
  const parts = [];
  const addPuff = (radius, px, py, pz, sy = 1.0) => {
    const geo = new THREE.IcosahedronGeometry(radius, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.hypot(x, y, z);
      // 多频微扰动，形成蓬松树叶团簇起伏
      const disp = 1.0 + Math.sin(x * 4.2 + y * 3.5) * Math.cos(z * 4.0) * 0.12;
      pos.setXYZ(i, (x / len) * disp, (y / len) * disp * sy, (z / len) * disp);
    }
    geo.translate(px, py, pz);
    parts.push(geo);
  };

  // 1. 主树冠中央团簇
  addPuff(1.0, 0, 0, 0, 0.92);
  // 2. 周围错落云团 (形成真实樟树伞状平展冠面)
  addPuff(0.72, -0.55, -0.10, 0.22, 0.88);
  addPuff(0.75, 0.58, -0.12, -0.18, 0.90);
  addPuff(0.68, 0.12, -0.08, 0.52, 0.85);
  addPuff(0.65, -0.18, -0.14, -0.50, 0.84);
  // 3. 顶端微隆嫩梢
  addPuff(0.58, 0.04, 0.38, -0.04, 0.98);

  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  return merged;
}

// 构造自然微弯树干几何体
function createTrunkGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.08, 2.0, -0.05),
    new THREE.Vector3(-0.04, 4.0, 0.06),
    new THREE.Vector3(0.02, 6.0, 0.02)
  ]);
  const geo = new THREE.TubeGeometry(curve, 6, 0.28, 6, false);
  return geo;
}

export function createBackdropForest() {
  const root = new THREE.Group();
  root.name = 'gusu_backdrop_forest';

  // 苍翠深林树冠 PBR 材质 (青翠深沉，光滑法线渲染，夕阳下微泛暖金)
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0x223c21,     // 苍翠古木墨绿
    roughness: 0.86,
    metalness: 0.02,
    flatShading: false,  // 平滑法线，呈现柔和连绵的林冠层次
  });

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x2c221a,
    roughness: 0.94,
    metalness: 0.01,
  });

  const crownGeo = createOrganicCrownGeometry();
  const trunkGeo = createTrunkGeometry();

  // 采样林冠坐标点 (尺度适中，树冠 2.8~4.2m，紧贴白粉墙外与北寺塔周边)
  const treeTransforms = [];

  // A. 北寺塔借景周边核心林海 (center: [-105, 0, -48]，簇拥塔基，高 14~20m)
  const nPagodaTrees = 80;
  for (let i = 0; i < nPagodaTrees; i++) {
    const ang = Math.random() * TAU;
    const r = 18 + Math.random() * 55;
    const x = -105 + Math.cos(ang) * r;
    const z = -48 + Math.sin(ang) * r;
    if (Math.hypot(x - (-105), z - (-48)) < 15) continue;
    const totalH = 13 + Math.random() * 7;
    const crownScale = 3.6 + Math.random() * 1.6;
    treeTransforms.push({ x, z, totalH, crownScale });
  }

  // B. 北墙白粉墙外借景林带 (沿 z = -48 往北延展至 z = -85，x 从 -55 到 65)
  // 树高 8.5~12.5m，恰好漫过 5m 高白粉墙 3.5~7.5m，形成连续绿屏
  const nNorthTrees = 110;
  for (let i = 0; i < nNorthTrees; i++) {
    const x = -55 + Math.random() * 120;
    const z = -50 - Math.random() * 32;
    const totalH = 8.5 + Math.random() * 4.0;
    const crownScale = 3.0 + Math.random() * 1.2;
    treeTransforms.push({ x, z, totalH, crownScale });
  }

  // C. 西侧围墙外山林绿障 (x 从 -52 到 -90，z 从 -35 到 45)
  const nWestTrees = 70;
  for (let i = 0; i < nWestTrees; i++) {
    const x = -53 - Math.random() * 35;
    const z = -35 + Math.random() * 78;
    if (Math.hypot(x - (-105), z - (-48)) < 30) continue;
    const totalH = 8.0 + Math.random() * 4.5;
    const crownScale = 3.0 + Math.random() * 1.3;
    treeTransforms.push({ x, z, totalH, crownScale });
  }

  // D. 东侧围墙外林带 (x 从 66 到 95，z 从 -45 到 45)
  const nEastTrees = 50;
  for (let i = 0; i < nEastTrees; i++) {
    const x = 67 + Math.random() * 26;
    const z = -42 + Math.random() * 84;
    const totalH = 8.0 + Math.random() * 4.0;
    const crownScale = 2.8 + Math.random() * 1.2;
    treeTransforms.push({ x, z, totalH, crownScale });
  }

  const totalTrees = treeTransforms.length;
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTrees);
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, totalTrees);

  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;
  crownInst.castShadow = true;
  crownInst.receiveShadow = true;

  const dummy = new THREE.Object3D();

  for (let i = 0; i < totalTrees; i++) {
    const t = treeTransforms[i];
    const trunkH = t.totalH * 0.40;

    // 1. 设置树干矩阵
    dummy.position.set(t.x, 0, t.z);
    dummy.rotation.set((Math.random() - 0.5) * 0.05, Math.random() * TAU, (Math.random() - 0.5) * 0.05);
    dummy.scale.set(1.0, trunkH / 6.0, 1.0);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    // 2. 设置蓬松树冠矩阵
    const crownY = trunkH + t.crownScale * 0.45;
    dummy.position.set(t.x, crownY, t.z);
    dummy.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * TAU, (Math.random() - 0.5) * 0.12);
    dummy.scale.set(t.crownScale, t.crownScale * 0.95, t.crownScale);
    dummy.updateMatrix();
    crownInst.setMatrixAt(i, dummy.matrix);
  }

  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;

  root.add(trunkInst);
  root.add(crownInst);

  return root;
}

