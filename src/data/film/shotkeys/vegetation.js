// Shot overrides owned by the vegetation module agent.
//
// Shot 9 (finale): opens 0.62 m from a backlit 红枫 spray hanging over the pond's south-east
// shore, looking west into the low sun (the sun itself peeks out behind one blade; gate, bridge and
// water melt into bokeh behind the glowing leaves). For ~1.8 s the camera breathes sideways around
// the spray (parallax through the layered blades, the sun flickering behind a lobe), then lifts
// straight up over the spray while the focus racks through the leaves onto the pagoda and bridge,
// and cranes up and back over the south-east shore, yawing north-west, to land high above the
// south-east corner on the whole precinct.
// The move was authored as one continuous function (arc-length path + speed profile + look / lens
// curves) sampled every 0.25 s with linear easing; the sampled keys are frozen literals here
// (data layer holds no three.js). The macro spray in world/vegetation-hero.js is laid out in the
// frame of keys[0].
export default {
  9: {
    name: 'Jiangnan Twilight — grand aerial rising crane overlooking pink walls, cyan tiles, winding water, and evening mist',
    ease: 'linear',
    keys: [
      { pos: [36.9, 2.6, 24.6], look: [36.294, 2.638, 24.725], focal: 45, focus: 0.62, fstop: 2.8 },
      { pos: [36.906, 2.603, 24.576], look: [36.294, 2.638, 24.725], focal: 45, focus: 0.631, fstop: 2.8 },
      { pos: [36.912, 2.604, 24.552], look: [36.294, 2.638, 24.725], focal: 45, focus: 0.643, fstop: 2.8 },
      { pos: [36.918, 2.606, 24.528], look: [36.294, 2.638, 24.725], focal: 45, focus: 0.655, fstop: 2.8 },
      { pos: [36.925, 2.609, 24.504], look: [36.294, 2.638, 24.725], focal: 45, focus: 0.669, fstop: 2.8 },
      { pos: [36.932, 2.617, 24.481], look: [36.294, 2.638, 24.725], focal: 45, focus: 0.684, fstop: 2.8 },
      { pos: [36.941, 2.629, 24.461], look: [36.294, 2.638, 24.725], focal: 45, focus: 0.699, fstop: 2.8 },
      { pos: [36.951, 2.646, 24.44], look: [36.293, 2.636, 24.727], focal: 45, focus: 0.718, fstop: 2.8 },
      { pos: [36.98, 2.704, 24.389], look: [36.282, 2.672, 24.702], focal: 45, focus: 0.736, fstop: 2.8 },
      { pos: [37.043, 2.852, 24.296], look: [35.989, 2.836, 24.673], focal: 44.814, focus: 1.678, fstop: 3.238 },
      { pos: [37.144, 3.088, 24.176], look: [34.926, 3.098, 24.664], focal: 43.78, focus: 12.934, fstop: 4.2 },
      { pos: [37.302, 3.406, 24.028], look: [31.834, 3.532, 24.314], focal: 42.056, focus: 30, fstop: 5.163 },
      { pos: [37.643, 3.957, 23.712], look: [24.159, 4.462, 22.139], focal: 39.888, focus: 30, fstop: 5.6 },
      { pos: [38.341, 4.942, 23.204], look: [9.231, 6.125, 15.732], focal: 37.523, focus: 30, fstop: 5.6 },
      { pos: [39.631, 6.387, 23.705], look: [-8.93, 7.775, 6.428], focal: 35.207, focus: 30.071, fstop: 5.61 },
      { pos: [41.24, 7.835, 25.643], look: [-14.362, 8.251, 3.099], focal: 33.188, focus: 30.84, fstop: 5.717 },
      { pos: [43.218, 9.617, 28.221], look: [-11.706, 8.386, 4.1], focal: 31.71, focus: 32.406, fstop: 5.926 },
      { pos: [45.644, 11.985, 31.18], look: [-8.39, 8.654, 5.311], focal: 31.021, focus: 34.742, fstop: 6.22 },
      { pos: [48.313, 14.637, 34.501], look: [-4.613, 9.076, 6.789], focal: 30.922, focus: 37.844, fstop: 6.581 },
      { pos: [51.122, 17.401, 38.033], look: [-0.546, 9.665, 8.527], focal: 30.63, focus: 41.709, fstop: 6.992 },
      { pos: [53.924, 20.067, 41.568], look: [3.567, 10.368, 10.422], focal: 30.166, focus: 46.316, fstop: 7.435 },
      { pos: [56.568, 22.502, 44.928], look: [7.496, 11.115, 12.337], focal: 29.579, focus: 51.605, fstop: 7.892 },
      { pos: [58.938, 24.648, 47.957], look: [11.062, 11.842, 14.136], focal: 28.915, focus: 57.449, fstop: 8.345 },
      { pos: [60.963, 26.467, 50.551], look: [14.151, 12.496, 15.715], focal: 28.223, focus: 63.635, fstop: 8.777 },
      { pos: [62.607, 27.942, 52.658], look: [16.7, 13.041, 17.014], focal: 27.55, focus: 69.841, fstop: 9.17 },
      { pos: [63.875, 29.08, 54.282], look: [18.691, 13.469, 18.023], focal: 26.943, focus: 75.632, fstop: 9.507 },
      { pos: [64.805, 29.919, 55.473], look: [20.15, 13.802, 18.783], focal: 26.451, focus: 80.476, fstop: 9.769 },
      { pos: [65.476, 30.525, 56.331], look: [21.142, 14.095, 19.39], focal: 26.121, focus: 83.787, fstop: 9.939 },
      { pos: [66, 31, 57], look: [21.792, 14.422, 19.976], focal: 26, focus: 85, fstop: 10 },
    ],
    near: 0.05,
    shadow: { center: [12, 0, 8], radius: 78 },
    post: { fog: 0.65, exposure: 0.95, dof: true, bloom: 0.015 },
  },
};
