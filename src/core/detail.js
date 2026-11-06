// Geometry detail policy.
//
// The scene was authored for offline film rendering (~21 M triangles). For real-time
// playback on integrated GPUs the geometry generators need a single, central knob so
// every module can be decimated consistently instead of hand-editing constants.
//
// This is a *policy object*, not a module singleton: the assembly layer creates one
// with createDetailPolicy({ tier, override }) and hands it to the world builders
// (ctx.detail / explicit argument). Two policies with different tiers can therefore
// coexist in one process (tools, tests, a second scene).
//
//   s = 1    -> cinematic (unchanged output, used by preview / final)
//   s < 1    -> realtime decimation (?q=realtime, override with ?detail=0.4)
//
// Helpers express the three directions a generator parameter can be decimated in:
//   seg(n)   segment / ring counts      -> fewer segments  (smaller = cheaper)
//   gap(v)   spacings / pitch           -> bigger spacing  (bigger = fewer copies)
//   cnt(n)   instance / element counts  -> fewer instances
//   dens(v)  density multipliers        -> lower density
export function createDetailPolicy({ tier = 'preview', override = 0 } = {}) {
  const s = override ? Math.min(1, Math.max(0.15, override)) : (tier === 'realtime' ? 0.5 : 1);
  const realtime = s < 0.999;
  return {
    s, tier,
    seg: (n, min = 3) => Math.max(min, Math.round(n * s)),
    gap: (v) => v / Math.max(0.25, s),
    cnt: (n) => Math.max(1, Math.round(n * s)),
    dens: (v) => v * s,
    isRealtime: () => realtime,
    // detail *levels* (0..1..2 tree LOD grades etc): drop the grade at realtime, keep at s=1
    lod: (v) => (realtime ? Math.max(0.5, v * 0.7) : v),
  };
}
