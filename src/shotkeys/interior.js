// Shot overrides owned by the interior module agent.
// export default { <shotIndex>: { keys: [...], ease, shadow, post, near, noShadow, ... } }
// Fields given here REPLACE the base definition in src/shots.js for that shot.
//
// Shot 6 (inner sanctum): opens 1.55 m from the golden Amida's face, a little to its left
// (camera right), on the half-closed eyes, the crescent brows, the urna and the lips. For ~1.5 s
// the camera breathes back along a slow arc; then it pulls away in one continuous accelerating
// move that swings across the face, sinks under the fringe of the great gilt canopy (the bead
// strands sweep through the top of frame) and glides back over the altar while the lens widens,
// landing low on the worshippers' axis on the whole sanctum.
// The move is one continuous function sampled every 0.25 s with linear easing.
import * as THREE from 'three';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// quintic smootherstep (zero velocity AND acceleration at both ends: no kink where it hands over)
const s5 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * t * (t * (6 * t - 15) + 10); };
const DUR = 7.0;

export function scholarHall() {
  const keys = [];
  const DUR = 7.0;
  for (let k = 0; k <= 28; k++) {
    const t = (k / 28) * DUR;
    const u = t / DUR;
    // Smooth push-in from z = -15.5 to z = -21.5 across the polished floor
    const s = u * u * (3 - 2 * u);
    const z = -15.5 - 6.0 * s;
    const y = 2.7 + 0.3 * Math.sin(u * Math.PI);
    const x = 10.0 + 0.4 * Math.sin(u * Math.PI * 1.2);
    const pos = [x, y, z];
    const look = [10.0, 3.1, -29.8]; // Aimed at landscape scroll, altar table & armchairs
    const focal = 28 + 6 * (1 - u);
    const focus = Math.hypot(x - 10, y - 3.1, z - (-29.8));
    const fstop = 4.5 + 3.5 * u;
    const q = (v) => Math.round(v * 1000) / 1000;
    keys.push({ pos: pos.map(q), look: look.map(q), focal: q(focal), focus: q(focus), fstop: q(fstop) });
  }
  return keys;
}

export default {
  6: {
    name: 'Scholar Hall - push-in from the Changchuang doors toward the landscape scroll, altar table, and armchairs',
    ease: 'linear',
    keys: scholarHall(),
    near: 0.06,
    shadow: { center: [10, 5, -22], radius: 22 },
    noShadow: ['vegetation', 'terrain', 'buildings', 'pagoda'],
    post: { exposure: 1.0, dof: true },
  },
};
