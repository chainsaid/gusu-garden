// ---------------------------------------------------------------------------
// Web asset gallery: isolates one node from the shipped GLB and shows it alone.
// Same catalog as the offline entry; the builder registry is the only
// side-specific part. New entry, does not touch the walkthrough scene.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GALLERY_GROUPS, findItem } from '../../../shared/data/gallery.js';
import { exportObject, measureGlb } from '../../../shared/gallery-export.js';

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
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141719);

const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.minDistance = 0.2;
controls.maxDistance = 80;

// neutral studio environment so the GLB PBR materials read correctly
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(6, 12, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x2a2620, 0.5));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.95, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- GLB -------------------------------------------------------------------
const draco = new DRACOLoader();
draco.setDecoderPath('/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

let template = null;
let templateError = null;

// --- UI refs ---------------------------------------------------------------
const groupsEl = document.getElementById('groups');
const paramsEl = document.getElementById('params');
const titleEl = document.getElementById('title');
const badgeEl = document.getElementById('badge');
const noteEl = document.getElementById('note');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('save');
const exportBtn = document.getElementById('export');
const exportInfo = document.getElementById('exportInfo');
const resetBtn = document.getElementById('reset');
const msgEl = document.getElementById('stageMsg');

let current = null;
let currentObj = null;
let params = {};
let readyFlag = false;
let pendingId = null;
let scheduled = false;
let interacting = false;
let selectAt = 0;
let inputAt = 0;
const stats = { frames: 0, renderMs: 0, buildMs: 0, selectToFrameMs: 0, inputToFrameMs: 0 };

// On-demand rendering: idle costs zero frames.
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

function disposeClones(obj) {
  if (!obj) return;
  scene.remove(obj);
  obj.traverse((o) => {
    if (o.isMesh) {
      const mm = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mm) if (m && m.isMaterial) m.dispose();
    }
  });
}

// GLTFLoader sanitizes node names (PropertyBinding strips ":" "." "[" "]" "/"),
// so the catalog keeps the authored name and we match on a normalized form.
function findNode(name) {
  const direct = template.getObjectByName(name);
  if (direct) return direct;
  const norm = name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  let hit = null;
  template.traverse((o) => {
    if (hit || !o.name) return;
    if (o.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase() === norm) hit = o;
  });
  return hit;
}

function isolate(node) {
  node.updateWorldMatrix(true, false);
  const clone = node.clone(true);
  clone.matrix.copy(node.matrixWorld);
  clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
  clone.matrixAutoUpdate = true;
  clone.traverse((o) => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      o.castShadow = true;
      o.receiveShadow = true;
      o.userData.basePos = null;
      o.userData.baseDir = null;
    }
  });
  return clone;
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

function applyExplode(obj, amount) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.basePos) {
      o.userData.basePos = o.position.clone();
      const wp = o.getWorldPosition(new THREE.Vector3());
      const dir = wp.sub(center);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      o.userData.baseDir = dir.normalize();
    }
    o.position.copy(o.userData.basePos).addScaledVector(o.userData.baseDir, amount * 0.4);
  });
}

function refit(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const dir = camera.position.clone().sub(controls.target).normalize();
  const r = Math.max(size.x, size.y, size.z, 0.5);
  controls.target.copy(c);
  camera.position.copy(c).addScaledVector(dir, r * 2.15);
  camera.near = r * 0.01;
  camera.far = r * 40;
  camera.updateProjectionMatrix();
}

function applyParams() {
  if (!current || !current.web || !currentObj) return;
  const schema = current.web.params || [];
  for (const p of schema) {
    if (p.key === 'explode') applyExplode(currentObj, params[p.key] || 0);
    else if (p.key === 'scale') {
      currentObj.scale.setScalar(params[p.key] || 1);
      currentObj.position.y = 0;
      currentObj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(currentObj);
      currentObj.position.y -= box.min.y;
      refit(currentObj);
    } else if (p.key === 'wireframe') {
      const on = !!params[p.key];
      currentObj.traverse((o) => {
        if (!o.isMesh) return;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mm) if (m) m.wireframe = on;
      });
    }
  }
  scheduleRender();
}

function initParams() {
  params = {};
  if (!current || !current.web) return;
  for (const p of current.web.params || []) params[p.key] = p.value;
}

function renderParams() {
  paramsEl.innerHTML = '';
  exportBtn.disabled = !(current && current.web && currentObj);
  if (!current || !current.web) { saveBtn.disabled = true; return; }
  const schema = current.web.params || [];

  for (const p of schema) {
    const cur = params[p.key] ?? p.value;
    const row = document.createElement('div');
    row.className = 'param';
    const label = document.createElement('label');
    const shown = p.kind === 'toggle' ? (cur ? '开' : '关') : cur;
    label.innerHTML = `<span>${p.label}</span><b>${shown}</b>`;
    row.appendChild(label);

    if (p.kind === 'toggle') {
      const wrap = document.createElement('div');
      wrap.className = 'toggle';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = !!cur;
      input.addEventListener('change', () => {
        params[p.key] = input.checked;
        label.querySelector('b').textContent = input.checked ? '开' : '关';
        applyParams();
      });
      wrap.appendChild(input);
      row.appendChild(wrap);
    } else if (p.kind === 'select') {
      const sel = document.createElement('select');
      for (const [v, text] of p.options) {
        const o = document.createElement('option');
        o.value = v; o.textContent = text; if (v === cur) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { params[p.key] = sel.value; applyParams(); });
      row.appendChild(sel);
    } else {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = p.min; input.max = p.max; input.step = p.step; input.value = cur;
      input.addEventListener('input', () => {
        params[p.key] = +input.value;
        label.querySelector('b').textContent = (+input.value).toFixed(p.step < 1 ? 2 : 0);
        applyParams();
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
  noteEl.textContent = item.note || '';
  initParams();
  renderParams();
  disposeClones(currentObj);
  currentObj = null;

  if (!item.web) {
    showMsg(item.webBlocked || `「${item.title}」本端尚未接入 · 下一批开放`);
    setStatus('本端未接入');
    saveBtn.disabled = true;
    exportBtn.disabled = true;
    exportInfo.hidden = true;
    return id;
  }
  if (!template) { pendingId = id; setStatus('GLB 加载中…'); return id; }

  const node = findNode(item.web.node);
  if (!node) {
    showMsg(`「${item.title}」GLB 中找不到节点 ${item.web.node}`);
    setStatus('节点缺失');
    saveBtn.disabled = true;
    exportBtn.disabled = true;
    return id;
  }
  showMsg('');
  selectAt = performance.now();
  const t0 = performance.now();
  currentObj = isolate(node);
  currentObj.name = 'gallery:' + item.id;
  scene.add(currentObj);
  placeAndFrame(currentObj);
  applyParams();
  stats.buildMs = performance.now() - t0;
  setStatus(`${item.title} · ${stats.buildMs.toFixed(0)} ms`);
  exportBtn.disabled = false;
  exportInfo.hidden = true;
  scheduleRender();
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
  btn.className = 'item' + (g.item.web ? '' : ' pending');
  btn.dataset.id = g.item.id;
  btn.innerHTML = `<span>${g.item.title}</span><span class="status">${g.item.web ? '已接入' : '待接入'}</span>`;
  btn.addEventListener('click', () => {
    if (!g.item.web) {
      showMsg(g.item.webBlocked || `「${g.item.title}」本端尚未接入 · 下一批开放`);
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
    a.download = `gallery-web-${current ? current.id : 'item'}.png`;
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

async function doExport() {
  if (!currentObj || !current || !current.web) {
    setStatus('当前构件不可导出');
    return null;
  }
  exportBtn.disabled = true;
  setStatus('导出中…');
  try {
    const res = await exportObject({
      object: currentObj,
      item: current,
      side: 'web',
      schema: current.web.params || [],
      params,
      degrade: '',
    });
    const mb = (res.bytes / 1048576).toFixed(1);
    exportInfo.hidden = false;
    exportInfo.innerHTML = `已导出：<a href="/__gallery/export?name=${encodeURIComponent(res.fileName + '.glb')}" target="_blank" rel="noopener">${res.modelPath}</a>（${mb} MB）<br>随附说明：<a href="/__gallery/export?name=${encodeURIComponent(res.fileName + '.md')}" target="_blank" rel="noopener">${res.specPath}</a>`;
    setStatus('已导出 GLB');
    return res;
  } catch (e) {
    setStatus(`导出失败：${e.message}`);
    throw e;
  } finally {
    exportBtn.disabled = false;
  }
}
exportBtn.addEventListener('click', () => { doExport().catch(() => {}); });

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

// --- automation contract ---------------------------------------------------
window.__GALLERY_API = {
  side: 'web',
  ready: false,
  list: () => GALLERY_GROUPS.map((g) => ({
    id: g.item.id, group: g.title, item: g.item.title, status: g.item.status,
    available: !!g.item.web,
  })),
  select: (id) => selectItem(id),
  setParams: (p) => { for (const [k, v] of Object.entries(p)) params[k] = v; applyParams(); renderParams(); return { ...params }; },
  rotate: (az, el, distMul) => { orbitTo(az ?? 35, el ?? 18, distMul ?? 1); return camera.position.toArray(); },
  snapshot: () => snapshot(),
  export: () => doExport(),
  verifyExport: (url) => measureGlb(url),
  bbox: () => {
    if (!currentObj) return null;
    const box = new THREE.Box3().setFromObject(currentObj, true);
    const s = box.getSize(new THREE.Vector3());
    return { size: s.toArray(), min: box.min.toArray(), max: box.max.toArray() };
  },
  metrics: () => ({ ...stats }),
  state: () => ({
    current: current ? current.id : null,
    params: { ...params },
    camera: camera.position.toArray(),
    target: controls.target.toArray(),
  }),
  error: () => templateError,
};

gltfLoader.load('/assets/gusu-garden-core.glb', (gltf) => {
  template = gltf.scene;
  setStatus('GLB 已就绪');
  const first = GALLERY_GROUPS.find((g) => g.item.web);
  const id = pendingId || (first && first.item.id);
  pendingId = null;
  if (id) selectItem(id);
  scheduleRender();
}, undefined, (err) => {
  templateError = String(err && err.message ? err.message : err);
  setStatus('GLB 加载失败: ' + templateError);
  showMsg('GLB 加载失败：' + templateError);
  scheduleRender();
});
