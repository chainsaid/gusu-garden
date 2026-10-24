// ---------------------------------------------------------------------------
// config.js — 全局景致素材与特效可控配置中心 (Scene Layers & Effects Config)
// 允许用户、开发者与前端容器自由控制每一个造园素材与特效的加载与渲染。
// 支持 URL 查询参数深度透传 (如 ?preset=misty 或 ?koi=0&rain=1)
// ---------------------------------------------------------------------------

export const SCENE_CONFIG = {
  // 建筑与借景
  showPagoda: true,        // 隔池借景北寺塔
  showInterior: true,      // 水榭室内明代文人中堂陈设
  // 植被草木
  showLotus: true,         // 荷塘绿荷叶
  showLotusFlowers: true,  // 荷塘盛开粉红荷花
  showBamboo: true,        // 白粉墙下修竹丛
  showBananas: true,       // 庭院白粉墙角苏式雨打芭蕉
  showTrees: true,         // 庭院文人罗汉古松
  // 动态生灵
  showKoi: true,           // 荷池灵动锦鲤游弋
  // 天气与时序光影
  weather: 'morning',      // 'morning' | 'drizzle' | 'sunset' | 'night'
  showRain: false,         // 江南细雨粒子与涟漪
  // 听觉中枢
  audioEnabled: false,     // 程序化琴韵水声
};

// 4 大经典造园情境预设 (One-Click Curated Presets)
export const PRESETS = {
  masterpiece: {
    name: '超清全景',
    desc: '全开所有素材与动态生灵，呈现万千气象',
    config: {
      showPagoda: true, showInterior: true, showLotus: true, showLotusFlowers: true,
      showBamboo: true, showBananas: true, showTrees: true, showKoi: true,
      weather: 'morning', showRain: false,
    }
  },
  misty: {
    name: '烟雨江南',
    desc: '细雨霏霏，荷塘微澜，雨打芭蕉与锦鲤戏水',
    config: {
      showPagoda: true, showInterior: false, showLotus: true, showLotusFlowers: true,
      showBamboo: true, showBananas: true, showTrees: true, showKoi: true,
      weather: 'drizzle', showRain: true,
    }
  },
  literati: {
    name: '文人雅集',
    desc: '水榭主殿、中堂对联、七弦琴台与修竹古松',
    config: {
      showPagoda: true, showInterior: true, showLotus: true, showLotusFlowers: false,
      showBamboo: true, showBananas: true, showTrees: true, showKoi: false,
      weather: 'sunset', showRain: false,
    }
  },
  speed: {
    name: '极简轻量',
    desc: '仅保留核心建筑与单通水体，极致轻盈畅享',
    config: {
      showPagoda: false, showInterior: false, showLotus: true, showLotusFlowers: false,
      showBamboo: false, showBananas: false, showTrees: false, showKoi: false,
      weather: 'morning', showRain: false,
    }
  }
};

class ConfigManager {
  constructor() {
    this.state = { ...SCENE_CONFIG };
    this.listeners = new Map();

    // 从 URL 参数与 LocalStorage 解析初始覆盖
    this._parseURLParams();
  }

  _parseURLParams() {
    if (typeof location === 'undefined') return;
    const q = new URLSearchParams(location.search);

    // 检查预设
    const presetKey = q.get('preset');
    if (presetKey && PRESETS[presetKey]) {
      Object.assign(this.state, PRESETS[presetKey].config);
    }

    // 逐项细粒度参数透传
    if (q.has('pagoda')) this.state.showPagoda = q.get('pagoda') === '1' || q.get('pagoda') === 'true';
    if (q.has('interior')) this.state.showInterior = q.get('interior') === '1' || q.get('interior') === 'true';
    if (q.has('lotus')) this.state.showLotus = q.get('lotus') === '1' || q.get('lotus') === 'true';
    if (q.has('lotusFlowers')) this.state.showLotusFlowers = q.get('lotusFlowers') === '1' || q.get('lotusFlowers') === 'true';
    if (q.has('bamboo')) this.state.showBamboo = q.get('bamboo') === '1' || q.get('bamboo') === 'true';
    if (q.has('bananas')) this.state.showBananas = q.get('bananas') === '1' || q.get('bananas') === 'true';
    if (q.has('trees')) this.state.showTrees = q.get('trees') === '1' || q.get('trees') === 'true';
    if (q.has('koi')) this.state.showKoi = q.get('koi') === '1' || q.get('koi') === 'true';
    if (q.has('weather')) this.state.weather = q.get('weather');
    if (q.has('rain')) this.state.showRain = q.get('rain') === '1' || q.get('rain') === 'true';
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    if (this.state[key] === value) return;
    this.state[key] = value;
    this._emit(key, value);
  }

  applyPreset(presetKey) {
    const p = PRESETS[presetKey];
    if (!p) return;
    for (const [key, val] of Object.entries(p.config)) {
      this.set(key, val);
    }
    this._emit('preset', presetKey);
  }

  on(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(callback);
  }

  _emit(key, value) {
    const cbs = this.listeners.get(key);
    if (cbs) cbs.forEach((cb) => cb(value, this.state));
    const allCbs = this.listeners.get('*');
    if (allCbs) allCbs.forEach((cb) => cb(key, value, this.state));
  }
}

export const configManager = new ConfigManager();

