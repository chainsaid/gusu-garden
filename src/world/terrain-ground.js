// ---------------------------------------------------------------------------
// Courtyard ground: one high resolution height-field mesh (gravel / moss /
// soil / pond bed) with a single procedural material driven by a signed
// distance mask texture (moss edge, soil edge, rake obstacle distance).
// ---------------------------------------------------------------------------
import { TG_GLSL, MOSS_GLSL, NEAR_GLSL } from './terrain-glsl.js';

export function buildGround(ctx, F) {
  const { THREE } = ctx;
  const { DOM, grid } = F;
  const { CELL, NX, NZ, gMoss, gSoil, gH, gPath } = grid;

  // ---- mesh (vertices on every 2nd mask cell) ----
  const STEP = ctx.quality === 'realtime' ? 4 : 2;
  const nx = Math.floor((NX - 1) / STEP) + 1, nz = Math.floor((NZ - 1) / STEP) + 1;
  const dx = CELL * STEP;
  const skirt = 1;
  const vx = nx, vz = nz;
  const count = vx * vz + 2 * (vx + vz) * 2;
  const pos = new Float32Array(vx * vz * 3);
  const nrm = new Float32Array(vx * vz * 3);
  const H = (i, j) => gH[Math.min(j * STEP, NZ - 1) * NX + Math.min(i * STEP, NX - 1)];
  for (let j = 0; j < vz; j++) {
    for (let i = 0; i < vx; i++) {
      const k = (j * vx + i) * 3;
      pos[k] = DOM.minX + i * dx; pos[k + 1] = H(i, j); pos[k + 2] = DOM.minZ + j * dx;
      const hl = H(Math.max(i - 1, 0), j), hr = H(Math.min(i + 1, vx - 1), j);
      const hd = H(i, Math.max(j - 1, 0)), hu = H(i, Math.min(j + 1, vz - 1));
      let gx = (hr - hl) / (2 * dx), gz = (hu - hd) / (2 * dx);
      const l = Math.hypot(gx, 1, gz);
      nrm[k] = -gx / l; nrm[k + 1] = 1 / l; nrm[k + 2] = -gz / l;
    }
  }
  const idx = [];
  for (let j = 0; j < vz - 1; j++) {
    for (let i = 0; i < vx - 1; i++) {
      const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
      // pick the diagonal that follows the surface better
      const ha = pos[a * 3 + 1], hb = pos[b * 3 + 1], hc = pos[c * 3 + 1], hd = pos[d * 3 + 1];
      if (Math.abs(ha - hd) < Math.abs(hb - hc)) { idx.push(a, c, d, a, d, b); } else { idx.push(a, c, b, b, c, d); }
    }
  }
  // skirt: duplicate border ring 1.5 m lower
  const border = [];
  for (let i = 0; i < vx; i++) border.push(i);
  for (let j = 1; j < vz; j++) border.push(j * vx + vx - 1);
  for (let i = vx - 2; i >= 0; i--) border.push((vz - 1) * vx + i);
  for (let j = vz - 2; j >= 1; j--) border.push(j * vx);
  const P2 = new Float32Array(pos.length + border.length * 3);
  const N2 = new Float32Array(nrm.length + border.length * 3);
  P2.set(pos); N2.set(nrm);
  const base = vx * vz;
  border.forEach((v, n) => {
    const k = (base + n) * 3;
    P2[k] = pos[v * 3]; P2[k + 1] = pos[v * 3 + 1] - 1.5; P2[k + 2] = pos[v * 3 + 2];
    N2[k] = nrm[v * 3]; N2[k + 1] = nrm[v * 3 + 1]; N2[k + 2] = nrm[v * 3 + 2];
  });
  for (let n = 0; n < border.length; n++) {
    const a = border[n], b = border[(n + 1) % border.length];
    const a2 = base + n, b2 = base + ((n + 1) % border.length);
    idx.push(a, b, a2, b, b2, a2);
  }
  // forest density of the land just outside (same field the land mesh uses) so the apron's outer
  // rim can take on the land's ground and canopy shade and the two meshes meet without a seam
  const FD = new Float32Array(P2.length / 3);
  for (let v = 0; v < FD.length; v++) FD[v] = F.forestDensity(P2[v * 3], P2[v * 3 + 2]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('aFd', new THREE.BufferAttribute(FD, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(P2, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N2, 3));
  geo.setIndex(P2.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();

  // ---- mask texture ----
  const toHalf = THREE.DataUtils.toHalfFloat;
  const data = new Uint16Array(NX * NZ * 4);
  for (let k = 0; k < NX * NZ; k++) {
    data[k * 4] = toHalf(Math.max(-40, Math.min(40, gMoss[k])));
    data[k * 4 + 1] = toHalf(Math.max(-40, Math.min(40, gSoil[k])));
    data[k * 4 + 2] = 0;
    data[k * 4 + 3] = toHalf(Math.max(-40, Math.min(40, gPath[k])));
  }
  const tex = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;

  // 江南石景小品 (stone spurs / drum stools / lake rocks) — the ground stays flat around their bases
  const NS = 16;
  const standPts = [];
  for (let i = 0; i < NS; i++) {
    const s = F.stands[i];
    standPts.push(s ? new THREE.Vector3(s.x, s.z, s.r) : new THREE.Vector3(1e4, 1e4, 0));
  }
  // hero trees -> leaf / petal / needle litter on gravel and moss (x, z, crown radius, kind)
  const NT = 20;
  const KIND = { pine: 0, maple: 1, mapleRed: 2, cherry: 3 };
  const trees = [];
  for (let i = 0; i < NT; i++) {
    const t = F.trees[i];
    trees.push(t ? new THREE.Vector4(t.x, t.z, 1.4 + t.h * 0.42, KIND[t.type] ?? 1) : new THREE.Vector4(1e4, 1e4, 0, 0));
  }
  const uniforms = {
    uTree: { value: trees },
    tMask: { value: tex },
    uMaskX: { value: new THREE.Vector4(DOM.minX, DOM.minZ, 1 / CELL, 1 / CELL) },
    uMaskN: { value: new THREE.Vector2(NX, NZ) },
    uStands: { value: standPts },
    uPag: { value: new THREE.Vector3(F.pagP.cx, F.pagP.cz, F.pagP.h) },
    uRect: { value: new THREE.Vector4(F.R.minX, F.R.minZ, F.R.maxX, F.R.maxZ) },
  };

  const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.9, metalness: 0 }, groundHooks(uniforms, NS, NT));
  mat.name = 'terrainGround';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'courtyardGround';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return { mesh, uniforms, maskTex: tex };
}

function groundHooks(uniforms, NL, NT) {
  return {
    uniforms,
    defines: { NSTAND: NL, NTREE: NT },
    vertexHead: /* glsl */ `attribute float aFd; varying float vFd;`,
    vertexWorld: /* glsl */ `vFd = aFd;`,
    fragHead: /* glsl */ `
      varying float vFd;
      uniform vec4 uTree[NTREE];
      uniform sampler2D tMask;
      uniform vec4 uMaskX;
      uniform vec2 uMaskN;
      uniform vec3 uStands[NSTAND];
      uniform vec3 uPag;
      uniform vec4 uRect;
      float g_landShade; float g_landAmb; float g_h; float g_wM; float g_wS; float g_wG; float g_rough; float g_dirMul; vec3 g_nW; float g_sheen; float g_ao;
      ${TG_GLSL}
      ${MOSS_GLSL}
      ${NEAR_GLSL}
      vec4 tg_mask(vec2 p){
        vec2 uv = ((p - uMaskX.xy) * uMaskX.zw + 0.5) / uMaskN;
        return texture2D(tMask, uv);
      }
      // fallen maple leaves / cherry petals / pine needles under the hero trees, drifted a little
      // downwind (east). Returns coverage (filtered by the pixel footprint) and the litter colour.
      float tg_litter(vec2 p, float fw, out vec3 lc){
        float acc = 0.0; vec3 cacc = vec3(0.0);
        for (int i = 0; i < NTREE; i++){
          vec4 t = uTree[i];
          vec2 d = p - t.xy - vec2(0.85, -0.3) * t.z * 0.22;
          float r = length(d);
          if (r > t.z * 1.7) continue;
          float dens = smoothstep(t.z * 1.65, t.z * 0.3, r);
          vec3 c;
          if (t.w < 0.5) { c = vec3(0.17, 0.095, 0.045); dens *= 0.45; }
          else if (t.w < 1.5) { c = vec3(0.30, 0.25, 0.07); dens *= 0.3; }
          else if (t.w < 2.5) { c = vec3(0.40, 0.05, 0.022); }
          else { c = vec3(0.80, 0.58, 0.62); dens *= 0.45; }
          acc += dens; cacc += c * dens;
        }
        lc = vec3(0.0);
        if (acc < 0.003) return 0.0;
        lc = cacc / acc;
        float clump = smoothstep(-0.4, 0.5, n_fbm(p * 0.9 + 13.0, 2));
        float dens = min(acc, 1.0) * (0.2 + 0.8 * clump) * 0.95;
        vec2 cid; float f2;
        vec3 w = tg_worley(p * 24.0, cid, f2);
        vec3 h = n_hash33(vec3(cid, 9.1));
        float fade = 1.0 - smoothstep(0.01, 0.03, fw);
        // leaf outline: lobed (maple), oval (petal / needle tuft), random size and rotation
        float ang = atan(w.z, w.y) + h.z * 6.2831;
        float rad = (0.22 + 0.16 * h.y) * (0.78 + 0.22 * cos(5.0 * ang)) * (1.0 - 0.3 * abs(sin(ang)));
        float shape = smoothstep(rad + 0.04, rad - 0.03, w.x) * step(h.x, dens);
        lc *= mix(1.0, 0.65 + 0.7 * h.z, fade);
        lc = mix(lc, lc * vec3(1.2, 1.5, 0.7), step(0.8, h.y) * fade * 0.5);
        return mix(dens * 0.16, shape, fade);
      }
    `,
    fragColor: /* glsl */ `
    {
      vec2 p = vWPos.xz;
      vec3 nGeo = normalize(vWNrm);
      vec2 fwp = fwidth(p);
      float fw = max(sqrt(fwp.x * fwp.y), 1e-5);
      vec4 mk = tg_mask(p);
      float eb = n_snoise(p * 6.0) * 0.05 + n_snoise(p * 21.0) * 0.018;
      float sM = mk.r + eb;
      float sS = mk.g + eb * 0.8;
      float aaM = max(fw * 1.2, 0.01);
      g_wM = smoothstep(aaM, -aaM, sM);
      g_wS = smoothstep(aaM, -aaM, sS) * (1.0 - g_wM);
      g_wG = max(1.0 - g_wM - g_wS, 0.0);
      vec3 col = vec3(0.0);
      vec2 grad = vec2(0.0);
      g_landShade = 1.0; g_landAmb = 1.0; g_h = 0.0; g_dirMul = 1.0; g_rough = 0.0; g_sheen = 0.0; g_ao = 1.0;
      vec3 L = normalize(uSunDir);

      // ---------------- 江南青石板与花街铺地 (bluestone flags & courtyard paving) ----------------
      if (g_wG > 0.001) {
        // Bluestone flag layout: staggered slabs (~0.85m x 0.52m)
        vec2 sp = p * vec2(1.18, 1.92);
        float row = floor(sp.y);
        sp.x += 0.5 * mod(row, 2.0);
        vec2 slabId = floor(sp);
        vec2 slabUv = fract(sp) - 0.5;
        vec3 sHash = n_hash33(vec3(slabId, 4.2));
        vec2 sDist = abs(slabUv) - vec2(0.465, 0.455);
        float edgeDist = max(sDist.x, sDist.y);
        float joint = smoothstep(-0.02, 0.03, edgeDist);

        // Base bluestone colour (青石青灰微绿底色)
        vec3 stoneCol = vec3(0.35, 0.38, 0.37) * (0.88 + 0.24 * sHash.x);
        // Chisel texture and fine surface mottling
        float chisel = n_snoise(p * 28.0) * 0.035 + n_snoise(p * 110.0) * 0.02;
        stoneCol += chisel;

        // Water stains and aging (潮湿水痕泛碱与青苔渗透)
        float damp = smoothstep(0.1, 0.65, n_fbm(p * 0.55 + 12.0, 3));
        stoneCol = mix(stoneCol, stoneCol * vec3(0.72, 0.78, 0.74), damp * 0.4);

        // Dark joint mortar / soil in joints (灰浆与砖缝填土)
        vec3 jointCol = vec3(0.20, 0.19, 0.17) * (0.8 + 0.4 * n_snoise(p * 30.0));
        vec3 finalPave = mix(stoneCol, jointCol, joint);

        // Creeping moss along slab edges and joints
        float nearMoss = smoothstep(0.8, 0.0, mk.r) * smoothstep(-0.2, 0.3, n_fbm(p * 2.5, 2));
        finalPave = mix(finalPave, vec3(0.26, 0.32, 0.18), nearMoss * 0.65 * joint);

        // Relief and normal modification
        float slabBevel = -0.006 * smoothstep(0.0, -0.06, edgeDist);
        g_h += g_wG * slabBevel;

        // Ambient occlusion in joints
        float aoPave = mix(1.0, 0.72, joint);
        g_ao = mix(1.0, aoPave, g_wG);

        // Roughness: honed bluestone with damp sheen
        float roughPave = mix(0.75, 0.92, joint);
        roughPave = mix(roughPave, 0.58, damp * 0.5);
        g_rough += g_wG * roughPave;

        col += g_wG * finalPave;
      }
      // ---------------- moss ----------------
      if (g_wM > 0.001) {
        vec3 mcol; float mh; float mr;
        tg_moss(p, vWPos.y, fw, mcol, mh, mr);
        // lawn scale variation: sunny yellow-green cushion fields vs deep emerald hollows, so the
        // moss beds keep colour structure from the air
        float lw = n_fbm(p * 0.12 + 50.0, 3);
        float lw2 = n_fbm(p * 0.6 - 20.0, 2);
        mcol *= 1.6 * vec3(0.93, 1.05, 0.84);
        mcol = mix(mcol, mcol * vec3(1.4, 1.28, 0.72), smoothstep(0.02, 0.45, lw) * 0.6);
        mcol = mix(mcol, mcol * vec3(0.68, 0.84, 0.95), smoothstep(-0.05, -0.45, lw) * 0.55);
        mcol *= 0.88 + 0.24 * smoothstep(-0.5, 0.5, lw2);
        // half-metre cushions and hollows: tone + gentle relief that the grazing sun picks out
        float mm = n_fbm(p * 1.8 + 70.0, 2);
        mcol *= 0.8 + 0.38 * smoothstep(-0.5, 0.5, mm);
        mcol = mix(mcol, mcol * vec3(1.25, 1.12, 0.7), smoothstep(0.25, 0.6, n_fbm(p * 1.1 - 33.0, 2)) * 0.45);
        mh += 0.010 * mm;
        // edge of the carpet: just inside it the moss thins and browns; the trimmed rim stands a few
        // cm proud of the gravel and its cut, stemmy flank reads as a dark line
        float rim = smoothstep(-0.5, 0.0, sM);
        mcol = mix(mcol, mcol * vec3(1.12, 0.92, 0.6), rim * 0.3);
        float lip = smoothstep(-0.12, -0.015, sM);
        mcol *= 1.0 - 0.42 * lip;
        g_ao = mix(g_ao, 1.0 - 0.3 * lip, g_wM);
        col += g_wM * mcol;
        g_h += g_wM * mh;
        g_rough += g_wM * mr;
        g_sheen += g_wM;
      }

      // ---------------- fallen leaves / petals / needles ----------------
      if (g_wG + g_wM > 0.01) {
        vec3 lc;
        float lt = tg_litter(p, fw, lc);
        float wGM = g_wG + g_wM;
        col = col * (1.0 - lt) + lc * lt * wGM;
        g_rough = mix(g_rough, 0.8 * wGM, lt);
        g_dirMul = mix(g_dirMul, 1.0, lt * 0.7);
        g_ao = mix(g_ao, 1.0, lt * 0.5);
      }

      // ---------------- soil / pond bed / forest floor ----------------
      if (g_wS > 0.001) {
        float big = n_fbm(p * 0.5, 3);
        float fine = n_snoise(p * 40.0) * 0.5 + n_snoise(p * 110.0) * 0.25;
        float fineF = 1.0 - smoothstep(0.004, 0.03, fw);
        vec3 scol = vec3(0.085, 0.064, 0.045) * (0.8 + 0.25 * big + 0.12 * fine * fineF);
        float under = smoothstep(-0.15, -0.65, vWPos.y);
        // pond bed: dark silt with algae
        vec3 silt = mix(vec3(0.045, 0.042, 0.030), vec3(0.05, 0.065, 0.03), smoothstep(-0.2, 0.5, big));
        scol = mix(scol, silt, under);
        // shore: damp dark band just above the water line
        float damp = smoothstep(0.25, -0.45, vWPos.y);
        scol *= 1.0 - damp * 0.35;
        // paving bed / joints: dark soil, moss and grit
        float inPath = smoothstep(0.06, -0.01, mk.a);
        if (inPath > 0.001) {
          vec3 jm; float jmh; float jmr;
          tg_moss(p, vWPos.y, fw, jm, jmh, jmr);
          // joints mostly grown in with moss (a few bare, dark, gritty stretches)
          vec3 jc = mix(vec3(0.040, 0.033, 0.025), jm * 1.45 + vec3(0.008, 0.016, 0.0), 0.2 + 0.8 * smoothstep(-0.5, 0.1, n_fbm(p * 3.0 + 5.0, 2)));
          scol = mix(scol, jc, inPath);
        }
        // forest floor outside: needles + leaf litter
        vec2 rq = p - uRect.xy; vec2 rq2 = uRect.zw - p;
        float outside = 1.0 - step(0.0, min(min(rq.x, rq.y), min(rq2.x, rq2.y)));
        if (outside > 0.5) {
          float lit = n_fbm(p * 1.3 + 4.0, 3);
          vec3 needles = vec3(0.13, 0.075, 0.04) * (0.8 + 0.3 * fine * fineF);
          vec3 fm; float fmh; float fmr;
          tg_moss(p, vWPos.y, fw, fm, fmh, fmr);
          // temple grounds outside the cloister: moss and fine grass with bare, needle-strewn
          // patches; patchy at several scales so it keeps structure from the air
          float o1 = n_fbm(p * 0.09 + 3.0, 3), o2 = n_fbm(p * 0.45 - 6.0, 3), o3 = n_snoise(p * 2.2);
          vec3 grassC = mix(vec3(0.055, 0.080, 0.020), vec3(0.115, 0.115, 0.038), smoothstep(-0.4, 0.5, o1 + 0.4 * o2));
          grassC *= 0.8 + 0.25 * o2 + 0.12 * o3 * (1.0 - smoothstep(0.05, 0.2, fw));
          // tussocks: ~30 cm clumps with dark bases and pale tips (filtered)
          vec2 tid; float tf2;
          vec3 tw = tg_worley(p * 3.2 + 1.7, tid, tf2);
          float tF = 1.0 - smoothstep(0.025, 0.1, fw);
          float tus = smoothstep(0.6, 0.05, tw.x) * (0.6 + 0.4 * n_hash12(tid));
          grassC *= mix(0.92, 0.62 + 0.62 * tus, tF);
          grassC = mix(grassC, grassC * vec3(1.3, 1.15, 0.7), tus * tF * smoothstep(0.0, 0.5, o2) * 0.5);
          g_h += g_wS * tus * 0.022 * tF;
          float mp = smoothstep(-0.25, 0.35, n_fbm(p * 0.35 + 9.0, 3));
          vec3 oc = mix(grassC, fm * 1.15, mp * 0.75);
          oc = mix(oc, needles, smoothstep(0.1, 0.6, lit) * 0.55);
          // drifts of last autumn's leaves and bare, trodden earth
          float o5 = n_fbm(p * 0.16 + 17.0, 3);
          tg_leafDrift(p, fw, smoothstep(0.15, 0.55, o5) * 0.7, oc);
          oc = mix(oc, vec3(0.13, 0.095, 0.06) * (0.85 + 0.25 * o3), smoothstep(0.3, 0.6, n_fbm(p * 0.07 - 9.0, 2)) * 0.35);
          vec3 olc; float olt = tg_litter(p, fw, olc);
          oc = mix(oc, olc, olt);
          // outer rim of the apron: hand over to the land's meadow / forest floor and its canopy shade
          vec2 qd = max(max(uRect.xy - p, p - uRect.zw), 0.0);
          oc *= 1.3;
          { float hs = 0.0; tg_yongdao(p, fw, oc, hs); g_h += g_wS * hs; }
          float toLand = smoothstep(7.0, 9.8, length(qd));
          if (toLand > 0.001) {
            float hM, hF;
            vec3 landC = mix(tg_meadow(p, vWPos.y, fw, hM), tg_forestFloor(p, vWPos.y, fw, hF), vFd);
            oc = mix(oc, landC, toLand);
            g_landShade = mix(1.0, mix(1.0, 0.22, vFd), toLand);
            g_landAmb = mix(1.0, mix(1.0, 0.75, vFd), toLand);
          }
          scol = oc;
        }
        col += g_wS * scol;
        g_dirMul *= mix(1.0, g_landShade, g_wS);
        g_ao *= mix(1.0, g_landAmb, g_wS);
        g_h += g_wS * (0.004 * fine * fineF);
        g_rough += g_wS * mix(0.92, 0.45, damp * (1.0 - under * 0.5));
      }
      diffuseColor.rgb = col;
      g_nW = normalize(nGeo + vec3(-grad.x, 0.0, -grad.y));
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(g_rough, 0.08, 1.0);`,
    fragNormal: /* glsl */ `
      normal = normalize((viewMatrix * vec4(g_nW, 0.0)).xyz);
      normal = n_bumpView(-vViewPosition, normal, g_h, 1.0);
    `,
    fragLight: /* glsl */ `
      reflectedLight.directDiffuse *= g_dirMul;
      reflectedLight.directSpecular *= g_dirMul;
      reflectedLight.indirectDiffuse *= g_ao;
      {
        float nv = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
        float nl = dot(geometryNormal, directLight.direction);
        float rim = pow(1.0 - nv, 3.0);
        reflectedLight.directDiffuse += g_sheen * directLight.color * rim * clamp(nl + 0.3, 0.0, 1.0) * vec3(0.10, 0.18, 0.06) * 0.22 * g_dirMul;
      }
    `,
  };
}
