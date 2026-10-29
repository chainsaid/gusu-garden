// ---------------------------------------------------------------------------
// BRIDGE — 单孔石拱桥 across the pond on the hall axis (玉带桥式 steep humpback).
//
// Structure (all in world coordinates, axis x = L.bridge.x, running N-S):
//   * arch ring (券圈): a near-semicircular voussoir ring springing at the
//     waterline, independent of the deck profile, on foundation blocks
//   * deck (桥面): crown arc blended into straight approach ramps, surfaced
//     with full-width stone treads (踏步)
//   * flank walls (裙肩墙): continuous smooth stone bands from the deck edge
//     down to the ring extrados / waterline, with a coping course (眉石)
//   * balustrade: plumb carved panels (雕花栏板) between posts, moulded
//     寻杖 top rail, cloud-bud finials, drum stones (抱鼓石) at the ends
//   * coursed ashlar abutments + landing slabs adapted to the real shoreline
//     (queried from the pond module when present)
// One limestone material carries everything; per-piece tint lives in vertex
// colours, coursing/joints/weathering in the fragment shader.
// ---------------------------------------------------------------------------

import { seg as dseg } from '../core/detail.js';
import { Mesher, basis, extrude } from './hall-lib.js';

export async function build(ctx) {
  const { THREE, L, geom, mat } = ctx;
  const { Builder, mat4 } = geom;
  const RBox = geom.RoundedBoxGeometry;
  const rnd = ctx.rng('bridge');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const f6 = (x) => Number(x).toFixed(6);

  // ---------------------------------------------------------------- layout
  const BR = Object.assign({ south: [10, 0, 27], north: [10, 0, 5], width: 3.6, rise: 1.55, posts: 9 }, L.bridge || {});
  const Y0 = L.groundY || 0;
  const X0 = (BR.north[0] + BR.south[0]) / 2;
  const zA = Math.min(BR.north[2], BR.south[2]), zB = Math.max(BR.north[2], BR.south[2]);
  const ZC = (zA + zB) / 2, HALF = (zB - zA) / 2, RISE = BR.rise;
  const WATER = (L.pond && L.pond.waterY != null) ? L.pond.waterY : -0.55;
  const BOTTOM = (L.pond && L.pond.bottomY != null) ? L.pond.bottomY : -1.7;
  const HW = BR.width / 2;

  const LAND_TOP = Y0 + 0.06;                                   // landing slab top
  // 玉带桥式剖面: a tight crown arc blended into straight approach ramps (桥堍),
  // so the arch OPENING can be a near-semicircle while the deck still lands on the banks
  const RC = Math.min(7.0, HALF * 0.95);                        // crown-arc radius (deck)
  const thT = (() => {                                          // tangent point arc->ramp
    let lo = 0.15, hi = 1.3;
    const f = (th) => (LAND_TOP - Y0 - RISE + RC) * Math.cos(th) + HALF * Math.sin(th) - RC;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) > 0 === f(lo) > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  })();
  const zT = RC * Math.sin(thT), yT = RISE - RC * (1 - Math.cos(thT)), slopeT = Math.tan(thT);
  const zEndN = ZC - HALF + 0.05, zEndS = ZC + HALF - 0.05;     // deck meets the landings
  const profY = (z) => {                                        // deck-surface height above Y0
    const dz = clamp(Math.abs(z - ZC), 0, HALF - 0.05);
    return dz <= zT ? RISE - RC + Math.sqrt(Math.max(RC * RC - dz * dz, 0))
                    : Math.max(yT - slopeT * (dz - zT), LAND_TOP - Y0);
  };
  // 券圈 (arch ring): an independent near-semicircular opening springing at the water
  const R_IN = Math.min(5.2, HALF * 0.42), R_OUT = R_IN + 0.46;
  const YRING = WATER + 0.10;                                   // ring centre height (spring line at the water)
  const wallBaseY = (z) => {                                    // where flank masonry dies: ring extrados or water
    const dz = Math.abs(z - ZC);
    const ex = dz < R_OUT ? YRING + Math.sqrt(Math.max(R_OUT * R_OUT - dz * dz, 0)) : -Infinity;
    return Math.max(ex, WATER - 0.12);
  };

  // 踏步 (deck steps): the walkable surface is stepped over the arch — treads level,
  // risers tall at the abutments and shallow toward the crown, as on real stone bridges
  const N_STEPS = Math.max(10, Math.round((zEndS - zEndN) / 0.34));
  const STEP_W = (zEndS - zEndN) / N_STEPS;
  const treadTop = (z) => Y0 + profY(clamp(z, zEndN + 0.02, zEndS - 0.02));



  // ---------------------------------------------------------------- shoreline (adapt abutments to the pond)
  const pondSite = ctx.modules && ctx.modules.pond && ctx.modules.pond.site;
  function inWater(x, z) {
    if (pondSite && pondSite.sdExact) { try { return pondSite.sdExact(x, z) > 0; } catch (e) { /* fall through */ } }
    const poly = L.pond && L.pond.outline;
    if (!poly) return Math.abs(z - ZC) < HALF - 1.5;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) inside = !inside;
    }
    // pond module builds a land jetty to the south bridge end
    if (inside && z > BR.south[2] - 0.6 && Math.abs(x - BR.south[0]) < Math.max(HW + 1.6, 3.2)) inside = false;
    return inside;
  }
  function shoreFrom(zEnd, dir) {
    for (let i = 0; i <= 400; i++) {
      const z = zEnd + dir * i * 0.025;
      if (inWater(X0, z) && inWater(X0 - HW, z) && inWater(X0 + HW, z)) return z;
      if (dir * (z - ZC) > 0) break;
    }
    return zEnd + dir * 1.5;
  }
  const shoreN = shoreFrom(zEndN, +1), shoreS = shoreFrom(zEndS, -1);
  // abutment faces stand a little into the water; keep the bridge symmetric
  const faceDist = Math.max(clamp(shoreN + 0.35 - zEndN, 0.9, 3.2), clamp(zEndS - (shoreS - 0.35), 0.9, 3.2));
  const faceN = zEndN + faceDist, faceS = zEndS - faceDist;
  const ABUT_TOP = Y0 - 0.16;

  // ---------------------------------------------------------------- materials
  const ARC_GLSL = `
#define ARC_ZC ${f6(ZC)}
#define ARC_YC ${f6(YRING)}
#define ARC_R ${f6((R_IN + R_OUT) / 2)}
#define BR_X0 ${f6(X0)}
#define BR_HW ${f6(HW)}
#define WATER_Y ${f6(WATER)}
`;
  // analytic occlusion of the indirect light under the deck (the sky IBL would otherwise light the soffit)
  const AO_GLSL = /* glsl */ `
    {
      vec2 relA = vec2(vWPos.z - ARC_ZC, vWPos.y - ARC_YC);
      float depthA = ARC_R - length(relA);
      float insideA = 1.0 - smoothstep(${f6(HW - 0.35)}, ${f6(HW + 0.06)}, abs(vWPos.x - BR_X0));
      float underA = smoothstep(0.0, 0.14, depthA) * insideA;
      vec3 wnA = normalize(vWNrm);
      float aoA = mix(1.0, 0.55, underA);
      aoA *= mix(1.0, 0.62, smoothstep(0.1, 0.9, -wnA.y) * smoothstep(-0.3, 0.05, depthA));
      reflectedLight.indirectDiffuse *= aoA;
      reflectedLight.indirectSpecular *= mix(1.0, aoA, 0.85);
      // light bounced off the pond: (a) skylight / glare reflected up onto soffits and
      // low faces, (b) the low sun's glint off the rippled surface -> drifting caustic bands
      vec3 Ls = normalize(uSunDir);
      float hB = vWPos.y - WATER_Y;
      vec3 nB = normalize((vec4(geometryNormal, 0.0) * viewMatrix).xyz);
      // toward-the-light vector of the water-reflected sun (down and toward the sun; ripples spread it upward)
      vec3 bDir = normalize(vec3(Ls.x, -Ls.y - 0.22, Ls.z));
      float ndB = max(dot(nB, bDir), 0.0);
      float downB = clamp(-nB.y, 0.0, 1.0);
      float nearW = (1.0 - smoothstep(0.8, 3.6, hB)) * smoothstep(-0.02, 0.06, hB);
      vec2 rp = vWPos.xz + (Ls.xz / max(Ls.y + 0.22, 0.05)) * max(hB, 0.0);
      float wM = smoothstep(-25.0, -21.0, rp.x) * (1.0 - smoothstep(40.0, 43.0, rp.x)) * smoothstep(7.0, 9.0, rp.y) * (1.0 - smoothstep(31.0, 33.0, rp.y));
      vec2 cq = rp * vec2(0.62, 1.0);
      float c1 = clamp(1.0 - abs(n_snoise3(vec3(cq + vec2(uTime * 0.3, 0.0), uTime * 0.4))), 0.0, 1.0);
      float c2 = clamp(1.0 - abs(n_snoise3(vec3(cq * 1.7 + 7.0 - vec2(0.0, uTime * 0.25), uTime * 0.5 + 3.0))), 0.0, 1.0);
      float sharpC = mix(1.0, 0.5, smoothstep(0.4, 2.8, hB)); // caustics soften with distance from the water
      float caus = pow(c1, 14.0 * sharpC) * 1.2 + pow(c2, 16.0 * sharpC) * 0.7;
      // the dancing light only reads in shade (direct sun swamps it); lotus pads cut the reflecting area
      float shf = clamp(dot(directLight.color, vec3(1.0)) / max(dot(uSunColor, vec3(1.0)), 1e-4), 0.0, 1.0);
      caus *= mix(1.0, 0.25, shf);
      float downW = (1.0 - smoothstep(2.6, 5.0, hB)) * smoothstep(-0.02, 0.06, hB);
      vec3 bounce = uSunColor * wM * (nearW * ndB * (0.02 + 0.1 * caus) + downW * downB * (0.05 + 0.06 * caus * nearW));
      reflectedLight.indirectDiffuse += material.diffuseColor * RECIPROCAL_PI * bounce;
    }
  `;

  // granite (piers, abutments, slabs) with a waterline algae band and wet darkening —
  // light grey limestone like the reference garden bridges (玉带桥), not dark granite
  // smooth pale limestone (玉带桥-style): uniform grey-white, faint broad veining — no
  // salt-and-pepper speckle (the old granite PROC read as mosaic at distance)
  const GP = mat.PROC.limestone('vec3(0.82, 0.82, 0.80)');
  const granite = mat.std({ color: 0xffffff, roughness: 0.8, metalness: 0, vertexColors: true }, {
    uniforms: GP.uniforms,                     // uTint / uMoss — without these the GLSL defaults to 0 (black!)
    fragHead: GP.fragHead + ARC_GLSL + 'float g_wet;',
    fragColor: GP.fragColor + /* glsl */ `
      {
        vec3 wpS = vWPos; vec3 wnS = normalize(vWNrm);
        // weathering patches, lichen rosettes, vertical run-off streaks
        float wpat = n_fbm3(wpS * 1.8 + 31.0, 3);
        diffuseColor.rgb *= 0.84 + 0.22 * smoothstep(-0.45, 0.5, wpat);
        vec2 wl = n_worley3(wpS * 7.0 + 5.0);
        float lichP = smoothstep(0.05, 0.45, n_fbm3(wpS * 1.3 + 2.0, 2));
        float lich = (1.0 - smoothstep(0.1, 0.24, wl.x)) * lichP;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.40, 0.33), lich * 0.55);
        float sideS = 1.0 - abs(wnS.y);
        float vs = n_fbm3(vec3((wpS.x + wpS.z) * 7.0, wpS.y * 0.7, 3.0), 3);
        diffuseColor.rgb *= 1.0 - sideS * smoothstep(0.0, 0.45, vs) * 0.09;
        // ---- dressed ashlar on the flank (细凿青石): large blocks in ~0.62 m
        // courses, 1.1~2.0 m stones staggered per course, hairline seams that
        // only resolve up close — at film distance it reads as monolithic stone,
        // not a ruled brick grid
        float rr = length(vec2(wpS.z - ARC_ZC, wpS.y - ARC_YC));
        float pxR = length(fwidth(wpS));
        float thA = atan(wpS.z - ARC_ZC, wpS.y - ARC_YC);
        float wallX = abs(abs(wpS.x - BR_X0) - BR_HW);
        float wallM = 1.0 - smoothstep(0.02, 0.08, wallX);
        float ringBand = smoothstep(ARC_R - 0.30, ARC_R - 0.24, rr) * (1.0 - smoothstep(ARC_R + 0.24, ARC_R + 0.30, rr));
        float spandrelM = wallM * smoothstep(ARC_R + 0.24, ARC_R + 0.34, rr)
                        * (1.0 - smoothstep(0.55, 0.9, abs(wnS.y)));   // vertical faces only — the coping reads as one course
        float courseH = 0.62;
        float courseF = (wpS.y - WATER_Y) / courseH;
        float ci = floor(courseF), cf = fract(courseF);
        float cHash = fract(sin(ci * 127.1) * 43758.5453);
        float cHash2 = fract(sin(ci * 311.7 + 5.0) * 43758.5453);
        float blen = 1.15 + cHash * 0.85;                      // stone length varies per course
        float zf = wpS.z / blen + cHash2 * 5.0;
        float vj = fract(zf);
        float vE = min(vj, 1.0 - vj) * blen;
        float bHash = fract(sin(ci * 91.3 + floor(zf) * 37.9) * 43758.5453);
        // hairline seams (~7 mm, soft-edged) that fade out with pixel size
        float fadeJ = 1.0 - smoothstep(0.016, 0.05, pxR);
        float seamW = 0.0035 + pxR * 0.35;
        float dj = min(cf, 1.0 - cf) * courseH;
        float groove = 1.0 - smoothstep(seamW * 0.4, seamW, dj);
        // the occasional vertical joint runs through — a longer stone bridges it
        float vg = (1.0 - smoothstep(seamW * 0.4, seamW, vE)) * step(0.3, bHash);
        float seam = max(groove, vg) * spandrelM * fadeJ;
        diffuseColor.rgb *= 1.0 - seam * 0.30;
        g_h -= seam * 0.30;
        // settled arrises: soft shading within ~9 cm of every joint, so each block
        // reads faintly pillow-faced rather than a flat ruled grid
        float eA = 1.0 - smoothstep(0.02, 0.09, min(dj, vE));
        diffuseColor.rgb *= 1.0 - eA * spandrelM * (0.04 + 0.06 * fadeJ);
        g_h -= eA * spandrelM * 0.12 * fadeJ;
        // per-block tone drift — same stone family, weathered unevenly (this
        // survives to film distance and is what sells the coursing there)
        diffuseColor.rgb *= mix(1.0, 0.88 + 0.24 * bHash, spandrelM * 0.9);
        // 券脸石 ring band: radial voussoir joints, same hairline treatment
        float arcS = thA * ARC_R;
        float vj2 = fract(arcS / 0.5);
        float vE2 = min(vj2, 1.0 - vj2) * 0.5;
        float vg2 = 1.0 - smoothstep(seamW * 0.4, seamW, vE2);
        float rb2 = wallM * ringBand * fadeJ;
        diffuseColor.rgb *= 1.0 - vg2 * rb2 * 0.4;
        g_h -= vg2 * rb2 * 0.35;
        // faint broad micro-relief only — no salt-and-pepper speckle (that read as mosaic)
        float pxS = length(fwidth(wpS));
        g_h += n_fbm3(wpS * 2.0, 2) * 0.03;
        float h = vWPos.y - WATER_Y;
        float n1 = n_fbm3(vWPos * vec3(3.0, 1.2, 3.0), 3);
        float wet = 1.0 - smoothstep(0.02, 0.5 + 0.25 * n1, h);
        float band = smoothstep(-0.3, -0.04, h) * (1.0 - smoothstep(0.04, 0.2 + 0.12 * n1, h));
        float under = 1.0 - smoothstep(-0.35, -0.02, h);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.52, 0.50, 0.45), wet * 0.65);
        vec3 algae = mix(vec3(0.030, 0.040, 0.014), vec3(0.06, 0.07, 0.025), n1 * 0.5 + 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, algae, band * 0.88);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.045, 0.028), under * 0.60);
        // tide lines: thin dark rings left by past water levels on the vertical faces
        float fwh = fwidth(h);
        float tide = 0.0;
        tide += (1.0 - smoothstep(0.004, 0.012 + fwh, abs(h - 0.075 - 0.012 * n1))) * 0.55;
        tide += (1.0 - smoothstep(0.003, 0.01 + fwh, abs(h - 0.17 - 0.02 * n1))) * 0.35;
        tide += (1.0 - smoothstep(0.003, 0.009 + fwh, abs(h - 0.3 - 0.03 * n1))) * 0.2;
        tide *= sideS * (1.0 - smoothstep(0.006, 0.02, pxS));
        diffuseColor.rgb *= 1.0 - tide * 0.45;
        // moss: cushions on the upward faces (footing steps, ledges, coping, capitals) and creeping up the
        // damp lower courses; fine clumpy texture resolved only up close
        float upS = smoothstep(0.3, 0.85, wnS.y);
        float mN = n_fbm3(wpS * 2.6 + 13.0, 3) * 0.5 + 0.5;
        float aaM = 1.0 - smoothstep(0.003, 0.01, pxS);
        float mF = n_fbm3(wpS * 26.0 + 5.0, 2) * aaM;
        float nearWS = 1.0 - smoothstep(0.25, 2.2, h);
        float walk = smoothstep(-0.12, 0.02, vWPos.y) * (1.0 - smoothstep(${f6(HW + 0.2)}, ${f6(HW + 0.55)}, abs(vWPos.x - BR_X0)));
        float moss = upS * smoothstep(0.46, 0.66, mN + 0.22 * nearWS) * (1.0 - walk * 0.85)
                   + sideS * nearWS * smoothstep(0.58, 0.78, mN + 0.1 * mF) * 0.75 * (1.0 - under);
        moss = clamp(moss * (0.8 + 0.35 * mF), 0.0, 1.0);
        vec3 mossC = mix(vec3(0.045, 0.07, 0.018), vec3(0.12, 0.14, 0.035), smoothstep(0.3, 0.8, mN + 0.3 * mF));
        diffuseColor.rgb = mix(diffuseColor.rgb, mossC, moss * 0.88);
        g_h += moss * (0.25 + 0.35 * mF) - tide * 0.05;
        g_wet = max(wet, band) * (1.0 - moss * 0.6);
      }
    `,
    fragRough: GP.fragRough + `roughnessFactor = mix(roughnessFactor, 0.32, g_wet * 0.7);`,
    fragNormal: GP.fragNormal,
    // the golden-hour sky fills real shade more than the captured IBL does — a
    // small lift keeps the shadowed flank / soffit reading as stone, not soot
    fragLight: AO_GLSL + 'reflectedLight.indirectDiffuse *= 1.12;',
  });
  granite.name = 'bridgeGranite';

  // ---------------------------------------------------------------- geometry helpers
  const B = new Builder();

  function paint(g, r, gg, b) {
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  }
  // per-stone tint: keep variation tiny (~1%) so big surfaces read as one stone,
  // not a patchwork of differently-shaded blocks (the old 0.72..1.08 was the mosaic)
  const addStone = (g, m = null, tone = 1) => { const t = tone * (0.985 + 0.015 * rnd.next()); const w = rnd.next(); return B.add(paint(g, t * (1.0 + 0.008 * w), t * (0.996 + 0.004 * w), t * (0.992 + 0.008 * (1 - w))), granite, m); };

  const rbox = (w, h, d, r, seg = dseg(2, 1)) => new RBox(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.45));

  // cheap deterministic 3D value noise for rough stone
  const hash3 = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function vnoise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const L1 = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
    return L1(L1(L1(c(0, 0, 0), c(1, 0, 0), u), L1(c(0, 1, 0), c(1, 1, 0), u), v), L1(L1(c(0, 0, 1), c(1, 0, 1), u), L1(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  const fbm3 = (x, y, z) => vnoise3(x, y, z) * 0.55 + vnoise3(x * 2.1 + 7, y * 2.1, z * 2.1) * 0.3 + vnoise3(x * 4.3, y * 4.3 + 3, z * 4.3) * 0.15;

  // rough-hewn granite block: subdivided rounded box with noise displacement (centred at origin)
  function stoneBlock(w, h, d, r = 0.035, amp = 0.012, step = 0.09, seed = 0, faceBulge = 0.0) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    r = Math.min(r, hx * 0.45, hy * 0.45, hz * 0.45);
    const axis = (half) => {
      const inner = half - r; const pts = [-half, -half + r * 0.3, -inner];
      // extra rows across the drafted margin
      const m1 = half - 0.06, m2 = half - 0.1;
      const useM = m2 > 0.04 && m1 < inner - 0.008;
      const lo = useM ? m2 : inner;
      if (useM) pts.push(-m1, -m2);
      const n = Math.max(1, Math.ceil((2 * lo) / step));
      for (let i = 1; i < n; i++) pts.push(-lo + (2 * lo * i) / n);
      if (useM) pts.push(m2, m1);
      pts.push(inner, half - r * 0.3, half); return pts;
    };
    const C = [axis(hx), axis(hy), axis(hz)], Hh = [hx, hy, hz];
    const pos = [], idx = [];
    const faces = [[0, 1, 2], [1, 2, 0], [2, 0, 1]]; // [normal axis, b, c] with b x c = a
    for (const [a, b, c] of faces) for (const s of [1, -1]) {
      const cb = C[b], cc = C[c]; const base = pos.length / 3;
      for (let j = 0; j < cc.length; j++) for (let i = 0; i < cb.length; i++) { const p = [0, 0, 0]; p[a] = s * Hh[a]; p[b] = cb[i]; p[c] = cc[j]; pos.push(p[0], p[1], p[2]); }
      const nb = cb.length;
      for (let j = 0; j < cc.length - 1; j++) for (let i = 0; i < nb - 1; i++) {
        const v00 = base + j * nb + i, v10 = v00 + 1, v01 = v00 + nb, v11 = v01 + 1;
        if (s > 0) idx.push(v00, v10, v11, v00, v11, v01); else idx.push(v00, v11, v10, v00, v01, v11);
      }
    }
    const ih = [hx - r, hy - r, hz - r];
    for (let k = 0; k < pos.length; k += 3) {
      const p = [pos[k], pos[k + 1], pos[k + 2]];
      const q = [clamp(p[0], -ih[0], ih[0]), clamp(p[1], -ih[1], ih[1]), clamp(p[2], -ih[2], ih[2])];
      let dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2]; const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      // face-centre bulge (rock-faced ashlar) + noise
      // in-face distance to the nearest arris (metres) -> drafted margin + rock-faced centre
      const dd = [Hh[0] - Math.abs(p[0]), Hh[1] - Math.abs(p[1]), Hh[2] - Math.abs(p[2])].sort((a, b) => a - b);
      const dEdge = dd[1];
      const inC = sm(0.035, 0.09, dEdge);
      const bul = faceBulge * inC;
      const rough = (fbm3(p[0] * 9 + seed, p[1] * 9 + seed * 0.3, p[2] * 9 - seed) - 0.5) * 2 * amp;
      const pitch = (vnoise3(p[0] * 31 + seed, p[1] * 31, p[2] * 31 - seed) - 0.5) * amp * 0.6;
      // chipped arrises: knock material off near edges/corners
      const chip = -amp * 2.2 * (1 - sm(0.0, 0.05, dEdge)) * Math.max(0, fbm3(p[0] * 13 - seed, p[1] * 13 + seed, p[2] * 13) - 0.4) * 2.5;
      const nz = (rough + pitch) * (0.35 + 0.65 * inC) + bul + chip;
      pos[k] = q[0] + dx * (r + nz); pos[k + 1] = q[1] + dy * (r + nz); pos[k + 2] = q[2] + dz * (r + nz);
    }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g = geom.mergeVertices(g, 1e-5);
    g.computeVertexNormals();
    return g;
  }



  // ---------------------------------------------------------------- DECK steps (踏步)
  {
    const pw = 2 * (HW - 0.22) + 0.01;           // walkway seating between the flank walls
    const sr = ctx.rng('steps');
    for (let i = 0; i < N_STEPS; i++) {
      const z0 = zEndN + i * STEP_W, z1 = z0 + STEP_W;
      const zm = (z0 + z1) / 2;
      const yTop = Y0 + profY(zm);                 // tread at the step-centre height, so the
                                                   // treads recess just below the smooth coping
      const dz = Math.abs(zm - ZC);                // seat into the ring extrados over the opening,
      const seat = dz < R_OUT - 0.05               // deep into the spandrel fill on the haunches
        ? Math.max(profY(zm) - 0.18, YRING + Math.sqrt(Math.max(R_OUT * R_OUT - dz * dz, 0)) - 0.02)
        : profY(zm) - 0.5;
      const yBot = Y0 + seat;
      addStone(rbox(pw, Math.max(yTop - yBot, 0.04), z1 - z0 - 0.008, 0.007), mat4([X0, (yTop + yBot) / 2, zm]), 0.985 + sr.next() * 0.03);
    }
  }

  // ---------------------------------------------------------------- fallen maple leaves + a few peach petals
  // drifted against the posts and into the tread joints (wind from the west piles them on the east side)
  {
    const leafMat = mat.std({ color: 0xffffff, roughness: 0.62, metalness: 0, vertexColors: true, side: THREE.DoubleSide }, {
      fragHead: 'float g_h;',
      fragColor: /* glsl */ `
        {
          vec3 wp = vWPos;
          float n = n_fbm3(wp * 40.0, 2) * (1.0 - smoothstep(0.002, 0.006, length(fwidth(wp))));
          diffuseColor.rgb = diffuse * vColor.rgb * (0.85 + 0.25 * n);
          g_h = n;
        }
      `,
      fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0006);`,
    });
    leafMat.name = 'bridgeLeaves';
    const leafGeo = (R, lobes, curl, petal) => {
      const N = petal ? 10 : 28; const pos = [0, curl * 0.6, 0], idx = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        let r;
        if (petal) r = R * (0.75 + 0.25 * Math.cos(a)) * (1 - 0.35 * Math.pow(Math.max(Math.cos(a), 0), 30)); // notched tip
        else { const k = Math.abs(Math.cos(a * lobes / 2)); r = R * (0.42 + 0.58 * Math.pow(k, 0.45)) * (a > Math.PI * 0.82 && a < Math.PI * 1.18 ? 0.55 : 1); }
        pos.push(r * Math.cos(a), curl * Math.pow(r / R, 2) * (0.6 + 0.4 * Math.sin(a * 2)), r * Math.sin(a));
        idx.push(0, 1 + ((i + 1) % N), 1 + i);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const lr = ctx.rng('bridgeLeaves');
    const pals = [[0.42, 0.045, 0.02], [0.5, 0.12, 0.02], [0.33, 0.06, 0.03], [0.55, 0.26, 0.04], [0.2, 0.09, 0.035], [0.16, 0.11, 0.05]];
    const L2 = zEndS - zEndN;
    for (let i = 0; i < 170; i++) {
      const petal = i % 5 === 4;
      const s = (lr.next() - 0.5) * (L2 - 0.4);
      const zz = ZC + s;
      // mostly against the sills (east side heavier), some scattered across the boards
      const side = lr.next() < 0.68 ? 1 : -1;
      const u = lr.next() < 0.75 ? side * (HW - 0.32 - Math.pow(lr.next(), 2) * 0.55) : (lr.next() - 0.5) * 2.4;
      const R = petal ? 0.011 + lr.next() * 0.004 : 0.03 + lr.next() * 0.025;
      const g = leafGeo(R, 5 + (lr.next() < 0.5 ? 2 : 0), (lr.next() - 0.3) * R * 0.5, petal);
      g.rotateY(lr.next() * Math.PI * 2);
      const c0 = petal ? [0.78, 0.5, 0.52] : pals[Math.floor(lr.next() * pals.length)];
      const k = 0.8 + lr.next() * 0.35;
      paint(g, c0[0] * k, c0[1] * k, c0[2] * k);
      B.add(g, leafMat, mat4([X0 + u, treadTop(zz) + 0.004, zz], [(lr.next() - 0.5) * 0.12, 0, (lr.next() - 0.5) * 0.12]));
    }
  }

  // -------------------------------------------------------------- STONE ARCH RING (券石拱圈) — a near-semicircular
  // opening springing at the water, independent of the deck profile (as on 玉带桥)
  {
    const Xw = HW + 0.05;                        // the ring spans the full deck width
    const rMid = (R_IN + R_OUT) / 2;
    const TH_R = 1.61;                           // half-angle — the springs plunge just under the water
    const nV = Math.max(24, Math.round((2 * TH_R * rMid) / 0.42));  // ~0.42 m voussoirs
    const wj = 0.005;                            // hairline radial joints (fine voussoir band)
    const vr = ctx.rng('voussoir');
    for (let s = 0; s < nV; s++) {
      const t0 = -TH_R + (2 * TH_R) * s / nV;
      const t1 = -TH_R + (2 * TH_R) * (s + 1) / nV;
      const tm = (t0 + t1) / 2;
      const cy = YRING + rMid * Math.cos(tm), cz = ZC + rMid * Math.sin(tm);
      const arcLen = (t1 - t0) * rMid;
      const g = stoneBlock(Xw * 2, R_OUT - R_IN - wj, arcLen - wj, 0.012, 0.01, 0.06, vr.next() * 50, 0.006);
      addStone(g, mat4([X0, cy, cz], [tm, 0, 0]), 1.04 + vr.next() * 0.04);   // rotate so local Y -> radial, Z -> tangential
    }
    // 拱顶石 (keystone) slightly proud at the crown
    addStone(stoneBlock(Xw * 2 + 0.02, R_OUT - R_IN + 0.03, 0.26, 0.025, 0.01, 0.1, 7, 0.012),
      mat4([X0, YRING + rMid, ZC], [0, 0, 0]), 1.05);
    // 分水金刚墙: foundation blocks the ring springs onto, standing out of the water
    for (const sgn of [-1, 1]) {
      const fr = ctx.rng('spring' + sgn);
      addStone(stoneBlock(2 * HW + 0.5, (WATER + 0.16) - (BOTTOM - 0.5), 1.5, 0.05, 0.014, 0.14, sgn * 13, 0.006),
      mat4([X0, ((WATER + 0.16) + (BOTTOM - 0.5)) / 2, ZC + sgn * rMid], [0, (fr.next() - 0.5) * 0.04, 0]), 0.97 + fr.next() * 0.05);
    }
  }

  // ---------------------------------------------------------------- ABUTMENTS + landing slabs
  function abutment(face, end, dir) {
    // dir = -1 for the north abutment (land toward -z), +1 south
    const zOut = end + dir * 1.9;               // land-side end
    const zIn = face;                           // pond face
    const z0 = Math.min(zIn, zOut), z1 = Math.max(zIn, zOut);
    const xa = X0 - 2.45, xb = X0 + 2.45;
    const yb = BOTTOM - 0.45, yt = ABUT_TOP;
    const H = yt - 0.2 - yb; // walls stop under the coping course
    const nC = Math.max(3, Math.round(H / 0.4));
    const ch = H / nC;
    const r = ctx.rng('abut' + dir);
    const depth = 0.55;
    const wall = (along0, along1, perp, out, axis) => {
      for (let k = 0; k < nC; k++) {
        let a = along0 + (k % 2 ? 0.35 : 0) * 0;
        let first = true;
        const y = yb + ch * (k + 0.5);
        while (a < along1 - 0.05) {
          let len = first && k % 2 ? 0.45 + r.next() * 0.3 : 0.75 + r.next() * 0.55;
          first = false;
          if (along1 - (a + len) < 0.35) len = along1 - a;
          const c = a + len / 2;
          // cull blocks that can never be seen: below the pond floor, or buried in the bank
          const ox = axis === 'x' ? c : perp + out * 0.35, oz = axis === 'x' ? perp + out * 0.35 : c;
          const yTopB = y + ch / 2;
          let floorHere = BOTTOM;
          if (pondSite && pondSite.floorY) { try { floorHere = pondSite.floorY(ox, oz); } catch (e) { /* keep */ } }
          const wet = inWater(ox, oz) || inWater(ox + 0.4, oz) || inWater(ox - 0.4, oz) || inWater(ox, oz + 0.4) || inWater(ox, oz - 0.4);
          if (yTopB < floorHere - 0.03 || (!wet && yTopB < Y0 - 0.25)) { a += len; continue; }
          const g = axis === 'x'
            ? stoneBlock(len - 0.014, ch - 0.014, depth, 0.035, 0.014, 0.22, r.next() * 100, 0.022)
            : stoneBlock(depth, ch - 0.014, len - 0.014, 0.035, 0.014, 0.22, r.next() * 100, 0.022);
          const pz = perp - out * depth / 2;
          const m = axis === 'x' ? mat4([c, y, pz]) : mat4([pz, y, c]);
          addStone(g, m, 0.97 + r.next() * 0.05);
          a += len;
        }
      }
    };
    // pond face (normal along -dir in z), side walls (normals +-x)
    wall(xa, xb, zIn, -dir, 'x');
    wall(z0 + (dir > 0 ? depth : 0), z1 - (dir < 0 ? depth : 0), xb, +1, 'z');
    wall(z0 + (dir > 0 ? depth : 0), z1 - (dir < 0 ? depth : 0), xa, -1, 'z');
    // coping slabs over the top
    const nS = Math.max(2, Math.round((z1 - z0) / 1.0));
    for (let i = 0; i < nS; i++) {
      const za = z0 + ((z1 - z0) * i) / nS, zb2 = z0 + ((z1 - z0) * (i + 1)) / nS;
      addStone(stoneBlock(xb - xa + 0.08, 0.2, zb2 - za - 0.012, 0.03, 0.006, 0.2, za * 7), mat4([X0, yt - 0.1 + 0.001, (za + zb2) / 2]), 1.03);
    }
    // landing slabs beyond the deck end (top at LAND_TOP)
    const lz0 = Math.min(end, end + dir * 1.9), lz1 = Math.max(end, end + dir * 1.9);
    const slabT = LAND_TOP - yt;
    for (let i = 0; i < 2; i++) {
      const za = lz0 + ((lz1 - lz0) * i) / 2, zb2 = lz0 + ((lz1 - lz0) * (i + 1)) / 2;
      addStone(stoneBlock(2 * HW + 0.9, slabT, zb2 - za - 0.012, 0.03, 0.004, 0.2, za * 13 + 5), mat4([X0, yt + slabT / 2, (za + zb2) / 2]), 1.03);
    }
  }
  abutment(faceN, zEndN, -1);
  abutment(faceS, zEndS, +1);

  // ---------------------------------------------------------------- RAILINGS
  const deckLen = zEndS - zEndN;
  const nPosts = Math.max(BR.posts || 9, Math.round(deckLen / 1.55) + 1);
  const endOut = 0.24; // end posts stand on the landing, beyond the deck end
  const zPostN = zEndN - endOut, zPostS = zEndS + endOut;
  const postZ = [zPostN];
  for (let k = 1; k < nPosts - 1; k++) { postZ.push(zEndN + (deckLen * k) / (nPosts - 1)); }
  postZ.push(zPostS);

  // A continuous swept solid between two z-station profiles (bottom fn, top fn),
  // used for the flank walls and coping so they read as ONE smooth stone surface
  // (fine modelling, like the buildings) rather than a stack of gapped blocks.
  function continuousBand(side, xC, halfW, topFn, botFn, nz = 200) {
    const xo = xC + side * halfW, xi = xC - side * halfW;
    const pos = [], idx = [];
    const push = (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; };
    const rings = [];
    for (let i = 0; i <= nz; i++) {
      const z = zEndN + (zEndS - zEndN) * (i / nz);
      const yT = topFn(z), yB = botFn(z);
      rings.push([push(xo, yB, z), push(xo, yT, z), push(xi, yT, z), push(xi, yB, z)]);
    }
    for (let i = 0; i < nz; i++) {
      const a = rings[i], b = rings[i + 1];
      for (let j = 0; j < 4; j++) {
        const j1 = (j + 1) % 4;
        idx.push(a[j], a[j1], b[j1], a[j], b[j1], b[j]);
      }
    }
    for (const [ri, flip] of [[0, true], [nz, false]]) {
      const r = rings[ri];
      if (flip) idx.push(r[0], r[2], r[1], r[0], r[3], r[2]);
      else idx.push(r[0], r[1], r[2], r[0], r[2], r[3]);
    }
    if (side < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    // settle the face a few mm off true — real coursed masonry undulates,
    // a laser-flat wall is what makes it read as cast concrete
    const pp = g.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const n = (fbm3(pp.getZ(i) * 0.85 + side * 3.1, pp.getY(i) * 0.85, 11.0) - 0.5) * 2;
      pp.setX(i, pp.getX(i) + n * 0.009);
    }
    g.computeVertexNormals();
    return g;
  }

  // merge small carved pieces (slabs, torus curls, spheres) into one geometry so each
  // panel / finial stays a single mesh
  function mergeGeo(items) {
    const pos = [], nor = [], idx = []; let off = 0;
    for (const [g, m] of items) {
      const gg = g.clone();
      gg.deleteAttribute('uv'); gg.deleteAttribute('color');
      if (m) gg.applyMatrix4(m);
      const p = gg.attributes.position.array, n = gg.attributes.normal.array;
      for (let i = 0; i < p.length; i++) pos.push(p[i]);
      for (let i = 0; i < n.length; i++) nor.push(n[i]);
      const ix = gg.index ? gg.index.array : null;
      if (ix) { for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off); }
      else { for (let i = 0; i < gg.attributes.position.count; i++) idx.push(i + off); }
      off += gg.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setIndex(idx);
    return out;
  }

  // 望柱柱头: moulded neck ring under a carved cloud-bud head (as on the real
  // posts — a substantial head, not a bead)
  const finialGeo = (s) => mergeGeo([
    [new THREE.TorusGeometry(0.088 * s, 0.016, 8, 18).rotateX(Math.PI / 2), mat4([0, 0.02, 0])],
    [new THREE.LatheGeometry(
      [[0.078, 0], [0.092, 0.03], [0.086, 0.07], [0.060, 0.115], [0.032, 0.15], [0.010, 0.170], [0, 0.175]]
        .map(p => new THREE.Vector2(p[0] * s, p[1] * s)), 14), mat4([0, 0.05, 0])],
  ]);

  for (const side of [-1, 1]) {
    // 裙肩墙 + 眉石: continuous smooth stone faces (the extrados -> deck-edge band
    // and its coping), NOT a stack of blocks — this is what makes it read as 玉带桥
    const xr = X0 + side * (HW - 0.11);
    addStone(continuousBand(side, xr, 0.11, (z) => Y0 + profY(z), wallBaseY), null, 1.0);
    addStone(continuousBand(side, X0 + side * (HW - 0.06), 0.14, (z) => Y0 + profY(z) + 0.05, (z) => Y0 + profY(z)), null, 1.03);
    const COP = 0.05;                            // coping height the balustrade stands on
    const railH = 0.45, wP = 0.13;
    const deckTop = (z) => Y0 + profY(z) + COP;  // the balustrade rides the smooth flank line
    // 寻杖 (top rail): the moulded capping member riding over the carved panels
    for (let k = 0; k < postZ.length - 1; k++) {
      const za = postZ[k], zb = postZ[k + 1];
      const ya = deckTop(za) + railH, yb = deckTop(zb) + railH;
      const len = Math.hypot(zb - za, yb - ya);
      const ax = Math.atan2(zb - za, yb - ya);
      // beam/cap are Y-long like the cylinder they replace: ax (atan2(dz,dy))
      // aligns a Y axis with the segment; a Z-long box under the same rotation
      // swings 90° off and sticks up out of the railing on the ramps
      addStone(rbox(0.11, len + 0.02, 0.09, 0.008), mat4([xr, (ya + yb) / 2, (za + zb) / 2], [ax, 0, 0]), 1.04);          // moulded beam
      addStone(rbox(0.13, len + 0.02, 0.026, 0.006), mat4([xr, (ya + yb) / 2 + 0.048, (za + zb) / 2], [ax, 0, 0]), 1.04);  // cap bead
    }
    // 镂空花板栏板: pierced openwork between the posts (as on 玉带桥) — a sloped
    // sill (地栿) riding the coping, a thin sub-rail (绦环) under the 寻杖, and a
    // row of plumb carved uprights (云纹花板立件) with real see-through gaps.
    // Every piece is built in world heights, so the band's sides stay plumb while
    // top and bottom follow the deck slope — the real trapezoid read.
    for (let k = 0; k < postZ.length - 1; k++) {
      const wA = k === 0 ? 0.10 : wP / 2, wB = k === postZ.length - 2 ? 0.10 : wP / 2;
      const za = postZ[k] + wA + 0.02, zb = postZ[k + 1] - wB - 0.02;
      const L = zb - za;
      if (L < 0.3) continue;
      const zm = (za + zb) / 2;
      const sTop = (z) => deckTop(z) + 0.085;          // sill top
      const rBot = (z) => deckTop(z) + railH - 0.075;  // underside of the 寻杖
      const segLen = (ya2, yb2) => Math.hypot(L, yb2 - ya2);
      const tilt = (ya2, yb2) => Math.atan2(L, yb2 - ya2);
      {   // 地栿
        const a = sTop(za) - 0.037, b = sTop(zb) - 0.037;
        addStone(rbox(0.10, segLen(a, b) + 0.02, 0.055, 0.006), mat4([xr, (a + b) / 2, zm], [tilt(a, b), 0, 0]), 1.04);
      }
      {   // 绦环 sub-rail
        const a = rBot(za) + 0.02, b = rBot(zb) + 0.02;
        addStone(rbox(0.08, segLen(a, b) + 0.02, 0.05, 0.005), mat4([xr, (a + b) / 2, zm], [tilt(a, b), 0, 0]), 1.04);
      }
      // 透雕花板: one pierced slab per bay — a trapezoid cut to the sill and
      // sub-rail lines (plumb sides against the posts, sloped top and bottom,
      // exactly as on the real bridge) with a row of ruyi-comma openings cut
      // right through (extrude with holes — real pierced stone, not appliqué)
      {
        const ms = new Mesher(granite);
        const yLo = (z) => sTop(z) + 0.012, yHi = (z) => rBot(z) - 0.012;
        const outer = [[za, yLo(za)], [zb, yLo(zb)], [zb, yHi(zb)], [za, yHi(za)]];
        const cy = (z) => (yLo(z) + yHi(z)) / 2, ch = (z) => yHi(z) - yLo(z);
        const holes = [];
        const nC = Math.max(2, Math.round(L / 0.26));
        const D2R = Math.PI / 180;
        // 云钩 opening: a comma — main disc arc 250°, then the tail curls
        // another 130° inward to ~1/3 radius so the mouth sits asymmetric on
        // the upper side (the cloud-scroll voids on real pierced panels);
        // mirrored alternately along the bay
        const commaHole = (cx, cyy, r, dir) => {
          const pts = [];
          for (let i = 0; i <= 18; i++) {
            const a = (100 + (250 * i) / 18) * D2R;
            pts.push([cx + dir * r * Math.cos(a), cyy + r * Math.sin(a)]);
          }
          for (let i = 1; i <= 10; i++) {
            const t = i / 10;
            const a = (350 + 130 * t) * D2R;
            pts.push([cx + dir * r * (1 - 0.7 * t) * Math.cos(a), cyy + r * (1 - 0.7 * t) * Math.sin(a)]);
          }
          return pts;
        };
        for (let i = 0; i < nC; i++) {
          const zc = za + (L * (i + 0.5)) / nC;
          holes.push(commaHole(zc, cy(zc), Math.min(0.42 * ch(zc), 0.105), i % 2 ? 1 : -1));
        }
        // local frame: x -> world z (along the bay), y -> world y, z -> outward
        extrude(ms, basis([xr, 0, 0], [0, 0, 1], [0, 1, 0], [side, 0, 0]), outer, holes, -0.028, 0.028);
        addStone(ms.toGeometry(), null, 1.04);
      }
    }
    // 望柱 with stacked cloud-ring finials on every post + 抱鼓石 at the ends
    for (let k = 0; k < postZ.length; k++) {
      const zp = postZ[k];
      const isEnd = k === 0 || k === postZ.length - 1;
      const w = isEnd ? 0.20 : wP;
      const h = isEnd ? 0.75 : railH;
      const dy0 = deckTop(zp);
      addStone(stoneBlock(w, h, w, 0.012, 0.006, 0.06, zp + side * 3, 0.004), mat4([xr, dy0 + h / 2, zp]), 1.04);
      addStone(rbox(w * 1.18, 0.06, w * 1.18, 0.006), mat4([xr, dy0 + h + 0.03, zp]), 1.04);
      addStone(finialGeo(isEnd ? 1.15 : 0.95), mat4([xr, dy0 + h + 0.06, zp]), 1.15);
      if (isEnd) {
        // 抱鼓石: 横置大鼓石夹护端柱 + 石础
        for (const fs of [-1, 1]) addStone(new THREE.CylinderGeometry(0.175, 0.175, 0.13, 16).rotateZ(Math.PI / 2), mat4([xr + fs * (w / 2 + 0.17), dy0 + 0.175, zp]), 1.03);
        addStone(stoneBlock(0.46, 0.18, 0.46, 0.03, 0.004, 0.08, zp + side, 0.006), mat4([xr, LAND_TOP + 0.09, zp]), 1.03);
      }
    }
    // 桥联: a tall couplet tablet set into the haunch — the field near-flush with
    // the wall face and a shade darker, a thin raised surround, and one column of
    // incised strokes down the middle (as the 楹联 on the real bridge)
    {
      const dzE = 3.6;
      for (const sgn of [-1, 1]) {
        const ze = ZC + sgn * dzE;
        const yb = wallBaseY(ze), yt2 = Y0 + profY(ze);
        const Hh = Math.min(1.15, yt2 - yb - 0.12);
        if (Hh < 0.55) continue;
        const ye = (yb + yt2) / 2, W = 0.42, xe = X0 + side * (HW + 0.004);
        addStone(rbox(0.010, Hh, W, 0.002), mat4([xe, ye, ze]), 0.84);              // tablet field
        const fW = 0.055, fx = xe + side * 0.008;
        addStone(rbox(0.014, fW, W + 2 * fW, 0.003), mat4([fx, ye + Hh / 2 + fW / 2 - 0.01, ze]), 1.05);
        addStone(rbox(0.014, fW, W + 2 * fW, 0.003), mat4([fx, ye - Hh / 2 - fW / 2 + 0.01, ze]), 1.05);
        addStone(rbox(0.014, Hh + 2 * fW, fW, 0.003), mat4([fx, ye, ze + W / 2 + fW / 2 - 0.01]), 1.05);
        addStone(rbox(0.014, Hh + 2 * fW, fW, 0.003), mat4([fx, ye, ze - W / 2 - fW / 2 + 0.01]), 1.05);
        const nCh = Math.floor((Hh - 0.18) / 0.15);
        for (let ci = 0; ci < nCh; ci++)
          addStone(rbox(0.004, 0.085, 0.10, 0.002), mat4([xe + side * 0.004, ye + Hh / 2 - 0.12 - ci * 0.15, ze]), 0.55);
      }
    }
    // 系船石 (mooring bosses) standing proud of the wall base right at the waterline
    for (const dzm of [5.2, 6.1]) for (const sgn of [-1, 1]) {
      const zm = ZC + sgn * dzm;
      if (zm > zEndN + 0.6 && zm < zEndS - 0.6)
        addStone(stoneBlock(0.30, 0.20, 0.42, 0.025, 0.006, 0.07, zm + side, 0.005), mat4([X0 + side * (HW + 0.12), WATER + 0.13, zm]), 0.97);
    }
  }

  // ---------------------------------------------------------------- assemble
  const group = B.build({ name: 'bridge', castShadow: true, receiveShadow: true });
  group.name = 'bridge';
  {
    const parts = [];
    let total = 0;
    for (const m of group.children) { const t = m.geometry.attributes.position.count / 3; total += t; parts.push(`${m.material.name}:${Math.round(t / 1000)}k`); }
    console.log(`[world] bridge stats: ${group.children.length} meshes, ${Math.round(total / 1000)}k tris (${parts.join(' ')})`);
  }

  return {
    object: group,
    finalize: (c) => debugEnv(c),
    showcase: [
      { cam: [3, 0.3, 22.5], look: [10, 1.0, 17], focal: 30 },        // sunlit west face, arch ring + spandrel
      { cam: [11.15, 3.4, 22], look: [10.3, 4.2, -16], focal: 30 },   // on the deck walking north, finial at eye level
      { cam: [-2, 1.6, 24], look: [10, 1.2, 15], focal: 28 },         // classic side elevation over the lotus
      { cam: [2, 2.2, 30], look: [10, 1.3, 16], focal: 30 },          // elevated south-west 3/4
      { cam: [5.5, 0.1, 19], look: [8.2, 1.9, 16], focal: 40 },       // bridge crown from water level
    ],
  };

  // debug context (only with ?bridgeDebug=1): pond hole in the fallback ground + water + floor
  function debugEnv(c) {
    let q = null; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    if (!q || !q.has('bridgeDebug') || c.modules.pond || c.modules.terrain) return;
    const fb = c.scene.getObjectByName('fallbackGround');
    if (fb) fb.visible = false;
    const poly = (L.pond && L.pond.outline) || [[0, 7], [20, 7], [20, 33], [0, 33]];
    const sh = new THREE.Shape([new THREE.Vector2(-300, 300), new THREE.Vector2(300, 300), new THREE.Vector2(300, -300), new THREE.Vector2(-300, -300)]);
    const hole = new THREE.Path(); poly.forEach(([x, z], i) => (i ? hole.lineTo(x, -z) : hole.moveTo(x, -z))); hole.closePath();
    sh.holes.push(hole);
    const gg = new THREE.ShapeGeometry(sh); gg.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(gg, c.M.graniteMossy); ground.receiveShadow = true; c.scene.add(ground);
    const ws = new THREE.Shape(); poly.forEach(([x, z], i) => (i ? ws.lineTo(x, -z) : ws.moveTo(x, -z)));
    const wg = new THREE.ShapeGeometry(ws); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg.clone().translate(0, WATER, 0), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.006, 0.012, 0.011), roughness: 0.05, metalness: 0.0 }));
    water.receiveShadow = true; c.scene.add(water);
    const floor = new THREE.Mesh(wg.clone().translate(0, BOTTOM, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.05, 0.045, 0.03), roughness: 1 }));
    c.scene.add(floor);
  }
}
