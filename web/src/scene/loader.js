import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  createPlasterTextures,
  createTileTextures,
  createWoodTextures,
  createStoneTextures,
} from './textures.js';

export function loadGardenAssets(scene, onProgress) {
  return new Promise((resolve, reject) => {
    // 0. 初始化高保真东方古典 PBR 材质套件
    const plasterPbr = createPlasterTextures();
    const tilePbr = createTileTextures();
    const woodPbr = createWoodTextures();
    const stonePbr = createStoneTextures();

    // 1. 初始化 DRACO 几何解码器
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    // 2. 双资产并行加载 (Core 核心建筑群 + Pagoda 借景北寺塔)
    const assets = [
      { name: 'core', url: '/assets/gusu-garden-core.glb', weight: 0.8 },
      { name: 'pagoda', url: '/assets/beisi-pagoda.glb', weight: 0.2 },
    ];

    const progressTracker = { core: 0, pagoda: 0 };
    const results = {};
    let loadedCount = 0;

    const updateCombinedProgress = () => {
      const totalProgress = (progressTracker.core * 0.8) + (progressTracker.pagoda * 0.2);
      if (onProgress) onProgress(totalProgress);
    };

    assets.forEach((asset) => {
      loader.load(
        asset.url,
        (gltf) => {
          const model = gltf.scene;
          model.name = asset.name;

          // 保持北寺塔在园林西北方 105 米处的远景借景位置
          if (asset.name === 'pagoda') {
            model.position.set(-105, 0, -48);
          }

          // 深度遍历：将导出的平涂塑料材质全量升格为真实东方 PBR 材质
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              if (child.material) {
                const matName = (child.material.name || child.name || '').toLowerCase();

                // (1) 黛瓦屋面：注入真实瓦垄法线与瓦沟积灰、釉光微芒
                if (/tile|瓦/i.test(matName)) {
                  child.material.map = tilePbr.map;
                  child.material.normalMap = tilePbr.normalMap;
                  child.material.normalScale = new THREE.Vector2(0.85, 0.85);
                  child.material.roughness = tilePbr.roughness;
                  child.material.metalness = tilePbr.metalness;
                  child.material.envMapIntensity = 1.35;
                  child.material.needsUpdate = true;
                }
                // (2) 白粉墙：注入水磨微白暖调、抹灰起伏与垂直雨淋水渍
                else if (/plaster|white|墙|壁/i.test(matName)) {
                  child.material.map = plasterPbr.map;
                  child.material.roughnessMap = plasterPbr.roughnessMap;
                  child.material.roughness = plasterPbr.roughness;
                  child.material.metalness = plasterPbr.metalness;
                  child.material.envMapIntensity = 0.95;
                  child.material.needsUpdate = true;
                }
                // (3) 栗壳色木构：柱身、梁架、额枋注入深沉桐油木纹与温润微光
                else if (/wood|chestnut|timber|col|beam|rafter|red|柱|梁/i.test(matName)) {
                  child.material.map = woodPbr.map;
                  child.material.roughness = woodPbr.roughness;
                  child.material.metalness = woodPbr.metalness;
                  child.material.envMapIntensity = 1.15;
                  child.material.needsUpdate = true;
                }
                // (4) 太湖奇石与青石驳岸：注入斑驳石英云母点与深浅溶洞灰
                else if (/rock|taihu|stone|granite|podium|stair|湖石|峰|台基|阶/i.test(matName)) {
                  child.material.map = stonePbr.map;
                  child.material.roughness = stonePbr.roughness;
                  child.material.metalness = stonePbr.metalness;
                  child.material.envMapIntensity = 0.85;
                  child.material.needsUpdate = true;
                }
                // (5) 铁刹与金属
                else if (/iron|铁|刹/i.test(matName)) {
                  child.material.color.setHex(0x282b2e);
                  child.material.roughness = 0.58;
                  child.material.metalness = 0.65;
                  child.material.envMapIntensity = 1.4;
                  child.material.needsUpdate = true;
                }
                // (6) 宝珠金光
                else if (/gold|pearl|金|珠/i.test(matName)) {
                  child.material.color.setHex(0xdca646);
                  child.material.roughness = 0.28;
                  child.material.metalness = 0.85;
                  child.material.envMapIntensity = 1.8;
                  child.material.needsUpdate = true;
                } else {
                  child.material.envMapIntensity = 1.0;
                }
              }
            }
          });

          scene.add(model);
          results[asset.name] = model;
          loadedCount++;

          if (loadedCount === assets.length) {
            dracoLoader.dispose();
            resolve(results);
          }
        },
        (xhr) => {
          if (xhr.total > 0) {
            progressTracker[asset.name] = xhr.loaded / xhr.total;
          } else {
            // 没有 Content-Length 时的备用进度估计
            progressTracker[asset.name] = Math.min(0.95, (progressTracker[asset.name] || 0) + 0.15);
          }
          updateCombinedProgress();
        },
        (err) => {
          console.error(`[loader] 加载资产 ${asset.name} 出错:`, err);
          // 若北寺塔失败不阻断主场景呈现
          if (asset.name === 'pagoda') {
            loadedCount++;
            if (loadedCount === assets.length) resolve(results);
          } else {
            reject(err);
          }
        }
      );
    });
  });
}
