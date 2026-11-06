import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { hashString } from './rng.js';

// ---------------------------------------------------------------------------
// patch(material, opts): inject procedural GLSL into any MeshStandard/Physical
// material (also works for MeshBasic/Lambert for the common hooks).
//
// Always available in BOTH vertex and fragment stages:
//   varying vec3 vWPos;  // world-space position (after vertexWorld displacement)
//   varying vec3 vWNrm;  // world-space geometric normal (unnormalised in frag -> normalize it)
//   uniform float uTime; uniform vec2 uWindDir; uniform float uWindStrength;
//   uniform vec3 uSunDir; uniform vec3 uSunColor;
//   the whole NOISE lib (n_* functions) and windOffset(wp, flex)
// Fragment helpers: n_bumpView(viewPos, viewNormal, height, strength) -> perturbed view normal
//
// Hooks (strings of GLSL statements):
//   vertexHead    : declarations for the vertex shader (attributes, varyings, functions)
//   vertexWorld   : runs with `vec4 wPos4` = world position; may modify wPos4.xyz (wind etc.)
//                   `transformed` (object space) and `objectNormal` are in scope.
//   fragHead      : declarations for the fragment shader (varyings, globals, functions)
//   fragColor     : after <color_fragment>; modify `diffuseColor` (vec4, linear)
//   fragRough     : after <roughnessmap_fragment>; modify `roughnessFactor`
//   fragMetal     : after <metalnessmap_fragment>; modify `metalnessFactor`
//   fragNormal    : after <normal_fragment_maps>; modify `normal` (VIEW space, normalized)
//   fragEmissive  : after <emissivemap_fragment>; modify `totalEmissiveRadiance`
//   fragLight     : after <lights_fragment_end>; may add to reflectedLight.* (e.g. leaf translucency)
//   fragEnd       : right before <opaque_fragment>; modify `outgoingLight`
//   uniforms      : extra uniforms {name: {value}} (shared objects are kept by reference)
//   defines       : extra defines
// ---------------------------------------------------------------------------

const COMMON_HEAD = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
${NOISE}
`;

const FRAG_UTIL = /* glsl */ `
vec3 n_bumpView(vec3 p, vec3 n, float h, float strength){
  vec3 dpdx = dFdx(p), dpdy = dFdy(p);
  float dhdx = dFdx(h), dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * n - strength * grad);
}
vec3 n_worldNormalFromView(vec3 nv){ return normalize((vec4(nv, 0.0) * viewMatrix).xyz); }
`;

// ---------------------------------------------------------------------------
// Variant registry (per kit): every patched material is (auto-)named and registered,
// so GPU programs are attributable in profilers and program histograms (Spector /
// bench progTop). Explicit names win; unnamed hooked materials get a stable
// 'hook_<keyhash>' name derived from their cache key, so re-creating the same
// variant keeps the same name. If two different variants share one name the entry
// is flagged `collide` (the ?probe=materials census reports it). The registry is a
// creation-time view: modules that rename materials afterwards (e.g. hall.js) show
// the new name in program histograms but the registry keeps the creation name.
// ---------------------------------------------------------------------------

// A kit owns the uniforms (u) it injects, the wind GLSL it splices in, the
// ?probe=shadersize threshold, and the variant registry. Creating a kit is
// explicit: nothing here reads URL or global state at import time, and two kits
// can coexist in one process. Diagnostics receive the registry by injection
// (kit.registry), never by importing a module singleton.
export function createPatchKit({ u, windGLSL, shaderMin = 0, registry = new Map() }) {
  if (!u || !windGLSL) throw new Error('createPatchKit requires { u, windGLSL }');

function registerVariant(mat, key) {
  if (!mat.name) mat.name = 'hook_' + key.slice(1, 9);
  const e = registry.get(mat.name);
  if (e && e.key !== key) {
    // a clone of a patched material (e.g. aoVariant) keeps the source name under a new
    // cache key - disambiguate so every program keeps a unique, attributable name
    mat.name = mat.name + '_' + key.slice(1, 7);
    registry.set(mat.name, { key, type: mat.type });
    return;
  }
  if (!e) registry.set(mat.name, { key, type: mat.type });
}


function patch(mat, o = {}) {
  const parts = [o.vertexHead, o.vertexWorld, o.fragHead, o.fragColor, o.fragRough, o.fragMetal, o.fragNormal, o.fragEmissive, o.fragPhysical, o.fragLight, o.fragEnd, JSON.stringify(o.defines || {})];
  const key = 'p' + hashString(parts.map((s) => s || '').join('|'));
  const prev = mat.onBeforeCompile;
  mat.userData.patch = o;
  if (o.defines) mat.defines = Object.assign(mat.defines || {}, o.defines);
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(shader, renderer);
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uWindDir = u.uWindDir;
    shader.uniforms.uWindStrength = u.uWindStrength;
    shader.uniforms.uSunDir = u.uSunDir;
    shader.uniforms.uSunColor = u.uSunColor;
    if (o.uniforms) Object.assign(shader.uniforms, o.uniforms);

    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${COMMON_HEAD}\n${windGLSL}\n${o.vertexHead || ''}`);
    vs = vs.replace(
      '#include <project_vertex>',
      /* glsl */ `
      vec4 wPos4 = vec4( transformed, 1.0 );
      #ifdef USE_BATCHING
        wPos4 = batchingMatrix * wPos4;
      #endif
      #ifdef USE_INSTANCING
        wPos4 = instanceMatrix * wPos4;
      #endif
      wPos4 = modelMatrix * wPos4;
      {
        vec3 _on = objectNormal;
        #ifdef USE_BATCHING
          _on = mat3(batchingMatrix) * _on;
        #endif
        #ifdef USE_INSTANCING
          _on = mat3(instanceMatrix) * _on;
        #endif
        vWNrm = mat3(modelMatrix) * _on;
      }
      ${o.vertexWorld || ''}
      vWPos = wPos4.xyz;
      vec4 mvPosition = viewMatrix * wPos4;
      gl_Position = projectionMatrix * mvPosition;
      `
    );
    vs = vs.replace(
      '#include <worldpos_vertex>',
      /* glsl */ `
      #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
        vec4 worldPosition = wPos4;
      #endif
      `
    );
    // objectNormal is not defined for depth/distance materials -> make sure it exists
    if (!vs.includes('beginnormal_vertex')) {
      vs = vs.replace('#include <begin_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);\n#include <begin_vertex>');
    }
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = fs.replace('#include <common>', `#include <common>\n${COMMON_HEAD}\n${FRAG_UTIL}\n${o.fragHead || ''}`);
    if (o.fragColor) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${o.fragColor}`);
    if (o.fragRough) fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${o.fragRough}`);
    if (o.fragMetal) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${o.fragMetal}`);
    if (o.fragNormal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${o.fragNormal}`);
    if (o.fragEmissive) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${o.fragEmissive}`);
    if (o.fragPhysical) fs = fs.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n${o.fragPhysical}`);
    if (o.fragLight) fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${o.fragLight}`);
    if (o.fragEnd) fs = fs.replace('#include <opaque_fragment>', `${o.fragEnd}\n#include <opaque_fragment>`);
    shader.fragmentShader = fs;
    // ?probe=shadersize: rank the compiled GLSL text (compile-time proxy). main.js
    // passes the threshold into the kit; only the monsters get logged.
    if (shaderMin && vs.length + fs.length >= shaderMin) {
      console.log('[info] shader-size', mat.name, vs.length + fs.length, `v${vs.length} f${fs.length}`);
    }
  };
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => key;
  registerVariant(mat, key);
  mat.needsUpdate = true;
  return mat;
}

// Patch a depth material (shadow casting) with the same world-space vertex displacement.
function depthMaterialFor(o = {}, base = {}) {
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, ...base });
  patch(dm, { vertexHead: o.vertexHead, vertexWorld: o.vertexWorld });
  return dm;
}

// ---------------------------------------------------------------------------
// Convenience factories
// ---------------------------------------------------------------------------
function std(params = {}, proc = null, name = '') {
  const m = new THREE.MeshStandardMaterial(params);
  if (name) m.name = name;
  if (proc) patch(m, proc);
  return m;
}
function phys(params = {}, proc = null, name = '') {
  const m = new THREE.MeshPhysicalMaterial(params);
  if (name) m.name = name;
  if (proc) patch(m, proc);
  return m;
}
// Emissive glow (lantern paper, flames, window light). `color` linear RGB, `intensity` HDR multiplier.
function glow(color = [1.0, 0.55, 0.22], intensity = 8, params = {}) {
  const c = new THREE.Color().setRGB(color[0], color[1], color[2]).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, ...params });
}

  return { patch, std, phys, glow, depthMaterialFor, registry };
}
