import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Global uniforms shared BY REFERENCE across every custom shader / patched
// material. createUniforms() owns them: nothing here is module-level state, so a
// second renderer in the same process gets its own set.
//
// uWindDir / uWindStrength are consumed by WIND_GLSL (spliced in by the patch kit).
// windOffset(worldPos, flex) returns a world-space displacement. flex ~0 at trunk,
// 1 at leaf tips.
// ---------------------------------------------------------------------------
export function createUniforms({ sunDir, sunColor, sunIntensity, windDir = [0.8, 0.6], windStrength = 1.0 }) {
  return {
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(windDir[0], windDir[1]).normalize() },
    uWindStrength: { value: windStrength },
    uSunDir: { value: sunDir.clone() },
    uSunColor: { value: new THREE.Vector3(sunColor.r, sunColor.g, sunColor.b).multiplyScalar(sunIntensity) },
    uFrame: { value: 0 },
  };
}

export const WIND_GLSL = /* glsl */ `
vec3 windOffset(vec3 wp, float flex){
  float t = uTime;
  vec2 wd = uWindDir;
  float gust = 0.55 + 0.45 * sin(t * 0.37 + dot(wp.xz, wd) * 0.05) * sin(t * 0.23 + wp.x * 0.02);
  float sway = sin(t * 1.3 + dot(wp.xz, vec2(0.13, 0.11))) * 0.6 + sin(t * 2.1 + wp.y * 0.4 + wp.x * 0.3) * 0.3;
  float flutter = sin(t * 7.0 + dot(wp, vec3(2.1, 1.7, 2.9))) * 0.25 + sin(t * 11.0 + dot(wp, vec3(3.7, 2.3, 1.9))) * 0.12;
  vec3 o;
  o.xz = wd * (sway * 0.06 + gust * 0.05) * flex;
  o.y = flutter * 0.02 * flex;
  o.xz += vec2(flutter * 0.015, -flutter * 0.012) * flex;
  return o * uWindStrength;
}
`;
