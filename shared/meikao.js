/**
 * 美人靠（一段）— 独立三维参数化几何模块
 *
 * 参照现场实拍工程标准形制与《营造法原》吴王靠（飞来椅）法式：
 *   1) 基台座面：下部为规整基座，顶面为外挑座板（座高 460，深 400，前挑 80）；
 *   2) 通透安装地脚：底枋由 3 组带法兰底座的金属/木支撑立脚架空（悬空 55mm），通透通风；
 *   3) 底枋：通长矩形横梁（45×40mm），水平基准安装于座面后部（Z = -320）；
 *   4) 鹅颈靠背弯条：典型反 S 形双曲曲线板条（38mm 宽 × 26mm 实体厚度，共 19 根密排），
 *      底部垂直立起平滑入底枋卯槽，中部向外优美外拱拱出形成腰椎承托（外挺峰值达 119mm），
 *      顶部平滑内敛倾斜顺接二道枋（切线坡度与上部天窗立档自然吻合）；
 *   5) 二道枋（中横梁）：通长横梁（46×32mm），整体向外悬挑 100mm（Z = -420）；
 *   6) 上部透光天窗短档：矩形短立档（38×26mm，净高 73mm，设 3 根主立档），
 *      严格依下方弯条轴线对齐（取第 5 档、第 10 档、第 15 档弯条中心线贯通），
 *      与下方地脚立柱垂直三位一体共轴，形成 4-1-4-1-4-1-4 绝对对称的下密上疏大开间天窗；
 *   7) 宽扶手顶枋（寻杖）：宽大厚实的弧面顶枋（76×45mm，顶面圆角收边 R14），
 *      整体向外悬挑 140mm（Z = -460），形成经典临水凭栏后仰倚靠体态；
 *   8) 端部收口望柱：两端设立规整方柱（64×64mm），带方帽，顺应靠背斜度贯通锁定所有横构件。
 *
 * 单位 mm；Y 向上；正面（坐人/走廊侧）朝 +Z，靠背外凸/悬挑向 -Z（临园/临水方向）。
 */

const DEG = Math.PI / 180;

export const MEIKAO = {
  length: 1800,         // 一段总长 (mm)
  seatH: 460,           // 坐板台面高 (mm)
  seatD: 400,           // 坐板总进深 (z=0 前沿到 z=-400 后沿)
  seatThk: 36,          // 坐面板厚度 (mm)

  wall: true,           // 是否生成座下基台矮墙
  wallT: 320,           // 矮墙厚度 (mm)
  wallFrontOver: 80,    // 坐面板比墙身向前挑出深度 (mm)
  wallBackOver: 0,      // 坐面板后沿与墙身后沿齐平

  footZ: -320,          // 栏杆底枋安装中心线 z（前部留出 320mm 舒适坐人进深）
  footH: 55,            // 地脚净空高度（底枋下悬空高度）
  footW: 42,            // 支撑立脚宽 (X)
  footD: 42,            // 支撑立脚厚 (Z)
  footBaseW: 72,        // 地脚安装法兰盘宽
  footBaseD: 72,        // 地脚安装法兰盘长
  footBaseH: 8,         // 地脚安装法兰盘厚

  baseRailH: 40,        // 底枋高 (Y)
  baseRailD: 45,        // 底枋宽 (Z)

  barH: 335,            // S 弯条净高 (Y: 底枋顶 555 到二道枋底 890)
  barW: 38,             // 弯条看面宽 (X)
  barT: 26,             // 弯条厚度 (法向实体厚度 26mm)
  barPitch: 88,         // 弯条中心间距 (19 档)
  secondLean: 100,      // 二道枋相对底枋中心线向外悬挑位移 (mm, -Z 方向)
  topLean: 140,         // 顶枋寻杖扶手相对底枋安装中心线向外悬挑位移 (mm, -Z 方向)
  barBulge: 65,         // 鹅颈反 S 曲线腰部外拱增量 (使得腰部外挺峰值达 119mm)
  barSeg: 48,           // 曲线细分段数

  secondRailH: 32,      // 二道枋高 (Y)
  secondRailD: 46,      // 二道枋宽 (Z)

  slatH: 73,            // 上部短立档垂直净高 (Y: 二道枋顶 922 到顶枋底 995)
  slatW: 38,            // 短立档宽 (X)
  slatT: 26,            // 短立档厚 (Z)

  topRailH: 45,         // 顶枋扶手高 (Y)
  topRailD: 76,         // 顶枋扶手宽 (Z)
  crownH: 14,           // 扶手顶面弧形倒角半径 R14

  endPosts: true,       // 两端是否生成端立柱（望柱）
  postW: 64,            // 端柱截面宽 (X)
  postD: 64,            // 端柱截面长 (Z)
  postCapH: 20,         // 端柱柱帽高 (Y)
  postOverH: 20,        // 端柱高出顶枋高度

  materials: null,      // 材质覆盖
};

export function buildMeikaoLayout(options = {}) {
  const p = { ...MEIKAO, ...options };
  const half = p.length / 2;

  const seatTop = p.seatH;
  const seatFront = 0;
  const seatBack = -p.seatD;

  const wallBack = seatBack + p.wallBackOver;
  const wallFront = wallBack + p.wallT;
  const wallBodyBottom = 0;
  const wallBodyTop = seatTop - p.seatThk;

  const footZ = p.footZ;
  const blockTop = seatTop + p.footH;          // 底枋底面 (515)
  const baseRailTop = blockTop + p.baseRailH;  // 底枋顶面 (555)
  const barFoot = baseRailTop;                 // 弯条下端 (555)
  const barTopY = barFoot + p.barH;            // 弯条上端＝二道枋底面 (890)

  const secBot = barTopY;
  const secTop = secBot + p.secondRailH;       // 二道枋顶面 (922)
  const secZ = footZ - (p.secondLean ?? 100);  // 二道枋中心 Z (-420)
  const railBot = secTop + p.slatH;            // 顶枋底面 (995)
  const railTop = railBot + p.topRailH;        // 顶枋顶面 (1040)
  const railC = (railBot + railTop) / 2;
  const railZ = footZ - (p.topLean ?? 140);    // 顶枋中心 Z (-460)

  // 端柱参数
  const hasPosts = p.endPosts !== false;
  const postW = hasPosts ? p.postW : 0;
  const postD = hasPosts ? p.postD : 0;
  const clearSpan = hasPosts ? Math.max(120, p.length - 2 * postW) : p.length;
  const railLen = clearSpan;

  // 鹅颈反 S 双曲曲线: t in [0, 1] 从底枋 (0, 555) 到二道枋 (-100, 890)
  // 底部垂直立起（导数0），中部向外腰拱外挺达到承托峰值 (Z = footZ - 119mm)，
  // 顶部内敛倾斜顺接二道枋（切线角与上部短立档完全一致）
  const curveSeg = Math.max(24, Math.round(p.barSeg || 48));
  const curvePts = [];
  let peakZ = footZ, bulgeAt = 0.5;
  const Z_SEC_REL = -(p.secondLean ?? 100.0);
  const m1 = -100.0; // 顶端切线坡度，吻合上部短档 (-40/73)

  for (let i = 0; i <= curveSeg; i++) {
    const t = i / curveSeg;
    const h01 = -2.0 * t**3 + 3.0 * t**2;
    const h11 = t**3 - t**2;
    const zBase = Z_SEC_REL * h01 + m1 * h11;
    const bulge = -(p.barBulge ?? 65.0) * (Math.sin(Math.PI * t) ** 1.6) * (1.0 + 0.35 * (1.0 - t));
    const curZ = footZ + zBase + bulge;
    const curY = barFoot + p.barH * t;
    curvePts.push([curZ, curY]);
    if (curZ < peakZ) {
      peakZ = curZ;
      bulgeAt = t;
    }
  }
  const bulgeMax = Math.abs(peakZ - footZ);

  // 下部鹅颈弯条排布：实物标准密排，承托腰背
  const barCount = p.barCount ?? Math.max(2, Math.round(clearSpan / p.barPitch));
  const barPitch = clearSpan / barCount;
  const barW = Math.min(p.barW, barPitch - 12);
  const barGap = barPitch - barW;

  const barXs = [];
  for (let i = 0; i < barCount; i++) {
    const x = -clearSpan / 2 + (i + 0.5) * barPitch;
    barXs.push(x);
  }

  // 扶手顶短立档与地脚支撑立柱：严格对齐下方的弯条中心线（依下部弯条对齐，非机械平分）
  // 19 档弯条时，对称选取第 5 档 (idx 4)、第 10 档 (idx 9，正中)、第 15 档 (idx 14)
  // 形成 4-1-4-1-4-1-4 绝对对称的模数韵律
  const strutIndices = p.strutIndices ?? (barCount === 19 ? [4, 9, 14] : (() => {
    const n = Math.max(1, Math.round((barCount - 1) / 5));
    const res = [];
    for (let k = 1; k <= n; k++) {
      res.push(Math.round((k * (barCount - 1)) / (n + 1)));
    }
    return res;
  })());
  const strutXs = strutIndices.map((idx) => barXs[idx]);
  const slatXs = strutXs;
  const footXs = strutXs;
  const slatCount = strutXs.length;
  const footCount = strutXs.length;

  // 净坐深
  const seatClear = seatFront - (footZ + p.baseRailD / 2);

  return {
    params: p, half,
    seatTop, seatFront, seatBack, seatD: p.seatD,
    footZ, railZ, secZ, secondLean: p.secondLean, topLean: p.topLean,
    blockTop, baseRailTop, barFoot, barTopY,
    secBot, secTop, railBot, railC, railTop,
    hasPosts, postW, postD, clearSpan, railLen,
    barCount, barPitch, barW, barGap, barXs,
    strutIndices, slatCount, slatXs,
    footCount, footXs,
    curvePts, bulgeMax, bulgeAt,
    seatClear,
    wall: {
      on: p.wall !== false,
      t: p.wallT,
      front: wallFront,
      back: wallBack,
      zc: (wallFront + wallBack) / 2,
      top: wallBodyTop,
      bottom: wallBodyBottom,
      bodyH: wallBodyTop - wallBodyBottom,
      len: p.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 几何生成辅助工具
// ---------------------------------------------------------------------------

function matSet(THREE, custom) {
  const m = (color, roughness, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return Object.assign({
    wood: m(0x38271d, 0.52, 0.05),       // 深色漆木（底枋、中枋、顶枋、端柱）
    woodSeat: m(0x3e2c21, 0.48, 0.05),   // 弯条、短档
    stone: m(0xdcd7cc, 0.92),            // 浅素白基座墙身
    stoneCap: m(0xa3a5a0, 0.82),         // 坐席压顶石面
    metal: m(0x282624, 0.42, 0.35),      // 安装地脚码与法兰盘
  }, custom || {});
}

function flipIndex(geo) {
  const a = geo.index.array;
  for (let i = 0; i < a.length; i += 3) {
    const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t;
  }
  geo.index.needsUpdate = true;
}

function orient(THREE, geo) {
  const pos = geo.getAttribute('position');
  const idx = geo.index;
  let acc = 0;
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    const ax = pos.getX(i0), ay = pos.getY(i0), az = pos.getZ(i0);
    const bx = pos.getX(i1), by = pos.getY(i1), bz = pos.getZ(i1);
    const cx = pos.getX(i2), cy = pos.getY(i2), cz = pos.getZ(i2);
    acc += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  if (acc <= 0) flipIndex(geo);
  geo.computeVertexNormals();
  return geo;
}

// 将 2D 曲线 (z,y) 扫掠成带实体厚度的条柱
function sweepBar(THREE, pts, xc, halfW, halfT) {
  const pos = [], idx = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
    let tz = p1[0] - p0[0], ty = p1[1] - p0[1];
    const L0 = Math.hypot(tz, ty) || 1;
    tz /= L0; ty /= L0;
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
  return orient(THREE, geo);
}

// 顶枋扶手：带微拱圆角顶面
function createHandrailGeo(THREE, length, height, depth) {
  const shape = new THREE.Shape();
  const hw = depth / 2, hh = height / 2;
  const r = 14; // 顶角倒圆 R14
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: length,
    bevelEnabled: false,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.rotateY(Math.PI / 2);
  geo.translate(-length / 2, 0, 0); // 中心居中: X 从 -length/2 到 +length/2
  return geo;
}

// ---------------------------------------------------------------------------
// 主构件装配
// ---------------------------------------------------------------------------

export function createMeikao(THREE, options = {}) {
  const L = buildMeikaoLayout(options);
  const p = L.params;
  const group = new THREE.Group();
  group.name = 'meikao';
  const mats = matSet(THREE, options.materials);

  const add = (obj, name) => {
    obj.name = name;
    obj.castShadow = true;
    obj.receiveShadow = true;
    group.add(obj);
    return obj;
  };
  const mesh = (geo, mat, name) => add(new THREE.Mesh(geo, mat), name);

  // 1) 座下基座墙身与石压板（提供真实宽敞坐席深度）
  if (L.wall.on) {
    const w = L.wall;
    const body = mesh(
      new THREE.BoxGeometry(w.len, w.bodyH, w.t),
      mats.stone, 'seat-wall-body');
    body.position.set(0, w.bottom + w.bodyH / 2, w.zc);

    const cap = mesh(
      new THREE.BoxGeometry(w.len, p.seatThk, p.seatD),
      mats.stoneCap, 'seat-cap');
    cap.position.set(0, L.seatTop - p.seatThk / 2, (L.seatFront + L.seatBack) / 2);
  }

  // 2) 端部收口望柱（两端立柱）
  // 顺应靠背悬挑坡度倾斜设立，底部生根于座面，顶出覆斗方帽
  if (L.hasPosts) {
    const totalDZ = L.railZ - L.footZ; // -140
    const totalDY = L.railTop + p.postOverH - L.seatTop; // 600
    const postTilt = Math.atan2(totalDZ, totalDY);
    const postLen = Math.hypot(totalDZ, totalDY);
    const postGeo = new THREE.BoxGeometry(p.postW, postLen, p.postD);
    const capGeo = new THREE.ConeGeometry(p.postW * 0.72, p.postCapH, 4);
    capGeo.rotateY(Math.PI / 4);

    const postCenterY = L.seatTop + totalDY / 2;
    const postCenterZ = L.footZ + totalDZ / 2;

    for (const sx of [-1, 1]) {
      const px = sx * (p.length / 2 - p.postW / 2);
      const post = mesh(postGeo, mats.wood, 'end-post-' + (sx < 0 ? 'L' : 'R'));
      post.position.set(px, postCenterY, postCenterZ);
      post.rotation.x = postTilt;

      const pCap = mesh(capGeo, mats.wood, 'end-post-cap-' + (sx < 0 ? 'L' : 'R'));
      pCap.position.set(px, L.railTop + p.postOverH + p.postCapH / 2, L.railZ);
      pCap.rotation.x = postTilt;
    }
  }

  // 3) 通透安装地脚（支撑立脚与法兰底座，严格与对应弯条及上部立档同轴）
  const footPostGeo = new THREE.BoxGeometry(p.footW, p.footH, p.footD);
  const footBaseGeo = new THREE.BoxGeometry(p.footBaseW, p.footBaseH, p.footBaseD);
  L.footXs.forEach((fx, i) => {
    const basePlate = mesh(footBaseGeo, mats.metal, 'foot-base-' + i);
    basePlate.position.set(fx, L.seatTop + p.footBaseH / 2, L.footZ);

    const post = mesh(footPostGeo, mats.metal, 'foot-post-' + i);
    post.position.set(fx, L.seatTop + p.footH / 2, L.footZ);
  });

  // 4) 底枋（通长下导梁，安装中心在 footZ = -320）
  const baseRail = mesh(
    new THREE.BoxGeometry(L.railLen, p.baseRailH, p.baseRailD),
    mats.wood, 'base-rail');
  baseRail.position.set(0, L.blockTop + p.baseRailH / 2, L.footZ);

  // 5) S 形双曲鹅颈弯条（19 根密排人体工学托背）
  const barPts = L.curvePts;
  L.barXs.forEach((bx, i) => {
    mesh(sweepBar(THREE, barPts, bx, L.barW / 2, p.barT / 2), mats.woodSeat, 'curve-bar-' + i);
  });

  // 6) 二道枋（中横梁，向外悬挑 100mm，位于 secZ = -420）
  const secRail = mesh(
    new THREE.BoxGeometry(L.railLen, p.secondRailH, p.secondRailD),
    mats.wood, 'second-rail');
  secRail.position.set(0, L.secBot + p.secondRailH / 2, L.secZ);

  // 7) 上部透光短立档（天窗格，顺坡斜接，严格对齐第 5、10、15 根弯条及下部地脚）
  const dZ = L.railZ - L.secZ; // -40mm
  const dY = L.railBot - L.secTop; // 73mm
  const slatLen = Math.hypot(dZ, dY);
  const slatRotX = Math.atan2(dZ, dY); // 顺坡倾角
  const slatCenterY = (L.secTop + L.railBot) / 2;
  const slatCenterZ = (L.secZ + L.railZ) / 2;
  const slatGeo = new THREE.BoxGeometry(p.slatW, slatLen, p.slatT);

  L.slatXs.forEach((sx, i) => {
    const slat = mesh(slatGeo, mats.woodSeat, 'upper-slat-' + i);
    slat.position.set(sx, slatCenterY, slatCenterZ);
    slat.rotation.x = slatRotX;
  });

  // 8) 宽扶手顶枋（寻杖，向外悬挑 140mm，位于 railZ = -460）
  const handrailGeo = createHandrailGeo(THREE, L.railLen, p.topRailH, p.topRailD);
  const topRail = mesh(handrailGeo, mats.wood, 'top-handrail');
  topRail.position.set(0, L.railC, L.railZ);

  let triangles = 0;
  group.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.index) triangles += o.geometry.index.count / 3;
    else if (o.isMesh && o.geometry && o.geometry.attributes.position) {
      triangles += o.geometry.attributes.position.count / 3;
    }
  });

  group.userData.meta = {
    kind: 'meikao-segment-standard',
    units: 'mm',
    triangles: Math.round(triangles),
    size: {
      width: p.length,
      depth: p.seatD,
      height: +L.railTop.toFixed(1),
      seatTop: L.seatTop,
      seatClear: +L.seatClear.toFixed(1),
      railTop: +L.railTop.toFixed(1),
    },
    section: {
      seatTop: L.seatTop,
      gapH: p.footH,
      baseRailTop: +L.baseRailTop.toFixed(1),
      barH: p.barH,
      barBulge: +L.bulgeMax.toFixed(1),
      secondLean: p.secondLean,
      topLean: p.topLean,
      secondRailTop: +L.secTop.toFixed(1),
      slatH: p.slatH,
      topRailTop: +L.railTop.toFixed(1),
      barCount: L.barCount,
      slatCount: L.slatCount,
      strutIndices: L.strutIndices,
      barPitch: +L.barPitch.toFixed(1),
      barW: +L.barW.toFixed(1),
      barGap: +L.barGap.toFixed(1),
    },
  };

  return group;
}
