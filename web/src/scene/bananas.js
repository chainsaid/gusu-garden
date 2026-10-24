// ---------------------------------------------------------------------------
// bananas.js — 江南古典园林「雨打芭蕉」植被系统
// 宽厚拱垂的翠绿蕉叶、中肋清晰、叶缘微曲，依附于白粉墙角与漏窗之前。
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const TAU = Math.PI * 2;

function makeBananaLeafGeo(len = 2.4, maxW = 0.58, droop = 0.45) {
  const segsL = 14;
  const pos = [], uv = [], idx = [];

  for (let i = 0; i <= segsL; i++) {
    const t = i / segsL;
    const archY = Math.sin(t * Math.PI * 0.82) * 0.38 - t * t * droop;
    const archZ = t * len;
    const w = maxW * Math.sin(t * Math.PI) * (1.0 - 0.22 * t);
    const vAngle = (1.0 - t * 0.5) * 0.24;

    const pCenter = new THREE.Vector3(0, archY, archZ);
    const pLeft = new THREE.Vector3(-w, archY + w * vAngle, archZ);
    const pRight = new THREE.Vector3(w, archY + w * vAngle, archZ);

    pos.push(pLeft.x, pLeft.y, pLeft.z);
    pos.push(pCenter.x, pCenter.y, pCenter.z);
    pos.push(pRight.x, pRight.y, pRight.z);

    uv.push(0.0, t);
    uv.push(0.5, t);
    uv.push(1.0, t);
  }

  for (let i = 0; i < segsL; i++) {
    const row0 = i * 3;
    const row1 = (i + 1) * 3;
    idx.push(row0, row1, row0 + 1);
    idx.push(row1, row1 + 1, row0 + 1);
    idx.push(row0 + 1, row1 + 1, row0 + 2);
    idx.push(row1 + 1, row1 + 2, row0 + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createJiangnanBananas(scene) {
  const bananaGroup = new THREE.Group();
  bananaGroup.name = 'jiangnan_bananas';

  // 1. 材质与着色器微风摆动
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x2e6b24,
    roughness: 0.42,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  leafMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    leafMat.userData.shader = shader;
    shader.vertexShader = `
      uniform float uTime;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        float sway = clamp(transformed.z / 2.5, 0.0, 1.0);
        float flutter = sin(uTime * 1.8 + position.x * 2.5 + position.z) * 0.05 * sway;
        transformed.y += flutter;
        transformed.x += sin(uTime * 1.2 + position.z) * 0.03 * sway;
      `
    );
  };

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x415e2e,
    roughness: 0.75,
    metalness: 0.02,
  });

  // 2. 芭蕉丛分布点 (白粉墙边、漏窗旁、水榭东侧与庭院回廊拐角)
  const clumps = [
    { x: -9.5, z: -4.5, count: 6, scale: 1.15 },
    { x: -9.5, z: -1.5, count: 5, scale: 0.95 },
    { x: 19.5, z: -4.5, count: 6, scale: 1.1 },
    { x: 19.5, z: 2.5, count: 5, scale: 1.0 },
    { x: 15.0, z: 18.0, count: 4, scale: 1.05 },
    { x: -5.0, z: 18.0, count: 5, scale: 0.9 },
    { x: 23.5, z: 7.5, count: 4, scale: 1.2 },
  ];

  const leafGeo = makeBananaLeafGeo(2.3, 0.55, 0.42);
  const stemGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.2, 8).translate(0, 0.6, 0);

  let totalLeaves = 0;
  clumps.forEach((c) => {
    totalLeaves += c.count * 6;
  });

  const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, totalLeaves);
  const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, clumps.reduce((sum, c) => sum + c.count, 0));
  leafInst.castShadow = true;
  leafInst.receiveShadow = true;
  stemInst.castShadow = true;
  stemInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let lIdx = 0, sIdx = 0;

  clumps.forEach((clump) => {
    for (let c = 0; c < clump.count; c++) {
      const offX = (c === 0 ? 0 : (Math.random() - 0.5) * 1.3);
      const offZ = (c === 0 ? 0 : (Math.random() - 0.5) * 1.3);
      const px = clump.x + offX;
      const pz = clump.z + offZ;
      const py = 0.05;
      const pScale = clump.scale * (c === 0 ? 1.0 : 0.7 + Math.random() * 0.25);

      // 蕉茎
      dummy.position.set(px, py, pz);
      dummy.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * TAU, (Math.random() - 0.5) * 0.1);
      dummy.scale.set(pScale, pScale, pScale);
      dummy.updateMatrix();
      stemInst.setMatrixAt(sIdx++, dummy.matrix);

      // 6 片向四周舒展的巨叶
      const nLeaves = 6;
      for (let i = 0; i < nLeaves && lIdx < totalLeaves; i++) {
        const yaw = (i / nLeaves) * TAU + (Math.random() - 0.5) * 0.35;
        const pitch = 0.35 + Math.random() * 0.45;
        const roll = (Math.random() - 0.5) * 0.3;

        dummy.position.set(px, py + 0.7 * pScale, pz);
        dummy.rotation.set(0, yaw, 0);
        dummy.rotateX(pitch);
        dummy.rotateZ(roll);
        const lScale = pScale * (0.8 + Math.random() * 0.35);
        dummy.scale.set(lScale, lScale, lScale);
        dummy.updateMatrix();

        leafInst.setMatrixAt(lIdx, dummy.matrix);
        // 微调新叶与老叶色差
        const shade = 0.28 + Math.random() * 0.1;
        const col = new THREE.Color().setHSL(0.28 + (Math.random() - 0.5) * 0.04, 0.55, shade);
        leafInst.setColorAt(lIdx, col);
        lIdx++;
      }
    }
  });

  leafInst.instanceMatrix.needsUpdate = true;
  if (leafInst.instanceColor) leafInst.instanceColor.needsUpdate = true;
  stemInst.instanceMatrix.needsUpdate = true;

  bananaGroup.add(leafInst);
  bananaGroup.add(stemInst);
  scene.add(bananaGroup);

  return {
    group: bananaGroup,
    update: (time) => {
      if (leafMat.userData.shader) {
        leafMat.userData.shader.uniforms.uTime.value = time;
      }
    },
    setVisible: (visible) => {
      bananaGroup.visible = visible;
    }
  };
}

