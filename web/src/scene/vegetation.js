import * as THREE from 'three';

export function createJiangnanFoliage(scene) {
  const foliageGroup = new THREE.Group();
  foliageGroup.name = 'jiangnan_foliage';

  // 1. GPU 实例合批：荷池荷叶 (Lotus Pads)
  // 低多边形带缺口的荷叶几何体
  const padShape = new THREE.Shape();
  const padR = 0.65;
  padShape.moveTo(0, 0);
  padShape.absarc(0, 0, padR, 0.25, Math.PI * 2 - 0.25, false);
  padShape.lineTo(0, 0);

  const padGeom = new THREE.ShapeGeometry(padShape, 12);
  padGeom.rotateX(-Math.PI / 2);

  const padMat = new THREE.MeshStandardMaterial({
    color: 0x3d6e50,
    roughness: 0.72,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const LOTUS_COUNT = 160;
  const lotusInst = new THREE.InstancedMesh(padGeom, padMat, LOTUS_COUNT);
  lotusInst.castShadow = true;
  lotusInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  // 在荷池区域成簇散布 (围绕水榭台前与石桥下)
  const clusters = [
    { cx: 2.0, cz: 6.0, r: 7.0, n: 60 },
    { cx: 8.0, cz: 10.0, r: 5.5, n: 40 },
    { cx: -4.0, cz: 8.0, r: 5.0, n: 35 },
    { cx: 12.0, cz: 14.0, r: 4.5, n: 25 },
  ];

  let idx = 0;
  clusters.forEach((cl) => {
    for (let i = 0; i < cl.n && idx < LOTUS_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * cl.r;
      const x = cl.cx + Math.cos(ang) * dist;
      const z = cl.cz + Math.sin(ang) * dist;
      const s = 0.6 + Math.random() * 0.7;

      dummy.position.set(x, 0.035 + (Math.random() - 0.5) * 0.01, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.08,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.08
      );
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      lotusInst.setMatrixAt(idx, dummy.matrix);
      // 微调不同荷叶的黄绿嫩老色
      const col = new THREE.Color().setHSL(0.33 + (Math.random() - 0.5) * 0.05, 0.42, 0.28 + Math.random() * 0.08);
      lotusInst.setColorAt(idx, col);
      idx++;
    }
  });

  lotusInst.instanceMatrix.needsUpdate = true;
  if (lotusInst.instanceColor) lotusInst.instanceColor.needsUpdate = true;
  foliageGroup.add(lotusInst);

  // 2. GPU 实例合批：白粉墙下修竹丛 (Bamboos)
  const stemGeom = new THREE.CylinderGeometry(0.04, 0.055, 6.0, 5);
  stemGeom.translate(0, 3.0, 0);

  // 竹竿材质带 GPU 微风顶点摆动
  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0x486c3a,
    roughness: 0.60,
    metalness: 0.05,
  });

  bambooMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    bambooMat.userData.shader = shader;

    shader.vertexShader = `
      uniform float uTime;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        // 随高度二次方自然摆动的微风
        float hFrac = clamp(transformed.y / 6.0, 0.0, 1.0);
        float sway = sin(uTime * 1.5 + position.x * 0.8 + position.z * 0.5) * hFrac * hFrac * 0.18;
        transformed.x += sway;
        transformed.z += sway * 0.5;
      `
    );
  };

  const BAMBOO_COUNT = 90;
  const bambooInst = new THREE.InstancedMesh(stemGeom, bambooMat, BAMBOO_COUNT);
  bambooInst.castShadow = true;
  bambooInst.receiveShadow = true;

  // 沿回廊墙角与漏窗处散布
  const bambooSpots = [
    { x0: -10, z0: -6, len: 6, dx: 0, dz: 1, n: 30 },
    { x0: 16, z0: -6, len: 5, dx: 0, dz: 1, n: 25 },
    { x0: -6, z0: 22, len: 7, dx: 1, dz: 0, n: 35 },
  ];

  let bIdx = 0;
  bambooSpots.forEach((sp) => {
    for (let i = 0; i < sp.n && bIdx < BAMBOO_COUNT; i++) {
      const t = Math.random();
      const x = sp.x0 + sp.dx * sp.len * t + (Math.random() - 0.5) * 0.8;
      const z = sp.z0 + sp.dz * sp.len * t + (Math.random() - 0.5) * 0.8;
      const hScale = 0.75 + Math.random() * 0.5;

      dummy.position.set(x, 0.2, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.06, Math.random() * Math.PI, (Math.random() - 0.5) * 0.06);
      dummy.scale.set(1, hScale, 1);
      dummy.updateMatrix();

      bambooInst.setMatrixAt(bIdx, dummy.matrix);
      bIdx++;
    }
  });

  bambooInst.instanceMatrix.needsUpdate = true;
  foliageGroup.add(bambooInst);

  scene.add(foliageGroup);

  return {
    group: foliageGroup,
    lotus: lotusInst,
    bamboo: bambooInst,
    setLotusVisible: (visible) => { lotusInst.visible = visible; },
    setBambooVisible: (visible) => { bambooInst.visible = visible; },
    update: (time) => {
      if (bambooMat.userData.shader) {
        bambooMat.userData.shader.uniforms.uTime.value = time;
      }
    }
  };
}

