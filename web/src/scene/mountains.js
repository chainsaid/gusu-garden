// ---------------------------------------------------------------------------
// mountains.js — 姑苏远山系统 (苏州城外连绵丘陵与太湖远山借景)
// 依据古典造园“旷奥借景”法则：
// 1. 山体始于园林 350m 以外（避开近景遮挡水榭飞檐，留出旷远天际与晚霞高积云）；
// 2. 标高严格遵循自然透视：近丘 ~22m，中岭 ~48m，远山 ~95m，平缓起伏；
// 3. 采用平滑法线与水墨青黛空气透视，还原“平林新月，远山如黛”的姑苏意境。
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const DEG = Math.PI / 180;

function mountainElevation(x, z, r, adeg) {
  // 1. 近丘层 (虎丘低缓丘陵，半径 380m ~ 850m，标高 16m ~ 26m)
  let h1 = 0;
  if (r > 320 && r < 950) {
    const u1 = (r - 580) / 260;
    const shape1 = Math.exp(-u1 * u1 * 1.3);
    const az1 = 0.65 + 0.35 * Math.sin(adeg * DEG * 2.0 + 1.2) + 0.20 * Math.cos(adeg * DEG * 4.0);
    const detail1 = Math.sin(x * 0.012 + z * 0.010) * 3.0;
    h1 = (22.0 * az1 + detail1) * shape1;
  }

  // 2. 中岭层 (天平山/灵岩山脊，半径 900m ~ 2200m，标高 35m ~ 55m)
  let h2 = 0;
  if (r > 850 && r < 2400) {
    const u2 = (r - 1450) / 520;
    const shape2 = Math.exp(-u2 * u2 * 1.1);
    const az2 = 0.70 + 0.30 * Math.cos(adeg * DEG * 1.5 - 0.8) + 0.18 * Math.sin(adeg * DEG * 3.0);
    const detail2 = Math.sin(x * 0.006 + z * 0.005) * 5.0;
    h2 = (46.0 * az2 + detail2) * shape2;
  }

  // 3. 远山层 (穹窿山/太湖群峰，半径 2000m ~ 5200m，标高 70m ~ 115m)
  let h3 = 0;
  if (r > 1900 && r < 5500) {
    const u3 = (r - 3400) / 1100;
    const shape3 = Math.exp(-u3 * u3 * 1.0);
    // 夕阳西南方位 (方位角 ~200°) 适度降伏，确保晚霞日轮不受遮挡
    const sunMask = Math.exp(-Math.pow((adeg - 200) / 40, 2.0));
    const az3 = (0.75 + 0.25 * Math.sin(adeg * DEG * 1.2 + 2.1)) * (1.0 - 0.40 * sunMask);
    const detail3 = Math.sin(x * 0.0025 + z * 0.0025) * 9.0;
    h3 = (92.0 * az3 + detail3) * shape3;
  }

  return Math.max(0, h1 + h2 + h3);
}

export function createDistantMountains() {
  const group = new THREE.Group();
  group.name = 'gusu_distant_mountains';

  const cx = 10, cz = 10;
  const nRings = 48;
  const nSegs = 144;
  const rMin = 360;  // 距园林中心 360m 开始起步，绝不压迫庭院主厅
  const rMax = 5200;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= nRings; j++) {
    const t = j / nRings;
    const r = rMin + Math.pow(t, 1.7) * (rMax - rMin);

    for (let i = 0; i <= nSegs; i++) {
      const s = i / nSegs;
      const angle = s * 360;
      const rad = s * Math.PI * 2;

      const ca = Math.cos(rad);
      const sa = Math.sin(rad);

      const x = cx + ca * r;
      const z = cz + sa * r;
      const y = mountainElevation(x, z, r, angle);

      positions.push(x, y, z);
      uvs.push(s, t);
    }
  }

  const ringStride = nSegs + 1;
  for (let j = 0; j < nRings; j++) {
    for (let i = 0; i < nSegs; i++) {
      const v0 = j * ringStride + i;
      const v1 = v0 + 1;
      const v2 = (j + 1) * ringStride + i;
      const v3 = v2 + 1;

      indices.push(v0, v2, v1);
      indices.push(v1, v2, v3);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  // 江南水墨青绿山峦材质 (光滑曲面法线 + 距离空气透视衰减)
  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x243a2b,      // 远山底色 (青绿山水色相)
    roughness: 0.95,
    metalness: 0.01,
    flatShading: false,   // 启用平滑曲面法线，呈现水墨远山柔润山形
  });

  mountainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = { value: new THREE.Vector3(-0.932, 0.118, 0.337).normalize() };
    shader.uniforms.uFogColor = { value: new THREE.Color(0xb6a48f) }; // 天际暖雾
    shader.uniforms.uHazeCyan = { value: new THREE.Color(0x354d4f) }; // 青黛墨色

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      varying vec3 vWorldPosition;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      /* glsl */ `
      #include <worldpos_vertex>
      vWorldPosition = worldPosition.xyz;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform vec3 uSunDir;
      uniform vec3 uFogColor;
      uniform vec3 uHazeCyan;
      varying vec3 vWorldPosition;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      /* glsl */ `
      #include <dithering_fragment>
      // 距离渐变空气透视 (350m ~ 4500m 平滑过渡至天际暖雾)
      float dist = length(vWorldPosition.xz - cameraPosition.xz);
      float distFactor = smoothstep(350.0, 4200.0, dist);

      // 顺逆光空气透视微调
      vec3 V = normalize(cameraPosition - vWorldPosition);
      float sunFacing = max(dot(-V, uSunDir), 0.0);
      vec3 sunsetRim = vec3(0.95, 0.62, 0.35) * pow(sunFacing, 3.5) * 0.28;

      vec3 inkHaze = mix(gl_FragColor.rgb, uHazeCyan, distFactor * 0.75);
      vec3 finalCol = mix(inkHaze, uFogColor + sunsetRim, pow(distFactor, 1.25) * 0.95);

      gl_FragColor = vec4(finalCol, 1.0);
      `
    );
  };

  const mountainMesh = new THREE.Mesh(geom, mountainMat);
  mountainMesh.receiveShadow = true;
  group.add(mountainMesh);

  return group;
}

