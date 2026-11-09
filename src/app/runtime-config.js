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

// Bracket-set family. 'tokyo' (default) keeps the existing continuous 通肘木
// assembly byte-for-byte; 'jiangnan' is the short-piece 牌科 comparison build.
//   ?bracket=jiangnan
export function readBracketStyle(search) {
  const q = new URLSearchParams(search);
  return q.get('bracket') === 'jiangnan' ? 'jiangnan' : 'tokyo';
}

// Corridor 挂落. 'none' (default) leaves the corridor untouched; 'h10' hangs
// the shared H10 gualuo under the inner eave beam of every bay.
//   ?gualuo=h10
export function readGualuoStyle(search) {
  const q = new URLSearchParams(search);
  return q.get('gualuo') === 'h10' ? 'h10' : 'none';
}

// Corridor eave dressing. 'none' (default) keeps the eave byte-for-byte;
// 'jiangnan' adds the 瓦口板 and 滴水瓦 that a Suzhou eave carries.
//   ?eave=jiangnan
export function readEaveStyle(search) {
  const q = new URLSearchParams(search);
  return q.get('eave') === 'jiangnan' ? 'jiangnan' : 'none';
}

// Corridor corner (戗角) dressing. 'none' (default) keeps the hip corner as-is;
// 'jiangnan' builds a 嫩戗发戗 corner with 老戗 / 嫩戗 / raised 戗脊 / 脊头.
//   ?corner=jiangnan
export function readCornerStyle(search) {
  const q = new URLSearchParams(search);
  return q.get('corner') === 'jiangnan' ? 'jiangnan' : 'none';
}

// Corridor 美人靠 mounting. 'mount' (default) swaps the plain sitting rail of
// each open bay for a shared meikao segment sized to that bay's clear span
// (no x-scaling); 'none' leaves every bay with the plain sitting rail.
//   ?meikao=none
export function readMeikaoStyle(search) {
  const q = new URLSearchParams(search);
  return q.get('meikao') === 'none' ? 'none' : 'mount';
}
