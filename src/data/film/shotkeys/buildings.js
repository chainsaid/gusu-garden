// Shot overrides owned by the corridor & pavilion architecture cinematography.
export default {
  // Shot 4: 漫步曲廊 — gliding along the promenade covered corridor with dappled bamboo
  // shadows dancing on the white plaster wall, chestnut columns, and openwork leak windows.
  4: {
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
  // Shot 7: 柳影拂水 — at the Water Pavilion (水榭), weeping willow fronds swaying over
  // the curved Meirenakao (美人靠) bench, gliding low over rippling pond water and stone spurs.
  7: {
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
};
