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
