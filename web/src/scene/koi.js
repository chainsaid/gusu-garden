// ---------------------------------------------------------------------------
// koi.js — 荷池锦鲤游弋系统 (Swimming Nishikigoi Fish School)
// 红白、大正三色与黄金锦鲤在荷塘绿波下游弋，尾鳍摆动，为全园注入灵动生气。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { WATER_Y } from './water.js';

const TAU = Math.PI * 2;

// 构建低多边形流线型锦鲤几何体 (鱼身 + 展开胸鳍 + 摆动尾鳍)
function createKoiGeometry() {
  const geom = new THREE.BufferGeometry();
  const pos = [];
  const uv = [];
  const idx = [];

  const segsL = 8;
  const segsR = 6;

  // 鱼身截面半径曲线
  const rCurve = (t) => {
    return Math.sin(t * Math.PI) * (1.0 - 0.25 * t) * 0.12;
  };

  for (let i = 0; i <= segsL; i++) {
    const t = i / segsL;
    const x = (t - 0.5) * 1.0; // 鱼头在 +0.5, 鱼尾在 -0.5
    const r = rCurve(t);

    for (let j = 0; j <= segsR; j++) {
      const a = (j / segsR) * TAU;
      const y = Math.sin(a) * r * 0.85;
      const z = Math.cos(a) * r * 1.1; // 锦鲤横向稍宽

      pos.push(x, y, z);
      uv.push(t, j / segsR);
    }
  }

  const row = segsR + 1;
  for (let i = 0; i < segsL; i++) {
    for (let j = 0; j < segsR; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }

  // 添加薄尾鳍 (沿 -x 方向伸展)
  const tailStart = pos.length / 3;
  pos.push(-0.48, 0.0, 0.0);
  pos.push(-0.75, 0.12, 0.0);
  pos.push(-0.72, 0.0, 0.0);
  pos.push(-0.75, -0.12, 0.0);
  uv.push(0, 0.5, 0, 1, 0, 0.5, 0, 0);
  idx.push(tailStart, tailStart + 1, tailStart + 2);
  idx.push(tailStart, tailStart + 2, tailStart + 3);

  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return geom;
}

export function createJiangnanKoi(scene) {
  const koiRoot = new THREE.Group();
  koiRoot.name = 'jiangnan_koi_school';

  const koiGeo = createKoiGeometry();

  // 锦鲤材质：光滑鱼鳞半光泽 + 顶点游动摆动
  const koiMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.28,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  koiMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    koiMat.userData.shader = shader;
    shader.vertexShader = `
      uniform float uTime;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        // 沿鱼身长度产生波浪摆动 (鱼头稳，尾部振幅大)
        float tailFactor = clamp(-position.x + 0.3, 0.0, 1.0);
        float wiggle = sin(uTime * 6.5 + position.x * 5.0) * 0.14 * tailFactor * tailFactor;
        transformed.z += wiggle;
      `
    );
  };

  const KOI_COUNT = 18;
  const koiInst = new THREE.InstancedMesh(koiGeo, koiMat, KOI_COUNT);
  koiInst.castShadow = false; // 水下微弱阴影免除以提速
  koiInst.receiveShadow = false;

  // 3 条主要的闭合游弋环形航线 (环绕水榭正面台基与石拱桥洞)
  const paths = [
    { cx: 5.0, cz: 8.0, rx: 7.5, rz: 5.0, speed: 0.45 },
    { cx: 10.0, cz: 14.0, rx: 6.0, rz: 6.5, speed: -0.4 },
    { cx: 0.0, cz: 10.0, rx: 5.5, rz: 7.0, speed: 0.5 },
  ];

  // 为每条锦鲤分配初始相位、航线与经典花色
  const koiData = [];
  const dummy = new THREE.Object3D();

  // 经典锦鲤花色：丹顶红白、纯金黄金、大正三色、白金
  const koiColors = [
    new THREE.Color(0xdc3522), // 丹顶绯红
    new THREE.Color(0xf2efe9), // 纯白
    new THREE.Color(0xf5a623), // 黄金
    new THREE.Color(0xe64a19), // 橙红
    new THREE.Color(0xfbfbfb), // 银白
    new THREE.Color(0xd84315), // 赤鲤
  ];

  for (let i = 0; i < KOI_COUNT; i++) {
    const pathIdx = i % paths.length;
    const path = paths[pathIdx];
    const phase = (i / KOI_COUNT) * TAU + Math.random() * 0.5;
    const depth = WATER_Y - 0.08 - Math.random() * 0.16; // 水面下 8~24 cm
    const scale = 0.85 + Math.random() * 0.45;
    const color = koiColors[i % koiColors.length];

    koiData.push({ path, phase, depth, scale, speed: path.speed * (0.85 + Math.random() * 0.3) });
    koiInst.setColorAt(i, color);
  }

  if (koiInst.instanceColor) koiInst.instanceColor.needsUpdate = true;
  koiRoot.add(koiInst);
  scene.add(koiRoot);

  return {
    group: koiRoot,
    update: (elapsed) => {
      if (koiMat.userData.shader) {
        koiMat.userData.shader.uniforms.uTime.value = elapsed;
      }

      // 计算每条鱼的游弋位置与切线航向
      for (let i = 0; i < KOI_COUNT; i++) {
        const d = koiData[i];
        const angle = d.phase + elapsed * d.speed;
        const x = d.path.cx + Math.cos(angle) * d.path.rx;
        const z = d.path.cz + Math.sin(angle) * d.path.rz;
        const y = d.depth + Math.sin(elapsed * 1.5 + i) * 0.02;

        // 计算前进切线方向
        const dx = -Math.sin(angle) * d.path.rx * d.speed;
        const dz = Math.cos(angle) * d.path.rz * d.speed;
        const yaw = Math.atan2(dz, dx);

        dummy.position.set(x, y, z);
        dummy.rotation.set(0, -yaw + Math.PI, 0); // 对准前进朝向
        dummy.scale.set(d.scale, d.scale, d.scale);
        dummy.updateMatrix();

        koiInst.setMatrixAt(i, dummy.matrix);
      }
      koiInst.instanceMatrix.needsUpdate = true;
    },
    setVisible: (visible) => {
      koiRoot.visible = visible;
    }
  };
}

