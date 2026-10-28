// ---------------------------------------------------------------------------
// props.js — hero props: 江南石景小品 (stone spurs, drum stools, scattered lake
// rocks), hanging lanterns (挂灯), wind chimes (风铎), incense burner (香炉),
// water basin (石钵) and stepping stones (汀步). All procedural, all instanced.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { stoneHooks, paperHooks, metalHooks, swayDepthHooks, panelHooks, BAMBOO_HOOKS, WATER_HOOKS, ASH_HOOKS, smokeMaterial } from './props-mat.js';
import { buildStoneStand } from './props-stone.js';
import { chunkedInstanced } from '../core/geom.js';
import { buildHangingLantern, buildBell } from './props-hang.js';
import { buildSteppingStones, buildStoneTableSet, buildStoneWell } from './props-plaza.js';
import { Acc, mat4 } from './props-geo.js';
import { buildTaihuPeak, buildCourtyardPeak } from './rockery-sdf.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

// module state shared between build / placeAnchors / update
const STATE = { lights: [], glowPoints: [], mats: null, ctx: null, cache: {} };

function makeMats(ctx) {
  if (STATE.mats) return STATE.mats;
  const sh = stoneHooks();
  const stoneU = {
    uMoss: { value: 1.0 }, uLichen: { value: 1.0 }, uDirt: { value: 1.0 }, uMossDisp: { value: 0.012 },
    uFireCol: { value: new THREE.Color().setRGB(1.0, 0.5, 0.18) }, uFireI: { value: 4.8 }, uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const stone = ctx.mat.std({ color: 0xffffff, roughness: 0.85, metalness: 0 }, { ...sh, uniforms: stoneU });
  stone.name = 'props.stone';
  const stoneDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  // the shadow caster is shrunk 5 mm along the welded normal: kills self-shadow acne
  // striping on the mossy 笠 under the 7-degree grazing sun (no visible peter-panning)
  const depthShrink = /* glsl */ `
  {
    vec3 nn2 = aSmooth;
    #ifdef USE_INSTANCING
      nn2 = mat3(instanceMatrix) * nn2;
    #endif
    wPos4.xyz -= normalize(mat3(modelMatrix) * nn2 + vec3(0.0, 1e-5, 0.0)) * 0.005;
  }`;
  ctx.mat.patch(stoneDepth, { vertexHead: sh.vertexHead, vertexWorld: sh.vertexWorld + depthShrink, uniforms: stoneU });

  // warm amber paper: keep linear values moderate + saturated so the tonemapper
  // does not wash the glow out to beige
  const paperU = { uPaperI: { value: 6.0 }, uPaperHot: { value: new THREE.Color().setRGB(1.0, 0.8, 0.5) }, uPaperEdge: { value: new THREE.Color().setRGB(1.0, 0.45, 0.13) } };
  const paper = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  ctx.mat.patch(paper, { ...paperHooks(), uniforms: paperU });
  paper.name = 'props.paper';

  // metals: one program, per-use sway uniforms
  const swayU = (a1, a2, f) => ({ uSway: { value: a1 }, uSway2: { value: a2 }, uSwayFreq: { value: f }, uWear: { value: 1.0 } });
  const mk = (u) => {
    const m = ctx.mat.std({ color: 0xffffff, roughness: 0.35, metalness: 1.0 }, { ...metalHooks(), uniforms: u });
    const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    ctx.mat.patch(d, { ...swayDepthHooks(), uniforms: u });
    return [m, d];
  };
  const lanternU = swayU(0.006, 0.0, 1.05);
  const [metalLantern, metalLanternDepth] = mk(lanternU);
  const [metalBell, metalBellDepth] = mk(swayU(0.045, 0.2, 2.4));
  const [metalStatic, metalStaticDepth] = mk(swayU(0, 0, 1));
  const panelU = { ...lanternU, uGlowI: { value: 3.5 }, uGlowHot: { value: new THREE.Color().setRGB(1.0, 0.58, 0.17) }, uGlowEdge: { value: new THREE.Color().setRGB(1.0, 0.27, 0.04) } };
  const panel = ctx.mat.std({ color: 0xffffff, roughness: 0.4, metalness: 1.0 }, { ...panelHooks(), uniforms: panelU });
  const panelDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  ctx.mat.patch(panelDepth, { ...swayDepthHooks(), uniforms: panelU });
  metalLantern.name = 'props.metalLantern'; metalBell.name = 'props.metalBell'; panel.name = 'props.panel';
  const bamboo = ctx.mat.std({ color: 0xffffff, roughness: 0.5, metalness: 0 }, BAMBOO_HOOKS);
  const waterU = { uDrip: { value: new THREE.Vector3() } };
  const water = ctx.mat.phys({ color: 0xffffff, roughness: 0.03, metalness: 0, ior: 1.33, specularIntensity: 1.0 }, { ...WATER_HOOKS, uniforms: waterU });
  const ash = ctx.mat.std({ color: 0xffffff, roughness: 0.95, metalness: 0 }, ASH_HOOKS);
  const ember = ctx.mat.glow([1.0, 0.32, 0.06], 7);
  const smoke = smokeMaterial(ctx.G);
  bamboo.name = 'props.bamboo'; water.name = 'props.water'; ash.name = 'props.ash'; smoke.name = 'props.smoke';
  STATE.mats = { stone, stoneDepth, stoneU, paper, paperU, metalLantern, metalLanternDepth, metalBell, metalBellDepth, metalStatic, metalStaticDepth, panel, panelDepth, panelU,
    bamboo, water, waterU, ash, ember, smoke };
  return STATE.mats;
}

function groundY(ctx, x, z) {
  const t = ctx.modules && ctx.modules.terrain;
  if (t && typeof t.heightAt === 'function') { const h = t.heightAt(x, z); if (Number.isFinite(h)) return h; }
  return 0;
}

function stats(obj) {
  let tris = 0, draws = 0;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    draws++;
    const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  return { tris: Math.round(tris), draws };
}

function instanced(geo, mat, matrices, { cast = true, receive = true, depth = null, name = '' } = {}) {
  return chunkedInstanced(geo, mat, matrices, { castShadow: cast, receiveShadow: receive, depth, name });
}

// ---------------------------------------------------------------------------
// 江南石景小品 — 石笋 / 石鼓墩 / 散置湖石 (Jiangnan stone stands)
// 石景小品布点：苏州园林不设石灯笼。
// ---------------------------------------------------------------------------
// target height per kind: the spur takes the plan height, the stool is always
// knee high, a lake rock sits between the two
function standHeight(kind, h) {
  if (kind === 'A') return h;                 // 石笋
  if (kind === 'B') return 0.46;              // 石鼓墩
  return Math.min(h * 0.62, 1.5);             // 散置湖石
}
function placeStoneStands(ctx, group) {
  const { L } = ctx;
  const M = makeMats(ctx);
  const R = ctx.rng('props.stoneStands');
  const list = (L.stoneStands || []).map((e, i) => {
    const [x, z, h] = e;
    // 0-3 spurs flanking the processional axis, 4-5 stools at the bridge head,
    // 6-8 lake rocks around the pagoda, then alternating rocks and stools on the shore
    let kind = 'C';
    if (i < 4) kind = 'A';
    else if (i < 6) kind = 'B';
    else if (i < 9) kind = 'C';
    else kind = i % 2 ? 'B' : 'C';
    let yaw = 0;
    if (i >= 6 && i < 9) yaw = Math.PI / 2;               // by the pagoda, face the plaza
    if (i >= 9) yaw = Math.atan2(10 - x, 20 - z);         // on the shore, face the pond
    yaw += R.range(-0.07, 0.07);
    return { i, x, z, h, kind, yaw, tx: R.range(-0.012, 0.012), tz: R.range(-0.012, 0.012) };
  });
  const kinds = {};
  for (const e of list) (kinds[e.kind] = kinds[e.kind] || []).push(e);
  const out = [];
  for (const [kind, items] of Object.entries(kinds)) {
    const stand = buildStoneStand(kind);
    const mats = items.map((e) => {
      const s = standHeight(kind, e.h) / stand.height;
      const y = groundY(ctx, e.x, e.z) - 0.02;
      return new THREE.Matrix4().compose(new THREE.Vector3(e.x, y, e.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(e.tx, e.yaw, e.tz, 'YXZ')), new THREE.Vector3(s, s, s));
    });
    const mS = instanced(stand.stone.build({ smooth: true }), M.stone, mats, { depth: M.stoneDepth, name: `stoneStand${kind}` });
    items.forEach((e, k) => out.push({ ...e, matrix: mats[k], mesh: mS, index: k, stand }));
    group.add(mS);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hanging lanterns + bells at building anchors
// ---------------------------------------------------------------------------
function anchorMatrix(a) {
  const s = a.scale ?? 1;
  return new THREE.Matrix4().compose(new THREE.Vector3(...a.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a.rotY || 0, 0)), new THREE.Vector3(s, s, s));
}

function hangGeometry() {
  if (!STATE.cache.hang) {
    const h = buildHangingLantern();
    STATE.cache.hang = { metal: h.metal.build(), panel: h.panel.build(), lightY: h.lightY, bottom: h.bottom };
  }
  return STATE.cache.hang;
}
function bellGeometry() {
  if (!STATE.cache.bell) STATE.cache.bell = buildBell({ seg: 22 }).metal.build();
  return STATE.cache.bell;
}

export function placeAnchors(ctx, anchors = {}) {
  const M = makeMats(ctx);
  const g = new THREE.Group();
  g.name = 'props.anchors';
  const lanterns = (anchors.hangingLanterns || []).filter((a) => a && a.pos);
  const bells = [...(anchors.bells || []), ...(anchors.smallBells || []).map((b) => ({ ...b, scale: (b.scale ?? 1) * 0.6 }))].filter((a) => a && a.pos);
  if (lanterns.length) {
    const H = hangGeometry();
    const mats = lanterns.map(anchorMatrix);
    const metal = instanced(H.metal.clone(), M.metalLantern, mats, { depth: M.metalLanternDepth, name: 'hangingLanternMetal' });
    const pg = H.panel.clone();
    const style = new Float32Array(lanterns.length);
    lanterns.forEach((a, i) => {
      // consistent style per building cluster (or explicit anchor.style)
      style[i] = a.style ?? (Math.floor(a.pos[0] / 24 + 100) + Math.floor(a.pos[2] / 24 + 100)) % 2;
    });
    pg.setAttribute('iStyle', new THREE.InstancedBufferAttribute(style, 1));
    const panel = instanced(pg, M.panel, mats, { depth: M.panelDepth, name: 'hangingLanternPanels' });
    g.add(metal, panel);
    mats.forEach((m) => STATE.glowPoints.push({ pos: new THREE.Vector3(0, H.lightY, 0).applyMatrix4(m), kind: 'hang', bias: 1.0, intensity: 1.0 }));
    // showcase: hero lantern nearest the hall front (close-up from below)
    if (STATE.showcase) {
      const target = new THREE.Vector3(10, 5, -8);
      let best = null, bd = Infinity;
      for (const m of mats) { const p = new THREE.Vector3(0, H.lightY, 0).applyMatrix4(m); const d = p.distanceTo(target); if (d < bd) { bd = d; best = p; } }
      if (best) {
        const dir = new THREE.Vector3(best.x - 10, 0, 1).normalize();
        const cam = best.clone().addScaledVector(dir, 1.6); cam.y -= 0.55;
        STATE.showcase.push({ cam: cam.toArray().map((v) => +v.toFixed(2)), look: [+(best.x - dir.x * 3).toFixed(2), +(best.y + 0.9).toFixed(2), +(best.z - 4).toFixed(2)], focal: 28, what: 'hero hanging lantern' });
      }
    }
  }
  if (bells.length) {
    const mats = bells.map(anchorMatrix);
    g.add(instanced(bellGeometry(), M.metalBell, mats, { depth: M.metalBellDepth, name: 'windBells' }));
  }
  console.log(`[world] props anchors: ${lanterns.length} hanging lanterns, ${bells.length} bells, ${JSON.stringify(stats(g))}`
    + (Q.has('propsdbg') ? ' bells@' + JSON.stringify(bells.slice(0, 6).map((b) => b.pos.map((v) => +v.toFixed(2)))) + ' lanterns@' + JSON.stringify(lanterns.slice(0, 40).map((b) => b.pos.map((v) => +v.toFixed(2)))) : ''));
  return g;
}

// ---------------------------------------------------------------------------
// Plaza props: 汀步 stepping stones (one merged stone mesh).
// (was: 常香炉 常香炉 + 手水钵 手水钵 with its 筧/柄杓/前石·手烛石·汤桶石 —
//  the tea-garden set is Japanese and has been removed; a Suzhou courtyard has
//  a well, stone tables and stools instead)
// ---------------------------------------------------------------------------
export const PLAZA = {
  stepping: [
    // from the pagoda path north across the west lawn
    { x: -14.8, z: -6.9, rot: 0.3, s: 1.05 }, { x: -15.25, z: -7.75, rot: 1.2, s: 0.9 }, { x: -14.85, z: -8.6, rot: 2.1, s: 1.0 },
    // from the path south toward the shore stone stand (-12, 4.2)
    { x: -12.3, z: -2.55, rot: 0.6, s: 1.0 }, { x: -11.85, z: -1.6, rot: 1.9, s: 0.92 }, { x: -12.35, z: -0.7, rot: 0.2, s: 1.08 },
    { x: -11.95, z: 0.25, rot: 2.6, s: 0.95 }, { x: -12.45, z: 1.15, rot: 1.1, s: 1.0 }, { x: -12.0, z: 2.1, rot: 0.4, s: 0.9 },
  ],
};

function placePlaza(ctx, group) {
  const M = makeMats(ctx);
  const gy = (x, z) => groundY(ctx, x, z);
  const stone = new Acc();
  stone.addAcc(buildSteppingStones(PLAZA.stepping, gy));
  // 庭院石桌石凳与古井 (stone table set & ancient well)
  stone.addAcc(buildStoneTableSet(18.5, -2.5, gy));
  stone.addAcc(buildStoneWell(-3.5, -1.8, gy));
  const mesh = (acc, mat, { cast = true, receive = true, depth = null, name }) => {
    if (!acc.n) return null;
    const m = new THREE.Mesh(acc.build({ smooth: mat === M.stone }), mat);
    m.castShadow = cast; m.receiveShadow = receive; if (depth) m.customDepthMaterial = depth; m.name = name;
    group.add(m); return m;
  };
  mesh(stone, M.stone, { depth: M.stoneDepth, name: 'props.plazaStone' });
  return { stepping: PLAZA.stepping };
}

// ---------------------------------------------------------------------------
// Warm point lights that follow the nearest glowing lanterns (max 4).
// Weights fade smoothly as a lantern's rank approaches #5, so no popping.
// ---------------------------------------------------------------------------
function makeLights(group) {
  STATE.lights = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(new THREE.Color().setRGB(1.0, 0.58, 0.26), 0, 7.5, 2);
    l.castShadow = false;
    l.name = 'props.lanternLight' + i;
    group.add(l);
    STATE.lights.push(l);
  }
}
const _cp = new THREE.Vector3();
function updateLights(camPos) {
  const pts = STATE.glowPoints;
  if (!pts.length || !STATE.lights.length) return;
  const d = pts.map((p, i) => ({ i, d: p.pos.distanceTo(camPos) * p.bias }));
  d.sort((a, b) => a.d - b.d);
  const d5 = d.length > 4 ? d[4].d : Infinity;
  for (let k = 0; k < 4; k++) {
    const l = STATE.lights[k];
    if (k >= d.length) { l.intensity = 0; continue; }
    const p = pts[d[k].i];
    const w = d5 === Infinity ? 1 : Math.min(Math.max((d5 - d[k].d) / 2.0, 0), 1);
    l.position.copy(p.pos);
    l.intensity = 1.6 * p.intensity * w;
    l.updateMatrixWorld();
  }
}
function hookSceneLights(scene) {
  if (scene.userData.__propsLightHook) return;
  scene.userData.__propsLightHook = true;
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, sc, camera, rt) {
    if (prev) prev.call(this, renderer, sc, camera, rt);
    try { camera.getWorldPosition(_cp); updateLights(_cp); } catch (e) { /* never break rendering */ }
  };
}

// ---------------------------------------------------------------------------
// Test rig (?propstest): a lacquered beam with hanging lanterns and bells.
// ---------------------------------------------------------------------------
function testRig(ctx, group) {
  const { THREE: T3 } = ctx;
  const mat = ctx.M.lacquerRed;
  const b = new ctx.geom.Builder();
  b.box(mat, 9.0, 0.36, 0.3, [24, 3.78, -2], [0, 0, 0], 0.03);
  b.box(mat, 0.34, 3.6, 0.34, [19.8, 1.8, -2], [0, 0, 0], 0.03);
  b.box(mat, 0.34, 3.6, 0.34, [28.2, 1.8, -2], [0, 0, 0], 0.03);
  b.box(ctx.M.roofTile, 9.6, 0.12, 1.6, [24, 4.05, -2], [0.08, 0, 0], 0.02);
  const rig = b.build({ name: 'props.testRig' });
  group.add(rig);
  return {
    hangingLanterns: [
      { pos: [21.6, 3.6, -2], scale: 1.0, rotY: 0, style: 0 },
      { pos: [24.0, 3.6, -2], scale: 1.0, rotY: 0.3, style: 1 },
      { pos: [26.4, 3.6, -2], scale: 1.0, rotY: 0, style: 0 },
    ],
    bells: [
      { pos: [20.4, 3.6, -1.95], scale: 1.0, rotY: 0 },
      { pos: [22.8, 3.6, -1.95], scale: 1.0, rotY: 0 },
      { pos: [25.2, 3.6, -1.95], scale: 1.0, rotY: 0.2 },
      { pos: [27.6, 3.6, -1.95], scale: 1.0, rotY: 0 },
    ],
  };
}

// ---------------------------------------------------------------------------
export async function build(ctx) {
  STATE.ctx = ctx; STATE.glowPoints = []; STATE.mats = null; STATE.cache = {};
  const group = new THREE.Group();
  group.name = 'props';
  STATE.stoneStands = placeStoneStands(ctx, group);
  STATE.plaza = placePlaza(ctx, group);
  makeLights(group);
  hookSceneLights(ctx.scene);

  // ---------------------------------------------------------------------------
  // Classical Taihu Stone Rockery (太湖石假山与立峰)
  // ---------------------------------------------------------------------------
  // 1. Hero Peak: Guanyun Peak (冠云峰) in the garden courtyard
  const heroPeak = buildTaihuPeak(ctx, {
    height: 3.8,
    lean: 0.35,
    seed: 42,
    hasPedestal: true,
    pos: [22.0, 0, -3.5],
    rotY: 0.4,
  });
  group.add(heroPeak);

  // 2. Courtyard Leak-Window Companion Peak (漏窗对景立峰)
  const windowPeak = buildCourtyardPeak(ctx, {
    height: 2.2,
    seed: 88,
    pos: [42.0, 0, 4.5],
    rotY: -0.5,
  });
  group.add(windowPeak);

  // 3. Water-Facing Rockery Peak & Shore Spurt (临波叠石立峰)
  const shorePeak = buildCourtyardPeak(ctx, {
    height: 2.4,
    seed: 156,
    pos: [34.5, 0, 8.5],
    rotY: 1.2,
  });
  group.add(shorePeak);

  if (Q.has('propstest')) {
    const anchors = testRig(ctx, group);
    group.add(placeAnchors(ctx, anchors));
  }
  console.log(`[world] props base: ${JSON.stringify(stats(group))}`);
  STATE.showcase = [
    { cam: [17.5, 1.8, 1.2], look: [22.0, 2.2, -3.5], focal: 28, what: 'taihu hero peak: Guanyun Peak against hall and sky' },
    { cam: [46.0, 2.2, 2.0], look: [41.0, 1.8, 5.0], focal: 35, what: 'corridor leak window view: perforated taihu stone and bamboo' },
    { cam: [10, 1.45, 2.6], look: [10, 1.9, -4.5], focal: 24, what: 'processional axis: stone spur pair before the hall stairs' },
    { cam: [8.2, 1.2, -0.4], look: [6.2, 1.75, -4.2], focal: 30, what: 'stone spur at the plaza axis: erosion, moss, the hall behind' },
    { cam: [7.2, 1.75, 33.2], look: [-6, 4, 10], focal: 26, what: 'bridge-head stone stand foreground, pagoda behind' },
    { cam: [-14.0, 1.1, -5.6], look: [-14.85, 0.35, -8.6], focal: 35, what: 'stepping stones across the west lawn toward the lake rocks' },
  ];
  return {
    object: group,
    update(T, c) { if (c && c.camera) { c.camera.getWorldPosition(_cp); updateLights(_cp); } },
    showcase: STATE.showcase,
  };
}
