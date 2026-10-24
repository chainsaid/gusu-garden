import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export function loadGardenAssets(scene, onProgress) {
  return new Promise((resolve, reject) => {
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

          // 规范化所有网格的阴影与着色
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              // 如果材质偏亮或有微弱粗糙度偏移，微调为古朴质感
              if (child.material) {
                child.material.envMapIntensity = 0.85;
                if (child.material.roughness !== undefined) {
                  child.material.roughness = Math.max(0.4, child.material.roughness);
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
