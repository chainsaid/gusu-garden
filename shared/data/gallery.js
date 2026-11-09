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
      web: { node: 'hall:hallTile+ao', params: [] },
    },
  },
  {
    id: 'bracket',
    title: '斗拱',
    subtitle: '出跳 / 铺作',
    item: {
      id: 'bracket-set',
      title: '柱头铺作',
      status: STATUS.ADAPT,
      note: '离线按柱头局部坐标重建；web 直接取 GLB 节点。',
      offline: {
        builder: 'bracketSet',
        params: [
          { key: 'type', label: '出跳制', kind: 'select', value: 'qimai', options: [['qimai', '七踩'], ['sanmai', '三踩'], ['flat', '不出跳']] },
          { key: 'lat', label: '横向臂长', kind: 'range', min: 0.4, max: 0.9, step: 0.05, value: 0.62 },
        ],
      },
      web: {
        node: 'hall:hallBracket',
        params: [
          { key: 'explode', label: '拆解', kind: 'range', min: 0, max: 1.2, step: 0.05, value: 0 },
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
      status: STATUS.ADAPT,
      note: '离线按正脊段 + 两端螭吻重建；web 无独立节点。',
      offline: {
        builder: 'ridgeOrn',
        params: [
          { key: 'length', label: '正脊长度', kind: 'range', min: 1.5, max: 4.5, step: 0.1, value: 2.6 },
          { key: 'layers', label: '叠瓦层数', kind: 'range', min: 3, max: 7, step: 1, value: 5 },
          { key: 'width', label: '脊身宽', kind: 'range', min: 0.4, max: 0.9, step: 0.02, value: 0.62 },
          { key: 'beast', label: '吻兽大小', kind: 'range', min: 0.7, max: 1.6, step: 0.05, value: 1.0 },
        ],
      },
      web: null,
      webBlocked: 'GLB 里脊饰与屋面合并在同一节点，没有可独立取出的网格；请对照离线版。',
    },
  },
  {
    id: 'tree',
    title: '树木',
    subtitle: '乔木 / 冠幅',
    item: {
      id: 'tree-maple',
      title: '乔木',
      status: STATUS.REUSE,
      note: '离线用枫树生成器（降级叶团）；web 的 GLB 未导出植被。',
      offline: {
        builder: 'treeMaple',
        degrade: '展示降级：实例化叶团替代叶片卡片（成片用叶片着色）',
        params: [
          { key: 'height', label: '树高', kind: 'range', min: 4.5, max: 8, step: 0.1, value: 6.0 },
          { key: 'leaders', label: '主分叉', kind: 'range', min: 2, max: 5, step: 1, value: 3 },
          { key: 'spread', label: '冠幅', kind: 'range', min: 0.45, max: 0.85, step: 0.02, value: 0.66 },
          { key: 'autumn', label: '秋色', kind: 'range', min: 0, max: 1, step: 0.05, value: 0.6 },
        ],
      },
      web: null,
      webBlocked: 'GLB 没有导出植被，成片里的树由运行时 Instanced 生成；请对照离线生成器。',
    },
  },
  {
    id: 'rockery',
    title: '太湖石',
    subtitle: '峰石 / 透漏',
    item: {
      id: 'taihu-peak',
      title: '太湖石峰',
      status: STATUS.REUSE,
      note: '离线是 SDF 生成器；web 取 GLB 中的 taihuPeak 节点。',
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
      status: STATUS.ADAPT,
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
      id: 'pond-water',
      title: '池面水镜',
      status: STATUS.PROJECT,
      note: '离线只用一块平面做材质演示；完整水体绑定池体与反射，仅限本项目。',
      offline: {
        builder: 'waterPlane',
        degrade: '展示降级：单平面 + 程序化法线，无实时倒影（成片含池体反射）',
        params: [
          { key: 'tint', label: '水色', kind: 'select', value: 'jade', options: [['jade', '碧水'], ['ink', '墨绿'], ['celadon', '浅青']] },
          { key: 'ripple', label: '波光', kind: 'range', min: 0, max: 1, step: 0.05, value: 0.55 },
          { key: 'roughness', label: '粗糙度', kind: 'range', min: 0.05, max: 0.4, step: 0.01, value: 0.14 },
        ],
      },
      web: null,
      webBlocked: 'GLB 未包含水面，水在成片里是绑定池体的着色器平面；请对照离线材质演示。',
    },
  },
];

export function findItem(id) {
  for (const g of GALLERY_GROUPS) {
    if (g.item.id === id) return { group: g, item: g.item };
  }
  return null;
}
