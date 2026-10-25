import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createPavingTextures } from './textures.js';

export function setupEnvironment(scene, renderer) {
  // 1. 物理大气天空球 (Preetham / Nishita 物理大气散射模型)
  const sky = new Sky();
  sky.scale.setScalar(450000);
  sky.name = 'jiangnan_sky';

  // 倾角 7.5° 的朝夕暖阳方位 (西南低照，拉出修长的飞檐与竹影)
  const elevation = 7.5;
  const azimuth = 205; // 西南微偏南
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 7.5;             // 江南水汽朦胧感
  skyUniforms['rayleigh'].value = 2.2;              // 天顶青碧高旷
  skyUniforms['mieCoefficient'].value = 0.006;      // 烟霞散射系数
  skyUniforms['mieDirectionalG'].value = 0.82;      // 逆光光晕扩散度
  skyUniforms['sunPosition'].value.copy(sunPosition);
  scene.add(sky);

  // 2. 烘焙全场景 PMREM 天光漫反射与镜面反射环境贴图 (IBL)
  if (renderer) {
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const skyScene = new THREE.Scene();
      const skyMesh = sky.clone();
      skyScene.add(skyMesh);
      const envMap = pmremGenerator.fromScene(skyScene).texture;
      scene.environment = envMap;
      pmremGenerator.dispose();
      console.log('[environment] 物理天光 PMREM IBL 环境漫反射烘焙完成');
    } catch (e) {
      console.warn('[environment] PMREM 烘焙跳过:', e);
    }
  }

  // 3. 江南烟雨空气透视微雾 (与天空地平线天衣无缝衔接)
  const fogColor = new THREE.Color(0xb4c2c6);
  scene.fog = new THREE.FogExp2(fogColor, 0.0038);

  // 4. 朝夕低角度太阳主平行光 (暖杏玫瑰金色，打出深邃的雕花檐下阴影)
  const sunLight = new THREE.DirectionalLight(0xffdfb8, 3.8);
  sunLight.name = 'sun_directional';
  sunLight.position.copy(sunPosition).multiplyScalar(150);
  sunLight.castShadow = true;

  // 4K 级别高质量软阴影视锥配置
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 280;
  
  const sExtent = 48;
  sunLight.shadow.camera.left = -sExtent;
  sunLight.shadow.camera.right = sExtent;
  sunLight.shadow.camera.top = sExtent;
  sunLight.shadow.camera.bottom = -sExtent;
  sunLight.shadow.bias = -0.00018;
  sunLight.shadow.normalBias = 0.025;
  sunLight.shadow.radius = 1.6;

  scene.add(sunLight);
  scene.add(sunLight.target);
  sunLight.target.position.set(0, 0, 0);

  // 5. 天光半球漫反射 (天顶冷青，地面深暖灰，形成自然立体冷暖明暗)
  const hemiLight = new THREE.HemisphereLight(0xbdd0d6, 0x423830, 0.95);
  hemiLight.position.set(0, 60, 0);
  scene.add(hemiLight);

  // 6. 经典花街铺地与庭院青石大砖基础地坪
  const pavingPbr = createPavingTextures();
  const groundGeom = new THREE.PlaneGeometry(260, 260, 1, 1);
  groundGeom.rotateX(-Math.PI / 2);

  const groundMat = new THREE.MeshStandardMaterial({
    map: pavingPbr.map,
    roughness: pavingPbr.roughness,
    metalness: pavingPbr.metalness,
    envMapIntensity: 0.8,
  });

  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.position.set(10, -0.02, 0);
  ground.receiveShadow = true;
  ground.name = 'garden_ground_paving';
  scene.add(ground);

  return { sunLight, hemiLight, ground, sky, sunPosition };
}
