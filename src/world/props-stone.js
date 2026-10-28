// ---------------------------------------------------------------------------
// props-stone.js — 江南石景小品 (Jiangnan stone props), built once per kind and
// instanced. Local frame: base at y = 0.
//
//   'A' 石笋 shisun    — a slender, leaning, water-eroded stone spur
//   'B' 石鼓墩 drum     — a low waisted stone stool (garden seat / plinth)
//   'C' 散置湖石 rock   — a small standing lake rock of two or three lobes
//
// 石景小品（石笋 / 石鼓墩 / 散置湖石）：苏州园林不设石灯笼。
// lanterns, it has stone spurs, drum stools and scattered Taihu rocks.
// Vertex tag = [pattern, glowRecv, mossBias, fireY]; pattern 0 = plain stone,
// there is no fire box any more, so glowRecv and fireY stay 0.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Acc, polyStack, lathe, taperTube } from './props-geo.js';
import { seg as dseg, cnt } from '../core/detail.js';

const T = (moss) => [0, 0, moss, 0];

// deterministic ripple so every instance of a kind is identical without an RNG
function wob(t, s) {
  return Math.sin(t * 9.1 + s) * 0.5 + Math.sin(t * 21.7 + s * 2.3) * 0.3 + Math.sin(t * 4.3 + s * 3.7) * 0.2;
}

// ---------------------------------------------------------------------------
// 石笋 — a stone spur: tall, slender, always a little out of plumb, the tip
// rounded off by water. Reads as a vertical accent beside a wall or a path.
// ---------------------------------------------------------------------------
function shisun(S) {
  const H = 2.2;
  const lean = 0.17, dir = 0.9;
  const pts = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const bend = lean * (t * t * 0.85 + 0.15 * t);
    pts.push(new THREE.Vector3(Math.cos(dir) * bend, t * H, Math.sin(dir) * bend));
  }
  const r0 = 0.225;
  taperTube(S, pts, (t) => r0 * Math.pow(1 - t, 0.42) * (1 + 0.15 * wob(t * 2.2, 1.7)), {
    radial: cnt(12), segs: dseg(30), tag: T(0.3), capStart: false, capEnd: true,
  });
  // buried plinth: the spur is set into the paving, moss gathers at the join
  polyStack(S, {
    n: 9, rot: 0.35, rc: 0.02, sideSeg: 3, profile: [
      { a: 0.33, y: 0.0, tag: T(1.0) }, { a: 0.315, y: 0.085, tag: T(0.75) }, { a: 0.265, y: 0.155, tag: T(0.42) },
    ],
  });
  // erosion: broad solution hollows then fine pitting
  S.jitter(0, S.n, 0.016, 2.7, 11);
  S.jitter(0, S.n, 0.006, 9.5, 29);
  return H + 0.06;
}

// ---------------------------------------------------------------------------
// 石鼓墩 — a waisted stone drum: seat, plinth or stand for a potted plant.
// ---------------------------------------------------------------------------
function drumStool(S) {
  const H = 0.5, R = 0.235;
  lathe(S, [
    [0.0, 0.0], [R * 1.08, 0.0], [R * 1.08, 0.04], [R * 0.99, 0.062],
    [R * 0.86, 0.105], [R * 0.93, 0.20], [R * 1.0, 0.30], [R * 0.965, 0.385],
    [R * 0.9, 0.44], [R * 0.985, 0.468], [R * 0.985, 0.5], [0.0, 0.5],
  ], dseg(36), T(0.5));
  // a shallow dished top, the way the old ones are worn
  lathe(S, [
    [0.0, 0.494], [R * 0.62, 0.494], [R * 0.78, 0.5],
  ], dseg(36), T(0.15));
  S.jitter(0, S.n, 0.0045, 6.0, 7);
  S.jitter(0, S.n, 0.002, 15.0, 23);
  return H;
}

// ---------------------------------------------------------------------------
// 散置湖石 — two or three lobes leaning together, the small standing rock that
// sits at a path corner or answers a leak window across the court.
// ---------------------------------------------------------------------------
function lakeRock(S) {
  const H = 1.3;
  const lobe = (h, rBase, dir, bend, seed) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector3(Math.cos(dir) * bend * t * t, h * t, Math.sin(dir) * bend * t * t));
    }
    taperTube(S, pts, (t) => rBase * Math.pow(1 - t, 0.5) * (1 + 0.24 * wob(t * 1.8, seed)), {
      radial: cnt(10), segs: dseg(22), tag: T(0.35), capStart: false,
    });
  };
  lobe(H, 0.285, 0.4, 0.22, 3.1);
  lobe(H * 0.56, 0.185, 2.6, -0.16, 7.7);
  lobe(H * 0.37, 0.14, 4.4, 0.12, 12.3);
  polyStack(S, {
    n: 8, rot: 0.5, rc: 0.02, sideSeg: 3, profile: [
      { a: 0.4, y: 0.0, tag: T(1.0) }, { a: 0.36, y: 0.115, tag: T(0.6) },
    ],
  });
  S.jitter(0, S.n, 0.014, 3.1, 5);
  S.jitter(0, S.n, 0.006, 11.0, 21);
  return H + 0.05;
}

const KINDS = { A: shisun, B: drumStool, C: lakeRock };

// kind: 'A' 石笋 | 'B' 石鼓墩 | 'C' 散置湖石. Returns { stone, height }.
export function buildStoneStand(kind) {
  const S = new Acc();
  const height = (KINDS[kind] || KINDS.C)(S);
  return { stone: S, height };
}

// rough ground radius, used to keep the terrain and the planting off the base
export function standRadius(kind) {
  return kind === 'A' ? 0.4 : kind === 'B' ? 0.34 : 0.5;
}
