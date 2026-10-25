import * as THREE from 'three';
import { WATER_Y } from './water.js';

const TAU = Math.PI * 2;

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

// 真实自然微凹浅碟形荷叶 (Nelumbo peltate leaf with wavy margin & radiating veins)
function makeLotusPadGeo() {
  const segs = 48;
  const rings = 10;
  const r = 0.42;
  const pos = [], uv = [], idx = [];
  pos.push(0, 0, 0);
  uv.push(0.5, 0.5);

  for (let k = 1; k <= rings; k++) {
    const rr = k / rings;
    const rad = rr * r;
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * TAU;
      // 微凹浅碟身 + 辐射叶脉微棱 + 边缘自然起伏褶皱 + 单侧自然重力下垂
      const cup = 0.035 * (0.3 * rr + 0.7 * rr * rr);
      const wave = Math.pow(rr, 2.6) * (Math.sin(6 * th) * 0.018 + Math.sin(12 * th) * 0.007);
      const veins = 0.003 * rr * (0.5 - 0.5 * Math.cos(22 * th)) * Math.min(1.0, rr * 3.2);
      const droop = -0.016 * Math.pow(Math.max(0, Math.cos(th - 0.9)), 3) * Math.pow(rr, 2.2);
      const y = cup + wave + veins + droop;

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

  // 1. GPU 实例合批：荷池荷叶 (Lotus Pads) + 挺水荷茎 (Emergent Stems)
  const padGeom = makeLotusPadGeo();

  const padMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // 纯白底色，由 instanceColor 精准赋予荷叶娇嫩翠碧与深沉墨玉绿
    roughness: 0.65, // 荷叶天然微蜡质微毛绒漫反射，杜绝过度高光泛白
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const LOTUS_COUNT = 580;
  const lotusInst = new THREE.InstancedMesh(padGeom, padMat, LOTUS_COUNT);
  lotusInst.castShadow = true;
  lotusInst.receiveShadow = true;

  const stemGeom = new THREE.CylinderGeometry(0.007, 0.010, 0.48, 5);
  stemGeom.translate(0, -0.24, 0);
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x2e4a2c,
    roughness: 0.65,
    metalness: 0.02,
  });
  const lotusStemInst = new THREE.InstancedMesh(stemGeom, stemMat, LOTUS_COUNT);
  lotusStemInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const stemDummy = new THREE.Object3D();

  // 在荷池区域成簇散布 (围绕水榭台前、石桥两翼与近驳岸，桥拱下方自然错落点缀)
  const clusters = [
    { cx: 17.5, cz: 21.8, r: 2.2, n: 25 },  // 晨曦特写微距荷塘 (Benchmark 11 前景水面)
    { cx: 18.0, cz: 15.5, r: 7.5, n: 160 }, // 桥东侧近景主荷塘 (Benchmark 01/02 核心前景)
    { cx: 12.0, cz: 16.0, r: 5.5, n: 80 },  // 桥东侧靠近水榭前景 (Benchmark 01 倒影区近景荷叶)
    { cx: 3.5, cz: 8.0, r: 6.5, n: 90 },    // 桥西侧水域
    { cx: -3.5, cz: 12.0, r: 6.0, n: 80 },  // 西侧近岸水域
    { cx: 21.5, cz: 21.0, r: 6.0, n: 90 },  // 东南近景近驳岸
    { cx: 10.0, cz: 16.0, r: 3.6, n: 40 },  // 拱桥下方错落点缀荷叶
  ];

  let idx = 0;
  let stemIdx = 0;
  clusters.forEach((cl) => {
    for (let i = 0; i < cl.n && idx < LOTUS_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * cl.r;
      const x = cl.cx + Math.cos(ang) * dist;
      const z = cl.cz + Math.sin(ang) * dist;

      // 仅避开桥墩基石实体
      if (Math.abs(x - 10.0) < 0.9 && Math.abs(z - 16.0) < 1.2) continue;

      // 52% 挺水立叶 (Emergent Leaves) 形成丰富高低空间层叠，其余为贴水浮叶
      const isEmergent = Math.random() < 0.52;
      const y = isEmergent ? (WATER_Y + 0.12 + Math.random() * 0.38) : (WATER_Y + 0.015 + (Math.random() - 0.5) * 0.008);
      const s = isEmergent ? (1.05 + Math.random() * 0.42) : (0.75 + Math.random() * 0.40);
      const tilt = isEmergent ? (0.15 + Math.random() * 0.28) : 0.05;

      dummy.position.set(x, y, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * tilt,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * tilt
      );
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      lotusInst.setMatrixAt(idx, dummy.matrix);
      // 荷叶经典深墨玉绿与温润深荷青 (对齐母本 Nelumbo nucifera，色相 ~124°，适中饱和度与深邃明度)
      const col = new THREE.Color().setHSL(0.34 + (Math.random() - 0.5) * 0.03, 0.46, isEmergent ? 0.17 : 0.12);
      lotusInst.setColorAt(idx, col);

      // 挺水立叶附加立水细茎
      if (isEmergent) {
        const stemLen = y - WATER_Y;
        stemDummy.position.set(x, y, z);
        stemDummy.rotation.set(0, 0, 0);
        stemDummy.scale.set(1, stemLen / 0.48, 1);
        stemDummy.updateMatrix();
        lotusStemInst.setMatrixAt(stemIdx, stemDummy.matrix);
        stemIdx++;
      }

      idx++;
    }
  });

  // 缩减未用尽的茎干实例
  lotusStemInst.count = stemIdx;
  lotusStemInst.instanceMatrix.needsUpdate = true;

  lotusInst.instanceMatrix.needsUpdate = true;
  if (lotusInst.instanceColor) lotusInst.instanceColor.needsUpdate = true;
  foliageGroup.add(lotusInst);
  foliageGroup.add(lotusStemInst);

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

      // 为每根竹竿布置 5 组向上散开的竹叶披针簇
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

  scene.add(foliageGroup);

  return {
    group: foliageGroup,
    lotus: lotusInst,
    bamboo: bambooInst,
    leaves: leafInst,
    setLotusVisible: (visible) => { lotusInst.visible = visible; },
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
