/**
 * 月到风来亭 · 六角攒尖亭 — 独立三维几何模块
 *
 * 这是"照形制重建"，不是"照图建模"：这亭子没有测绘图，只有一张对岸斜拍的照片，
 * 尺寸量不出来。所以模块里每个数都标来源，分两类：
 *   有依据 — 美人靠的侧向轮廓（座面 475、靠背 505、外移 142、S 形弯棂、
 *            起脚竖直／半高最鼓／顶端回直、涡卷加拉结件挂柱），
 *            取自用户提供的示意图右半边剖面；六角攒尖、三面临水、
 *            临水三面设美人靠、背水面一侧实墙，取自照片。
 *   推定   — 开间（柱中距）、柱径、柱高、檐口高、屋顶举高与出檐、
 *            瓦垄规格、台明高、屋顶厚度、戗角起翘量。按江南六角攒尖亭的
 *            一般比例定的，不是实测。
 *
 * 单文件 ES module：不 import 任何东西，只接收 THREE 与 options，返回 THREE.Group。
 * 单位 mm；Y 向上；正面（临水三面的中间那一面）朝 +Z；原点在亭心地面（台明底面）。
 * 默认参数就是月到风来亭这一版，开间／柱高／屋顶举高都能从外面改。
 */

const DEG = Math.PI / 180;

export const YUEDAO_FENGLAI = {
  // 平面（推定）
  bay: 1800,            // 柱中距，也就是六角形边长（外接圆半径）
  platformH: 300,       // 台明高
  platformMargin: 320,  // 台明比柱中线外扩
  // 竖向（推定）
  columnD: 240,         // 柱径
  columnH: 2850,        // 台明顶到额枋下
  lintelH: 220,         // 额枋高
  lintelD: 160,         // 额枋厚
  eaveOverhang: 800,    // 檐口相对柱中线再挑出
  roofRise: 1780,       // 檐口到攒尖顶（不含宝顶）
  roofT: 120,           // 屋面厚
  eaveUpturn: 220,      // 戗角起翘
  cornerFlare: 0.09,    // 檐口转角再向外扩的比例
  // 瓦垄（推定）
  tileRows: 12,         // 每面瓦垄数
  tileAmp: 20,          // 瓦垄起伏
  // 美人靠（取自剖面）
  seatH: 475,           // 座面高（台明顶以上）
  seatD: 380,           // 座面进深
  seatT: 62,            // 座面厚
  railTopH: 1015,       // 扶手顶高（台明顶以上）
  railH: 70,
  railD: 60,
  barW: 40,             // 弯棂面宽
  barT: 30,             // 弯棂厚
  barPitch: 158,        // 弯棂中距
  // 其他（推定）
  wallT: 120,
  materials: null,      // 可传 {wood, woodSeat, stone, floorStone, tile, wall, finial}
};

// 剖面量出来的靠背：以靠背脚为原点，[外移 dz, 高 dy]，1 px ≈ 6.17 mm
export const MEIKAO_SECTION = {
  note: '比例从示意图剖面取，坐面高 77 px 定为 475 mm；不是实测',
  seatH: 475, footOut: 135, topOut: 277, backH: 506,
  curve: [
    [0, 0], [0, 43], [6, 74], [8, 136], [22, 167], [43, 197], [62, 228],
    [80, 259], [102, 290], [120, 321], [131, 352], [139, 383], [144, 413],
    [145, 444], [144, 475], [142, 506],
  ],
};

// 六角：0 号到 2 号是背水面；5/0/4 三面朝水，设美人靠；1/3 两面开口
export const BAYS = { water: [5, 0, 4], wall: 2, open: [1, 3] };

function hexVerts(R) {
  const v = [];
  for (let k = 0; k < 6; k++) {
    const a = (30 + 60 * k) * DEG;
    v.push({ x: R * Math.sin(a), z: R * Math.cos(a), a });
  }
  return v;
}

export function buildPavilionLayout(options = {}) {
  const p = { ...YUEDAO_FENGLAI, ...options };
  const R = p.bay;
  const platformR = R + p.platformMargin;
  const eaveR = R + p.eaveOverhang;
  const floorY = p.platformH;
  const colTopY = floorY + p.columnH;
  const eaveY = colTopY + p.lintelH;
  const apexY = eaveY + p.roofRise;
  const verts = hexVerts(R);

  const bays = [];
  for (let k = 0; k < 6; k++) {
    const a = verts[k], b = verts[(k + 1) % 6];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const midA = (60 * k + 60) * DEG;
    bays.push({
      k, a, b, len,
      mid: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
      dir: { x: dx / len, z: dz / len },
      out: { x: Math.sin(midA), z: Math.cos(midA) },
    });
  }

  return {
    params: p,
    verts,
    bays,
    heights: {
      floorY, colTopY, eaveY, apexY,
      seatY: floorY + p.seatH,
      railC: floorY + p.railTopH - p.railH / 2,
    },
    plan: { R, platformR, eaveR },
    clear: R - p.columnD,          // 一开间净空
    faces: {
      seatOut: p.columnD / 2 + 93,   // 座面外沿离柱中线
      seatIn: p.columnD / 2 + 93 - p.seatD,
      footZ: p.columnD / 2 + 25,
      topZ: p.columnD / 2 + 167,
      colFaceZ: p.columnD / 2,
    },
  };
}

// ---------------------------------------------------------------------------
// 几何小工具
// ---------------------------------------------------------------------------

function matSet(THREE, custom) {
  const m = (color, roughness, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return Object.assign({
    wood: m(0x3e2418, 0.56),
    woodSeat: m(0x5c3722, 0.5),
    stone: m(0xa9a49a, 0.8),
    floorStone: m(0x8c877e, 0.86),
    tile: m(0x39414a, 0.72),
    wall: m(0xf4f0e8, 0.9),
    finial: m(0x5d6166, 0.55, 0.18),
    hip: m(0x333a40, 0.75),
  }, custom || {});
}

// 一开间的局部坐标：x 沿檐口方向，z 由柱中线向外出，y 为绝对标高
function bayFrame(THREE, bay) {
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(bay.dir.x, 0, bay.dir.z),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(bay.out.x, 0, bay.out.z),
  );
  m.setPosition(bay.mid.x, 0, bay.mid.z);
  return m;
}

function beamAlong(THREE, a, b, y0, y1, depth, mat) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const dir = new THREE.Vector3(dx / len, 0, dz / len);
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(dir, up).normalize();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, y1 - y0, depth), mat);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, up, side));
  mesh.position.set((a.x + b.x) / 2, (y0 + y1) / 2, (a.z + b.z) / 2);
  return mesh;
}

function flipIndex(geo) {
  const a = geo.index.array;
  for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  geo.index.needsUpdate = true;
}

// volume：闭合体按有向体积定正反；up/down：开口壳按法线朝上/朝下定正反
function orient(THREE, geo, mode = 'volume') {
  const pos = geo.getAttribute('position');
  const idx = geo.index;
  let acc = 0;
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    const ax = pos.getX(i0), ay = pos.getY(i0), az = pos.getZ(i0);
    const bx = pos.getX(i1), by = pos.getY(i1), bz = pos.getZ(i1);
    const cx = pos.getX(i2), cy = pos.getY(i2), cz = pos.getZ(i2);
    if (mode === 'volume') {
      acc += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    } else {
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      acc += ny;
    }
  }
  const ok = mode === 'volume' ? acc > 0 : (mode === 'up' ? acc > 0 : acc < 0);
  if (!ok) flipIndex(geo);
  geo.computeVertexNormals();
  return geo;
}

// 把一条 (z,y) 平面内的折线扫成矩形条：面宽沿 x，厚度沿曲线法向
function sweepBar(THREE, pts, xc, halfW, halfT) {
  const pos = [], idx = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
    let tz = p1[0] - p0[0], ty = p1[1] - p0[1];
    const L = Math.hypot(tz, ty) || 1;
    tz /= L; ty /= L;
    const nz = ty, ny = -tz;
    const [z, y] = pts[i];
    const corners = [
      [xc - halfW, y + ny * halfT, z + nz * halfT],
      [xc + halfW, y + ny * halfT, z + nz * halfT],
      [xc + halfW, y - ny * halfT, z - nz * halfT],
      [xc - halfW, y - ny * halfT, z - nz * halfT],
    ];
    for (const c of corners) pos.push(...c);
  }
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < 4; s++) {
      const a = i * 4 + s, b = i * 4 + (s + 1) % 4;
      const c = (i + 1) * 4 + (s + 1) % 4, d = (i + 1) * 4 + s;
      idx.push(a, b, c, a, c, d);
    }
  }
  const last = (n - 1) * 4;
  idx.push(0, 3, 2, 0, 2, 1);
  idx.push(last, last + 1, last + 2, last, last + 2, last + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return orient(THREE, geo, 'volume');
}

// 涡卷：竖直平面（垂直于开间方向）里的扁螺旋带
function ribbonSpiral(THREE, { x0, cz, cy, r0, r1, rib, thick, turns, steps, phase = Math.PI }) {
  const pos = [], idx = [];
  const xa = x0 - thick / 2, xb = x0 + thick / 2;
  for (let j = 0; j <= steps; j++) {
    const q = j / steps;
    const th = phase + q * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * q;
    const zi = cz + r * Math.cos(th), yi = cy + r * Math.sin(th);
    const zo = cz + (r + rib) * Math.cos(th), yo = cy + (r + rib) * Math.sin(th);
    pos.push(xa, yi, zi, xa, yo, zo, xb, yo, zo, xb, yi, zi);
  }
  for (let j = 0; j < steps; j++) {
    for (let s = 0; s < 4; s++) {
      const a = j * 4 + s, b = j * 4 + (s + 1) % 4;
      const c = (j + 1) * 4 + (s + 1) % 4, d = (j + 1) * 4 + s;
      idx.push(a, b, c, a, c, d);
    }
  }
  const last = steps * 4;
  idx.push(0, 3, 2, 0, 2, 1);
  idx.push(last, last + 1, last + 2, last, last + 2, last + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return orient(THREE, geo, 'volume');
}

// 沿三维折线扫成圆管（可逐点给半径），用于戗脊
function sweepTube(THREE, pts, radii, sides = 8) {
  const P = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const pos = [], idx = [];
  const UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < P.length; i++) {
    const t = new THREE.Vector3();
    if (i === 0) t.subVectors(P[1], P[0]);
    else if (i === P.length - 1) t.subVectors(P[i], P[i - 1]);
    else t.subVectors(P[i + 1], P[i - 1]);
    t.normalize();
    let n1 = new THREE.Vector3().crossVectors(t, UP);
    if (n1.lengthSq() < 1e-8) n1.set(1, 0, 0);
    n1.normalize();
    const n2 = new THREE.Vector3().crossVectors(t, n1).normalize();
    for (let s = 0; s < sides; s++) {
      const a = s / sides * Math.PI * 2;
      const r = radii[i];
      pos.push(P[i].x + n1.x * Math.cos(a) * r + n2.x * Math.sin(a) * r,
               P[i].y + n1.y * Math.cos(a) * r + n2.y * Math.sin(a) * r,
               P[i].z + n1.z * Math.cos(a) * r + n2.z * Math.sin(a) * r);
    }
  }
  for (let i = 0; i < P.length - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * sides + s, b = i * sides + (s + 1) % sides;
      const c = (i + 1) * sides + (s + 1) % sides, d = (i + 1) * sides + s;
      idx.push(a, b, c, a, c, d);
    }
  }
  const last = (P.length - 1) * sides;
  for (let s = 1; s < sides - 1; s++) idx.push(0, s + 1, s);
  for (let s = 1; s < sides - 1; s++) idx.push(last, last + s, last + s + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return orient(THREE, geo, 'volume');
}

// ---------------------------------------------------------------------------
// 亭体
// ---------------------------------------------------------------------------

export function createPavilion(THREE, options = {}) {
  const L = buildPavilionLayout(options);
  const p = L.params;
  const h = L.heights;
  const f = L.faces;
  const group = new THREE.Group();
  group.name = 'yuedao-fenglai';
  const mats = matSet(THREE, options.materials);

  const add = (obj, name) => {
    obj.name = name;
    obj.castShadow = true;
    obj.receiveShadow = true;
    group.add(obj);
    return obj;
  };
  const mesh = (geo, mat, name) => add(new THREE.Mesh(geo, mat), name);

  // —— 台明 ——————————————————————————————————————————
  const body = mesh(new THREE.CylinderGeometry(L.plan.platformR, L.plan.platformR,
    p.platformH - 60, 6, 1, false, Math.PI / 6), mats.stone, 'platform');
  body.position.y = (p.platformH - 60) / 2;

  const cap = mesh(new THREE.CylinderGeometry(L.plan.platformR + 30, L.plan.platformR + 30,
    60, 6, 1, false, Math.PI / 6), mats.stone, 'platform-cap');
  cap.position.y = p.platformH - 30;

  const fl = mesh(new THREE.CylinderGeometry(L.plan.R - 120, L.plan.R - 120,
    8, 6, 1, false, Math.PI / 6), mats.floorStone, 'floor');
  fl.position.y = p.platformH + 4;

  // 两个开口面的踏步（从岸上进来）
  for (const k of BAYS.open) {
    const bay = L.bays[k];
    const g = new THREE.Group();
    g.applyMatrix4(bayFrame(THREE, bay));
    const step = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1300, L.clear), 150, 380), mats.stone);
    step.position.set(0, 75, 277 + 190);
    g.add(step);
    add(g, 'step-' + k);
  }

  // —— 柱与柱顶石 ————————————————————————————————————
  const colGeo = new THREE.CylinderGeometry(p.columnD * 0.46, p.columnD * 0.50, p.columnH, 20);
  const baseGeo = new THREE.BoxGeometry(p.columnD + 90, 80, p.columnD + 90);
  for (let i = 0; i < 6; i++) {
    const v = L.verts[i];
    const c = mesh(colGeo, mats.wood, 'column-' + i);
    c.position.set(v.x, h.floorY + p.columnH / 2, v.z);
    const b = mesh(baseGeo, mats.stone, 'column-base-' + i);
    b.position.set(v.x, h.floorY + 40, v.z);
    b.rotation.y = v.a;
  }

  // —— 额枋（六面一圈）———————————————————————————————
  for (const bay of L.bays) {
    add(beamAlong(THREE, bay.a, bay.b, h.colTopY, h.eaveY, p.lintelD, mats.wood), 'lintel-' + bay.k);
  }

  // —— 背水面的实墙＋裙板（照片内外不同那一面）————————
  {
    const bay = L.bays[BAYS.wall];
    const g = new THREE.Group();
    g.applyMatrix4(bayFrame(THREE, bay));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(L.clear, h.colTopY - h.floorY, p.wallT), mats.wall);
    wall.position.set(0, (h.floorY + h.colTopY) / 2, 0);
    g.add(wall);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(L.clear, 900, 30), mats.wood);
    skirt.position.set(0, h.floorY + 450, -(p.wallT / 2 + 15));
    g.add(skirt);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L.clear, 50, 40), mats.woodSeat);
    rail.position.set(0, h.floorY + 915, -(p.wallT / 2 + 15));
    g.add(rail);
    add(g, 'back-wall');
  }

  // —— 临水三面的美人靠 ————————————————————————————————
  {
    const mk = new THREE.Group();
    mk.name = 'meikao';
    const clear = L.clear;
    const seatY = h.seatY;
    const prof = MEIKAO_SECTION.curve.map(([dz, dy]) => [f.footZ + dz, seatY + dy]);

    for (const k of BAYS.water) {
      const bay = L.bays[k];
      const g = new THREE.Group();
      g.name = 'meikao-' + k;
      g.applyMatrix4(bayFrame(THREE, bay));

      const seat = new THREE.Mesh(new THREE.BoxGeometry(clear + 20, p.seatT, p.seatD), mats.woodSeat);
      seat.position.set(0, seatY - p.seatT / 2, (f.seatOut + f.seatIn) / 2);
      g.add(seat);

      const nbar = Math.max(5, Math.round(clear / p.barPitch) + 1);
      const pitch = clear / (nbar - 1);
      for (let i = 0; i < nbar; i++) {
        const geo = sweepBar(THREE, prof, -clear / 2 + i * pitch, p.barW / 2, p.barT / 2);
        if (i === 0) geo.name = 'bar';
        g.add(new THREE.Mesh(geo, mats.woodSeat));
      }

      const rail = new THREE.Mesh(new THREE.BoxGeometry(p.bay, p.railH, p.railD), mats.woodSeat);
      rail.position.set(0, h.railC, f.topZ);
      g.add(rail);

      // 每开间两端：涡卷 + 拉结件（剖面里的收头做法）
      for (const sgn of [-1, 1]) {
        const x0 = sgn * p.bay / 2;
        g.add(new THREE.Mesh(ribbonSpiral(THREE, {
          x0, cz: f.topZ, cy: h.railC, r0: 62, r1: 16, rib: 20, thick: 46, turns: 2.1, steps: 46,
        }), mats.woodSeat));
        const tie = new THREE.Mesh(new THREE.BoxGeometry(42, 43, f.topZ - f.colFaceZ), mats.wood);
        tie.position.set(x0, h.railC, (f.colFaceZ + f.topZ) / 2);
        g.add(tie);
      }
      mk.add(g);
    }
    group.add(mk);
  }

  // —— 攒尖顶：举折凹面 + 瓦垄 + 戗脊 + 宝顶 ————————————
  {
    const V = L.verts;
    const Re = L.plan.eaveR;
    const yE = h.eaveY;
    const yA = h.apexY;
    const NR = 22, Ns = 72;
    const rise = p.roofRise, T = p.roofT;
    const upturn = p.eaveUpturn, flare = p.cornerFlare;
    const rows = p.tileRows, amp = p.tileAmp;
    const ES = Re / p.bay;   // 檐口相对柱中线的放大
    const wc = (u) => Math.pow(Math.abs(2 * u - 1), 3);
    const wf = (u) => Math.pow(Math.abs(2 * u - 1), 5);

    const point = (fi, j, i, corr, dy) => {
      const t = i / NR, s = 1 - t, u = j / Ns;
      const A = V[fi], B = V[(fi + 1) % 6];
      const mul = ES * t * (1 + flare * wf(u) * t * t);
      const x = (A.x * (1 - u) + B.x * u) * mul;
      const z = (A.z * (1 - u) + B.z * u) * mul;
      const y = yE + rise * (0.62 * s + 0.38 * s * s) + upturn * wc(u) * t * t
        + (corr ? amp * Math.cos(Math.PI * 2 * rows * u) * Math.min(1, t * 3) : 0) + dy;
      return [x, y, z];
    };

    const surface = (corr, dy, mode) => {
      const pos = [], idx = [];
      pos.push(...point(0, 0, 0, corr, dy));
      for (let i = 1; i <= NR; i++) {
        for (let fi = 0; fi < 6; fi++) {
          for (let j = 0; j <= Ns; j++) pos.push(...point(fi, j, i, corr, dy));
        }
      }
      const vid = (i, fi, j) => 1 + (i - 1) * 6 * (Ns + 1) + fi * (Ns + 1) + j;
      for (let fi = 0; fi < 6; fi++) {
        for (let j = 0; j < Ns; j++) idx.push(0, vid(1, fi, j), vid(1, fi, j + 1));
      }
      for (let i = 1; i < NR; i++) {
        for (let fi = 0; fi < 6; fi++) {
          for (let j = 0; j < Ns; j++) {
            const A = vid(i, fi, j), B = vid(i + 1, fi, j);
            const C = vid(i, fi, j + 1), D = vid(i + 1, fi, j + 1);
            idx.push(A, B, C, C, B, D);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      if (mode === 'down') flipIndex(geo);
      return orient(THREE, geo, mode);
    };

    add(new THREE.Mesh(surface(true, 0, 'up'), mats.tile), 'roof');
    add(new THREE.Mesh(surface(false, -T, 'down'), mats.tile), 'roof-under');

    // 檐口封边（上下两面之间）
    {
      const pos = [], idx = [];
      for (let fi = 0; fi < 6; fi++) {
        for (let j = 0; j <= Ns; j++) {
          pos.push(...point(fi, j, NR, true, 0));
          pos.push(...point(fi, j, NR, false, -T));
        }
      }
      const vid = (fi, j, k) => (fi * (Ns + 1) + j) * 2 + k;
      for (let fi = 0; fi < 6; fi++) {
        for (let j = 0; j < Ns; j++) {
          idx.push(vid(fi, j, 0), vid(fi, j, 1), vid(fi, j + 1, 1));
          idx.push(vid(fi, j, 0), vid(fi, j + 1, 1), vid(fi, j + 1, 0));
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = mats.tile.clone();
      m.side = THREE.DoubleSide;
      add(new THREE.Mesh(geo, m), 'eave-cap');
    }

    // 六条戗脊，到檐口转角后继续向外上挑
    for (let k = 0; k < 6; k++) {
      const v = V[k];
      const dir = { x: Math.sin(v.a), z: Math.cos(v.a) };
      const pts = [], radii = [];
      for (let i = 1; i <= NR; i++) {
        const t = i / NR, s = 1 - t;
        const mul = ES * t * (1 + flare * t * t);
        pts.push([v.x * mul, yE + rise * (0.62 * s + 0.38 * s * s) + upturn * t * t + amp, v.z * mul]);
        radii.push(52);
      }
      const ex = v.x * ES * (1 + flare), ez = v.z * ES * (1 + flare), ey = yE + upturn + amp;
      for (const [r, up, rad] of [[50, 110, 46], [120, 230, 38], [195, 340, 26], [250, 430, 9]]) {
        pts.push([ex + dir.x * r, ey + up, ez + dir.z * r]);
        radii.push(rad);
      }
      add(new THREE.Mesh(sweepTube(THREE, pts, radii, 8), mats.hip), 'hip-' + k);
    }

    // 宝顶
    {
      const g = new THREE.Group();
      g.name = 'finial';
      g.position.y = yA;
      const put = (geo, y, name) => {
        const m = new THREE.Mesh(geo, mats.finial);
        m.position.y = y;
        m.name = name;
        g.add(m);
      };
      put(new THREE.CylinderGeometry(300, 340, 100, 6, 1, false, Math.PI / 6), -30, 'finial-base');
      put(new THREE.CylinderGeometry(220, 250, 90, 12), 65, 'finial-drum');
      put(new THREE.SphereGeometry(160, 24, 16), 260, 'finial-pearl');
      put(new THREE.CylinderGeometry(22, 80, 280, 12), 560, 'finial-spire');
      put(new THREE.SphereGeometry(52, 16, 12), 700, 'finial-tip');
      group.add(g);
    }
  }

  // —— 收尾：法线/阴影/包围盒/meta ———————————————————
  group.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });

  let triangles = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry;
    const count = geo.index ? geo.index.count : geo.getAttribute('position').count;
    triangles += count / 3;
  });

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const { materials, ...paramCopy } = p;

  group.userData.meta = {
    units: 'mm',
    up: 'Y',
    front: '+Z',
    origin: 'pavilion-center-ground',
    size: {
      width: +size.x.toFixed(1),
      depth: +size.z.toFixed(1),
      height: +size.y.toFixed(1),
      plan: { bay: p.bay, acrossFlats: +(p.bay * Math.cos(30 * DEG) * 2).toFixed(1),
        eaveAcrossFlats: +((p.bay + p.eaveOverhang) * Math.cos(30 * DEG) * 2).toFixed(1) },
    },
    triangles,
    params: paramCopy,
    meikao: { ...MEIKAO_SECTION, note: undefined },
    evidence: '美人靠剖面（座面、靠背、S 弯棂、涡卷、拉结件）取自示意图右半边；六角攒尖、三面临水、临水三面美人靠、背面实墙取自照片。',
    assumed: '开间、柱径柱高、檐口高、屋顶举高与出檐、瓦垄规格、台明高、屋顶厚度、戗角起翘都是按形制推定，不是实测。',
  };
  return group;
}

export default createPavilion;

// __END__



