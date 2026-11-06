// Per-shot choreography facts: which shots see the scene up close, which shot owns the
// hero spray, the drifting-leaf volumes, and the water-level glitter/ring timing.
// Pure data — no three.js, no process.

// shots whose ground-level cameras keep the near (translucent, glowing) maple materials
export const NEAR_CAMERAS = [1, 2, 3, 4, 5, 7, 8];

// the finale shot owns the macro 红枫 spray
export const HERO_SHOT = 9;

// drifting leaves: one volume per shot. `ahead` / `yOffset` (when present) place the box
// from the shot's first camera key along its view direction.
export const LEAF_DRIFT = [
  // shot 9: crimson leaves falling past the macro spray (from 0.5 m to ~3.6 m in front of the lens)
  { shot: 9, ahead: 2.1, yOffset: 1.7, size: [3.6, 6.6, 4.0], vel: [0.08, 0.36, 0.05], count: 34, scale: 0.085, colA: [0.34, 0.015, 0.01], colB: [0.5, 0.1, 0.012] },
  // shot 3: yellow-green / orange 红枫 leaves across the pagoda corner
  { shot: 3, center: [-42.5, 4.4, 2.0], size: [9, 7, 9], vel: [0.16, 0.4, 0.1], count: 40, scale: 0.09, colA: [0.2, 0.17, 0.025], colB: [0.42, 0.13, 0.015] },
  // shot 5: red leaves from the stair-side maple drifting past the hall eave corner
  { shot: 5, center: [-8.0, 4.6, -5.5], size: [8, 7, 8], vel: [0.14, 0.38, 0.1], count: 36, scale: 0.085, colA: [0.34, 0.015, 0.01], colB: [0.48, 0.09, 0.012] },
  // shot 0: green-gold leaves drifting over the water beyond the lantern
  // (box ends at x = 40.4: no leaves inside the pavilion around the lantern camera)
  { shot: 0, center: [36.4, 4.2, 18.5], size: [8, 7, 9], vel: [0.12, 0.34, 0.08], count: 26, scale: 0.1, colA: [0.12, 0.17, 0.025], colB: [0.36, 0.2, 0.03] },
];

// water-level shot facing the low sun: a breeze patch along the sun's reflection
export const POND_GLITTER = { ahead: 2.3, radius: 2.8, strength: 1.3, gustStart: 1.5, gustEnd: 4.2 };

// young rings spreading through the sun's reflection: distance ahead, lateral offset,
// period (s), starting age (s), amplitude
export const POND_RINGS = [
  { dist: 1.05, lateral: 0.06, period: 7, age: 1.0, amp: 2.2 },
  { dist: 1.7, lateral: -0.18, period: 7, age: 2.0, amp: 2.2 },
  { dist: 2.6, lateral: 0.3, period: 7, age: 0.4, amp: 2.0 },
];
