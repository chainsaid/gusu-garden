/**
 * 挂落 H10 — 独立三维几何模块
 * 母本：四时潇洒亭 月洞门挂落1（建施20 P22，1:10）
 *
 * 单文件 ES module，不 import 任何东西，也不依赖项目内的 ctx / env / 材质库 / placement。
 * 只接收一个 THREE 与一个参数对象，返回 THREE.Group。
 *
 * 单位：毫米（mm）
 * 原点：整件包围盒中心（X 左右居中、Y 上下居中、Z 进出居中）
 * 朝向：Y 向上，正面朝 +Z，X 向右
 *
 * 用法：
 *   import { createGualuo } from './gualuo-h10.js';
 *   scene.add(createGualuo(THREE));                                   // 默认 H10：净跨 3300、总高 527.6
 *   scene.add(createGualuo(THREE, { span: 2600 }));                    // 只改净跨，其余按 H10 比例
 *   scene.add(createGualuo(THREE, { stile: { w: 50, d: 70 },           // 梃截面
 *                                  core:  { w: 18, d: 34 },            // 格心截面
 *                                  cols: 11, rows: 4,                 // 回纹格数
 *                                  material: new THREE.MeshPhysicalMaterial() }));
 *
 * 纹样：H10 量取的 26 根竖料 + 22 根横料 + 1 根跨轴竖料，坐标存成“格”（第几列/第几行 + 半个料厚的偏移），
 * 因此 cols/rows/截面改动后纹样随格距重排；横竖料在交口处按整料并集，自动补回 15×15 的交叉格。
 */

export const H10 = {
  span: 3300,                 // 净跨（含两侧梃外皮）
  height: 527.6,              // 上枋顶到收头底
  stile: { w: 41.4, d: 62.1 },// 梃截面：面宽 × 进深
  core: { w: 15.5, d: 31.0 }, // 格心截面（芯子）：面宽 × 进深
  cols: 13,                   // 半跨回纹竖格数（第 13 格即对称轴）
  rows: 5,                    // 回纹横格数
  mirror: true,               // 是否按 x → 总长 − x 补全另一半
  material: null,             // 可传入 THREE.Material，两件共用
};

// 图面基准（未缩放，单位 mm）：总长 3190、总高 510、上枋 40、格心区 350、收头 120
const DRAW = { full: 3190, half: 1595, height: 510, head: 40, rowZone: 350 };
// 纹样数据自带的格数（GRID_V / GRID_H 的列号、行号都落在这些格上）；
// 外部改 cols / rows 时按比例重映射，纹样不会被甩出净跨
const PAT = { cols: 13, rows: 5 };

// 纹样网格：竖料 [列, [行, 偏移], [行, 偏移]]；横料 [行, [列, 偏移], [列, 偏移]]
// 偏移以“料厚”为单位：竖料的行偏移 0 / −1；横料的列偏移 −0.5 / 0 / +0.5
const GRID_V = [
  [1, [0, 0], [2, 0]], [1, [3, 0], [4, 0]],
  [2, [1, -1], [2, -1]], [2, [2, 0], [3, 0]], [2, [4, 0], [5, -1]],
  [3, [0, 0], [1, -1]], [3, [1, 0], [2, -1]], [3, [2, 0], [4, -1]], [3, [4, 0], [5, 0]],
  [4, [1, -1], [2, -1]], [4, [2, 0], [3, 0]],
  [5, [1, -1], [2, 0]], [5, [3, 0], [4, 0]],
  [6, [0, 0], [1, -1]], [6, [1, 0], [3, -1]],
  [7, [1, -1], [2, 0]],
  [8, [1, -1], [2, -1]], [8, [2, 0], [3, 0]],
  [9, [0, 0], [1, -1]], [9, [2, -1], [3, 0]],
  [10, [0, 0], [1, -1]], [10, [1, 0], [3, -1]],
  [11, [1, -1], [2, 0]], [11, [3, 0], [4, 0]],
  [12, [0, 0], [1, 0]], [12, [2, 0], [3, 0]],
];

const GRID_H = [
  [1, [0, 0], [1, -0.5]], [1, [2, -0.5], [3, -0.5]], [1, [3, 0.5], [4, 0.5]],
  [1, [5, -0.5], [6, -0.5]], [1, [6, 0.5], [7, 0.5]], [1, [8, -0.5], [10, -0.5]],
  [1, [10, 0.5], [11, 0.5]], [1, [12, -0.5], [13, 0]],
  [2, [1, -0.5], [2, -0.5]], [2, [2, 0.5], [3, -0.5]], [2, [3, 0.5], [4, 0]],
  [2, [4, 0.5], [5, 0.5]], [2, [7, -0.5], [8, -0.5]], [2, [8, 0.5], [9, 0.5]],
  [2, [11, -0.5], [13, 0]],
  [3, [0, 0], [2, 0.5]], [3, [4, 0], [8, 0.5]], [3, [9, -0.5], [12, 0.5]],
  [4, [1, -0.5], [3, -0.5]], [4, [3, 0.5], [5, 0.5]], [4, [11, -0.5], [13, 0]],
  [5, [0, 0], [3, 0.5]],
];

/** 纹样网格数据（供外部复用，纯数据） */
export const H10_PATTERN = { v: GRID_V, h: GRID_H, axis: [13, [0, 0], [4, -1]] };

/**
 * 生成二维构件表（单位 mm，未做并集），供三维挤出或任何二维用途。
 * @param {object} options 见 H10
 * @returns {{params, size, members, spans}}
 */
export function buildLayout(options = {}) {
  const p = {
    ...H10,
    ...options,
    stile: { ...H10.stile, ...(options.stile || {}) },
    core: { ...H10.core, ...(options.core || {}) },
  };
  const kx = p.span / DRAW.full;          // 横向缩放（H10：1.034483）
  const ky = p.height / DRAW.height;      // 竖向缩放
  const stileW = p.stile.w / kx;          // 回到图面 mm 参与排版
  const coreW = p.core.w / kx;
  const colPitch = (DRAW.half - stileW) / p.cols;
  const rowPitch = DRAW.rowZone / p.rows;
  // 列/行号按纹样自带格数归一，再按外部 cols / rows 放大（默认两者相同，结果与 H10 原样一致）
  const px = (col, off) => stileW + (col / PAT.cols) * (DRAW.half - stileW) + off * coreW;
  const py = (row, off) => DRAW.head + (row / PAT.rows) * DRAW.rowZone + off * coreW;

  const half = DRAW.half;
  const raw = [];   // 图面 mm 构件：{ kind, rect:[x0,y0,x1,y1], depth }
  const push = (kind, rect, depth) => raw.push({ kind, rect, depth });
  const pushMirror = (kind, rect, depth) => {
    push(kind, rect, depth);
    if (p.mirror) push(kind, [2 * half - rect[2], rect[1], 2 * half - rect[0], rect[3]], depth);
  };

  // 竖向料：中心线 ± 半个料厚
  for (const [col, a, b] of GRID_V) {
    const xc = px(col, 0);
    pushMirror('芯子', [xc - coreW / 2, py(a[0], a[1]), xc + coreW / 2, py(b[0], b[1])], 'core');
  }
  // 跨对称轴的竖料：图上只画 7.5 宽半边，这里按 15 宽整料、不再镜像
  {
    const [col, a, b] = H10_PATTERN.axis;
    const xc = px(col, 0);
    push('芯子', [xc - coreW / 2, py(a[0], a[1]), xc + coreW / 2, py(b[0], b[1])], 'core');
  }
  // 横向料：行线上沿 −15 … 行线
  for (const [row, a, b] of GRID_H) {
    pushMirror('芯子', [px(a[0], a[1]), py(row, -1), px(b[0], b[1]), py(row, 0)], 'core');
  }

  // 结构性构件（梃 / 上枋 / 收头），图面 mm
  pushMirror('上枋', [0, 0, half, DRAW.head], 'stile');
  pushMirror('梃', [0, DRAW.head, stileW, 444], 'stile');
  for (const [y0, w, y1] of [[444, 33, 450], [450, 31, 456], [456, 33, 467], [467, 16, 510]]) {
    pushMirror('收头', [0, y0, w, y1], 'stile');
  }

  // 交叉口补料：横料在竖料处、竖料在横料处都被图上的白填充切断，交口留 15×15 的空格；
  // 同一块木头，这里按 v.x × h.y 的整格补回（并集后才不会漏底）。
  const vRects = raw.filter((m) => m.kind === '芯子' && (m.rect[2] - m.rect[0]) < (m.rect[3] - m.rect[1])).map((m) => m.rect);
  const hRects = raw.filter((m) => m.kind === '芯子' && (m.rect[2] - m.rect[0]) >= (m.rect[3] - m.rect[1])).map((m) => m.rect);
  const seen = new Set();
  for (const v of vRects) for (const h of hRects) {
    if (Math.max(v[0], h[0]) > Math.min(v[2], h[2]) + 0.5) continue;
    if (Math.max(v[1], h[1]) > Math.min(v[3], h[3]) + 0.5) continue;
    const cell = [v[0], h[1], v[2], h[3]];
    const key = cell.map((n) => n.toFixed(2)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push({ kind: '交叉口', rect: cell, depth: 'core' });
  }

  // 换算到最终 mm
  const members = raw.map((m) => ({
    kind: m.kind,
    rect: [m.rect[0] * kx, m.rect[1] * ky, m.rect[2] * kx, m.rect[3] * ky],
    depth: m.depth === 'core' ? [0, p.core.d] : [0, p.stile.d],
  }));

  return {
    params: p,
    size: { span: p.span, height: p.height, depth: p.stile.d },
    members,
    spans: { kx, ky, stileW, coreW, colPitch, rowPitch },
  };
}

/**
 * 生成挂落三维实体（两件：梃/上枋/收头 与 格心）。
 * 每件都在 XY 平面做矩形并集的格子分解，再沿 Z 挤出，因此没有内部面、没有共面重叠，
 * 交叉口是同一块实体。
 * @param {object} THREE three 命名空间
 * @param {object} options 见 H10
 * @returns {THREE.Group}
 */
export function createGualuo(THREE, options = {}) {
  const layout = buildLayout(options);
  const { span, height, depth } = layout.size;
  const halfSpan = span / 2, halfH = height / 2, halfD = depth / 2;
  const X = (x) => x - halfSpan;
  const Y = (y) => halfH - y;
  const Z = (z) => z - halfD;

  const group = new THREE.Group();
  group.name = 'gualuo-h10';

  const mat = options.material || new THREE.MeshStandardMaterial({
    color: 0xdfd8c8, roughness: 0.62, metalness: 0.02,
  });

  let triangles = 0;
  for (const [name, z0, z1] of [['structural', 0, depth], ['core', 0, layout.params.core.d]]) {
    const rects = layout.members.filter((m) => (m.depth[1] === depth) === (name === 'structural')).map((m) => m.rect);
    if (!rects.length) continue;
    const geo = solidFromRects(THREE, rects, z0, z1, { X, Y, Z });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    triangles += geo.getAttribute('position').count / 3;
  }

  group.userData.meta = {
    units: 'mm',
    up: 'Y',
    front: '+Z',
    origin: 'bbox-center',
    size: layout.size,
    triangles,
    params: layout.params,
    members: layout.members.length,
  };
  return group;
}

// 把一组轴对齐矩形做并集，再沿 Z 挤出成闭合实体（格子分解，无内部面）
function solidFromRects(THREE, rects, z0, z1, T) {
  const xs = [...new Set(rects.flatMap((r) => [+r[0].toFixed(4), +r[2].toFixed(4)]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [+r[1].toFixed(4), +r[3].toFixed(4)]))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1;
  if (nx <= 0 || ny <= 0) return new THREE.BufferGeometry();

  const cov = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      cov[j * nx + i] = rects.some((r) => cx >= r[0] && cx <= r[2] && cy >= r[1] && cy <= r[3]) ? 1 : 0;
    }
  }

  const pos = [];
  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const at = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny ? cov[j * nx + i] : 0);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!cov[j * nx + i]) continue;
      const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
      // 正面（+Z）
      quad([T.X(x0), T.Y(y0), T.Z(z1)], [T.X(x0), T.Y(y1), T.Z(z1)],
           [T.X(x1), T.Y(y1), T.Z(z1)], [T.X(x1), T.Y(y0), T.Z(z1)]);
      // 背面（−Z）
      quad([T.X(x0), T.Y(y0), T.Z(z0)], [T.X(x1), T.Y(y0), T.Z(z0)],
           [T.X(x1), T.Y(y1), T.Z(z0)], [T.X(x0), T.Y(y1), T.Z(z0)]);
      // 只在并集边界出侧面
      if (!at(i + 1, j)) quad([T.X(x1), T.Y(y0), T.Z(z0)], [T.X(x1), T.Y(y0), T.Z(z1)],
                              [T.X(x1), T.Y(y1), T.Z(z1)], [T.X(x1), T.Y(y1), T.Z(z0)]);
      if (!at(i - 1, j)) quad([T.X(x0), T.Y(y0), T.Z(z0)], [T.X(x0), T.Y(y1), T.Z(z0)],
                              [T.X(x0), T.Y(y1), T.Z(z1)], [T.X(x0), T.Y(y0), T.Z(z1)]);
      if (!at(i, j - 1)) quad([T.X(x0), T.Y(y0), T.Z(z0)], [T.X(x0), T.Y(y0), T.Z(z1)],
                              [T.X(x1), T.Y(y0), T.Z(z1)], [T.X(x1), T.Y(y0), T.Z(z0)]);
      if (!at(i, j + 1)) quad([T.X(x0), T.Y(y1), T.Z(z0)], [T.X(x1), T.Y(y1), T.Z(z0)],
                              [T.X(x1), T.Y(y1), T.Z(z1)], [T.X(x0), T.Y(y1), T.Z(z1)]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export default createGualuo;
