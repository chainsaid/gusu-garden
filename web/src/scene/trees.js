// ---------------------------------------------------------------------------
// trees.js — 庭院文人罗汉古松系统 (Scholar Pine / Podocarpus)
// 苍劲盘曲的深褐老干、层层水平铺展的墨绿松针云盘，矗立于太湖叠石与粉墙画意之间。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

// 构建经典文人悬崖松/迎客松云盘几何体
function createPineNeedlePadGeo() {
  const geo = new THREE.CylinderGeometry(1.2, 1.4, 0.06, 10);
  geo.scale(1.0, 1.0, 0.65); // 压成扁平椭圆松针盘
  return geo;
}

export function createJiangnanTrees(scene) {
  const treeRoot = new THREE.Group();
  treeRoot.name = 'jiangnan_scholar_pines';

  // 1. 材质定义
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3d322b,
    roughness: 0.88,
    metalness: 0.04,
  });

  const needleMat = new THREE.MeshStandardMaterial({
    color: 0x1b3b28,
    roughness: 0.72,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const padGeo = createPineNeedlePadGeo();

  // 2. 经典文人松点位与盘曲主干参数
  const treeSpots = [
    // 庭院西侧假山石畔 (斜倚水面)
    { x: -16.0, z: 2.0, h: 7.2, lean: 0.45, dir: 0.8 },
    // 庭院东侧青石台前
    { x: 23.0, z: -2.0, h: 6.8, lean: 0.35, dir: -0.6 },
    // 拱桥北岸望柱之侧
    { x: 18.0, z: 22.0, h: 6.2, lean: 0.4, dir: -1.2 },
    // 回廊西侧拐角庭心
    { x: -18.0, z: 24.0, h: 7.5, lean: 0.3, dir: 1.5 },
  ];

  // 构建盘曲树干与支干
  const trunkGeos = [];
  const padMatrices = [];

  treeSpots.forEach((t) => {
    // 弯曲树干路径 (3~4 段骨节)
    const curvePts = [
      new THREE.Vector3(t.x, 0, t.z),
      new THREE.Vector3(t.x + Math.cos(t.dir) * 0.8, t.h * 0.35, t.z + Math.sin(t.dir) * 0.8),
      new THREE.Vector3(t.x + Math.cos(t.dir) * 2.2, t.h * 0.7, t.z + Math.sin(t.dir) * 2.2),
      new THREE.Vector3(t.x + Math.cos(t.dir) * 2.8, t.h, t.z + Math.sin(t.dir) * 2.8),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const trunkTube = new THREE.TubeGeometry(curve, 16, 0.28, 7, false);
    trunkGeos.push(trunkTube);

    // 沿枝干各层布设 7~9 个错落水平松针云盘
    const nPads = 8;
    for (let k = 1; k <= nPads; k++) {
      const frac = 0.4 + (k / nPads) * 0.6;
      const pt = curve.getPoint(frac);
      const angle = (k * 137.5 * Math.PI) / 180;
      const branchLen = 0.8 + Math.random() * 0.9;
      const bx = pt.x + Math.cos(angle) * branchLen;
      const bz = pt.z + Math.sin(angle) * branchLen;
      const by = pt.y + (Math.random() - 0.5) * 0.3;
      const scale = (1.1 - frac * 0.35) * (0.85 + Math.random() * 0.4);

      // 分支细枝
      const branchCurve = new THREE.CatmullRomCurve3([
        pt,
        new THREE.Vector3((pt.x + bx) / 2, (pt.y + by) / 2 + 0.1, (pt.z + bz) / 2),
        new THREE.Vector3(bx, by, bz),
      ]);
      trunkGeos.push(new THREE.TubeGeometry(branchCurve, 8, 0.08, 5, false));

      // 松针云盘矩阵
      const m = new THREE.Matrix4()
        .makeRotationY(Math.random() * TAU)
        .scale(new THREE.Vector3(scale, 1, scale))
        .setPosition(bx, by, bz);
      padMatrices.push(m);
    }
  });

  // 合并树干
  if (trunkGeos.length > 0) {
    const mergedTrunk = mergeGeometries(trunkGeos, false);
    const trunkMesh = new THREE.Mesh(mergedTrunk, trunkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeRoot.add(trunkMesh);
  }

  // 松针实例合批
  const padInst = new THREE.InstancedMesh(padGeo, needleMat, padMatrices.length);
  padInst.castShadow = true;
  padInst.receiveShadow = true;
  padMatrices.forEach((m, idx) => padInst.setMatrixAt(idx, m));
  padInst.instanceMatrix.needsUpdate = true;
  treeRoot.add(padInst);

  scene.add(treeRoot);

  return {
    group: treeRoot,
    setVisible: (visible) => {
      treeRoot.visible = visible;
    }
  };
}
