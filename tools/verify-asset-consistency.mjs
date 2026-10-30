// 检查「电影版源码 (src/world/bridge.js)」与「web 交互版资产 (gusu-garden-core.glb)」
// 里的桥几何是否一致 —— 数据级校验，不是截图对比。
//
// 原理：Draco 压缩不改拓扑，所以同一份 bridge 源码在 0.38 导出档位下构建出来的
// 三角面数，应当和 glb 中 bridge 节点解码后的面数**逐面相等**。若不等，说明 glb
// 是用旧源码 / 旧档位导出的，需要重跑 export-web-assets.mjs。
//
// 用法: node tools/verify-asset-consistency.mjs [--glb=路径] [--tol=0.02]
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(k + '=')); return a ? a.split('=')[1] : d; };
const GLB = arg('--glb', path.join(ROOT, 'web', 'public', 'assets', 'gusu-garden-core.glb'));
const TOL = parseFloat(arg('--tol', '0.02'));

// ---- 电影版基准：在 node 里重新构建 bridge 几何 ----
async function movieBridgeStats() {
  globalThis.window = globalThis.window || {};
  globalThis.document = globalThis.document || { createElement: () => ({ getContext: () => null }) };
  const { materials, patch, std, phys, glow, PROC, depthMaterialFor } = await import('../src/core/materials.js');
  const { L } = await import('../src/layout.js');
  const { setDetailTier } = await import('../src/core/detail.js');
  const { ENV, G, sunDir } = await import('../src/core/env.js');
  const geom = await import('../src/core/geom.js');
  const { rng } = await import('../src/core/rng.js');
  const { build: bridgeBuild } = await import('../src/world/bridge.js');
  setDetailTier('realtime', 0.38);   // 与 export-web-assets.mjs 的 core 档位一致
  const scene = new THREE.Scene();
  const ctx = {
    THREE, scene, L, G, ENV, sunDir, geom, rng, quality: 'realtime',
    M: materials(), mat: { patch, std, phys, glow, PROC, depthMaterialFor },
    onUpdate: () => {}, captureEnv: () => {}, modules: {},
  };
  const res = await bridgeBuild(ctx);
  const obj = res.isObject3D ? res : res.object;
  const box = new THREE.Box3();
  let tris = 0, verts = 0;
  obj.traverse((c) => {
    if (c.isMesh && c.geometry) {
      const g = c.geometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      verts += g.attributes.position.count;
      g.computeBoundingBox();
      box.union(g.boundingBox.clone().applyMatrix4(c.matrixWorld));
    }
  });
  obj.updateWorldMatrix(true, true);
  obj.traverse((c) => { if (c.isMesh && c.geometry) { c.geometry.computeBoundingBox(); } });
  // 重新 union（确保 matrixWorld 已更新）
  const box2 = new THREE.Box3();
  obj.traverse((c) => {
    if (c.isMesh && c.geometry && c.geometry.boundingBox) {
      box2.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld));
    }
  });
  return { tris: Math.round(tris), verts, box: box2 };
}

// ---- web 版：最小 glb 解析，找 bridge 节点子树统计面数 + bbox ----
function webBridgeStats(glbPath) {
  const buf = fs.readFileSync(glbPath);
  const off0 = 12;
  const len0 = buf.readUInt32LE(off0);
  const jsonBuf = buf.subarray(off0 + 8, off0 + 8 + len0);
  const gltf = JSON.parse(jsonBuf.toString('utf8'));
  const nodes = gltf.nodes || [];
  const meshes = gltf.meshes || [];
  const accessors = gltf.accessors || [];

  const collect = (nodeIdx, acc) => {
    const n = nodes[nodeIdx];
    if (!n) return;
    if (n.mesh != null) acc.meshIdx.push(n.mesh);
    (n.children || []).forEach((c) => collect(c, acc));
  };
  // 全局找 name==='bridge' 的根（导出时 coreGroup 的子对象 name='bridge'）
  const acc = { meshIdx: [] };
  let found = false;
  for (const n of nodes) {
    if (n.name === 'bridge') { collect(nodes.indexOf(n), acc); found = true; }
  }
  if (!found) {
    // 退回：scenes[0] 下所有 name 含 bridge 的
    for (const sn of (gltf.scenes?.[0]?.nodes || [])) collect(sn, acc);
  }

  let tris = 0, verts = 0;
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let haveMinMax = true;
  for (const mi of acc.meshIdx) {
    const m = meshes[mi];
    if (!m) continue;
    for (const p of m.primitives) {
      const posAcc = accessors[p.attributes?.POSITION];
      const idxAcc = p.indices != null ? accessors[p.indices] : null;
      if (posAcc) verts += posAcc.count;
      tris += (idxAcc ? idxAcc.count : posAcc?.count || 0) / 3;
      if (posAcc?.min && posAcc?.max) {
        for (let k = 0; k < 3; k++) {
          box.min[k] = Math.min(box.min[k], posAcc.min[k]);
          box.max[k] = Math.max(box.max[k], posAcc.max[k]);
        }
      } else haveMinMax = false;
    }
  }
  return { tris: Math.round(tris), verts, box, haveMinMax, nodes: acc.meshIdx.length };
}

function boxVec(b) {
  if (!b) return null;
  const mn = Array.isArray(b.min) ? b.min : [b.min.x, b.min.y, b.min.z];
  const mx = Array.isArray(b.max) ? b.max : [b.max.x, b.max.y, b.max.z];
  return { min: mn, max: mx };
}
function fmtBox(b) {
  const v = boxVec(b);
  if (!v) return 'n/a';
  return `x[${v.min[0].toFixed(2)},${v.max[0].toFixed(2)}] y[${v.min[1].toFixed(2)},${v.max[1].toFixed(2)}] z[${v.min[2].toFixed(2)},${v.max[2].toFixed(2)}]`;
}
function boxDiag(b) {
  const v = boxVec(b);
  if (!v) return NaN;
  return Math.hypot(v.max[0] - v.min[0], v.max[1] - v.min[1], v.max[2] - v.min[2]);
}

async function main() {
  if (!fs.existsSync(GLB)) {
    console.error(`[verify] 找不到 web 资产: ${GLB}`);
    process.exit(2);
  }
  console.log('[verify] 电影版基准：node 重建 bridge 几何...');
  const movie = await movieBridgeStats();
  console.log(`[verify] web 版：解析 ${path.basename(GLB)} 的 bridge 节点...`);
  const web = webBridgeStats(GLB);

  const dTris = web.tris - movie.tris;
  const relErr = movie.tris ? Math.abs(dTris) / movie.tris : 1;
  let dBox = NaN;
  if (web.haveMinMax && movie.box.min) {
    // 电影版 box 是 THREE.Box3，转成 min/max 数组
    const mb = { min: [movie.box.min.x, movie.box.min.y, movie.box.min.z], max: [movie.box.max.x, movie.box.max.y, movie.box.max.z] };
    dBox = Math.abs(boxDiag(web.box) - boxDiag(mb));
  }

  console.log('====================================================');
  console.log('  桥几何一致性校验 (电影版 src vs web glb)');
  console.log('====================================================');
  console.log(`  电影版 bridge  : tris=${movie.tris}  verts=${movie.verts}`);
  console.log(`  web  版 bridge : tris=${web.tris}  verts=${web.verts}  (glb 内 mesh 节点 ${web.nodes} 个)`);
  console.log(`  面数差         : ${dTris}  (相对 ${(relErr * 100).toFixed(3)}%)`);
  console.log(`  电影版 bbox    : ${fmtBox(movie.box)}`);
  console.log(`  web  版 bbox   : ${web.haveMinMax ? fmtBox(web.box) : 'glb 未内嵌 min/max（Draco 路径常见），跳过'}`);
  if (!Number.isNaN(dBox)) console.log(`  bbox 对角差    : ${dBox.toFixed(4)} m`);
  console.log('====================================================');

  const ok = relErr <= TOL && (!Number.isNaN(dBox) || !web.haveMinMax || dBox < 0.1);
  if (ok) {
    console.log(`✓ 一致：web glb 的 bridge 几何与当前 src 在 0.38 档位下吻合（面数差 < ${TOL * 100}%）`);
    process.exit(0);
  } else {
    console.error(`✗ 不一致：面数相对差 ${(relErr * 100).toFixed(2)}% 超过阈值 ${TOL * 100}%`);
    console.error(`  可能原因：web glb 是用旧版 src 导出的 —— 请重跑 node tools/export-web-assets.mjs --asset=core`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('[verify:error]', e.stack || e.message); process.exit(3); });
