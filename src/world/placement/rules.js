// ---------------------------------------------------------------------------
// Placement rules: the Jiangnan-garden avoidance policy. It decides which
// screen rectangles / keep-out volumes are protected, the tree-top cap of a
// point and the camera clearance for pond planting. Geometry lives in
// src/core/spatial.js; site facts come in through `data` (never imported).
// ---------------------------------------------------------------------------
import { frameBasis, screenBlocked, boxBlocked } from '../../core/spatial.js';

const DEG = Math.PI / 180;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Sun-shadow band of the site: distance travelled toward the shadow direction
// before entering the courtyard rectangle, plus the lateral distance out of
// the band. Pure geometry of the site rectangle + sun azimuth.
export function createSunBand({ rect, sun }) {
  const R = rect;
  function sunUpwind(x, z) {
    const dx = -sun[0], dz = -sun[1];
    let t0 = -Infinity, t1 = Infinity;
    for (const [p, d, lo, hi] of [[x, dx, R.minX - 2, R.maxX + 2], [z, dz, R.minZ - 2, R.maxZ + 2]]) {
      if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return Infinity; continue; }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t1 < Math.max(t0, 0)) return Infinity;
    return Math.max(t0, 0);
  }
  const SD = [-sun[0], -sun[1]], SNn = [-SD[1], SD[0]];
  let latMin = Infinity, latMax = -Infinity;
  for (const [cx, cz] of [[R.minX - 2, R.minZ - 2], [R.maxX + 2, R.minZ - 2], [R.minX - 2, R.maxZ + 2], [R.maxX + 2, R.maxZ + 2]]) {
    const l = cx * SNn[0] + cz * SNn[1]; latMin = Math.min(latMin, l); latMax = Math.max(latMax, l);
  }
  function sunBand(x, z) {
    const lat = x * SNn[0] + z * SNn[1];
    const lc = clamp(lat, latMin + 0.5, latMax - 0.5);
    const s = lc - lat;
    return [sunUpwind(x + SNn[0] * s, z + SNn[1] * s), Math.abs(s)];
  }
  return { sunUpwind, sunBand };
}

export function createPlacementRules({ L, data }) {
  const { sunUpwind, sunBand } = createSunBand({ rect: L.corridor.rect, sun: data.sun });
  const side = data.side;
  const keepOut = data.keepOut;

  // max tree-top height above y=0 allowed at x,z (sun shadow + camera clearances)
  function capHeight(x, z) {
    const [D, dl] = sunBand(x, z);
    const cap0 = data.treeCap;
    let cap = D === Infinity ? Infinity : Math.min(cap0.nearBase + cap0.nearSlope * D, cap0.farBase + cap0.farSlope * D) + side * dl;
    for (const [ax, ay, az, bx, by, bz] of cap0.craneSegs) {
      const ex = bx - ax, ez = bz - az;
      const t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez), 0, 1);
      const dd = Math.hypot(x - (ax + ex * t), z - (az + ez * t));
      if (dd < cap0.craneRadius) cap = Math.min(cap, lerp(ay, by, t) - cap0.craneDrop + dd * cap0.craneSlope);
    }
    const C = cap0.pondCone;
    {
      const dx = x - C.cx, dz = z - C.cz;
      const az = Math.atan2(-dz, dx) / DEG;
      if (az > C.azMin && az < C.azMax) {
        const w = smoothstep(C.azMin, C.wMin, az) * smoothstep(C.azMax, C.wMax, az);
        const vc = C.base + Math.hypot(dx, dz) * Math.tan(C.deg * DEG);
        cap = Math.min(cap, vc + (1 - w) * C.far);
      }
    }
    return cap;
  }

  function inKeep(p, m = 0.1) {
    for (const B of keepOut) if (p.x > B.x0 - m && p.x < B.x1 + m && p.z > B.z0 - m && p.z < B.z1 + m && p.y < B.y1 + m) return true;
    return false;
  }

  // protected screen regions of a film shot, as camera frames for screenBlocked()
  function protectedFrames(shot) {
    const F = data.frames[shot];
    if (!F) return [];
    return F.cams.map((c) => frameBasis(c.pos, c.look, c.focal, F.rects, F.minD));
  }
  const pineFrames = protectedFrames(data.pineShot);

  // pines: pads stay out of the protected frames and out of the keep-out volumes
  function pineBlocked(c, r) {
    return screenBlocked(pineFrames, c, r, 0.9) || boxBlocked(keepOut, c, r, r * 0.8);
  }

  // camera clearance against every pond-skimming path (per sampled camera).
  // `paths` are the sampled camera paths, `keepClear` the growing list of
  // sight lines camera -> hero flower.
  function pondClearance({ paths, keepClear, waterY, rng }) {
    const heroPath = paths.find((p) => p.kind === 'flower') || null;
    function camOK(x, z, rad, h, floating, isHero) {
      if (!floating && !isHero) {
        for (const s of keepClear) {
          const dx = s.bx - s.ax, dz = s.bz - s.az;
          const l2 = dx * dx + dz * dz || 1;
          const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / l2, 0, 1);
          const d = Math.hypot(s.ax + dx * t - x, s.az + dz * t - z);
          if (d > rad + 0.08 || t > 0.97) continue;
          const lh = s.ah + (s.bh - s.ah) * t;
          if (h > lh - 0.24 && h < lh + 0.14) return false;
        }
      }
      for (const p of paths) {
        for (let k = 0; k < p.pts.length; k++) {
          const pt = p.pts[k];
          const c = pt.pos, lk = pt.look;
          let fx = lk[0] - c[0], fz = lk[2] - c[2];
          const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
          const vx = x - c[0], vz = z - c[2];
          const d = Math.hypot(vx, vz);
          const camH = c[1] - waterY;
          if (d < rad + 0.1) return false;
          if (!floating && d < rad + 0.4 && h > camH - 0.55) return false;
          const fwd = vx * fx + vz * fz, lat = Math.abs(-vx * fz + vz * fx);
          const wide = (pt.focal ?? 35) < 30;
          if (p.kind === 'pad') {
            if (wide) { if (fwd > 0 && fwd < 9.5 && lat < fwd * 0.42 + 0.4) { if (!floating || rng.chance(0.8)) return false; } }
            else if (!floating && !isHero && fwd > -0.3 && fwd < 4.0 && lat < fwd * 0.55 + 0.4) return false;
          } else if (!isHero && !floating) {
            // lotus glide: a lane ahead of the lens stays below the eye line
            if (fwd > 0.2 && fwd < 7.5 && lat < fwd * 0.13 + 0.32 && h + rad * 0.4 > camH - 0.26) return false;
            // the final 26 mm frame keeps the bridge / hall view open
            if (wide && fwd > 0.5 && fwd < 11 && lat < fwd * 0.3 + 0.3 && h > camH - 0.1) return false;
          }
        }
      }
      return true;
    }
    const heroDist = (x, z) => {
      if (!heroPath) return 1e9;
      let best = 1e9;
      for (const pt of heroPath.pts) best = Math.min(best, Math.hypot(pt.pos[0] - x, pt.pos[2] - z));
      return best;
    };
    // closest approach of the lens to (x, z) with the lens height at that moment
    const lensPass = (x, z) => {
      let best = 1e9, hh = 0;
      for (const p of paths) for (const pt of p.pts) {
        const d = Math.hypot(pt.pos[0] - x, pt.pos[2] - z);
        if (d < best) { best = d; hh = pt.pos[1] - waterY; }
      }
      return { d: best, camH: hh };
    };
    return { camOK, heroDist, lensPass };
  }

  return { capHeight, inKeep, keepOut, protectedFrames, pineFrames, pineBlocked, pondClearance, screenBlocked, boxBlocked };
}
