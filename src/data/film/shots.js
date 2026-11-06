// The film: 10 shots x 7 s. Each shot: camera keyframes (pos/target) sampled by a
// Catmull-Rom spline with eased progress; lens; focus; post overrides; shadow focus
// region. Pure data: per-module overrides are composed here once and frozen, so no
// importer can mutate the film at load time.
import { OVERRIDES } from './shotkeys/index.js';

export const SHOT_DUR = 7.0;

const V = (a) => [a[0], a[1], a[2]];

const BASE = [
  {
    name: 'Leak Window — push-through from the bamboo corridor leak window revealing the lotus pond, rockeries, and water pavilion',
    ease: 'reveal',
    keys: [
      { pos: V([68.25, 1.88, 24.48]), look: V([10, 2.3, 20]), focal: 36, focus: 0.95, fstop: 3.2 },
      { pos: V([66.8, 1.88, 24.48]), look: V([10, 2.3, 20]), focal: 32, focus: 3.0, fstop: 4.5 },
      { pos: V([63.6, 2.05, 24.2]), look: V([10, 2.3, 20]), focal: 26, focus: 35, fstop: 6.3 },
    ],
    shadow: { center: [30, 2, 20], radius: 50 },
    post: { dof: true },
  },
  {
    name: 'Morning Lotus — macro on blooming lotus with morning dewdrops, gliding through rockery beds toward stone bridge',
    keys: [
      { pos: V([21.392, 0.152, 27.255]), look: V([20.98, -0.12, 26.88]), focal: 50, focus: 0.62, fstop: 8 },
      { pos: V([20.9, 0.25, 25.8]), look: V([12, 2.2, 12]), focal: 36, focus: 3.5, fstop: 5.6 },
      { pos: V([18.8, 0.32, 23.4]), look: V([5.5, 3.6, 7.5]), focal: 26, focus: 13, fstop: 6.3 },
    ],
    near: 0.03,
    shadow: { center: [14, 1, 18], radius: 26 },
    post: { dof: true },
  },
  {
    name: 'Banana Palms — backlit dewdrops on translucent banana leaves, craning and panning to Scholar Hall Changchuang doors',
    ease: 'reveal',
    keys: [
      { pos: V([27.0, 1.85, -9.6]), look: V([25.8, 1.95, -10.4]), focal: 45, focus: 1.1, fstop: 2.8 },
      { pos: V([26.0, 2.1, -8.5]), look: V([23.5, 2.3, -11.0]), focal: 38, focus: 2.8, fstop: 4.0 },
      { pos: V([23.5, 2.5, -6.8]), look: V([16.0, 2.8, -13.0]), focal: 30, focus: 10, fstop: 5.6 },
      { pos: V([21.5, 2.6, -5.5]), look: V([13.0, 2.9, -15.0]), focal: 26, focus: 18, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [20, 2, -10], radius: 26 },
    post: { dof: true },
  },
  {
    name: 'Taihu Rockery — looking through Guanyun Peak dissolution caverns, rack focus across pond to Water Pavilion',
    ease: 'reveal',
    keys: [
      { pos: V([20.6, 2.2, -5.2]), look: V([22.0, 2.15, -3.5]), focal: 48, focus: 2.2, fstop: 2.8 },
      { pos: V([20.0, 2.15, -4.5]), look: V([25.0, 2.0, 0.0]), focal: 42, focus: 6.0, fstop: 4.0 },
      { pos: V([18.8, 2.0, -3.2]), look: V([32.0, 1.8, 6.0]), focal: 32, focus: 18, fstop: 5.6 },
      { pos: V([17.5, 1.85, -1.8]), look: V([38.0, 1.6, 12.0]), focal: 26, focus: 30, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [24, 2, 2], radius: 28 },
    post: { dof: true },
  },
  {
    name: 'Winding Corridor — promenade along white plaster wall with dappled bamboo shadows and leak windows',
    ease: 'reveal',
    keys: [
      { pos: V([-8.0, 1.65, 46.0]), look: V([-1.0, 1.75, 42.0]), focal: 32, focus: 4.5, fstop: 4.0 },
      { pos: V([-3.5, 1.65, 46.0]), look: V([4.0, 1.75, 40.0]), focal: 30, focus: 8.0, fstop: 4.5 },
      { pos: V([1.5, 1.65, 46.0]), look: V([8.5, 1.8, 36.0]), focal: 28, focus: 14.0, fstop: 5.6 },
      { pos: V([6.0, 1.65, 46.0]), look: V([10.0, 1.9, 30.0]), focal: 26, focus: 22.0, fstop: 5.6 },
    ],
    near: 0.04,
    shadow: { center: [0, 2, 44], radius: 25 },
    post: { dof: true },
  },
  {
    name: 'Fa Qiang Eaves — low-angle rising crane framing soaring corner rafter, cyan drip tiles, and bronze wind chime',
    ease: 'reveal',
    keys: [
      { pos: V([-10.2, 7.4, -7.2]), look: V([-7.5, 8.7, -9.0]), focal: 42, focus: 3.3, fstop: 3.5 },
      { pos: V([-11.6, 8.1, -6.1]), look: V([-6.4, 9.4, -11.2]), focal: 32, focus: 6, fstop: 4.5 },
      { pos: V([-14.6, 10.4, -3.0]), look: V([0.5, 9.4, -18.5]), focal: 26, focus: 14, fstop: 7 },
      { pos: V([-17.5, 12.5, -0.5]), look: V([5.5, 9.0, -22]), focal: 24, focus: 28, fstop: 8 },
    ],
    near: 0.05,
    shadow: { center: [6, 8, -20], radius: 25 },
    post: { dof: true },
  },
  {
    name: 'Scholar Hall — push-in from the Changchuang doors toward the landscape scroll, altar table, and armchairs',
    ease: 'linear',
    keys: [
      { pos: V([10, 2.7, -15.5]), look: V([10, 3.1, -29.8]), focal: 34, focus: 14.3, fstop: 4.5 },
      { pos: V([10, 3.0, -18.5]), look: V([10, 3.1, -29.8]), focal: 31, focus: 11.3, fstop: 6.0 },
      { pos: V([10, 2.7, -21.5]), look: V([10, 3.1, -29.8]), focal: 28, focus: 8.3, fstop: 8.0 },
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
      { pos: V([44.5, 1.85, 16.2]), look: V([41.2, 1.45, 17.8]), focal: 45, focus: 2.2, fstop: 2.8 },
      { pos: V([43.0, 1.55, 16.8]), look: V([36.0, 1.1, 18.2]), focal: 36, focus: 4.5, fstop: 4.0 },
      { pos: V([40.5, 1.25, 17.5]), look: V([28.0, 0.8, 19.0]), focal: 30, focus: 12, fstop: 5.6 },
      { pos: V([37.5, 1.1, 18.2]), look: V([18.0, 1.5, 20.0]), focal: 26, focus: 22, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [40, 2, 18], radius: 24 },
    post: { dof: true },
  },
  {
    name: 'Borrowed Reflection — low water skim on beaded lotus pad, swinging up to mirror reflections of the borrowed Beisi Pagoda and the stone bridge',
    ease: 'reveal',
    keys: [
      { pos: V([30.2, -0.42, 27.2]), look: V([29.718, -0.507, 27.302]), focal: 50, focus: 0.5, fstop: 11 },
      { pos: V([29.55, -0.16, 26.9]), look: V([25.55, -0.3, 26.76]), focal: 35, focus: 3.5, fstop: 8 },
      { pos: V([29.0, 0.35, 26.35]), look: V([0.8, 1.85, 16.1]), focal: 28, focus: 18, fstop: 8 },
      { pos: V([28.6, 0.9, 25.8]), look: V([-105, 28, -48]), focal: 24, focus: 150, fstop: 8 },
    ],
    near: 0.03,
    shadow: { center: [6, 0, 10], radius: 60 },
    post: { dof: true },
  },
  {
    name: 'Jiangnan Twilight — grand aerial rising crane overlooking pink walls, cyan tiles, winding water, and evening mist',
    ease: 'linear',
    keys: [
      { pos: V([36.9, 2.6, 24.6]), look: V([36.294, 2.6375, 24.725]), focal: 45, focus: 1.1, fstop: 2.8 },
      { pos: V([45.0, 12.0, 32.0]), look: V([-20, 6.0, -5]), focal: 32, focus: 40, fstop: 6.0 },
      { pos: V([66.0, 31.0, 57.0]), look: V([-14, 1.0, -10]), focal: 24, focus: 85, fstop: 10.0 },
    ],
    near: 0.05,
    shadow: { center: [12, 0, 8], radius: 78 },
    post: { fog: 0.65, exposure: 0.95, dof: true, bloom: 0.015 },
  },
];

// motion smoothing (seconds) where hand-made keys produced acceleration snaps (tools/camcheck.mjs)
const SMOOTH = { 3: 0.18, 4: 0.22, 9: 0.45 };

function deepFreeze(o) {
  if (Array.isArray(o)) { for (const v of o) deepFreeze(v); return Object.freeze(o); }
  if (o && typeof o === 'object') { for (const k of Object.keys(o)) deepFreeze(o[k]); return Object.freeze(o); }
  return o;
}

const shots = BASE.map((s) => ({ ...s }));
for (const o of OVERRIDES) for (const [k, v] of Object.entries(o || {})) Object.assign(shots[+k], v);
for (const [k, v] of Object.entries(SMOOTH)) if (shots[+k].smooth === undefined) shots[+k].smooth = v;

export const SHOTS = Object.freeze(shots.map(deepFreeze));
export const FILM_DURATION = SHOTS.length * SHOT_DUR;
