import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export function createJiangnanWater(scene) {
  // 水面网格 (覆盖主荷池水域范围，Y = 0.02)
  const geom = new THREE.PlaneGeometry(90, 90, 32, 32);

  // 定制具有微风波纹与菲涅尔水体深度的东方水镜着色器
  const waterShader = {
    name: 'JiangnanReflectiveWaterShader',
    uniforms: {
      color: { value: new THREE.Color(0x334442) },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color(0x132a22) },    // 幽深荷池墨玉绿
      uColorShallow: { value: new THREE.Color(0x326852) }, // 驳岸浅滩碧玉色
      uSunDir: { value: new THREE.Vector3(-0.94, 0.15, 0.34).normalize() },
      uSunColor: { value: new THREE.Color(0xffe6c2) },
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

      // 程序化多频微风水波导数 (计算倒影扭曲与法线微光)
      vec2 getWaveOffset(vec2 p, float t) {
        float w1 = sin(p.x * 2.2 + t * 1.5) * cos(p.y * 1.8 + t * 0.9);
        float w2 = sin(p.x * 4.6 - t * 2.1 + p.y * 3.4);
        float w3 = cos(p.x * 8.2 + p.y * 6.5 - t * 3.0);
        return vec2(
          cos(p.x * 2.2 + t * 1.5) * 2.2 + cos(p.x * 4.6 - t * 2.1) * 4.6,
          -sin(p.y * 1.8 + t * 0.9) * 1.8 + cos(p.y * 6.5 - t * 3.0) * 6.5
        ) * 0.018;
      }

      void main() {
        // 1. 微风拂面导致的波光涟漪
        vec2 wave = getWaveOffset(vUv, uTime);

        // 2. 采样平面镜面反射贴图 (带波纹微扰)
        vec4 distCoord = vCoord;
        distCoord.xy += wave * distCoord.w * 0.45;
        vec4 reflCol = texture2DProj(tDiffuse, distCoord);

        // 3. 计算视线与法线夹角及菲涅尔反射率
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal + vec3(-wave.x, -wave.y, 1.0) * 0.25);
        float NdotV = max(dot(V, N), 0.0);
        float fresnel = 0.05 + 0.95 * pow(1.0 - NdotV, 3.8);

        // 4. 水体固有色 (浅水碧绿，深水幽墨)
        vec3 waterBody = mix(uColorShallow, uColorDeep, 0.75);

        // 5. 朝夕低角度太阳波光高光 (金鳞耀目)
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 96.0) * 1.8;

        // 6. 最终水体合成：水底暗绿 + 建筑飞檐天光倒影 + 太阳高光闪烁
        vec3 finalColor = mix(waterBody, reflCol.rgb, fresnel) + uSunColor * spec;

        gl_FragColor = vec4(finalColor, 0.94);
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

  // 水平放置于水面高度 (Y = 0.015)，中心略微偏向东侧荷池主力水域
  reflector.rotateX(-Math.PI / 2);
  reflector.position.set(12, 0.015, 12);
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
