// Shot overrides owned by the bridge / flora cinematography.
// Shot 2: 芭蕉听雨 — macro on backlit Musa basjoo banana leaves with glistening dewdrops,
// craning up and panning across the courtyard to reveal the Scholar Hall Changchuang lattice doors.
export default {
  2: {
    name: 'Banana Palms — backlit dewdrops on translucent banana leaves, craning and panning to Scholar Hall Changchuang doors',
    ease: 'reveal',
    keys: [
      { pos: [27.2, 2.1, -9.4], look: [25.5, 2.0, -10.5], focal: 42, focus: 1.2, fstop: 3.2 },
      { pos: [26.0, 2.35, -8.3], look: [22.5, 2.3, -11.5], focal: 36, focus: 3.2, fstop: 4.5 },
      { pos: [23.5, 2.65, -6.8], look: [16.0, 2.8, -13.0], focal: 30, focus: 10, fstop: 5.6 },
      { pos: [21.5, 2.8, -5.5], look: [13.0, 2.9, -15.0], focal: 26, focus: 18, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [20, 2, -10], radius: 26 },
    post: { dof: true },
  },
};
