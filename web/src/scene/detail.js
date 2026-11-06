// web 端几何细节策略：实时交互场景沿用重构前的默认档（s = 1），
// 形状与离线 createDetailPolicy({ tier: 'preview' }) 一致。
// 仅用于给移植过来的离线植被生成器补齐 detail 形参，不改变任何密度。
const s = 1;

export const WEB_DETAIL = {
  s,
  tier: 'preview',
  seg: (n, min = 3) => Math.max(min, Math.round(n * s)),
  gap: (v) => v / Math.max(0.25, s),
  cnt: (n) => Math.max(1, Math.round(n * s)),
  dens: (v) => v * s,
  isRealtime: () => false,
  lod: (v) => v,
};
