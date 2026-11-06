// ---------------------------------------------------------------------------
// Sub-frame sampling patterns for offline accumulation.
//
// Every pattern depends ONLY on the sub-frame index k (never on the frame index),
// so static surfaces stay bit-identical frame to frame: no AA / shadow / AO
// flicker. All values are parameters; nothing here reads URL/DOM/global state.
// ---------------------------------------------------------------------------

export const halton = (i, b) => {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
};

// Anti-aliasing reconstruction filter: sub-frame k samples the pixel at a Halton
// offset inside a 2-px footprint and is weighted by a Gaussian (sigma 0.5 px). A
// wide, smooth filter (instead of a 1-px box) is what stops fine geometry from
// crawling/shimmering in slow camera moves.
export function createAaFilter({ radius = 1.0, sigma = 0.5 } = {}) {
  const offset = (k) => [
    (halton(k + 1, 2) * 2 - 1) * radius,
    (halton(k + 1, 3) * 2 - 1) * radius,
  ];
  const weights = (spp) => {
    const w = [];
    for (let k = 0; k < spp; k++) {
      const [x, y] = offset(k);
      w.push(Math.exp(-(x * x + y * y) / (2 * sigma * sigma)));
    }
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((v) => v / sum);
  };
  return { offset, weights };
}

// Shutter time: stratified, decorrelated from the AA offset (bit-reversed order).
export function shutterOffset(k, spp, shutter, dt) {
  if (spp <= 1) return 0;
  const kt = (k * (spp % 5 === 0 ? 7 : 5) + 1) % spp;
  return ((kt + 0.5) / spp - 0.5) * shutter * dt;
}

// Sun-disc jitter (soft shadows): a rotating spiral across the sub-frames.
// Returns [x, y] in shadow-map radius units, or null for single-sample frames.
export function sunDiscJitter(k, spp, scale = 0.0065) {
  if (spp <= 1) return null;
  const r = Math.sqrt((k + 0.5) / spp), th = k * 2.39996323 + 0.7;
  return [r * Math.cos(th) * scale, r * Math.sin(th) * scale];
}
