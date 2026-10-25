// ---------------------------------------------------------------------------
// shared/palette.js — 姑苏园林色谱参考表
//
// 设计意图参考，非强制运行时使用。
// 两侧写材质时打开来看方向，允许因各自光照环境和渲染管线做调整。
// ---------------------------------------------------------------------------

export const PALETTE = {
  // 建筑构件
  plasterWall:  { hex: 0xfcfaf6, roughness: 0.88, note: '江南粉壁，高漫反射石灰' },
  tileRoof:     { hex: 0x323a3d, roughness: 0.76, note: '黛瓦，低光泽细砂陶' },
  redwoodBeam:  { hex: 0x3e2418, roughness: 0.56, note: '熟褐桐油大木构' },
  redwoodDark:  { hex: 0x3a2216, roughness: 0.58, note: '老料梁柱，更深沉' },
  redwoodBright:{ hex: 0x682618, roughness: 0.55, note: '斗栱深朱红大漆' },
  blackLacquer: { hex: 0x18181a, roughness: 0.35, note: '黑大漆饰边' },

  // 石材
  bluestone:    { hex: 0x8a9296, roughness: 0.75, note: '青石台基驳岸' },
  granite:      { hex: 0xb5b0a6, roughness: 0.68, note: '花岗石铺地踏步' },
  taihuRock:    { hex: 0xd8d4cb, roughness: 0.82, note: '太湖石，冷银灰古朴' },
  pondStone:    { hex: 0x8a9296, roughness: 0.82, note: '驳岸水气浸润石' },

  // 金属
  goldCarving:  { hex: 0xdca646, roughness: 0.30, metalness: 0.85, note: '镏金雕花' },
  ironWork:     { hex: 0x282b2e, roughness: 0.58, metalness: 0.65, note: '熟铁饰件' },
  bronzeBell:   { hex: 0x7c6a46, roughness: 0.45, metalness: 0.85, note: '古青铜风铎' },

  // 植被地坪
  mossGround:   { hex: 0x354823, roughness: 0.94, note: '庭院苔藓草坪' },

  // 借景北寺塔专属
  pagodaWall:   { hex: 0xbaa06e, roughness: 0.92, note: '北寺塔赭黄外壁' },
  pagodaSpire:  { hex: 0x242628, roughness: 0.62, metalness: 0.55, note: '铁刹乌黑' },
};

