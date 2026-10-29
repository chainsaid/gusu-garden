// ---------------------------------------------------------------------------
// BRIDGE — arched chestnut garden bridge across the pond on the hall axis.
//
// Structure (all in world coordinates, axis x = L.bridge.x, running N-S):
//   * deck: a circular arc (crown = L.bridge.rise above ground), individual
//     weathered planks with gaps, nail heads and a worn walking line
//   * side fascia "arch boards": thick chestnut curved girders whose intrados
//     deepens toward the banks so the arch springs out of granite abutments,
//     with a dark capping band on top
//   * railings: posts (dark sleeve + detailed lathe lotus post cap on
//     every post), oval top rail swept up past the end posts, flat mid rail with nail
//     heads, base sill, plumb struts; larger end posts on granite bases
//   * substructure: inner girders, floor beams, two bents of stacked granite
//     piers on stepped footings with a chestnut cap beam
//   * coursed granite abutments + landing slabs adapted to the real shoreline
//     (queried from the pond module when present)
// Materials are bridge-specific variants of the shared procedural library.
// Vertex colours carry per-piece data (grain mode, grime, random tint).
// ---------------------------------------------------------------------------

import { seg as dseg } from '../core/detail.js';

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
  const RA = (HALF * HALF + RISE * RISE) / (2 * RISE); // deck-surface arc radius
  const YC = Y0 + RISE - RA;                           // arc centre height
  const WATER = (L.pond && L.pond.waterY != null) ? L.pond.waterY : -0.55;
  const BOTTOM = (L.pond && L.pond.bottomY != null) ? L.pond.bottomY : -1.7;
  const HW = BR.width / 2;

  const LAND_TOP = Y0 + 0.06;                                   // landing slab top
  const thE = Math.acos((RA - RISE + (LAND_TOP - Y0)) / RA);    // deck end angle (deck meets slab)
  const zEndN = ZC - RA * Math.sin(thE), zEndS = ZC + RA * Math.sin(thE);

  const yAt = (z, off = 0) => YC + Math.sqrt(Math.max((RA + off) ** 2 - (z - ZC) ** 2, 0));
  const thAtZ = (z, off = 0) => Math.asin(clamp((z - ZC) / (RA + off), -1, 1));
  const ptTh = (th, off = 0, x = X0) => new THREE.Vector3(x, YC + (RA + off) * Math.cos(th), ZC + (RA + off) * Math.sin(th));

  // 踏步 (deck steps): the walkable surface is stepped over the arch — treads level,
  // risers tall at the abutments and shallow toward the crown, as on real stone bridges
  const N_STEPS = Math.max(10, Math.round((zEndS - zEndN) / 0.34));
  const STEP_W = (zEndS - zEndN) / N_STEPS;
  const stepUpper = (z) => {                 // z of the step's upper (crown-side) edge
    const i = clamp(Math.floor((z - zEndN) / STEP_W), 0, N_STEPS - 1);
    const z0 = zEndN + i * STEP_W, z1 = z0 + STEP_W;
    return ((z0 + z1) / 2 < ZC) ? z1 : z0;
  };
  const treadTop = (z) => yAt(stepUpper(clamp(z, zEndN + 0.02, zEndS - 0.02)), 0.06);

  // cross-section (u = x offset from axis, v = radial offset from the deck surface)
  const XR = HW - 0.105;                       // railing centre line
  const BAND = { u0: HW - 0.25, u1: HW + 0.03, v0: -0.13, v1: 0.0 };
  const FT = -0.12;                            // fascia top (radial)
  const SILL = { w: 0.13, v0: -0.005, v1: 0.10 };
  const MID = { w: 0.066, v0: 0.535, v1: 0.665 };
  const TOP = { a: 0.052, b: 0.060, v: 0.925 };
  const PW = 0.16, EPW = 0.22;                 // post widths
  const GIRDER_X = [-0.82, 0, 0.82];
  const GIRDER_BOT = -0.74;
  // 莲瓣望柱头 lathe landmarks (local metres): chased band A, stud band B,
  // petal-bud start/height/radius, incised rings.
  const CAP = { bandA: [0.0384, 0.0583], bandB: [0.0795, 0.0935], bud0: 0.1255, H: 0.205, Rm: 0.086, tEnd: 0.93 };
  CAP.rings = [CAP.bud0 + CAP.H * 0.255, CAP.bud0 + CAP.H * 0.285, CAP.bud0 + CAP.H * 0.8];

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
  const SPRING_Y = ABUT_TOP - 0.10; // intrados meets the abutment face just below its top

  // fascia depth below FT as a function of z (deepens to spring from the abutments)
  const D0 = 0.62;
  const needN = (yAt(faceN) + FT) - SPRING_Y - D0;
  const needS = (yAt(faceS) + FT) - SPRING_Y - D0;
  function fasciaDepth(z) {
    let d = D0;
    const tn = (z - faceN), ts = (faceS - z);
    // inside the span: smooth ramp over the last ~4 m before each face
    const wn = Math.pow(sm(4.2, -0.2, tn), 2.0), ws = Math.pow(sm(4.2, -0.2, ts), 2.0);
    d += Math.max(needN, 0) * wn + Math.max(needS, 0) * ws;
    // inside the abutments: keep going down
    if (tn < 0) d += -tn * 0.8;
    if (ts < 0) d += -ts * 0.8;
    return d;
  }

  // ---------------------------------------------------------------- materials
  const ARC_GLSL = `
#define ARC_ZC ${f6(ZC)}
#define ARC_YC ${f6(YC)}
#define ARC_R ${f6(RA)}
#define BR_X0 ${f6(X0)}
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
      float aoA = mix(1.0, 0.4, underA);
      aoA *= mix(1.0, 0.5, smoothstep(0.1, 0.9, -wnA.y) * smoothstep(-0.3, 0.05, depthA));
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
  // dressed 青石 over the old chestnut lacquer. vColor: r = grain mode (0 arc / .5 vertical / 1 along x), g = grime, b = piece random
  const lac = mat.phys({ color: 0xffffff, roughness: 0.72, metalness: 0, clearcoat: 0.0, clearcoatRoughness: 0.5, vertexColors: true }, {
    fragHead: ARC_GLSL + 'float g_h; float g_r;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
        // g carries grime + 2 * kind (kind 1 = railing members, 0 = fascia / substructure)
        float kindR = step(1.5, vColor.g);
        float mode = vColor.r; float dirt = vColor.g - 2.0 * kindR; float pr = vColor.b;
        vec2 rel = vec2(wp.z - ARC_ZC, wp.y - ARC_YC);
        // local frame: x = along the member (arc length on the fascia, height on the
        // posts), y/z = across (metres, small local values)
        vec3 gp;
        float xr = wp.x - BR_X0;
        float xl = xr - floor(xr / 0.845 + 0.5) * 0.845; // member-centred across coordinate
        if (mode < 0.25) gp = vec3(atan(rel.x, rel.y) * ARC_R, (length(rel) - ARC_R) + 0.43, xl);
        else if (mode < 0.75) gp = vec3(wp.y, xl, (wp.z - ARC_ZC) * 0.35);
        else gp = vec3(xr, wp.y - 1.4, wp.z - ARC_ZC);
        float big = n_fbm3(wp * 0.35 + pr * 3.0, 3);
        float pxL = length(fwidth(wp));                         // pixel footprint (m): fades sub-pixel detail
        float aaF = 1.0 - smoothstep(0.003, 0.009, pxL);
        float gw = n_snoise3(gp * vec3(0.15, 2.5, 2.5) + pr * 7.0);
        float gl = n_fbm3((gp + pr * 13.0) * vec3(0.22, 15.0, 15.0) + vec3(0.0, gw * 0.7, gw * 0.7), 3);
        float fine = n_snoise3((gp + pr * 5.0) * vec3(1.4, 70.0, 70.0)) * aaF;
        // 水磨青石: cool blue-grey dressed stone, the railings a shade lighter
        vec3 baseR = vec3(0.245, 0.258, 0.258);
        vec3 baseS = vec3(0.185, 0.202, 0.208);
        vec3 base = mix(baseS, baseR, kindR) * (0.86 + 0.16 * (pr - 0.5) + 0.18 * big);
        // stone pits (was drying cracks) — a faint dark speckle, resolved only up close
        float chk = smoothstep(0.90, 0.985, n_snoise3(gp * vec3(6.0, 40.0, 40.0) + pr * 3.0)) * aaF;
        vec3 col = base * (1.0 - mix(0.12, 0.30, kindR) * lines - 0.12 * smoothstep(0.0, 0.4, gl) - 0.05 * fine - 0.55 * chk);
        // masonry joints: block courses along the member (voussoir joints on the arch
        // ring, course joints on the posts), plus a mid joint across the wide members
        float along = gp.x;
        float blk = 0.58 + 0.16 * pr;
        float aj2 = abs(fract(along / blk + 0.31 * pr + 0.5) - 0.5) * blk;
        float ajoint = 1.0 - smoothstep(0.0, 0.007 + fwidth(along) * 1.4, aj2 - 0.004);
        float cj2 = abs(fract(xl / 0.30 + 0.17 * pr) - 0.5) * 0.30;
        float acr = step(0.5, kindR) * step(0.10, abs(xl)) * (1.0 - smoothstep(0.0, 0.007 + fwidth(xl), cj2 - 0.004));
        lines = clamp(ajoint + acr, 0.0, 1.0) * (1.0 - smoothstep(0.012, 0.03, pxL));
        // fascia boards: horizontal seam between the two stacked arch boards + butt joints
        if (kindR < 0.5 && mode < 0.25) {
          float dR = ARC_R - length(rel);
          float faceS = smoothstep(0.8, 0.97, abs(wn.x));
          float seam = 1.0 - smoothstep(0.0, 0.006 + fwidth(dR), abs(dR - 0.47));
          float sA = atan(rel.x, rel.y) * ARC_R;
          float bj = 1.0 - smoothstep(0.0, 0.005 + fwidth(sA), abs(fract(sA / 3.65 + 0.5) - 0.5) * 3.65);
          col *= 1.0 - faceS * 0.6 * max(seam, bj * step(0.12, dR));
        }
        // sun-faded tops (slightly paler, more orange)
        float up = smoothstep(0.35, 0.95, wn.y);
        float underF = smoothstep(0.0, 0.14, ARC_R - length(rel)) * (1.0 - smoothstep(${f6(HW - 0.35)}, ${f6(HW + 0.06)}, abs(wp.x - BR_X0)));
        float fade = clamp(up * (0.5 + 0.5 * n_fbm3(wp * 2.2, 3)), 0.0, 1.0) * (1.0 - underF);
        col = mix(col, base * vec3(1.10, 1.12, 1.16), fade * 0.22);
        // rain streaks on vertical faces
        float vert = 1.0 - abs(wn.y);
        float streak = n_fbm3(vec3((wp.x + wp.z) * 4.0, wp.y * 0.4, pr * 7.0), 3);
        col *= 1.0 - vert * smoothstep(0.0, 0.5, streak) * 0.16;
        // grime (undersides / substructure)
        col = mix(col, col * vec3(0.36, 0.31, 0.30), clamp(dirt * (0.75 + 0.35 * big), 0.0, 1.0));
        // dark run-off stains below the capping band on the fascia faces + mottling
        float depthR = ARC_R - length(rel);
        float faceX = smoothstep(0.7, 0.95, abs(wn.x));
        float belowB = depthR - 0.12;
        float sN = n_fbm3(vec3(atan(rel.x, rel.y) * ARC_R * 2.6, depthR * 0.5, wp.x * 0.5 + pr), 3);
        float stain = faceX * step(0.0, belowB) * (1.0 - smoothstep(0.02, 0.5 + 0.25 * sN, belowB)) * smoothstep(-0.1, 0.45, sN);
        col *= 1.0 - mix(0.24, 0.38, kindR) * stain;
        float mott = n_fbm3(wp * vec3(1.1, 2.2, 1.1) + 17.0, 3);
        col *= mix(0.94, 0.9, kindR) + mix(0.12, 0.2, kindR) * mott;
        // damp near the water
        float damp = 1.0 - smoothstep(WATER_Y + 0.05, WATER_Y + 1.1, wp.y);
        col = mix(col, col * vec3(0.45, 0.45, 0.42), damp * 0.75);
        // worn lacquer revealing dark timber
        float wear = smoothstep(0.68, 0.84, n_fbm3(wp * 3.1 + pr * 9.0, 3) * 0.5 + 0.5);
        col = mix(col, vec3(0.30, 0.315, 0.31), wear * mix(0.28, 0.5, kindR));
        // chipped arrises: on the rounded edges (high normal curvature) the finish has flaked off to the
        // black undercoat and, in places, the grey timber; only resolved up close
        float curvL = length(fwidth(wn)) / max(pxL, 1e-5);
        float edgeN = n_fbm3(wp * 19.0 + pr * 4.0, 2) * 0.5 + 0.5;
        float edgeW = smoothstep(16.0, 42.0, curvL) * smoothstep(0.42, 0.66, edgeN) * (1.0 - smoothstep(0.0025, 0.007, pxL)) * kindR;
        col = mix(col, mix(vec3(0.06, 0.065, 0.065), vec3(0.33, 0.345, 0.34), smoothstep(0.62, 0.8, edgeN)), edgeW * 0.85);
        // hand-worn top rail: polished through to the black undercoat in long streaks along the rail
        float topRail = kindR * (1.0 - step(0.25, mode)) * (1.0 - step(0.02, dirt));
        float sAr = atan(rel.x, rel.y) * ARC_R;
        float handN = n_fbm3(vec3(sAr * 1.6, wp.x * 9.0, pr * 5.0), 3) * 0.5 + 0.5;
        float hand = topRail * smoothstep(0.45, 0.9, wn.y) * smoothstep(0.5, 0.72, handN + 0.18 * (1.0 - smoothstep(0.0, 4.0, abs(rel.x))));
        col = mix(col, base * 0.95, hand * 0.6);
        diffuseColor.rgb = diffuse * col;
        g_h = gl * 0.15 - lines * 0.18 + fine * 0.04 + wear * 0.3 - chk * 0.25 - edgeW * 0.4 - hand * 0.15;
        g_r = fade * 0.2 + dirt * 0.22 + wear * 0.3 + lines * 0.1 + chk * 0.2 - damp * 0.1 + kindR * 0.1 + edgeW * 0.25 - hand * 0.22;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_r, 0.4, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0022);
      { vec3 dn = fwidth(normal); roughnessFactor = max(roughnessFactor, clamp(length(dn) * 0.6, 0.0, 0.35)); }`,
    // the golden-hour sky fills real shade more than the captured IBL does: lift the lacquer's
    // indirect light so chestnut stays readable on the backlit (east) side
    fragLight: AO_GLSL + 'reflectedLight.indirectDiffuse *= 1.14;',
  });
  lac.name = 'bridgeLacquer';

  // weathered deck timber. vColor: r = plank random, g = plank wear, b = unused
  let PLANK_S0 = 0, PLANK_PITCH = 0.62;
  const plankUniforms = { uPlank: { value: new THREE.Vector2(0, 0.62) } };
  const wood = mat.std({ color: 0xffffff, roughness: 0.78, metalness: 0, vertexColors: true }, {
    uniforms: plankUniforms,
    fragHead: ARC_GLSL + 'uniform vec2 uPlank; float g_h; float g_r;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
        float pr = vColor.r; float wk = vColor.g;
        vec2 rel = vec2(wp.z - ARC_ZC, wp.y - ARC_YC);
        float rr = length(rel);
        float s = atan(rel.x, rel.y) * ARC_R;
        vec3 radial = vec3(0.0, rel.y, rel.x) / rr;
        float topF = smoothstep(0.6, 0.95, dot(wn, radial));
        // plank-local coordinates: pid (index), lu (-0.5..0.5 across the plank), x along the plank
        float u0 = (s - uPlank.x) / uPlank.y;
        float pid = floor(u0); float lu = u0 - pid - 0.5;
        float pidH = pid + vColor.b * 57.0;
        float ph = n_hash11(pidH * 1.37 + 0.5), ph2 = n_hash11(pidH * 2.91 + 3.1), ph3 = n_hash11(pidH * 5.17 + 7.3);
        float lx = wp.x - BR_X0;
        // knot (some planks): grain flows around it
        vec2 kc = vec2((ph2 - 0.5) * 2.4, (ph3 - 0.5) * 0.5);
        vec2 kd = vec2((lx - kc.x) / 0.05, (lu - kc.y) * uPlank.y / 0.028);
        float kr = length(kd);
        float hasKnot = 0.0;
        float knotWarp = hasKnot * 1.6 * exp(-kr * kr * 0.18) * sign(lu - kc.y + 1e-4);
        // straight growth rings along x with slow wander
        float wander = n_snoise(vec2(lx * 0.32, pidH * 3.1)) * 0.7 + n_snoise(vec2(lx * 1.4, pidH * 7.7)) * 0.18;
        float gc = lu * (5.0 + ph * 5.0) + wander * 1.4 + knotWarp + ph * 10.0 + 0.35 * n_snoise(vec2(lx * 0.7 + ph * 9.0, lu * 3.0));
        float ring = fract(gc);
        float late = 0.0;
        float pxD = length(fwidth(wp));
        float fine = n_fbm(vec2(lx * 1.2 + ph * 20.0, lu * 34.0 + ph * 50.0), 2) * (1.0 - smoothstep(0.002, 0.006, pxD));
        float fwG = fwidth(gc);
        late *= 1.0 - smoothstep(0.3, 0.8, fwG);
        float big = n_fbm3(wp * 0.7 + ph * 5.0, 3);
        vec3 warm = mix(vec3(0.205, 0.215, 0.212), vec3(0.165, 0.178, 0.182), ph2);   // 青石板基色（不同板略变化）
        vec3 silver = vec3(0.16, 0.172, 0.178);                                        // 石缝暗灰
        float grey = clamp(0.35 + 0.4 * ph + 0.25 * big + 0.2 * wk - 0.25 * hasKnot * 0.0, 0.0, 0.9);
        vec3 col = mix(warm, silver, grey);
        float ptone = n_hash11(pidH * 9.7 + 1.3);
        col *= 0.7 + 0.55 * ptone;
        // a few replaced boards (younger, warmer timber), lengthwise sun-bleaching, old water stains
        float repl = step(0.88, n_hash11(pidH * 6.1 + 2.0));
        col = mix(col, vec3(0.185, 0.2, 0.205) * (0.9 + 0.2 * ph), repl * 0.5);
        float bleach = smoothstep(0.1, 0.7, n_fbm(vec2(lx * 0.45 + ph * 7.0, lu * 2.5 + pidH * 0.37), 2));
        col = mix(col, col * vec3(1.18, 1.15, 1.12), 0.3 * bleach * (1.0 - repl));
        float wstain = smoothstep(0.58, 0.86, n_fbm3(wp * vec3(1.3, 1.0, 2.6) + 9.0, 3) * 0.5 + 0.5);
        col *= 1.0 - 0.28 * wstain;
        col = mix(col, col * vec3(1.12, 0.92, 0.8), smoothstep(0.75, 0.95, n_hash11(pidH * 4.3 + 8.0)) * 0.6);
        col *= 1.0 - 0.2 * late;
        col *= 1.0 - 0.07 * fine;
        // knots
        col = mix(col, col * vec3(0.35, 0.28, 0.24), hasKnot * (1.0 - smoothstep(0.6, 1.0, kr)));
        col *= 1.0 - hasKnot * 0.25 * (1.0 - smoothstep(1.0, 1.8, kr)) * smoothstep(0.6, 1.0, kr);
        // drying checks: thin dark cracks along the grain
        float ck = abs(n_snoise(vec2(lx * 0.9 + ph * 13.0, lu * 26.0)));
        float ckw = fwidth(ck);
        float chk = (1.0 - smoothstep(0.0, 0.035 + ckw * 1.5, ck)) * smoothstep(0.1, 0.5, n_snoise(vec2(lx * 0.6, pidH * 1.7)) + 0.3) * (1.0 - smoothstep(0.03, 0.12, ckw));
        col *= 1.0 - 0.6 * chk * topF;
        // weathering creeps in from the gaps: darker, rounded plank edges
        col *= 1.0 - 0.38 * smoothstep(0.38, 0.5, abs(lu)) * (0.6 + 0.4 * big);
        // dirt packed into the joints: a crisp dark line at each plank edge (keeps the board rhythm when blurred)
        float jl = smoothstep(0.455 - fwidth(lu) * 1.5, 0.5, abs(lu));
        col = mix(col, vec3(0.022, 0.018, 0.014), jl * 0.75 * topF);
        float rings = late;
        float g = gc;
        // worn walking line (lighter, smoother) in the middle
        float ax = abs(wp.x - BR_X0);
        float path = (1.0 - smoothstep(0.35, 1.05, ax)) * topF;
        col = mix(col, col * vec3(1.14, 1.15, 1.17), path * 0.5);
        // grime + moss toward the railings and in the gaps
        float edge = smoothstep(1.05, 1.5, ax);
        float mn = n_fbm3(wp * 5.0, 3) * 0.5 + 0.5;
        col = mix(col, col * 0.55, edge * 0.55);
        col = mix(col, vec3(0.045, 0.062, 0.02), edge * smoothstep(0.52, 0.78, mn) * 0.55 * topF);
        // plank edges / end grain darker
        col *= 1.0 - (1.0 - topF) * 0.45;
        col *= 1.0 - smoothstep(0.6, 0.9, abs(wn.x)) * 0.8;  // end grain at the butt joints: dark, dirty
        // (stone slabs need no nail heads)
        float nail = 0.0;
        float rust = 0.0;
        diffuseColor.rgb = diffuse * col;
        g_h = -late * 0.12 + fine * 0.05 - nail * 0.4 - chk * 0.12 - hasKnot * (1.0 - smoothstep(0.6, 1.0, kr)) * 0.3;
        g_r = -path * 0.18 + edge * 0.1 - nail * 0.3 + late * 0.05;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_r, 0.3, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0025);`,
    fragLight: AO_GLSL,
  });
  wood.name = 'bridgeDeck';

  // dark capping band (old black-lacquered / iron-sheathed edge)
  const dark = mat.std({ color: 0xffffff, roughness: 0.5, metalness: 0.15 }, {
    fragHead: 'float g_h;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        float n = n_fbm3(wp * vec3(2.0, 6.0, 2.0), 3);
        float sp = n_snoise3(wp * 60.0) * (1.0 - smoothstep(0.003, 0.009, length(fwidth(wp))));
        float sp2 = n_snoise3(wp * 23.0 + 7.0);
        vec3 col = vec3(0.034, 0.029, 0.026) * (0.75 + 0.5 * n);
        col = mix(col, vec3(0.16, 0.14, 0.11), smoothstep(0.55, 0.9, sp) * 0.5);
        col = mix(col, vec3(0.21, 0.155, 0.06), smoothstep(0.62, 0.95, sp2) * 0.4);
        col = mix(col, vec3(0.05, 0.075, 0.045), smoothstep(0.2, 0.8, n_fbm3(wp * 1.3 + 4.0, 3)) * 0.3);
        diffuseColor.rgb = col;
        g_h = n * 0.4 + sp * 0.15 + sp2 * 0.12;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(0.55 + g_h * 0.3, 0.35, 0.95);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.003);`,
  });
  dark.name = 'bridgeDark';

  // 莲瓣望柱头 (lotus post cap): carved bluestone (青石雕刻望柱头)
  const capC = (k) => f6(k);
  const capMat = mat.std({ color: 0xffffff, roughness: 0.72, metalness: 0.0, vertexColors: true }, {
    vertexHead: 'varying vec2 vCap;',
    vertexWorld: 'vCap = uv;',
    fragHead: 'varying vec2 vCap; float g_h; float g_r;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        float h = vCap.y;
        float petal = step(1.5, vColor.r);
        float bright = vColor.r - 2.0 * petal;
        float cav = vColor.g;
        float px = length(fwidth(wp));                         // pixel footprint (m)
        float n1 = n_fbm3(wp * 7.0 + 3.0, 3);
        float n2 = n_fbm3(wp * 1.7 + 11.0, 2);
        float aa3 = 1.0 - smoothstep(0.004, 0.012, px);
        float n3 = n_fbm3(wp * 23.0, 2) * aa3;
        vec3 gld = vec3(0.36, 0.38, 0.38);
        vec3 col = gld * (0.93 + 0.07 * n1 + 0.04 * n3);
        float cavW = smoothstep(0.55, 0.92, cav);
        float pol = 1.0 - smoothstep(0.2, 0.45, cav);           // raised, hand-polished arrises
        float tarn = clamp(smoothstep(-0.1, 0.7, n2) * 0.32 + cavW * 0.75 - pol * 0.3, 0.0, 1.0);
        col = mix(col, gld * vec3(0.75, 0.72, 0.68), tarn * 0.5);
        // moss blooms in deep recesses (青石缝隙苔痕)
        float verd = cavW * smoothstep(0.05, 0.6, n1 + 0.3 * n3);
        col = mix(col, vec3(0.24, 0.30, 0.18), verd * 0.5);
        float gx = 0.0, grv = 0.0, matte = 0.0;
        if (petal < 0.5) {
          float ang = vCap.x;
          // band A: chased 卷草 scroll (running vine with curls) on a punched ground
          float inA = smoothstep(${capC(CAP.bandA[0])}, ${capC(CAP.bandA[0] + 0.0012)}, h) * (1.0 - smoothstep(${capC(CAP.bandA[1] - 0.0012)}, ${capC(CAP.bandA[1])}, h));
          if (inA > 0.0) {
            vec2 q = vec2(ang * 40.0, (h - ${capC((CAP.bandA[0] + CAP.bandA[1]) / 2)}) / 0.0122);
            float aaq = 1.0 - smoothstep(0.12, 0.35, length(fwidth(q)));
            float c = floor(q.x); vec2 f = vec2(fract(q.x) - 0.5, q.y);
            float fl = mod(c, 2.0) * 2.0 - 1.0;
            float vine = 1.0 - smoothstep(0.03, 0.09, abs(f.y - 0.36 * fl * cos(f.x * 3.14159)));
            vec2 sc = f - vec2(0.05 * fl, -0.2 * fl);
            float rS = length(sc); float aS = atan(sc.y, sc.x * fl);
            float spl = abs(fract(aS / 6.2832 + rS * 3.4) - 0.5);
            float spiral = (1.0 - smoothstep(0.08, 0.17, spl)) * (1.0 - smoothstep(0.25, 0.3, rS)) * smoothstep(0.02, 0.05, rS);
            grv = max(vine, spiral) * aaq * inA;
            matte = inA * (1.0 - grv);
          }
          // band B: ring-punched ground under the stud ring
          float inB = smoothstep(${capC(CAP.bandB[0])}, ${capC(CAP.bandB[0] + 0.001)}, h) * (1.0 - smoothstep(${capC(CAP.bandB[1] - 0.001)}, ${capC(CAP.bandB[1])}, h));
          matte = max(matte, inB);
          if (matte > 0.0) {
            vec2 qd = vec2(ang * 360.0, h / 0.00135);
            float aad = 1.0 - smoothstep(0.15, 0.4, length(fwidth(qd)));
            float rd = length(fract(qd) - 0.5);
            float ringd = (1.0 - smoothstep(0.06, 0.14, abs(rd - 0.3))) * aad * matte;
            gx -= ringd * 0.25;
            col *= 1.0 - 0.2 * ringd;
          }
          // petal bud: incised rings at the girth and below the tip; carved chasing marks
          float onB = step(${capC(CAP.bud0)}, h);
          float fwh = max(fwidth(h), 1e-6);
          float rings = 0.0;
          rings = max(rings, 1.0 - smoothstep(0.0004, 0.0004 + fwh * 1.5, abs(h - ${capC(CAP.rings[0])})));
          rings = max(rings, 1.0 - smoothstep(0.0004, 0.0004 + fwh * 1.5, abs(h - ${capC(CAP.rings[1])})));
          rings = max(rings, 1.0 - smoothstep(0.0004, 0.0004 + fwh * 1.5, abs(h - ${capC(CAP.rings[2])})));
          grv = max(grv, rings * onB * (1.0 - smoothstep(0.0007, 0.002, fwh)));
          float aah = 1.0 - smoothstep(0.0015, 0.004, px);
          // shallow round planishing dimples (smooth-edged), barely breaking the reflection
          vec2 wo = n_worley3(wp * 110.0);
          float dim = 1.0 - smoothstep(0.0, 0.42, wo.x * wo.x);
          gx -= dim * dim * 0.035 * aah * onB;
        } else {
          // lotus petal: veins fanning along the petal, darker toward the root
          float v = vCap.x, u = vCap.y;
          float aav = 1.0 - smoothstep(0.12, 0.4, fwidth(v * 3.5));
          float veins = (1.0 - smoothstep(0.1, 0.22, abs(fract(v * 3.5 + 0.5) - 0.5))) * aav * (1.0 - u * 0.5) * (1.0 - smoothstep(0.75, 1.0, abs(v)));
          grv = max(grv, veins * 0.55);
        }
        col *= 1.0 - 0.45 * grv;
        col = mix(col, col * vec3(0.72, 0.6, 0.45), grv * 0.45);  // dirt held in the cuts
        diffuseColor.rgb = diffuse * col;
        g_h = n1 * 0.12 - grv * 0.7 + gx;
        g_r = tarn * 0.15 + matte * 0.2 + grv * 0.16 + verd * 0.4 - pol * 0.04;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_r, 0.07, 1.0);`,
    // micro relief, then specular anti-aliasing: widen the lobe where the normal turns within a pixel
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0006);
      { vec3 dn = fwidth(normal); roughnessFactor = max(roughnessFactor, clamp(length(dn) * 0.9, 0.0, 0.42)); }`,
  });
  capMat.name = 'bridgeLotusCap';
  const RIVET = new THREE.SphereGeometry(0.0048, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2); RIVET.rotateX(Math.PI / 2); RIVET.scale(1, 1, 0.75);

  // granite (piers, abutments, slabs) with a waterline algae band and wet darkening
  const GP = mat.PROC.granite('0.45', 'vec3(0.62, 0.635, 0.66)');
  const granite = mat.std({ color: 0xffffff, roughness: 0.8, metalness: 0, vertexColors: true }, {
    fragHead: GP.fragHead + ARC_GLSL + 'float g_wet;',
    fragColor: GP.fragColor + /* glsl */ `
      {
        vec3 wpS = vWPos; vec3 wnS = normalize(vWNrm);
        // weathering patches, lichen rosettes, vertical run-off streaks
        float wpat = n_fbm3(wpS * 1.8 + 31.0, 3);
        diffuseColor.rgb *= 0.74 + 0.34 * smoothstep(-0.45, 0.5, wpat);
        vec2 wl = n_worley3(wpS * 7.0 + 5.0);
        float lichP = smoothstep(0.05, 0.45, n_fbm3(wpS * 1.3 + 2.0, 2));
        float lich = (1.0 - smoothstep(0.1, 0.24, wl.x)) * lichP;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.40, 0.33), lich * 0.55);
        float sideS = 1.0 - abs(wnS.y);
        float vs = n_fbm3(vec3((wpS.x + wpS.z) * 7.0, wpS.y * 0.7, 3.0), 3);
        diffuseColor.rgb *= 1.0 - sideS * smoothstep(0.0, 0.45, vs) * 0.28;
        // granular salt-and-pepper crystals + tooling pits (faded out when sub-pixel)
        float gq = n_snoise3(wpS * 170.0), gq2 = n_snoise3(wpS * 90.0 + 11.0);
        float aaG = 1.0 - smoothstep(0.12, 0.4, length(fwidth(wpS * 170.0)));
        diffuseColor.rgb *= 1.0 + aaG * (0.22 * smoothstep(0.35, 0.8, gq2) - 0.35 * smoothstep(0.45, 0.85, gq));
        float pxS = length(fwidth(wpS));
        float pits = smoothstep(0.55, 0.85, n_snoise3(wpS * 38.0 + 3.0)) * (1.0 - smoothstep(0.004, 0.012, pxS));
        g_h += aaG * (gq * 0.05 + gq2 * 0.04) - pits * 0.12 + n_fbm3(wpS * 14.0, 2) * 0.1;
        float h = vWPos.y - WATER_Y;
        float n1 = n_fbm3(vWPos * vec3(3.0, 1.2, 3.0), 3);
        float wet = 1.0 - smoothstep(0.02, 0.5 + 0.25 * n1, h);
        float band = smoothstep(-0.3, -0.04, h) * (1.0 - smoothstep(0.04, 0.2 + 0.12 * n1, h));
        float under = 1.0 - smoothstep(-0.35, -0.02, h);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.52, 0.50, 0.45), wet * 0.85);
        vec3 algae = mix(vec3(0.030, 0.040, 0.014), vec3(0.06, 0.07, 0.025), n1 * 0.5 + 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, algae, band * 0.88);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.045, 0.028), under * 0.75);
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
    fragLight: AO_GLSL,
  });
  granite.name = 'bridgeGranite';

  // ---------------------------------------------------------------- geometry helpers
  const B = new Builder();
  const MODE_ARC = 0.0, MODE_VERT = 0.5, MODE_X = 1.0;

  function paint(g, r, gg, b) {
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  }
  // kind 1 = railing member (栗壳桐油木), 0 = fascia / substructure (深栗壳)
  const addLac = (g, mode, dirt, m = null, kind = 0) => B.add(paint(g, mode, dirt + 2 * kind, rnd.next()), lac, m);
  const addDark = (g, m = null) => B.add(paint(g, 1, 1, 1), dark, m);
  const addStone = (g, m = null, tone = 1) => { const t = tone * (0.72 + 0.36 * rnd.next()); const w = rnd.next(); return B.add(paint(g, t * (1.0 + 0.06 * w), t * (0.97 + 0.03 * w), t * (0.9 + 0.08 * (1 - w))), granite, m); };

  // profiles: arrays of [u, v, nu, nv], counter-clockwise
  function rrect(w, h, r, k = 3) {
    const out = []; const cx = w / 2 - r, cy = h / 2 - r;
    const corners = [[cx, -cy, -Math.PI / 2], [cx, cy, 0], [-cx, cy, Math.PI / 2], [-cx, -cy, Math.PI]];
    for (const [x, y, a0] of corners) for (let i = 0; i <= k; i++) {
      const a = a0 + (i / k) * Math.PI / 2;
      out.push([x + r * Math.cos(a), y + r * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
    return out;
  }
  function ellipse(a, b, n = 22) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const nx = Math.cos(t) / a, ny = Math.sin(t) / b; const l = Math.hypot(nx, ny);
      out.push([a * Math.cos(t), b * Math.sin(t), nx / l, ny / l]);
    }
    return out;
  }
  // sweep a profile along points lying in a constant-x plane (frame: side = +x, up = perpendicular in y-z)
  function sweep(pts, prof, capA = true, capB = true) {
    const n = pts.length, m = prof.length;
    const pos = [], nor = [], idx = [];
    const T = new THREE.Vector3();
    const frame = (i) => { const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)]; T.subVectors(b, a).normalize(); return [T.z, -T.y]; };
    for (let i = 0; i < n; i++) {
      const [ny, nz] = frame(i); const p = pts[i];
      for (const [u, v, nu, nv] of prof) { pos.push(p.x + u, p.y + v * ny, p.z + v * nz); nor.push(nu, nv * ny, nv * nz); }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < m; j++) {
      const j1 = (j + 1) % m; const a = i * m + j, b = (i + 1) * m + j, c = (i + 1) * m + j1, d = i * m + j1;
      idx.push(a, d, c, a, c, b);
    }
    const cap = (i, sgn) => {
      const [ny, nz] = frame(i); const p = pts[i];
      const tx = 0, ty = -nz, tz = ny; // tangent
      const base = pos.length / 3;
      let cu = 0, cv = 0; for (const q of prof) { cu += q[0]; cv += q[1]; } cu /= m; cv /= m;
      pos.push(p.x + cu, p.y + cv * ny, p.z + cv * nz); nor.push(tx * sgn, ty * sgn, tz * sgn);
      for (const [u, v] of prof) { pos.push(p.x + u, p.y + v * ny, p.z + v * nz); nor.push(tx * sgn, ty * sgn, tz * sgn); }
      for (let j = 0; j < m; j++) { const j1 = (j + 1) % m; if (sgn > 0) idx.push(base, base + 1 + j, base + 1 + j1); else idx.push(base, base + 1 + j1, base + 1 + j); }
    };
    if (capA) cap(0, -1);
    if (capB) cap(n - 1, +1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  function arcPts(off, z0, z1, x, step = 0.1) {
    const t0 = thAtZ(z0, off), t1 = thAtZ(z1, off);
    const n = Math.max(2, Math.ceil((Math.abs(t1 - t0) * (RA + off)) / step) + 1);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(ptTh(t0 + ((t1 - t0) * i) / (n - 1), off, x));
    return pts;
  }
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



  // ---------------------------------------------------------------- 莲瓣望柱头 (lotus-bud post cap)
  // Lathe profile (local: base on the cap plate at y = 0, scale 1 for a 0.16 m post): foot bead,
  // cavetto, a chased band between raised rims, a second cavetto, a stud-ring seat, a waisted neck
  // with a collar bead, then a lotus bud that swells and closes to a blunt tip.
  // A double lotus-petal
  // collar hugs the base of the bud. uv = (angle fraction, local height) drives
  // the chasing in the shader; colour g = cavity (0 polished arris .. 1 deep recess -> patina).
  function lotusCapProfileHi(nb) {
    const P = [];
    const add = (r, y) => P.push([Math.max(r, 0.0001), y]);
    const bead = (rb, yc, rad, n) => { for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; add(rb + rad * Math.sin(a), yc - rad * Math.cos(a)); } };
    add(0.0001, 0); add(0.060, 0); add(0.0655, 0.0012); add(0.068, 0.0035);
    bead(0.068, 0.009, 0.0048, 6);
    add(0.0668, 0.015); add(0.0638, 0.0185); add(0.0624, 0.0222); add(0.0634, 0.0258); add(0.0668, 0.0288); add(0.0738, 0.0305); add(0.0766, 0.0310);
    bead(0.0766, 0.0346, 0.0034, 5);
    add(0.0775, 0.0384); add(0.0775, 0.0484); add(0.0775, 0.0583);
    bead(0.0766, 0.0621, 0.0034, 5);
    add(0.0738, 0.066); add(0.0700, 0.0685); add(0.0684, 0.0722); add(0.0694, 0.0758); add(0.0722, 0.0782);
    add(0.0738, 0.0795); add(0.0738, 0.0865); add(0.0738, 0.0935);
    add(0.0722, 0.0948); add(0.0690, 0.0962);
    add(0.0640, 0.0995); add(0.0575, 0.1035); add(0.0515, 0.1075); add(0.0478, 0.1115); add(0.0466, 0.1145);
    bead(0.0466, 0.1192, 0.0045, 5);
    add(0.0462, 0.1250);
    const { bud0: y0, H, Rm, tEnd } = CAP;
    // 莲蕾: the petals swell to their widest about a third of the way up, then
    // the bud closes with a full convex curve to a blunt, rounded tip
    for (let i = 1; i <= nb; i++) {
      const t = (i / nb) * tEnd; let f;
      if (t < 0.34) f = 0.60 + 0.40 * Math.pow(Math.sin((t / 0.34) * Math.PI / 2), 0.9);
      else { const q = (t - 0.34) / (tEnd - 0.34); f = Math.pow(1 - q, 0.85) * (1 - 0.55 * q * q); }
      add(Rm * f, y0 + H * t);
    }
    const yb = y0 + H * tEnd;
    bead(0.0078, yb + 0.0078, 0.0062, 6);
    add(0.0042, yb + 0.0155); add(0.0022, yb + 0.0215); add(0.0001, yb + 0.0265);
    return P;
  }
  const GP_HI = lotusCapProfileHi(40);
  const budR = (y) => {
    for (let j = 1; j < GP_HI.length; j++) if (GP_HI[j][1] >= y) { const [r0, y0] = GP_HI[j - 1], [r1, y1] = GP_HI[j]; return r0 + (r1 - r0) * (y - y0) / Math.max(y1 - y0, 1e-6); }
    return 0;
  };
  // the post-cap parts as geometries (uv + colour baked), detail level hero / standard
  function lotusCapParts(hero) {
    const out = [];
    const prof = hero ? GP_HI : lotusCapProfileHi(26);
    const cav = prof.map(([r, y], j) => {
      let s = 0, w = 0;
      for (let k = 0; k < prof.length; k++) { const dy = Math.abs(prof[k][1] - y); if (k === j || dy > 0.006) continue; const wt = 1 - dy / 0.006; s += wt * prof[k][0]; w += wt; }
      return w ? clamp(0.5 + (s / w - r) / 0.004, 0, 1) : 0.5;
    });
    const segs = hero ? 72 : 40;
    const lat = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    {
      const n = prof.length, uv = lat.attributes.uv, cnt = uv.count, col = new Float32Array(cnt * 3);
      for (let i = 0; i < cnt; i++) { const j = i % n; uv.setXY(i, Math.floor(i / n) / segs, prof[j][1]); col[i * 3] = 1; col[i * 3 + 1] = cav[j]; col[i * 3 + 2] = 0; }
      lat.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    out.push(lat);
    // lotus collar: 8 broad front petals over 8 narrower ones set between them
    const petal = (phi, ya, yb2, wAng, thick, flare, rOff, nu, nv) => {
      const pos = [], uvA = [], colA = [], idx = [];
      const surf = (outer) => {
        const base = pos.length / 3;
        for (let i = 0; i <= nu; i++) {
          const u = i / nu, y = ya + (yb2 - ya) * u;
          const w = Math.pow(Math.sin(Math.PI * Math.pow(Math.max(u, 0.0), 0.72)), 0.6);
          for (let j = 0; j <= nv; j++) {
            const v = (j / nv) * 2 - 1;
            const a = phi + v * Math.max(w, 0.04) * wAng;
            const lift = flare * Math.pow(u, 2.4) * (1 - 0.6 * v * v);
            const th = outer ? thick * (1 - v * v) * (1 - 0.5 * u) + 0.0011 * Math.pow(1 - Math.abs(v), 8) * (1 - u * 0.7) : 0;
            const r = Math.max(budR(y), 0.0512) + rOff + lift + th;
            pos.push(r * Math.sin(a), y + lift * 0.35, r * Math.cos(a));
            uvA.push(v, u);
            const c = outer ? clamp(0.5 - 0.3 * Math.pow(1 - Math.abs(v), 6) + 0.45 * Math.pow(1 - u, 3), 0, 1) : 0.85;
            colA.push(3.0, c, 0);
          }
        }
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          const a0 = base + i * (nv + 1) + j, a1 = a0 + 1, b0 = a0 + nv + 1, b1 = b0 + 1;
          if (outer) idx.push(a0, a1, b1, a0, b1, b0); else idx.push(a0, b1, a1, a0, b0, b1);
        }
      };
      surf(true); surf(false);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
      g.setIndex(idx); g.computeVertexNormals();
      // make sure the outer face points away from the axis
      const p = g.attributes.position, nn = g.attributes.normal; const mid = Math.floor((nu / 2) * (nv + 1) + nv / 2);
      if (p.getX(mid) * nn.getX(mid) + p.getZ(mid) * nn.getZ(mid) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
      return g;
    };
    const nu = hero ? 12 : 6, nv = hero ? 8 : 4;
    for (let k = 0; k < 8; k++) {
      out.push(petal((k + 0.5) * Math.PI / 4, 0.1205, 0.1685, 0.25, 0.0016, 0.0035, 0.0003, nu, nv));
      out.push(petal(k * Math.PI / 4, 0.1195, 0.1645, 0.36, 0.0034, 0.0065, 0.0027, nu, nv));
    }
    // ring of hemispherical studs on the seat band (patina collects round their feet)
    const nS = hero ? 28 : 20;
    const st = new THREE.SphereGeometry(0.0034, hero ? 10 : 6, hero ? 5 : 3, 0, Math.PI * 2, 0, Math.PI / 2);
    st.rotateX(Math.PI / 2); // dome toward +z
    {
      const p = st.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { col[i * 3] = 1; col[i * 3 + 1] = 0.75 - 0.5 * clamp(p.getZ(i) / 0.0034, 0, 1); }
      st.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    for (let k = 0; k < nS; k++) {
      const a = (k / nS) * Math.PI * 2;
      const g = st.clone(); g.applyMatrix4(mat4([0.0738 * Math.sin(a), 0.0865, 0.0738 * Math.cos(a)], [0, a, 0]));
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, a / (Math.PI * 2), 0.2); // outside the chased bands
      out.push(g);
    }
    return out;
  }
  const CAP_HERO = lotusCapParts(true), CAP_STD = lotusCapParts(false);

  function addPostTop(x, yTop, z, w, scale, hero = false) {
    // lotus-bud post cap (莲瓣望柱头) sits on the plain lacquered post sleeve
    const s = w / PW;
    const M = mat4([x, yTop + 0.016 * s, z], [0, rnd.next() * 6.28, 0], scale);
    for (const g of (hero ? CAP_HERO : CAP_STD)) B.add(g, capMat, M);
  }

  // ---------------------------------------------------------------- DECK steps (踏步)
  {
    const pw = BAND.u0 * 2 + 0.01;
    const sr = ctx.rng('steps');
    for (let i = 0; i < N_STEPS; i++) {
      const z0 = zEndN + i * STEP_W, z1 = z0 + STEP_W;
      const zm = (z0 + z1) / 2;
      const zu = (zm < ZC) ? z1 : z0;              // upper edge, nearer the crown
      const yTop = yAt(zu, 0.06);                  // level tread at the upper edge height
      const yBot = yAt(zm, -0.10);                 // seat into the arch extrados
      addStone(rbox(pw, Math.max(yTop - yBot, 0.04), z1 - z0 - 0.01, 0.008), mat4([X0, (yTop + yBot) / 2, zm]), 0.92 + sr.next() * 0.22);
    }
  }

  // ---------------------------------------------------------------- fallen maple leaves + a few peach petals
  // drifted against the railing sills and into the board joints (wind from the west piles them on the east side)
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
    const L2 = 2 * thE * RA;
    for (let i = 0; i < 170; i++) {
      const petal = i % 5 === 4;
      const s = (lr.next() - 0.5) * (L2 - 0.4);
      const th = s / RA;
      // mostly against the sills (east side heavier), some scattered across the boards
      const side = lr.next() < 0.68 ? 1 : -1;
      const u = lr.next() < 0.75 ? side * (HW - 0.32 - Math.pow(lr.next(), 2) * 0.55) : (lr.next() - 0.5) * 2.4;
      const R = petal ? 0.011 + lr.next() * 0.004 : 0.03 + lr.next() * 0.025;
      const g = leafGeo(R, 5 + (lr.next() < 0.5 ? 2 : 0), (lr.next() - 0.3) * R * 0.5, petal);
      g.rotateY(lr.next() * Math.PI * 2);
      const c0 = petal ? [0.78, 0.5, 0.52] : pals[Math.floor(lr.next() * pals.length)];
      const k = 0.8 + lr.next() * 0.35;
      paint(g, c0[0] * k, c0[1] * k, c0[2] * k);
      const c = ptTh(th, 0.003 + lr.next() * 0.003, X0 + u);
      c.y = treadTop(c.z) + 0.004;               // rest on the step treads, not the buried arc
      B.add(g, leafMat, mat4([c.x, c.y, c.z], [th + (lr.next() - 0.5) * 0.12, 0, (lr.next() - 0.5) * 0.12]));
    }
  }

  // ---------------------------------------------------------------- STONE ARCH RING (券石拱圈): discrete voussoirs
  {
    const R_in = RA - 0.30;       // intrados (visible underside of the arch)
    const R_out = RA + 0.04;      // extrados meets the deck underside
    const Xw = HW + 0.05;         // the ring spans the full deck width
    const ringH = R_out - R_in;
    const nV = Math.max(16, Math.round((2 * thE * RA) / 0.40));  // ~0.4 m voussoirs
    const wj = 0.014;             // radial joint gap
    const vr = ctx.rng('voussoir');
    for (let s = 0; s < nV; s++) {
      const t0 = -thE + (2 * thE) * s / nV;
      const t1 = -thE + (2 * thE) * (s + 1) / nV;
      const tm = (t0 + t1) / 2;
      const rMid = (R_in + R_out) / 2;
      const c = ptTh(tm, rMid);
      const arcLen = (t1 - t0) * rMid;
      const g = stoneBlock(Xw * 2, ringH - wj, arcLen - wj, 0.025, 0.01, 0.1, vr.next() * 50, 0.012);
      addStone(g, mat4([c.x, c.y, c.z], [tm, 0, 0]));   // rotate so local Y -> radial, Z -> tangential
    }
    // 拱顶石 (keystone) slightly proud at the crown
    {
      const c = ptTh(0, (R_in + R_out) / 2);
      addStone(stoneBlock(Xw * 2 + 0.02, ringH + 0.03, 0.26, 0.025, 0.01, 0.1, 7, 0.012), mat4([c.x, c.y, c.z], [0, 0, 0]));
    }
  }

  // ---------------------------------------------------------------- substructure
  // (the voussoir arch ring above is the structure; no timber girders / floor beams)

  // (single-span arch: no mid-stream piers — the ring springs from the abutments)

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
          addStone(g, m, 0.95 + r.next() * 0.1);
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
      addStone(stoneBlock(xb - xa + 0.08, 0.2, zb2 - za - 0.012, 0.03, 0.006, 0.2, za * 7), mat4([X0, yt - 0.1 + 0.001, (za + zb2) / 2]), 1.06);
    }
    // landing slabs beyond the deck end (top at LAND_TOP)
    const lz0 = Math.min(end, end + dir * 1.9), lz1 = Math.max(end, end + dir * 1.9);
    const slabT = LAND_TOP - yt;
    for (let i = 0; i < 2; i++) {
      const za = lz0 + ((lz1 - lz0) * i) / 2, zb2 = lz0 + ((lz1 - lz0) * (i + 1)) / 2;
      addStone(stoneBlock(2 * HW + 0.9, slabT, zb2 - za - 0.012, 0.03, 0.004, 0.2, za * 13 + 5), mat4([X0, yt + slabT / 2, (za + zb2) / 2]), 1.1);
    }
  }
  abutment(faceN, zEndN, -1);
  abutment(faceS, zEndS, +1);

  // ---------------------------------------------------------------- RAILINGS
  const arcLenDeck = 2 * thE * RA;
  const nPosts = Math.max(BR.posts || 9, Math.round(arcLenDeck / 2.3) + 1);
  const endOut = 0.24; // end posts stand on the landing, beyond the deck end
  const zPostN = zEndN - endOut, zPostS = zEndS + endOut;
  const postZ = [zPostN];
  for (let k = 1; k < nPosts - 1; k++) { const th = -thE + (2 * thE * k) / (nPosts - 1); postZ.push(ZC + RA * Math.sin(th)); }
  postZ.push(zPostS);

  for (const side of [-1, 1]) {
    const xr = X0 + side * XR;
    const railH = 0.62, wP = 0.14;
    const deckTop = treadTop;                    // the railing rides the stepped nosing line
    // 寻杖 (top stone rail): short cylinders joining the 望柱 heads along the arc
    for (let k = 0; k < postZ.length - 1; k++) {
      const za = postZ[k], zb = postZ[k + 1];
      const ya = deckTop(za) + railH, yb = deckTop(zb) + railH;
      const a = new THREE.Vector3(xr, ya, za), b = new THREE.Vector3(xr, yb, zb);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const len = a.distanceTo(b);
      const ax = Math.atan2(zb - za, yb - ya);
      addStone(new THREE.CylinderGeometry(0.045, 0.045, len + 0.02, 10), mat4([mid.x, mid.y, mid.z], [ax, 0, 0]), 1.15);
    }
    // 望柱 + 石柱头 + 抱鼓石
    for (let k = 0; k < postZ.length; k++) {
      const zp = postZ[k];
      const isEnd = k === 0 || k === postZ.length - 1;
      const w = isEnd ? 0.20 : wP;
      const h = isEnd ? 0.80 : railH;
      const dy0 = deckTop(zp);
      addStone(stoneBlock(w, h, w, 0.012, 0.006, 0.06, zp + side * 3, 0.004), mat4([xr, dy0 + h / 2, zp]), 1.15);
      // 石柱头: 略宽短块 + 莲瓣顶珠
      addStone(rbox(w * 1.18, 0.07, w * 1.18, 0.006), mat4([xr, dy0 + h + 0.035, zp]), 1.15);
      const capPts = [[0, 0], [0.05, 0], [0.055, 0.03], [0.03, 0.06], [0.045, 0.09], [0.04, 0.12], [0.02, 0.15], [0, 0.17]].map(p => new THREE.Vector2(p[0], p[1]));
      addStone(new THREE.LatheGeometry(capPts, 12), mat4([xr, dy0 + h + 0.07, zp]), 1.15);
      if (isEnd) {
        // 抱鼓石: 横置鼓石夹护端柱
        for (const fs of [-1, 1]) addStone(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12).rotateZ(Math.PI / 2), mat4([xr + fs * (w / 2 + 0.10), dy0 + 0.11, zp]));
        // 石础
        addStone(stoneBlock(0.40, 0.16, 0.40, 0.03, 0.004, 0.08, zp + side, 0.006), mat4([xr, LAND_TOP + 0.08, zp]), 1.1);
      }
    }
    // 栏板 (low stone panel between posts, below the 寻杖)
    for (let k = 0; k < postZ.length - 1; k++) {
      const za = postZ[k], zb = postZ[k + 1];
      const zMid = (za + zb) / 2;
      const yMid = (deckTop(za) + deckTop(zb)) / 2 + 0.28;
      const gapLen = Math.hypot(zb - za, deckTop(zb) - deckTop(za)) - wP;
      // panel's long axis is local Z: tilt it to follow the arc tangent (NOT the
      // atan2(dz,dy) used for the cylinders, whose axis is local Y)
      const ax = Math.atan2(deckTop(za) - deckTop(zb), zb - za);
      addStone(rbox(0.06, 0.40, Math.max(gapLen, 0.05), 0.006), mat4([xr, yMid, zMid], [ax, 0, 0]), 1.15);
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
      { cam: [3, 0.3, 22.5], look: [10, 1.0, 17], focal: 30 },        // sunlit west face, piers + ties, lotus
      { cam: [11.15, 3.4, 22], look: [10.3, 4.2, -16], focal: 30 },   // on the deck walking north, post cap at eye level
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
