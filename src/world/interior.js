// ---------------------------------------------------------------------------
// INTERIOR — the scholar's hall (中堂) of the main hall.
// A landscape scroll with black-lacquer couplets, a rosewood altar table,
// 八仙桌 and 官帽椅, a luohan bed, a curio shelf and a guqin set, lattice
// long-windows over 明瓦, 卷棚轩 canopies over an open middle, incense
// smoke and dust.
// Everything inside x in [cx-12.5, cx+12.5], z in [cz-8, cz+8], y in [2.12, 9.2].
// ---------------------------------------------------------------------------
import { makeInteriorMaterials, boxProject } from './interior-mats.js';
import { petalGeo, latheGeo, ringGeo, rbox, merge, extrude, flameShape } from './interior-geo.js';
import * as THREE from 'three';
import {
  buildFrontTable, buildFloorLantern, buildCandlestick, flameGeo,
  buildIncenseBurner, buildFlowerVase, flowerHeadGeo, leafGeo, buildFruitStand, addTassel,
} from './interior-altar.js';
import { makeStrandKit, flushStrands, buildPendantLantern } from './interior-hang.js';
import { buildColumns, buildBeams, buildCeiling, buildBackScreen, buildSideScreen } from './interior-arch.js';
import { buildShafts, buildDust, buildSmoke } from './interior-fx.js';
import {
  createZhongtangTexture, createCoupletTexture,
  buildAltarTable, buildArmchair, buildSquareTable,
  buildLuohanBed, buildCurioShelf, buildGuqinSet,
} from './interior-scholar.js';

export async function build(ctx) {
  const { THREE, L, geom } = ctx;
  const t0 = performance.now();
  const M = makeInteriorMaterials(ctx);
  const root = new THREE.Group();
  root.name = 'interior';
  const [cx, , cz] = L.hall.center;
  const Y0 = 2.12;
  const S = {
    cx, cz, Y0,
    zB: cz - 5.4,          // main Buddha axis (z)
    daisH: 0.62,
    pedH: 1.12,            // octagonal pedestal (below the lotus)
    lotusH: 0.65,
    beamY: 7.7,            // column tops
    ceilY: 8.95,           // coffered ceiling panel plane
  };
  S.yThrone = Y0 + S.daisH;
  S.ySeat = S.yThrone + S.pedH + S.lotusH;
  S.probe = [cx, 4.6, cz - 0.5];
  // parallax-corrected reflections on the polished floor and lacquer
  const bpBox = { min: [cx - 12.5, Y0 - 0.05, cz - 8.0], max: [cx + 12.5, 9.2, cz + 8.0], probe: S.probe };
  boxProject(THREE, M.woodFloor, bpBox);
  boxProject(THREE, M.black, bpBox);
  const B = new geom.Builder();
  const K = makeStrandKit();
  const rnd = ctx.rng('interior').next;
  const flames = [], embers = [], lights = [];
  const inst = { flowers: [], leaves: [] };

  // ---------------------------------------------------------------- floor + dais
  // ---------------------------------------------------------------- floor
  buildFloor(ctx, B, M, S);

  // ---------------------------------------------------------------- 中堂格局 (Central Reception)
  const woodMat = M.woodNanmu || M.woodFloor;

  // 1. Central Ink Landscape Hanging Scroll (水墨中堂大轴)
  const scrollTex = createZhongtangTexture();
  const scrollMat = new THREE.MeshStandardMaterial({ map: scrollTex, roughness: 0.88, metalness: 0 });
  const scrollMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 0.02), scrollMat);
  scrollMesh.position.set(cx, Y0 + 3.1, cz - 7.82);
  scrollMesh.castShadow = true; scrollMesh.receiveShadow = true;
  root.add(scrollMesh);

  // Wooden scroll rollers (轴头)
  B.add(rbox(2.3, 0.05, 0.05, 0.01, 2), M.black, geom.mat4([cx, Y0 + 3.1 - 1.6, cz - 7.80]));
  B.add(rbox(2.2, 0.04, 0.04, 0.01, 2), M.black, geom.mat4([cx, Y0 + 3.1 + 1.6, cz - 7.80]));

  // 2. Black Lacquered Couplets (黑漆金字对联)
  const rightCoupletTex = createCoupletTexture('清风明月本无价');
  const leftCoupletTex = createCoupletTexture('近水远山皆有情');
  const rightCoupletMat = new THREE.MeshStandardMaterial({ map: rightCoupletTex, roughness: 0.45, metalness: 0.1 });
  const leftCoupletMat = new THREE.MeshStandardMaterial({ map: leftCoupletTex, roughness: 0.45, metalness: 0.1 });
  const coupletGeo = new THREE.BoxGeometry(0.42, 2.6, 0.02);
  const rightCouplet = new THREE.Mesh(coupletGeo, rightCoupletMat);
  rightCouplet.position.set(cx + 1.65, Y0 + 3.0, cz - 7.82);
  const leftCouplet = new THREE.Mesh(coupletGeo, leftCoupletMat);
  leftCouplet.position.set(cx - 1.65, Y0 + 3.0, cz - 7.82);
  root.add(rightCouplet, leftCouplet);

  // 3. Long Altar Table (红木翘头条案)
  buildAltarTable(B, woodMat, { x: cx, y: Y0, z: cz - 6.8, w: 4.6, d: 0.68, h: 0.98 });
  const smokeSrc = buildIncenseBurner(B, M, { x: cx, y: Y0 + 0.98, z: cz - 6.8, s: 0.55 }, embers);
  const smokeSrc2 = [cx, Y0 + 1.25, cz - 6.8];
  buildFlowerVase(B, M, { x: cx - 1.5, y: Y0 + 0.98, z: cz - 6.8, s: 0.75, h: 0.8, spread: 0.32, n: 24, pink: 0.35 }, rnd, inst);
  buildFruitStand(B, M, { x: cx + 1.5, y: Y0 + 0.98, z: cz - 6.8 });

  // 4. Eight Immortals Square Table & Master Armchairs (八仙桌与太师椅)
  buildSquareTable(B, woodMat, { x: cx, y: Y0, z: cz - 4.5, size: 1.15, h: 0.88 });
  buildArmchair(B, woodMat, { x: cx - 1.15, y: Y0, z: cz - 4.5, ry: Math.PI / 2, scale: 1.05 });
  buildArmchair(B, woodMat, { x: cx + 1.15, y: Y0, z: cz - 4.5, ry: -Math.PI / 2, scale: 1.05 });
  buildArmchair(B, woodMat, { x: cx - 1.6, y: Y0, z: cz - 2.8, ry: 0, scale: 1.0 });
  buildArmchair(B, woodMat, { x: cx + 1.6, y: Y0, z: cz - 2.8, ry: 0, scale: 1.0 });

  // 5. East Alcove: Guqin Desk & Seven-String Zither (琴台雅集)
  buildGuqinSet(B, woodMat, M.black, { x: cx + 5.5, y: Y0, z: cz - 4.2, ry: Math.PI / 2 });

  // 6. West Alcove: Luohan Daybed & Curio Bookcases (罗汉床与博古架)
  buildLuohanBed(B, woodMat, { x: cx - 5.5, y: Y0, z: cz - 4.0, w: 2.2, d: 1.3, h: 0.52 });
  buildCurioShelf(B, woodMat, { x: cx - 7.5, y: Y0, z: cz - 6.6, w: 2.0, d: 0.42, h: 2.6 });

  // 7. Floor Lanterns flanking the central table
  for (const sx of [-1, 1]) {
    lights.push({ p: buildFloorLantern(B, M, { x: cx + sx * 2.85, y: Y0, z: cz - 4.5, s: 0.85 }).light, i: 1 });
  }

  // ---------------------------------------------------------------- architecture
  const colX = [-9.29, -5.57, 5.57, 9.29], colZ = [5.1, 1.7, -1.7, -5.1];
  const cols = [];
  for (const x of colX) for (const z of colZ) cols.push({ x: cx + x, z: cz + z, r: Math.abs(x) < 6 ? 0.36 : 0.32 });
  buildColumns(B, M, S, cols);
  buildBeams(B, M, S, colX, colZ);
  const fit = buildCeiling(ctx, B, M, S, { x0: cx - 12.4, x1: cx + 12.4, z0: cz - 7.95, z1: cz + 7.95, yc: S.ceilY, cell: 0.885 });
  root.add(fit);
  buildBackScreen(B, M, S, { x0: cx - 5.2, x1: cx + 5.2, z: cz - 7.9, y0: Y0, y1: S.ceilY - 0.12 });
  for (const sx of [-1, 1]) buildSideScreen(B, M, S, { x: cx + sx * 7.45, z0: cz - 7.95, z1: cz - 2.3, y0: Y0, y1: 6.6, facing: -sx });

  // ---------------------------------------------------------------- hanging lanterns
  for (const sx of [-1, 1]) {
    lights.push({ p: buildPendantLantern(B, M, K, { x: cx + sx * 3.05, y: S.ceilY - 0.12, z: cz - 0.2, s: 1.0, chain: 1.45 }, rnd), i: 2 });
    buildPendantLantern(B, M, K, { x: cx + sx * 6.7, y: S.ceilY - 0.12, z: cz - 1.0, s: 1.15, chain: 1.3 }, rnd);
    buildPendantLantern(B, M, K, { x: cx + sx * 2.15, y: S.ceilY - 0.12, z: cz - 3.6, s: 1.1, chain: 1.75 }, rnd);
    buildPendantLantern(B, M, K, { x: cx + sx * 5.3, y: S.ceilY - 0.12, z: cz - 4.2, s: 1.05, chain: 1.2 }, rnd);
  }

  // test shell (only when ?ishell=1 and no hall module is present)
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('ishell') === '1') {
      const { buildTestShell } = await import('./interior-testshell.js');
      root.add(buildTestShell(ctx, S));
    }
  } catch (e) { console.warn('[interior] test shell failed', e); }

  // ---------------------------------------------------------------- merge + instances
  const built = B.build({ name: 'interior-static' });
  root.add(built);
  const hang = new THREE.Group(); hang.name = 'interior-strands';
  flushStrands(ctx, K, M, hang);
  root.add(hang);
  // flowers + leaves
  if (inst.flowers.length) {
    const fg = flowerHeadGeo();
    const wh = inst.flowers.filter((f) => !f.pink).map((f) => f.m), pk = inst.flowers.filter((f) => f.pink).map((f) => f.m);
    if (wh.length) root.add(geom.instanced(fg, M.petalWhite, wh));
    if (pk.length) root.add(geom.instanced(fg, M.petalPink, pk));
    root.add(geom.instanced(leafGeo(), M.leaf, inst.leaves));
  }
  // flames (HDR glow) + embers
  if (flames.length) {
    const fgeo = flameGeo();
    const fl = geom.instanced(fgeo, M.flame, flames.map((f) => geom.mat4([f[0], f[1], f[2]], [0, 0, 0], f[3] || 1)), { castShadow: false, receiveShadow: false });
    fl.name = 'interior-flames';
    root.add(fl);
    const core = geom.instanced(fgeo, M.flameCore, flames.map((f) => geom.mat4([f[0], f[1] - 0.008, f[2]], [0, 0, 0], (f[3] || 1) * 0.5)), { castShadow: false, receiveShadow: false });
    root.add(core);
  }
  if (embers.length) root.add(geom.instanced(new THREE.SphereGeometry(0.004, 6, 4), M.ember, embers.map((e) => geom.mat4(e)), { castShadow: false, receiveShadow: false }));

  // ---------------------------------------------------------------- local lights (max 6)
  addLights(ctx, root, S, lights, flames);
  S.pointLights = root.userData.flicker;

  // ---------------------------------------------------------------- atmosphere
  S.volume = { min: [cx - 12.45, Y0, cz - 7.98], max: [cx + 12.45, S.ceilY - 0.12, cz + 7.98] };
  S.dustBox = { min: [cx - 9, Y0 + 0.4, cz - 6.5], max: [cx + 9, 8.3, cz + 7.5] };
  // the hall shell (walls + 0.6 m): occluders beyond it are ignored by the interior shafts
  S.shell = { min: [cx - 13.6, Y0 - 0.3, cz - 9.1], max: [cx + 13.6, 9.7, cz + 9.1] };
  S.hazeAmb = 0.0028;
  const shafts = buildShafts(ctx, S, { slices: ctx.quality === 'preview' ? 32 : 56, density: 0.18 });
  root.add(shafts);
  root.add(buildDust(ctx, S, { count: 1600 }));
  root.add(buildSmoke(ctx, [smokeSrc, smokeSrc2], { height: 1.5 }));
  root.userData.fx = [shafts];

  {
    const rows = [];
    let tot = 0, calls = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      tot += n; calls++;
      rows.push([n, `${o.name && o.name !== 'built' ? o.name + '/' : ''}${(o.material.name || o.material.type)}=${Math.round(n / 1000)}k`]);
    });
    rows.sort((a, b) => b[0] - a[0]);
    console.log(`[info] interior tris=${Math.round(tot / 1000)}k meshes=${calls} top: ${rows.slice(0, 18).map((r) => r[1]).join(' ')}`);
  }
  console.log(`[interior] built in ${(performance.now() - t0).toFixed(0)} ms`);

  return {
    object: root,
    update: (T) => {
      const k = 1 + 0.018 * Math.sin(T * 2.3) + 0.012 * Math.sin(T * 3.7 + 1.3);
      for (const l of root.userData.flicker || []) l.intensity = l.userData.base * k;
    },
    finalize: (c) => finalizeInterior(c, M, S, root),
    showcase: [
      // 1. Zhongtang reception: push-in towards the landscape scroll, couplets and furniture
      { cam: [cx, 3.4, cz + 5.5], look: [cx, 3.6, cz - 6.5], focal: 28, what: 'scholar central hall: landscape scroll, couplets, altar table & armchairs' },
      // 2. Altar table details: incense smoke, plum vase
      { cam: [cx + 1.4, 3.2, cz - 4.5], look: [cx, 2.9, cz - 6.8], focal: 40, what: 'altar table details: incense burner, plum vase' },
      // 3. Guqin alcove
      { cam: [cx + 3.8, 3.0, cz - 2.2], look: [cx + 5.5, 2.6, cz - 4.2], focal: 35, what: 'east alcove: Guqin zither desk and seven-string instrument' },
      // 4. Luohan daybed & curio shelf
      { cam: [cx - 3.6, 3.0, cz - 2.2], look: [cx - 5.8, 2.8, cz - 4.5], focal: 32, what: 'west alcove: Luohan daybed and curio bookcase' },
    ],
  };
}

// ============================================================================
function addLights(ctx, root, S, lights, flames) {
  const { THREE } = ctx;
  const { cx, cz, Y0 } = S;
  const warm = new THREE.Color().setRGB(1.0, 0.62, 0.3);
  const L = [];
  const mk = (p, I, dist) => {
    const l = new THREE.PointLight(warm, I, dist, 2);
    l.position.set(p[0], p[1], p[2]);
    l.castShadow = false;
    l.userData.base = I;
    root.add(l); L.push(l);
    return l;
  };
  // floor lanterns (2)
  for (const l of lights.filter((q) => q.i === 1)) mk(l.p, 7.0, 10);
  // pendant lanterns (2)
  for (const l of lights.filter((q) => q.i === 2)) mk(l.p, 5.0, 9);
  // candle cluster on the front table/altar (1) + warm fill on the Buddha (1)
  mk([cx, Y0 + 1.45, cz - 2.0], 9.0, 8);
  mk([cx - 2.6, Y0 + 5.2, cz - 1.2], 30.0, 15).userData.noHalo = true;
  root.userData.flicker = L;
}

// ============================================================================
function buildFloor(ctx, B, M, S) {
  const { cx, cz, Y0 } = S;
  // Polished dark water-ground bluestone floor (水磨金砖地面)
  B.box(M.woodFloor, 25.0, 0.04, 16.0, [cx, Y0 - 0.02, cz], [0, 0, 0], 0);
}

// ============================================================================
async function finalizeInterior(ctx, M, S, root) {
  if (ctx.quality !== 'final') return; // realtime: no local IBL captures
  // local env map at the sanctum centre so gold reflects the gold interior
  const hidden = [];
  root.traverse((o) => { if ((o.isPoints || /interior-(shafts|smoke)/.test(o.name)) && o.visible) { o.visible = false; hidden.push(o); } });
  try {
    for (let pass = 0; pass < 2; pass++) {
      const env = await ctx.captureEnv(S.probe, { size: 256, near: 0.1 });
      const old = new Set();
      for (const m of M.envList) { if (m.envMap && m.envMap !== env) old.add(m.envMap); m.envMap = env; m.envMapIntensity = (m.userData.envK ?? 1) * (S.envBoost || 2.2); m.needsUpdate = true; }
      old.forEach((t) => t.dispose());
    }
  } catch (e) { console.warn('[interior] env capture failed', e); }
  hidden.forEach((o) => { o.visible = true; });
}
