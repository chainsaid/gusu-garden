// ---------------------------------------------------------------------------
// SITE PLAN — the single source of truth for where everything is.
// Units: metres. +X = east, +Z = south, +Y = up (north is -Z).
// Courtyard ground level y = 0. The sun is low in the WEST-SOUTH-WEST
// (direction toward sun ~ (-0.94, 0.12, 0.34)), so west faces glow and long
// shadows fall toward the east-north-east.
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

  // 主厅 (main hall): 重檐歇山 — a two-tier hip-and-gable roof with 嫩戗发戗
  // upturned corners, a stone podium, plain wooden columns and a stair to the south.
  hall: {
    center: [10, 0, -22],
    facing: [0, 0, 1],            // faces south
    platform: { w: 36, d: 27, h: 1.6 }, // 青石台基 (stone podium); top at y = 1.6
    columns: { w: 26, d: 17, bays: [7, 5], height: 6.4 }, // outer column grid on the podium
    stairs: { width: 10, frontZ: -8.5 }, // main stair descends south to z ~ -8.5 + run
    lowerEaveY: 8.4,              // 下檐 (lower roof) eave height
    mainEaveY: 13.8,              // 上檐 (upper roof) eave height
    ridgeY: 21.5,                 // 正脊 (main ridge) top
    eaveOverhang: 3.6,
  },

  // 借景·北寺塔 (Beisi Pagoda / 报恩寺塔) — borrowed scenery. The tower stands
  // OUTSIDE the garden, ~118 m to the WNW of the hall, on the far side of the wall:
  // it is seen over the tree tops and mirrored in the pond (shot 8).
  // Measured dimensions of the real tower (苏州报恩寺塔):
  //   通高 76 m including the iron 塔刹 (~15.2 m, about 1/5 of the total)
  //   九级八面, 砖身木檐; 基台对边 31.5 m 高 1.25 m
  //   副阶周匝, 平面直径 30 m (对角距) -> 对边距 ~27 m, 占地 878 m2
  //   砖身每面分三间, 当心间辟门; 各层施平座、腰檐, 平座上设擎檐柱
  pagoda: {
    center: [-105, 0, -48],
    platform: { w: 31.5, d: 31.5, h: 1.25 },  // 基台: 对边 31.5 m, 高 1.25 m
    baseWidth: 18,               // 塔身(砖核)第 1 层对边距 18 m -> 内切半径 9 m
    sides: 8,                    // 八角
    storyHeight: 3.9,
    shrink: 0.94,                // 平缓收分: 顶层对边距 ~11 m
    eaveOverhang: 3.6,           // 第 1 层檐 -> 檐口对边距 ~25.8 m / 对角距 ~29 m
    stories: 9,                  // 九级
    spireHeight: 15.2,           // 铁制塔刹 (第八九层立木刹柱 φ0.85 支承)
    totalHeight: 76,
  },

  // Pond: water surface and outline (clockwise polygon in x,z). Shore is stone.
  pond: {
    waterY: -0.55,
    bottomY: -1.7,
    outline: [
      [-23, 7], [-14, 5.5], [-4, 6.5], [4, 7.5], [16, 7.5], [26, 6], [36, 7.5], [43, 11], [45, 18],
      [43, 26], [36, 31], [26, 33.5], [14, 34], [2, 33], [-8, 34.5], [-18, 32], [-25, 26], [-27, 17], [-26, 11],
    ],
    island: [[-6, 18], [-1, 16.5], [3, 19], [1, 23], [-5, 23]], // small rocky island with a pine
  },

  // 青石平拱桥 (stone arch bridge) on the hall axis, crossing the pond south->north
  bridge: {
    south: [10, 0, 27],
    north: [10, 0, 5],
    width: 3.6,
    rise: 1.55,         // deck crown above ground level (平缓拱桥，矢跨比约 1/14)
    posts: 9,           // railing posts per side (莲瓣望柱头 post caps)
  },

  // 石铺甬道 (stone approach: gate -> bridge -> plaza -> hall stairs)
  paths: [
    { from: [10, 46], to: [10, 27], width: 4.0 },
    { from: [10, 5], to: [10, -8.5], width: 5.0 },
    { from: [10, -2], to: [-24, -6], width: 3.0 },   // branch to the borrowed tower
    { from: [10, -2], to: [44, 10], width: 2.6 },    // branch to the pavilion
  ],

  // 石板庭院 (paved courtyard) between hall and pond
  plaza: { minX: -22, maxX: 44, minZ: -9, maxZ: 6 },

  // 水榭 (water pavilion) on the east shore, open on the west side, veranda over water
  pavilion: {
    center: [47, 0, 18],
    facing: [-1, 0, 0],   // opens toward the pond / borrowed tower / sunset
    w: 10, d: 8, floorY: 1.1, eaveY: 4.6,
  },

  // 环池游廊 (enclosing roofed corridor) and the 门楼 (gatehouse) to the south
  corridor: {
    rect: { minX: -52, maxX: 66, minZ: -48, maxZ: 46 },
    width: 4.6, height: 3.4, bay: 3.6,
  },
  gate: { center: [10, 0, 46], facing: [0, 0, 1], w: 12, d: 7, height: 11 },
  bellPavilion: { center: [44, 0, -30], w: 6, d: 6 },   // 钟亭
  sideHalls: [
    { center: [-40, 0, -36], w: 14, d: 9, facing: [1, 0, 0] },  // 西厢厅
    { center: [52, 0, -6], w: 12, d: 8, facing: [-1, 0, 0] },   // 东厢厅
  ],

  // 江南石景小品 — 石笋 / 石鼓墩 / 散置湖石. [x, z, height]
  // (was: stone lanterns (春日灯笼) — a Suzhou garden has none)
  stoneStands: [
    [6, -4, 2.6], [14, -4, 2.6], [6, 2, 2.6], [14, 2, 2.6],       // flanking the plaza axis
    [5.5, 30, 2.4], [14.5, 30, 2.4],                               // south bridge head
    [-25, -1, 2.3], [-25, -15, 2.3], [-39, -1, 2.3],               // around the borrowed tower
    [39, 9, 2.0], [41, 27, 2.1], [-20, 30, 2.0], [28, 4.5, 1.9],   // pond shore
    [-12, 4.2, 1.9], [24, 35.5, 2.0], [-4, 35, 1.8],
  ],

  // Hero trees — type: pine | maple | mapleRed | cherry ; [x, z, height]
  trees: [
    { type: 'pine', at: [-18, 3], h: 7.5 }, { type: 'pine', at: [30, 4], h: 6.5 },
    { type: 'pine', at: [-2, 20], h: 5.5 }, // island
    { type: 'pine', at: [40, 32], h: 7 }, { type: 'pine', at: [-23, 33], h: 6.5 },
    { type: 'pine', at: [-44, 10], h: 11 }, { type: 'pine', at: [-46, -20], h: 12 },
    { type: 'mapleRed', at: [24, -6], h: 6 }, { type: 'mapleRed', at: [-6, -6], h: 5.5 },
    { type: 'mapleRed', at: [36, 34], h: 5 }, { type: 'mapleRed', at: [-14, 36], h: 5.5 },
    { type: 'maple', at: [52, 26], h: 10 },   // big green maple overhanging the pavilion
    { type: 'maple', at: [-20, -22], h: 9 }, { type: 'maple', at: [58, -38], h: 10 },
    { type: 'maple', at: [32, -16], h: 7 }, { type: 'pine', at: [-10, -18], h: 7 },
    { type: 'pine', at: [-46, 30], h: 8 }, { type: 'maple', at: [58, 38], h: 7.5 },
  ],

  // Distant landscape
  mountains: { westRidgeDist: 900, ringRadius: 1400 },
};

export default L;
