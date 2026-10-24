import { Engine } from './core/engine.js';
import { setupEnvironment } from './scene/environment.js';
import { createJiangnanWater } from './scene/water.js';
import { createJiangnanFoliage } from './scene/vegetation.js';
import { createJiangnanBananas } from './scene/bananas.js';
import { createJiangnanLotusFlowers } from './scene/lotus-flowers.js';
import { createJiangnanKoi } from './scene/koi.js';
import { createJiangnanTrees } from './scene/trees.js';
import { createJiangnanInterior } from './scene/interior.js';
import { WeatherSystem } from './scene/weather.js';
import { loadGardenAssets } from './scene/loader.js';
import { CameraRig } from './controls/camera-rig.js';
import { HotspotManager } from './scene/hotspots.js';
import { JiangnanAmbience } from './audio/ambience.js';
import { configManager } from './core/config.js';
import { SettingsDrawer } from './ui/settings-drawer.js';

async function bootstrap() {
  console.log('[gusu-garden-web] 正在初始化 Web 交互引擎与全套造园景致...');

  const canvas = document.getElementById('webgl-canvas');
  const engine = new Engine(canvas);
  window.__engine = engine;

  // 1. 设置光照与大气环境
  const envLights = setupEnvironment(engine.scene);

  // 2. 江南天气时序与细雨系统 (晨曦/细雨/晚霞/月夜)
  const weather = new WeatherSystem(engine.scene, engine.camera, envLights);

  // 3. 建立江南荷池单通道水体
  const water = createJiangnanWater(engine.scene);

  // 4. 建立自然草木植被系统 (荷叶、修竹、芭蕉、荷花、古松)
  const foliage = createJiangnanFoliage(engine.scene);
  const flowers = createJiangnanLotusFlowers(engine.scene);
  const bananas = createJiangnanBananas(engine.scene);
  const trees = createJiangnanTrees(engine.scene);

  // 5. 荷池生灵：灵动锦鲤游弋系统
  const koi = createJiangnanKoi(engine.scene);

  // 6. 水榭室内明代文人中堂陈设 (山水大轴、对联、条案桌椅、琴台)
  const interior = createJiangnanInterior(engine.scene);

  // 7. 挂载相机漫游控制器
  const cameraRig = new CameraRig(engine.camera, canvas);

  // 8. 挂载 3D 景致文化标牌与毛玻璃信息卡系统
  const hotspotManager = new HotspotManager(
    engine.scene,
    engine.camera,
    document.body,
    (poi) => {
      cameraRig.flyToTarget(poi.cameraPos, poi.lookTarget, 2000);
    }
  );

  // 9. 程序化环境音效中枢 (Web Audio API)
  const ambience = new JiangnanAmbience();

  // 10. 交互式景致可控配置抽屉
  const settingsDrawer = new SettingsDrawer(document.body);

  // 11. 绑定 UI 交互按钮
  const loadingScreen = document.getElementById('loading-screen');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const fpsVal = document.getElementById('fps-val');
  const drawsVal = document.getElementById('draws-val');
  const trisVal = document.getElementById('tris-val');
  const tourBtns = document.querySelectorAll('.tour-btn');
  const controlsHint = document.getElementById('controls-hint');
  const modeBtn = document.getElementById('mode-btn');
  const modeIcon = document.getElementById('mode-icon');
  const modeLabel = document.getElementById('mode-label');
  const audioBtn = document.getElementById('audio-btn');
  const audioIcon = document.getElementById('audio-icon');
  const configBtn = document.getElementById('config-btn');

  // 配置抽屉开关
  if (configBtn) {
    configBtn.addEventListener('click', () => {
      settingsDrawer.toggle();
    });
  }

  // 移步换景按钮切换
  tourBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (cameraRig.mode !== 'orbit') {
        cameraRig.setMode('orbit');
        modeBtn.classList.remove('active');
        modeIcon.textContent = '🚶';
        modeLabel.textContent = '园林漫步';
        controlsHint.textContent = '鼠标左键拖拽旋转视角 · 滚轮缩放 · 右键平移 · 点击景致标牌探索';
      }
      tourBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const pointIdx = parseInt(btn.getAttribute('data-point'), 10);
      cameraRig.flyTo(pointIdx);
    });
  });

  // 漫步/导览模式切换
  modeBtn.addEventListener('click', () => {
    if (cameraRig.mode === 'orbit') {
      cameraRig.setMode('walk');
      modeBtn.classList.add('active');
      modeIcon.textContent = '👁';
      modeLabel.textContent = '导览视角';
      controlsHint.textContent = '键盘 WASD 自由行走 · 鼠标拖拽环顾四周 · 再次点击切换为导览';
    } else {
      cameraRig.setMode('orbit');
      modeBtn.classList.remove('active');
      modeIcon.textContent = '🚶';
      modeLabel.textContent = '园林漫步';
      controlsHint.textContent = '鼠标左键拖拽旋转视角 · 滚轮缩放 · 右键平移 · 点击景致标牌探索';
    }
  });

  // 音效开关
  audioBtn.addEventListener('click', () => {
    const isPlaying = ambience.toggle();
    if (isPlaying) {
      audioBtn.classList.add('active');
      audioIcon.textContent = '🔊';
    } else {
      audioBtn.classList.remove('active');
      audioIcon.textContent = '🔇';
    }
  });

  // 12. 资产加载引用与实时图层响应中心
  let loadedAssets = {};

  configManager.on('showPagoda', (val) => {
    if (loadedAssets.pagoda) loadedAssets.pagoda.visible = !!val;
  });
  configManager.on('showInterior', (val) => interior.setVisible(!!val));
  configManager.on('showLotus', (val) => foliage.setLotusVisible(!!val));
  configManager.on('showLotusFlowers', (val) => flowers.setVisible(!!val));
  configManager.on('showBamboo', (val) => foliage.setBambooVisible(!!val));
  configManager.on('showBananas', (val) => bananas.setVisible(!!val));
  configManager.on('showTrees', (val) => trees.setVisible(!!val));
  configManager.on('showKoi', (val) => koi.setVisible(!!val));
  configManager.on('showRain', (val) => weather.setRainEnabled(!!val));
  configManager.on('weather', (val) => weather.setWeather(val));

  // 13. 并行加载核心园林与北寺塔资产
  try {
    loadedAssets = await loadGardenAssets(engine.scene, (progress) => {
      const pct = Math.round(progress * 100);
      progressBar.style.width = pct + '%';
      progressText.textContent = `正在装载江南山水景致... ${pct}%`;
    });

    // 根据初始配置应用显示状态
    if (loadedAssets.pagoda) {
      loadedAssets.pagoda.visible = !!configManager.get('showPagoda');
    }
    interior.setVisible(!!configManager.get('showInterior'));
    foliage.setLotusVisible(!!configManager.get('showLotus'));
    flowers.setVisible(!!configManager.get('showLotusFlowers'));
    foliage.setBambooVisible(!!configManager.get('showBamboo'));
    bananas.setVisible(!!configManager.get('showBananas'));
    trees.setVisible(!!configManager.get('showTrees'));
    koi.setVisible(!!configManager.get('showKoi'));
    weather.setWeather(configManager.get('weather') || 'morning');
    weather.setRainEnabled(!!configManager.get('showRain'));

    // 加载完成，平滑隐去水墨开屏界面
    setTimeout(() => {
      loadingScreen.classList.add('fade-out');
      console.log('[gusu-garden-web] 场景与全套素材装载完毕，进入满帧交互！');
    }, 400);

  } catch (err) {
    console.error('[gusu-garden-web] 资产加载异常:', err);
    progressText.textContent = '加载景致时遇到问题，请刷新重试';
    progressText.style.color = '#e06c75';
  }

  // 14. 主渲染时钟与循环
  let lastTime = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);

    const elapsed = now * 0.001;
    const delta = Math.min(0.1, (now - lastTime) * 0.001);
    lastTime = now;

    // 更新水体波动
    water.update(elapsed);

    // 更新竹梢微风摆动
    foliage.update(elapsed);

    // 更新芭蕉叶微风轻颤
    bananas.update(elapsed);

    // 更新锦鲤摆尾游弋
    koi.update(elapsed);

    // 更新天气与细雨下落
    weather.update(delta);

    // 更新相机运镜与控制器
    cameraRig.update(delta);

    // 更新 3D POI 标牌屏幕投影位置
    hotspotManager.update();

    // 渲染一帧
    engine.render();

    // 刷新性能看板 (每500ms一次采样)
    fpsVal.textContent = engine.info.fps;
    drawsVal.textContent = engine.info.drawCalls;
    trisVal.textContent = (engine.info.triangles > 1000) 
      ? (engine.info.triangles / 1000).toFixed(0) + 'k' 
      : engine.info.triangles;
  }

  requestAnimationFrame(tick);
}

// 确保 DOM 准备完毕后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
