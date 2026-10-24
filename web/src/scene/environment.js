import * as THREE from 'three';

export function setupEnvironment(scene) {
  // 1. 江南烟雨晨雾 (平滑渐变雾)
  const fogColor = new THREE.Color(0xb0c2c5);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.0075);

  // 2. 半球环境漫射光 (天光 + 地光反射)
  const hemiLight = new THREE.HemisphereLight(
    0xedf4f6, // 苍穹青明天光
    0x54625b, // 庭院草木与青石地坪漫反射
    1.15
  );
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  // 3. 太阳主平行光 (柔和斜照朝阳)
  const sunLight = new THREE.DirectionalLight(0xfff6e8, 1.85);
  // 东南偏南入射，打出优雅的檐下阴影
  sunLight.position.set(38, 45, 28);
  sunLight.castShadow = true;

  // 优化阴影参数 (1024 适中尺寸 + 软化滤波)
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 120;
  
  // 紧凑的阴影包围盒覆盖核心庭院
  const sExtent = 32;
  sunLight.shadow.camera.left = -sExtent;
  sunLight.shadow.camera.right = sExtent;
  sunLight.shadow.camera.top = sExtent;
  sunLight.shadow.camera.bottom = -sExtent;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.radius = 2.5; // 柔化阴影边缘

  scene.add(sunLight);

  // 4. 环境补光 (北方与暗面微光)
  const fillLight = new THREE.DirectionalLight(0x8fa2a8, 0.45);
  fillLight.position.set(-30, 20, -30);
  scene.add(fillLight);

  // 5. 庭院青石基础地坪 (平整承接建筑与荷池驳岸)
  const groundGeom = new THREE.PlaneGeometry(200, 200, 1, 1);
  groundGeom.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x525a5c,
    roughness: 0.88,
    metalness: 0.04,
  });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.position.set(10, -0.05, 0);
  ground.receiveShadow = true;
  ground.name = 'garden_ground';
  scene.add(ground);

  return { sunLight, hemiLight, ground };
}

