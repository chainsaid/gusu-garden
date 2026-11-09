/**
 * 美人靠（一段）· 新工程实物版出图与 GLB 导出
 *
 * 依据用户提供的实拍现场工程图与《营造法原》吴王靠（飞来椅）法式：
 *   1) 基台矮墙与坐面板：宽厚座板，前部留出 320mm 舒适坐人进深与 80mm 前挑滴水；
 *   2) 通透安装地脚：带法兰底座的独立支撑脚，底枋悬空 55mm，通透通光；
 *   3) 底枋：通长 45×40mm 横梁，水平基准安装在 seat 边缘；
 *   4) 鹅颈靠背弯条：反 S 形双曲曲线板条，实体厚度 26mm，腰部外挺达 119mm 舒适承托腰背，近顶自然收敛；
 *   5) 二道枋：通长 46×32mm 中横梁，整体向外悬挑 100mm；
 *   6) 上部透光天窗格：短立档顺坡斜接，与下方弯条逐根同轴对齐，形成上下呼应的双层节奏；
 *   7) 宽扶手顶枋（寻杖）：带圆角微拱面的 76×45mm（R14倒圆）宽面扶手，整体向外悬挑 140mm，形成经典临水后仰坐姿；
 *   8) 两端收口望柱：64×64mm 方形端柱顺应靠背斜度贯通锁定，带覆斗方帽。
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { findChrome, gpuArgs } from './lib/chrome.mjs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createMeikao, buildMeikaoLayout } from '../shared/meikao.js';

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
const OUT = path.join(ROOT, 'out/meikao');
const REF_PHOTO = path.join(OUT, 'meikao-ref.png');

const GLB = path.join(OUT, '美人靠_新工程实物版_1800mm_Yup_Zfront_mm.glb');
const PNG_CMP_PHOTO = path.join(OUT, '美人靠_新实物图_vs_新模型_对比.png');
const PNG_FRONT = path.join(OUT, '美人靠_新实物版_正视.png');
const PNG_OBLIQUE = path.join(OUT, '美人靠_新实物版_斜视.png');
const PNG_SIDE = path.join(OUT, '美人靠_新实物版_靠背侧轮廓.png');

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#f2f1ec}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
import { createMeikao, buildMeikaoLayout } from '/shared/meikao.js';

const BG = 0xf2f1ec;

function buildScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(BG);
  s.add(new THREE.HemisphereLight(0xffffff, 0xd7d2c8, 1.1));
  const key = new THREE.DirectionalLight(0xfffaf0, 1.6);
  key.position.set(-1800, 3200, 2400);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2400; key.shadow.camera.right = 2400;
  key.shadow.camera.top = 2400; key.shadow.camera.bottom = -2400;
  key.shadow.camera.near = 100; key.shadow.camera.far = 12000;
  key.shadow.normalBias = 5;
  key.shadow.bias = -0.0003;
  s.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(2200, 1000, 1200);
  s.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(600, 600, -2600);
  s.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(4200, 64),
    new THREE.MeshStandardMaterial({ color: 0xded9ce, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  s.add(ground);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(7000, 3000),
    new THREE.MeshBasicMaterial({ color: 0xe8e5d9 }),
  );
  backdrop.position.set(0, 1200, -820);
  backdrop.visible = false;
  s.add(backdrop);
  s.userData.backdrop = backdrop;

  return s;
}

function fitCamera(cam, dir, box, margin) {
  const target = box.getCenter(new THREE.Vector3());
  const pts = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  let d = 4000;
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

function caption(g, text, x, y, size, color) {
  g.font = 'bold ' + size + 'px "PingFang SC", sans-serif';
  g.fillStyle = color || '#2f2a24';
  g.textBaseline = 'top';
  g.fillText(text, x, y);
}
function note(g, text, x, y, size) {
  g.font = (size || 12) + 'px "PingFang SC", sans-serif';
  g.fillStyle = '#4c453b';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText(text, x, y);
}
function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

window.runAll = async (refs) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = buildScene();
  const backdrop = scene.userData.backdrop;
  let mounted = null;
  const shoot = (group, cam, W, H, shadow, withBg) => {
    if (mounted) scene.remove(mounted);
    mounted = group;
    backdrop.visible = !!withBg;
    scene.add(group);
    renderer.shadowMap.enabled = !!shadow;
    renderer.setSize(W, H, false);
    renderer.render(scene, cam);
    return renderer.domElement.toDataURL('image/png');
  };

  const model = createMeikao(THREE, {});
  const L = buildMeikaoLayout({});
  const p = L.params;
  const boxA = new THREE.Box3().setFromObject(model);
  const midY = (boxA.min.y + boxA.max.y) / 2;

  // 1) 正视：固定正交 0.6 px/mm
  const FW = 1240, FH = 760, SCALE = 0.6;
  const camF = new THREE.OrthographicCamera(-FW / SCALE / 2, FW / SCALE / 2,
    FH / SCALE / 2, -FH / SCALE / 2, 0.1, 16000);
  camF.position.set(0, midY, 4000);
  camF.lookAt(0, midY, 0);
  const frontURL = shoot(model, camF, FW, FH, false);
  const pyF = (y) => FH / 2 - (y - midY) * SCALE;

  // 2) 3/4 斜视：透视 30°，方位 34°，仰角 22°
  const OW = 1500, OH = 900;
  const camP = new THREE.PerspectiveCamera(30, OW / OH, 10, 60000);
  const az = 34 * Math.PI / 180, el = 22 * Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  const fit = fitCamera(camP, dir, boxA, 1.02);
  const oblURL = shoot(model, camP, OW, OH, true, false);

  // 3) 同实物照片机位近似：沿走廊外侧斜看，俯视带透视
  const LW = 900, LH = 900;
  const camQ = new THREE.PerspectiveCamera(38, LW / LH, 10, 60000);
  camQ.position.set(-p.length * 0.72, 1350, 850);
  camQ.lookAt(0, 680, -320);
  const likeURL = shoot(model, camQ, LW, LH, true, true);

  // ---- 图一：实拍工程图 vs 新模型（同视角对比）----
  const photo = await loadImg(refs.photo);
  const likeImg = await loadImg(likeURL);
  const PH = 620;
  const pwW = PH; // 原图 500x500 正方形
  const mW = PH;
  const c1 = document.createElement('canvas');
  c1.width = 40 + pwW + 50 + mW + 40;
  c1.height = 100 + PH + 180;
  const g1 = c1.getContext('2d');
  g1.fillStyle = '#f2f1ec'; g1.fillRect(0, 0, c1.width, c1.height);
  g1.drawImage(photo, 0, 0, photo.width, photo.height, 40, 100, pwW, PH);
  g1.drawImage(likeImg, 40 + pwW + 50, 100, mW, PH);
  g1.strokeStyle = 'rgba(60,50,38,.35)';
  g1.lineWidth = 1;
  g1.strokeRect(40, 100, pwW, PH);
  g1.strokeRect(40 + pwW + 50, 100, mW, PH);
  caption(g1, '实拍现场工程图（用户指定基准）', 40, 26, 20);
  caption(g1, '新参数化 3D 模型（按实图 1:1 悬挑重构）', 40 + pwW + 50, 26, 20);
  note(g1, '【关键形态核验】', 40, 100 + PH + 16, 13);
  note(g1, '① 整体外挑后倾：顶枋扶手整体向外悬挑 140mm，二道枋悬挑 100mm，完全符合《营造法原》与实拍形制。', 40, 100 + PH + 40, 12.5);
  note(g1, '② 鹅颈反 S 弯条：舒展双曲曲线，腰部外挺达 119mm（承托腰背），两端平滑咬合。实测实体厚度 26mm。', 40, 100 + PH + 64, 12.5);
  note(g1, '③ 上部天窗档：全长仅设 3 根主短立档（38×26×73mm），与下部 3 组地脚垂直同轴对位贯通，形成 4 组大跨度开阔通透天窗（下密上疏）。', 40, 100 + PH + 88, 12.5);
  note(g1, '④ 通透安装地脚：底枋通过 3 组带法兰盘立柱悬空架起 55mm，与上部短立档同轴传力，自流排水。', 40, 100 + PH + 112, 12.5);
  note(g1, '⑤ 舒适坐席深度：靠背立于台面后侧，台面前方留出 320mm 宽畅坐面与 80mm 前挑，真正兼顾可坐可倚。', 40, 100 + PH + 136, 12.5);

  // ---- 图二：正视（附标高量线）----
  const fA = await loadImg(frontURL);
  const c2 = document.createElement('canvas');
  c2.width = 40 + FW + 240;
  c2.height = 96 + FH + 160;
  const g2 = c2.getContext('2d');
  g2.fillStyle = '#f2f1ec'; g2.fillRect(0, 0, c2.width, c2.height);
  g2.fillStyle = '#fbfaf7'; g2.fillRect(40, 96, FW, FH);
  g2.drawImage(fA, 40, 96, FW, FH);
  caption(g2, '美人靠（新工程实物版）· 正视立面（0.6 px/mm）', 40, 24, 20);

  g2.strokeStyle = 'rgba(60,50,38,.30)';
  g2.lineWidth = 1;
  g2.setLineDash([7, 6]);
  const lines = [
    [+L.railTop.toFixed(0), '① 顶枋扶手顶 / 总高 ' + L.railTop.toFixed(0)],
    [+L.railBot.toFixed(0), '顶枋底 / 短档顶 ' + L.railBot.toFixed(0)],
    [+L.secTop.toFixed(0), '② 二道枋顶 / 短档底 ' + L.secTop.toFixed(0)],
    [+L.secBot.toFixed(0), '二道枋底 / 弯条顶 ' + L.secBot.toFixed(0)],
    [+L.baseRailTop.toFixed(0), '③ 底枋顶 / 弯条底 ' + L.baseRailTop.toFixed(0)],
    [+L.blockTop.toFixed(0), '底枋底 / 地脚架空顶 ' + L.blockTop.toFixed(0)],
    [+L.seatTop.toFixed(0), '④ 坐板台面 ' + L.seatTop.toFixed(0)],
    [0, '地面 0'],
  ];
  for (const [y] of lines) {
    g2.beginPath();
    g2.moveTo(30, 96 + pyF(y));
    g2.lineTo(40 + FW + 10, 96 + pyF(y));
    g2.stroke();
  }
  g2.setLineDash([]);
  g2.font = '11px "PingFang SC", sans-serif';
  g2.fillStyle = '#3b352d';
  for (const [y, label] of lines) {
    g2.fillText(label, 40 + FW + 18, 96 + pyF(y) + 4);
  }
  const specs = [
    '• 跨度与排布：总长 1800，两端望柱各 64，净跨 1672；下部 19 档鹅颈弯条密排托腰；上部设 3 根短立档大格开窗',
    '• 高度分层：座高 460；地脚悬空 55；底枋 40；弯条净高 335；二道枋 32；天窗短档 73；顶枋 45；总高 1040',
    '• 悬挑进深：顶枋寻杖向外悬挑 140mm；二道枋向外悬挑 100mm；弯条腰部向外突挺达 119mm 承托腰椎',
    '• 构件传力：3 组地脚立柱（高 55，底带 72×72×8 法兰盘）与上部 3 根短立档严格同轴对齐贯通传力',
  ];
  specs.forEach((t, i) => note(g2, t, 40, 96 + FH + 18 + i * 26, 12.5));

  // ---- 图三：3/4 斜视 ----
  const oA = await loadImg(oblURL);
  const c3 = document.createElement('canvas');
  c3.width = 40 + OW + 40;
  c3.height = 96 + OH + 130;
  const g3 = c3.getContext('2d');
  g3.fillStyle = '#f2f1ec'; g3.fillRect(0, 0, c3.width, c3.height);
  g3.drawImage(oA, 40, 96, OW, OH);
  caption(g3, '美人靠（新工程实物版）· 3/4 斜视（透视 30°，方位 34°，仰角 22°）', 40, 24, 20);
  note(g3, '立体特征直观展现：', 40, 96 + OH + 18, 13);
  note(g3, '• 整体向外悬挑：寻杖整体向外挑出 140mm，二道枋挑出 100mm，临水倚坐时上身舒适后仰；', 40, 96 + OH + 42, 12.5);
  note(g3, '• 反 S 形鹅颈弧度舒展流畅，腰部向外大幅度外挺（峰值 119mm），近顶自然内敛；', 40, 96 + OH + 66, 12.5);
  note(g3, '• 顶枋微拱宽大（76×45），手感舒适；上部仅 3 根短档通透大开窗，下密上疏，透光透景；', 40, 96 + OH + 90, 12.5);

  // ---- 图四：靠背侧面轮廓剖面图 (全景无截断 + 真实悬挑基准 + 实体双弧放样) ----
  const PW = 960, PHH = 1260;
  const c4 = document.createElement('canvas');
  c4.width = PW; c4.height = PHH;
  const g4 = c4.getContext('2d');
  g4.fillStyle = '#f4f3ee'; g4.fillRect(0, 0, PW, PHH);
  g4.fillStyle = '#ffffff'; g4.fillRect(40, 70, 880, 880);
  g4.strokeStyle = '#dcdcd5'; g4.lineWidth = 1; g4.strokeRect(40, 70, 880, 880);
  caption(g4, '靠背侧面截面轮廓与悬挑 S 曲线分析 (实物 1:1 结构)', 40, 24, 20);

  const S4 = 0.68;
  const X0 = 620; // footZ (-320) is placed at X=620
  const Y0 = 910; // Ground Y=0 is placed at Y=910
  const X = (z) => X0 + (z - L.footZ) * S4;
  const Y = (y) => Y0 - y * S4;
  const rectZ = (z0, z1, y0, y1, fill, stroke = '#2d2018') => {
    g4.fillStyle = fill;
    g4.fillRect(X(z0), Y(y1), (z1 - z0) * S4, (y1 - y0) * S4);
    if (stroke) {
      g4.strokeStyle = stroke;
      g4.lineWidth = 1.4;
      g4.strokeRect(X(z0), Y(y1), (z1 - z0) * S4, (y1 - y0) * S4);
    }
  };

  // 1. 坐凳基座矮墙与座板
  // 墙身: Z from -400 to -80, Y from 0 to 424
  rectZ(-400, -80, 0, L.seatTop - p.seatThk, '#e8e7e1', '#b8b7b0');
  // 坐面板: Z from -400 to 0 (前挑 80), Y from 424 to 460
  rectZ(-400, 0, L.seatTop - p.seatThk, L.seatTop, '#d5d4cd', '#686760');

  // 2. 地面线
  g4.strokeStyle = '#555'; g4.lineWidth = 2;
  g4.beginPath(); g4.moveTo(X(-540), Y(0)); g4.lineTo(X(80), Y(0)); g4.stroke();

  // 3. 安装地脚 (架空55mm，法兰盘固定于座面，中心在 footZ = -320)
  rectZ(L.footZ - p.footBaseW / 2, L.footZ + p.footBaseW / 2, L.seatTop, L.seatTop + p.footBaseH, '#222222');
  rectZ(L.footZ - p.footW / 2, L.footZ + p.footW / 2, L.seatTop, L.blockTop, '#333333');

  // 4. 底枋 (45宽 x 40高，水平放置在 footZ = -320)
  rectZ(L.footZ - p.baseRailD / 2, L.footZ + p.baseRailD / 2, L.blockTop, L.baseRailTop, '#4a3528');

  // 5. 实体厚度鹅颈反 S 弯条 (实测 26mm 实体厚度)
  const THICK = p.barT || 26;
  const ptsIn = [], ptsOut = [];
  const N = L.curvePts.length - 1;
  for (let i = 0; i <= N; i++) {
    const [cz, cy] = L.curvePts[i];
    const i1 = Math.max(0, i - 1), i2 = Math.min(N, i + 1);
    const dz = L.curvePts[i2][0] - L.curvePts[i1][0];
    const dy = L.curvePts[i2][1] - L.curvePts[i1][1];
    const len = Math.hypot(dz, dy) || 1;
    const nz = dy / len, ny = -dz / len;
    ptsIn.push([cz + (THICK / 2) * nz, cy + (THICK / 2) * ny]);
    ptsOut.push([cz - (THICK / 2) * nz, cy - (THICK / 2) * ny]);
  }

  g4.beginPath();
  g4.moveTo(X(ptsIn[0][0]), Y(L.baseRailTop - 6));
  ptsIn.forEach(([z, y]) => g4.lineTo(X(z), Y(y)));
  g4.lineTo(X(L.secZ + THICK / 2), Y(L.secBot + 6));
  g4.lineTo(X(L.secZ - THICK / 2), Y(L.secBot + 6));
  for (let i = N; i >= 0; i--) g4.lineTo(X(ptsOut[i][0]), Y(ptsOut[i][1]));
  g4.lineTo(X(ptsOut[0][0]), Y(L.baseRailTop - 6));
  g4.closePath();
  g4.fillStyle = '#5c4333';
  g4.fill();
  g4.strokeStyle = '#2d2018';
  g4.lineWidth = 1.5;
  g4.stroke();

  // 6. 二道枋 (46宽 x 32高，水平放置在 secZ = -420)
  rectZ(L.secZ - p.secondRailD / 2, L.secZ + p.secondRailD / 2, L.secBot, L.secTop, '#4a3528');

  // 7. 上部短立档 (26厚 x 73高，顺坡斜接二道枋与顶枋)
  const upPoly = [
    [L.secZ + p.slatT / 2, L.secTop],
    [L.railZ + p.slatT / 2, L.railBot],
    [L.railZ - p.slatT / 2, L.railBot],
    [L.secZ - p.slatT / 2, L.secTop],
  ];
  g4.beginPath();
  upPoly.forEach(([z, y], idx) => {
    if (idx === 0) g4.moveTo(X(z), Y(y));
    else g4.lineTo(X(z), Y(y));
  });
  g4.closePath();
  g4.fillStyle = '#5c4333';
  g4.fill();
  g4.strokeStyle = '#2d2018';
  g4.lineWidth = 1.4;
  g4.stroke();

  // 8. 顶枋宽扶手 (76宽 x 45高，圆角 R14，水平放置在 railZ = -460)
  const hW = p.topRailD * S4, hH = p.topRailH * S4, hR = 14 * S4;
  const hX = X(L.railZ) - hW / 2, hY = Y(L.railTop);
  g4.beginPath();
  g4.moveTo(hX, hY + hH);
  g4.lineTo(hX + hW, hY + hH);
  g4.lineTo(hX + hW, hY + hR);
  g4.quadraticCurveTo(hX + hW, hY, hX + hW - hR, hY);
  g4.lineTo(hX + hR, hY);
  g4.quadraticCurveTo(hX, hY, hX, hY + hR);
  g4.closePath();
  g4.fillStyle = '#4a3528';
  g4.fill();
  g4.strokeStyle = '#2d2018';
  g4.lineWidth = 1.6;
  g4.stroke();

  // 垂直基准中心轴线 (Z = L.footZ，贯穿全高)
  g4.setLineDash([5, 4]); g4.lineWidth = 1.2;
  g4.strokeStyle = '#0984e3';
  g4.beginPath(); g4.moveTo(X(L.footZ), Y(L.seatTop)); g4.lineTo(X(L.footZ), Y(L.railTop + 45)); g4.stroke();

  // 标注顶枋寻杖悬挑 140mm (红线)
  g4.strokeStyle = '#d63031'; g4.lineWidth = 2.0;
  g4.setLineDash([]);
  g4.beginPath(); g4.moveTo(X(L.footZ), Y(L.railTop + 25)); g4.lineTo(X(L.railZ), Y(L.railTop + 25)); g4.stroke();
  g4.fillStyle = '#d63031';
  g4.beginPath(); g4.arc(X(L.railZ), Y(L.railTop + 25), 3.5, 0, Math.PI * 2); g4.fill();
  g4.beginPath(); g4.arc(X(L.footZ), Y(L.railTop + 25), 3.5, 0, Math.PI * 2); g4.fill();

  // 标注二道枋悬挑 100mm (橙线)
  g4.strokeStyle = '#e67e22'; g4.lineWidth = 1.6;
  g4.beginPath(); g4.moveTo(X(L.footZ), Y(L.secTop + 14)); g4.lineTo(X(L.secZ), Y(L.secTop + 14)); g4.stroke();
  g4.fillStyle = '#e67e22';
  g4.beginPath(); g4.arc(X(L.secZ), Y(L.secTop + 14), 3, 0, Math.PI * 2); g4.fill();
  g4.beginPath(); g4.arc(X(L.footZ), Y(L.secTop + 14), 3, 0, Math.PI * 2); g4.fill();

  // 标注腰部最大外挺 119mm (紫线)
  const peakZ = L.footZ - L.bulgeMax;
  const peakY = L.barFoot + p.barH * L.bulgeAt;
  g4.strokeStyle = '#9b59b6'; g4.lineWidth = 1.5;
  g4.beginPath(); g4.moveTo(X(L.footZ), Y(peakY)); g4.lineTo(X(peakZ), Y(peakY)); g4.stroke();
  g4.fillStyle = '#9b59b6';
  g4.beginPath(); g4.arc(X(peakZ), Y(peakY), 3.5, 0, Math.PI * 2); g4.fill();

  // 引线标注
  const tag = (text, sx, sy, tx, ty, align) => {
    g4.strokeStyle = '#2d3436'; g4.lineWidth = 1.2;
    g4.beginPath(); g4.moveTo(sx, sy); g4.lineTo(tx, ty); g4.stroke();
    g4.fillStyle = '#2d3436';
    g4.beginPath(); g4.arc(sx, sy, 2.5, 0, Math.PI * 2); g4.fill();
    g4.font = 'bold 12.5px -apple-system, sans-serif';
    g4.textAlign = align || 'left';
    g4.textBaseline = 'middle';
    g4.fillText(text, tx + (align === 'right' ? -8 : 8), ty);
  };

  // 左侧标注 (悬挑与曲线)
  tag('顶枋寻杖外挑 140mm (76×45 R14倒圆)', X(L.railZ), Y(L.railTop + 25), 230, Y(L.railTop + 25), 'right');
  tag('二道中横枋外挑 100mm (46×32)', X(L.secZ), Y(L.secTop + 14), 230, Y(L.secTop + 14), 'right');
  tag('天窗短立档 (全长共3根，4大天窗格，与地脚对位)', X((L.secZ + L.railZ) / 2), Y((L.secTop + L.railBot) / 2), 230, Y((L.secTop + L.railBot) / 2), 'right');
  tag('腰部最大外挺 119mm (托腰人体工学)', X(peakZ), Y(peakY), 230, Y(peakY), 'right');
  tag('鹅颈反S实测实体厚度 26mm', X(peakZ + 13), Y(peakY + 50), 230, Y(peakY + 50), 'right');
  tag('底端垂直起笔入底枋卯槽', X(L.footZ - 20), Y(L.baseRailTop + 10), 230, Y(L.baseRailTop + 20), 'right');

  // 右侧标注 (基座与构件)
  tag('顶枋扶手中心线 (Z = -460)', X(L.railZ + p.topRailD / 2), Y(L.railC), 740, Y(L.railC) - 15, 'left');
  tag('铅垂安装基准中心线 (Z = -320)', X(L.footZ), Y(780), 740, Y(780), 'left');
  tag('底枋导梁 45×40 (锁定下端)', X(L.footZ + p.baseRailD / 2), Y((L.blockTop + L.baseRailTop) / 2), 740, Y((L.blockTop + L.baseRailTop) / 2), 'left');
  tag('架空地脚码 (悬空 55mm 自流排水)', X(L.footZ + p.footW / 2), Y((L.seatTop + L.blockTop) / 2), 740, Y((L.seatTop + L.blockTop) / 2) + 15, 'left');
  tag('舒适坐席净深 320mm (前挑 80mm)', X(-160), Y(L.seatTop), 740, Y(L.seatTop) + 20, 'left');

  // 下方说明文字
  const desc = [
    '【实物 1:1 悬挑靠背侧轮廓与构造特征】',
    '1. 整体向外悬挑倾斜架构：顶枋寻杖向外悬挑 140mm（Z = -460），二道中枋向外悬挑 100mm（Z = -420），符合苏式吴王靠倚坐后仰体态；',
    '2. 鹅颈反 S 双曲弧度：弯条在底枋垂直起笔（导数0），中部大幅度向外外挺拱出达 119mm（承托腰椎），近顶平滑内敛倾斜顺接二道枋；',
    '3. 实体双弧放样：弯条采用实落实心 26mm 截面实体放样，两端出浅榫分别咬合底枋顶槽与二道枋底槽，杜绝脱节断档；',
    '4. 下密上疏天窗：下部 19 根弯条密排托背；上部仅设 3 根短立档与地脚同轴贯通，形成 4 组大跨度开阔通透天窗，虚实分明。',
  ];
  desc.forEach((t, i) => note(g4, t, 45, 975 + i * 26, 12.5));

  window.__meta = {
    front: { pxPerMm: SCALE, centerY: +midY.toFixed(1) },
    oblique: { pos: camP.position.toArray().map((n) => +n.toFixed(1)), dist: +fit.d.toFixed(1) },
  };
  return {
    cmpPhoto: c1.toDataURL('image/png'),
    front: c2.toDataURL('image/png'),
    oblique: c3.toDataURL('image/png'),
    side: c4.toDataURL('image/png'),
  };
};
</script>`;

async function run() {
  const refs = {
    photo: 'data:image/png;base64,' + fs.readFileSync(REF_PHOTO).toString('base64'),
  };

  // 导 GLB
  const group = createMeikao(THREE, {});
  const exporter = new GLTFExporter();
  const glb = await new Promise((res, rej) => {
    exporter.parse(group, (buf) => res(buf), (err) => rej(err), { binary: true, onlyVisible: true });
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(GLB, Buffer.from(glb));

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    const file = path.join(ROOT, url);
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('no'); return; }
      const ext = path.extname(file);
      const ct = ext === '.js' || ext === '.mjs' ? 'text/javascript'
        : ext === '.png' ? 'image/png' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct });
      res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    args: [...gpuArgs(), '--no-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
  const shots = await page.evaluate((r) => window.runAll(r), refs);

  const write = (url, p) => fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
  write(shots.cmpPhoto, PNG_CMP_PHOTO);
  write(shots.front, PNG_FRONT);
  write(shots.oblique, PNG_OBLIQUE);
  write(shots.side, PNG_SIDE);

  const meta = await page.evaluate(() => window.__meta);
  const m = group.userData.meta;
  console.log(JSON.stringify({ size: m.size, section: m.section, tris: m.triangles, cam: meta }, null, 2));
  console.log('out GLB:', GLB, fs.statSync(GLB).size, 'bytes');
  for (const p of [PNG_CMP_PHOTO, PNG_FRONT, PNG_OBLIQUE, PNG_SIDE]) {
    console.log('out PNG:', p, fs.statSync(p).size, 'bytes');
  }
  if (logs.length) console.log(logs.join('\n'));

  await browser.close();
  server.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
