// Shot overrides owned by the rockery / courtyard cinematography.
// Shot 3: 太湖石透 — framing the hero Guanyun Peak (冠云峰) Taihu rockery and looking through
// its natural karst through-holes ("透"), racking focus across the pond to reveal the Water Pavilion.
export default {
  3: {
    name: 'Taihu Rockery — looking through Guanyun Peak dissolution caverns, rack focus across pond to Water Pavilion',
    ease: 'reveal',
    keys: [
      { pos: [18.2, 1.85, -0.8], look: [22.0, 2.2, -3.5], focal: 38, focus: 4.8, fstop: 3.5 },
      { pos: [17.5, 1.95, -1.8], look: [25.0, 2.0, 2.0], focal: 32, focus: 12, fstop: 4.5 },
      { pos: [16.8, 2.05, -3.0], look: [32.0, 1.8, 8.0], focal: 28, focus: 20, fstop: 5.6 },
      { pos: [16.0, 2.15, -4.2], look: [38.0, 1.6, 14.0], focal: 26, focus: 28, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [24, 2, 2], radius: 28 },
    post: { dof: true },
  },
};
