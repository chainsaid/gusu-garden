// ---------------------------------------------------------------------------
// URL overrides read by the app layer and passed into the mechanism layer as
// plain values. Nothing in src/core parses location.search.
// ---------------------------------------------------------------------------
const deg = Math.PI / 180;

// dev overrides so modules can be inspected under a higher, neutral sun:
//   ?sunelev=<degrees>   ?sunaz=<degrees, azimuth of the direction toward the sun>
export function readSunOverrides(search) {
  const q = new URLSearchParams(search);
  const o = {};
  if (q.has('sunelev')) o.elevationRad = (+q.get('sunelev')) * deg;
  if (q.has('sunaz')) { const a = (+q.get('sunaz')) * deg; o.azDir = [Math.cos(a), Math.sin(a)]; }
  return o;
}
