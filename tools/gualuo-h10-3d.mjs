/**
 * H10 挂落 → 真实三维网格（GLB）+ 正交正视 / 3/4 透视两张 three 渲染图。
 *
 * 用 shared/gualuo-h10.js（独立模块）建实体，GLTFExporter 导 GLB，
 * 再把同一份模块放进项目已有的 headless Chrome 路径里用 three 渲染，
 * 保证导出与出图用的是同一套几何。
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { findChrome, gpuArgs } from './lib/chrome.mjs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createGualuo, buildLayout } from '../shared/gualuo-h10.js';

// GLTFExporter 在 Node 里只用 FileReader 读 Blob，这里补十行，不引依赖
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => { this.result = buf; this.onloadend && this.onloadend(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend && this.onloadend();
    });
  }
};

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'out/gualuo/H10');
const GLB = path.join(OUT, 'H10_挂落_3300x527.6mm_Yup_Zfront.glb');
const PNG_ORTHO = path.join(OUT, 'H10_三维_正交正视.png');
const PNG_PERSP = path.join(OUT, 'H10_三维_透视34.png');

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#efeeea}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
import { createGualuo } from '/shared/gualuo-h10.js';

function buildScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0xefeeea);
  s.add(new THREE.HemisphereLight(0xffffff, 0xd9d5cc, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-1500, 2100, 2600);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2400; key.shadow.camera.right = 2400;
  key.shadow.camera.top = 1200; key.shadow.camera.bottom = -1200;
  key.shadow.camera.near = 200; key.shadow.camera.far = 9000;
  key.shadow.normalBias = 6;
  s.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(1700, 500, 1200);
  s.add(fill);
  const group = createGualuo(THREE);
  s.add(group);
  return { scene: s, group };
}

// 沿给定方向把相机推到刚好装下包围盒的位置；透视下近大远小，八角的投影框不居中，
// 所以同时按投影框中心平移视轴，最后让内容在画面里左右/上下对称（取景用，不改几何）
function fitCamera(cam, dir, box, margin) {
  const target = box.getCenter(new THREE.Vector3());
  const pts = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  let d = 3000;
  for (let k = 0; k < 10; k++) {
    cam.position.copy(target).addScaledVector(dir, d);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const p of pts) {
      const q = p.clone().project(cam);
      minx = Math.min(minx, q.x); maxx = Math.max(maxx, q.x);
      miny = Math.min(miny, q.y); maxy = Math.max(maxy, q.y);
    }
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const m = cam.matrixWorld.elements;
    right.set(m[0], m[1], m[2]).normalize();
    up.set(m[4], m[5], m[6]).normalize();
    const halfH = d * Math.tan(cam.fov * Math.PI / 360);
    target.addScaledVector(right, cx * halfH * cam.aspect).addScaledVector(up, cy * halfH);
    d *= Math.max((maxx - minx) / 2, (maxy - miny) / 2) * margin;
  }
  cam.position.copy(target).addScaledVector(dir, d);
  cam.lookAt(target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return { d, target };
}

async function run() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const { scene: s, group } = buildScene();
  const box = new THREE.Box3().setFromObject(group);

  // 正交正视图：0.62 px/mm，与二维白模同一比例；无透视、无投影
  const W = 2200, H = 360, SCALE = 0.62;
  const camO = new THREE.OrthographicCamera(-W / SCALE / 2, W / SCALE / 2, H / SCALE / 2, -H / SCALE / 2, 0.1, 8000);
  camO.position.set(0, 0, 1500);
  camO.lookAt(0, 0, 0);
  renderer.shadowMap.enabled = false;
  renderer.setSize(W, H, false);
  renderer.render(s, camO);
  const ortho = renderer.domElement.toDataURL('image/png');

  // 3/4 透视图：方位角 30°、仰角 26°、fov 30；开柔影看厚度
  const W2 = 1600, H2 = 560;
  const camP = new THREE.PerspectiveCamera(30, W2 / H2, 10, 30000);
  const dir = new THREE.Vector3(Math.sin(30 * Math.PI / 180) * Math.cos(26 * Math.PI / 180),
                                 Math.sin(26 * Math.PI / 180),
                                 Math.cos(30 * Math.PI / 180) * Math.cos(26 * Math.PI / 180)).normalize();
  const dist = fitCamera(camP, dir, box, 1.07);
  renderer.shadowMap.enabled = true;
  renderer.setSize(W2, H2, false);
  renderer.render(s, camP);
  const persp = renderer.domElement.toDataURL('image/png');

  window.__meta = { dist: dist.d, target: dist.target.toArray().map((n) => +n.toFixed(1)), pos: camP.position.toArray().map((n) => +n.toFixed(1)) };
  window.__result = { ortho, persp };
}

run().then(() => { window.__done = true; })
   .catch((e) => { window.__error = String((e && e.stack) || e); window.__done = true; });
</script>`;

function serve() {
  const local = (p) => {
    const abs = path.resolve(ROOT, '.' + p);
    if (!abs.startsWith(path.join(ROOT, 'node_modules/three/')) && abs !== path.join(ROOT, 'shared/gualuo-h10.js')) return null;
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  };
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/view.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(PAGE);
      return;
    }
    const body = local(url);
    if (body == null) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(body);
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // --- 建实体 + 自检 --------------------------------------------------
  const group = createGualuo(THREE, {});
  const meta = group.userData.meta;
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  let tris = 0, vol = 0;
  for (const m of group.children) {
    const p = m.geometry.getAttribute('position').array;
    tris += p.length / 9;
    for (let i = 0; i < p.length; i += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.slice(i, i + 9);
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
  }
  const layout = buildLayout({});
  console.log('members:', meta.members, '| 展开矩形数（含镜像/交叉口）:', layout.members.length, '| triangles:', tris);
  console.log('bbox mm:', [size.x, size.y, size.z].map((n) => +n.toFixed(2)).join(' × '),
    ' center:', [center.x, center.y, center.z].map((n) => +n.toFixed(2)).join(', '));
  console.log('signed volume mm³:', Math.round(vol), '(正值 = 面朝向朝外、闭合实体)');

  // --- GLB ------------------------------------------------------------
  const exporter = new GLTFExporter();
  const glb = await new Promise((res, rej) => exporter.parse(group, res, rej, { binary: true, onlyVisible: true }));
  fs.writeFileSync(GLB, Buffer.from(glb));
  console.log('wrote', path.relative(ROOT, GLB), (glb.byteLength / 1024).toFixed(1) + ' KB');

  // --- 出图 ------------------------------------------------------------
  const srv = await serve();
  const port = srv.address().port;
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: gpuArgs() });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    page.on('console', (m) => console.log('[page]', m.type(), m.text()));
    page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure() && r.failure().errorText));
    await page.setViewport({ width: 2200, height: 720, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/view.html`, { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 45000, polling: 300 });
    const err = await page.evaluate(() => window.__error || null);
    if (err) throw new Error(err);
    const r = await page.evaluate(() => window.__result);
    const pm = await page.evaluate(() => window.__meta);
    for (const [file, url] of [[PNG_ORTHO, r.ortho], [PNG_PERSP, r.persp]]) {
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log('wrote', path.relative(ROOT, file));
    }
    console.log('camera ortho: OrthographicCamera, frustum',
      (2200 / 0.62).toFixed(0), '×', (360 / 0.62).toFixed(0), 'mm, at (0,0,1500) looking −Z, 0.62 px/mm');
    console.log('camera persp: PerspectiveCamera fov 30, azimuth 30° elevation 26°, distance',
      pm.dist.toFixed(0), 'mm, position', pm.pos.join(', '), '| lookAt', pm.target.join(', '));
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
