import * as THREE from 'three';

export function createJiangnanWater(scene) {
  // 水面网格 (覆盖主荷池范围，中心位于水池区域)
  const geom = new THREE.PlaneGeometry(80, 80, 1, 1);
  geom.rotateX(-Math.PI / 2);

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorDeep: { value: new THREE.Color(0x183428) },   // 深水墨绿
      uColorShallow: { value: new THREE.Color(0x386d58) },// 浅滩青碧
      uColorSky: { value: new THREE.Color(0xb2c7ca) },    // 天空倒影色
      uSunDir: { value: new THREE.Vector3(0.6, 0.7, 0.4).normalize() },
      uSunColor: { value: new THREE.Color(0xffeedd) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;

      void main() {
        vUv = uv * 18.0;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColorDeep;
      uniform vec3 uColorShallow;
      uniform vec3 uColorSky;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;

      // 轻量程序化水波法线扰动 (无需外部大贴图)
      vec3 getWaterNormal(vec2 uv, float t) {
        float wave1 = sin(uv.x * 2.5 + t * 1.8) * cos(uv.y * 2.2 + t * 1.2);
        float wave2 = sin(uv.x * 4.8 - t * 2.4 + uv.y * 3.1);
        float wave3 = cos(uv.x * 7.5 + uv.y * 6.0 - t * 3.2);
        float h = (wave1 * 0.45 + wave2 * 0.35 + wave3 * 0.2) * 0.08;
        
        vec2 d = vec2(
          cos(uv.x * 2.5 + t * 1.8) * 2.5 + cos(uv.x * 4.8 - t * 2.4) * 4.8,
          -sin(uv.y * 2.2 + t * 1.2) * 2.2 + cos(uv.y * 6.0 - t * 3.2) * 6.0
        ) * 0.025;
        
        return normalize(vec3(-d.x, 1.0, -d.y));
      }

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = getWaterNormal(vUv, uTime);

        // 菲涅尔反射系数 (水体掠射角反射天光)
        float fresnel = pow(1.0 - max(dot(V, N), 0.0), 3.5);
        fresnel = clamp(fresnel * 0.85 + 0.12, 0.0, 1.0);

        // 水体本体色 (浅水到深水自然漫射)
        vec3 waterBody = mix(uColorShallow, uColorDeep, 0.65);

        // 太阳高光波光粼粼
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 90.0) * 1.6;

        // 综合反射与水体颜色
        vec3 finalColor = mix(waterBody, uColorSky, fresnel) + uSunColor * spec;

        // 轻微雾效融合
        gl_FragColor = vec4(finalColor, 0.96);
      }
    `,
    transparent: true,
    depthWrite: true,
  });

  const waterMesh = new THREE.Mesh(geom, waterMaterial);
  waterMesh.position.set(0, 0.01, 0); // 微微抬升于池底
  waterMesh.name = 'jiangnan_water';
  scene.add(waterMesh);

  return {
    mesh: waterMesh,
    update: (t) => {
      waterMaterial.uniforms.uTime.value = t;
    }
  };
}

