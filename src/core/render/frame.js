import * as THREE from 'three';
import { fitSunShadow } from '../lighting.js';
import { applyCamera } from './camera.js';
import { shutterOffset, sunDiscJitter } from './sampling.js';

// ---------------------------------------------------------------------------
// Offline frame renderer. Owns the sub-frame loop (AA jitter, shutter time,
// sun-disc jitter, shadow fitting) and nothing else: the film clock, time
// uniforms, fog, shadow exclusions, post overrides and the target are handed in
// by the app layer through callbacks. No URL / DOM / global access lives here.
// ---------------------------------------------------------------------------
export function createOfflineRenderer({
  renderer, scene, camera, pipeline, shotEval, director, sun, sunDir,
  width, height,
  sampling,
  resolvePost,   // (cameraDesc, q) -> post params
  prepareFrame,  // ({ c0, P, q, T, tLocal, dt }) -> { shadow? } (may mutate scene state first)
  applyTime,     // (T) -> void: shader clock, cloud drift, per-module updates
}) {
  let frameCounter = 0;

  // Render one final frame. getCam(tLocal) returns a camera description.
  // shutter: fraction of a frame interval the shutter is open (motion blur).
  function renderFrame({
    getCam = (t) => shotEval(0, t),
    T, tLocal, dt = 1 / 60, spp = 1, shutter = 0.5, fade = 1,
    target = null, frameIndex = frameCounter++, q = null, shadow = null,
  }) {
    const c0 = getCam(tLocal);
    const P = resolvePost(c0, q);
    director.setShot(c0.index);
    const prepared = prepareFrame ? prepareFrame({ c0, P, q, T, tLocal, dt }) : null;
    P.exposure *= fade;
    renderer.info.reset(); // frame boundary: accumulate calls/tris across all sub-passes
    pipeline.beginFrame();
    const region = shadow || (prepared && prepared.shadow) || c0.shadow
      || { center: [c0.look.x, c0.look.y * 0.3, c0.look.z], radius: 60 };
    // all sub-frame sampling patterns depend ONLY on the sub-frame index k, never on the
    // frame index, so static surfaces are bit-identical frame to frame (no shadow / AA / AO flicker)
    const W8 = spp > 1 ? sampling.weights(spp) : [1];
    for (let k = 0; k < spp; k++) {
      const off = shutterOffset(k, spp, shutter, dt);
      const tk = tLocal + off;
      applyTime(T + off);
      const c = getCam(tk);
      applyCamera(camera, c, { width, height, jitter: spp > 1 ? sampling.offset(k) : null });
      const j = sunDiscJitter(k, spp);
      fitSunShadow(sun, new THREE.Vector3(...region.center), region.radius, j ? new THREE.Vector2(j[0], j[1]) : null);
      pipeline.subframe(scene, camera, W8[k], P, frameIndex);
    }
    pipeline.endFrame(camera, P, sunDir, target, frameIndex);
  }

  return { renderFrame };
}
