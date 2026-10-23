// ---------------------------------------------------------------------------
// Diagnostics probes for the boot sequence (?probe=...). Kept out of main.js:
// they are dev-only tooling and change often.
//   ?probe=tris      per-object triangle census (top 30, instancing-aware)
//   ?probe=materials material/program variant census + registry stats
// ---------------------------------------------------------------------------
import { matRegistry } from './materials.js';

// ?probe=materials: registry stats + cache keys grouped by hook-slot structure.
// Keys sharing a structure differ only in shader literals -> mergeable via uniforms.
export function probeMaterials(scene) {
  const reg = matRegistry();
  let autoN = 0, collide = 0; const collideNames = [];
  for (const [nm, e] of reg) { if (nm.startsWith('hook_')) autoN++; if (e.collide) { collide++; collideNames.push(nm); } }
  console.log('[info] registry: entries=' + reg.size, `autoNamed=${autoN}`, `userNamed=${reg.size - autoN}`, `collisions=${collide}`, collideNames.length ? 'names: ' + collideNames.join(', ') : '');
  const SLOTS = ['vertexHead', 'vertexWorld', 'fragHead', 'fragColor', 'fragRough', 'fragMetal', 'fragNormal', 'fragEmissive', 'fragPhysical', 'fragLight', 'fragEnd'];
  const keys = new Set(); const bySig = new Map(); let mats = 0;
  scene.traverse((o) => {
    const list = [];
    if (o.material) list.push(...(Array.isArray(o.material) ? o.material : [o.material]));
    if (o.customDepthMaterial) list.push(o.customDepthMaterial);
    for (const m of list) {
      if (!m) continue;
      mats++;
      const key = m.customProgramCacheKey ? String(m.customProgramCacheKey()) : m.type + ':base';
      keys.add(key);
      const p = m.userData.patch;
      const sig = p ? SLOTS.filter((k) => typeof p[k] === 'string' && p[k].length > 0).join('+') || 'empty' : (p ? 'defines' : 'none');
      let e = bySig.get(sig);
      if (!e) { e = { n: 0, keys: new Set(), names: [] }; bySig.set(sig, e); }
      e.n++; e.keys.add(key);
      if (m.name && e.names.length < 3) e.names.push(m.name);
    }
  });
  const rows = [...bySig.entries()].sort((a, b) => b[1].keys.size - a[1].keys.size);
  console.log('[info] material census: materials=' + mats, 'distinctKeys=' + keys.size);
  for (const [sig, e] of rows.slice(0, 14)) console.log('[info] census', `keys=${e.keys.size}`, `mats=${e.n}`, `slots=[${sig}]`, 'eg:', e.names.join(','));
}

// ?probe=tris: where do the triangles actually live? Aggregate per mesh (instanced
// meshes count every instance), keyed by "<topGroup>/<objectName>#<id>", top 30.
export function probeTris(scene) {
  const top = (o) => { let p = o; while (p.parent && p.parent !== scene) p = p.parent; return p.name || '?'; };
  const per = {};
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    const k = `${top(o)}/${o.name || o.material?.name || o.constructor.name}#${o.id}`;
    per[k] = (per[k] || 0) + n;
  });
  const rows = Object.entries(per).sort((a, b) => b[1] - a[1]);
  console.log('[info] tris-by-object', JSON.stringify(Object.fromEntries(rows.slice(0, 30).map(([k, v]) => [k, Math.round(v / 1000) + 'k']))));
}
