// ---------------------------------------------------------------------------
// rockery-sdf.js — Procedural Taihu Rockery Generator (姑苏太湖石与叠石假山)
// Pure JS implicit field + Surface Nets with baked AO and karst GLSL shader.
// Captures the four classical literati aesthetics:
//   "皱" (Wrinkled): Vertical dissolution rills and water-carved flutes.
//   "漏" (Leaking): Deep interior hollows, rain-dripping channels, and cavern pockets.
//   "瘦" (Lean): Slender upward posture, tapered waist, flared cantilevered crown.
//   "透" (Porous): Real through-holes (穿孔透光) allowing gazes and sunlight to pass through.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

// --- Smooth boolean math ---
const max = Math.max, min = Math.min, abs = Math.abs, sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos;

export function smin(a, b, k = 0.1) {
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
}

export function smax(a, b, k = 0.1) {
  const h = max(k - abs(a - b), 0) / k;
  return max(a, b) + h * h * k * 0.25;
}

// Fast 3D hash & value noise
function hash3(x, y, z) {
  const n = sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const n000 = hash3(ix, iy, iz), n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz), n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1), n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1), n111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = n000 * (1 - ux) + n100 * ux;
  const x10 = n010 * (1 - ux) + n110 * ux;
  const x01 = n001 * (1 - ux) + n101 * ux;
  const x11 = n011 * (1 - ux) + n111 * ux;

  const y0 = x00 * (1 - uy) + x10 * uy;
  const y1 = x01 * (1 - uy) + x11 * uy;

  return (y0 * (1 - uz) + y1 * uz) * 2 - 1;
}

function fbm3(x, y, z, octaves = 3) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise3(x * freq, y * freq, z * freq) * amp;
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

// Distance to capsule (curved line segment)
function capsuleDist(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const h = max(0, min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return sqrt(dx * dx + dy * dy + dz * dz) - r;
}

// ---------------------------------------------------------------------------
// Taihu Peak Field: generates the SDF function for a single peak
// ---------------------------------------------------------------------------
export function createTaihuPeakField({
  height = 3.8,
  baseRadius = 0.45,
  lean = 0.35,
  seed = 42,
  tunnels = null,
} = {}) {
  // Default through-holes (穿孔透光)
  const holeList = tunnels || [
    // Waist through-hole (X-axis penetration)
    { a: [-1.4, height * 0.38, 0.05], b: [1.4, height * 0.39, -0.05], r: 0.22 },
    // Upper diagonal through-hole (sunlight penetrates toward viewer)
    { a: [-1.0, height * 0.65, -0.7], b: [1.0, height * 0.68, 0.7], r: 0.25 },
    // High eyelet (透天孔)
    { a: [0.6, height * 0.85, -0.8], b: [-0.4, height * 0.86, 0.8], r: 0.16 },
    // Lower water scoop / secondary hole
    { a: [-0.9, height * 0.20, 0.35], b: [0.9, height * 0.18, -0.35], r: 0.19 },
    // Vertical twisting interior hollow channel (漏 - chimney)
    { a: [0.05, height * 0.25, 0.0], b: [-0.15, height * 0.75, 0.1], r: 0.16 },
  ];

  return function sdf(x, y, z) {
    if (y < -0.15 || y > height + 0.35) return 1.0;

    const t = y / height;

    // "瘦": S-curve dynamic posture, lean & twist
    const cx = sin(t * Math.PI * 1.1 + seed) * lean + sin(t * 5.2 + seed * 2) * 0.06;
    const cz = cos(t * Math.PI * 0.85 + seed) * (lean * 0.7) + cos(t * 4.3 + seed * 3) * 0.05;
    const px = x - cx;
    const pz = z - cz;

    // Slender waist, swelling shoulders, jagged crown
    let rad = baseRadius * (1.0 - t * 0.25);
    rad += 0.22 * sin(t * Math.PI); // belly & shoulder
    rad += 0.12 * sin(t * Math.PI * 3.2); // vertical knuckles

    // Lobed cross-section (3-4 lobes)
    const angle = Math.atan2(pz, px);
    const lobe = 1.0 + 0.26 * sin(angle * 3.0 + t * 4.0 + seed) + 0.14 * cos(angle * 5.0 - t * 2.0);
    const dist2D = sqrt(px * px + pz * pz) - rad * lobe;

    // Vertical envelope
    let d = max(dist2D, max(-y, y - height));

    // "皱": Directional vertical water dissolution grooves (溶蚀水痕沟槽)
    const flute = sin(angle * 12.0 + px * 3.5) * 0.038 * (0.45 + 0.55 * sin(y * 7.0));
    d += flute;

    // Multi-octave karst noise
    const nKarst = fbm3(x * 1.8 + seed * 3.1, y * 2.2 + seed * 2.3, z * 1.8 + seed * 1.7, 3) * 0.13;
    d -= nKarst;

    // "透": Subtract through-holes with smooth rounded lips
    for (const tn of holeList) {
      const td = capsuleDist(x, y, z, tn.a[0], tn.a[1], tn.a[2], tn.b[0], tn.b[1], tn.b[2], tn.r);
      d = smax(d, -td, 0.13);
    }

    // "漏": Hollow pockets / water-scoop cavities
    const scoop1 = capsuleDist(x, y, z, 0.35, height * 0.52, 0.25, 0.6, height * 0.56, 0.35, 0.24);
    d = smax(d, -scoop1, 0.14);
    const scoop2 = capsuleDist(x, y, z, -0.32, height * 0.72, -0.22, -0.5, height * 0.76, -0.3, 0.21);
    d = smax(d, -scoop2, 0.14);

    return d;
  };
}

// ---------------------------------------------------------------------------
// Fast Surface Nets: extracts watertight mesh with analytic normals and AO
// ---------------------------------------------------------------------------
export function extractSurfaceNets(field, bmin, bmax, h) {
  const nx = Math.ceil((bmax[0] - bmin[0]) / h) + 1;
  const ny = Math.ceil((bmax[1] - bmin[1]) / h) + 1;
  const nz = Math.ceil((bmax[2] - bmin[2]) / h) + 1;
  const sxy = nx * ny;
  const V = new Float32Array(sxy * nz);

  for (let k = 0; k < nz; k++) {
    const z = bmin[2] + k * h;
    for (let j = 0; j < ny; j++) {
      const y = bmin[1] + j * h;
      for (let i = 0; i < nx; i++) {
        V[i + j * nx + k * sxy] = field(bmin[0] + i * h, y, z);
      }
    }
  }

  const cell = new Int32Array(sxy * nz).fill(-1);
  const pos = [];
  const off = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1];
  const cb = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const idx = i + j * nx + k * sxy;
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = V[idx + off[c]];
          val[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (let q = 0; q < 12; q++) {
          const a = E[q][0], b = E[q][1];
          const va = val[a], vb = val[b];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          sx += cb[a][0] + (cb[b][0] - cb[a][0]) * t;
          sy += cb[a][1] + (cb[b][1] - cb[a][1]) * t;
          sz += cb[a][2] + (cb[b][2] - cb[a][2]) * t;
          cnt++;
        }
        cell[idx] = pos.length / 3;
        pos.push(bmin[0] + (i + sx / cnt) * h, bmin[1] + (j + sy / cnt) * h, bmin[2] + (k + sz / cnt) * h);
      }
    }
  }

  const idxs = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    idxs.push(a, b, c, a, c, d);
  };

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = i + j * nx + k * sxy;
        const inside = V[idx] < 0;
        if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
          if (inside !== (V[idx + 1] < 0)) quad(cell[idx - nx - sxy], cell[idx - sxy], cell[idx], cell[idx - nx], !inside);
        }
        if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
          if (inside !== (V[idx + nx] < 0)) quad(cell[idx - 1 - sxy], cell[idx - 1], cell[idx], cell[idx - sxy], !inside);
        }
        if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
          if (inside !== (V[idx + sxy] < 0)) quad(cell[idx - 1 - nx], cell[idx - nx], cell[idx], cell[idx - 1], !inside);
        }
      }
    }
  }

  // Calculate normals and AO
  const nv = pos.length / 3;
  const P3 = new Float32Array(pos);
  const N3 = new Float32Array(nv * 3);
  const C3 = new Float32Array(nv * 3);
  const eps = h * 0.4;
  for (let v = 0; v < nv; v++) {
    const x = P3[v * 3], y = P3[v * 3 + 1], z = P3[v * 3 + 2];
    const gx = field(x + eps, y, z) - field(x - eps, y, z);
    const gy = field(x, y + eps, z) - field(x, y - eps, z);
    const gz = field(x, y, z + eps) - field(x, y, z - eps);
    const gl = sqrt(gx * gx + gy * gy + gz * gz) || 1;
    const nx = gx / gl, ny = gy / gl, nz = gz / gl;
    N3[v * 3] = nx; N3[v * 3 + 1] = ny; N3[v * 3 + 2] = nz;

    // Ambient occlusion: sample outward along normal
    let occ = 0;
    for (let s = 1; s <= 3; s++) {
      const d = 0.08 * s;
      const val = field(x + nx * d, y + ny * d, z + nz * d);
      occ += max(0, d - val);
    }
    const ao = max(0.18, min(1.0, 1.0 - occ * 2.6));
    C3[v * 3] = ao;
    C3[v * 3 + 1] = ao;
    C3[v * 3 + 2] = ao;
  }

  // Robust winding check against normals
  const I = nv > 65535 ? new Uint32Array(idxs) : new Uint16Array(idxs);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P3[b] - P3[a], uy = P3[b + 1] - P3[a + 1], uz = P3[b + 2] - P3[a + 2];
    const vx = P3[c] - P3[a], vy = P3[c + 1] - P3[a + 1], vz = P3[c + 2] - P3[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nn = (N3[a] + N3[b] + N3[c]) * fx + (N3[a + 1] + N3[b + 1] + N3[c + 1]) * fy + (N3[a + 2] + N3[b + 2] + N3[c + 2]) * fz;
    if (nn < 0) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P3, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N3, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C3, 3));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------------------
// Classical Carved Sumeru Pedestal (雕花须弥座)
// ---------------------------------------------------------------------------
export function createPedestalGeometry({
  width = 1.3,
  depth = 1.1,
  height = 0.52,
  inset = 0.12,
} = {}) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  // Multi-tier stepped Sumeru base
  const tiers = [
    { y: 0.05, h: 0.10, w: width, d: depth },                   // Lower plinth (下枋)
    { y: 0.14, h: 0.08, w: width - 0.06, d: depth - 0.06 },    // Lower downward lotus tier (下枭)
    { y: 0.25, h: 0.14, w: width - inset * 2, d: depth - inset * 2 }, // Waist constriction (束腰)
    { y: 0.36, h: 0.08, w: width - 0.06, d: depth - 0.06 },    // Upper upward lotus tier (上枭)
    { y: 0.45, h: 0.10, w: width, d: depth },                   // Upper capstone (上枋)
  ];

  const pos = [], nrm = [], uv = [], idx = [];
  let vOffset = 0;

  for (const t of tiers) {
    const hw = t.w * 0.5, hd = t.d * 0.5, y0 = t.y - t.h * 0.5, y1 = t.y + t.h * 0.5;
    // 6 faces of box
    const fVerts = [
      // Top face
      [-hw, y1, -hd, 0, 1, 0, 0, 0], [hw, y1, -hd, 0, 1, 0, 1, 0], [hw, y1, hd, 0, 1, 0, 1, 1], [-hw, y1, hd, 0, 1, 0, 0, 1],
      // Bottom face
      [-hw, y0, hd, 0, -1, 0, 0, 0], [hw, y0, hd, 0, -1, 0, 1, 0], [hw, y0, -hd, 0, -1, 0, 1, 1], [-hw, y0, -hd, 0, -1, 0, 0, 1],
      // Front face (+Z)
      [-hw, y0, hd, 0, 0, 1, 0, 0], [hw, y0, hd, 0, 0, 1, 1, 0], [hw, y1, hd, 0, 0, 1, 1, 1], [-hw, y1, hd, 0, 0, 1, 0, 1],
      // Back face (-Z)
      [hw, y0, -hd, 0, 0, -1, 0, 0], [-hw, y0, -hd, 0, 0, -1, 1, 0], [-hw, y1, -hd, 0, 0, -1, 1, 1], [hw, y1, -hd, 0, 0, -1, 0, 1],
      // Left face (-X)
      [-hw, y0, -hd, -1, 0, 0, 0, 0], [-hw, y0, hd, -1, 0, 0, 1, 0], [-hw, y1, hd, -1, 0, 0, 1, 1], [-hw, y1, -hd, -1, 0, 0, 0, 1],
      // Right face (+X)
      [hw, y0, hd, 1, 0, 0, 0, 0], [hw, y0, -hd, 1, 0, 0, 1, 0], [hw, y1, -hd, 1, 0, 0, 1, 1], [hw, y1, hd, 1, 0, 0, 0, 1],
    ];

    for (const v of fVerts) {
      pos.push(v[0], v[1], v[2]);
      nrm.push(v[3], v[4], v[5]);
      uv.push(v[6], v[7]);
    }
    for (let f = 0; f < 6; f++) {
      const o = vOffset + f * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    vOffset += 24;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Taihu Stone Material Hook with Karst GLSL shader
// ---------------------------------------------------------------------------
export function makeTaihuMaterial(ctx, { mossAmt = '0.65', tint = 'vec3(1.0)' } = {}) {
  const hooks = {
    fragHead: /* glsl */ `float g_h; float g_moss;`,
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
        float vAo = clamp(vColor.r, 0.15, 1.0);
        float big = n_fbm3(wp * 0.45, 4);
        float med = n_fbm3(wp * 2.2 + 2.0, 3);
        float micro = n_snoise3(wp * 32.0);

        // Karst limestone: pale chalky slate-grey with soft tone variation
        vec3 baseCol = vec3(0.55, 0.57, 0.58) * ${tint} * (0.86 + 0.25 * big);

        // Rainwater dissolution streaks (vertical flutes)
        float rill = n_fbm3(wp * vec3(6.5, 0.4, 6.5) + 1.2, 3);
        baseCol *= 1.0 - smoothstep(0.18, 0.72, rill) * 0.28 * (1.0 - abs(wn.y));

        // Subtle mineral oxidation (ochre-tinted dry hollows)
        float ochre = smoothstep(0.62, 0.82, n_fbm3(wp * 1.6 + 4.0, 3) * 0.5 + 0.5);
        baseCol = mix(baseCol, vec3(0.46, 0.40, 0.28), ochre * 0.35);

        // Cavity ambient occlusion shadow
        baseCol *= mix(0.35, 1.0, vAo);

        // Velvet moss on upward ledges and concave pockets
        float up = smoothstep(0.25, 0.82, wn.y);
        float mn = n_fbm3(wp * 2.2 + 6.5, 4) * 0.5 + 0.5;
        g_moss = clamp(smoothstep(0.56 - 0.38 * up * ${mossAmt}, 0.82, mn + up * 0.2) * ${mossAmt}, 0.0, 1.0);
        vec3 mossCol = mix(vec3(0.035, 0.062, 0.014), vec3(0.11, 0.15, 0.032), n_snoise3(wp * 12.0) * 0.5 + 0.5);
        vec3 finalCol = mix(baseCol, mossCol, g_moss);

        // Waterline wet band if touching pond surface
        float above = wp.y - (-0.55);
        float wet = 1.0 - smoothstep(0.04, 0.18, above);
        finalCol *= mix(1.0, 0.42, wet);

        diffuseColor.rgb *= finalCol;
        g_h = big * 0.4 + med * 0.2 + micro * 0.06 + g_moss * 0.35;
      }
    `,
    fragRough: /* glsl */ `
      roughnessFactor = mix(0.85, 0.22, g_moss * 0.08 + (1.0 - smoothstep(0.04, 0.18, vWPos.y - (-0.55))) * 0.7);
    `,
    fragNormal: /* glsl */ `
      normal = n_bumpView(-vViewPosition, normal, g_h, 0.0035);
    `,
  };

  return ctx.mat.std({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
    vertexColors: true,
  }, hooks);
}

// ---------------------------------------------------------------------------
// Standalone Peak Assembler: creates a peak + optional Sumeru pedestal
// ---------------------------------------------------------------------------
export function buildTaihuPeak(ctx, {
  height = 3.8,
  lean = 0.35,
  seed = 42,
  hasPedestal = true,
  gridStep = 0.075,
  pos = [0, 0, 0],
  rotY = 0,
} = {}) {
  const group = new THREE.Group();
  group.name = 'taihuPeak';

  const field = createTaihuPeakField({ height, lean, seed });
  const span = 1.35;
  const bmin = [-span, -0.1, -span];
  const bmax = [span, height + 0.25, span];

  const peakGeo = extractSurfaceNets(field, bmin, bmax, gridStep);
  const taihuMat = makeTaihuMaterial(ctx);

  const peakMesh = new THREE.Mesh(peakGeo, taihuMat);
  peakMesh.castShadow = true;
  peakMesh.receiveShadow = true;

  if (hasPedestal) {
    const pedGeo = createPedestalGeometry({ width: 1.25, depth: 1.05, height: 0.52 });
    const pedMat = ctx.M ? ctx.M.granite : ctx.mat.std({ color: 0x888888, roughness: 0.8 });
    const pedMesh = new THREE.Mesh(pedGeo, pedMat);
    pedMesh.castShadow = true;
    pedMesh.receiveShadow = true;
    pedMesh.position.y = 0;

    // Place peak on top of pedestal
    peakMesh.position.y = 0.48;
    group.add(pedMesh);
  }

  group.add(peakMesh);
  group.position.set(...pos);
  group.rotation.y = rotY;

  return group;
}

// ---------------------------------------------------------------------------
// Auxiliary Courtyard Stones & Water Spurs (小石峰与叠石驳岸水矶)
// ---------------------------------------------------------------------------
export function buildCourtyardPeak(ctx, {
  height = 2.0,
  seed = 101,
  gridStep = 0.07,
  pos = [0, 0, 0],
  rotY = 0,
} = {}) {
  const group = new THREE.Group();
  group.name = 'courtyardTaihuPeak';

  const tunnels = [
    { a: [-0.8, height * 0.45, 0.0], b: [0.8, height * 0.46, 0.0], r: 0.15 },
    { a: [0.0, height * 0.70, -0.6], b: [0.0, height * 0.72, 0.6], r: 0.14 },
  ];

  const field = createTaihuPeakField({ height, baseRadius: 0.35, lean: 0.22, seed, tunnels });
  const span = 0.95;
  const geo = extractSurfaceNets(field, [-span, -0.1, -span], [span, height + 0.2, span], gridStep);
  const mat = makeTaihuMaterial(ctx);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  group.add(mesh);
  group.position.set(...pos);
  group.rotation.y = rotY;

  return group;
}
