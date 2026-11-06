import * as THREE from 'three';
import { captureEnvironment } from '../core/lighting.js';

// ---------------------------------------------------------------------------
// Context assembly: the one object every world module receives.
// The app layer owns creation and lifetime; world modules only read it.
//   ctx.layers.noRefl registry for groups hidden during the pond reflection pass
//   ctx.services      renderer / scene / camera / pipeline handles for tooling
// ---------------------------------------------------------------------------
export function createContext({
  renderer, scene, camera, L, G, ENV, sunDir, geom, rng, quality, sky, detail, film, placement, M, mat, layers, services,
}) {
  const updates = [];
  const modules = {};
  const ctx = {
    THREE, renderer, scene, camera, L, G, ENV, sunDir, geom, rng, quality, sky, detail, film, placement, M, mat, layers, services, modules,
    onUpdate: (fn) => updates.push(fn),
    captureEnv: (pos, opts) => captureEnvironment(renderer, scene, new THREE.Vector3(...pos), opts),
  };
  return { ctx, updates, modules };
}
