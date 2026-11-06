import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment } from '../core/environment.js';
import { WIND_GLSL } from '../core/uniforms.js';
import { createMaterialKit } from '../world/materials/kit.js';
import { ATMOSPHERE } from '../data/atmosphere.js';
import { readSunOverrides } from './runtime-config.js';
import { installAtmosphere } from '../core/fog.js';
import { createSky } from '../core/sky.js';
import { createSun, fitSunShadow, captureEnvironment } from '../core/lighting.js';
import { Pipeline, DEFAULT_POST } from '../core/post.js';
import * as diag from '../core/diag.js';
import * as geom from '../core/geom.js';
import { rng } from '../core/rng.js';
import { L } from '../layout.js';
import { createDetailPolicy } from '../core/detail.js';
import { SHOTS, SHOT_DUR, FILM_DURATION } from '../data/film/shots.js';
import { PLACEMENT } from '../data/placement.js';
import { createPlacement } from '../world/placement/index.js';
import { createTimeline } from '../core/film/timeline.js';
import { createDirector } from './director.js';
import { createContext } from './context.js';
import { createAaFilter } from '../core/render/sampling.js';
import { applyCamera } from '../core/render/camera.js';
import { createOfflineRenderer } from '../core/render/frame.js';
import * as CHOREO from '../data/film/choreography.js';

// ---------------------------------------------------------------------------
// URL parameters
//   shot=N&t=sec          still frame from the film (N = 0..9)
//   cam=x,y,z&look=x,y,z  explicit camera (with focal=mm or fov=deg)
//   q=preview|realtime|final  quality preset. realtime decimates geometry via
//                             src/core/detail.js (policy handed to world builders as
//                             ctx.detail - nothing reads a module singleton any more)
//   detail=N               decimation scale override (0..1)
//   w,h                    resolution       spp=N   sub-frames (AA / motion blur)
//   play                   autoplay the shot sequence (dev)
//   mode=still|render|dev  still view / offline render (tools/render.mjs) / interactive
//   rscale=0..1            internal render scale (canvas CSS size unchanged)
//   autores                dynamic resolution to hold the frame rate
//   smap=N                 sun shadow map size (default 4096, preview 1024)
//   nopc                   skip shader precompile entirely
//   fullcompile            wait for ALL shader programs (dev default is progressive:
//                          shot-0 subset first, remaining programs in background)
//   nopre                  skip the shot preroll (implied by progressive compile)
//   envcap / noenvcap      force / skip the scene-wide environment capture
//   noav                   skip sky-light attenuation volumes
//   noshadow=a,b,c         exclude whole modules from the sun shadow map
//   shadynamic             per-camera shadow fitting (film); dev freezes the region
//   shadat=x,y,z  shadr=R  frozen shadow region override
//   probe=tris|materials|compilemod  diagnostics (src/core/diag.js)
//   nocheck                disable shader error checking
//   modules=a,b,c          which world modules to load (default: all)
//   post overrides: exp, godrays, dof=1, fstop, focus, ao, bloom, fog
const Q = new URLSearchParams(location.search);
const QUALITY = Q.get('q') || 'realtime';
const W = +Q.get('w') || (QUALITY === 'final' ? 1280 : 960);
const H = +Q.get('h') || (QUALITY === 'final' ? 720 : 540);
const MODE = Q.get('mode') || (Q.has('shot') || Q.has('cam') ? 'still' : 'dev');
const SPP = +Q.get('spp') || (MODE === 'render' ? 4 : 1);
// ?q=realtime decimates the procedural geometry through src/core/detail.js. The policy is
// created here (before any world module is imported) and passed down as ctx.detail; world
// modules never read a module singleton, so tiers can differ between two contexts in one
// process. ?detail=N overrides the scale.
const DETAIL = createDetailPolicy({ tier: QUALITY, override: +Q.get('detail') || 0 });

// atmosphere data + URL overrides -> environment, shared uniforms and the material kit
const ENVIRONMENT = createEnvironment({ atmosphere: ATMOSPHERE, overrides: readSunOverrides(location.search) });
const { u: G, env: ENV, sunDir } = ENVIRONMENT;
const MATS = createMaterialKit({ u: G, windGLSL: WIND_GLSL, shaderMin: Q.get('probe') === 'shadersize' ? 20000 : 0, isRealtime: DETAIL.isRealtime });

export const ALL_MODULES = ['terrain', 'pond', 'hall', 'interior', 'pagoda', 'bridge', 'buildings', 'props', 'vegetation'];

const status = (s) => { const el = document.getElementById('status'); if (el) el.textContent = s; };

const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
document.body.appendChild(canvas);

// preserveDrawingBuffer is only needed by still mode (canvas.toDataURL for snapshots);
// keeping it off in real-time modes is a free perf win on iGPUs.
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: MODE === 'still', alpha: false, stencil: false,
});
renderer.setPixelRatio(1);
// internal render scale (?rscale=0.75): RTs + drawing buffer render smaller while the
// canvas CSS size stays W×H, so the browser upscales — the cheapest way to buy frame rate.
const RSCALE = Math.min(1, Math.max(0.4, +Q.get('rscale') || 1));
const RW = Math.round(W * RSCALE), RH = Math.round(H * RSCALE);
renderer.setSize(RW, RH, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.info.autoReset = false; // post chain does many render() calls per frame; count the whole frame
if (Q.has('nocheck')) renderer.debug.checkShaderErrors = false;

// atmospheric fog / aerial perspective patches the live ShaderChunks: install it
// explicitly before anything compiles (volumes follow once the world is built).
const ATMOS = installAtmosphere({ environment: ENV });

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.32, 0.35, 0.44), 1.0);

const camera = new THREE.PerspectiveCamera(40, W / H, 0.12, 6000);
scene.add(camera);

const sky = createSky({ u: G, atmosphere: ATMOSPHERE });
scene.add(sky.object);
const sun = createSun(scene, { mapSize: Q.has('smap') ? +Q.get('smap') : (QUALITY === 'final' ? 4096 : QUALITY === 'realtime' ? 2048 : 1024), env: ENV });

const pipeline = new Pipeline(renderer, {
  width: RW, height: RH,
  msaa: QUALITY === 'final' ? 4 : 1, aoSamples: QUALITY === 'final' ? 16 : (QUALITY === 'preview' ? 6 : 8), dofQuality: QUALITY === 'final' ? 1 : 0,
  bloomMips: +Q.get('bmips') || (QUALITY === 'final' ? 7 : 4), // non-final: shorter bloom chain = fewer fullscreen passes
});
pipeline.setSun(sun, sunDir, G.uSunColor.value);

// ---------------------------------------------------------------------------
// Build the world
// ---------------------------------------------------------------------------
const director = createDirector({
  film: { shots: SHOTS, shotDur: SHOT_DUR },
  timeline: createTimeline({ cuts: SHOTS.map(() => SHOT_DUR) }),
  choreography: CHOREO,
});
const evalShot = director.evalShot;
// placement owns keep-out volumes / protected frames / tree-top caps; created once
// before the world so terrain and every content module read the same rules
const placement = createPlacement({ L, data: PLACEMENT });
const services = { THREE, renderer, scene, camera, pipeline };
const { ctx, updates } = createContext({
  renderer, scene, camera, L, G, ENV, sunDir, geom, rng, quality: QUALITY, sky, detail: DETAIL, film: director, placement,
  M: MATS.materials(),
  mat: MATS,
  layers: { noRefl: [] },
  services,
});
window.__services = ctx.services;

function normalizeResult(res) {
  if (!res) return {};
  if (res.isObject3D) return { object: res };
  return res;
}

async function buildWorld(names) {
  const results = {};
  for (let mi = 0; mi < names.length; mi++) {
    const name = names[mi];
    const t0 = performance.now();
    status(`building ${name}... (${mi + 1}/${names.length})`);
    await new Promise((r) => requestAnimationFrame(r)); // yield so the status text paints
    try {
      const mod = await import(`../world/${name}.js`);
      const res = normalizeResult(await mod.build(ctx));
      res.module = mod;
      if (res.object) { res.object.name = res.object.name || name; scene.add(res.object); }
      if (res.update) updates.push(res.update);
      results[name] = res;
      ctx.modules[name] = res;
      console.log(`[world] ${name} built in ${(performance.now() - t0).toFixed(0)} ms`);
    } catch (e) {
      console.error(`[world] module "${name}" FAILED:`, e && e.stack ? e.stack : e);
    }
  }
  // fallback ground when terrain is not loaded (module showcases)
  if (!results.terrain) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(400, 64).rotateX(-Math.PI / 2), ctx.M.granite);
    g.receiveShadow = true; g.name = 'fallbackGround';
    scene.add(g);
  }
  // anchors (hanging lanterns, bells) declared by buildings -> props module places them
  const anchors = { hangingLanterns: [], bells: [], smallBells: [] };
  for (const r of Object.values(results)) {
    if (!r.anchors) continue;
    for (const k of Object.keys(r.anchors)) (anchors[k] = anchors[k] || []).push(...r.anchors[k]);
  }
  window.__anchors = anchors;
  if (Q.has('dumpanchors')) console.log('[info] anchors ' + JSON.stringify({ b: anchors.bells.map((b) => b.pos.map((v) => +v.toFixed(2))), l: anchors.hangingLanterns.map((b) => b.pos.map((v) => +v.toFixed(2))) }));
  if (results.props && results.props.module.placeAnchors) {
    try {
      const o = await results.props.module.placeAnchors(ctx, anchors);
      if (o) scene.add(o.isObject3D ? o : o.object);
    } catch (e) { console.error('[world] placeAnchors FAILED:', e.stack || e); }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Film time
// ---------------------------------------------------------------------------
function setTime(T) {
  G.uTime.value = T + 37.0;
  pipeline.time = T;
  sky.uniforms.uCloudOffset.value.set(T * 0.004, T * 0.0016);
  for (const fn of updates) fn(T, ctx);
}

function postFor(c, q = Q) {
  const P = { ...DEFAULT_POST, ...(c.post || {}) };
  P.focusDist = c.focusDist ?? P.focusDist;
  P.fstop = c.fstop ?? P.fstop;
  P.focalLength = c.focal || 35;
  if (q.has('exp')) P.exposure = +q.get('exp');
  if (q.has('godrays')) P.godrays = +q.get('godrays');
  if (q.has('dof')) P.dof = q.get('dof') === '1';
  if (q.has('fstop')) P.fstop = +q.get('fstop');
  if (q.has('focus')) P.focusDist = +q.get('focus');
  if (q.has('ao')) P.aoStrength = +q.get('ao');
  if (q.has('bloom')) P.bloom = +q.get('bloom');
  if (q.has('tm')) P.tonemap = +q.get('tm');
  if (q.has('vol')) P.vol = +q.get('vol');
  if (q.has('clarity')) P.clarity = +q.get('clarity');
  if (q.has('sat')) P.saturation = +q.get('sat');
  if (q.has('punch')) P.punch = +q.get('punch');
  if (q.has('flare')) P.flare = +q.get('flare');
  if (q.has('con')) P.contrast = +q.get('con');
  if (q.has('sharpen')) P.sharpen = +q.get('sharpen');
  if (q.has('vold')) P.volDensity = +q.get('vold');
  if (q.has('volbox')) { const b = q.get('volbox').split(',').map(Number); P.volBox = { min: b.slice(0, 3), max: b.slice(3, 6), density: b[6] }; }
  if (QUALITY === 'preview') P.dof = P.dof && q.get('dof') === '1';
  return P;
}

function explicitCamera(q = Q) {
  const p = q.get('cam').split(',').map(Number);
  const l = (q.get('look') || '0,0,0').split(',').map(Number);
  return {
    pos: new THREE.Vector3(...p), look: new THREE.Vector3(...l),
    focal: +q.get('focal') || 35, fov: q.has('fov') ? +q.get('fov') : null,
    near: +q.get('near') || 0.12, far: 6000,
    focusDist: +q.get('focus') || new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...l)),
    fstop: +q.get('fstop') || 8,
    shadow: q.has('shadow') ? (() => { const s = q.get('shadow').split(',').map(Number); return { center: s.slice(0, 3), radius: s[3] }; })() : null,
    post: {},
  };
}

// Real-time (dev) mode: the sun is static, so freeze the shadow frustum over the whole
// site and let the shadow map render once, instead of re-fitting (and re-rendering all
// casters) every frame while orbiting. `?shadynamic` restores per-camera fitting (film
// quality); `?shadat=x,y,z` and `?shadr=R` override the frozen region.
const FROZEN_SHADOW = MODE === 'dev' && !Q.has('shadynamic')
  ? { center: Q.has('shadat') ? Q.get('shadat').split(',').map(Number) : [7, 0, -1], radius: +Q.get('shadr') || 85 }
  : null;
// per-shot exclusion of whole modules from the sun shadow map (e.g. trees outside the hall for the interior shot)
const _shadowCasters = new Map();
let _shadowKey = '';
function setShadowExclusions(list) {
  const key = (list || []).join(',');
  if (key === _shadowKey) return;
  _shadowKey = key;
  for (const [name, r] of Object.entries(ctx.modules)) {
    if (!r.object) continue;
    if (!_shadowCasters.has(name)) { const a = []; r.object.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.castShadow) a.push(o); }); _shadowCasters.set(name, a); }
    const off = (list || []).includes(name);
    for (const m of _shadowCasters.get(name)) m.castShadow = !off;
  }
  sun.shadow.needsUpdate = true; // caster set changed → re-render the shadow map
}

// ---------------------------------------------------------------------------
// Offline renderer (mechanism layer): sub-frame loop, sampling, shadow fitting
// ---------------------------------------------------------------------------
const offline = createOfflineRenderer({
  renderer, scene, camera, pipeline, shotEval: evalShot, director, sun, sunDir,
  width: W, height: H,
  sampling: createAaFilter({ radius: Q.has('aar') ? +Q.get('aar') : 1.0, sigma: Q.has('aas') ? +Q.get('aas') : 0.5 }),
  resolvePost: (c, q) => postFor(c, q || Q),
  prepareFrame: ({ c0, P, q }) => {
    const qq = q || Q;
    scene.fog.density = (P.fog ?? 1) * (qq.has('fog') ? +qq.get('fog') : 1);
    setShadowExclusions(qq.has('noshadow') ? qq.get('noshadow').split(',') : c0.noShadow);
    return { shadow: FROZEN_SHADOW || c0.shadow };
  },
  applyTime: setTime,
});
const renderFrame = (opts) => offline.renderFrame({ q: Q, ...opts });

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function main() {
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
  console.log('[gpu]', gpu);

  const names = Q.has('modules') ? Q.get('modules').split(',').filter(Boolean) : ALL_MODULES;
  const t0 = performance.now();
  const built = await buildWorld(names);
  status('');

  // sky-light attenuation volumes (interiors, under roofs) — must be set before the first render
  const vols = [];
  if (built.hall || built.interior) {
    const c = L.hall.center;
    vols.push({ min: [c[0] - 12.9, 1.8, c[2] - 8.4], max: [c[0] + 12.9, 9.4, c[2] + 8.4], tint: [0.11, 0.09, 0.075], soft: 0.7 });
  }
  for (const r of Object.values(built)) if (r.ambientVolumes) vols.push(...r.ambientVolumes);
  if (!Q.has('noav')) ATMOS.setVolumes(vols);

  // image based light: sky only first, then (final quality) the built scene
  const skyScene = new THREE.Scene();
  const skyClone = createSky({ u: G, atmosphere: ATMOSPHERE });
  skyScene.add(skyClone.object);
  if (!Q.has('nopc')) {
    // Shader compilation is the dominant load cost (~87 s cold on integrated GPUs) and is
    // dominated by terrain's shaders, which are visible in every shot — so there is no
    // cheap first-paint subset. We compile everything once, up front, predictably.
    // ?compilemod keeps one module attached at a time to attribute compile time per module.
    const tp = performance.now();
    applyCamera(camera, { pos: new THREE.Vector3(10, 4, 30), look: new THREE.Vector3(10, 3, 0), focal: 24 }, { width: W, height: H });
    if (Q.get('probe') === 'compilemod') {
      // per-module compile attribution: keep one module attached at a time, compile, time
      // it. The distribution shows which modules' shaders eat the compile floor.
      const groups = scene.children.filter((c) => c.type === 'Group' && c.name);
      for (const g of groups) {
        const saved = scene.children.filter((c) => c !== g && c.type === 'Group' && c.name).map((c) => ({ c, i: scene.children.indexOf(c) }));
        for (const { c } of saved) scene.remove(c);
        const t = performance.now();
        try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn('compileAsync failed', e); }
        console.log('[info] compilemod', g.name, Math.round(performance.now() - t), 'ms');
        for (const { c, i } of saved) { scene.children.splice(Math.min(i, scene.children.length), 0, c); c.parent = scene; }
      }
    } else {
      status('compiling shaders...');
      // compileAsync's wait loop yields (setTimeout 10 ms), so the main thread stays
      // responsive — poll the program cache on a timer and show real link progress.
      // info.programs IS programCache.programs (live array, grows as programs are created).
      const compiling = renderer.compileAsync(scene, camera).catch((e) => console.warn('compileAsync failed', e));
      let pollTimer = null;
      const tick = () => {
        const ps = renderer.info.programs || [];
        let ready = 0;
        for (const p of ps) { try { if (p.isReady()) ready++; } catch { ready++; } }
        status(`compiling shaders... (${ready}/${ps.length})`);
        if (ready < ps.length || ps.length === 0) pollTimer = setTimeout(tick, 120);
      };
      tick();
      try { await compiling; } finally { clearTimeout(pollTimer); }
      console.log('[info] parallel compile ms', Math.round(performance.now() - tp));
    }
  }
  const tc0 = performance.now();
  status('capturing sky environment... (0/6)');
  scene.environment = await captureEnvironment(renderer, skyScene, new THREE.Vector3(0, 2, 0), { size: 256, sky: skyClone, onProgress: (i, n) => status(`capturing sky environment... (${i}/${n})`) });
  console.log('[info] sky env capture ms', Math.round(performance.now() - tc0));
  scene.environmentIntensity = ENV.envIntensity;
  // scene-wide env capture renders EVERYTHING — under progressive compile it would stall
  // on all not-yet-linked programs (measured 117 s). Realtime skips it (sky-only env);
  // ?envcap forces it. Film modes always capture.
  if (QUALITY !== 'preview' && !Q.has('noenvcap') && (QUALITY !== 'realtime' || Q.has('envcap')) && names.length > 3) {
    const prevEnv = scene.environment;
    fitSunShadow(sun, new THREE.Vector3(6, 0, 0), 90);
    const tc1 = performance.now();
    status('capturing scene environment... (0/6)');
    scene.environment = await captureEnvironment(renderer, scene, new THREE.Vector3(10, 4, 4), { size: 256, sky, onProgress: (i, n) => status(`capturing scene environment... (${i}/${n})`) });
    renderer.getContext().finish();
    console.log('[info] scene env capture ms', Math.round(performance.now() - tc1));
    prevEnv.dispose();
  }
  for (const [name, r] of Object.entries(ctx.modules)) {
    if (r.finalize) { const tf = performance.now(); try { await r.finalize(ctx); renderer.getContext().finish(); console.log('[info] finalize', name, Math.round(performance.now() - tf), 'ms'); } catch (e) { console.error(`[world] finalize ${name} FAILED:`, e.stack || e); } }
  }
  const buildMs = performance.now() - t0;
  let tris = 0, meshes = 0;
  scene.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; tris += n * (o.isInstancedMesh ? o.count : 1); } });
  window.__info = { gpu, buildMs: Math.round(buildMs), meshes, tris: Math.round(tris) };
  console.log('[info]', JSON.stringify(window.__info));
  // ?probe=tris|materials: dev diagnostics (see src/core/diag.js)
  if (Q.has('probe')) {
    if (Q.get('probe') === 'materials') diag.probeMaterials(scene, MATS.registry);
    else diag.probeTris(scene);
  }

  await prerollShots();
  if (MODE === 'still') return runStill();
  if (MODE === 'render') return runRender();
  return runDev();
}

// Render every shot once before playback. Each shot can pull in material / post program
// variants the earlier shots never touched; rendering them here (into an offscreen target)
// compiles all of them during load, which is what turns the multi-second hitches seen at
// shot transitions into load-time cost. `?nopre` disables it.
async function prerollShots() {
  if (Q.has('nopre') || MODE === 'still') return;
  const rt = new THREE.WebGLRenderTarget(8, 8, { type: THREE.UnsignedByteType, depthBuffer: false });
  const t0 = performance.now();
  for (let i = 0; i < SHOTS.length; i++) {
    status(`warming shots ${i + 1}/${SHOTS.length}...`);
    await new Promise((r) => requestAnimationFrame(r)); // let the status text paint
    const tLocal = SHOT_DUR * 0.5;
    renderFrame({ getCam: (t) => evalShot(i, t), T: i * SHOT_DUR + tLocal, tLocal, spp: 1, target: rt, frameIndex: 1000 + i });
  }
  renderer.setRenderTarget(null);
  rt.dispose();
  console.log('[info] shot preroll ms', Math.round(performance.now() - t0));
}

function viewFromQuery(q) {
  let getCam, T, tLocal;
  if (q.has('cam')) {
    const c = explicitCamera(q);
    getCam = () => c; T = +q.get('t') || 0; tLocal = T;
  } else {
    const i = Math.min(+q.get('shot') || 0, SHOTS.length - 1);
    tLocal = q.has('t') ? +q.get('t') : SHOT_DUR * 0.5;
    T = i * SHOT_DUR + tLocal;
    getCam = (t) => evalShot(i, t);
  }
  return { getCam, T, tLocal };
}

async function runStill() {
  // re-render other views without reloading (used by tools/snap.mjs --view)
  window.__renderView = async (qs) => {
    const q = new URLSearchParams(qs);
    const v = viewFromQuery(q);
    const spp = +q.get('spp') || SPP;
    const t0 = performance.now();
    renderFrame({ ...v, spp, frameIndex: q.has('fi') ? +q.get('fi') : 1, q });
    await new Promise((r) => setTimeout(r, 40));
    console.log(`[info] view rendered in ${Math.round(performance.now() - t0)} ms, calls=${renderer.info.render.calls}`);
    return canvas.toDataURL('image/png');
  };
  if (Q.has('skipfirst')) { status(''); window.__READY = true; return; }
  const { getCam, T, tLocal } = viewFromQuery(Q);
  status('rendering...');
  const t0 = performance.now();
  renderFrame({ getCam, T, tLocal, spp: SPP, frameIndex: 1 });
  await new Promise((r) => setTimeout(r, 40));
  const info = renderer.info.render;
  window.__info.renderMs = Math.round(performance.now() - t0);
  window.__info.calls = info.calls;
  console.log('[info]', JSON.stringify(window.__info));
  status('');
  window.__READY = true;
}

async function runRender() {
  const fps = +Q.get('fps') || 60;
  const total = Math.round(FILM_DURATION * fps);
  const from = +Q.get('from') || 0;
  const to = Math.min(+Q.get('to') || total, total);
  const port = Q.get('port') || 5190;
  const buf = new Uint8Array(W * H * 4);
  window.__progress = { from, to, done: from };
  for (let f = from; f < to; f++) {
    const T = f / fps;
    const shot = Math.min(Math.floor(T / SHOT_DUR), SHOTS.length - 1);
    const tLocal = T - shot * SHOT_DUR;
    let fade = 1;
    if (T < 0.9) fade = Math.pow(T / 0.9, 1.6);
    if (T > FILM_DURATION - 1.4) fade = Math.max(0, (FILM_DURATION - T) / 1.4);
    // clamp sub-frame times inside the shot so cuts stay clean
    const getCam = (t) => evalShot(shot, Math.min(Math.max(t, 0), SHOT_DUR - 1e-4));
    renderFrame({ getCam, T, tLocal, dt: 1 / fps, spp: SPP, fade, target: pipeline.outRT, frameIndex: f });
    await renderer.readRenderTargetPixelsAsync(pipeline.outRT, 0, 0, W, H, buf);
    await fetch(`http://localhost:${port}/frame?i=${f}`, { method: 'POST', body: buf });
    // show the frame on canvas too
    pipeline.copyMat.uniforms.tIn.value = pipeline.outRT.texture;
    pipeline._pass(pipeline.copyMat, null);
    window.__progress.done = f + 1;
    // GPU cool-down: brief idle after every frame, longer rest periodically (iGPU thermals)
    const coolMs = Q.has('cool') ? +Q.get('cool') : 60;
    const restEvery = Q.has('restEvery') ? +Q.get('restEvery') : 250, restMs = Q.has('rest') ? +Q.get('rest') * 1000 : 15000;
    if (coolMs > 0) await new Promise((r) => setTimeout(r, coolMs));
    if (restEvery > 0 && (f + 1 - from) % restEvery === 0) { console.log('[info] cool-down rest after frame', f + 1); await new Promise((r) => setTimeout(r, restMs)); }
  }
  await fetch(`http://localhost:${port}/done`, { method: 'POST', body: 'ok' });
  window.__READY = true;
}

function runDev() {
  const hud = document.getElementById('hud');
  const controls = new OrbitControls(camera, canvas);
  const c0 = Q.has('cam') ? explicitCamera() : evalShot(0, 0);
  applyCamera(camera, c0, { width: W, height: H });
  controls.target.copy(c0.look);
  controls.update();
  let playing = Q.has('play'), shot = -1, tLocal = 0, last = performance.now();
  const free = { focal: 35 };
  // optional dynamic resolution (?autores): track frame time, scale the internal
  // resolution within [0.5, RSCALE] to hold an interactive frame rate; CSS size unchanged
  const adapt = Q.has('autores');
  let scale = RSCALE, emaMs = 16, adjCool = 30;
  const applyScale = (s) => {
    scale = s;
    const w = Math.round(W * s), h = Math.round(H * s);
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h);
  };
  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') { shot = (+e.key + 9) % 10; tLocal = 0; playing = true; }
    if (e.key === ' ') playing = !playing;
    if (e.key === 'f') { shot = -1; playing = false; }
    if (e.key === 'c') {
      const s = `cam=${camera.position.toArray().map((v) => v.toFixed(2))}&look=${controls.target.toArray().map((v) => v.toFixed(2))}`;
      console.log(s); navigator.clipboard?.writeText(s);
    }
  });
  window.__READY = true;
  function loop() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (adapt) {
      emaMs = emaMs * 0.92 + Math.min(dt, 0.05) * 1000 * 0.08;
      if (--adjCool <= 0) {
        if (emaMs > 26 && scale > 0.5) { applyScale(Math.max(0.5, scale * 0.9)); adjCool = 50; }
        else if (emaMs < 13 && scale < RSCALE) { applyScale(Math.min(RSCALE, scale * 1.08)); adjCool = 50; }
        else adjCool = 20;
      }
    }
    if (playing && shot >= 0) { tLocal += dt; if (tLocal > SHOT_DUR) { shot = (shot + 1) % SHOTS.length; tLocal = 0; } }
    if (shot >= 0) {
      const T = shot * SHOT_DUR + tLocal;
      renderFrame({ getCam: (t) => evalShot(shot, t), T, tLocal, spp: 1 });
      const c = evalShot(shot, tLocal); controls.target.copy(c.look);
    } else {
      const T = (now / 1000) % 1000;
      const c = { pos: camera.position.clone(), look: controls.target.clone(), focal: free.focal, focusDist: 20, fstop: 8, post: {} };
      renderFrame({ getCam: () => c, T, tLocal: T, spp: 1 });
    }
    const base = shot >= 0 ? `shot ${shot + 1}/10  ${SHOTS[shot].name}  t=${tLocal.toFixed(2)}` : 'free cam (keys 1-0 play shots, space pause, c copy cam)';
    if (hud) hud.textContent = adapt ? `${base}  |  ${Math.round(1000 / Math.max(emaMs, 1))}fps  ${(scale * 100) | 0}%` : base;
    requestAnimationFrame(loop);
  }
  loop();
}

main().catch((e) => { console.error('[fatal]', e.stack || e); window.__ERROR = String(e); window.__READY = true; });
