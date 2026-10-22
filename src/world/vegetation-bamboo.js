// ---------------------------------------------------------------------------
// vegetation-bamboo.js — Procedural Jiangnan Bamboo Groves (姑苏修竹林).
// Slender upright culms with parameterised node rings + clusters of "个/介"
// lanceolate bamboo leaves with translucent jade-green backlighting.
// Placed along white plaster corridor walls and leak windows.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Procedural Bamboo Culm Geometry (single cane with nodes and slight bend)
// ---------------------------------------------------------------------------
function makeCulmGeo(height = 6.0, rBase = 0.045, rTop = 0.022, nodeStep = 0.38) {
  const nNodes = Math.floor(height / nodeStep);
  const segsY = nNodes * 4;
  const segsR = 12;
  const pos = [], nrm = [], uv = [];

  for (let j = 0; j <= segsY; j++) {
    const t = j / segsY;
    const y = t * height;
    // node phase
    const nodeFrac = (y % nodeStep) / nodeStep;
    const isNode = Math.exp(-Math.pow((nodeFrac - 0.5) * 12.0, 2.0));
    const r = (rBase + (rTop - rBase) * t) * (1.0 + 0.12 * isNode);
    // gentle natural parabolic lean
    const bendX = 0.22 * t * t;
    const bendZ = 0.08 * t * t * t;

    for (let i = 0; i <= segsR; i++) {
      const a = (i / segsR) * TAU;
      const cosA = Math.cos(a), sinA = Math.sin(a);
      pos.push(bendX + cosA * r, y, bendZ + sinA * r);
      nrm.push(cosA, 0.08 * isNode, sinA);
      uv.push(i / segsR, y);
    }
  }

  const idx = [];
  for (let j = 0; j < segsY; j++) {
    for (let i = 0; i < segsR; i++) {
      const a = j * (segsR + 1) + i;
      const b = a + 1;
      const c = (j + 1) * (segsR + 1) + i;
      const d = c + 1;
      idx.push(a, b, c);
      idx.push(b, d, c);
    }
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
// Procedural Bamboo Leaf Spray ("个" / "介" character cluster of 4-6 lance leaves)
// ---------------------------------------------------------------------------
function makeLeafSprayGeo() {
  const pos = [], nrm = [], uv = [];
  const idx = [];

  // Individual leaf: elongated diamond-lanceolate shape
  const addLeaf = (x0, y0, z0, len, wid, yaw, pitch, droop = 0.08) => {
    const baseIdx = pos.length / 3;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

    // 5 vertices: stem base (0), left mid (1), right mid (2), tip (3), mid spine (4)
    // Local forward along leaf axis
    const fwd = new THREE.Vector3(cosY * cosP, sinP, sinY * cosP).normalize();
    const right = new THREE.Vector3(-sinY, 0, cosY).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();

    const p0 = new THREE.Vector3(x0, y0, z0);
    const p1 = p0.clone().addScaledVector(fwd, len * 0.45).addScaledVector(right, -wid * 0.5).addScaledVector(up, -droop * 0.3);
    const p2 = p0.clone().addScaledVector(fwd, len * 0.45).addScaledVector(right, wid * 0.5).addScaledVector(up, -droop * 0.3);
    const p3 = p0.clone().addScaledVector(fwd, len).addScaledVector(up, -droop);

    const pts = [p0, p1, p2, p3];
    for (const p of pts) {
      pos.push(p.x, p.y, p.z);
      nrm.push(up.x, up.y, up.z);
    }
    uv.push(0.5, 0.0, 0.0, 0.5, 1.0, 0.5, 0.5, 1.0);

    // Two triangles forming diamond leaf
    idx.push(baseIdx, baseIdx + 1, baseIdx + 2);
    idx.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
  };

  // Classical "个" character cluster: 1 central leaf, 2 flanking leaves
  addLeaf(0, 0, 0, 0.22, 0.038, 0, 0.15, 0.04);
  addLeaf(0.02, 0.01, 0, 0.19, 0.034, -0.45, 0.08, 0.05);
  addLeaf(-0.02, 0.01, 0, 0.19, 0.034, 0.45, 0.08, 0.05);

  // Lower pair
  addLeaf(0.01, -0.04, 0, 0.17, 0.032, -0.85, -0.05, 0.06);
  addLeaf(-0.01, -0.04, 0, 0.17, 0.032, 0.85, -0.05, 0.06);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// ---------------------------------------------------------------------------
// Bamboo Materials (Culm & Leaf) with Subsurface Translucency & Wind
// ---------------------------------------------------------------------------
function makeBambooMats(ctx) {
  // Culm material: glossy jade-green bamboo with node banding
  const culmMat = ctx.mat.phys({
    color: 0x4a7c2e,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.25,
    clearcoatRoughness: 0.2,
  }, {
    vertexHead: /* glsl */ `attribute vec3 aBend;`,
    vertexWorld: /* glsl */ `
      // bamboo flexible wind sway (stronger at top)
      float hFrac = clamp(transformed.y / 6.5, 0.0, 1.0);
      float sway = hFrac * hFrac;
      vec3 wOff = windOffset(wPos4.xyz, sway * 0.8);
      wPos4.xyz += wOff;
    `,
    fragHead: /* glsl */ `
      float b_node(float y) {
        float f = fract(y / 0.38);
        return smoothstep(0.42, 0.5, f) * (1.0 - smoothstep(0.5, 0.58, f));
      }
    `,
    fragColor: /* glsl */ `
      {
        float nd = b_node(vWPos.y);
        vec3 green = vec3(0.24, 0.42, 0.14);
        vec3 nodeCol = vec3(0.38, 0.45, 0.20);
        float grain = n_snoise3(vWPos * vec3(12.0, 0.5, 12.0)) * 0.06;
        vec3 c = mix(green, nodeCol, nd * 0.6) + grain;
        diffuseColor.rgb = c;
      }
    `,
  });

  // Leaf material: translucent jade green with sunlight SSS
  const leafMat = ctx.mat.std({
    color: 0x589832,
    roughness: 0.45,
    metalness: 0.0,
    side: THREE.DoubleSide,
  }, {
    vertexHead: /* glsl */ `attribute vec3 aLeafOff;`,
    vertexWorld: /* glsl */ `
      float hFrac = clamp(wPos4.y / 6.5, 0.2, 1.0);
      vec3 wOff = windOffset(wPos4.xyz, hFrac * 1.1);
      // leaf flutter
      float flut = sin(uTime * 3.5 + dot(wPos4.xyz, vec3(4.0))) * 0.015 * hFrac;
      wPos4.xyz += wOff + vec3(flut, flut * 0.5, -flut);
    `,
    fragLight: /* glsl */ `
      // Backlit translucency: glowing emerald green against the sun
      #if NUM_DIR_LIGHTS > 0
      {
        vec3 L = directionalLights[0].direction;
        float back = max(0.0, dot(geometryViewDir, L));
        float sss = pow(back, 2.2) * 1.4;
        vec3 sssCol = vec3(0.35, 0.68, 0.18) * directionalLights[0].color;
        reflectedLight.directDiffuse += sssCol * sss;
      }
      #endif
    `,
  });

  return { culmMat, leafMat };
}

// ---------------------------------------------------------------------------
// Build Bamboo Groves throughout the Classical Garden
// ---------------------------------------------------------------------------
export function buildBamboo(ctx, parent) {
  const { culmMat, leafMat } = makeBambooMats(ctx);
  const R = ctx.rng ? ctx.rng('bamboo') : { range: (a, b) => a + Math.random() * (b - a), float: () => Math.random() };

  // Grove clump locations:
  // 1. Outside north corridor wall (behind leak windows)
  // 2. Outside west corridor wall
  // 3. Along east corridor and pavilion nook
  // 4. Hall corners
  const clumps = [
    // North corridor leak window backdrop
    { x: 10, z: -48.5, radius: 4.5, count: 28 },
    { x: -18, z: -48.5, radius: 3.5, count: 20 },
    { x: 38, z: -48.5, radius: 4.0, count: 24 },
    // West corridor
    { x: -52.5, z: -15, radius: 3.8, count: 22 },
    { x: -52.5, z: 12, radius: 4.0, count: 24 },
    // East pavilion / corridor corner
    { x: 55, z: 22, radius: 3.2, count: 18 },
    { x: 65, z: 8, radius: 3.5, count: 20 },
    // Courtyard quiet corners flanking the hall
    { x: -14, z: -16, radius: 2.2, count: 12 },
    { x: 34, z: -16, radius: 2.2, count: 12 },
  ];

  const culmMatrices = [];
  const leafMatrices = [];

  const baseCulmGeo = makeCulmGeo(6.2, 0.045, 0.02, 0.38);
  const baseLeafGeo = makeLeafSprayGeo();

  for (const clump of clumps) {
    for (let i = 0; i < clump.count; i++) {
      const ang = R.float() * TAU;
      const dist = Math.sqrt(R.float()) * clump.radius;
      const cx = clump.x + Math.cos(ang) * dist;
      const cz = clump.z + Math.sin(ang) * dist;
      const cy = 0; // ground level

      const caneH = R.range(4.5, 6.8);
      const scaleY = caneH / 6.2;
      const scaleXZ = R.range(0.85, 1.25);
      const rotY = R.float() * TAU;

      const m = new THREE.Matrix4()
        .makeRotationY(rotY)
        .scale(new THREE.Vector3(scaleXZ, scaleY, scaleXZ))
        .setPosition(cx, cy, cz);
      culmMatrices.push(m);

      // Add 6-10 leaf spray clusters to the upper 50% of the bamboo cane
      const nSprays = Math.floor(R.range(6, 11));
      for (let k = 0; k < nSprays; k++) {
        const hFrac = 0.45 + 0.52 * (k / nSprays) + R.range(-0.04, 0.04);
        const ly = cy + caneH * hFrac;
        const branchYaw = rotY + (k * 2.39996) + R.range(-0.3, 0.3); // golden angle distribution
        const branchPitch = R.range(0.15, 0.45);
        const distOut = R.range(0.12, 0.32);

        const lx = cx + Math.cos(branchYaw) * distOut;
        const lz = cz + Math.sin(branchYaw) * distOut;
        const leafScale = R.range(0.9, 1.4);

        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-branchPitch, branchYaw, R.range(-0.2, 0.2), 'YXZ'));
        const lm = new THREE.Matrix4().compose(
          new THREE.Vector3(lx, ly, lz),
          q,
          new THREE.Vector3(leafScale, leafScale, leafScale)
        );
        leafMatrices.push(lm);
      }
    }
  }

  // Instanced culm mesh
  const culmInst = new THREE.InstancedMesh(baseCulmGeo, culmMat, culmMatrices.length);
  for (let i = 0; i < culmMatrices.length; i++) culmInst.setMatrixAt(i, culmMatrices[i]);
  culmInst.instanceMatrix.needsUpdate = true;
  culmInst.castShadow = true;
  culmInst.receiveShadow = true;
  culmInst.name = 'bamboo_culms';
  parent.add(culmInst);

  // Instanced leaf mesh
  const leafInst = new THREE.InstancedMesh(baseLeafGeo, leafMat, leafMatrices.length);
  for (let i = 0; i < leafMatrices.length; i++) leafInst.setMatrixAt(i, leafMatrices[i]);
  leafInst.instanceMatrix.needsUpdate = true;
  leafInst.castShadow = true;
  leafInst.receiveShadow = true;
  leafInst.name = 'bamboo_leaves';
  parent.add(leafInst);

  console.log(`[vegetation] bamboo built: ${culmMatrices.length} canes, ${leafMatrices.length} leaf sprays`);
}
