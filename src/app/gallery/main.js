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
import { genMaple, BarkAccum, trunkDisp } from '../../world/vegetation-tree.js';
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
let waterNrmTex = null;
function waterNormalMap() {
  if (waterNrmTex) return waterNrmTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g2 = c.getContext('2d');
  const img = g2.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S * Math.PI * 2;
      const v = y / S * Math.PI * 2;
      const dx = Math.sin(u * 5 + Math.sin(v * 3) * 1.6) * 0.5 + Math.sin(u * 11 + v * 4) * 0.25;
      const dy = Math.sin(v * 6 + Math.sin(u * 4) * 1.6) * 0.5 + Math.sin(v * 13 + u * 3) * 0.25;
      const i = (y * S + x) * 4;
      img.data[i] = 128 + dx * 90;
      img.data[i + 1] = 128 + dy * 90;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  g2.putImageData(img, 0, 0);
  waterNrmTex = new THREE.CanvasTexture(c);
  waterNrmTex.colorSpace = THREE.NoColorSpace;
  waterNrmTex.wrapS = waterNrmTex.wrapT = THREE.RepeatWrapping;
  waterNrmTex.repeat.set(3, 2.5);
  return waterNrmTex;
}

let waterEnvTex = null;
function waterEnvMap() {
  // Cheap procedural sky baked once through PMREM, so the water plane has
  // something to reflect without pulling in the film's reflection pass.
  if (waterEnvTex) return waterEnvTex;
  const W = 256, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g2 = c.getContext('2d');
  const grd = g2.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#93aec4');
  grd.addColorStop(0.45, '#c3cfd6');
  grd.addColorStop(0.52, '#3a3f36');
  grd.addColorStop(1, '#1b1d1b');
  g2.fillStyle = grd;
  g2.fillRect(0, 0, W, H);
  const sun = g2.createRadialGradient(W * 0.72, H * 0.34, 0, W * 0.72, H * 0.34, 36);
  sun.addColorStop(0, 'rgba(255,242,214,1)');
  sun.addColorStop(1, 'rgba(255,242,214,0)');
  g2.fillStyle = sun;
  g2.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  waterEnvTex = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return waterEnvTex;
}

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
      // Beast silhouette plane contains the ridge axis (ax along X, depth along Z),
      // so the 3/4 gallery view sees the profile, not a thin plate edge.
      const X = basis([s * (L + 0.02), -0.25, 0], [s, 0, 0], [0, 1, 0], [0, 0, 1]);
      chiwen(tile, null, X, params.beast * 1.55, params.beast * 2.05, 0.34);
    }
    return acc.build('ridge');
  },
  treeMaple(params) {
    const r = rng('gallery-maple');
    const tree = genMaple(r, {
      h: params.height,
      base: new THREE.Vector3(0, 0, 0),
      lean: new THREE.Vector3(0.15, 0, 0.1),
      spread: params.spread,
      leaders: params.leaders,
      detail: 1,
    }, detail);
    const acc = new BarkAccum();
    tree.branches.forEach((b, i) => {
      if (b.rads[0] < 0.002) return;
      acc.addBranch(b, {
        flexOf: () => 0,
        seed: 1 + ((i * 13 + 7) % 89),
        cellW: 0.06,
        disp: b.level === 0 ? trunkDisp({ seed: 5, bump: 0.05, flare: 0.35, roots: 5, flareH: 0.45, flute: 0.05, fluteN: 4 }) : null,
        radial: (rad) => (rad < 0.006 ? 3 : rad < 0.014 ? 4 : Math.round(4 + rad * 48)),
      });
    });
    const group = new THREE.Group();
    const bark = new THREE.Mesh(
      acc.toGeometry(),
      new THREE.MeshStandardMaterial({ color: 0x4a3126, roughness: 0.94, metalness: 0.0 }),
    );
    bark.castShadow = true;
    bark.receiveShadow = true;
    group.add(bark);

    // Degraded foliage: instanced blobs at twig tips (the film uses leaf cards).
    const tips = [];
    for (const b of tree.branches) {
      if (b.level < 3 || b.rads[0] > 0.02) continue;
      const n = b.pts.length;
      tips.push(b.pts[n - 1]);
      if (n > 3) tips.push(b.pts[Math.max(1, Math.round(n * 0.62))]);
    }
    const stride = Math.max(1, Math.floor(tips.length / 1600));
    const pts = tips.filter((_, i) => i % stride === 0);
    const leafGeo = new THREE.IcosahedronGeometry(0.105, 1);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.0 });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, Math.max(1, pts.length));
    const green = new THREE.Color(0x50702f);
    const red = new THREE.Color(0xb35a26);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s3 = new THREE.Vector3();
    const col = new THREE.Color();
    pts.forEach((p, i) => {
      q.setFromEuler(new THREE.Euler(r.range(0, 6.28), r.range(0, 6.28), r.range(0, 6.28)));
      const s = r.range(0.78, 1.3);
      s3.set(s, s * 1.25, s);
      m4.compose(p, q, s3);
      leaves.setMatrixAt(i, m4);
      col.copy(green).lerp(red, Math.min(1, Math.max(0, params.autumn * 0.9 + r.range(-0.1, 0.1))));
      col.multiplyScalar(r.range(0.85, 1.12));
      leaves.setColorAt(i, col);
    });
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    leaves.castShadow = true;
    group.add(leaves);
    return group;
  },
  waterPlane(params) {
    // A single flat basin: material demo only, no pond walls or terrain.
    const tints = { jade: 0x2f5b52, ink: 0x1c302e, celadon: 0x4c7d72 };
    const mat = new THREE.MeshStandardMaterial({
      color: tints[params.tint] ?? tints.jade,
      roughness: params.roughness,
      metalness: 0.18,
      envMap: waterEnvMap(),
      envMapIntensity: 1.15,
      normalMap: waterNormalMap(),
      normalScale: new THREE.Vector2(params.ripple, params.ripple),
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 6, 1, 1), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    const g = new THREE.Group();
    g.add(plane);
    return g;
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
  if (!readyFlag) {
    readyFlag = true;
    window.__GALLERY_API.ready = true;
    // Bake the (cheap) reflection probe in idle time, so first click on water is fast.
    setTimeout(() => waterEnvMap(), 0);
  }
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
