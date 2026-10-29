// one-off: analyse vertices above y=6 in the bridge granite mesh
import puppeteer from 'puppeteer-core';
import { findChrome, gpuArgs, assertDevServer } from './lib/chrome.mjs';

const CHROME = findChrome();
await assertDevServer(5173);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: [...gpuArgs(), '--window-size=640,360'],
  defaultViewport: { width: 640, height: 360 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/?modules=bridge&sunelev=35&q=realtime&mode=dev', { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction('window.__READY === true', { timeout: 180000, polling: 500 });
const out = await page.evaluate(() => {
  const v3 = new window.__ctx.THREE.Vector3();
  let mesh = null;
  window.__ctx.scene.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'bridgeGranite') mesh = o; });
  if (!mesh) return 'no granite mesh';
  mesh.updateMatrixWorld(true);
  const p = mesh.geometry.attributes.position;
  const hi = [];
  for (let i = 0; i < p.count; i++) {
    v3.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
    if (v3.y > 6) hi.push([v3.x, v3.y, v3.z]);
  }
  if (!hi.length) return 'no verts above y=6';
  const mm = (arr) => { let lo = Infinity, up = -Infinity; for (const v of arr) { const t = Array.isArray(v) ? v[1] : v; if (t < lo) lo = t; if (t > up) up = t; } return [+lo.toFixed(2), +up.toFixed(2)]; };
  const r2 = hi.map(v => Math.hypot(v[2] - 16, v[1] + 10.2)); // distance from arc centre (YC=-10.2, ZC=16)
  return {
    count: hi.length,
    x: mm(hi.map(v => [0, v[0]])),
    y: mm(hi.map(v => [0, v[1]])),
    z: mm(hi.map(v => [0, v[2]])),
    rFromYC: mm(r2.map(v => [0, v])),
    samples: hi.filter((_, i) => i % Math.ceil(hi.length / 12) === 0).map(v => v.map(n => +n.toFixed(2))),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
