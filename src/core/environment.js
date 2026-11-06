import * as THREE from 'three';
import { createUniforms } from './uniforms.js';

// ---------------------------------------------------------------------------
// Environment: turns atmosphere data (+ app-supplied URL overrides) into
//   - env : the flat lighting parameters (sun colour / intensity, sky scale, fog)
//   - u   : the shared uniforms every material reads
//   - sunDir : the unit vector to the sun
//
// The data (src/data/atmosphere.js) is an argument, never an import: the mechanism
// layer knows how to build an environment, not what this film's golden hour is.
// ---------------------------------------------------------------------------
const deg = Math.PI / 180;

export function createEnvironment({ atmosphere, overrides = {} } = {}) {
  if (!atmosphere) throw new Error('createEnvironment requires { atmosphere }');
  const elevation = overrides.elevationRad ?? atmosphere.sunElevationDeg * deg;
  const azDir = overrides.azDir
    ? new THREE.Vector2(overrides.azDir[0], overrides.azDir[1]).normalize()
    : new THREE.Vector2(atmosphere.sunAz[0], atmosphere.sunAz[1]).normalize();
  const sunDir = new THREE.Vector3(
    azDir.x * Math.cos(elevation),
    Math.sin(elevation),
    azDir.y * Math.cos(elevation)
  ).normalize();

  const sunColor = new THREE.Color().setRGB(atmosphere.sunColor[0], atmosphere.sunColor[1], atmosphere.sunColor[2]);
  const u = createUniforms({
    sunDir, sunColor,
    sunIntensity: atmosphere.sunIntensity,
    windDir: atmosphere.windDir,
    windStrength: atmosphere.windStrength,
  });
  const env = {
    sunDir,
    sunColor,
    sunIntensity: atmosphere.sunIntensity,
    skySunIntensity: atmosphere.skySunIntensity,
    envIntensity: atmosphere.envIntensity,
    exposure: atmosphere.exposure,
    fogDensity: atmosphere.fogDensity,
  };
  return { u, env, sunDir, atmosphere };
}
