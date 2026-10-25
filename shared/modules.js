// ---------------------------------------------------------------------------
// shared/modules.js — 园林模块意图登记表
//
// 描述两套系统共同认知的园林构成要素。
// 规则：
//   - 每个 key 是跨系统统一的模块 ID
//   - src/ 按 srcName 动态 import world/*.js
//   - web/ 按 webKey 映射 config.js 的可见性开关（null 表示该模块 web 侧不单独控制）
//   - 两侧实现方式各自为政，这里只登记"有"还是"没有"
// ---------------------------------------------------------------------------

export const MODULES = {
  terrain:    { srcName: 'terrain',    webKey: null,                label: '地形铺地' },
  pond:       { srcName: 'pond',       webKey: null,                label: '荷池水体' },
  hall:       { srcName: 'hall',       webKey: null,                label: '主厅大木' },
  interior:   { srcName: 'interior',   webKey: 'showInterior',      label: '室内陈设' },
  pagoda:     { srcName: 'pagoda',     webKey: 'showPagoda',        label: '借景北寺塔' },
  bridge:     { srcName: 'bridge',     webKey: null,                label: '小飞虹拱桥' },
  buildings:  { srcName: 'buildings',  webKey: null,                label: '廊道附属建筑' },
  props:      { srcName: 'props',      webKey: null,                label: '庭院石景小品' },
  vegetation: { srcName: 'vegetation', webKey: 'showBamboo',        label: '草木植被' },
  // web 侧独有的可控层（src/ 集成在 pond/vegetation 模块内）
  // lotus:   { srcName: null,          webKey: 'showLotus',         label: '荷叶' },
  // lotusFlowers: { srcName: null,     webKey: 'showLotusFlowers',  label: '荷花' },
  // bananas: { srcName: null,          webKey: 'showBananas',       label: '芭蕉' },
  // trees:   { srcName: null,          webKey: 'showTrees',         label: '古松' },
  // koi:     { srcName: null,          webKey: 'showKoi',           label: '锦鲤' },
};

