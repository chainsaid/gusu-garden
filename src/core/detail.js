// Global geometry detail tier.
//
// The scene was authored for offline film rendering (~21 M triangles). For real-time
// playback on integrated GPUs the geometry generators need a single, central knob so
// every module can be decimated consistently instead of hand-editing constants.
//
//   DETAIL.s = 1    -> cinematic (unchanged output, used by preview / final)
//   DETAIL.s < 1    -> realtime decimation (?q=realtime, override with ?detail=0.4)
//
// Helpers express the three directions a generator parameter can be decimated in:
//   seg(n)   segment / ring counts      -> fewer segments  (smaller = cheaper)
//   gap(v)   spacings / pitch           -> bigger spacing  (bigger = fewer copies)
//   cnt(n)   instance / element counts  -> fewer instances
//   dens(v)  density multipliers        -> lower density
export const DETAIL = { s: 1, tier: 'preview' };

export function setDetailTier(quality, override) {
  DETAIL.tier = quality;
  DETAIL.s = override ? Math.min(1, Math.max(0.15, override)) : (quality === 'realtime' ? 0.5 : 1);
  return DETAIL.s;
}

export const seg = (n, min = 3) => Math.max(min, Math.round(n * DETAIL.s));
export const gap = (v) => v / Math.max(0.25, DETAIL.s);
export const cnt = (n) => Math.max(1, Math.round(n * DETAIL.s));
export const dens = (v) => v * DETAIL.s;
export const isRealtime = () => DETAIL.s < 0.999;
// detail *levels* (0..1..2 tree LOD grades etc): drop the grade at realtime, keep at s=1
export const lod = (v) => (DETAIL.s < 0.999 ? Math.max(0.5, v * 0.7) : v);
