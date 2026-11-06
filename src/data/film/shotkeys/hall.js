// Shot overrides owned by the hall / eaves architecture cinematography.
export default {
  // Shot 5: 飞檐发戗 — low-angle rising crane under the south-west soaring eave corner (发戗起翘),
  // framing the high lifted hip rafter, flying rafters, cyan dripping tiles, and bronze wind chime.
  5: {
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
};
