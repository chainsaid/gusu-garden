/**
 * 月到风来亭 → GLB + 正立面 / 3/4 斜视两张验证图。
 *
 * 用 shared/yuedao-fenglai.js（独立模块）建实体，GLTFExporter 导 GLB，
 * 再用同一份模块在 headless Chrome 里渲染，保证导出和出图是同一套几何。
 * 不碰场景默认渲染路径，不引用挂落或檐口的代码。
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { findChrome, gpuArgs } from './lib/chrome.mjs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createPavilion, buildPavilionLayout } from '../shared/yuedao-fenglai.js';

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
const OUT = path.join(ROOT, 'out/yuedao-fenglai');
const GLB = path.join(OUT, '月到风来亭_六角攒尖_三面美人靠_Yup_Zfront_mm.glb');
const PNG_FRONT = path.join(OUT, '月到风来亭_正立面.png');
const PNG_OBLIQUE = path.join(OUT, '月到风来亭_斜视.png');

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#f2f1ec}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
import { createPavilion } from '/shared/yuedao-fenglai.js';

function buildScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0xf2f1ec);
  s.add(new THREE.HemisphereLight(0xffffff, 0xd7d2c8, 1.0));
  const key = new THREE.DirectionalLight(0xfffaf2, 1.55);
  key.position.set(-3200, 6200, 4600);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7200; key.shadow.camera.right = 7200;
  key.shadow.camera.top = 7200; key.shadow.camera.bottom = -7200;
  key.shadow.camera.near = 100; key.shadow.camera.far = 22000;
  key.shadow.normalBias = 12;
  key.shadow.bias = -0.0003;
  s.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.42);
  fill.position.set(4200, 1600, 2200);
  s.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.22);
  rim.position.set(1200, 900, -5000);
  s.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(11000, 64),
    new THREE.MeshStandardMaterial({ color: 0xd6d1c6, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  s.add(ground);

  const group = createPavilion(THREE, {});
  s.add(group);
  return { scene: s, group };
}

function fitCamera(cam, dir, box, margin) {
  const target = box.getCenter(new THREE.Vector3());
  const pts = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  let d = 5000;
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

  // 正立面：正交，0.22 px/mm，无投影
  const W = 1600, H = 1600, SCALE = 0.22;
  const camO = new THREE.OrthographicCamera(-W / SCALE / 2, W / SCALE / 2,
    H / SCALE / 2, -H / SCALE / 2, 0.1, 30000);
  camO.position.set(0, 2900, 6000);
  camO.lookAt(0, 2900, 0);
  renderer.shadowMap.enabled = false;
  renderer.setSize(W, H, false);
  renderer.render(s, camO);
  const front = renderer.domElement.toDataURL('image/png');

  // 3/4 斜视：方位角 34°、仰角 22°、fov 30，带投影
  const W2 = 1600, H2 = 1200;
  const camP = new THREE.PerspectiveCamera(30, W2 / H2, 10, 40000);
  const dir = new THREE.Vector3(
    Math.sin(34 * Math.PI / 180) * Math.cos(22 * Math.PI / 180),
    Math.sin(22 * Math.PI / 180),
    Math.cos(34 * Math.PI / 180) * Math.cos(22 * Math.PI / 180)).normalize();
  const dist = fitCamera(camP, dir, box, 0.94);
  renderer.shadowMap.enabled = true;
  renderer.setSize(W2, H2, false);
  renderer.render(s, camP);
  const oblique = renderer.domElement.toDataURL('image/png');

  window.__meta = {
    dist: dist.d,
    target: dist.target.toArray().map((n) => +n.toFixed(1)),
    pos: camP.position.toArray().map((n) => +n.toFixed(1)),
    triangles: group.userData.meta.triangles,
    size: group.userData.meta.size,
  };
  window.__result = { front, oblique };
}

run().then(() => { window.__done = true; })
  .catch((e) => { window.__error = String((e && e.stack) || e); window.__done = true; });
</script>`;

function serve() {
  const local = (p) => {
    const abs = path.resolve(ROOT, '.' + p);
    const isThree = abs.startsWith(path.join(ROOT, 'node_modules/three/'));
    const isModule = abs === path.join(ROOT, 'shared/yuedao-fenglai.js');
    if (!isThree && !isModule) return null;
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

  const group = createPavilion(THREE, {});
  const meta = group.userData.meta;
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  console.log('triangles:', meta.triangles, '| bbox mm:',
    [size.x, size.y, size.z].map((n) => +n.toFixed(1)).join(' × '));
  console.log('meta.size:', JSON.stringify(meta.size));
  console.log('assumed:', meta.assumed);
  console.log('layout check:', JSON.stringify({
    bay: buildPavilionLayout({}).params.bay,
    clear: buildPavilionLayout({}).clear,
    heights: buildPavilionLayout({}).heights,
  }));

  const exporter = new GLTFExporter();
  const glb = await new Promise((res, rej) => exporter.parse(group, res, rej, { binary: true, onlyVisible: true }));
  fs.writeFileSync(GLB, Buffer.from(glb));
  console.log('wrote', path.relative(ROOT, GLB), (glb.byteLength / 1024).toFixed(1) + ' KB');

  const srv = await serve();
  const port = srv.address().port;
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: gpuArgs() });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    page.on('console', (m) => console.log('[page]', m.type(), m.text()));
    page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure() && r.failure().errorText));
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/view.html`, { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 60000, polling: 300 });
    const err = await page.evaluate(() => window.__error || null);
    if (err) throw new Error(err);
    const r = await page.evaluate(() => window.__result);
    const pm = await page.evaluate(() => window.__meta);
    for (const [file, url] of [[PNG_FRONT, r.front], [PNG_OBLIQUE, r.oblique]]) {
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log('wrote', path.relative(ROOT, file));
    }
    console.log('camera front: ortho', (1600 / 0.22).toFixed(0), '×', (1600 / 0.22).toFixed(0), 'mm @ 0.22 px/mm');
    console.log('camera oblique: fov 30, azimuth 34°, elevation 22°, distance',
      pm.dist.toFixed(0), '| pos', pm.pos.join(', '), '| target', pm.target.join(', '));
    console.log('render triangles:', pm.triangles);
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
