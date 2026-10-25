import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { L } from '../../../shared/layout.js';

// 水面高度从 shared/layout.js 统一读取，与 src/ 离线系统保持一致
export const WATER_Y = L.pond.waterY;

export function createJiangnanWater(scene) {
  // 水面形状从 shared/layout.js 的 pond.outline 生成，与 src/ 离线系统保持一致
  // ShapeGeometry 在 XY 平面构建，旋转后与 Three.js 水平面对齐
  const shape = new THREE.Shape();
  const pts = L.pond.outline;
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();

  const geom = new THREE.ShapeGeometry(shape, 48);
  geom.rotateX(-Math.PI / 2);

  // 定制具有微风波纹与菲涅尔水体深度的东方水镜着色器
  const waterShader = {
    name: 'JiangnanReflectiveWaterShader',
    uniforms: {
      color: { value: new THREE.Color(0x334442) },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color(0x16261f) },    // 幽深荷池墨玉绿
      uColorShallow: { value: new THREE.Color(0x2a4435) }, // 驳岸浅滩碧玉色
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
        float w1 = sin(p.x * 0.45 + t * 0.6) * cos(p.y * 0.38 + t * 0.4);
        float w2 = sin(p.x * 0.95 - t * 0.8 + p.y * 0.75);
        return vec2(
          cos(p.x * 0.45 + t * 0.6) * 0.45 + cos(p.x * 0.95 - t * 0.8) * 0.95,
          -sin(p.y * 0.38 + t * 0.4) * 0.38 + cos(p.y * 0.75 - t * 0.8) * 0.75
        ) * 0.0012;
      }

      void main() {
        // 1. 微风拂面导致的波光涟漪 (基于世界坐标，全池均匀无形变)
        vec2 wave = getWaveOffset(vWorldPos.xz, uTime);

        // 2. 采样平面镜面反射贴图 (带柔和平缓倒影微扰，倒映水榭楼阁水镜清澈)
        vec4 distCoord = vCoord;
        distCoord.xy += wave * distCoord.w * 0.12;
        vec4 reflCol = texture2DProj(tDiffuse, distCoord);

        // 3. 计算视线与法线夹角及菲涅尔反射率
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal + vec3(-wave.x, 0.0, -wave.y) * 0.20);
        float NdotV = max(dot(V, N), 0.0);
        float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 3.6);

        // 4. 水体固有色 (浅水碧绿，深水幽墨)
        vec3 waterBody = mix(uColorShallow, uColorDeep, 0.82);

        // 5. 朝夕低角度太阳波光高光 (自然微泛金鳞，避免过度白曝)
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 128.0) * 0.12;

        // 6. 最终水体合成：水底暗绿 + 建筑飞檐天光倒影 + 太阳高光闪烁
        vec3 finalColor = mix(waterBody, reflCol.rgb, fresnel) + uSunColor * spec;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  };

  const reflector = new Reflector(geom, {
    clipBias: 0.003,
    textureWidth: Math.min(window.innerWidth * (window.devicePixelRatio || 1), 1024),
    textureHeight: Math.min(window.innerHeight * (window.devicePixelRatio || 1), 1024),
    color: 0x334442,
    shader: waterShader,
    multisample: 2,
  });

  // 水平放置于荷池水面基准高度（坐标中心来自 shared/layout.js）
  reflector.rotateX(-Math.PI / 2);
  reflector.position.set(0, WATER_Y, 0);
  reflector.name = 'jiangnan_lotus_pond_water';
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
