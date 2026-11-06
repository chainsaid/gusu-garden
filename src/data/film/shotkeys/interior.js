// Shot overrides owned by the interior module agent.
//
// Shot 6 (inner sanctum): opens 1.55 m from the golden Amida's face, a little to its left
// (camera right), on the half-closed eyes, the crescent brows, the urna and the lips. For ~1.5 s
// the camera breathes back along a slow arc; then it pulls away in one continuous accelerating
// move that swings across the face, sinks under the fringe of the great gilt canopy (the bead
// strands sweep through the top of frame) and glides back over the altar while the lens widens,
// landing low on the worshippers' axis on the whole sanctum.
// The move was authored as one continuous function sampled every 0.25 s with linear easing;
// the sampled keys are frozen literals here (data layer holds no three.js).
export default {
  6: {
    name: 'Scholar Hall - push-in from the Changchuang doors toward the landscape scroll, altar table, and armchairs',
    ease: 'linear',
    keys: [
      { pos: [10, 2.7, -15.5], look: [10, 3.1, -29.8], focal: 34, focus: 14.306, fstop: 4.5 },
      { pos: [10.054, 2.734, -15.522], look: [10, 3.1, -29.8], focal: 33.786, focus: 14.282, fstop: 4.625 },
      { pos: [10.106, 2.767, -15.587], look: [10, 3.1, -29.8], focal: 33.571, focus: 14.217, fstop: 4.75 },
      { pos: [10.157, 2.799, -15.692], look: [10, 3.1, -29.8], focal: 33.357, focus: 14.112, fstop: 4.875 },
      { pos: [10.205, 2.83, -15.832], look: [10, 3.1, -29.8], focal: 33.143, focus: 13.972, fstop: 5 },
      { pos: [10.249, 2.86, -16.006], look: [10, 3.1, -29.8], focal: 32.929, focus: 13.799, fstop: 5.125 },
      { pos: [10.289, 2.887, -16.208], look: [10, 3.1, -29.8], focal: 32.714, focus: 13.596, fstop: 5.25 },
      { pos: [10.324, 2.912, -16.437], look: [10, 3.1, -29.8], focal: 32.5, focus: 13.368, fstop: 5.375 },
      { pos: [10.352, 2.935, -16.69], look: [10, 3.1, -29.8], focal: 32.286, focus: 13.116, fstop: 5.5 },
      { pos: [10.374, 2.954, -16.961], look: [10, 3.1, -29.8], focal: 32.071, focus: 12.845, fstop: 5.625 },
      { pos: [10.39, 2.97, -17.249], look: [10, 3.1, -29.8], focal: 31.857, focus: 12.557, fstop: 5.75 },
      { pos: [10.398, 2.983, -17.55], look: [10, 3.1, -29.8], focal: 31.643, focus: 12.257, fstop: 5.875 },
      { pos: [10.4, 2.992, -17.862], look: [10, 3.1, -29.8], focal: 31.429, focus: 11.946, fstop: 6 },
      { pos: [10.394, 2.998, -18.179], look: [10, 3.1, -29.8], focal: 31.214, focus: 11.628, fstop: 6.125 },
      { pos: [10.38, 3, -18.5], look: [10, 3.1, -29.8], focal: 31, focus: 11.307, fstop: 6.25 },
      { pos: [10.36, 2.998, -18.821], look: [10, 3.1, -29.8], focal: 30.786, focus: 10.986, fstop: 6.375 },
      { pos: [10.334, 2.992, -19.138], look: [10, 3.1, -29.8], focal: 30.571, focus: 10.667, fstop: 6.5 },
      { pos: [10.301, 2.983, -19.45], look: [10, 3.1, -29.8], focal: 30.357, focus: 10.356, fstop: 6.625 },
      { pos: [10.263, 2.97, -19.751], look: [10, 3.1, -29.8], focal: 30.143, focus: 10.054, fstop: 6.75 },
      { pos: [10.22, 2.954, -20.039], look: [10, 3.1, -29.8], focal: 29.929, focus: 9.765, fstop: 6.875 },
      { pos: [10.174, 2.935, -20.31], look: [10, 3.1, -29.8], focal: 29.714, focus: 9.493, fstop: 7 },
      { pos: [10.124, 2.912, -20.562], look: [10, 3.1, -29.8], focal: 29.5, focus: 9.24, fstop: 7.125 },
      { pos: [10.071, 2.887, -20.792], look: [10, 3.1, -29.8], focal: 29.286, focus: 9.011, fstop: 7.25 },
      { pos: [10.018, 2.86, -20.994], look: [10, 3.1, -29.8], focal: 29.071, focus: 8.809, fstop: 7.375 },
      { pos: [9.964, 2.83, -21.168], look: [10, 3.1, -29.8], focal: 28.857, focus: 8.637, fstop: 7.5 },
      { pos: [9.911, 2.799, -21.308], look: [10, 3.1, -29.8], focal: 28.643, focus: 8.498, fstop: 7.625 },
      { pos: [9.859, 2.767, -21.413], look: [10, 3.1, -29.8], focal: 28.429, focus: 8.395, fstop: 7.75 },
      { pos: [9.81, 2.734, -21.478], look: [10, 3.1, -29.8], focal: 28.214, focus: 8.333, fstop: 7.875 },
      { pos: [9.765, 2.7, -21.5], look: [10, 3.1, -29.8], focal: 28, focus: 8.313, fstop: 8 },
    ],
    near: 0.06,
    shadow: { center: [10, 5, -22], radius: 22 },
    noShadow: ['vegetation', 'terrain', 'buildings', 'pagoda'],
    post: { exposure: 1.0, dof: true },
  },
};
