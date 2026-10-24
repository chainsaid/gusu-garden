import * as THREE from 'three';
import { OVERRIDES } from './shotkeys/index.js';

// ---------------------------------------------------------------------------
// The film: 10 shots x 7 s. Each shot: camera keyframes (pos/target) sampled
// by a Catmull-Rom spline with eased progress; lens; focus; post overrides;
// shadow focus region.
// ---------------------------------------------------------------------------

export const SHOT_DUR = 7.0;

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export const SHOTS = [
  {
    name: 'Leak Window — push-through from the bamboo corridor leak window revealing the lotus pond, rockeries, and water pavilion',
    ease: 'reveal',
    keys: [
      { pos: [68.25, 1.88, 24.48], look: [10, 2.3, 20], focal: 36, focus: 0.95, fstop: 3.2 },
      { pos: [66.8, 1.88, 24.48], look: [10, 2.3, 20], focal: 32, focus: 3.0, fstop: 4.5 },
      { pos: [63.6, 2.05, 24.2], look: [10, 2.3, 20], focal: 26, focus: 35, fstop: 6.3 },
    ],
    shadow: { center: [30, 2, 20], radius: 50 },
    post: { dof: true },
  },
  {
    name: 'Morning Lotus — macro on blooming lotus with morning dewdrops, gliding through rockery beds toward stone bridge',
    keys: [
      { pos: [21.392, 0.152, 27.255], look: [20.98, -0.12, 26.88], focal: 50, focus: 0.62, fstop: 8 },
      { pos: [20.9, 0.25, 25.8], look: [12, 2.2, 12], focal: 36, focus: 3.5, fstop: 5.6 },
      { pos: [18.8, 0.32, 23.4], look: [5.5, 3.6, 7.5], focal: 26, focus: 13, fstop: 6.3 },
    ],
    near: 0.03,
    shadow: { center: [14, 1, 18], radius: 26 },
    post: { dof: true },
  },
  {
    name: 'Banana Palms — backlit dewdrops on translucent banana leaves, craning and panning to Scholar Hall Changchuang doors',
    ease: 'reveal',
    keys: [
      { pos: [27.0, 1.85, -9.6], look: [25.8, 1.95, -10.4], focal: 45, focus: 1.1, fstop: 2.8 },
      { pos: [26.0, 2.1, -8.5], look: [23.5, 2.3, -11.0], focal: 38, focus: 2.8, fstop: 4.0 },
      { pos: [23.5, 2.5, -6.8], look: [16.0, 2.8, -13.0], focal: 30, focus: 10, fstop: 5.6 },
      { pos: [21.5, 2.6, -5.5], look: [13.0, 2.9, -15.0], focal: 26, focus: 18, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [20, 2, -10], radius: 26 },
    post: { dof: true },
  },
  {
    name: 'Taihu Rockery — looking through Guanyun Peak dissolution caverns, rack focus across pond to Water Pavilion',
    ease: 'reveal',
    keys: [
      { pos: [20.6, 2.2, -5.2], look: [22.0, 2.15, -3.5], focal: 48, focus: 2.2, fstop: 2.8 },
      { pos: [20.0, 2.15, -4.5], look: [25.0, 2.0, 0.0], focal: 42, focus: 6.0, fstop: 4.0 },
      { pos: [18.8, 2.0, -3.2], look: [32.0, 1.8, 6.0], focal: 32, focus: 18, fstop: 5.6 },
      { pos: [17.5, 1.85, -1.8], look: [38.0, 1.6, 12.0], focal: 26, focus: 30, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [24, 2, 2], radius: 28 },
    post: { dof: true },
  },
  {
    name: 'Winding Corridor — promenade along white plaster wall with dappled bamboo shadows and leak windows',
    ease: 'reveal',
    keys: [
      { pos: [-8.0, 1.65, 46.0], look: [-1.0, 1.75, 42.0], focal: 32, focus: 4.5, fstop: 4.0 },
      { pos: [-3.5, 1.65, 46.0], look: [4.0, 1.75, 40.0], focal: 30, focus: 8.0, fstop: 4.5 },
      { pos: [1.5, 1.65, 46.0], look: [8.5, 1.8, 36.0], focal: 28, focus: 14.0, fstop: 5.6 },
      { pos: [6.0, 1.65, 46.0], look: [10.0, 1.9, 30.0], focal: 26, focus: 22.0, fstop: 5.6 },
    ],
    near: 0.04,
    shadow: { center: [0, 2, 44], radius: 25 },
    post: { dof: true },
  },
  {
    name: 'Fa Qiang Eaves — low-angle rising crane framing soaring corner rafter, cyan drip tiles, and bronze wind chime',
    ease: 'reveal',
    keys: [
      { pos: [-10.2, 7.4, -7.2], look: [-7.5, 8.7, -9.0], focal: 42, focus: 3.3, fstop: 3.5 },
      { pos: [-11.6, 8.1, -6.1], look: [-6.4, 9.4, -11.2], focal: 32, focus: 6, fstop: 4.5 },
      { pos: [-14.6, 10.4, -3.0], look: [0.5, 9.4, -18.5], focal: 26, focus: 14, fstop: 7 },
      { pos: [-17.5, 12.5, -0.5], look: [5.5, 9.0, -22], focal: 24, focus: 28, fstop: 8 },
    ],
    near: 0.05,
    shadow: { center: [6, 8, -20], radius: 25 },
    post: { dof: true },
  },
  {
    name: 'Scholar Hall — push-in from the Changchuang doors toward the landscape scroll, altar table, and armchairs',
    ease: 'linear',
    keys: [
      { pos: [10, 2.7, -15.5], look: [10, 3.1, -29.8], focal: 34, focus: 14.3, fstop: 4.5 },
      { pos: [10, 3.0, -18.5], look: [10, 3.1, -29.8], focal: 31, focus: 11.3, fstop: 6.0 },
      { pos: [10, 2.7, -21.5], look: [10, 3.1, -29.8], focal: 28, focus: 8.3, fstop: 8.0 },
    ],
    near: 0.06,
    shadow: { center: [10, 5, -22], radius: 22 },
    noShadow: ['vegetation', 'terrain', 'buildings', 'pagoda'],
    post: { exposure: 1.0, dof: true },
  },
  {
    name: 'Water Pavilion — weeping willow swaying over Meirenakao curved bench, gliding out over rippling pond',
    ease: 'reveal',
    keys: [
      { pos: [44.5, 1.85, 16.2], look: [41.2, 1.45, 17.8], focal: 45, focus: 2.2, fstop: 2.8 },
      { pos: [43.0, 1.55, 16.8], look: [36.0, 1.1, 18.2], focal: 36, focus: 4.5, fstop: 4.0 },
      { pos: [40.5, 1.25, 17.5], look: [28.0, 0.8, 19.0], focal: 30, focus: 12, fstop: 5.6 },
      { pos: [37.5, 1.1, 18.2], look: [18.0, 1.5, 20.0], focal: 26, focus: 22, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [40, 2, 18], radius: 24 },
    post: { dof: true },
  },
  {
    name: 'Borrowed Reflection — low water skim on beaded lotus pad, swinging up to mirror reflections of the borrowed Beisi Pagoda and the stone bridge',
    ease: 'reveal',
    keys: [
      { pos: [30.2, -0.42, 27.2], look: [29.718, -0.507, 27.302], focal: 50, focus: 0.5, fstop: 11 },
      { pos: [29.55, -0.16, 26.9], look: [25.55, -0.3, 26.76], focal: 35, focus: 3.5, fstop: 8 },
      { pos: [29.0, 0.35, 26.35], look: [0.8, 1.85, 16.1], focal: 28, focus: 18, fstop: 8 },
      { pos: [28.6, 0.9, 25.8], look: [-105, 28, -48], focal: 24, focus: 150, fstop: 8 },
    ],
    near: 0.03,
    shadow: { center: [6, 0, 10], radius: 60 },
    post: { dof: true },
  },
  {
    name: 'Jiangnan Twilight — grand aerial rising crane overlooking pink walls, cyan tiles, winding water, and evening mist',
    ease: 'linear',
    keys: [
      { pos: [36.9, 2.6, 24.6], look: [36.294, 2.6375, 24.725], focal: 45, focus: 1.1, fstop: 2.8 },
      { pos: [45.0, 12.0, 32.0], look: [-20, 6.0, -5], focal: 32, focus: 40, fstop: 6.0 },
      { pos: [66.0, 31.0, 57.0], look: [-14, 1.0, -10], focal: 24, focus: 85, fstop: 10.0 },
    ],
    near: 0.05,
    shadow: { center: [12, 0, 8], radius: 78 },
    post: { fog: 0.65, exposure: 0.95, dof: true, bloom: 0.015 },
  },
];

// per-module camera overrides (src/shotkeys/*.js)
for (const o of OVERRIDES) for (const [k, v] of Object.entries(o || {})) Object.assign(SHOTS[+k], v);
// motion smoothing (seconds) where hand-made keys produced acceleration snaps (tools/camcheck.mjs)
const SMOOTH = { 3: 0.18, 4: 0.22, 9: 0.45 };
for (const [k, v] of Object.entries(SMOOTH)) if (SHOTS[+k].smooth === undefined) SHOTS[+k].smooth = v;


const tmpA = new THREE.Vector3();

function ease(u) {
  // gentle ease in/out that keeps motion alive in the middle
  const s = u * u * (3 - 2 * u);
  return u * 0.35 + s * 0.65;
}

// Evaluate camera for shot index `i` at local time `t` (0..SHOT_DUR)
// Keys: { pos, look, focal?, focus?, fstop? }. Orientation is interpolated as a
// DIRECTION (so close-up -> wide reveals pan smoothly), look distance in log space,
// lens (focal, focus, fstop) per key with fallback to the shot-level values.
function easeFor(S, u) {
  const e = S.ease || 'inout';
  if (e === 'linear') return u;
  if (e === 'reveal') { // linger on the close-up, then accelerate into the reveal, soft landing
    const a = u * u * (3 - 2 * u);
    return Math.pow(a, 1.35);
  }
  return ease(u);
}
function lerpKeys(vals, u) {
  const n = vals.length - 1;
  const x = Math.min(Math.max(u, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1), f = x - i;
  return vals[i] + (vals[i + 1] - vals[i]) * f;
}
// Optional temporal smoothing (S.smooth = Gaussian sigma in seconds): averages the raw
// camera over neighbouring times, removing acceleration snaps from hand-made keys.
export function evalShot(i, t) {
  const S = SHOTS[i];
  const sg = S.smooth || 0;
  if (!sg) return evalShotRaw(i, t);
  const c = evalShotRaw(i, t);
  const pos = new THREE.Vector3(), dir = new THREE.Vector3();
  let wsum = 0, ld = 0, focal = 0;
  const E = SHOT_DUR - 1e-4;
  // point-reflection extrapolation beyond the shot ends keeps velocity continuous
  const sample = (tk) => {
    if (tk >= 0 && tk <= E) return evalShotRaw(i, tk);
    const edge = tk < 0 ? 0 : E, mir = tk < 0 ? -tk : 2 * E - tk;
    const a = evalShotRaw(i, edge), b = evalShotRaw(i, Math.min(Math.max(mir, 0), E));
    const da = a.look.clone().sub(a.pos), db = b.look.clone().sub(b.pos);
    const la = da.length(), lb = db.length();
    da.divideScalar(la); db.divideScalar(lb);
    a.pos = a.pos.clone().multiplyScalar(2).sub(b.pos);
    const d = da.multiplyScalar(2).sub(db).normalize();
    a.look = a.pos.clone().addScaledVector(d, Math.exp(2 * Math.log(la) - Math.log(lb)));
    a.focal = 2 * a.focal - b.focal;
    return a;
  };
  for (let k = -6; k <= 6; k++) {
    const tk = t + (k / 6) * 2.5 * sg;
    const w = Math.exp(-0.5 * ((k / 6) * 2.5) ** 2);
    const ck = sample(tk);
    pos.addScaledVector(ck.pos, w);
    const d = ck.look.clone().sub(ck.pos); const l = d.length();
    dir.addScaledVector(d.divideScalar(l), w); ld += Math.log(l) * w; focal += ck.focal * w; wsum += w;
  }
  pos.divideScalar(wsum); dir.normalize();
  c.pos = pos; c.look = pos.clone().addScaledVector(dir, Math.exp(ld / wsum)); c.focal = focal / wsum;
  return c;
}
function evalShotRaw(i, t) {
  const S = SHOTS[i];
  const u = easeFor(S, Math.min(Math.max(t / SHOT_DUR, 0), 1));
  const K = S.keys;
  const P = K.map((k) => V(k.pos));
  const D = K.map((k) => V(k.look).sub(V(k.pos)));
  const LD = D.map((d) => Math.log(Math.max(d.length(), 0.05)));
  D.forEach((d) => d.normalize());
  let pos, dir;
  if (K.length === 2) {
    pos = P[0].clone().lerp(P[1], u);
    dir = D[0].clone().lerp(D[1], u).normalize();
  } else {
    pos = new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.5).getPoint(u);
    dir = new THREE.CatmullRomCurve3(D, false, 'catmullrom', 0.5).getPoint(u).normalize();
  }
  const ld = Math.exp(lerpKeys(LD, u));
  const look = pos.clone().addScaledVector(dir, ld);
  const focal = lerpKeys(K.map((k) => k.focal ?? S.focal ?? 35), u);
  const fstop = lerpKeys(K.map((k) => k.fstop ?? S.fstop ?? 8), u);
  let focusDist;
  if (K.some((k) => k.focus !== undefined)) focusDist = Math.exp(lerpKeys(K.map((k, j) => Math.log(k.focus ?? (S.focus === 'look' || S.focus === undefined ? Math.exp(LD[j]) : S.focus))), u));
  else focusDist = S.focus === 'look' ? ld : S.focus;
  return {
    index: i, noShadow: S.noShadow || null,
    pos, look,
    focal, near: S.near || 0.12, far: S.far || 6000,
    focusDist, fstop,
    roll: S.roll || 0,
    shadow: S.shadow, post: S.post || {},
  };
}

export const FILM_DURATION = SHOTS.length * SHOT_DUR;
