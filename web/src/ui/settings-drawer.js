// ---------------------------------------------------------------------------
// settings-drawer.js — 景致与特效交互式配置抽屉组件 (Scene & Effects Drawer)
// 允许游客与开发者即时开关每一个素材图层、选择造园情境预设或切换江南天色。
// ---------------------------------------------------------------------------
import { configManager, PRESETS } from '../core/config.js';

export class SettingsDrawer {
  constructor(domContainer) {
    this.domContainer = domContainer;
    this.isOpen = false;
    this._render();
    this._bindEvents();
  }

  _render() {
    this.drawerEl = document.createElement('div');
    this.drawerEl.className = 'settings-drawer-backdrop hidden';
    this.drawerEl.innerHTML = `
      <div class="settings-drawer-panel">
        <div class="drawer-header">
          <div class="drawer-title">🎛️ 景致与特效配置</div>
          <button class="drawer-close" id="drawer-close-btn">&times;</button>
        </div>
        <div class="drawer-sub">自由控制每一项江南造园素材与动态视觉图层的加载渲染</div>

        <div class="drawer-body">
          <!-- 1. 经典情境一键预设 -->
          <div class="drawer-section">
            <div class="section-title">造园情境一键预设</div>
            <div class="preset-grid">
              <button class="preset-btn active" data-preset="masterpiece">
                <span class="p-name">超清全景</span>
                <span class="p-desc">万千景致尽收眼底</span>
              </button>
              <button class="preset-btn" data-preset="misty">
                <span class="p-name">烟雨江南</span>
                <span class="p-desc">细雨芭蕉、锦鲤水声</span>
              </button>
              <button class="preset-btn" data-preset="literati">
                <span class="p-name">文人雅集</span>
                <span class="p-desc">水榭条案、琴台晚霞</span>
              </button>
              <button class="preset-btn" data-preset="speed">
                <span class="p-name">极简轻量</span>
                <span class="p-desc">纯净建筑与青池</span>
              </button>
            </div>
          </div>

          <!-- 2. 江南天气与时序光影 -->
          <div class="drawer-section">
            <div class="section-title">江南天色与光影</div>
            <div class="weather-selector">
              <button class="weather-btn active" data-weather="morning">晨曦 ☀️</button>
              <button class="weather-btn" data-weather="drizzle">细雨 🌧️</button>
              <button class="weather-btn" data-weather="sunset">晚霞 🌇</button>
              <button class="weather-btn" data-weather="night">月夜 🌙</button>
            </div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">江南细雨粒子</span>
                <span class="t-sub">丝丝落雨与动态倾斜雨线</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-rain">
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- 3. 建筑与陈设图层 -->
          <div class="drawer-section">
            <div class="section-title">建筑与陈设图层</div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">隔池借景北寺塔</span>
                <span class="t-sub">西北方千米开外北宋报恩塔铁刹</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-pagoda" checked>
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">水榭室内明代陈设</span>
                <span class="t-sub">中堂山水长轴、真金对联、翘头条案、琴台</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-interior" checked>
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- 4. 自然生态与草木 -->
          <div class="drawer-section">
            <div class="section-title">自然草木生态</div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">荷塘盛开水芝荷花</span>
                <span class="t-sub">出水红粉重瓣与金黄莲蓬花蕊</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-lotus-flowers" checked>
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">白粉墙下修竹丛</span>
                <span class="t-sub">微风起伏摇曳的青翠竹杆</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-bamboo" checked>
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">苏式雨打芭蕉</span>
                <span class="t-sub">墙角肥厚舒展的大叶芭蕉丛</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-bananas" checked>
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">庭院文人罗汉古松</span>
                <span class="t-sub">苍劲盘曲老干与层叠松针云盘</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-trees" checked>
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- 5. 动态生灵 -->
          <div class="drawer-section">
            <div class="section-title">动态生灵</div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">荷池灵动锦鲤游弋</span>
                <span class="t-sub">红白、黄金流线锦鲤摆尾游动</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-koi" checked>
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- 6. 画质与后处理 -->
          <div class="drawer-section">
            <div class="section-title">画质与胶片光影</div>
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="t-label">电影级胶片光影</span>
                <span class="t-sub">柔和大气泛光、文人胶片色阶与意境暗角</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-post" checked>
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
    this.domContainer.appendChild(this.drawerEl);
  }

  _bindEvents() {
    this.drawerEl.querySelector('#drawer-close-btn').addEventListener('click', () => {
      this.close();
    });

    this.drawerEl.addEventListener('click', (e) => {
      if (e.target === this.drawerEl) this.close();
    });

    // 预设切换
    const presetBtns = this.drawerEl.querySelectorAll('.preset-btn');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        presetBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const pKey = btn.getAttribute('data-preset');
        configManager.applyPreset(pKey);
        this._syncTogglesFromState();
      });
    });

    // 天气切换
    const weatherBtns = this.drawerEl.querySelectorAll('.weather-btn');
    weatherBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        weatherBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const wKey = btn.getAttribute('data-weather');
        configManager.set('weather', wKey);
      });
    });

    // 开关绑定
    const bindToggle = (id, configKey) => {
      const el = this.drawerEl.querySelector(`#${id}`);
      if (!el) return;
      el.addEventListener('change', () => {
        configManager.set(configKey, el.checked);
      });
    };

    bindToggle('toggle-rain', 'showRain');
    bindToggle('toggle-pagoda', 'showPagoda');
    bindToggle('toggle-interior', 'showInterior');
    bindToggle('toggle-lotus-flowers', 'showLotusFlowers');
    bindToggle('toggle-bamboo', 'showBamboo');
    bindToggle('toggle-bananas', 'showBananas');
    bindToggle('toggle-trees', 'showTrees');
    bindToggle('toggle-koi', 'showKoi');
    bindToggle('toggle-post', 'postProcessing');

    // 监听外部配置变动并同步 UI
    configManager.on('*', () => {
      this._syncTogglesFromState();
    });

    this._syncTogglesFromState();
  }

  _syncTogglesFromState() {
    const setChecked = (id, key) => {
      const el = this.drawerEl.querySelector(`#${id}`);
      if (el) el.checked = !!configManager.get(key);
    };

    setChecked('toggle-rain', 'showRain');
    setChecked('toggle-pagoda', 'showPagoda');
    setChecked('toggle-interior', 'showInterior');
    setChecked('toggle-lotus-flowers', 'showLotusFlowers');
    setChecked('toggle-bamboo', 'showBamboo');
    setChecked('toggle-bananas', 'showBananas');
    setChecked('toggle-trees', 'showTrees');
    setChecked('toggle-koi', 'showKoi');
    setChecked('toggle-post', 'postProcessing');

    // 天气按钮高亮
    const curW = configManager.get('weather') || 'morning';
    const wBtns = this.drawerEl.querySelectorAll('.weather-btn');
    wBtns.forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-weather') === curW);
    });
  }

  open() {
    this.isOpen = true;
    this.drawerEl.classList.remove('hidden');
    this._syncTogglesFromState();
  }

  close() {
    this.isOpen = false;
    this.drawerEl.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}

