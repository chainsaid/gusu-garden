// ---------------------------------------------------------------------------
// Project placement facts: keep-out volumes, protected camera frames and the
// tree-top caps that keep the canopy below the sun / camera clearances.
// Declarative data only — the rules that consume it live in
// src/world/placement/rules.js.
// ---------------------------------------------------------------------------

export const PLACEMENT = {
  // horizontal direction TOWARD the sun (x,z) used by the sun-shadow band
  sun: [-0.9404, 0.3401],
  // lateral falloff of the tree cap outside the sun band
  side: 0.42,

  // keep-out volumes (absolute y): the pavilion box (hero lantern of shot 1) and the east side of the
  // pond island, low enough that the grazing WSW sun reaches the lotus bed of shot 2
  keepOut: [
    { x0: 40.9, x1: 53.1, z0: 11.9, z1: 24.1, y1: 6.0 },
    { x0: -0.2, x1: 4.0, z0: 16.0, z1: 23.0, y1: 2.7 },
    // finale opening camera (shot 9 keys 0-1): keep the 红枫 crown out of the lens
    { x0: 35.9, x1: 39.8, z0: 20.5, z1: 25.0, y1: 7.5 },
  ],

  // protected screen regions of film cameras, keyed by shot index.
  // Shot 4 = pagoda eaves: every pine keeps its pads out of the frame, only the far left edge may frame.
  pineShot: 4,
  frames: {
    4: {
      rects: [[-0.62, 1.3, -1.3, 1.3]],
      minD: 1.5,
      cams: [
        { pos: [-42.5, 1.8, 4.5], look: [-33.5, 13, -7], focal: 24 },
        { pos: [-41, 1.8, 5.5], look: [-33, 13.5, -7.25], focal: 24 },
        { pos: [-39.5, 1.8, 6.5], look: [-32.5, 14, -7.5], focal: 24 },
      ],
    },
  },

  // max tree-top height above y=0 allowed at x,z (sun shadow + camera clearances).
  //  - the corridor roof (~5-6 m) already shades the courtyard edge, so vegetation upwind only adds
  //    shade when it rises above the corridor's own shadow line: top < ~4 m + tan(6.8 deg) * D
  //  - ...and below ~2 deg as seen from the courtyard so the sunset ridges stay visible above them
  treeCap: {
    nearBase: 4.0, nearSlope: 0.105,
    farBase: 5.0, farSlope: 0.04,
    // SE crane / arrival cameras: keep tree tops well below the camera paths
    craneSegs: [[70, 26, 62, 58, 19, 48], [55, 6, 40, 80, 38, 72]],
    craneRadius: 40, craneDrop: 7, craneSlope: 0.35,
    // backlit pond-side cameras (shots 1, 8, 9) look WNW: keep the forest beyond the west corridor
    // under the corridor roofline so the ridges behind the pagoda stay visible under the low sun
    pondCone: { cx: 38, cz: 22, azMin: 120, azMax: 230, wMin: 138, wMax: 212, base: 2.0, deg: 2.6, far: 60 },
  },
};
