// ---------------------------------------------------------------------------
// SITE PLAN — the single source of truth for where everything is.
// 这是编辑坐标/形状的唯一入口；shared/layout.js 和 web/ 均从这里 re-export。
//
// Units: metres. +X = east, +Z = south, +Y = up (north is -Z).
// Courtyard ground level y = 0. The sun is low in the WEST-SOUTH-WEST
// (direction toward sun ~ (-0.94, 0.12, 0.34)).
//
//              N (-Z)
//   z=-48  ┌──────────── 北廊 (north corridor) ─────────────┐
//          │        ┌─────────────────┐               │
//          │        │   主厅 (faces south)  │  钟亭    │
//          │        │  重檐歇山          │(44,-30)   │
//   z=-9   │        └──────┬┬┬────────┘               │
//          │   石板庭院 (stone stands, gravel)  east   │
//   z=6    │  ~~~~~~~~~~~~ 荷池 (pond) ~~~~~~~~~~~ 水榭  │
//          │  ~~~~ 莲花 ~~~ 石桥 ~~~ 莲花 ~~~~(47,18)    │
//   z=34   │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~        │
//          │        garden                            │
//   z=46   └──────────── 砖雕门楼 (10,46) ─────────────┘
//      x=-52                 x=10                   x=66
// ---------------------------------------------------------------------------

export const L = {
  groundY: 0,

  // ── 主厅 (main hall) ─────────────────────────────────────────────────────
  // 重檐歇山，嫩戗发戗，青石台基，南向正门
  hall: {
    center:    [10, 0, -22],
    facing:    [0, 0, 1],             // 南向
    platform:  { w: 36, d: 27, h: 1.6 },
    columns:   { w: 26, d: 17, bays: [7, 5], height: 6.4 },
    stairs:    { width: 10, frontZ: -8.5 },
    lowerEaveY: 8.4,
    mainEaveY:  13.8,
    ridgeY:     21.5,
    eaveOverhang: 3.6,
  },

  // ── 借景·北寺塔 (Beisi Pagoda) ───────────────────────────────────────────
  // 苏州报恩寺塔，九级八面，通高 76 m，园外西北约 118 m
  pagoda: {
    center:       [-105, 0, -48],
    platform:     { w: 31.5, d: 31.5, h: 1.25 },
    baseWidth:    18,
    sides:        8,
    storyHeight:  3.9,
    shrink:       0.94,
    eaveOverhang: 2.15,
    stories:      9,
    spireHeight:  15.2,
    totalHeight:  76,
  },

  // ── 荷池 (pond) ──────────────────────────────────────────────────────────
  // 布局层提供：水位、池底、水岸多边形、岛屿、轮廓重心
  // 构型层各自决定：src/ 用 SDF 雕刻，web/ 用 ShapeGeometry + Reflector
  pond: {
    waterY:  -0.55,
    bottomY: -1.70,
    // outline 重心，供 web/ 快速定位用（无需重新计算多边形重心）
    center:  [10, 0, 20],
    // 水岸线多边形，顺时针，x/z 平面坐标
    outline: [
      [-23, 7], [-14, 5.5], [-4, 6.5], [4, 7.5], [16, 7.5],
      [26, 6], [36, 7.5], [43, 11], [45, 18],
      [43, 26], [36, 31], [26, 33.5], [14, 34], [2, 33],
      [-8, 34.5], [-18, 32], [-25, 26], [-27, 17], [-26, 11],
    ],
    island: [[-6, 18], [-1, 16.5], [3, 19], [1, 23], [-5, 23]],
  },

  // ── 小飞虹拱桥 (stone arch bridge) ──────────────────────────────────────
  bridge: {
    south: [10, 0, 27],
    north: [10, 0, 5],
    width: 3.6,
    rise:  1.55,
    posts: 9,
  },

  // ── 石铺甬道 (stone paths) ───────────────────────────────────────────────
  paths: [
    { from: [10, 46],  to: [10, 27],   width: 4.0 },
    { from: [10,  5],  to: [10, -8.5], width: 5.0 },
    { from: [10, -2],  to: [-24, -6],  width: 3.0 },
    { from: [10, -2],  to: [44, 10],   width: 2.6 },
  ],

  // ── 石板庭院 (paved plaza) ───────────────────────────────────────────────
  plaza: { minX: -22, maxX: 44, minZ: -9, maxZ: 6 },

  // ── 水榭 (water pavilion) ────────────────────────────────────────────────
  pavilion: {
    center: [47, 0, 18],
    facing: [-1, 0, 0],
    w: 10, d: 8, floorY: 1.1, eaveY: 4.6,
  },

  // ── 环池游廊 & 门楼 (corridor & gatehouse) ──────────────────────────────
  corridor: {
    rect:   { minX: -52, maxX: 66, minZ: -48, maxZ: 46 },
    width:  4.6,
    height: 3.4,
    bay:    3.6,
  },
  gate:         { center: [10, 0, 46], facing: [0, 0, 1], w: 12, d: 7, height: 11 },
  bellPavilion: { center: [44, 0, -30], w: 6, d: 6 },
  sideHalls: [
    { center: [-40, 0, -36], w: 14, d: 9, facing: [1, 0, 0] },
    { center: [52,  0,  -6], w: 12, d: 8, facing: [-1, 0, 0] },
  ],

  // ── 石景小品 (stone stands / taihu rocks) ───────────────────────────────
  stoneStands: [
    [6, -4, 2.6], [14, -4, 2.6], [6, 2, 2.6], [14, 2, 2.6],
    [5.5, 30, 2.4], [14.5, 30, 2.4],
    [-25, -1, 2.3], [-25, -15, 2.3], [-39, -1, 2.3],
    [39, 9, 2.0], [41, 27, 2.1], [-20, 30, 2.0], [28, 4.5, 1.9],
    [-12, 4.2, 1.9], [24, 35.5, 2.0], [-4, 35, 1.8],
  ],

  // ── 名木古树 (hero trees) ────────────────────────────────────────────────
  trees: [
    { type: 'pine',     at: [-18,  3], h: 7.5 },
    { type: 'pine',     at: [ 30,  4], h: 6.5 },
    { type: 'pine',     at: [ -2, 20], h: 5.5 },
    { type: 'pine',     at: [ 40, 32], h: 7.0 },
    { type: 'pine',     at: [-23, 33], h: 6.5 },
    { type: 'pine',     at: [-44, 10], h: 11.0 },
    { type: 'pine',     at: [-46,-20], h: 12.0 },
    { type: 'mapleRed', at: [ 24, -6], h: 6.0 },
    { type: 'mapleRed', at: [ -6, -6], h: 5.5 },
    { type: 'mapleRed', at: [ 36, 34], h: 5.0 },
    { type: 'mapleRed', at: [-14, 36], h: 5.5 },
    { type: 'maple',    at: [ 52, 26], h: 10.0 },
    { type: 'maple',    at: [-20,-22], h: 9.0 },
    { type: 'maple',    at: [ 58,-38], h: 10.0 },
    { type: 'maple',    at: [ 32,-16], h: 7.0 },
    { type: 'pine',     at: [-10,-18], h: 7.0 },
    { type: 'pine',     at: [-46, 30], h: 8.0 },
    { type: 'maple',    at: [ 58, 38], h: 7.5 },
  ],

  // ── 雨打芭蕉 (plantain / bananas) ─────────────────────────────────────────
  // [x, z, count, scale]
  bananas: [
    { x: 18,   z: -45.5, count: 4, scale: 1.1 },
    { x: -16,  z: -45.5, count: 3, scale: 0.95 },
    { x: 44,   z: 24.5,  count: 5, scale: 1.2 },
    { x: 52,   z: 12.0,  count: 4, scale: 1.0 },
    { x: 26,   z: -10.5, count: 3, scale: 1.05 },
    { x: -6,   z: -10.5, count: 3, scale: 1.0 },
    { x: -3.5, z: 19.5,  count: 3, scale: 0.9 }, // 礁石小岛
  ],

  // ── 远景 (distant landscape) ────────────────────────────────────────────
  mountains: { westRidgeDist: 900, ringRadius: 1400 },
};

export default L;

