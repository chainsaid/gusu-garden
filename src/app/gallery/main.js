// ---------------------------------------------------------------------------
// Offline asset gallery: one isolated component at a time, built by the same
// generators the film renderer uses. This is a new entry (a consumer of the
// existing layers), not a change to the film pipeline.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment } from '../../core/environment.js';
import { WIND_GLSL } from '../../core/uniforms.js';
import { createMaterialKit } from '../../world/materials/kit.js';
import { ATMOSPHERE } from '../../data/atmosphere.js';
import { createDetailPolicy } from '../../core/detail.js';
import { Acc, basis } from '../../world/hall-lib.js';
import { bracketSet } from '../../world/hall-bracket.js';
import { buildTiles, buildXieshanRidges, makeProfile, makeWarp, ridgeAlong } from '../../world/hall-roof.js';
import { chiwen } from '../../world/hall-orn.js';
import { buildTaihuPeak } from '../../world/rockery-sdf.js';
import { rng } from '../../core/rng.js';
import { GALLERY_GROUPS, findItem } from '../../../shared/data/gallery.js';

// --- renderer / scene -------------------------------------------------------
const canvas = document.getElementById('view');
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141719);

const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.minDistance = 0.4;
controls.maxDistance = 80;

// --- shared environment / materials (same objects the film uses) -----------
const { u: G, env: ENV, sunDir } = createEnvironment({ atmosphere: ATMOSPHERE });
const mat = createMaterialKit({ u: G, windGLSL: WIND_GLSL, isRealtime: () => false });
const M = mat.materials();
const detail = createDetailPolicy({ tier: 'preview' });
const ctx = {
  THREE, renderer, scene, camera, L: null, G, ENV, sunDir, detail, mat, materials: mat, M,
  layers: { noRefl: [] },
};

// --- lights + ground --------------------------------------------------------
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.copy(sunDir).multiplyScalar(20);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x2a2620, 0.65));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.95, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- component builders (the only side-specific part) ----------------------
const BUILDERS = {
  bracketSet(params) {
    const acc = new Acc();
    const mats = {
      bkt: M.woodChestnut,
      red: M.woodChestnut,
      redDark: M.woodChestnutDark,
      redA: M.lacquerOrange,
      gold: M.gold,
    };
    bracketSet(acc, mats, new THREE.Matrix4(), params.type, { lat: params.lat });
    return acc.build('dougong');
  },
  roofTiles(params) {
    // Standalone 歇山 outline; no dependency on a specific hall.
    const T = {
      kind: 'xieshan',
      y0: 0,
      ex: 5.2, ez: 4.2, xb: 4.5, xg: 4.0,
      prof: makeProfile(0.34, 0.34 + params.slope, 4.2, 1.75),
    };
    const mats = { tile: M.roofTile, gold: M.gold };
    const acc = new Acc();
    const tileDetail = { ...detail, gap: (v) => v / (detail.s * params.density) };
    buildTiles(acc, T, mats, rng('gallery-roof'), {}, tileDetail);
    buildXieshanRidges(acc, T, mats);
    acc.warp(makeWarp(T.ex, T.ez, params.up, params.out, 0.62, 2.2));
    return acc.build('roof');
  },
  ridgeOrn(params) {
    const acc = new Acc();
    const tile = acc.m(M.roofTile);
    const L = params.length;
    const path = [];
    for (let i = 0; i <= 24; i++) path.push([-L + (2 * L * i) / 24, 0, 0]);
    ridgeAlong(tile, path, params.width, params.layers, 0.105, 0.2, 0.55);
    for (const s of [-1, 1]) {
      const X = basis([s * (L + 0.02), -0.25, 0], [0, 0, -s], [0, 1, 0], [s, 0, 0]);
      chiwen(tile, null, X, params.beast * 1.55, params.beast * 2.05, 0.34);
    }
    return acc.build('ridge');
  },
  taihuPeak(params) {
    return buildTaihuPeak(ctx, {
      height: params.height,
      lean: params.lean,
      seed: Math.round(params.seed),
      hasPedestal: params.pedestal,
      gridStep: 0.1,
    });
  },
};

// --- gallery state ----------------------------------------------------------
const groupsEl = document.getElementById('groups');
const paramsEl = document.getElementById('params');
const titleEl = document.getElementById('title');
const badgeEl = document.getElementById('badge');
const noteEl = document.getElementById('note');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('save');
const resetBtn = document.getElementById('reset');
const msgEl = document.getElementById('stageMsg');

let current = null;      // item
let currentObj = null;   // THREE.Group
let params = {};
let rebuildTimer = 0;
let readyFlag = false;
let scheduled = false;
let interacting = false;
let selectAt = 0;
let inputAt = 0;
const stats = { frames: 0, renderMs: 0, rebuildMs: 0, selectToFrameMs: 0, inputToFrameMs: 0 };

// On-demand rendering: nothing is drawn while idle. Drag / select / param
// changes request exactly one frame.
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(renderFrame);
}

function renderFrame() {
  scheduled = false;
  renderer.shadowMap.needsUpdate = true;
  const t0 = performance.now();
  renderer.render(scene, camera);
  stats.renderMs = performance.now() - t0;
  stats.frames++;
  if (selectAt) { stats.selectToFrameMs = performance.now() - selectAt; selectAt = 0; }
  if (inputAt) { stats.inputToFrameMs = performance.now() - inputAt; inputAt = 0; }
  if (!readyFlag) { readyFlag = true; window.__GALLERY_API.ready = true; }
}

controls.addEventListener('start', () => { interacting = true; });
controls.addEventListener('end', () => { interacting = false; });
controls.addEventListener('change', () => {
  if (interacting && !inputAt) inputAt = performance.now();
  scheduleRender();
});

function showMsg(text) {
  if (!msgEl) return;
  msgEl.hidden = !text;
  msgEl.textContent = text || '';
}

function setStatus(s) { statusEl.textContent = s; }

function disposeObject(obj) {
  if (!obj) return;
  scene.remove(obj);
  obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

function placeAndFrame(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= box.min.y;
  obj.updateMatrixWorld(true);

  const b2 = new THREE.Box3().setFromObject(obj);
  const size = b2.getSize(new THREE.Vector3());
  const center = b2.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z, 0.5);
  const dir = new THREE.Vector3(1, 0.55, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, r * 2.15);
  controls.target.copy(center);
  camera.near = r * 0.01;
  camera.far = r * 40;
  camera.updateProjectionMatrix();
  controls.update();
}

function rebuild() {
  if (!current || !current.offline) return;
  const builder = BUILDERS[current.offline.builder];
  if (!builder) { setStatus('缺少 builder: ' + current.offline.builder); return; }
  disposeObject(currentObj);
  const t0 = performance.now();
  currentObj = builder(params);
  currentObj.name = 'gallery:' + current.id;
  scene.add(currentObj);
  placeAndFrame(currentObj);
  stats.rebuildMs = performance.now() - t0;
  setStatus(`${current.title} · ${stats.rebuildMs.toFixed(0)} ms`);
  scheduleRender();
}

function initParams() {
  params = {};
  if (!current || !current.offline) return;
  for (const p of current.offline.params || []) params[p.key] = p.value;
}

function renderParams() {
  paramsEl.innerHTML = '';
  if (!current || !current.offline) { saveBtn.disabled = true; return; }
  const schema = current.offline.params || [];

  for (const p of schema) {
    const cur = params[p.key] ?? p.value;
    const row = document.createElement('div');
    row.className = 'param';
    const label = document.createElement('label');
    label.innerHTML = `<span>${p.label}</span><b>${params[p.key]}</b>`;
    row.appendChild(label);

    if (p.kind === 'select') {
      const sel = document.createElement('select');
      for (const [v, text] of p.options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = text; if (v === cur) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { params[p.key] = sel.value; label.querySelector('b').textContent = sel.value; rebuild(); });
      row.appendChild(sel);
    } else if (p.kind === 'toggle') {
      const wrap = document.createElement('div');
      wrap.className = 'toggle';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = !!cur;
      input.addEventListener('change', () => { params[p.key] = input.checked; label.querySelector('b').textContent = input.checked ? '开' : '关'; rebuild(); });
      wrap.appendChild(input);
      const txt = document.createElement('span');
      txt.style.fontSize = '11px'; txt.style.color = '#8fa3a8';
      txt.textContent = cur ? '开' : '关';
      wrap.appendChild(txt);
      label.querySelector('b').textContent = cur ? '开' : '关';
      row.appendChild(wrap);
    } else {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = p.min; input.max = p.max; input.step = p.step; input.value = cur;
      input.addEventListener('input', () => {
        params[p.key] = +input.value;
        label.querySelector('b').textContent = (+input.value).toFixed(p.step < 1 ? 2 : 0);
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(rebuild, 120);
      });
      row.appendChild(input);
    }
    paramsEl.appendChild(row);
  }
  saveBtn.disabled = false;
}

function selectItem(id) {
  const found = findItem(id);
  if (!found) return null;
  const { item } = found;
  current = item;
  titleEl.textContent = item.title;
  badgeEl.textContent = item.status;
  noteEl.textContent = [item.note, item.offline && item.offline.degrade].filter(Boolean).join(' · ');
  initParams();
  renderParams();
  for (const b of groupsEl.querySelectorAll('.item')) b.classList.toggle('active', b.dataset.id === id);
  if (item.offline) {
    selectAt = performance.now();
    showMsg('');
    disposeObject(currentObj);
    currentObj = null;
    rebuild();
  } else {
    showMsg(`「${item.title}」本端尚未接入 · 下一批开放`);
    setStatus('本端未接入');
    saveBtn.disabled = true;
  }
  return id;
}

// --- sidebar ---------------------------------------------------------------
for (const g of GALLERY_GROUPS) {
  const wrap = document.createElement('div');
  wrap.className = 'group';
  const head = document.createElement('div');
  head.className = 'group-title';
  head.innerHTML = `<span>${g.title}</span><span>${g.subtitle || ''}</span>`;
  wrap.appendChild(head);

  const btn = document.createElement('button');
  btn.className = 'item' + (g.item.offline ? '' : ' pending');
  btn.dataset.id = g.item.id;
  btn.innerHTML = `<span>${g.item.title}</span><span class="status">${g.item.offline ? '已接入' : '待接入'}</span>`;
  btn.addEventListener('click', () => {
    if (!g.item.offline) {
      showMsg(`「${g.item.title}」本端尚未接入 · 下一批开放`);
      setStatus('待接入');
      return;
    }
    selectItem(g.item.id);
  });
  wrap.appendChild(btn);
  groupsEl.appendChild(wrap);
}

// --- save / view -----------------------------------------------------------
function snapshot(download = false) {
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  if (download) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `gallery-offline-${current ? current.id : 'item'}.png`;
    a.click();
  }
  setStatus('已存图');
  return url;
}

function orbitTo(azDeg, elDeg = 18, distMul = 1) {
  const target = controls.target;
  const r = camera.position.distanceTo(target) * distMul;
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  camera.position.set(
    target.x + r * Math.cos(el) * Math.sin(az),
    target.y + r * Math.sin(el),
    target.z + r * Math.cos(el) * Math.cos(az),
  );
  controls.update();
}

saveBtn.addEventListener('click', () => snapshot(true));
resetBtn.addEventListener('click', () => { if (currentObj) { placeAndFrame(currentObj); scheduleRender(); } });

// --- resize / loop ----------------------------------------------------------
function resize() {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  scheduleRender();
}
new ResizeObserver(resize).observe(stage);
resize();

// --- automation contract (used by tools/gallery-check) ---------------------
window.__GALLERY_API = {
  side: 'offline',
  ready: false,
  list: () => GALLERY_GROUPS.map((g) => ({
    id: g.item.id, group: g.title, item: g.item.title, status: g.item.status,
    available: !!g.item.offline,
  })),
  select: (id) => selectItem(id),
  setParams: (p) => { for (const [k, v] of Object.entries(p)) params[k] = v; rebuild(); renderParams(); return { ...params }; },
  rotate: (az, el, distMul) => { orbitTo(az ?? 35, el ?? 18, distMul ?? 1); return camera.position.toArray(); },
  snapshot: () => snapshot(),
  metrics: () => ({ ...stats }),
  state: () => ({
    current: current ? current.id : null,
    params: { ...params },
    camera: camera.position.toArray(),
    target: controls.target.toArray(),
  }),
};

selectItem(GALLERY_GROUPS.find((g) => g.item.offline).item.id);
