import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Camera evaluation for a shot list. Pure math: the film data is passed in, the
// caller owns it, and nothing here reads a module-level shot table.
//
// Keys: { pos, look, focal?, focus?, fstop? }. Orientation is interpolated as a
// DIRECTION (so close-up -> wide reveals pan smoothly), look distance in log space,
// lens (focal, focus, fstop) per key with fallback to the shot-level values.
// ---------------------------------------------------------------------------
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function ease(u) {
  // gentle ease in/out that keeps motion alive in the middle
  const s = u * u * (3 - 2 * u);
  return u * 0.35 + s * 0.65;
}

function easeFor(S, u) {
  const e = S.ease || 'inout';
  if (e === 'linear') return u;
  if (e === 'reveal') { // linger on the close-up, then accelerate into the reveal, soft landing
    const a = u * u * (3 - 2 * u);
    return Math.pow(a, 1.35);
  }
  return ease(u);
}

function lerpKeys(vals, u) {
  const n = vals.length - 1;
  const x = Math.min(Math.max(u, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1), f = x - i;
  return vals[i] + (vals[i + 1] - vals[i]) * f;
}

export function createShotEvaluator({ shots, duration }) {
  if (!shots || !shots.length) throw new Error('createShotEvaluator requires a shot list');

  function evalShotRaw(i, t) {
    const S = shots[i];
    const u = easeFor(S, Math.min(Math.max(t / duration, 0), 1));
    const K = S.keys;
    const P = K.map((k) => V(k.pos));
    const D = K.map((k) => V(k.look).sub(V(k.pos)));
    const LD = D.map((d) => Math.log(Math.max(d.length(), 0.05)));
    D.forEach((d) => d.normalize());
    let pos, dir;
    if (K.length === 2) {
      pos = P[0].clone().lerp(P[1], u);
      dir = D[0].clone().lerp(D[1], u).normalize();
    } else {
      pos = new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.5).getPoint(u);
      dir = new THREE.CatmullRomCurve3(D, false, 'catmullrom', 0.5).getPoint(u).normalize();
    }
    const ld = Math.exp(lerpKeys(LD, u));
    const look = pos.clone().addScaledVector(dir, ld);
    const focal = lerpKeys(K.map((k) => k.focal ?? S.focal ?? 35), u);
    const fstop = lerpKeys(K.map((k) => k.fstop ?? S.fstop ?? 8), u);
    let focusDist;
    if (K.some((k) => k.focus !== undefined)) focusDist = Math.exp(lerpKeys(K.map((k, j) => Math.log(k.focus ?? (S.focus === 'look' || S.focus === undefined ? Math.exp(LD[j]) : S.focus))), u));
    else focusDist = S.focus === 'look' ? ld : S.focus;
    return {
      index: i, noShadow: S.noShadow || null,
      pos, look,
      focal, near: S.near || 0.12, far: S.far || 6000,
      focusDist, fstop,
      roll: S.roll || 0,
      shadow: S.shadow, post: S.post || {},
    };
  }

  // Optional temporal smoothing (S.smooth = Gaussian sigma in seconds): averages the raw
  // camera over neighbouring times, removing acceleration snaps from hand-made keys.
  function evalShot(i, t) {
    const S = shots[i];
    const sg = S.smooth || 0;
    if (!sg) return evalShotRaw(i, t);
    const c = evalShotRaw(i, t);
    const pos = new THREE.Vector3(), dir = new THREE.Vector3();
    let wsum = 0, ld = 0, focal = 0;
    const E = duration - 1e-4;
    // point-reflection extrapolation beyond the shot ends keeps velocity continuous
    const sample = (tk) => {
      if (tk >= 0 && tk <= E) return evalShotRaw(i, tk);
      const edge = tk < 0 ? 0 : E, mir = tk < 0 ? -tk : 2 * E - tk;
      const a = evalShotRaw(i, edge), b = evalShotRaw(i, Math.min(Math.max(mir, 0), E));
      const da = a.look.clone().sub(a.pos), db = b.look.clone().sub(b.pos);
      const la = da.length(), lb = db.length();
      da.divideScalar(la); db.divideScalar(lb);
      a.pos = a.pos.clone().multiplyScalar(2).sub(b.pos);
      const d = da.multiplyScalar(2).sub(db).normalize();
      a.look = a.pos.clone().addScaledVector(d, Math.exp(2 * Math.log(la) - Math.log(lb)));
      a.focal = 2 * a.focal - b.focal;
      return a;
    };
    for (let k = -6; k <= 6; k++) {
      const tk = t + (k / 6) * 2.5 * sg;
      const w = Math.exp(-0.5 * ((k / 6) * 2.5) ** 2);
      const ck = sample(tk);
      pos.addScaledVector(ck.pos, w);
      const d = ck.look.clone().sub(ck.pos); const l = d.length();
      dir.addScaledVector(d.divideScalar(l), w); ld += Math.log(l) * w; focal += ck.focal * w; wsum += w;
    }
    pos.divideScalar(wsum); dir.normalize();
    c.pos = pos; c.look = pos.clone().addScaledVector(dir, Math.exp(ld / wsum)); c.focal = focal / wsum;
    return c;
  }

  return { shots, duration, evalShot, evalShotRaw };
}
