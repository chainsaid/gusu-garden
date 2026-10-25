import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { L } from '../../../shared/layout.js';

// 水面高度从 shared/layout.js 统一读取，与 src/ 离线系统保持一致
export const WATER_Y = L.pond.waterY;

export function createJiangnanWater(scene) {
  // 水面形状从 shared/layout.js 的 pond.outline 生成，与 src/ 离线系统保持一致
  // Three.js Reflector 默认在局部 XY 平面（法线指向 +Z），通过 reflector.rotation.x = -Math.PI / 2
  // 将局部 (x, y, 0) 变换为世界坐标 (x, 0, -y)。因此在 XY 平面构造 Shape 时，
  // 采用 (x, -z) 点位，经旋转后在世界坐标系精准还原 (x, WATER_Y, z)，法线严格朝上 (+Y)。
  const shape = new THREE.Shape();
  const pts = L.pond.outline;
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
  shape.closePath();

  if (L.pond.island) {
    const hole = new THREE.Path();
    const ipts = L.pond.island;
    hole.moveTo(ipts[0][0], -ipts[0][1]);
    for (let i = 1; i < ipts.length; i++) hole.lineTo(ipts[i][0], -ipts[i][1]);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geom = new THREE.ShapeGeometry(shape, 48);

  // 定制具有微风波纹与菲涅尔水体深度的东方澄潭碧水着色器
  const waterShader = {
    name: 'JiangnanReflectiveWaterShader',
    uniforms: {
      color: { value: new THREE.Color(0x334442) },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color(0x184232) },    // 幽深荷池澄潭墨玉绿
      uColorShallow: { value: new THREE.Color(0x2f6b52) }, // 驳岸浅滩碧玉青翠
      uSunDir: { value: new THREE.Vector3(-0.932, 0.118, 0.337).normalize() },
      uSunColor: { value: new THREE.Color(0xffcf9e) },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      uniform float uTime;
      varying vec4 vCoord;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;

      void main() {
        vUv = uv * 28.0;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vCoord = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec3 uColorDeep;
      uniform vec3 uColorShallow;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;

      varying vec4 vCoord;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;

      // 程序化多频微风水波导数 (以世界坐标计算均匀倒影微扰与法线微光)
      vec2 getWaveOffset(vec2 p, float t) {
        float w1 = sin(p.x * 0.65 + t * 1.1) * cos(p.y * 0.55 + t * 0.85);
        float w2 = sin(p.x * 1.4 - t * 1.4 + p.y * 1.1);
        float w3 = cos(p.x * 2.6 + p.y * 2.1 - t * 1.9);
        return vec2(
          cos(p.x * 0.65 + t * 1.1) * 0.65 + cos(p.x * 1.4 - t * 1.4) * 1.4 - sin(p.x * 2.6 + p.y * 2.1 - t * 1.9) * 2.6,
          -sin(p.y * 0.55 + t * 0.85) * 0.55 + cos(p.x * 1.4 - t * 1.4) * 1.1 - sin(p.x * 2.6 + p.y * 2.1 - t * 1.9) * 2.1
        ) * 0.0016;
      }

      void main() {
        // 1. 微风拂面导致的波光涟漪 (基于世界坐标，全池均匀无形变)
        vec2 wave = getWaveOffset(vWorldPos.xz, uTime);

        // 2. 采样平面镜面反射贴图 (带柔和平缓倒影微扰，倒映水榭楼阁水镜清澈)
        vec4 distCoord = vCoord;
        distCoord.xy += wave * distCoord.w * 0.35;
        vec4 reflCol = texture2DProj(tDiffuse, distCoord);

        // 3. 计算视线与微扰法线夹角及菲涅尔反射率
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal + vec3(-wave.x * 2.5, 0.0, -wave.y * 2.5));
        float NdotV = max(dot(V, N), 0.0);
        float fresnel = 0.04 + 0.96 * pow(clamp(1.0 - NdotV, 0.0, 1.0), 3.5);

        // 4. 水体透射散射固有色 (澄潭深碧与天光漫射散射，杜绝背阴死黑)
        vec3 skyScatter = vec3(0.08, 0.16, 0.13) * max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0);
        vec3 waterBody = mix(uColorShallow, uColorDeep, 0.48) + skyScatter;

        // 5. 朝夕低角度太阳波光高光 (自然微泛金鳞，避免过度白曝)
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 96.0) * 0.35;

        // 6. 物理菲涅尔水体合成：水底澄潭碧波透射 + 水榭飞檐天光镜面倒影 + 太阳金光跃金
        vec3 reflLight = max(reflCol.rgb, vec3(0.0));
        vec3 finalColor = waterBody * (1.0 - fresnel * 0.60) + reflLight * (fresnel * 0.85) + uSunColor * spec;

        gl_FragColor = vec4(finalColor, clamp(0.88 + fresnel * 0.10, 0.0, 1.0));
      }
    `,
  };

  const reflector = new Reflector(geom, {
    clipBias: 0.005,
    textureWidth: Math.min(window.innerWidth * (window.devicePixelRatio || 1), 1024),
    textureHeight: Math.min(window.innerHeight * (window.devicePixelRatio || 1), 1024),
    color: 0x334442,
    shader: waterShader,
    multisample: 2,
  });

  // 水平放置于荷池水面基准高度（坐标中心来自 shared/layout.js）
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(0, WATER_Y, 0);
  reflector.name = 'jiangnan_lotus_pond_water';
  reflector.material.transparent = true;
  scene.add(reflector);

  return {
    mesh: reflector,
    update: (elapsed) => {
      if (reflector.material && reflector.material.uniforms) {
        reflector.material.uniforms.uTime.value = elapsed;
      }
    },
  };
}
