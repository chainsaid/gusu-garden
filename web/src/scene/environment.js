import * as THREE from 'three';
import { createProceduralSky } from './sky.js';
import { createPavingTextures } from './textures.js';
import { L } from '../../../shared/layout.js';

export function setupEnvironment(scene, renderer) {
  // 严格对齐原版电影级太阳方位 (仰角 6.8°，西偏南方位角，拉出深长飞檐阴影)
  const sunPosition = new THREE.Vector3(-0.932, 0.118, 0.337).normalize();

  // 1. 物理大气散射与程序化夕阳高积云天空球 (Nishita 单散射 + 黄金时刻高积云 + 边缘变暗日轮)
  const sky = createProceduralSky(sunPosition);
  scene.add(sky);

  // 2. 烘焙全场景 PMREM 天光漫反射与镜面反射环境贴图 (IBL)
  // 关键：在烘焙 PMREM 时隐藏太阳光球 (uSunDisc = 0)，防止高亮光球造成漫反射死白
  if (renderer) {
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const skyScene = new THREE.Scene();
      const skyMesh = sky.clone();
      if (skyMesh.material.uniforms.uSunDisc) {
        skyMesh.material.uniforms.uSunDisc.value = 0.0;
      }
      skyScene.add(skyMesh);
      const envMap = pmremGenerator.fromScene(skyScene).texture;
      scene.environment = envMap;
      pmremGenerator.dispose();
      console.log('[environment] 物理天光 PMREM IBL 环境漫反射烘焙完成');
    } catch (e) {
      console.warn('[environment] PMREM 烘焙跳过:', e);
    }
  }

  // 3. 江南烟雨空气透视微雾 (透气暖霞雾，透出百米外北寺塔与数公里外叠翠远山)
  const fogColor = new THREE.Color(0xb6a48f);
  scene.fog = new THREE.FogExp2(fogColor, 0.00052);

  // 4. 朝夕低角度太阳主平行光 (暖杏金红 ~3300K，严格对齐母本 ENV.sunIntensity = 7.0)
  const sunLight = new THREE.DirectionalLight(0xffb572, 5.8);
  sunLight.name = 'sun_directional';
  sunLight.position.copy(sunPosition).multiplyScalar(180);
  sunLight.castShadow = true;

  // 4K 级别高质量软阴影视锥配置
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 320;

  const sExtent = 55;
  sunLight.shadow.camera.left = -sExtent;
  sunLight.shadow.camera.right = sExtent;
  sunLight.shadow.camera.top = sExtent;
  sunLight.shadow.camera.bottom = -sExtent;
  sunLight.shadow.bias = -0.00008;
  sunLight.shadow.normalBias = 0.035;
  sunLight.shadow.radius = 1.0;

  scene.add(sunLight);
  scene.add(sunLight.target);
  sunLight.target.position.set(5, 1.5, 5);

  // 5. 天光半球漫反射 (天顶冷清青灰，地面暖灰反光，形成立体温润漫反射)
  const hemiLight = new THREE.HemisphereLight(0xc6dbe4, 0x56483c, 1.25);
  hemiLight.position.set(0, 60, 0);
  scene.add(hemiLight);

  // 6. 经典花街铺地与庭院青石大砖基础地坪 (开辟荷池多边形内孔，池底不设地坪，杜绝水底穿模与阴影杂斑)
  const groundShape = new THREE.Shape();
  const half = 140;
  groundShape.moveTo(10 - half, -(0 - half));
  groundShape.lineTo(10 + half, -(0 - half));
  groundShape.lineTo(10 + half, -(0 + half));
  groundShape.lineTo(10 - half, -(0 + half));
  groundShape.closePath();

  if (L.pond && L.pond.outline) {
    const pondHole = new THREE.Path();
    const pts = L.pond.outline;
    pondHole.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) pondHole.lineTo(pts[i][0], -pts[i][1]);
    pondHole.closePath();
    groundShape.holes.push(pondHole);
  }

  const groundGeom = new THREE.ShapeGeometry(groundShape, 32);
  groundGeom.rotateX(-Math.PI / 2);

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2d3b22, // 庭院外围连绵江南草木林地与苍翠深土
    roughness: 0.95,
    metalness: 0.01,
    envMapIntensity: 0.95,
  });

  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.position.set(0, -0.02, 0);
  ground.receiveShadow = true;
  ground.name = 'garden_ground_paving';
  scene.add(ground);

  // 6.1 水榭主殿大院落铺地 (对齐原版砂砾与青石板大露台，避开荷塘)
  const courtTerraceGeo = new THREE.PlaneGeometry(108, 49);
  courtTerraceGeo.rotateX(-Math.PI / 2);
  const courtTerraceMat = new THREE.MeshStandardMaterial({
    color: 0x6e6b63, // 经典暖灰苏式青石板与古砂砾露台
    roughness: 0.88,
    metalness: 0.02,
  });
  const courtTerrace = new THREE.Mesh(courtTerraceGeo, courtTerraceMat);
  courtTerrace.position.set(6, 0.001, -21.5);
  courtTerrace.receiveShadow = true;
  courtTerrace.name = 'hall_courtyard_terrace';
  scene.add(courtTerrace);

  // 6.2 荷池深水沉砂池底 (y = -1.4m，沉泥与暗砂质感，为半透水体与锦鲤游弋提供物理深度)
  if (L.pond && L.pond.outline) {
    const basinShape = new THREE.Shape();
    const pts = L.pond.outline;
    basinShape.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) basinShape.lineTo(pts[i][0], -pts[i][1]);
    basinShape.closePath();

    const basinGeom = new THREE.ShapeGeometry(basinShape, 32);
    basinGeom.rotateX(-Math.PI / 2);

    const basinMat = new THREE.MeshStandardMaterial({
      color: 0x12241b, // 幽深池底古水沉砂
      roughness: 0.95,
      metalness: 0.0,
    });

    const pondBasin = new THREE.Mesh(basinGeom, basinMat);
    pondBasin.position.set(0, -1.4, 0);
    pondBasin.name = 'pond_basin_floor';
    scene.add(pondBasin);
  }

  // 7. 远景借景群山 (Suzhou Distant Mountains Silhouette Ring)
  // 环绕园林四周 850 米处起伏的姑苏群山苍黛远岫 (层峦叠嶂，与北寺塔和水榭飞檐相映成趣)
  const mountainGeom = new THREE.CylinderGeometry(850, 850, 160, 128, 2, true);
  const mPos = mountainGeom.attributes.position;
  for (let i = 0; i < mPos.count; i++) {
    const y = mPos.getY(i);
    if (y > 0) {
      const x = mPos.getX(i);
      const z = mPos.getZ(i);
      const ang = Math.atan2(z, x);
      // 自然群山连绵叠嶂 (西面天平山、灵岩山余脉，北面虞山借景，高度 65m~125m)
      const westWeight = Math.max(0, Math.sin((ang - 1.2) * 0.8));
      const northWeight = Math.max(0, Math.cos((ang - 0.2) * 0.9));
      const wave = Math.sin(ang * 3.2) * 28 + Math.cos(ang * 6.5 + 0.8) * 16 + Math.sin(ang * 11.0) * 8 + westWeight * 36 + northWeight * 24;
      mPos.setY(i, y + wave + 22);
    }
  }
  mountainGeom.computeVertexNormals();

  const mountainMat = new THREE.MeshStandardMaterial({
    color: 0x485a53, // 远山苍黛微绿，与天际暮霞自然交融
    roughness: 0.95,
    metalness: 0.02,
    side: THREE.BackSide,
  });
  const mountains = new THREE.Mesh(mountainGeom, mountainMat);
  mountains.position.set(0, -35, 0);
  mountains.name = 'distant_mountains';
  scene.add(mountains);

  return { sunLight, hemiLight, ground, sky, sunPosition, mountains };
}
