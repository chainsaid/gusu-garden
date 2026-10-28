// ---------------------------------------------------------------------------
// Hanging ornaments: 六角鎏金镂空吊灯（宫灯）与垂饰流苏。
// (佛教天盖 tengai / 灌顶幡 kanjo-ban / 華鬘 keman / 瓔珞 yoraku 已随死代码删除)
// Strand parts are instanced (few draw calls).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { latheGeo, rbox } from './interior-geo.js';
import { panelGeo, addTassel } from './interior-altar.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function mat4(pos, rot = [0, 0, 0], s = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  const sc = typeof s === 'number' ? V3(s, s, s) : V3(...s);
  return new THREE.Matrix4().compose(V3(...pos), q, sc);
}

// instance collector for the strand parts
export function makeStrandKit() {
  return { bead: [], tube: [], leaf: [], bell: [], flower: [] };
}
export function strandGeos() {
  const bead = new THREE.IcosahedronGeometry(0.014, 0);
  const tube = latheGeo([[0, -0.03], [0.009, -0.016], [0.009, 0.016], [0, 0.03]], 4);
  // yoraku leaf pendant: heart shaped plate with a bevel
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.03, 0.0, 0.035, -0.04, 0.0, -0.075);
  s.bezierCurveTo(-0.035, -0.04, -0.03, 0.0, 0, 0);
  const leaf = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8 });
  leaf.translate(0, 0, -0.002);
  const bell = latheGeo([[0, 0.0], [0.007, -0.004], [0.012, -0.02], [0.018, -0.04], [0.02, -0.045], [0.0, -0.045]], 8);
  const flower = new THREE.CylinderGeometry(0.028, 0.022, 0.008, 6, 1);
  return { bead, tube, leaf, bell, flower };
}
// one strand hanging straight down from (x,y,z), length len
export function addStrand(K, x, y, z, len, rnd, style = 0) {
  let yy = y;
  const end = y - len;
  let i = 0;
  const rot = rnd() * Math.PI;
  while (yy > end + 0.06) {
    if (i % 3 === 2) { K.tube.push(mat4([x, yy - 0.035, z], [0, rot, 0])); yy -= 0.07; }
    else { K.bead.push(mat4([x, yy - 0.014, z])); yy -= 0.03; }
    if (i % 9 === 8) { K.flower.push(mat4([x, yy - 0.004, z], [0, rot, 0])); yy -= 0.012; }
    i++;
  }
  if (style === 0) K.leaf.push(mat4([x, yy, z], [0, rot, 0], 1.3));
  else K.bell.push(mat4([x, yy, z], [0, 0, 0], 1.3));
}
export function flushStrands(ctx, K, M, group) {
  const G = strandGeos();
  for (const k of Object.keys(K)) {
    if (!K[k].length) continue;
    const m = k === 'tube' || k === 'flower' ? M.gold : M.goldBright;
    const im = ctx.geom.instanced(G[k], m, K[k], { castShadow: k !== 'bead' || true, receiveShadow: true });
    im.name = 'strand-' + k;
    group.add(im);
  }
}

// ============================================================================
// PENDANT LANTERN (gilt openwork, hexagonal) with glow core + tassels
export function buildPendantLantern(B, M, K, { x, y, z, s = 1, chain = 1.2 }, rnd) {
  const add = (g, m, px, py, pz, rot = [0, 0, 0], sc = 1) => B.add(g, m, mat4([x + px * s, y + py * s, z + pz * s], rot, sc * s));
  const hex = (prof) => { const g = latheGeo(prof, 6, Math.PI / 6).toNonIndexed(); g.computeVertexNormals(); return g; };
  // chain
  addStrand(K, x, y, z, chain, rnd, 2);
  const y0 = -chain / s;
  // roof (hexagonal, curved) with corner curls
  add(hex([[0, y0 - 0.0], [0.04, y0 - 0.02], [0.1, y0 - 0.08], [0.2, y0 - 0.13], [0.26, y0 - 0.15], [0.26, y0 - 0.17], [0, y0 - 0.17]]), M.goldBright, 0, 0, 0);
  add(latheGeo([[0, 0], [0.03, 0], [0.04, 0.03], [0.02, 0.06], [0, 0.09]], 10), M.goldBright, 0, y0 - 0.02, 0);
  // fire box: glow core + gilt openwork panels (panel shader) + posts
  const fb = 0.32, rr = 0.17;
  add(hex([[0, y0 - 0.17], [rr - 0.02, y0 - 0.17], [rr - 0.02, y0 - 0.17 - fb], [0, y0 - 0.17 - fb]]), M.paper, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fx = Math.sin(a) * rr * 0.866, fz = Math.cos(a) * rr * 0.866;
    B.add(panelGeo(rr * 0.9 * s, fb * 0.9 * s, 0.012 * s, 2), M.panel, mat4([x + fx * s, y + (y0 - 0.17 - fb / 2) * s, z + fz * s], [0, a, 0]));
    const ac = a + Math.PI / 6;
    add(rbox(0.025, fb, 0.025, 0.006), M.goldBright, Math.sin(ac) * rr, y0 - 0.17 - fb / 2, Math.cos(ac) * rr, [0, ac, 0]);
  }
  // base + hanging fringe (red tassels and short gold strands)
  add(hex([[0, y0 - 0.17 - fb], [rr + 0.03, y0 - 0.17 - fb], [rr + 0.03, y0 - 0.2 - fb], [0.08, y0 - 0.26 - fb], [0, y0 - 0.28 - fb]]), M.goldBright, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = x + Math.sin(a) * (rr + 0.02) * s, pz = z + Math.cos(a) * (rr + 0.02) * s, py = y + (y0 - 0.2 - fb) * s;
    if (i % 2 === 0) addTassel(B, M, px, py, pz, 0.42 * s, M.silkRed);
    else addStrand(K, px, py, pz, 0.35 * s, rnd, 0);
  }
  addTassel(B, M, x, y + (y0 - 0.28 - fb) * s, z, 0.5 * s, M.silkRed);
  return [x, y + (y0 - 0.17 - fb / 2) * s, z];
}
