import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { L } from '../../../shared/layout.js';
import {
  createPlasterTextures,
  createTileTextures,
  createWoodTextures,
  createStoneTextures,
  createTaihuRockTextures,
  createPavingTextures,
} from './textures.js';

export function loadGardenAssets(scene, onProgress) {
  return new Promise((resolve, reject) => {
    // 0. 初始化高保真东方古典 PBR 材质套件
    const plasterPbr = createPlasterTextures();
    const tilePbr = createTileTextures();
    const woodPbr = createWoodTextures();
    const stonePbr = createStoneTextures();
    const taihuPbr = createTaihuRockTextures();
    const pavingPbr = createPavingTextures();

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

          // 保持北寺塔在园林西北方的远景借景位置（坐标来自 shared/layout.js）
          if (asset.name === 'pagoda') {
            model.position.set(...L.pagoda.center);
          }

          // 深度遍历：按模型节点命名与母本规范精准赋予东方 PBR 材质
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              // 清除几何体残留的内部顶点色通道
              if (child.geometry && child.geometry.attributes.color) {
                child.geometry.deleteAttribute('color');
              }

              if (child.material) {
                child.material = child.material.clone();
                child.material.vertexColors = false;

                const nodeName = (child.name || '').toLowerCase();
                const matName = (child.material.name || '').toLowerCase();
                const parentName = (child.parent?.name || '').toLowerCase();
                const combined = `${nodeName} ${matName} ${parentName}`;

                // -----------------------------------------------------------
                // (A) 北寺塔专属材质 (赭黄粉壁、红棕斗栱与飞椽、乌黑铁刹)
                // -----------------------------------------------------------
                if (asset.name === 'pagoda' || combined.includes('pagoda')) {
                  child.castShadow = false;
                  child.receiveShadow = false; // 远景借景建筑免受庭院阴影相机截断致盲
                  if (/plaster|wall|ochre|赭/i.test(combined)) {
                    // 赭黄墙面颜色与质感由 GLB 源材质直接决定 (src MT.plaster = 0xd8c090),
                    // Web 端不再二次覆盖, 保证「所见即 GLB」可在固定视角逐点校型
                    child.material.needsUpdate = true;
                    return;
                  }
                  if (/iron|needle|spire|刹|钉/i.test(combined)) {
                    child.material.map = null;
                    child.material.color.setHex(0x242628); // 乌黑九级铁刹相轮与刹尖
                    child.material.roughness = 0.62;
                    child.material.metalness = 0.55;
                    child.material.needsUpdate = true;
                    return;
                  }
                  if (/tile|disc|noshi|lip|瓦|脊/i.test(combined)) {
                    child.material.map = tilePbr.map;
                    child.material.normalMap = tilePbr.normalMap;
                    child.material.color.setHex(0x2a3136); // 深黛青瓦
                    child.material.roughness = 0.78;
                    child.material.metalness = 0.05;
                    child.material.needsUpdate = true;
                    return;
                  }
                  if (/gold|pearl|lotuscap|珠|顶/i.test(combined)) {
                    child.material.map = null;
                    child.material.color.setHex(0xdca646); // 摩尼宝珠镏金
                    child.material.roughness = 0.30;
                    child.material.metalness = 0.85;
                    child.material.needsUpdate = true;
                    return;
                  }
                  if (/stone|granite|台基/i.test(combined)) {
                    child.material.map = stonePbr.map;
                    child.material.color.setHex(0x828b8e); // 青石台基
                    child.material.roughness = 0.75;
                    child.material.metalness = 0.02;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 斗栱、飞椽、梁枋、勾栏平座、大门门框 -> 风化灰褐红木构 (对齐 ref 实物褪色观感, 降饱和压暗)
                  child.material.map = null;
                  child.material.color.setHex(0x5a3326);
                  child.material.roughness = 0.60;
                  child.material.metalness = 0.02;
                  child.material.needsUpdate = true;
                  return;
                }

                // -----------------------------------------------------------
                // (B) 檐下悬挂宫灯与飞檐发戗风铎 (anchors)
                // -----------------------------------------------------------
                if (combined.includes('lantern')) {
                  if (/paper|panel/i.test(nodeName) || /lanternpaper/i.test(matName)) {
                    child.material.map = null;
                    child.material.color.setHex(0xf4ecd8); // 温润宣纸原色
                    child.material.emissive.setHex(0xffaa33);
                    child.material.emissiveIntensity = 0.08; // 白昼自然微透光，避免刺眼抢戏
                    child.material.roughness = 0.90;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 灯架熟铁
                  child.material.map = null;
                  child.material.color.setHex(0x282624);
                  child.material.roughness = 0.58;
                  child.material.metalness = 0.70;
                  child.material.needsUpdate = true;
                  return;
                }
                if (combined.includes('bell') || /windbell/i.test(combined)) {
                  child.material.map = null;
                  child.material.color.setHex(0x7c6a46); // 古青铜风铎
                  child.material.roughness = 0.45;
                  child.material.metalness = 0.85;
                  child.material.needsUpdate = true;
                  return;
                }

                // 廊道寻杖栏杆木望柱头
                if (/lotusfinial|baluster/i.test(combined)) {
                  child.material.map = null;
                  child.material.color.setHex(0x5a2618);
                  child.material.roughness = 0.58;
                  child.material.metalness = 0.02;
                  child.material.needsUpdate = true;
                  return;
                }

                // -----------------------------------------------------------
                // (C) 庭院自然地坪/苔藓草坪 (courtyardGround) 与石阶步道铺地 (terrainPaving) 与荷池叠石驳岸 (pondStone)
                // -----------------------------------------------------------
                if (combined.includes('courtyardground') || combined.includes('mossground') || /ground|moss|lawn/i.test(combined)) {
                  child.material.map = null;
                  child.material.color.setHex(0x354823); // 经典江南庭院苍翠苔藓与草坪地坪
                  child.material.roughness = 0.94;
                  child.material.metalness = 0.01;
                  child.material.needsUpdate = true;
                  return;
                }
                if (combined.includes('terrainpaving') || combined.includes('paving')) {
                  child.material.map = pavingPbr.map;
                  child.material.normalMap = pavingPbr.normalMap;
                  child.material.color.setHex(0xb8b2a5); // 庭院花街铺地海棠人字锦纹与散水明沟
                  child.material.roughness = 0.75;
                  child.material.metalness = 0.02;
                  child.material.needsUpdate = true;
                  return;
                }
                if (combined.includes('pondstone') || combined.includes('pondrocks') || combined.includes('pondwalls')) {
                  child.material.map = taihuPbr.map;
                  child.material.normalMap = taihuPbr.normalMap;
                  child.material.color.setHex(0x8a9296); // 荷池驳岸太湖石叠石与护岸石壁 (水气浸润与溶蚀)
                  child.material.roughness = 0.82;
                  child.material.metalness = 0.02;
                  child.material.needsUpdate = true;
                  return;
                }

                // -----------------------------------------------------------
                // (D) 小飞虹单孔石梁拱桥构件细分材质
                // -----------------------------------------------------------
                const isBridgePart = parentName === 'bridge' || /bridge/i.test(child.name);
                if (isBridgePart) {
                  const vCount = child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
                  // 0. 桥心石：保留 glb 自带六旋水纹贴图（bridge.js 程序化生成的
                  //    albedo+normal，导出时 resolveStdMat 因材质带 map 原样保留进 glb）。
                  //    不能再用 stonePbr 覆盖 —— 否则 web 版桥心石退回无纹素的青石板。
                  if (/heart/i.test(combined)) {
                    child.material.color.setHex(0x8b9390);
                    child.material.roughness = 0.82;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 0.7;
                    if (!child.material.normalMap && stonePbr.normalMap) child.material.normalMap = stonePbr.normalMap;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 1. 望柱莲瓣柱头 (青石雕刻望柱头，对齐母本 bridge.js: gib = carved bluestone，绝非白光灯泡)
                  if (/stonegib|gib|lotuscap/i.test(combined)) {
                    child.material.map = null;
                    child.material.color.setHex(0x55666e); // 青灰冷调望柱头（对齐电影版 bluestone）
                    child.material.roughness = 0.74;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 0.5;
                  }
                  // 2. 青石桥墩与水中基座
                  else if (/stone|granite|pier/i.test(combined) || (vCount > 60000 && vCount < 85000)) {
                    child.material.map = null;
                    child.material.normalMap = stonePbr.normalMap || child.material.normalMap;
                    child.material.color.setHex(0x6f7c7e);
                    child.material.roughness = 0.86;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 0.5;
                  }
                  // 3. 熟铁饰件套筒与抱箍
                  else if (/iron|dark|gold/i.test(combined) || (vCount > 20000 && vCount < 30000)) {
                    child.material.map = null;
                    child.material.color.setHex(0x282b2e);
                    child.material.roughness = 0.65;
                    child.material.metalness = 0.55;
                  }
                  // 4. 拱券主梁、侧饰板、桥面板、寻杖栏杆
                  else {
                    child.material.map = woodPbr.map;
                    child.material.color.setHex(0x823b2d); // 典雅深红栗壳漆木作 (还原小飞虹经典朱红大漆质感)
                    child.material.roughness = 0.54;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 1.05;
                  }
                  child.material.needsUpdate = true;
                  return;
                }

                // -----------------------------------------------------------
                // (E) 主厅 (Hall) 专属节点材质对齐
                // -----------------------------------------------------------
                if (nodeName.startsWith('hall:') || parentName.startsWith('hall')) {
                  // 1. 白粉外墙与栱眼壁
                  if (nodeName.includes('plaster') || nodeName.includes('hook_37169040') || nodeName.includes('hook_36640648') || nodeName.includes('intplaster')) {
                    child.material.map = plasterPbr.map;
                    child.material.color.setHex(0xfcfaf6);
                    child.material.roughness = plasterPbr.roughness;
                    child.material.metalness = plasterPbr.metalness;
                    child.material.envMapIntensity = 0.95;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 1.5 室内金砖/深色楠木地板
                  if (nodeName.includes('hallintfloor') || nodeName.includes('intfloor')) {
                    child.material.map = woodPbr.map;
                    child.material.color.setHex(0x1e140d);
                    child.material.roughness = 0.32;
                    child.material.metalness = 0.05;
                    child.material.envMapIntensity = 1.25;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 2. 温润花岗石台基与踏步
                  if (nodeName.includes('hook_24735478') || nodeName.includes('podium') || nodeName.includes('stair')) {
                    child.material.map = stonePbr.map;
                    child.material.color.setHex(0xb5b0a6);
                    child.material.roughness = 0.68;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 1.10;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 3. 斗栱构件 -> 经典深朱红大漆木作 (对齐母本 hallBracket / hallRed vec3(0.50, 0.072, 0.028))
                  if (nodeName.includes('hallbracket') || nodeName.includes('hallred')) {
                    child.material.map = woodPbr.map;
                    child.material.color.setHex(0x682618);
                    child.material.roughness = 0.55;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 1.10;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 4. 门窗隔扇与长窗木棂
                  if (nodeName.includes('hallpanel')) {
                    child.material.map = woodPbr.map;
                    child.material.color.setHex(0x3e2418);
                    child.material.roughness = 0.54;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 1.15;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 5. 檐下木作、挑檐檩与穿枋
                  if (nodeName.includes('hallsoffit') || nodeName.includes('hook_28800117')) {
                    child.material.map = woodPbr.map;
                    child.material.color.setHex(0x281810);
                    child.material.roughness = 0.65;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 1.05;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 6. 黑色大漆饰边与檐檩套色
                  if (nodeName.includes('meshphysicalmaterial') || nodeName.includes('blacklacquer')) {
                    child.material.map = null;
                    child.material.color.setHex(0x18181a);
                    child.material.roughness = 0.35;
                    child.material.metalness = 0.05;
                    child.material.envMapIntensity = 1.25;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 7. 铁件铜饰
                  if (nodeName.includes('hook_42614364') || nodeName.includes('hook_23556852')) {
                    child.material.map = null;
                    child.material.color.setHex(0x282624);
                    child.material.roughness = 0.55;
                    child.material.metalness = 0.65;
                    child.material.envMapIntensity = 1.2;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 8. 梁柱大木构 -> 经典江南熟褐桐油栗壳老料 (对齐母本 hallRedAged vec3(0.082, 0.046, 0.028))
                  if (nodeName.includes('hallredaged') || nodeName.includes('hallreddark')) {
                    child.material.map = woodPbr.map;
                    child.material.color.setHex(0x3a2216);
                    child.material.roughness = 0.58;
                    child.material.metalness = 0.02;
                    child.material.envMapIntensity = 1.10;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 9. 镏金雕花构件
                  if (nodeName.includes('hallgoldcarve') || nodeName.includes('gold')) {
                    child.material.map = null;
                    child.material.color.setHex(0xdca646);
                    child.material.roughness = 0.30;
                    child.material.metalness = 0.85;
                    child.material.envMapIntensity = 1.8;
                    child.material.needsUpdate = true;
                    return;
                  }
                }

                // -----------------------------------------------------------
                // (F) 回廊 (Corridor) 专属节点材质对齐
                // -----------------------------------------------------------
                const isCorridor = nodeName.includes('corridor') || parentName.includes('corridor');
                if (isCorridor) {
                  const vCount = child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
                  // 1. 白粉外墙
                  if (vCount === 9888 || vCount === 1536 || /wall|plaster/i.test(combined)) {
                    child.material.map = plasterPbr.map;
                    child.material.color.setHex(0xffffff);
                    child.material.roughness = plasterPbr.roughness;
                    child.material.metalness = plasterPbr.metalness;
                    child.material.envMapIntensity = 0.95;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 2. 漏窗镂空花格
                  if (/window|lattice|花格/i.test(combined) || vCount === 158300 || vCount === 23266) {
                    child.material.map = null;
                    child.material.color.setHex(0x282b28);
                    child.material.roughness = 0.65;
                    child.material.metalness = 0.15;
                    child.material.envMapIntensity = 1.05;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 3. 黛瓦屋顶
                  if (/tile|瓦/i.test(combined)) {
                    child.material.map = tilePbr.map;
                    child.material.normalMap = tilePbr.normalMap;
                    child.material.color.setHex(0x323a3d);
                    child.material.roughness = tilePbr.roughness;
                    child.material.metalness = tilePbr.metalness;
                    child.material.envMapIntensity = 1.35;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 4. 花岗岩基座、铺地大砖与柱顶石
                  if (/stone|granite|podium|stair/i.test(combined)) {
                    child.material.map = stonePbr.map;
                    child.material.color.setHex(0xd5d0c6);
                    child.material.roughness = stonePbr.roughness;
                    child.material.metalness = stonePbr.metalness;
                    child.material.envMapIntensity = 1.05;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 5. 回廊檐下椽条、挑檩、立柱、梁架、挂落与倒挂楣子
                  child.material.map = woodPbr.map;
                  child.material.color.setHex(0x3d2418); // 经典江南熟褐桐油木作 (对齐母本)
                  child.material.roughness = 0.56;
                  child.material.metalness = 0.02;
                  child.material.envMapIntensity = 1.15;
                  child.material.needsUpdate = true;
                  return;
                }

                // -----------------------------------------------------------
                // (G) 庭院石景小品与铺地 (props.plazaStone / taihuPeak)
                // -----------------------------------------------------------
                if (nodeName.includes('plazastone')) {
                  child.material.map = stonePbr.map;
                  child.material.color.setHex(0xd6d0c4);
                  child.material.roughness = 0.68;
                  child.material.metalness = 0.02;
                  child.material.envMapIntensity = 1.05;
                  child.material.needsUpdate = true;
                  return;
                }
                if (nodeName.includes('taihu') || nodeName.includes('peak')) {
                  child.material.map = taihuPbr.map;
                  child.material.normalMap = taihuPbr.normalMap;
                  child.material.color.setHex(0xd8d4cb); // 经典太湖石天然冷银灰兼温润古朴微光 (对齐母本 rockery-sdf)
                  child.material.roughness = taihuPbr.roughness;
                  child.material.metalness = taihuPbr.metalness;
                  child.material.envMapIntensity = 1.15;
                  child.material.needsUpdate = true;
                  return;
                }

                // -----------------------------------------------------------
                // (G.5) 室内中堂文人雅集陈设 (Interior Scholar Hall)
                // -----------------------------------------------------------
                if (combined.includes('interior') || /scroll|couplet|zhongtang|screen|curio|luohan|guqin|altar|chair|squaretable|fruit|vase|burner/i.test(combined)) {
                  // 1. 保留宣纸水墨立轴与黑漆对联的原创贴图
                  if (child.material && child.material.map && /scroll|couplet|zhongtang/i.test(combined)) {
                    child.material.roughness = 0.85;
                    child.material.metalness = 0.0;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 2. 水磨金砖/深色楠木地板 (微反光水镜质感)
                  if (/floor|nanmu/i.test(combined)) {
                    child.material.map = woodPbr.map;
                    child.material.color.setHex(0x1e140d);
                    child.material.roughness = 0.32;
                    child.material.metalness = 0.05;
                    child.material.envMapIntensity = 1.25;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 3. 屏风金雕花纹、铜件饰花
                  if (/gold|pearl|gilt|relief|金|panel/i.test(combined)) {
                    child.material.map = null;
                    child.material.color.setHex(0xdca646);
                    child.material.roughness = 0.30;
                    child.material.metalness = 0.85;
                    child.material.envMapIntensity = 1.6;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 4. 黑大漆屏风框料、琴身、联身
                  if (/black|lacquer|漆/i.test(combined)) {
                    child.material.map = null;
                    child.material.color.setHex(0x18181a);
                    child.material.roughness = 0.38;
                    child.material.metalness = 0.05;
                    child.material.envMapIntensity = 1.25;
                    child.material.needsUpdate = true;
                    return;
                  }
                  // 5. 红木桌椅家具 (条案、八仙桌、官帽椅、罗汉床、博古架)
                  child.material.map = woodPbr.map;
                  child.material.color.setHex(0x4a2418); // 经典文人老红木 (对齐母本)
                  child.material.roughness = 0.52;
                  child.material.metalness = 0.02;
                  child.material.envMapIntensity = 1.15;
                  child.material.needsUpdate = true;
                  return;
                }

                // -----------------------------------------------------------
                // (H) 通用材质映射 (黛瓦、粉墙、木构、青石、铁件、金顶)
                // -----------------------------------------------------------
                if (/tile|瓦/i.test(combined)) {
                  child.material.map = tilePbr.map;
                  child.material.normalMap = tilePbr.normalMap;
                  child.material.normalScale = new THREE.Vector2(0.85, 0.85);
                  child.material.color.setHex(0x323a3d);
                  child.material.roughness = tilePbr.roughness;
                  child.material.metalness = tilePbr.metalness;
                  child.material.envMapIntensity = 1.35;
                  child.material.needsUpdate = true;
                } else if (/plaster|white|墙|壁/i.test(combined)) {
                  child.material.map = plasterPbr.map;
                  child.material.color.setHex(0xffffff);
                  child.material.roughnessMap = plasterPbr.roughnessMap;
                  child.material.roughness = plasterPbr.roughness;
                  child.material.metalness = plasterPbr.metalness;
                  child.material.envMapIntensity = 0.95;
                  child.material.needsUpdate = true;
                } else if (/ground|moss|lawn/i.test(combined)) {
                  child.material.map = null;
                  child.material.color.setHex(0x354823);
                  child.material.roughness = 0.94;
                  child.material.metalness = 0.01;
                  child.material.needsUpdate = true;
                } else if (/wood|chestnut|timber|col|beam|rafter|red|lacquer|柱|梁|木/i.test(combined)) {
                  child.material.map = woodPbr.map;
                  child.material.color.setHex(0x3e2418); // 经典熟褐桐油木作
                  child.material.roughness = woodPbr.roughness;
                  child.material.metalness = woodPbr.metalness;
                  child.material.envMapIntensity = 1.15;
                  child.material.needsUpdate = true;
                } else if (/rock|taihu|stone|granite|podium|stair|湖石|峰|台基|阶/i.test(combined)) {
                  child.material.map = stonePbr.map;
                  child.material.color.setHex(0xd5d0c6);
                  child.material.roughness = stonePbr.roughness;
                  child.material.metalness = stonePbr.metalness;
                  child.material.envMapIntensity = 1.05;
                  child.material.needsUpdate = true;
                } else if (/iron|铁|刹/i.test(combined)) {
                  child.material.color.setHex(0x282b2e);
                  child.material.roughness = 0.58;
                  child.material.metalness = 0.65;
                  child.material.envMapIntensity = 1.4;
                  child.material.needsUpdate = true;
                } else if (/gold|pearl|金|珠/i.test(combined)) {
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
            progressTracker[asset.name] = Math.min(0.95, (progressTracker[asset.name] || 0) + 0.15);
          }
          updateCombinedProgress();
        },
        (err) => {
          console.error(`[loader] 加载资产 ${asset.name} 出错:`, err);
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