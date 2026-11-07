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
      note: '离线用 genTiered；web 复用同一生成器，下一批接入。',
      offline: null,
      web: null,
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
    id: 'water',
    title: '水面',
    subtitle: '池面 / 倒影',
    item: {
      id: 'pond-water',
      title: '池面水镜',
      status: STATUS.PROJECT,
      note: '绑定本园池体与相机反射，仅限本项目，下一批接入。',
      offline: null,
      web: null,
    },
  },
];

export function findItem(id) {
  for (const g of GALLERY_GROUPS) {
    if (g.item.id === id) return { group: g, item: g.item };
  }
  return null;
}
