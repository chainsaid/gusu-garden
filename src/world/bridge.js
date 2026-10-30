// ---------------------------------------------------------------------------
// BRIDGE — 江南青石单孔石拱桥 across the pond on the hall axis.
//
// Structure (all in world coordinates, axis x = L.bridge.x, running N-S):
//   * arch ring (券圈): a near-semicircular voussoir ring springing at the
//     waterline, independent of the deck profile, on foundation blocks
//   * deck (桥面): crown arc blended into straight approach ramps, surfaced
//     with full-width stone treads (踏步)
//   * flank walls (裙肩墙): continuous smooth stone bands from the deck edge
//     down to the ring extrados / waterline, with a coping course (眉石)
//   * balustrade: solid stone panels (栏板) with ruyi relief between posts, moulded
//     扶手石 top rail, 仰覆莲瓣 finials, drum stones (抱鼓石) at the ends
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
  // 江南石拱桥剖面: a tight crown arc blended into straight approach ramps (桥堍),
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
  // 券圈 (arch ring): an independent near-semicircular opening springing at the water.
  // 半径由矢高反解，而不是按跨径系数给定 —— 拱顶外弧恒低于桥面 crown 0.50（拱肩），
  // 于是调 rise 时券圈自动跟随，不会再穿出桥面。rise 3.2 -> R_OUT 3.15 / R_IN 2.69，
  // 拱券矢跨比 0.52（半圆陡拱，江南通船桥形制）。
  const YRING = WATER + 0.10;                                   // ring centre height (spring line at the water)
  const R_OUT = Math.max(1.0, (Y0 + RISE - 0.50) - YRING);
  const R_IN = Math.max(0.55, R_OUT - 0.46);                    // 券厚 0.46
  const wallBaseY = (z) => {                                    // where flank masonry dies: ring extrados or water
    const dz = Math.abs(z - ZC);
    const ex = dz < R_OUT ? YRING + Math.sqrt(Math.max(R_OUT * R_OUT - dz * dz, 0)) : -Infinity;
    return Math.max(ex, WATER - 0.12);
  };

  // 踏步 (deck steps): the walkable surface is stepped over the arch — treads level,
  // risers tall at the abutments and shallow toward the crown, as on real stone bridges
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
#define BR_TOP ${f6(Y0 + RISE)}
#define PLAT_H ${f6(0.60)}
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

  // 水磨青石：桥身通体一色，带水线藻带与浸水变暗。
  // 青灰冷调（G 最高、B 略高于 R），与粉墙黛瓦同一体系；原中性灰配玉带桥参照
  // 会读作颐和园汉白玉，非江南做法，已弃用。无椒盐麻点（旧 PROC 在远景读成马赛克）。
  // 暖光下 0.5 以上的反照率会直接推到饱和、读成象牙白，青灰只能靠"低反照率 +
  // 强色相分离（R 明显低于 G/B）"得到 —— 0.02 的极端值验证过 uniform 通路是通的。
  const GP = mat.PROC.limestone('vec3(0.62, 0.70, 0.685)');
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
        // 雨水流痕：竖向拉长、频率要低（7/m 在近距离会读成满墙拉丝噪点）
        float vs = n_fbm3(vec3((wpS.x + wpS.z) * 4.2, wpS.y * 0.62, 3.0), 3);
        diffuseColor.rgb *= 1.0 - sideS * smoothstep(0.10, 0.55, vs) * 0.055;
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
      // 桥心石（拱顶平台）：圆框 + 六旋水纹，压地隐起浅浮雕 —— 江南石桥最有
      // 辨识度的一件（嘉定双卷云六旋水纹、黎里青龙桥「桥面有轮回纹饰」）
      {
        vec3 wnU = normalize(vWNrm);
        float upU = smoothstep(0.55, 0.90, wnU.y);
        float inPlat = (1.0 - smoothstep(PLAT_H - 0.04, PLAT_H, abs(vWPos.z - ARC_ZC)))
                     * (1.0 - smoothstep(1.54, 1.60, abs(vWPos.x - BR_X0)))
                     * (1.0 - smoothstep(0.008, 0.020, abs(vWPos.y - BR_TOP))) * upU;
        vec2 qU = vec2(vWPos.x - BR_X0, vWPos.z - ARC_ZC);
        float radU = length(qU);
        float R0 = 0.55;                                    // 圆框半径：直径 1.10，受平台进深 1.20 限制
        float rrU = radU / R0;
        float ringU = 1.0 - smoothstep(0.010, 0.022, abs(radU - R0));
        float a6 = (atan(qU.y, qU.x) + 3.14159265) / 6.28318531 * 6.0;
        float spD = fract(a6) - (0.20 + 0.72 * rrU);        // 六个绕心旋转的水涡
        spD = abs(spD - floor(spD + 0.5));
        float spiralU = (1.0 - smoothstep(0.012, 0.030, spD)) * (1.0 - smoothstep(0.90, 1.02, rrU));
        float coreU = 1.0 - smoothstep(0.05, 0.09, radU);   // 中心圆
        float washU = max(ringU, max(spiralU, coreU)) * inPlat;
        diffuseColor.rgb *= 1.0 - washU * 0.30;             // 刻痕积灰、略暗
        g_h -= washU * 0.60;                                // 凹刻
      }
    `,
    fragRough: GP.fragRough + `roughnessFactor = mix(roughnessFactor, 0.32, g_wet * 0.7);`,
    fragNormal: GP.fragNormal,
    // the golden-hour sky fills real shade more than the captured IBL does — a
    // small lift keeps the shadowed flank / soffit reading as stone, not soot.
    // 1.18: 青石比原浅灰暗约 5%，补回来，保证券石分缝在阴影里仍可读
    fragLight: AO_GLSL + /* glsl */ `
      reflectedLight.indirectDiffuse *= 1.18;
      // 迎光面压一档：青石的反照率本就只有白粉墙的三分之一左右，不压的话
      // 夕照直射会把它推到和汉白玉同一个高光肩部，读不出"石"来
      reflectedLight.directDiffuse *= 0.38;
      // 青石读色：直射下的迎光面在夕照里本来就偏暖白（物理如此，压反照率只会被
      // 高曝光推平），青灰冷调必须落在暗部才读得出来 —— 暗面偏青，亮面不动
      {
        float lumF = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse,
                         vec3(0.299, 0.587, 0.114));
        float kF = 1.0 - smoothstep(0.04, 0.60, lumF);
        vec3 coolF = vec3(0.84, 0.99, 1.05);
        reflectedLight.directDiffuse *= mix(vec3(1.0), coolF, kF * 0.85);
        reflectedLight.indirectDiffuse *= mix(vec3(1.0), coolF, kF);
      }
    `,
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
  // 拱顶留一段平台嵌桥心石（江南石桥的定式），两端仍是踏步，步长各自取整以免出半级
  {
    const pw = 2 * (HW - 0.22) + 0.01;           // walkway seating between the flank walls
    const sr = ctx.rng('steps');
    const PLAT = 0.60;                            // 平台半长（与 shader 的 PLAT_H 一致）
    const run = (zA, zB, n) => {
      const w = (zB - zA) / n;
      for (let i = 0; i < n; i++) {
        const z0 = zA + i * w, z1 = z0 + w;
        const zm = (z0 + z1) / 2;
        const yTop = Y0 + profY(zm);              // tread at the step-centre height, so the
                                                  // treads recess just below the smooth coping
        const dz = Math.abs(zm - ZC);             // seat into the ring extrados over the opening,
        const seat = dz < R_OUT - 0.05            // deep into the spandrel fill on the haunches
          ? Math.max(profY(zm) - 0.18, YRING + Math.sqrt(Math.max(R_OUT * R_OUT - dz * dz, 0)) - 0.02)
          : profY(zm) - 0.5;
        const yBot = Y0 + seat;
        addStone(rbox(pw, Math.max(yTop - yBot, 0.04), z1 - z0 - 0.008, 0.007), mat4([X0, (yTop + yBot) / 2, zm]), 0.985 + sr.next() * 0.03);
      }
    };
    run(zEndN, ZC - PLAT, Math.max(4, Math.round((ZC - PLAT - zEndN) / 0.34)));
    run(ZC + PLAT, zEndS, Math.max(4, Math.round((zEndS - ZC - PLAT) / 0.34)));
    // 桥心石: 拱顶一整块平台石板，坐在拱顶外弧之上，表面由 shader 刻圆框 + 六旋水纹
    {
      const yTop = Y0 + profY(ZC);
      const yBot = Math.max(yTop - 0.22, YRING + R_OUT + 0.02);
      addStone(stoneBlock(pw, yTop - yBot, 2 * PLAT - 0.012, 0.03, 0.005, 0.12, 3, 0.004), mat4([X0, (yTop + yBot) / 2, ZC]), 1.02);
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
  // opening springing at the water, independent of the deck profile (江南石拱桥通例)
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

  // 把旋转体沿周向切成 n 瓣：半径按 cos(nθ) 起伏出瓣脊，同时在瓣区把瓣中线
  // 沿 ±y 抬起 —— 正值为瓣尖朝上（仰莲），负值为瓣尖朝下（覆莲）。
  const petalize = (g, n, ampR, ampY, yLo, yHi) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const th = Math.atan2(z, x);
      const w = sm(yLo, yHi, y);
      const rr = r * (1 + ampR * Math.cos(n * th) * w);
      p.setX(i, Math.cos(th) * rr);
      p.setZ(i, Math.sin(th) * rr);
      p.setY(i, y + ampY * Math.cos(n * th) * w);
    }
    g.computeVertexNormals();
    return g;
  };

  // 望柱柱头: 宋式仰覆莲瓣 —— 下仰莲 8 瓣（瓣尖朝上）+ 束腰 + 上覆莲 8 瓣
  // （瓣尖朝下）+ 顶心莲蓬。武康宋元石桥与吴江黎里青龙桥皆此式（P0-10）。
  const finialGeo = (s) => {
    const P = [[0.064, 0], [0.068, 0.006], [0.078, 0.022], [0.082, 0.040], [0.072, 0.062],
               [0.056, 0.074], [0.058, 0.084], [0.070, 0.102], [0.078, 0.122], [0.070, 0.140],
               [0.050, 0.155], [0.026, 0.166], [0, 0.173]];
    const g = new THREE.LatheGeometry(P.map((q) => new THREE.Vector2(q[0] * s, q[1] * s)), 32);
    // 幅度要小：莲瓣是 8 道浅竖棱，不是横向齿轮。大振幅会在轮廓转折处变成尖锯齿
    petalize(g, 8, 0.070, 0.004 * s, 0.012 * s, 0.068 * s);   // 下仰莲
    petalize(g, 8, 0.070, -0.004 * s, 0.096 * s, 0.146 * s);  // 上覆莲
    return mergeGeo([[g, null]]);
  };

  // 如意云头（三卷云）轮廓：极坐标 r = 1 - amp + amp*cos(n(θ-90°))，再按 rx/ry 拉成
  // 横向椭圆三瓣。局部 x = 沿桥 z，y = 高 —— 石栏板开光里最常见的就是这种云头。
  const cloudOutline = (cz, cy, rx, ry, n = 3, amp = 0.32, skew = 0) => {
    const pts = [];
    const N = 42;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      const s = 1 - amp + amp * Math.cos(n * (th - Math.PI / 2));
      const dx = rx * s * Math.cos(th);
      pts.push([cz + dx, cy + ry * s * Math.sin(th) + skew * dx]);   // skew: 随桥面坡度斜置
    }
    return pts;
  };

  for (const side of [-1, 1]) {
    // 裙肩墙 + 眉石: continuous smooth stone faces (the extrados -> deck-edge band
    // and its coping), NOT a stack of blocks — this is what makes it read as 水磨青石
    const xr = X0 + side * (HW - 0.11);
    addStone(continuousBand(side, xr, 0.11, (z) => Y0 + profY(z), wallBaseY), null, 1.0);
    addStone(continuousBand(side, X0 + side * (HW - 0.06), 0.14, (z) => Y0 + profY(z) + 0.05, (z) => Y0 + profY(z)), null, 1.03);
    const COP = 0.05;                            // coping height the balustrade stands on
    const railH = 0.45, wP = 0.13;
    const deckTop = (z) => Y0 + profY(z) + COP;  // the balustrade rides the smooth flank line
    // 扶手石 (压顶石): the moulded capping member riding over the panels.
    // 石作盝顶断面（下宽上收、顶面压一道窄脊），不是木构寻杖的圆浑断面。
    for (let k = 0; k < postZ.length - 1; k++) {
      const za = postZ[k], zb = postZ[k + 1];
      const ya = deckTop(za) + railH, yb = deckTop(zb) + railH;
      const len = Math.hypot(zb - za, yb - ya);
      const ax = Math.atan2(zb - za, yb - ya);
      // beam/cap are Y-long like the cylinder they replace: ax (atan2(dz,dy))
      // aligns a Y axis with the segment; a Z-long box under the same rotation
      // swings 90° off and sticks up out of the railing on the ramps
      addStone(rbox(0.115, len + 0.02, 0.085, 0.008), mat4([xr, (ya + yb) / 2, (za + zb) / 2], [ax, 0, 0]), 1.04);          // 盝顶主体
      addStone(rbox(0.090, len + 0.02, 0.030, 0.006), mat4([xr, (ya + yb) / 2 + 0.052, (za + zb) / 2], [ax, 0, 0]), 1.06);  // 顶部收分脊
    }
    // 栏板: 实心青石板 —— 江南石桥栏板绝大多数为实心、压地隐起浅浮雕，满布透雕
    // 属庙宇/皇家做法，不是文人园的语言。每 bay 一块梯形石板（两侧铅直、上下随
    // 桥面坡度），心部一个如意云头开光：边框压地隐起，云头凸起 6 mm。
    // 原宋式木勾栏的「绦环」已删除（石桥无此件），栏板直接顶到扶手石下皮。
    for (let k = 0; k < postZ.length - 1; k++) {
      const wA = k === 0 ? 0.10 : wP / 2, wB = k === postZ.length - 2 ? 0.10 : wP / 2;
      const za = postZ[k] + wA + 0.02, zb = postZ[k + 1] - wB - 0.02;
      const L = zb - za;
      if (L < 0.3) continue;
      const zm = (za + zb) / 2;
      const sTop = (z) => deckTop(z) + 0.085;          // sill top
      const rBot = (z) => deckTop(z) + railH - 0.045;  // underside of the 扶手石
      const segLen = (ya2, yb2) => Math.hypot(L, yb2 - ya2);
      const tilt = (ya2, yb2) => Math.atan2(L, yb2 - ya2);
      {   // 地栿
        const a = sTop(za) - 0.037, b = sTop(zb) - 0.037;
        addStone(rbox(0.10, segLen(a, b) + 0.02, 0.055, 0.006), mat4([xr, (a + b) / 2, zm], [tilt(a, b), 0, 0]), 1.04);
      }
      {
        const yL = (z) => sTop(z) + 0.012, yH = (z) => rBot(z) - 0.012;
        const outer = [[za, yL(za)], [zb, yL(zb)], [zb, yH(zb)], [za, yH(za)]];
        const FR = basis([xr, 0, 0], [0, 0, 1], [0, 1, 0], [side, 0, 0]);
        // 开光：四周留 0.05 边框。洞的四角必须跟栏板一起随坡度倾斜 —— 用水平矩形
        // 会在斜板上越出板边，三角化出错，表面出现竖向撕裂条纹。
        const bz = 0.05, by = 0.05;
        const hA = za + bz, hB = zb - bz;
        const hole = [[hA, yL(hA) + by], [hA, yH(hA) - by], [hB, yH(hB) - by], [hB, yL(hB) + by]];
        if (hB - hA > 0.25 && yH(za) - yL(za) - 2 * by > 0.10) {
          // 内板：整块。正面退到 +0.0185，与边框背面 0.020 留 1.5 mm 缝 ——
          // 共面会 z-fighting（也是竖纹的来源）
          const msP = new Mesher(granite);
          extrude(msP, FR, outer, [], -0.028, 0.0185);
          addStone(msP.toGeometry(), null, 1.04);
          // 外框：表面 8 mm 一圈，比开光底凸出 9.5 mm（压地隐起）
          const msF = new Mesher(granite);
          extrude(msF, FR, outer, [hole], 0.020, 0.028);
          addStone(msF.toGeometry(), null, 1.06);
          // 如意云头：三卷云，贴在开光底面上凸 6 mm，随坡度斜置
          const cx = (hA + hB) / 2, cyC = (yL(cx) + yH(cx)) / 2;
          const skew = (yL(zb) - yL(za)) / (zb - za);
          const rx = Math.min(0.62, (hB - hA) * 0.40), ry = Math.min(0.100, (yH(cx) - yL(cx) - 2 * by) * 0.46);
          const msC = new Mesher(granite);
          extrude(msC, FR, cloudOutline(cx, cyC, rx, ry, 3, 0.44, skew), [], 0.0185, 0.0305);
          addStone(msC.toGeometry(), null, 1.09);
        } else {
          const ms = new Mesher(granite);
          extrude(ms, FR, outer, [], -0.028, 0.028);
          addStone(ms.toGeometry(), null, 1.04);
        }
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
      addStone(finialGeo(isEnd ? 1.35 : 0.95), mat4([xr, dy0 + h + 0.06, zp]), 1.15);
      if (isEnd) {
        // 抱鼓石: 横置大鼓石夹护端柱 + 石础。鼓面浅浮雕折枝花（宜兴南草塘桥抱鼓石
        // 「一侧折枝花如意纹」）—— 中心一朵六瓣花 + 一圈凸弦纹
        for (const fs of [-1, 1]) {
          const bx = xr + fs * (w / 2 + 0.17), by = dy0 + 0.175;
          addStone(new THREE.CylinderGeometry(0.175, 0.175, 0.13, 16).rotateZ(Math.PI / 2), mat4([bx, by, zp]), 1.03);
          for (const es of [-1, 1]) {
            addStone(new THREE.TorusGeometry(0.132, 0.011, 6, 22).rotateY(Math.PI / 2), mat4([bx + es * 0.062, by, zp]), 1.05);
            const ms = new Mesher(granite);
            extrude(ms, basis([bx + es * 0.065, 0, 0], [0, 0, 1], [0, 1, 0], [es, 0, 0]),
              cloudOutline(zp, by, 0.058, 0.058, 6, 0.35), [], 0.000, 0.008);
            addStone(ms.toGeometry(), null, 1.06);
          }
        }
        addStone(stoneBlock(0.46, 0.18, 0.46, 0.03, 0.004, 0.08, zp + side, 0.006), mat4([xr, LAND_TOP + 0.09, zp]), 1.03);
      }
    }
    // 长系石（俗称桥耳）: 贯穿桥体两侧外凸的构件，端面浅浮雕正面莲花 8 瓣。
    // 嘉定「现存明以前的石拱桥多用莲花纹」；浙北宋元武康石桥同式。
    for (const sgn of [-1, 1]) {
      const zm = ZC + sgn * (R_OUT + 0.35);
      const ym = WATER + 1.10;
      const xe = X0 + side * (HW + 0.02);                  // 桥墙外皮
      addStone(stoneBlock(0.38, 0.36, 0.36, 0.03, 0.008, 0.09, sgn * 7 + side, 0.006),
        mat4([xe + side * 0.19, ym, zm]), 1.00);
      const ms = new Mesher(granite);                      // 端面莲花：8 瓣，凸起 10 mm
      extrude(ms, basis([xe + side * 0.38, 0, 0], [0, 0, 1], [0, 1, 0], [side, 0, 0]),
        cloudOutline(zm, ym, 0.115, 0.115, 8, 0.30), [], 0.000, 0.010);
      addStone(ms.toGeometry(), null, 1.06);
    }
    // 桥额：不做。拱券上方、栏杆外侧的桥墙保持素面青石 —— 全桥不刻任何文字。
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
      { cam: [3, 0.3, 22.5], look: [10, 1.4, 17], focal: 30 },          // 顺光西侧立面：券圈 + 拱肩
      { cam: [4.5, 2.4, 26.0], look: [10, 2.0, 16.0], focal: 32 },      // 侧面全景（券洞、桥耳、桥额）
      { cam: [11.2, 3.35, 22], look: [10.3, 3.4, -16], focal: 30 },     // 桥面北行，视线贴着扶手石
      { cam: [10, 8.2, 19.8], look: [10, 3.2, 16.2], focal: 32 },       // 桥面俯视：桥心石六旋水纹
      { cam: [12.0, 3.5, 18.2], look: [11.72, 3.42, 16.9], focal: 50 }, // 栏板如意开光
      { cam: [13.0, 4.05, 17.4], look: [11.68, 3.82, 16.0], focal: 75 },// 望柱仰覆莲瓣
      { cam: [6.0, 0.95, 13.4], look: [8.25, 0.55, 12.5], focal: 58 },  // 长系石（桥耳）莲花端面
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
