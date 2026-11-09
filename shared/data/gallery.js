// ---------------------------------------------------------------------------
// Asset-gallery catalog shared by the offline entry and the web entry.
//
// Data only (P1-P5): no imports, no side effects. Each group owns one item in the
// first version. `offline` and `web` describe how that side builds the item; a
// missing side means the item is not wired on that side yet.
//
// Params are UI schema, not code: kind = 'range' | 'select' | 'toggle'.
// Adding a component = add one entry here + register its builder on each side.
// ---------------------------------------------------------------------------

export const STATUS = {
  REUSE: '可直接拿走',
  ADAPT: '需改造',
  PROJECT: '仅限本项目',
};

export const GALLERY_GROUPS = [
  {
    id: 'roof',
    title: '屋面',
    subtitle: '瓦作 / 起翘',
    item: {
      id: 'roof-tile',
      title: '瓦作屋面',
      status: STATUS.ADAPT,
      note: '离线按参数化歇山轮廓重建；web 直接取 GLB 屋面合并节点（含脊饰）。',
      offline: {
        builder: 'roofTiles',
        params: [
          { key: 'slope', label: '屋面坡度', kind: 'range', min: 0.15, max: 0.75, step: 0.05, value: 0.38 },
          { key: 'up', label: '起翘', kind: 'range', min: 0, max: 1.2, step: 0.05, value: 0.55 },
          { key: 'out', label: '出翘', kind: 'range', min: 0, max: 0.9, step: 0.05, value: 0.35 },
          { key: 'density', label: '瓦垄密度', kind: 'range', min: 0.6, max: 1.6, step: 0.05, value: 1.0 },
        ],
      },
      web: {
        node: 'roof',
        params: [
          { key: 'wireframe', label: '线框', kind: 'toggle', value: false },
        ],
      },
    },
  },
  {
    id: 'bracket',
    title: '斗拱',
    subtitle: '出跳 / 铺作',
    item: {
      id: 'bracket-set',
      title: '柱头铺作',
      status: STATUS.REUSE,
      note: '五踩重栱出两跳，单向 45° 分布；标准清式做法，可单体导出。',
      offline: {
        builder: 'bracketSet',
        params: [
          { key: 'type', label: '形制', kind: 'select', value: 'pillar', options: [['pillar', '柱头科'], ['flat', '平身科'], ['corner', '角科']] },
          { key: 'lat', label: '出跳层数', kind: 'range', min: 1, max: 4, step: 1, value: 2 },
        ],
      },
      web: {
        node: 'bracket',
        params: [
          { key: 'lat', label: '出跳层数', kind: 'range', min: 1, max: 4, step: 1, value: 2 },
        ],
      },
    },
  },
  {
    id: 'ridge',
    title: '脊饰',
    subtitle: '正脊 / 垂脊',
    item: {
      id: 'ridge-orn',
      title: '脊饰构件',
      status: STATUS.REUSE,
      note: '正脊吻兽与垂脊小兽（龙犬狮马）；参数控制小兽数量与吻兽类型。',
      offline: {
        builder: 'ridgeOrn',
        params: [
          { key: 'beastCount', label: '垂脊小兽数', kind: 'range', min: 1, max: 5, step: 1, value: 3 },
          { key: 'wenType', label: '吻兽样式', kind: 'select', value: 'chiwen', options: [['chiwen', '螭吻'], ['taotie', '饕餮']] },
        ],
      },
      web: {
        node: 'ridge',
        params: [
          { key: 'beastCount', label: '垂脊小兽数', kind: 'range', min: 1, max: 5, step: 1, value: 3 },
        ],
      },
    },
  },
  {
    id: 'tree',
    title: '树木',
    subtitle: '乔木 / 冠幅',
    item: {
      id: 'tree-pine',
      title: '乔木',
      status: STATUS.ADAPT,
      note: '离线按分支骨架重建；成片里用几何简化的罗汉松/枫树，带轻微风动。',
      offline: {
        builder: 'treePine',
        params: [
          { key: 'species', label: '树种', kind: 'select', value: 'pine', options: [['pine', '罗汉松'], ['maple', '枫树'], ['willow', '垂柳']] },
          { key: 'crown', label: '冠幅', kind: 'range', min: 1.8, max: 6.0, step: 0.2, value: 3.6 },
          { key: 'sway', label: '风动幅度', kind: 'range', min: 0, max: 0.15, step: 0.01, value: 0.04 },
        ],
      },
      web: {
        node: 'trees',
        params: [
          { key: 'sway', label: '风动幅度', kind: 'range', min: 0, max: 0.15, step: 0.01, value: 0.04 },
        ],
      },
    },
  },
  {
    id: 'rock',
    title: '太湖石',
    subtitle: '峰石 / 透漏',
    item: {
      id: 'rock-taihu',
      title: '太湖石峰',
      status: STATUS.ADAPT,
      note: '离线重建：高分辨率 SDF 网格（0.10 格距）+ Marching Cubes，带石座。web 端因体量大暂仅供缩放浏览。',
      offline: {
        builder: 'taihuPeak',
        degrade: '展示降级：SDF 网格 0.10（成片 0.075）',
        params: [
          { key: 'height', label: '高度', kind: 'range', min: 2.2, max: 5.5, step: 0.1, value: 3.8 },
          { key: 'lean', label: '瘦度', kind: 'range', min: 0, max: 0.7, step: 0.02, value: 0.35 },
          { key: 'seed', label: '孔洞形态', kind: 'range', min: 1, max: 99, step: 1, value: 42 },
          { key: 'pedestal', label: '石座', kind: 'toggle', value: true },
        ],
      },
      web: {
        node: 'taihuPeak',
        params: [
          { key: 'scale', label: '缩放', kind: 'range', min: 0.5, max: 2, step: 0.05, value: 1 },
          { key: 'wireframe', label: '线框', kind: 'toggle', value: false },
        ],
      },
    },
  },
  {
    id: 'corridor',
    title: '游廊',
    subtitle: '直廊 / 曲廊',
    item: {
      id: 'corridor-run',
      title: '游廊',
      status: STATUS.REUSE,
      note: '对照样板：现状=一段直廊（与环池廊同尺寸的做法，坐槛+白墙漏窗）；江南化=沿折线转折、临水侧改美人靠（外挑坐板+鹅颈弧形靠背），首间保留一小段直棂做对照。成片里的环池廊仍按原样，本样板不改动成片。',
      offline: {
        builder: 'corridorRun',
        params: [
          { key: 'form', label: '形制', kind: 'select', value: 'jiangnan', options: [['jiangnan', '江南化（曲廊）'], ['current', '直廊']] },
          { key: 'rail', label: '栏杆样式', kind: 'select', value: 'meirenkao', options: [['zhiling', '直棂'], ['meirenkao', '美人靠']] },
          { key: 'lattice', label: '格心纹样', kind: 'select', value: 'wanzi', options: [['wanzi', '万字纹'], ['binglie', '冰裂纹'], ['zhiling', '直棂']] },
          { key: 'turn', label: '转折角', kind: 'range', min: -45, max: 45, step: 5, value: 30 },
          { key: 'bayLen', label: '段长（开间）', kind: 'range', min: 2.4, max: 4.8, step: 0.1, value: 3.6 },
          { key: 'levels', label: '高差', kind: 'toggle', value: false },
        ],
      },
      web: { node: 'corridor', params: [] },
    },
  },
  {
    id: "meikao",
    title: "美人靠",
    subtitle: "吴王靠 / 鹅颈",
    item: {
      id: "meikao-segment",
      title: "游廊美人靠",
      status: STATUS.REUSE,
      note: "苏州园林实物标准美人靠：外挑140mm鹅颈双曲靠背、119mm腰椎承托、19根圆弧曲档（间距88mm）、3根透光立档与3个短足严格同轴对齐。",
      offline: {
        builder: "meikaoSegment",
        params: [
          { key: "length", label: "开间跨度(mm)", kind: "range", min: 1800, max: 3600, step: 50, value: 3300 },
          { key: "pitch", label: "曲档间距(mm)", kind: "range", min: 70, max: 110, step: 2, value: 88 },
          { key: "wall", label: "基台矮墙", kind: "toggle", value: true },
        ],
      },
      web: {
        node: "corridorBayMeikao",
        params: [],
      },
    },
  },
  {
    id: 'water',
    title: '水面',
    subtitle: '池面 / 倒影',
    item: {
      id: 'water-plane',
      title: '池面水镜',
      status: STATUS.REUSE,
      note: '成片里水面材质为半透明实时折射；展示间里抽离为独立水体平面，带法线扰动与环境反射。',
      offline: {
        builder: 'waterPlane',
        params: [
          { key: 'tint', label: '水色', kind: 'select', value: 'jade', options: [['jade', '碧玉'], ['ink', '墨绿'], ['celadon', '粉青']] },
          { key: 'roughness', label: '糙度', kind: 'range', min: 0.02, max: 0.35, step: 0.01, value: 0.08 },
          { key: 'ripple', label: '波纹幅度', kind: 'range', min: 0.02, max: 0.4, step: 0.02, value: 0.12 },
        ],
      },
      web: {
        node: 'water',
        params: [
          { key: 'roughness', label: '糙度', kind: 'range', min: 0.02, max: 0.35, step: 0.01, value: 0.08 },
        ],
      },
    },
  },
];

export function findItem(id) {
  for (const g of GALLERY_GROUPS) {
    if (g.item.id === id) return { group: g, item: g.item };
  }
  return null;
}
