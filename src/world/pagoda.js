// ---------------------------------------------------------------------------
// 借景·北寺塔 (Beisi Pagoda) — a nine-storey tower standing outside the garden and
// borrowed into it as distant scenery. Fully procedural.
//
// Side-local frame: every side j (0..NS-1, NS = 8) is generated in a local frame
// (x = lateral along the wall, y = up, p = outward distance from the centre)
// and rotated by j*90deg about the pagoda axis. Corner elements belong to the
// side's -x corner so nothing is generated twice.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as PP from './pagoda-parts.js';
import { seg as dseg, gap } from '../core/detail.js';
import { woodProc, capGoldProc, goldProc, tileProc } from './pagoda-mat.js';

const { V3 } = PP;

// eave section constants (metres)
const TH = 0.32; // tile surface -> top of flying rafters (outer soffit)
const JD = 0.13; // flying rafter top -> base rafter top (inner soffit)
const RH = 0.11; // rafter height
const RW = 0.106; // rafter width (rafters nearly as wide as the gaps)

export function makeStoreys(L) {
  const P = L.pagoda;
  const NST = P.stories || 5;
  // the plan is a regular NS-gon. NS = 4 reproduces the old square pagoda exactly:
  // every formula in this file is written in terms of TAN = tan(pi/NS), SEC = 1/cos(pi/NS).
  const NS = P.sides || 8;
  const TAN = Math.tan(Math.PI / NS);
  const S = [];
  // per-storey width multiplier; the taper keeps going gently all the way up a
  // nine-storey tower instead of flattening out after the fifth
  const kk = [1, 0.95, 0.91, 0.875, 0.85, 0.83, 0.81, 0.795, 0.78, 0.77];
  let F = P.platform.h + 0.16;
  for (let i = 0; i < NST; i++) {
    const k = kk[i] ?? 0.85;
    const s = { i, k, top: i === NST - 1 };
    s.kv = 0.85 * k; // vertical scale of the bracket tiers
    s.a = (P.baseWidth * Math.pow(P.shrink, i)) / 2;   // apothem: wall plane to the axis
    s.h = s.a * TAN;                                   // lateral half-extent of one face
    s.F = F;
    // 报恩寺塔: nine storeys from the 基台 top to the 塔刹 base span
    // 76 - 15.2 = 60.8 m, i.e. ~6.6 m per storey (the bottom storey, which
    // carries the 副阶, is the tallest).
    s.Hc = i === 0 ? 5.31 : 3.03 - 0.031 * (i - 1);
    s.T = F + s.Hc;
    s.p1 = s.a + 0.46 * k; s.p2 = s.a + 0.92 * k; s.p3 = s.a + 1.38 * k;
    s.gh = 0.22 * s.kv; // gangyo (eave purlin) height
    s.yG = s.T + 1.64 * s.kv; // gangyo top at mid-side
    // 底层副阶深出檐 3.4m, 二至九层腰檐出檐 2.10m(外挑擎檐柱外约 0.9m)
    s.O = (i === 0 ? 3.4 : 2.10) * Math.pow(k, 0.5);
    s.flare = 0.36 * k;
    s.lift = (s.top ? 0.88 : 0.70) * k;
    s.liftExp = 3.4;
    s.Xc = (s.a + s.O + s.flare) * TAN;   // lateral half-extent of the eave at the corner
    s.Rt = s.top ? 0.42 : (P.baseWidth * Math.pow(P.shrink, i + 1)) / 2 + 0.12;
    s.qa = s.top ? 0.28 : 0.38;
    const run = s.a + s.O - s.Rt;
    const rise = (s.top ? 0.6 : 0.44) * run;
    const t3 = (s.a + s.O - s.p3) / run;
    const Q3 = s.qa * t3 + (1 - s.qa) * t3 * t3;
    s.Ye = s.yG + RH + JD + TH - rise * Q3;
    s.Yt = s.Ye + rise;
    F = s.Yt + 0.32;
    S.push(s);
  }
  return S;
}

// --- roof surface ---------------------------------------------------------
const AX = (s, x) => Math.min(Math.abs(x) / s.Xc, 1);
export function pTip(s, x) { const A = AX(s, x); return s.a + s.O + s.flare * A * A * A; }
export function roofY(s, x, p) {
  const A = AX(s, x);
  const pt = s.a + s.O + s.flare * A * A * A;
  const t = (pt - p) / (pt - s.Rt);
  const tc = Math.max(t, -0.4);
  const Q = s.qa * tc + (1 - s.qa) * tc * tc;
  const l = 1 - Math.min(Math.max(t, 0), 1);
  const kick = A > 0.62 ? Math.pow((A - 0.62) / 0.38, 2.8) * 0.24 : 0;
  return s.Ye + (s.Yt - s.Ye) * Q + (s.lift * Math.pow(A, s.liftExp) + kick) * l * l;
}
const TAN_DEF = Math.tan(Math.PI / 8);
// fixed point x = f(x) * TAN (corner on the diagonal for NS-gon)
const fixX = (f, x0, tan = TAN_DEF) => { let x = x0; for (let i = 0; i < 40; i++) x = f(x) * tan; return x; };

export async function build(ctx) {
  const { M, geom, L, mat } = ctx;
  const PG = L.pagoda;
  const C = PG.center;
  const S = makeStoreys(L);
  // The borrowed tower stands outside the courtyard grid, so its foot has to be
  // taken from the landscape rather than from the (flat, y = 0) courtyard.
  const _terr = ctx.modules && ctx.modules.terrain;
  const _gy = _terr && typeof _terr.heightAt === 'function' ? _terr.heightAt(C[0], C[2]) : 0;
  const CY = Number.isFinite(_gy) ? _gy : C[1];
  const root = new THREE.Group();
  root.name = 'pagoda';
  root.position.set(C[0], CY, C[2]);
  const B = new geom.Builder();
  const I = new PP.InstSet();
  // 八角 plan: NS faces, each rotated TAU/NS about the tower axis. NS = 4 gives
  // the old square plan back, so nothing below is hard-coded to four sides.
  const NS = PG.sides || 8;
  const TAU = Math.PI * 2;
  const TAN = Math.tan(Math.PI / NS), SEC = 1 / Math.cos(Math.PI / NS);
  const SN = Math.sin(Math.PI / NS), CS = Math.cos(Math.PI / NS);
  const R = Array.from({ length: NS }, (_, j) => new THREE.Matrix4().makeRotationY((j * TAU) / NS));
  const anchors = { bells: [], hangingLanterns: [] };

  // ---------------------------------------------------------------- materials
  // Backlight rig: when the camera looks toward the low sun across the pagoda (shots 1/8/9)
  // the shadow side picks up warm bounce from the sunlit ground/water and the golden sky, gilt
  // fittings glint, and sunlit grazing edges read as a warm rim. Weight pgB is constant over the
  // building (camera->pagoda azimuth vs sun azimuth), ~0 in front-lit shots (0, 4) and side-lit 7.
  const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const qv = (k, d) => (QP.has(k) ? QP.get(k).split(',').map(Number) : d);
  const g3 = (a) => `vec3(${a.map((v) => (+v).toFixed(4)).join(', ')})`;
  const RIG = {
    fill: qv('pgfill', [1.1, 0.7, 0.32]), // indirect diffuse boost (shadow side)
    rim: qv('pgrim', [0.0, -0.15, -0.3]), // direct diffuse change of sunlit grazing wood (keeps the sunlit undersides from blowing out)
    gold: qv('pggold', [2.2, 1.6, 0.7]), // indirect specular boost of gilt metal
    tile: qv('pgtile', [1.4, 1.3, 1.2]), // indirect specular boost of the tiles (sky glints on tile rows)
    wall: qv('pgwall', [0.85, 0.68, 0.40]), // plaster fill
    wallSun: qv('pgwsun', [-0.08, -0.09, -0.12]), // soft direct grazing attenuation (preserves warm ochre glow)
  };
  // Sun glare cap: in the backlit views the south faces sit in the mirror direction between the
  // low sun and the camera, so glossy lacquer/gilt end faces flare to pure white. They should read
  // as warm gold glints -> soft-cap the direct (sun) specular, preserving hue.
  const CAP = { gold: qv('pgcapg', [2.2])[0], wood: qv('pgcapw', [0.45])[0] };
  const capGLSL = (v, cap) => `{ float _m = max(max(${v}.r, ${v}.g), max(${v}.b, 1e-5)); float _c = mix(1e5, ${cap.toFixed(3)}, pgB); ${v} *= _c / max(_m, _c); }`;
  const rigGLSL = (kind) => /* glsl */ `
    {
      vec2 pgV = normalize(vec2(${C[0].toFixed(3)}, ${C[2].toFixed(3)}) - cameraPosition.xz);
      float pgB = smoothstep(0.15, 0.55, dot(pgV, normalize(uSunDir.xz)));
      ${kind === 'gold' ? `reflectedLight.indirectSpecular *= 1.0 + pgB * ${g3(RIG.gold)};
      ${capGLSL('reflectedLight.directSpecular', CAP.gold)}` : ''}
      ${kind === 'wood' ? `reflectedLight.indirectDiffuse *= 1.0 + pgB * ${g3(RIG.fill)};
      reflectedLight.directDiffuse *= 1.0 + pgB * ${g3(RIG.rim)};
      ${capGLSL('reflectedLight.directSpecular', CAP.wood)}
      #ifdef USE_CLEARCOAT
      ${capGLSL('clearcoatSpecularDirect', CAP.wood * 2.0)}
      #endif` : ''}
      ${kind === 'tile' ? `reflectedLight.indirectSpecular *= 1.0 + pgB * ${g3(RIG.tile)};
      reflectedLight.indirectDiffuse *= 1.0 + pgB * ${g3(RIG.fill)} * 0.5;` : ''}
      ${kind === 'wall' ? `reflectedLight.indirectDiffuse *= 1.0 + pgB * ${g3(RIG.wall)};
      reflectedLight.directDiffuse *= 1.0 + pgB * ${g3(RIG.wallSun)};` : ''}
    }`;
  const rig = (proc, kind) => ({ ...proc, fragLight: (proc.fragLight || '') + rigGLSL(kind) });
  const P = mat.PROC;
  const MT = {
    // 北寺塔: 砖身抹赭黄, 木构髹红棕 (vermilion-red-brown), 铁件乌黑
    red: mat.phys({ color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 }, rig(woodProc('vec3(0.34, 0.13, 0.06)', C, { wear: 0.8 }), 'wood')),
    redDark: mat.phys({ color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.5 }, rig(woodProc('vec3(0.22, 0.085, 0.04)', C, { wear: 0.6 }), 'wood')),
    iron: mat.std({ color: 0x46464a, roughness: 0.5, metalness: 0.85 }, rig(goldProc('vec3(0.10, 0.10, 0.11)'), 'gold')),
    gold: mat.std({ color: 0xffffff, roughness: 0.5, metalness: 0.6 }, rig(goldProc('vec3(0.12, 0.11, 0.10)'), 'gold')),
    capGold: mat.std({ color: 0xffffff, roughness: 0.5, metalness: 0.6 }, rig(capGoldProc('vec3(0.12, 0.11, 0.10)'), 'gold')),
    capSatin: mat.std({ color: 0xffffff, roughness: 0.5, metalness: 0.6 }, rig(capGoldProc('vec3(0.12, 0.11, 0.10)'), 'gold')),
    tile: mat.std({ color: 0xffffff, roughness: 0.42, metalness: 0.12 }, rig(P.roofTile(), 'tile')),
    tileRound: mat.std({ color: 0xffffff, roughness: 0.42, metalness: 0.12 }, rig(tileProc('round'), 'tile')),
    tileFlat: mat.std({ color: 0xffffff, roughness: 0.45, metalness: 0.1 }, rig(tileProc('flat'), 'tile')),
    // 赭黄砖身 plaster (the brick body is lime-washed warm ochre)
    plaster: mat.std({ color: 0xd6a858, roughness: 0.92, metalness: 0 }, rig(P.plaster(), 'wall')),
    // 窗格木框: dark red-brown wood
    green: mat.std({ color: 0xffffff, roughness: 0.6, metalness: 0 }, rig(P.chestnutWood('vec3(0.16, 0.07, 0.04)'), 'wood')),
    dark: M.woodDark,
    granite: M.granite,
    graniteC: M.graniteClean,
    soffit: mat.std({ color: 0xffffff, roughness: 0.66, metalness: 0 }, rig(woodProc('vec3(0.20, 0.085, 0.045)', C, { wear: 0.0, grime: 0.6, planks: true }), 'wood')),
    // stained red-brown wood of the eave structure (brackets, rafters, purlins)
    wood: mat.phys({ color: 0xffffff, roughness: 0.58, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.5 }, rig(woodProc('vec3(0.26, 0.10, 0.05)', C), 'wood')),
    goldSatin: mat.std({ color: 0xffffff, roughness: 0.5, metalness: 0.6 }, rig(goldProc('vec3(0.12, 0.11, 0.10)'), 'gold')),
    spireGold: mat.std({ color: 0xffffff, roughness: 0.45, metalness: 0.7 }, rig(goldProc('vec3(0.15, 0.14, 0.13)'), 'gold')),
    // 鎏金摩尼宝珠 (gilded apex pearl and crescent)
    pearlGold: mat.std({ color: 0xffffff, roughness: 0.22, metalness: 0.88 }, rig(goldProc('vec3(0.96, 0.74, 0.28)'), 'gold')),
  };

  // ---------------------------------------------------------------- helpers
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const m4 = (j, x, y, p, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Matrix4().compose(_p.set(x, y, p), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
    if (j !== null && j !== undefined) m.premultiply(R[j]);
    return m;
  };
  const basisM = (j, pos, xA, yA, zA, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Matrix4().makeBasis(xA.clone().multiplyScalar(sx), yA.clone().multiplyScalar(sy), zA.clone().multiplyScalar(sz));
    m.setPosition(pos);
    if (j !== null && j !== undefined) m.premultiply(R[j]);
    return m;
  };
  const box = (j, mt, w, h, d, x, y, p, ry = 0, c = 0.012, rx = 0) => B.add(PP.chamferBox(w, h, d, c), mt, m4(j, x, y, p, rx, ry));
  const addG = (j, g, mt) => B.add(g, mt, j === null || j === undefined ? null : R[j]);
  const UP = V3(0, 1, 0);
  // gold cap on a member end. pos = centre of end face, dir = outward axis.
  const capAt = (j, pos, dir, w, h, up = UP) => {
    const z = dir.clone().normalize();
    let x = V3().crossVectors(up, z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    const y = V3().crossVectors(z, x).normalize();
    I.add(w * h > 0.03 ? 'capBig' : 'cap', basisM(j, pos.clone().addScaledVector(z, -0.012), x, y, z, w * 1.08, h * 1.08, 1));
  };
  // carved scroll eye on a side face: pos on the face, n = outward face normal
  const eyeAt = (j, pos, n, sc) => {
    const z = n.clone().normalize();
    const xA = V3().crossVectors(UP, z).normalize();
    I.add('armEye', basisM(j, pos, xA, UP, z, sc, sc, sc));
  };
  // projecting arm along +p, bottom y0
  const armP = (j, x, y0, pA, pB, h, w, cap = true) => {
    I.add('arm', m4(j, x, y0, (pA + pB) / 2, 0, -Math.PI / 2, 0, pB - pA, h / 0.24, w / 0.14));
    if (cap) {
      capAt(j, V3(x, y0 + h * 0.72, pB), V3(0, 0, 1), w, h * 0.5);
      const sc = h / 0.24;
      for (const sx of [-1, 1]) eyeAt(j, V3(x + sx * (w / 2 - 0.002), y0 + h * 0.56, pB - 0.13 * sc), V3(sx, 0, 0), sc);
    }
  };
  const toWorld = (j, v) => (j === null || j === undefined ? v.clone() : v.clone().applyMatrix4(R[j])).add(new THREE.Vector3(C[0], CY, C[2]));

  // ---------------------------------------------------------------- instanced parts
  I.def('daito', PP.masuCoveGeo(0.58, 0.34, { c: 0.016 }), MT.wood, { jitter: 0.07, tint: [0.1, -0.05, -0.1] });
  I.def('makito', PP.masuCoveGeo(0.30, 0.18), MT.wood, { jitter: 0.08, tint: [0.1, -0.05, -0.1] });
  I.def('arm', PP.armGeo(0.24, 0.14, 1), MT.wood, { jitter: 0.06, tint: [0.1, -0.05, -0.1] });
  I.def('armEye', PP.armEyeGeo(), MT.wood, { jitter: 0.06, tint: [0.1, -0.05, -0.1] });
  I.def('rafter', PP.chamferBox(RW, RH, 1, 0.012), MT.wood, { jitter: 0.09, tint: [0.12, -0.04, -0.12] });
  I.def('cap', PP.capGeo(), MT.capGold);
  I.def('capBig', PP.capGeo(), MT.capSatin);
  const tj = { jitter: 0.14, tint: [-0.12, -0.04, 0.14] };
  I.def('tileR', PP.roundTileGeo(), MT.tileRound, tj);
  I.def('tileRs', PP.roundTileGeo(6, true), MT.tileRound, tj);
  I.def('discS', PP.discGeo(0.104, 0), MT.tile, tj);
  I.def('tileF', PP.flatTileGeo(), MT.tileFlat, tj);
  I.def('disc', PP.discGeo(), MT.tile, tj);
  I.def('lip', PP.lipGeo(), MT.tile, tj);
  I.def('noshi', PP.chamferBox(1, 0.048, 0.3, 0.008), MT.tile, { jitter: 0.12, tint: [-0.1, -0.03, 0.12] });
  const nrng = ctx.rng('pagoda-noshi');
  I.def('stud', PP.studGeo(), MT.gold);
  I.def('rosette', PP.rosetteGeo(), MT.gold);
  I.def('lotusCap', PP.lotusFinialGeo(), MT.red);

  // =====================================================================
  // 台基 (podium): granite, steps on the four cardinal sides
  // =====================================================================
  function podium() {
    const H = PG.platform.h, hw = PG.platform.w / 2;   // apothem of the platform
    const hpw = hw * TAN;                              // lateral half-extent of one face
    const stW = 1.45; // stair half width
    const nSt = 5, rise = H / nSt, run = 0.31;
    const rowBlocks = (j, mt, x0, x1, seg, h, d, y0, pc, c = 0.02, skip = null) => {
      const n = Math.max(1, Math.round((x1 - x0) / seg));
      const L1 = (x1 - x0) / n;
      for (let q = 0; q < n; q++) {
        const a0 = x0 + q * L1, a1 = a0 + L1;
        const cx = (a0 + a1) / 2;
        if (skip && skip(cx)) continue;
        box(j, mt, L1 - 0.004, h, d, cx, y0 + h / 2, pc, 0, c);
      }
    };
    const stairEvery = Math.max(1, Math.round(NS / 4));   // stairs on the four cardinal faces
    for (let j = 0; j < NS; j++) {
      // plinth course
      rowBlocks(j, MT.granite, -(hpw + 0.1), hpw + 0.1 - 0.5, 1.7, 0.18, 0.5, 0, hw + 0.1 - 0.25, 0.025);
      // wall: corner post, posts flanking the stair, panels
      const posts = [-hpw + 0.18, -(stW + 0.55), stW + 0.55];
      for (const x of posts) box(j, MT.granite, 0.36, 0.8, 0.36, x, 0.18 + 0.4, hw - 0.17, 0, 0.03);
      // panels between posts (recessed)
      const spans = [[-hpw + 0.36, -(stW + 0.73)], [stW + 0.73, hpw - 0.36]];
      for (const [x0, x1] of spans) rowBlocks(j, MT.granite, x0, x1, 1.45, 0.8, 0.3, 0.18, hw - 0.17, 0.02);
      // coping
      rowBlocks(j, MT.granite, -(hpw + 0.07), hpw + 0.07 - 0.62, 1.5, 0.22, 0.62, 0.98, hw + 0.07 - 0.31, 0.03);
      // stairs
      if (j % stairEvery) continue;
      for (let n = 1; n <= nSt; n++) {
        const yt = H - rise * n;
        const pf = hw + 0.07 + run * n;
        const p0 = hw - 0.2;
        box(j, MT.graniteC, 2 * stW + 0.06, yt, pf - p0, 0, yt / 2, (pf + p0) / 2, 0, 0.02);
      }
      // side parapets (袖石)
      for (const sx of [-1, 1]) {
        const xi = sx * stW, xo = sx * (stW + 0.34);
        const pe = hw + 0.07 + run * nSt + 0.08;
        const pts = [];
        for (const x of [xi, xo]) {
          pts.push(V3(x, 0, hw - 0.3), V3(x, H + 0.16, hw - 0.3), V3(x, H + 0.16, hw + 0.25), V3(x, 0.34, pe - 0.12), V3(x, 0.34, pe), V3(x, 0, pe));
        }
        B.add(new PP.ConvexGeometry(pts), MT.granite, R[j]);
      }
    }
    // paving
    const pv = hw - 0.55;
    const rg = ctx.rng('pagoda-paving');
    for (let rI = 0, z = -pv; z < pv - 0.01; rI++) {
      const dz = Math.min(0.78, pv - z);
      let x = -pv + (rI % 2 ? 0.45 : 0);
      if (rI % 2) box(null, MT.graniteC, 0.45 - 0.006, 0.1, dz - 0.006, -pv + 0.225, H - 0.05, z + dz / 2, 0, 0.012);
      while (x < pv - 0.01) {
        const dx = Math.min(rg.range(0.85, 1.15), pv - x);
        box(null, MT.graniteC, dx - 0.006, 0.1 + rg.range(-0.004, 0.004), dz - 0.006, x + dx / 2, H - 0.05, z + dz / 2, 0, 0.012);
        x += dx;
      }
      z += dz;
    }
    // core fill (an NS-gonal prism, not a box)
    B.add(PP.lathe([[0, 0], [hw * SEC - 0.1, 0], [hw * SEC - 0.1, H - 0.12], [0, H - 0.12]], NS), MT.granite, m4(null, 0, 0, 0));
  }

  // =====================================================================
  // WALLS: 砖身 columns, 腰枋, ochre plaster, doors with iron studs, lattice
  // windows. 报恩寺塔 divides each of the eight faces into THREE bays with the
  // door in the central one (当心间辟门).
  // =====================================================================
  function walls(s) {
    const { a, h, F, Hc, k, i } = s;
    const rc = i === 0 ? 0.34 : 0.27 * k;
    const hj = i === 0 ? 0.24 : 0.12;
    const hw0 = i === 0 ? 0.78 : 0.36;
    const hn = i === 0 ? 0.2 : 0.16;
    const hL = i === 0 ? 1.95 : Hc - 0.27 * k - hn;
    const kb = Hc - 0.27 * k, kt = Hc - 0.04;
    // three bays per face: a column at each corner and one either side of the
    // central bay (the +h corner column belongs to the next face)
    const bay = (2 * h) / 3;
    const cols = [-h, -h / 3, h / 3];
    const pN = a + rc - 0.015;
    for (let j = 0; j < NS; j++) {
      const jy = (j % 2) * 0.01;
      for (const x of cols) {
        B.add(new THREE.CylinderGeometry(rc * 0.97, rc, Hc, dseg(24), 1), MT.red, m4(j, x, F + Hc / 2, a));
        B.add(new THREE.CylinderGeometry(rc + 0.014, rc + 0.016, 0.1, dseg(24), 1), MT.iron, m4(j, x, F + 0.05, a));
        if (i === 0) {
          B.add(new THREE.CylinderGeometry(0.42, 0.46, 0.16, 24, 1), MT.granite, m4(j, x, F - 0.08, a));
        }
      }
      if (i === 0) box(j, MT.granite, 2 * h + 0.2, 0.16, 0.3, 0, F - 0.08, a, 0, 0.02);
      // 腰枋 / 上枋 (wrap the outside of the columns)
      const nx0 = -(h + rc + 0.035), nx1 = h + rc - 0.065;
      const nb = (y0, hh) => box(j, MT.red, nx1 - nx0, hh, 0.1, (nx0 + nx1) / 2, y0 + hh / 2, pN, 0, 0.014);
      nb(F, hj);
      nb(F + hL, hn);
      // 檐枋, projecting past the corners with gilt ends
      const kx = h + 0.32 * k;
      box(j, MT.red, 2 * kx, kt - kb + jy * 2, 0.15 * k, 0, F + (kb + kt) / 2, a, 0, 0.012);
      for (const sx of [-1, 1]) capAt(j, V3(sx * kx, F + (kb + kt) / 2, a), V3(sx, 0, 0), 0.15 * k, kt - kb);
      // iron bosses on the lintel at every column
      for (const x of cols) {
        I.add('rosette', m4(j, x, F + hL + hn / 2, pN + 0.05, 0, 0, 0, k * (i === 0 ? 1.15 : 1), k * (i === 0 ? 1.15 : 1), 1));
        I.add('rosette', m4(j, x, F + hj / 2, pN + 0.05, 0, 0, 0, k * 0.8, k * 0.8, 1));
      }
      // three bays: the central one carries the door, the flanking two windows
      for (let b = 0; b < 3; b++) {
        const xb0 = -h + b * bay, xb1 = xb0 + bay;
        const x0 = xb0 + rc * 0.7, x1 = xb1 - rc * 0.7, cx = (x0 + x1) / 2, w = x1 - x0;
        // upper plaster
        const yk0 = F + hL + hn, yk1 = F + kb;
        if (yk1 - yk0 > 0.03) box(j, MT.plaster, w, yk1 - yk0, 0.07, cx, (yk0 + yk1) / 2, a - 0.005, 0, 0.006);
        if (b === 1) {
          // 当心间: the door
          const cl = bay / 2 - rc * 0.7; // clear half span of the central bay
          const dh = hL - hj;
          for (const sx of [-1, 1]) box(j, MT.red, 0.13, dh, 0.17, sx * (cl - 0.065), F + hj + dh / 2, a + 0.03, 0, 0.012);
          const wl = cl - 0.13;
          const nr = i === 0 ? 6 : 3, nc = i === 0 ? 4 : 3;
          for (const sx of [-1, 1]) {
            const lx = sx * wl / 2;
            box(j, MT.redDark, wl - 0.012, dh - 0.01, 0.07, lx, F + hj + dh / 2, a + 0.0, 0, 0.01);
            // stiles/rails relief
            box(j, MT.red, wl - 0.02, 0.07, 0.03, lx, F + hj + dh * 0.5, a + 0.045, 0, 0.008);
            // studs
            for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
              const yy = F + hj + dh * (0.12 + (0.76 * r) / (nr - 1));
              const xx = lx + (wl - 0.02) * (-0.5 + (c + 0.5) / nc);
              I.add('stud', m4(j, xx, yy, a + 0.035, 0, 0, 0, i === 0 ? 1 : 0.8, i === 0 ? 1 : 0.8, 1));
            }
            // iron hinge bands
            for (const fy of [0.06, 0.94]) box(j, MT.iron, wl - 0.03, 0.05 * (i === 0 ? 1 : 0.8), 0.012, lx, F + hj + dh * fy, a + 0.04, 0, 0.004);
            // ring pull
            B.add(new THREE.TorusGeometry(0.04 * k, 0.007, 6, 16), MT.iron, m4(j, sx * 0.06, F + hj + dh * 0.47, a + 0.05));
          }
        } else {
          // 次间: lower plaster, sill, lattice window
          box(j, MT.plaster, w, hw0 - hj, 0.07, cx, F + (hj + hw0) / 2, a - 0.005, 0, 0.006);
          const wy0 = F + hw0, wy1 = F + hL;
          box(j, MT.green, w, 0.075, 0.16, cx, wy0 + 0.0375, a + 0.02, 0, 0.01);
          for (const sx of [-1, 1]) box(j, MT.green, 0.075, wy1 - wy0, 0.15, cx + sx * (w / 2 - 0.0375), (wy0 + wy1) / 2, a + 0.02, 0, 0.01);
          const inner = w - 0.15;
          const nbar = Math.max(5, Math.round(inner / 0.105));
          const bh = wy1 - wy0 - 0.075;
          for (let q = 0; q < nbar; q++) {
            const xx = cx - inner / 2 + (inner * (q + 0.5)) / nbar;
            box(j, MT.green, 0.042, bh, 0.042, xx, wy0 + 0.075 + bh / 2, a + 0.02, Math.PI / 4, 0.006);
          }
          box(j, MT.green, inner, 0.035, 0.05, cx, wy0 + 0.075 + bh * 0.5, a + 0.02, 0, 0.006);
          box(j, i === 0 ? MT.dark : MT.plaster, w, wy1 - wy0, 0.03, cx, (wy0 + wy1) / 2, a - 0.05, 0, 0.004);
        }
      }
      // plaster behind the bracket zone
      box(j, MT.plaster, 2 * h, 1.3 * s.kv + 0.05, 0.06, 0, s.T - 0.04 + (1.3 * s.kv + 0.05) / 2, a - 0.045, 0, 0.005);
    }
  }

  // =====================================================================
  // BRACKET COMPLEXES (three-stepped 三手先)
  // =====================================================================
  function brackets(s) {
    const { a, h, k, kv, T, p1, p2, p3 } = s;
    const bh = 0.24 * kv, bd = 0.13 * k;
    const yA1 = T + 0.22 * kv, yA2 = T + 0.64 * kv, yA3 = T + 1.06 * kv;
    const yM1 = T + 0.46 * kv, yM2 = T + 0.88 * kv, yM3 = T + 1.24 * kv;
    const ky = kv / k;
    const midX = [-h / 3, h / 3];            // the two side 槏柱 of the 3-bay face
    const colX = [-h, -h / 3, h / 3];         // corner + two side columns (+h belongs to next face)
    const setX = colX;                        // a full bracket set above every column
    const jTop = (x, p) => roofY(s, x, p) - TH - JD;
    const gB = (x) => jTop(x, p3) - RH - s.gh; // gangyo bottom
    // SEC is the diagonal factor: a distance measured outward from the wall plane
    // corresponds to SEC times that distance along the corner diagonal.
    // For NS = 4 it is sqrt(2), which is what this used to be hard-coded to.
    const sq2 = SEC;
    const mk = (j, x, y, p, sc = 1, syMul = 1) => I.add('makito', m4(j, x, y, p, 0, 0, 0, k * sc, kv * sc * syMul, k * sc));
    // block with a gilt plate on its outward face
    const mkc = (j, x, y, p, sc = 1, syMul = 1) => {
      mk(j, x, y, p, sc, syMul);
      const hh = 0.18 * kv * sc * syMul;
      capAt(j, V3(x, y + hh * 0.71, p + 0.15 * k * sc + 0.012), V3(0, 0, 1), 0.22 * k * sc, hh * 0.5);
    };
    for (let j = 0; j < NS; j++) {
      const jy = (j % 2) * 0.012 * k;
      for (const x of colX) I.add('daito', m4(j, x, T, a, 0, 0, 0, k, kv, k));
      for (const x of midX) {
        box(j, MT.wood, 0.17 * k, 0.085 * kv + 0.04, 0.15 * k, x, T - 0.04 + (0.085 * kv + 0.04) / 2, a, 0, 0.01);
        I.add('daito', m4(j, x, T + 0.085 * kv, a, 0, 0, 0, 0.75 * k, 0.75 * kv, 0.75 * k));
      }
      // continuous beams (toshi-肘木)
      const beamX = (p, y0, X, capEnds = true) => {
        box(j, MT.wood, 2 * X, bh + 2 * jy, bd, 0, y0 + bh / 2, p, 0, 0.012);
        if (capEnds) for (const sx of [-1, 1]) capAt(j, V3(sx * X, y0 + bh * 0.62, p), V3(sx, 0, 0), bd, bh * 0.6);
      };
      beamX(a, yA1, h + (0.46 + 0.22) * k);
      beamX(a, yA2, h + (0.92 + 0.22) * k);
      beamX(a, yA3, h + 0.3 * k);
      beamX(p1, yA2, p1 * TAN + 0.26 * k);
      beamX(p1, yA3, p1 * TAN + 0.26 * k);
      beamX(p2, yA3, p2 * TAN + 0.26 * k);
      // projecting sets
      for (const x of setX) {
        const big = Math.abs(Math.abs(x) - h) < 1e-3;
        armP(j, x, yA1 - 0.01 * kv, a - 0.28 * k, p1 + 0.22 * k, bh + 0.02 * kv, 0.15 * k);
        armP(j, x, yA2 - 0.01 * kv, a - 0.28 * k, p2 + 0.22 * k, bh + 0.02 * kv, 0.15 * k);
        // 尾垂木 (tail rafter) sloping down & out, carrying the third block
        const pa = a - 0.4 * k, pb = p3 + 0.34 * k;
        const ow = (big ? 0.17 : 0.15) * k, oh = 0.27 * kv;
        const ytop = (p) => yM3 + 0.12 * (p3 - p);
        const A = V3(x, ytop(pa) - oh / 2, pa), Bv = V3(x, ytop(pb) - oh / 2, pb);
        const d = V3().subVectors(Bv, A); const len = d.length(); d.normalize();
        const mid = V3().addVectors(A, Bv).multiplyScalar(0.5);
        box(j, MT.wood, ow, oh, len, mid.x, mid.y, mid.z, 0, 0.014, -Math.atan2(d.y, d.z));
        capAt(j, Bv, d, ow, oh);
        mkc(j, x, yM1, p1);
        mkc(j, x, yM2, p2);
        const g0 = gB(x);
        mkc(j, x, yM3, p3, 1, (g0 - yM3) / (0.18 * kv));
      }
      // 卷斗 rows on the wall plane and on the p1 beam, spread across the 3 bays
      const wallX = [];
      for (const xc of [-h, -h / 3, 0, h / 3, h]) {
        wallX.push(xc - 0.46 * k, xc + 0.46 * k);
        if (Math.abs(Math.abs(xc) - h) > 1e-3) wallX.push(xc);
      }
      for (const x of wallX) { mkc(j, x, yM1, a); mkc(j, x, yM2, a); }
      for (const sx of [-1, 1]) mk(j, sx * (h + 0.92 * k), yM2, a);
      const p1X = [-h, h, -h / 3, h / 3, 0, -0.46 * k, 0.46 * k];
      for (const x of p1X) mk(j, x, yM2, p1);
      // ---- corner (diagonal) set at the -x corner: along the corner bisector,
      // lateral = outward * TAN, so dpos() follows the NS-gon corner, not a 45deg line
      const dpos = (t) => [-h - t * SN, a + t * CS];
      const ryD = -Math.PI / 2 - Math.PI / NS;
      const diagArm = (y0, tEnd, hh, w) => {
        const t0 = -0.2 * k;
        const [cx, cp] = dpos((t0 + tEnd) / 2);
        I.add('arm', m4(j, cx, y0, cp, 0, ryD, 0, tEnd - t0, hh / 0.24, w / 0.14));
        const [ex, ep] = dpos(tEnd);
        capAt(j, V3(ex, y0 + hh * 0.72, ep), V3(-SN, 0, CS), w, hh * 0.5);
        const sc = hh / 0.24;
        const [qx, qp] = dpos(tEnd - 0.13 * sc);
        for (const sg of [-1, 1]) eyeAt(j, V3(qx + sg * (w / 2 - 0.002) * CS, y0 + hh * 0.56, qp + sg * (w / 2 - 0.002) * SN), V3(sg * CS, 0, sg * SN), sc);
      };
      diagArm(yA1 - 0.025 * kv, 0.46 * k * sq2 + 0.24 * k, bh + 0.05 * kv, 0.16 * k);
      diagArm(yA2 - 0.025 * kv, 0.92 * k * sq2 + 0.24 * k, bh + 0.05 * kv, 0.16 * k);
      mk(j, -p1 * TAN, yM1, p1);
      mk(j, -p1 * TAN, yM2, p1);
      mk(j, -p2 * TAN, yM2, p2);
      {
        const t0 = -0.5 * k, t1 = 1.38 * k * sq2 + 0.52 * k;
        const ow = 0.2 * k, oh = 0.31 * kv;
        const tp3 = 1.38 * k * sq2;
        const ytop = (t) => yM3 + 0.085 * (tp3 - t);
        const [ax0, ap0] = dpos(t0), [bx0, bp0] = dpos(t1);
        const A = V3(ax0, ytop(t0) - oh / 2, ap0), Bv = V3(bx0, ytop(t1) - oh / 2, bp0);
        const d = V3().subVectors(Bv, A); const len = d.length(); d.normalize();
        const mid = V3().addVectors(A, Bv).multiplyScalar(0.5);
        // orient: yaw toward diagonal, pitch down
        const yaw = Math.atan2(d.x, d.z);
        const pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
        B.add(PP.chamferBox(ow, oh, len, 0.016), MT.wood, m4(j, mid.x, mid.y, mid.z, pitch, yaw, 0));
        capAt(j, Bv, d, ow, oh);
        const gc = gB(p3);
        mk(j, -p3 * TAN, yM3, p3, 1.25, (gc - yM3) / (0.18 * kv * 1.25));
      }
      // 挑檐檩 (eave purlin): follows the slight corner rise of the rafters
      {
        const X = (p3 + 0.3 * k) * TAN;
        const pts = [], N = 28;
        for (let q = 0; q <= N; q++) {
          const x = -X + (2 * X * q) / N;
          pts.push(V3(x, gB(x) + s.gh / 2 - jy, p3));
        }
        addG(j, PP.sweep(pts, PP.rectProfile(0.17 * k, s.gh + 2 * jy, 0.014)), MT.wood);
        for (const sx of [-1, 1]) capAt(j, V3(sx * X, gB(sx * X) + s.gh * 0.55, p3), V3(sx, 0, 0), 0.17 * k, s.gh * 0.7);
      }
    }
  }

  // =====================================================================
  // EAVES: double rafters, soffits, fascia, hip rafters, bells
  // =====================================================================
  function eaves(s) {
    const { a, k, p3 } = s;
    const pr = (x) => pTip(s, x) - 0.17;
    const pj = (x) => p3 + 0.55 * (pTip(s, x) - p3);
    const hTop = (x, p) => roofY(s, x, p) - TH;
    const jTop = (x, p) => roofY(s, x, p) - TH - JD;
    const sp = 0.25 * k;
    const N = Math.floor(s.Xc / sp);
    const rafter = (j, x, pA, pB, top) => {
      const A = V3(x, top(x, pA) - RH / 2, pA), Bv = V3(x, top(x, pB) - RH / 2, pB);
      const d = V3().subVectors(Bv, A); const len = d.length(); d.normalize();
      I.add('rafter', m4(j, x, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2, -Math.atan2(d.y, d.z), 0, 0, 1, 1, len));
    };
    const Xo = fixX((x) => pr(x) - 0.07, s.Xc);
    const Xi = fixX((x) => pj(x), s.Xc);
    const Xf = fixX((x) => pr(x) - 0.018, s.Xc), Xb = fixX((x) => pr(x) - 0.15, s.Xc);
    const pT2 = (x) => pTip(s, x) - 0.035;
    const X2 = fixX(pT2, s.Xc);
    for (let j = 0; j < NS; j++) {
      for (let r = -N; r <= N; r++) {
        const x = r * sp, X = Math.abs(x);
        const pjx = pj(x), prx = pr(x);
        const a0 = Math.max(p3 - 0.15 * k, X / TAN + 0.08 * k), a1 = pjx + 0.045;
        if (a1 - a0 > 0.14) rafter(j, x, a0, a1, jTop);
        const h0 = Math.max(pjx - 0.5, X / TAN + 0.08 * k), h1 = prx;
        if (h1 - h0 > 0.14) rafter(j, x, h0, h1, hTop);
      }
      // 望板 (roof sheathing directly on top of the rafters, under the tiles)
      addG(j, PP.gridSurface((u, v) => {
        const w = -1 + 2 * u;
        const pStart = s.top ? 0.35 : Math.max(s.a, s.Rt - 0.08);
        const pTipDiag = s.a + s.O + s.flare * Math.pow(Math.abs(w), 3) - 0.05;
        const p = pStart + (pTipDiag - pStart) * v;
        const x = w * p * TAN;
        return V3(x, roofY(s, x, p) - 0.048, p);
      }, dseg(36), 6, V3(0, -1, 0)), MT.wood);
      // 外廊木天花 (veranda walkway ceiling between inner wall and outer colonnade lintel)
      {
        const rCol = s.a + (s.i === 0 ? s.O * 0.5 : 1.15 * k);
        const yEave = roofY(s, 0, rCol) - TH - JD - 0.04;
        addG(j, PP.gridSurface((u, v) => {
          const w = -1 + 2 * u;
          const p = s.a - 0.04 + (rCol + 0.04 - (s.a - 0.04)) * v;
          const x = w * p * TAN;
          return V3(x, s.T + (yEave - s.T) * v, p);
        }, 12, 4, V3(0, -1, 0)), MT.soffit);
      }
      // fascia, mitred on the diagonals
      {
        const secs = [];
        const NF = 72;
        for (let q = 0; q <= NF; q++) {
          const u = -1 + (2 * q) / NF;
          const xf = u * Xf, xb = u * Xb;
          const pf = pr(xf) - 0.018, pb = pr(xb) - 0.15;
          secs.push([
            V3(xf, hTop(xf, pf) + 0.002, pf), V3(xf, roofY(s, xf, pf) - 0.05, pf),
            V3(xb, roofY(s, xb, pb) - 0.05, pb), V3(xb, hTop(xb, pb) + 0.002, pb),
          ]);
        }
        addG(j, PP.loft(secs), MT.red);
        // lacquered wood edge strip along the top of the fascia
        const secsG = [];
        for (let q = 0; q <= NF; q++) {
          const u = -1 + (2 * q) / NF;
          const xa = u * fixX((x) => pr(x) - 0.006, s.Xc), xb2 = u * fixX((x) => pr(x) - 0.04, s.Xc);
          const pa = pr(xa) - 0.006, pb2 = pr(xb2) - 0.04;
          const ya = roofY(s, xa, pa) - 0.05, yb = roofY(s, xb2, pb2) - 0.05;
          secsG.push([V3(xa, ya - 0.035, pa), V3(xa, ya + 0.004, pa), V3(xb2, yb + 0.004, pb2), V3(xb2, yb - 0.035, pb2)]);
        }
        addG(j, PP.loft(secsG), MT.red);
        // tile bed underside between fascia and disc row
        const secs2 = [];
        for (let q = 0; q <= NF; q++) {
          const u = -1 + (2 * q) / NF;
          const xf = u * Xf, x2 = u * X2;
          const pf = pr(xf) - 0.018, p2 = pT2(x2);
          const y1 = roofY(s, xf, pf) - 0.05, y2 = roofY(s, x2, p2) - 0.08;
          secs2.push([V3(xf, y1, pf), V3(x2, y2, p2), V3(x2, y2 + 0.04, p2), V3(xf, y1 + 0.04, pf)]);
        }
        addG(j, PP.loft(secs2), MT.tile);
      }
      // hip rafters (ji-老角梁 + hien-老角梁) at the -x corner
      {
        const dJ = Xi / TAN, dR = fixX(pr, s.Xc) / TAN;
        const mkSumi = (d0, d1, top, w, h, n = 10) => {
          const pts = [];
          for (let q = 0; q <= n; q++) {
            const d = d0 + ((d1 - d0) * q) / n;
            // along the corner bisector: lateral = outward * TAN
            pts.push(V3(-d * TAN, top(d * TAN, d) - h / 2, d));
          }
          addG(j, PP.sweep(pts, PP.rectProfile(w, h, 0.02)), MT.wood);
          const E = pts[n], t = V3().subVectors(pts[n], pts[n - 1]).normalize();
          capAt(j, E, t, w, h);
          // engraved gilt sleeve plates wrapping the rafter end (sides + underside)
          {
            const sd = V3().crossVectors(t, UP).normalize();
            const u = V3().crossVectors(sd, t).normalize();
            const len = 0.34 * k;
            const c0 = E.clone().addScaledVector(t, -len / 2 - 0.006);
            for (const [nrm, half, wid] of [[sd, w / 2, h], [sd.clone().negate(), w / 2, h], [u.clone().negate(), h / 2, w]]) {
              const z = nrm.clone();
              const y = V3().crossVectors(z, t).normalize();
              I.add('capBig', basisM(j, c0.clone().addScaledVector(z, half - 0.012), t, y, z, len, wid * 1.06, 1));
            }
          }
          return { E, t };
        };
        mkSumi(a + 0.15, dJ + 0.06, jTop, 0.21 * k, 0.27 * k);
        const { E, t } = mkSumi(dJ - 0.5, dR + 0.08, hTop, 0.2 * k, 0.25 * k);
        // bell hook under the hien-老角梁 tip
        const side = V3().crossVectors(t, UP).normalize();
        const u2 = V3().crossVectors(side, t).normalize();
        const hook = E.clone().addScaledVector(t, -0.12).addScaledVector(u2, -0.125 * k - 0.05);
        {
          // gilt hanger: plate on the rafter underside, bolt heads, and the eye the bell hangs from
          const pl = E.clone().addScaledVector(t, -0.14).addScaledVector(u2, -0.125 * k - 0.024);
          B.add(PP.chamferBox(0.13 * k, 0.012, 0.26, 0.004), MT.gold, basisM(j, pl, side, u2, t.clone().negate()));
          for (const f of [-0.09, 0.09]) B.add(new THREE.SphereGeometry(0.013, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), MT.gold, basisM(j, pl.clone().addScaledVector(t, f).addScaledVector(u2, -0.005), side, u2.clone().negate(), t));
          const eyeR = new THREE.TorusGeometry(0.026, 0.0075, 6, 14);
          const th = V3(t.x, 0, t.z).normalize();
          B.add(eyeR, MT.gold, basisM(j, hook.clone().addScaledVector(u2, 0.024), th, UP, V3().crossVectors(th, UP).normalize()));
        }
        const wp = toWorld(j, hook);
        // sails turned ~25deg off the hip diagonal: a sail facing straight down the diagonal mirrors the low
        // WSW sun into every camera on that diagonal (blown-out white plate)
        anchors.bells.push({ pos: [wp.x, wp.y, wp.z], scale: 1.9 - 0.1 * s.i, rotY: (-j * TAU) / NS - Math.PI / NS + 0.44 });
      }
      // smaller bell at the middle of each side, hung from a gilt eye under the flying rafters
      {
        const pm = pr(0) - 0.32;
        const yh = hTop(0, pm) - RH;
        B.add(new THREE.TorusGeometry(0.03, 0.008, 5, 12), MT.gold, m4(j, 0, yh - 0.02, pm, 0, Math.PI / 2, 0));
        const wp = toWorld(j, V3(0, yh - 0.045, pm));
        anchors.bells.push({ pos: [wp.x, wp.y, wp.z], scale: 1.3 - 0.06 * s.i, rotY: (-j * TAU) / NS });
      }
    }
  }

  // =====================================================================
  // ROOF: 青瓦 tiling, disc eave tiles, hip ridges with 螭吻
  // =====================================================================
  function roof(s) {
    const tp = gap(0.29), Ls = gap(0.295);
    const n = Math.floor((s.Xc - 0.14) / tp);
    const e = 0.02;
    const nrm = (x, p) => {
      const dx = (roofY(s, x + e, p) - roofY(s, x - e, p)) / (2 * e);
      const dp = (roofY(s, x, p + e) - roofY(s, x, p - e)) / (2 * e);
      return V3(-dx, 1, -dp).normalize();
    };
    for (let j = 0; j < NS; j++) {
      const place = (key, x, f, b, sc = 1) => {
        const A = V3(x, roofY(s, x, f), f), Bp = V3(x, roofY(s, x, b), b);
        const z = V3().subVectors(A, Bp); const len = z.length(); z.normalize();
        const nn = nrm(x, (f + b) / 2);
        const y = nn.addScaledVector(z, -nn.dot(z)).normalize();
        const xA = V3().crossVectors(y, z).normalize();
        const Lt = len + 0.035;
        I.add(key, basisM(j, A.clone().addScaledVector(z, -Lt / 2), xA, y, z, sc, sc, Lt / PP.TILE.L));
        return { A, xA, y, z };
      };
      const lod = s.i >= 3;
      const row = (x, key) => {
        const X = Math.abs(x);
        const pt = pTip(s, x);
        const pEnd = Math.max(s.top ? 0.6 : s.Rt - 0.05, X / TAN + 0.08);
        if (pt - pEnd < 0.05) return;
        let f = pt, first = true;
        while (f > pEnd) {
          const b = f - Ls;
          const fr = place(key === 'tileR' && lod ? 'tileRs' : key, x, f, b);
          if (first) {
            if (key === 'tileR') I.add(lod ? 'discS' : 'disc', basisM(j, fr.A.clone().addScaledVector(fr.y, 0.03).addScaledVector(fr.z, 0.004), fr.xA, fr.y, fr.z));
            else I.add('lip', basisM(j, fr.A.clone().addScaledVector(fr.y, 0.004), fr.xA, fr.y, fr.z));
          }
          f = b; first = false;
        }
      };
      for (let r = -n; r <= n; r++) row(r * tp, 'tileR');
      for (let r = -n - 1; r <= n; r++) { const x = (r + 0.5) * tp; if (Math.abs(x) < s.Xc - 0.12) row(x, 'tileF'); }

      // hip ridge (垂脊 / 翼角戗脊) along the octagonal corner diagonal
      const dTip = s.Xc / TAN - 0.1;
      const dTop = s.top ? 0.25 : s.Rt - 0.15;
      const NR = 22;
      const pts = [];
      for (let q = 0; q <= NR; q++) {
        const d = dTip + ((dTop - dTip) * q) / NR;
        // hip ridge along the corner bisector
        pts.push(V3(-d * TAN, roofY(s, d * TAN, d) - 0.02, d));
      }
      const kr = 1.38 * Math.min(1, 0.85 + 0.15 * s.k);
      // hidden core (the visible body is made of individual 熨斗瓦 tiles below)
      const prof = [[-0.17, -0.07], [0.17, -0.07], [0.17, 0.2], [-0.17, 0.2]].map(([u, v]) => [u * kr, v * kr]);
      // stacked, staggered 叠瓦: individual tiles with joints that break up the sunlit sides
      {
        const cum = [0];
        for (let q = 1; q <= NR; q++) cum.push(cum[q - 1] + pts[q].distanceTo(pts[q - 1]));
        const total = cum[NR];
        const frameAt = (sa) => {
          let q = 1;
          while (q < NR && cum[q] < sa) q++;
          const f = (sa - cum[q - 1]) / Math.max(1e-6, cum[q] - cum[q - 1]);
          const P = V3().lerpVectors(pts[q - 1], pts[q], Math.min(Math.max(f, 0), 1));
          const t = V3().subVectors(pts[q], pts[q - 1]).normalize();
          const side = V3().crossVectors(t, UP).normalize();
          const u2 = V3().crossVectors(side, t).normalize();
          return { P, t, side, u2 };
        };
        const TL = 0.31;
        for (let m = 0; m < 4; m++) {
          const w = (0.44 - 0.026 * m) * kr, vC = (0.017 + 0.054 * m) * kr;
          for (let sa = 0.05 + (m % 2) * TL * 0.5; sa < total - 0.05; sa += TL) {
            const { P, t, side, u2 } = frameAt(sa + TL / 2);
            const pos = P.clone().addScaledVector(u2, vC).addScaledVector(side, nrng.range(-0.006, 0.006));
            const z = t.clone().applyAxisAngle(u2, nrng.range(-0.012, 0.012));
            const xA = V3().crossVectors(u2, z).normalize();
            I.add('noshi', basisM(j, pos, xA, u2, z, w, kr, 1));
          }
        }
      }
      // custom loft with a low reference point so step faces orient correctly
      {
        const secs = [], refs = [];
        for (let q = 0; q <= NR; q++) {
          const t = V3().subVectors(pts[Math.min(q + 1, NR)], pts[Math.max(q - 1, 0)]).normalize();
          const side = V3().crossVectors(t, UP).normalize();
          const u2 = V3().crossVectors(side, t).normalize();
          secs.push(prof.map(([u, v]) => pts[q].clone().addScaledVector(side, u).addScaledVector(u2, v)));
          refs.push(pts[q].clone().addScaledVector(u2, -0.6));
        }
        addG(j, PP.loft(secs, { refs }), MT.tile);
        // cap tiles along the ridge top
        let acc = 0;
        for (let q = NR; q > 0; q--) {
          const P0 = pts[q], P1 = pts[q - 1];
          const seg = P0.distanceTo(P1);
          acc += seg;
          if (acc < 0.27 && q > 1) continue;
          acc = 0;
          const z = V3().subVectors(P1, P0).normalize(); // toward the eave tip
          const side = V3().crossVectors(z, UP).normalize();
          const y = V3().crossVectors(side, z).normalize();
          const xA = V3().crossVectors(y, z).normalize();
          const pos = P1.clone().addScaledVector(y, 0.215 * kr - 0.01).addScaledVector(z, -0.17);
          I.add(lod ? 'tileRs' : 'tileR', basisM(j, pos, xA, y, z, 1.3 * kr, 1.3 * kr, 1));
        }
        // end disc of the cap line + 螭吻
        const P0 = pts[0], P1 = pts[1];
        const z = V3().subVectors(P0, P1).normalize();
        const side = V3().crossVectors(z, UP).normalize();
        const y = V3().crossVectors(side, z).normalize();
        const xA = V3().crossVectors(y, z).normalize();
        I.add('disc', basisM(j, P0.clone().addScaledVector(y, 0.215 * kr + 0.03).addScaledVector(z, 0.05), xA, y, z, 1.25 * kr, 1.25 * kr, 1.25 * kr));
        const og = PP.chiwenGeo();
        B.add(og, MT.tile, m4(j, P0.x + 0.03, P0.y + 0.05, P0.z - 0.03, 0.06, -Math.PI / NS, 0, 0.7 * kr, 0.7 * kr, 0.7 * kr));
      }
    }
  }

  // =====================================================================
  // BALCONY (平坐) with railing and 莲瓣望柱头 post caps (storeys 2..9)
  // =====================================================================
  function balcony(s, below) {
    const { a, h, F, k } = s;
    const bw = 1.35 * k, pb = a + bw;
    const rCol = a + 1.15 * k; // 擎檐柱 (eave-propping pillars) center radius
    const eb = 0.19 * k; // edge beam height
    // the balcony floor is an NS-gonal slab, not a box
    B.add(PP.lathe([[0, -0.05], [pb * SEC - 0.01, -0.05], [pb * SEC - 0.01, 0.05], [0, 0.05]], NS), MT.soffit, m4(null, 0, F, 0));
    const pS = pb - 0.3 * k;
    for (let j = 0; j < NS; j++) {
      const jy = (j % 2) * 0.012;
      // edge beam
      box(j, MT.red, 2 * (pb * TAN) - 0.09, eb + jy, 0.09, -0.045, F - eb / 2 + 0.005, pb - 0.045, 0, 0.012);
      // small brackets under the overhang
      const yArm = F - eb - 0.1 * k, yMk = yArm - 0.126 * k;
      const nM = Math.max(3, Math.round((2 * pS * TAN) / (0.48 * k)));
      for (let q = 0; q <= nM; q++) {
        const x = -pS * TAN + (2 * pS * TAN * q) / nM;
        if (q === nM) continue; // next side's corner
        I.add('makito', m4(j, x, yMk, pS, 0, 0, 0, 0.7 * k, 0.7 * k, 0.7 * k));
        if (q > 0) armP(j, x, yArm, pS - 0.12 * k, pb - 0.05, 0.1 * k, 0.08 * k, false);
      }
      // skirt board down to the roof below
      {
        const secs = [];
        const NF = 36;
        const XF = (pS + 0.03) * TAN, XB = (pS - 0.03) * TAN;
        for (let q = 0; q <= NF; q++) {
          const u = -1 + (2 * q) / NF;
          const xf = u * XF, xb = u * XB;
          const yt = yMk;
          secs.push([
            V3(xf, roofY(below, xf, pS + 0.03) - 0.06, pS + 0.03), V3(xf, yt, pS + 0.03),
            V3(xb, yt, pS - 0.03), V3(xb, roofY(below, xb, pS - 0.03) - 0.06, pS - 0.03),
          ]);
        }
        addG(j, PP.loft(secs), MT.red);
      }

      // =================================================================
      // 擎檐柱 (Eave-propping pillars) on the balcony, supporting the waist eave above
      // =================================================================
      const yEave = roofY(s, 0, rCol) - TH - JD - 0.04;
      const colH = yEave - F;
      const rc = 0.15 * k;
      const colX = [-rCol * TAN, -(rCol * TAN) / 3, (rCol * TAN) / 3];
      for (const x of colX) {
        // stone base plinth (柱础)
        B.add(new THREE.CylinderGeometry(rc + 0.035, rc + 0.055, 0.12 * k, 16, 1), MT.granite, m4(j, x, F + 0.06 * k, rCol));
        // pillar shaft
        B.add(new THREE.CylinderGeometry(rc * 0.94, rc, colH - 0.12 * k, 16, 1), MT.red, m4(j, x, F + (colH + 0.12 * k) / 2, rCol));
        // capital block (栌斗)
        I.add('daito', m4(j, x, yEave - 0.08 * k, rCol, 0, 0, 0, 0.62 * k, 0.62 * k, 0.62 * k));
      }
      // continuous outer lintel beam (檐枋 / 额枋) connecting the pillar heads
      box(j, MT.red, 2 * (rCol * TAN) + 0.12, 0.18 * k, 0.18 * k, 0, yEave - 0.09 * k, rCol, 0, 0.012);

      // railing (栏杆)
      const pr = pb - 0.07;
      const yH = F + 0.74 * k, yM = F + 0.44 * k, yB = F + 0.05 * k;
      const mainX = [-pr * TAN, -(pr * TAN) / 3, (pr * TAN) / 3];
      for (const x of mainX) {
        box(j, MT.red, 0.12 * k, 0.86 * k, 0.12 * k, x, F + 0.43 * k, pr, 0, 0.014);
        I.add('lotusCap', m4(j, x, F + 0.86 * k, pr, 0, 0, 0, 0.85 * k, 0.85 * k, 0.85 * k));
      }
      const RX = pr * TAN + 0.13;
      B.add(new THREE.CylinderGeometry(0.044 * k, 0.044 * k, 2 * RX, 12, 1), MT.red, m4(j, 0, yH + jy, pr, 0, 0, Math.PI / 2));
      box(j, MT.red, 2 * (pr * TAN + 0.08), 0.075 * k + jy, 0.065 * k, 0, yM, pr, 0, 0.01);
      box(j, MT.red, 2 * (pr * TAN + 0.06), 0.09 * k + jy, 0.085 * k, 0, yB, pr, 0, 0.01);
      // short struts
      const nT = Math.round((2 * pr * TAN) / 0.42);
      for (let q = 0; q < nT; q++) {
        const x = -pr * TAN + (2 * pr * TAN * (q + 0.5)) / nT;
        if (mainX.some((m) => Math.abs(m - x) < 0.1)) continue;
        box(j, MT.red, 0.06 * k, yH - yM, 0.05 * k, x, (yH + yM) / 2, pr, 0, 0.008);
        box(j, MT.red, 0.05 * k, yM - yB, 0.045 * k, x, (yM + yB) / 2, pr, 0, 0.006);
      }
    }
  }

  // =====================================================================
  // 副阶 — the surrounding veranda (周匝回廊) at the ground storey. A ring of
  // columns under the first-storey eave with a low balustrade (栏杆) and floor
  // slab (雁翅板). The 副阶 eave and the first-storey eave flow in one slope
  // (一坡而下), so no second eave is built here.
  // =====================================================================
  function fujie(s) {
    const { a, O, k } = s;
    const rC = a + O * 0.5;                 // apothem of the colonnade
    const yBase = PG.platform.h;            // 基台 top
    const yTop = roofY(s, 0, a) - TH - 0.18; // just under the eave soffit at the wall
    const colH = yTop - yBase;
    const rc = 0.34 * k;
    const ang = Math.PI / NS, sc = Math.sin(ang);
    // veranda floor slab (octagonal disc out to the colonnade)
    B.add(PP.lathe([[0, -0.06], [rC * SEC - 0.01, -0.06], [rC * SEC - 0.01, 0.06], [0, 0.06]], NS), MT.soffit, m4(null, 0, yBase + 0.06, 0));
    // low balustrade ring (雁翅板) + top rail
    const yLow = yBase + 0.62 * k, yRail = yBase + 0.95 * k;
    B.add(PP.lathe([[0, -0.05], [(rC - 0.1) * SEC - 0.01, -0.05], [(rC - 0.1) * SEC - 0.01, 0.05], [0, 0.05]], NS), MT.red, m4(null, 0, yLow, 0));
    B.add(PP.lathe([[0, -0.025], [(rC - 0.05) * SEC - 0.01, -0.025], [(rC - 0.05) * SEC - 0.01, 0.025], [0, 0.025]], NS), MT.red, m4(null, 0, yRail, 0));
    for (let j = 0; j < NS; j++) {
      // continuous lintel beam (额枋) connecting the colonnade columns
      box(j, MT.red, 2 * (rC * TAN) + 0.12, 0.20 * k, 0.20 * k, 0, yTop - 0.10 * k, rC, 0, 0.015);
      // face-centre column + corner column (the corner is shared with face j+1)
      for (const [xx, pp] of [[0, rC], [rC * sc, rC / SEC]]) {
        B.add(new THREE.CylinderGeometry(rc * 0.9, rc, colH, 18, 1), MT.red, m4(j, xx, yBase + colH / 2, pp));
        B.add(new THREE.CylinderGeometry(rc + 0.06, rc + 0.08, 0.18, 18, 1), MT.granite, m4(j, xx, yBase + 0.09, pp));
        B.add(new THREE.CylinderGeometry(rc + 0.04, rc + 0.06, 0.14, 18, 1), MT.red, m4(j, xx, yTop - 0.07, pp));
      }
    }
  }

  // =====================================================================
  // 塔刹 — the iron finial of 报恩寺塔. The real tower is 76 m to the tip of
  // the 铁制塔刹, which is about a fifth of that (~15.2 m). The eighth and
  // ninth storeys carry a 0.85 m 木刹柱 whose top projects through the roof
  // and carries the iron spire:
  //   露盘 + 覆钵 + 仰莲 + a slender 刹杆 with nine 相轮 + 宝盖 + 宝顶
  // Segment heights are fractions of P.spireHeight so the whole finial scales.
  // =====================================================================
  // 塔刹 (Spire) — Northern Song cast-iron spire (建炎万斤铁刹) of Beisi Pagoda.
  // Real pagoda height is ~76m to the tip of the spire (~15.2m spire height).
  // Authentic Chinese Buddhist pagoda spire components:
  //   1. 八角须弥座露盘 (Octagonal Sumeru pedestal, aligns with the 8 roof ridges)
  //   2. 覆钵 (Cast-iron inverted bowl / dome)
  //   3. 仰莲 (Upturned cast-iron lotus collar)
  //   4. 刹杆 (Central mast) with 九重铸铁相轮 (Nine cast-iron rings)
  //   5. 八角华盖 / 宝盖 (Octagonal cast-iron parasol with corner anchor lugs)
  //   6. 仰月承托鎏金摩尼宝珠 (Gilded Mani pearl resting in a crescent moon cup)
  //   7. 刹尖 (Lightning finial needle atop the pearl)
  //   8. 8 根斜拉铁索 (浪风索) connecting the 宝盖 to the 9th-storey hip ridges
  // =====================================================================
  function spire() {
    const s4 = S[S.length - 1];
    const Yp = roofY(s4, 0, s4.Rt) - 0.02;
    const H = PG.spireHeight;                // 15.2 m
    const hBase = H * 0.075;                // 露盘八角须弥座 1.14m
    const hBowl = H * 0.055;                // 覆钵           0.84m
    const hGap = H * 0.035;                 // 仰莲->刹杆基部  0.53m
    const hMast = H * 0.710;                // 刹杆与九重相轮 10.79m
    const hCan = H * 0.020;                 // 宝盖           0.30m

    // ---- 1. 八角须弥座露盘 (Octagonal Sumeru pedestal, authentic Song-Ming iron spire base)
    const yL = Yp;
    const sumeruProf = [
      [0.0001, 0],
      [1.25, 0],
      [1.25, hBase * 0.22],
      [1.18, hBase * 0.26],
      [0.96, hBase * 0.38],
      [0.86, hBase * 0.44],
      [0.84, hBase * 0.58],
      [0.86, hBase * 0.64],
      [0.98, hBase * 0.72],
      [1.18, hBase * 0.82],
      [1.20, hBase * 0.86],
      [1.20, hBase * 1.00],
      [0.0001, hBase * 1.00],
    ];
    B.add(PP.lathe(sumeruProf, 8), MT.iron, m4(null, 0, yL, 0, 0, Math.PI / 8, 0));
    // 束腰间柱/壶门 (relief pilasters on the 8 recessed faces)
    for (let j = 0; j < 8; j++) {
      const ang = (j * TAU) / 8;
      const rw = 0.85;
      box(null, MT.iron, 2 * rw * TAN * 0.75, hBase * 0.18, 0.04, Math.sin(ang) * rw, yL + hBase * 0.51, Math.cos(ang) * rw, 0, ang, 0, 0.008);
    }

    // ---- 2. 覆钵 (Inverted Bowl / Dome in dark cast iron)
    const yb = yL + hBase;
    const bowlProf = [
      [0.0001, 0],
      [0.80, 0],
      [0.84, 0.08],
      [0.82, 0.25],
      [0.74, 0.48],
      [0.56, 0.66],
      [0.34, 0.75],
      [0.18, 0.80],
      [0.0001, 0.82],
    ];
    B.add(PP.lathe(bowlProf, 32), MT.iron, m4(null, 0, yb, 0));
    B.add(new THREE.TorusGeometry(0.83, 0.045, 8, 36), MT.iron, m4(null, 0, yb + 0.14, 0, Math.PI / 2));

    // ---- 3. 仰莲 (Upturned lotus collar supporting the mast)
    const yu = yb + hBowl;
    B.add(PP.lathe([[0.0001, 0], [0.26, 0], [0.32, 0.10], [0.42, 0.22], [0.0001, 0.22]], 24), MT.iron, m4(null, 0, yu, 0));
    for (let r = 0; r < 2; r++) {
      for (let q = 0; q < 16; q++) {
        const ang = ((q + r * 0.5) / 16) * TAU;
        const pet = new THREE.SphereGeometry(1, 8, 6);
        pet.scale(0.12, 0.28, 0.05);
        pet.translate(0, 0.20, 0);
        pet.rotateX(0.55 - r * 0.22);
        pet.translate(0, 0, 0.22 + r * 0.05);
        B.add(pet, MT.iron, m4(null, 0, yu + r * 0.05, 0, 0, ang, 0));
      }
    }

    // ---- 4. 刹杆 (Central Mast)
    const y0 = yu + hGap;
    const mastTop = y0 + hMast;
    B.add(new THREE.CylinderGeometry(0.22, 0.44, hMast, 24, 1), MT.iron, m4(null, 0, (y0 + mastTop) / 2, 0));

    // ---- 5. 九重相轮 (Nine Cast-Iron Rings, densely clustered in upper section)
    const NR = 9;
    const ringBaseY = y0 + 3.8;  // leaves lower mast shaft as dignified pedestal section
    const ringTopY = y0 + 9.2;   // top ring sits right below the canopy
    const ringStep = (ringTopY - ringBaseY) / (NR - 1); // ~0.675m spacing
    const ringR0 = 0.96, ringR1 = 0.78;
    for (let n = 0; n < NR; n++) {
      const yr = ringBaseY + n * ringStep;
      const tRatio = n / (NR - 1);
      const Rr = ringR0 + (ringR1 - ringR0) * tRatio;
      // Torus rim
      B.add(new THREE.TorusGeometry(Rr, 0.08, 10, 40), MT.iron, m4(null, 0, yr, 0, Math.PI / 2));
      // Spoke web / hub disc joining the ring to the mast
      const mastRAtY = 0.44 + (0.22 - 0.44) * ((yr - y0) / hMast);
      B.add(PP.lathe([[mastRAtY - 0.02, -0.04], [Rr - 0.06, -0.04], [Rr - 0.06, 0.04], [mastRAtY - 0.02, 0.04]], 24), MT.iron, m4(null, 0, yr, 0));
      // Collar clamp
      B.add(new THREE.CylinderGeometry(mastRAtY + 0.04, mastRAtY + 0.04, 0.18, 18, 1), MT.iron, m4(null, 0, yr, 0));
    }
    // 4 vertical iron tie rods connecting the 9 rings together (四角贯穿铁拉杆)
    for (let k = 0; k < 4; k++) {
      const ang = (k * TAU) / 4 + Math.PI / 4;
      const rBar = (ringR0 + ringR1) * 0.42;
      const hBar = ringTopY - ringBaseY + 0.2;
      B.add(new THREE.CylinderGeometry(0.022, 0.022, hBar, 8, 1), MT.iron, m4(null, Math.sin(ang) * rBar, (ringBaseY + ringTopY) / 2, Math.cos(ang) * rBar));
    }

    // ---- 6. 八角华盖 / 宝盖 (Octagonal Cast-Iron Canopy)
    const yCan = ringTopY + 0.65;
    const canProf = [
      [0.0001, 0],
      [1.12, 0],
      [1.16, 0.04],
      [1.08, 0.09],
      [0.60, 0.16],
      [0.26, 0.20],
      [0.0001, 0.22],
    ];
    B.add(PP.lathe(canProf, 8), MT.iron, m4(null, 0, yCan, 0, 0, Math.PI / 8, 0));
    B.add(PP.lathe([[0.0001, -0.16], [0.26, -0.16], [0.30, -0.02], [0.22, 0.08], [0.0001, 0.10]], 20), MT.iron, m4(null, 0, yCan - 0.08, 0));
    // 8 corner hanging drops and eyelet rings
    for (let q = 0; q < 8; q++) {
      const ang = (q * TAU) / 8 - Math.PI / 8;
      const cA = Math.cos(ang), sA = Math.sin(ang);
      const rLug = 1.15;
      B.add(new THREE.TorusGeometry(0.045, 0.012, 6, 14), MT.iron, m4(null, sA * rLug, yCan + 0.04, cA * rLug, Math.PI / 2, -ang, 0));
      B.add(new THREE.CylinderGeometry(0.012, 0.028, 0.18, 8, 1), MT.iron, m4(null, sA * (rLug - 0.08), yCan - 0.12, cA * (rLug - 0.08)));
      B.add(new THREE.SphereGeometry(0.032, 8, 6), MT.iron, m4(null, sA * (rLug - 0.08), yCan - 0.22, cA * (rLug - 0.08)));
    }

    // ---- 7. 8 根斜拉铁索 (浪风索 / Guy-wire Chains)
    const topS = S[S.length - 1];
    const rCornerRoof = (topS.a + topS.O + topS.flare) * SEC;
    const rBot = rCornerRoof - 0.85;
    const dBot = rBot / SEC;
    const yBot = roofY(topS, dBot * TAN, dBot) + 0.16;

    for (let q = 0; q < NS; q++) {
      const ang = (q * TAU) / NS - Math.PI / NS;
      const cA = Math.cos(ang), sA = Math.sin(ang);
      const rTop = 1.15;
      const pTop = V3(sA * rTop, yCan + 0.04, cA * rTop);
      const pBot = V3(sA * rBot, yBot, cA * rBot);

      // Bottom anchor cleat & ring on the 9th storey hip ridge
      box(null, MT.iron, 0.18, 0.12, 0.22, pBot.x, pBot.y - 0.05, pBot.z, 0, -ang, 0);
      B.add(new THREE.TorusGeometry(0.055, 0.014, 6, 12), MT.iron, m4(null, pBot.x, pBot.y + 0.03, pBot.z, Math.PI / 2, -ang, 0));

      // Segmented catenary iron chain with EXACT quaternion alignment
      const nSeg = 18;
      let prevPt = pTop.clone();
      for (let sIdx = 1; sIdx <= nSeg; sIdx++) {
        const t = sIdx / nSeg;
        const curPt = new THREE.Vector3().lerpVectors(pTop, pBot, t);
        curPt.y -= Math.sin(t * Math.PI) * 0.18; // gentle catenary sag
        const segVec = new THREE.Vector3().subVectors(curPt, prevPt);
        const segLen = segVec.length();
        const midPt = new THREE.Vector3().addVectors(prevPt, curPt).multiplyScalar(0.5);
        const dir = segVec.clone().normalize();
        const qRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const m = new THREE.Matrix4().compose(midPt, qRot, new THREE.Vector3(1, 1, 1));
        B.add(new THREE.CylinderGeometry(0.026, 0.026, segLen, 8, 1), MT.iron, m);
        prevPt.copy(curPt);
      }

      // Wind bell (风铎) hung below the 9th-storey eave corner
      const rCorner = (topS.a + topS.O + topS.flare) * SEC;
      const dCorner = rCorner / SEC;
      const yCorner = roofY(topS, dCorner * TAN, dCorner);
      const wp = toWorld(null, V3(sA * (rCorner - 0.12), yCorner - 0.28, cA * (rCorner - 0.12)));
      anchors.bells.push({ pos: [wp.x, wp.y, wp.z], scale: 1.6, rotY: -ang });
    }

    // ---- 8. 宝顶: 仰月承托鎏金宝珠与避雷刹尖
    const yFl = yCan + 0.22;
    // Iron neck collar
    B.add(PP.lathe([[0.0001, 0], [0.18, 0], [0.24, 0.08], [0.26, 0.16], [0.20, 0.24], [0.0001, 0.28]], 20), MT.iron, m4(null, 0, yFl, 0));
    // Upturned lotus / crescent dish in gold
    const dishProf = [[0.0001, 0], [0.34, 0.06], [0.38, 0.16], [0.34, 0.18], [0.18, 0.08], [0.0001, 0.06]];
    B.add(PP.lathe(dishProf, 24), MT.pearlGold, m4(null, 0, yFl + 0.26, 0));
    // 鎏金摩尼宝珠 (Gilded Mani Pearl)
    const yPearl = yFl + 0.60;
    const rPearl = 0.35;
    B.add(new THREE.SphereGeometry(rPearl, 24, 18), MT.pearlGold, m4(null, 0, yPearl, 0));
    // 刹尖 (Lightning needle / finial spear atop pearl)
    const yNeedle = yPearl + rPearl;
    const hNeedle = 0.85;
    B.add(new THREE.CylinderGeometry(0.010, 0.026, hNeedle, 12, 1), MT.pearlGold, m4(null, 0, yNeedle + hNeedle / 2, 0));
    B.add(new THREE.SphereGeometry(0.035, 10, 8), MT.pearlGold, m4(null, 0, yNeedle + hNeedle, 0));
    return yNeedle + hNeedle;
  }

  // =====================================================================
  // BUILD
  // =====================================================================
  podium();
  for (const s of S) {
    walls(s);
    brackets(s);
    eaves(s);
    roof(s);
    if (s.i > 0) balcony(s, S[s.i - 1]);
  }
  fujie(S[0]);
  const spireTop = spire();

  const merged = B.build({ name: 'pagoda_merged', castShadow: true, receiveShadow: true });
  root.add(merged);
  I.build(root, ctx.rng('pagoda-instance-colors'));

  const c = (x, y, z) => [C[0] + x, CY + y, C[2] + z];
  const showcase = [
    { cam: c(-10.5, 1.8, 12.5), look: c(-1.5, 13, 1), focal: 24, note: 'hero: low angle up the sunlit SW corner (chiwen, wind chimes, brackets, disc tiles)' },
    { cam: c(10.5, 1.8, 9.0), look: c(0.5, 13, 0), focal: 24, note: 'SE corner cascade of eaves (shade side), outside the eave line' },
    { cam: c(-28, 13, 22), look: c(0, 22, 0), focal: 30, note: 'west elevation, fully sunlit, all nine storeys' },
    { cam: c(52, 6, 38), look: c(0, 24, 0), focal: 50, note: 'backlit telephoto from the ESE' },
    { cam: c(-13, 16, 12), look: c(-6.5, 13.3, 6.5), focal: 35, note: 'roof level: hip ridge, chiwen, balcony, corner wind chime' },
    { cam: c(10, 25, 12), look: c(0, 44, 0), focal: 45, note: '塔刹: 覆钵, 相轮, 宝盖, 火焰珠' },
  ];
  const mname = new Map(Object.entries(MT).map(([kk, v]) => [v, kk]));
  const stats = [];
  let tot = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const n = ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
    tot += n;
    stats.push(`${o.isInstancedMesh ? o.name.replace('pagoda_', '') + '[' + o.count + ']' : mname.get(o.material)}=${Math.round(n / 1000)}k`);
  });
  console.log(`[world] pagoda stats: ${Math.round(tot / 1000)}k tris, ${stats.length} meshes: ${stats.join(' ')}`);
  console.log(`[world] pagoda storeys F=${S.map((s) => s.F.toFixed(2)).join(',')} eaves=${S.map((s) => s.Ye.toFixed(2)).join(',')} peak=${S[S.length - 1].Yt.toFixed(2)} spireTop=${spireTop.toFixed(2)} bells=${anchors.bells.length}`);
  // sky-light attenuation under each storey's eaves (engine ambient volumes)
  const ambientVolumes = S.map((s) => {
    const h = s.a + s.O * 0.55;
    const y0 = s.i === 0 ? s.F - 0.3 : s.F + 0.55; // keep clear of the roof below (no blotches near the hips)
    return { min: [C[0] - h, CY + y0, C[2] - h], max: [C[0] + h, CY + s.yG + 0.3, C[2] + h], tint: [0.34, 0.27, 0.22], soft: s.i === 0 ? 0.8 : 0.6 };
  });
  return { object: root, anchors, showcase, ambientVolumes };
}
