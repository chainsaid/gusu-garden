// ---------------------------------------------------------------------------
// props-plaza.js — natural rocks and 汀步 (stepping stones).
// Builders return Acc's per material in LOCAL coords (origin on the ground).
// Stone tag = [pattern, glowRecv, mossBias, fireY|-100-dark]
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Acc, polyStack, petalBand, lathe, roofCap, taperTube, scrollPoints, basis, mat4, fbm3, fixOutward, TAU, lerp } from './props-geo.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const ST = (pat, moss, dark = 0) => [pat, 0, moss, -100 - dark * 10];
const BR = [0, 0, 0, 0], GD = [0, 1, 0, 0], BLK = [0, 3, 0, 0], INC = [0, 4, 0, 0];

// Natural rock: noisy icosphere, optional flat top/bottom. Returns indexed BufferGeometry.
export function rockGeo(seed, { sx = 1, sy = 1, sz = 1, detail = 3, rough = 0.2, flatTop = null, flatBottom = -0.55, topNoise = 0.012 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = 1 + rough * fbm3(x * 1.3 + seed, y * 1.3, z * 1.3, 3, seed | 0) + rough * 0.3 * fbm3(x * 4 + seed, y * 4, z * 4, 2, (seed | 0) + 5);
    x *= r * sx; y *= r * sy; z *= r * sz;
    if (flatTop !== null && y > flatTop * sy) y = flatTop * sy + (y - flatTop * sy) * 0.08 + topNoise * fbm3(x * 6, 0, z * 6, 2, (seed | 0) + 9);
    if (y < flatBottom * sy) y = flatBottom * sy;
    p.setXYZ(i, x, y - flatBottom * sy, z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// 常香炉 — local origin at the ground centre, front +Z. ~2.3 m tall.
// ---------------------------------------------------------------------------

// Stepping stones: list of {x, z, rot, s}; returns Acc (world coords given ground fn)
export function buildSteppingStones(list, ground) {
  const S = new Acc();
  list.forEach((e, i) => {
    const g = rockGeo(10 + i * 1.91, { sx: 0.3 * e.s, sy: 0.09, sz: 0.24 * e.s, detail: 3, rough: 0.14, flatTop: 0.42, flatBottom: -0.6, topNoise: 0.006 });
    S.addGeo(g, mat4([e.x, ground(e.x, e.z) - 0.05, e.z], [0, e.rot, 0]), ST(0, 0.55));
  });
  return S;
}

// ---------------------------------------------------------------------------
// 庭院石桌石凳 (Stone table and drum stools) — for scholar gatherings & tea.
// ---------------------------------------------------------------------------
export function buildStoneTableSet(cx, cz, ground) {
  const S = new Acc();
  const gy = ground(cx, cz);
  const R = 0.56, H = 0.72;
  // table lathe profile: flared base, waisted column, thick round top slab
  lathe(S, [
    [0.0, 0.0], [0.35, 0.0], [0.35, 0.06], [0.22, 0.12],
    [0.17, 0.32], [0.19, 0.48], [0.26, 0.60], [0.34, 0.64],
    [R, 0.64], [R * 1.01, 0.68], [R * 0.98, H], [0.0, H],
  ], 36, ST(0, 0.45), mat4([cx, gy, cz]));

  // 4 drum stools (石鼓墩) arranged around the table
  const stoolDist = 0.88;
  for (let i = 0; i < 4; i++) {
    const ang = i * (Math.PI / 2) + 0.38;
    const sx = cx + Math.cos(ang) * stoolDist;
    const sz = cz + Math.sin(ang) * stoolDist;
    const sy = ground(sx, sz);
    const rS = 0.22, hS = 0.48;
    lathe(S, [
      [0.0, 0.0], [rS * 1.06, 0.0], [rS * 1.06, 0.04], [rS * 0.98, 0.06],
      [rS * 0.86, 0.11], [rS * 0.94, 0.22], [rS * 1.0, 0.30], [rS * 0.95, 0.38],
      [rS * 0.88, 0.43], [rS * 0.98, 0.46], [rS * 0.98, hS], [0.0, hS],
    ], 24, ST(0, 0.55), mat4([sx, sy, sz]));
  }
  return S;
}

// ---------------------------------------------------------------------------
// 庭院古井 (Ancient stone well) — octagonal stone well-curb with plinth.
// ---------------------------------------------------------------------------
export function buildStoneWell(cx, cz, ground) {
  const S = new Acc();
  const gy = ground(cx, cz);
  // octagonal stone foundation plinth
  polyStack(S, {
    n: 8, rot: 0.2, rc: 0.03, sideSeg: 2, profile: [
      { a: 0.78, y: 0.0, tag: ST(0, 0.75) },
      { a: 0.74, y: 0.12, tag: ST(0, 0.5) },
    ],
  }, mat4([cx, gy, cz]));

  // cylindrical well curb with weathered rim
  const rOut = 0.54, rIn = 0.38, H = 0.66;
  lathe(S, [
    [rIn, 0.12], [rOut, 0.12], [rOut * 1.02, 0.16], [rOut * 0.98, 0.35],
    [rOut * 1.01, 0.54], [rOut * 1.03, 0.62], [rOut * 0.99, H], [rIn, H],
    [rIn * 0.96, H - 0.04], [rIn, 0.12],
  ], 36, ST(0, 0.6), mat4([cx, gy, cz]));

  // dark water depth inside the well
  lathe(S, [
    [0.0, 0.22], [rIn, 0.22],
  ], 16, ST(0, 0.2, 1), mat4([cx, gy, cz]));

  return S;
}
