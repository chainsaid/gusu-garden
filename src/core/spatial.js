// ---------------------------------------------------------------------------
// Spatial queries used by the placement rules: camera frame bases, screen-space
// framing tests (NDC rectangles) and axis-aligned keep-out volumes. Pure
// geometry with no project knowledge; the rule about *which* rectangles and
// boxes are protected lives in src/world/placement/rules.js.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Camera frame from position / target / focal length. rects are NDC rects
// [x0,x1,y0,y1]; minD is a hard minimum distance to the lens.
export function frameBasis(pos, look, focal, rects, minD = 0) {
  const P = V3(...pos), f = V3(...look).sub(P).normalize();
  const r = V3().crossVectors(f, V3(0, 1, 0)).normalize(), u = V3().crossVectors(r, f).normalize();
  return { pos: P, f, r, u, tx: 18 / focal, ty: 10.125 / focal, rects, minD };
}

// avoid: [{pos,f,r,u,tx,ty, rects:[[x0,x1,y0,y1],...] (NDC), minD}]
// true if a foliage mass at c (radius r) would cover a protected screen
// rectangle of a film camera, or come closer than minD to it.
export function screenBlocked(avoid, c, r, yScale = 1) {
  if (!avoid) return false;
  for (const A of avoid) {
    const v = c.clone().sub(A.pos);
    if (A.minD && v.length() < A.minD + r) return true;
    const z = v.dot(A.f);
    if (z < 0.3) continue;
    const x = v.dot(A.r) / (z * A.tx), y = v.dot(A.u) / (z * A.ty);
    const rx = r / (z * A.tx), ry = (r * yScale) / (z * A.ty);
    for (const R of A.rects) if (x + rx > R[0] && x - rx < R[1] && y + ry > R[2] && y - ry < R[3]) return true;
  }
  return false;
}

// keep-out volumes: [{x0,x1,z0,z1,y0?,y1}] — true if a foliage mass at c
// (horizontal radius r, vertical half-extent ry) would intrude
export function boxBlocked(boxes, c, r, ry = r) {
  if (!boxes) return false;
  for (const B of boxes) {
    if (c.x + r > B.x0 && c.x - r < B.x1 && c.z + r > B.z0 && c.z - r < B.z1 && c.y - ry < B.y1 && c.y + ry > (B.y0 ?? -1e9)) return true;
  }
  return false;
}
