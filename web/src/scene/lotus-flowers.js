// ---------------------------------------------------------------------------
// lotus-flowers.js — 荷塘盛开水芝荷花系统 (Nelumbo Nucifera)
// 白里透粉的尖翘多重花瓣、中央金黄莲蓬与金黄雄蕊，点缀于千顷碧波荷叶之间。
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const TAU = Math.PI * 2;

// 构建单朵重瓣盛开荷花几何体
function makeLotusFlowerGeo() {
  const petals = [];
  const petalShape = new THREE.Shape();
  // 经典单片荷花花瓣：底窄中宽尖端翘起
  petalShape.moveTo(0, 0);
  petalShape.bezierCurveTo(0.12, 0.15, 0.16, 0.45, 0.0, 0.68);
  petalShape.bezierCurveTo(-0.16, 0.45, -0.12, 0.15, 0, 0);

  const basePetalGeo = new THREE.ShapeGeometry(petalShape, 8);
  basePetalGeo.rotateX(-Math.PI / 2);

  // 弯曲花瓣尖端，形成含苞或初绽弧度
  const pos = basePetalGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = Math.max(0, pos.getZ(i));
    const arch = Math.pow(z / 0.68, 1.8) * 0.22;
    pos.setY(i, arch);
  }
  basePetalGeo.computeVertexNormals();

  const flowerGroup = new THREE.Group();

  // 外层 8 片大花瓣
  for (let i = 0; i < 8; i++) {
    const pMesh = new THREE.Mesh(basePetalGeo);
    const yaw = (i / 8) * TAU;
    pMesh.rotation.y = yaw;
    pMesh.rotateX(0.48);
    pMesh.scale.set(1.15, 1.15, 1.15);
    pMesh.updateMatrix();
    flowerGroup.add(pMesh);
  }

  // 中层 6 片立瓣
  for (let i = 0; i < 6; i++) {
    const pMesh = new THREE.Mesh(basePetalGeo);
    const yaw = (i / 6) * TAU + 0.35;
    pMesh.rotation.y = yaw;
    pMesh.rotateX(0.28);
    pMesh.scale.set(0.9, 0.9, 0.9);
    pMesh.position.y = 0.05;
    pMesh.updateMatrix();
    flowerGroup.add(pMesh);
  }

  // 内层 5 片抱心花瓣
  for (let i = 0; i < 5; i++) {
    const pMesh = new THREE.Mesh(basePetalGeo);
    const yaw = (i / 5) * TAU + 0.6;
    pMesh.rotation.y = yaw;
    pMesh.rotateX(0.12);
    pMesh.scale.set(0.65, 0.65, 0.65);
    pMesh.position.y = 0.08;
    pMesh.updateMatrix();
    flowerGroup.add(pMesh);
  }

  return { flowerGroup, basePetalGeo };
}

export function createJiangnanLotusFlowers(scene) {
  const flowerRoot = new THREE.Group();
  flowerRoot.name = 'jiangnan_lotus_flowers';

  // 1. 娇嫩粉白花瓣材质 (透光微粉，瓣尖绯红)
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xffe8ed,
    roughness: 0.38,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // 2. 金黄莲蓬与花蕊
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xdec13e,
    roughness: 0.6,
    metalness: 0.05,
  });
  const coreGeo = new THREE.CylinderGeometry(0.09, 0.04, 0.14, 10).translate(0, 0.08, 0);

  // 3. 花托花茎
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x3d6e50,
    roughness: 0.7,
    metalness: 0.02,
  });
  const stemGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.45, 6).translate(0, -0.2, 0);

  const FLOWER_COUNT = 38;
  const { basePetalGeo } = makeLotusFlowerGeo();

  // 实例合批花瓣
  const PETALS_PER_FLOWER = 19;
  const totalPetals = FLOWER_COUNT * PETALS_PER_FLOWER;
  const petalInst = new THREE.InstancedMesh(basePetalGeo, petalMat, totalPetals);
  const coreInst = new THREE.InstancedMesh(coreGeo, coreMat, FLOWER_COUNT);
  const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, FLOWER_COUNT);

  petalInst.castShadow = true;
  petalInst.receiveShadow = true;
  coreInst.castShadow = true;
  stemInst.castShadow = true;

  // 荷花散布位置 (自然掩映在绿荷叶丛中)
  const flowerSpots = [
    { cx: 3.5, cz: 7.0, r: 6.0, n: 14 },
    { cx: 9.0, cz: 11.0, r: 4.5, n: 10 },
    { cx: -3.5, cz: 9.0, r: 4.0, n: 8 },
    { cx: 13.0, cz: 15.0, r: 3.5, n: 6 },
  ];

  const dummy = new THREE.Object3D();
  let fIdx = 0;
  let pGlobalIdx = 0;

  flowerSpots.forEach((sp) => {
    for (let i = 0; i < sp.n && fIdx < FLOWER_COUNT; i++) {
      const ang = Math.random() * TAU;
      const dist = Math.sqrt(Math.random()) * sp.r;
      const x = sp.cx + Math.cos(ang) * dist;
      const z = sp.cz + Math.sin(ang) * dist;
      const y = 0.08 + Math.random() * 0.18; // 挺水出水面高度
      const s = 0.75 + Math.random() * 0.4;

      // 花蕊
      dummy.position.set(x, y, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * TAU, (Math.random() - 0.5) * 0.1);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      coreInst.setMatrixAt(fIdx, dummy.matrix);

      // 茎
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      stemInst.setMatrixAt(fIdx, dummy.matrix);

      // 19 片花瓣生成
      const baseFlowerMatrix = dummy.matrix.clone();

      // 外 8 片
      for (let k = 0; k < 8; k++) {
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, (k / 8) * TAU + Math.random() * 0.1, 0);
        dummy.rotateX(0.46 + Math.random() * 0.1);
        dummy.scale.set(1.15, 1.15, 1.15);
        dummy.updateMatrix();
        const finalM = new THREE.Matrix4().multiplyMatrices(baseFlowerMatrix, dummy.matrix);
        petalInst.setMatrixAt(pGlobalIdx, finalM);
        // 微调花瓣白透粉色
        const pinkCol = new THREE.Color().setHSL(0.96 + Math.random() * 0.03, 0.65, 0.88);
        petalInst.setColorAt(pGlobalIdx, pinkCol);
        pGlobalIdx++;
      }

      // 中 6 片
      for (let k = 0; k < 6; k++) {
        dummy.position.set(0, 0.04, 0);
        dummy.rotation.set(0, (k / 6) * TAU + 0.35 + Math.random() * 0.1, 0);
        dummy.rotateX(0.28 + Math.random() * 0.08);
        dummy.scale.set(0.9, 0.9, 0.9);
        dummy.updateMatrix();
        const finalM = new THREE.Matrix4().multiplyMatrices(baseFlowerMatrix, dummy.matrix);
        petalInst.setMatrixAt(pGlobalIdx, finalM);
        const pinkCol = new THREE.Color().setHSL(0.96, 0.75, 0.90);
        petalInst.setColorAt(pGlobalIdx, pinkCol);
        pGlobalIdx++;
      }

      // 内 5 片
      for (let k = 0; k < 5; k++) {
        dummy.position.set(0, 0.07, 0);
        dummy.rotation.set(0, (k / 5) * TAU + 0.6 + Math.random() * 0.1, 0);
        dummy.rotateX(0.14);
        dummy.scale.set(0.65, 0.65, 0.65);
        dummy.updateMatrix();
        const finalM = new THREE.Matrix4().multiplyMatrices(baseFlowerMatrix, dummy.matrix);
        petalInst.setMatrixAt(pGlobalIdx, finalM);
        const pinkCol = new THREE.Color().setHSL(0.97, 0.85, 0.92);
        petalInst.setColorAt(pGlobalIdx, pinkCol);
        pGlobalIdx++;
      }

      fIdx++;
    }
  });

  petalInst.instanceMatrix.needsUpdate = true;
  if (petalInst.instanceColor) petalInst.instanceColor.needsUpdate = true;
  coreInst.instanceMatrix.needsUpdate = true;
  stemInst.instanceMatrix.needsUpdate = true;

  flowerRoot.add(petalInst);
  flowerRoot.add(coreInst);
  flowerRoot.add(stemInst);
  scene.add(flowerRoot);

  return {
    group: flowerRoot,
    setVisible: (visible) => {
      flowerRoot.visible = visible;
    }
  };
}

