// Shot overrides owned by the pond / water cinematography.
// Shot 1: 晨露荷花 — macro looking into a sunlit blooming lotus flower with morning dewdrops,
// sliding past it and gliding low through the bed along stacked rockery shores toward the stone bridge.
// Shot 8: 倒影借景 — 13 cm above the water, facing the low sun over a beaded lotus pad,
// skimming over it and swinging up to the mirror reflection of the distant North Temple Pagoda and stone bridge.
export default {
  1: {
    name: 'Morning Lotus — macro on blooming lotus with morning dewdrops, gliding through rockery beds toward stone bridge',
    ease: 'reveal',
    keys: [
      { pos: [21.392, 0.152, 27.255], look: [20.98, -0.12, 26.88], focal: 50, focus: 0.62, fstop: 8 },
      { pos: [20.9, 0.25, 25.8], look: [12, 2.2, 12], focal: 36, focus: 3.5, fstop: 5.6 },
      { pos: [18.8, 0.32, 23.4], look: [5.5, 3.6, 7.5], focal: 26, focus: 13, fstop: 6.3 },
    ],
    near: 0.03,
    shadow: { center: [14, 1, 18], radius: 26 },
    post: { dof: true },
    pondHero: { kind: 'flower', size: 1.0, open: 0.9 },
  },
  8: {
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
    pondHero: { kind: 'pad' },
  },
};
