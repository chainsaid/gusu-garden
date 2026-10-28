// ---------------------------------------------------------------------------
// hall-mats: hall-specific material variants.
//  - every exterior material gets a baked ambient-occlusion attribute (aAO)
//    that attenuates indirect light only (deep eaves, porch, crawlspace)
//  - "orn": vermilion lacquer with raised gold 卷草 / flower relief
//    (卷草/缠枝雕 ornament for beams, gables, transoms)
//  - "blackOrn": black lacquer with fine gold scroll relief
// ---------------------------------------------------------------------------

// Screen-space footprint filter: hk_aa(f) is 1 while a pattern of spatial
// frequency f (cycles / metre) is well resolved and fades to 0 as its period
// approaches the pixel footprint (kills sub-pixel shimmer in motion).
export const AA_HEAD = /* glsl */ `
#ifndef HK_AA
#define HK_AA
float hk_aa(float f){ return 1.0 - smoothstep(0.12, 0.45, f * length(fwidth(vWPos))); }
vec2 hk_uv(vec3 wp, vec3 wn){ vec3 a = abs(wn); return a.y > max(a.x, a.z) ? wp.xz : (a.x > a.z ? wp.zy : wp.xy); }
#endif`;

export const AO_HOOKS = {
  vertexHead: 'attribute float aAO; varying float vAO;',
  vertexWorld: 'vAO = aAO;',
  fragHead: 'varying float vAO;' + AA_HEAD,
  fragLight: 'reflectedLight.indirectDiffuse *= vAO; reflectedLight.indirectSpecular *= mix(1.0, vAO, 0.75);',
  // specular anti-aliasing: widen the lobe where the (bump-perturbed) normal
  // varies within a pixel, so tiny highlights on gilt studs / bumped lacquer
  // do not sparkle frame to frame (Kaplanyan-style normal variance filter)
  fragPhysical: /* glsl */ `
    {
      vec3 dnx = dFdx(normal), dny = dFdy(normal);
      float kv = min(0.5 * (dot(dnx, dnx) + dot(dny, dny)), 0.18);
      float r2 = material.roughness * material.roughness;
      material.roughness = min(1.0, sqrt(sqrt(r2 * r2 + kv)));
      #ifdef USE_CLEARCOAT
      float c2 = material.clearcoatRoughness * material.clearcoatRoughness;
      material.clearcoatRoughness = min(1.0, sqrt(sqrt(c2 * c2 + kv)));
      #endif
    }`,
};

// fade fine procedural noise terms of the shared material library by the pixel footprint
function filterHF(h) {
  const out = { ...h };
  for (const k of ['fragColor', 'fragNormal']) {
    if (typeof out[k] !== 'string') continue;
    out[k] = out[k]
      .replace(/n_snoise3\((wp|vWPos) \* ([0-9]+\.[0-9]+)( \+ [0-9.]+)?\)/g, (m, v, f) => (+f >= 5 ? '(' + m + ' * hk_aa(' + f + '))' : m))
      .replace('n_snoise3(wp * gs * 2.7)', '(n_snoise3(wp * gs * 2.7) * hk_aa(24.0))')
      .replace('n_snoise3(wp * gs)', '(n_snoise3(wp * gs) * hk_aa(9.0))');
  }
  return out;
}

export function mergeHooks(...hs) {
  const out = {};
  for (const h of hs) {
    if (!h) continue;
    for (const [k, v] of Object.entries(h)) {
      if (k === 'uniforms' || k === 'defines') out[k] = Object.assign(out[k] || {}, v);
      else if (typeof v === 'string') out[k] = (out[k] ? out[k] + '\n' : '') + v;
    }
  }
  return out;
}

export function aoVariant(ctx, base, extra = null, params = null) {
  const v = base.clone();
  if (params) Object.assign(v, params);
  const hooks = filterHF(mergeHooks(base.userData.patch || {}, extra, AO_HOOKS));
  ctx.mat.patch(v, hooks);
  v.name = (base.name || base.type) + '+ao';
  return v;
}

// Weathering layered on top of any base colour (needs the AO hooks, merged
// after): grime/soot darkening in sheltered joints & under eaves (low baked
// AO), chalky sun-faded up-facing tops, faint vertical rain-wash streaks.
// gr / fd / st scale the three effects.
export function weatherHooks(gr = 1.0, fd = 1.0, st = 1.0) {
  const f = (x) => Number(x).toFixed(3);
  return {
    fragColor: /* glsl */ `
      {
        vec3 wn = normalize(vWNrm);
        vec3 c = diffuseColor.rgb;
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        float gn = n_fbm3(vWPos * vec3(1.1, 2.6, 1.1) + 4.0, 3) * 0.5 + 0.5;
        float sh = smoothstep(0.12, 0.7, 1.0 - vAO);
        vec3 grime = mix(c, vec3(lum) * vec3(1.15, 0.86, 0.66), 0.4) * 0.6;
        c = mix(c, grime, sh * (0.45 + 0.55 * gn) * ${f(gr)});
        float up = smoothstep(0.4, 0.95, wn.y) * smoothstep(0.55, 0.95, vAO);
        vec3 faded = mix(c, vec3(lum), 0.4) * 1.45 + vec3(0.018, 0.012, 0.008);
        c = mix(c, faded, up * (0.55 + 0.45 * gn) * ${f(fd)});
        float vert = 1.0 - abs(wn.y);
        float stk = n_snoise3(vWPos * vec3(9.0, 0.28, 9.0) + 1.7) * 0.5 + 0.5;
        c *= 1.0 - vert * mix(0.12, smoothstep(0.55, 0.95, stk), hk_aa(9.0)) * 0.22 * ${f(st)};
        diffuseColor.rgb = c;
      }`,
  };
}

// Aged gilt: blotchy tarnish (darker, browner, rougher) and soot in recesses.
export function agedGiltHooks(amt = 1.0) {
  const a = Number(amt).toFixed(3);
  return {
    fragHead: 'float g_tarn;',
    fragColor: /* glsl */ `
      {
        float tn = smoothstep(0.42, 0.78, n_fbm3(vWPos * 2.4 + 9.0, 3) * 0.5 + 0.5);
        float fine = n_snoise3(vWPos * 23.0) * 0.5 + 0.5;
        g_tarn = clamp(tn * (0.7 + 0.3 * fine), 0.0, 1.0) * ${a};
        vec3 c = diffuseColor.rgb;
        c = mix(c, c * vec3(0.52, 0.42, 0.30), g_tarn * 0.65);
        c *= mix(0.62, 1.0, smoothstep(0.15, 0.85, vAO));
        // gold-leaf squares laid with faint overlapping seams,
        // plus fine wiping marks; both filtered by the pixel footprint
        {
          vec2 q = hk_uv(vWPos, normalize(vWNrm)) / 0.109 + vec2(0.37, 0.61);
          vec2 gq = abs(fract(q) - 0.5);
          vec2 px = fwidth(q) + 1e-4;
          vec2 ln = (1.0 - smoothstep(0.5 - 0.02 - px, 0.5 - 0.02 + px, gq)) ;
          ln = 1.0 - ln;
          float seam = max(ln.x, ln.y) * min(1.0, 0.04 / max(px.x, px.y)) * hk_aa(9.0);
          c *= 1.0 - 0.07 * seam;
          g_tarn = clamp(g_tarn + seam * 0.1, 0.0, 1.0);
        }
        diffuseColor.rgb = c;
      }`,
    fragRough: 'roughnessFactor = clamp(roughnessFactor + g_tarn * 0.22, 0.05, 1.0);',
    // hammered / burnished leaf: low-amplitude normal ripple so flat fittings
    // pick up a range of reflections instead of one uniform tint
    fragNormal: 'normal = n_bumpView(-vViewPosition, normal, n_snoise3(vWPos * 11.0) * 0.5 + g_tarn * 0.4, 0.0016);',
    // These fittings are dark iron / aged bronze now, not gilt. In shade they
    // pick up the cool sky instead of a warm amber inter-reflection, so the
    // indirect specular is nudged slightly cool rather than toward gold.
    fragLight: /* glsl */ `
      {
        vec3 s = reflectedLight.indirectSpecular;
        float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
        reflectedLight.indirectSpecular = mix(s, l * vec3(0.92, 0.98, 1.10), 0.28);
      }`,
  };
}

// Aged lacquer micro-detail for close-ups: fine craquelure (elongated cell
// cracks along the member), multi-scale tonal mottling; the cracks are drawn
// with analytic coverage and fade out entirely before they get sub-pixel.
export function lacquerMicroHooks(amt = 1.0) {
  const a = Number(amt).toFixed(3);
  return {
    fragHead: 'float g_crk;',
    fragColor: /* glsl */ `
      {
        vec3 wn = normalize(vWNrm);
        vec2 uv = hk_uv(vWPos, wn);
        float aa = hk_aa(26.0);
        // (no branch: fwidth must run in uniform control flow)
        vec2 w = n_worley(uv * vec2(24.0, 13.0) + 5.3);
        float e = w.y - w.x;
        float px = fwidth(e) + 1e-4;
        float lw = 0.045;
        g_crk = (1.0 - smoothstep(lw - px, lw + px, e)) * min(1.0, lw / px) * aa * ${a};
        float m1 = n_snoise3(vWPos * 0.7 + 3.1);
        float m2 = n_snoise3(vWPos * 3.9 + 7.7) * hk_aa(3.9);
        diffuseColor.rgb *= (1.0 + 0.08 * m1 + 0.05 * m2) * (1.0 - 0.32 * g_crk);
      }`,
    fragRough: 'roughnessFactor = mix(roughnessFactor, 0.95, g_crk);',
  };
}

