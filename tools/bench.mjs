// Performance benchmark for the real-time scene: loads the page in headless Chromium
// (Edge works) with the real GPU (ANGLE d3d11), plays the shot sequence and samples
// frame times.
//
//   single run : node tools/bench.mjs --label baseline [--url ...] [--build-only] [--profile]
//   sweep      : node tools/bench.mjs --sweep
//
// --sweep runs four cost-allocation configs in ONE browser session with a persistent
// profile, so the scene's shader programs compile once (first config) and every later
// config/page load reuses the GPU shader disk cache — the deltas then measure post /
// shadow / resolution cost, not compile cost.
//
// Ready detection listens for the build-summary console line ("[info] {\"gpu\":...}")
// instead of polling window.__READY: with the render loop saturating the main thread,
// evaluate-based polling crawls, console events do not.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, gpuArgs, assertDevServer } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const a = process.argv.slice(2);
const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const has = (k) => a.includes('--' + k);

const W = +get('w', 1280), H = +get('h', 720);
const SECS = +get('secs', 15);
const WARM = +get('warm', 6);
const TIMEOUT = +get('timeout', 300);
const BUILD_ONLY = has('build-only');
const SWEEP_MODE = has('sweep');
const PROFILE = has('profile') || SWEEP_MODE ? path.join(ROOT, 'out', '.bench-profile') : undefined;
const BASE = `http://localhost:5173/?w=${W}&h=${H}&play`;

// cost-allocation sweep: deltas vs the previous row attribute frame time to post effects,
// shadow map resolution and internal render scale
const SWEEP = [
  { label: 'post-full', qs: '' },
  { label: 'post-off', qs: '&ao=0&godrays=0&bloom=0' },
  { label: 'smap-512', qs: '&ao=0&godrays=0&bloom=0&smap=512' },
  { label: 'rscale-66', qs: '&ao=0&godrays=0&bloom=0&smap=512&rscale=0.66' },
];

const configs = SWEEP_MODE
  ? SWEEP.map((c) => ({ label: c.label, url: BASE + c.qs }))
  : [{ label: get('label', 'run'), url: has('url') ? get('url', '') : BASE }];

await assertDevServer(5173);
const CHROME = findChrome();
console.log(`[bench] ${SWEEP_MODE ? 'SWEEP' : (configs[0].label || 'run')}  browser=${CHROME.split('\\').pop()}  ${W}x${H}  measure=${SECS}s warm=${WARM}s  profile=${PROFILE ? 'yes' : 'no'}`);

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: [...gpuArgs(), `--window-size=${W},${H}`, '--force-device-scale-factor=1'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  protocolTimeout: 0,
  ...(PROFILE ? { userDataDir: PROFILE } : {}),
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measureInPage(ms) {
  const r = window.__ctx.renderer;
  const t0 = performance.now();
  const times = [];
  await new Promise((done) => {
    let last = t0;
    const tick = (t) => { times.push(t - last); last = t; if (t - t0 >= ms) done(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  times.sort((x, y) => x - y);
  const q = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))];
  const sum = times.reduce((s, v) => s + v, 0);
  return {
    frames: times.length,
    avgFps: Math.round((1000 / (sum / times.length)) * 10) / 10,
    p50: Math.round(q(0.5) * 10) / 10,
    p95: Math.round(q(0.95) * 10) / 10,
    p99: Math.round(q(0.99) * 10) / 10,
    worst: Math.round(times[times.length - 1] * 10) / 10,
    programs: (r.info.programs || []).length,
    // last frame's actual GPU work (renderer.info auto-resets per render): rendered
    // triangles after frustum culling + draw calls — the decisive culling diagnostic
    rt: r.info.render.triangles,
    rc: r.info.render.calls,
    // program family histogram: which materials own the 350+ programs (merge targets)
    progTop: Object.entries((r.info.programs || []).reduce((m, p) => { const k = p.name || 'anon'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 20),
  };
}

const results = [];
try {
  for (let i = 0; i < configs.length; i++) {
    if (!browser.connected) { console.error('[bench] browser disconnected, aborting remaining configs'); break; }
    const cfg = configs[i];
    const page = await browser.newPage(); // fresh page per config: a crashed/detached page must not poison the rest
    page.on('pageerror', (e) => console.log('[page:error]', e.message.slice(0, 300)));
    page.on('error', (e) => console.log('[page:crash]', String(e).slice(0, 300)));
    const t0 = Date.now();
    const ts = () => `[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s]`;
    console.log(`\n[bench] #${i + 1}/${configs.length} ${cfg.label}  ${cfg.url}`);

    let readyResolve, readyReject;
    const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
    const onConsole = (m) => {
      const t = m.text();
      if (t.includes('tris-by-object')) console.log(t);
      if (/^\[(world|info)\]/.test(t) && !t.startsWith('[info] {')) console.log(t); // load profiling lines
      if (/^\[fatal\]/.test(t)) readyReject(new Error(t.slice(0, 300)));
      const mm = t.match(/^\[info\] (\{.*\})$/);
      if (mm) { try { const j = JSON.parse(mm[1]); if (j.gpu) readyResolve(j); } catch { /* not the summary line */ } }
    };
    page.on('console', onConsole);
    try {
      await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      const meta = await Promise.race([
        ready,
        sleep(TIMEOUT * 1000).then(() => { throw new Error(`build not done within ${TIMEOUT}s`); }),
      ]);
      console.log(`${ts()} build done: buildMs=${meta.buildMs}  tris=${meta.tris}  meshes=${meta.meshes}`);

      if (BUILD_ONLY) {
        results.push({ label: cfg.label + ' (build)', buildMs: meta.buildMs, sceneTris: meta.tris, gpu: meta.gpu });
        continue;
      }
      await page.keyboard.press('1'); // start shot 0 playback -> continuous camera movement
      await sleep(WARM * 1000);
      const s = await page.evaluate(measureInPage, SECS * 1000);
      const row = { label: cfg.label, buildMs: meta.buildMs, sceneTris: meta.tris, gpu: meta.gpu, ...s };
      results.push(row);
      console.log(JSON.stringify(row));
    } catch (e) {
      console.error(`[bench] config "${cfg.label}" failed: ${e.message}`);
      process.exitCode = 1;
    } finally {
      page.off('console', onConsole);
      await page.close().catch(() => {});
    }
  }
} finally {
  await browser.close();
}

if (SWEEP_MODE && results.length) {
  console.log('\n[bench] SUMMARY  (frame times in ms, lower is better)');
  for (const r of results) {
    console.log(`  ${String(r.label).padEnd(12)} fps=${String(r.avgFps).padEnd(6)} p50=${String(r.p50).padEnd(7)} p95=${String(r.p95).padEnd(7)} p99=${String(r.p99).padEnd(8)} worst=${String(r.worst).padEnd(8)} buildMs=${r.buildMs} programs=${r.programs}`);
  }
}
