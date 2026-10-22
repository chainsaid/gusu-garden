// ---------------------------------------------------------------------------
// vegetation-willow.js — Procedural Jiangnan Weeping Willow (岸边垂柳).
// Gnarled leaning trunks along the pond shore with cascading, flexible
// weeping strands drooping toward the water and swaying in the breeze.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Procedural Weeping Strand Geometry (cascading vertical willow branch)
// ---------------------------------------------------------------------------
function makeWillowStrandGeo(length = 2.8, nSegs = 8, width = 0.045) {
  const pos = [], nrm = [], uv = [];
  const idx = [];

  for (let i = 0; i <= nSegs; i++) {
    const t = i / nSegs;
    const y = -t * length;
    // Gentle natural S-sway down the strand
    const swayX = Math.sin(t * Math.PI * 1.5) * 0.08 * t;
    const w = width * (1.0 - t * 0.4);

    pos.push(-w + swayX, y, 0);
    pos.push(w + swayX, y, 0);

    nrm.push(0, 0, 1);
    nrm.push(0, 0, 1);

    uv.push(0, t);
    uv.push(1, t);
  }

  for (let i = 0; i < nSegs; i++) {
    const r0 = i * 2;
    const r1 = (i + 1) * 2;
    idx.push(r0, r1, r0 + 1);
    idx.push(r0 + 1, r1, r1 + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// ---------------------------------------------------------------------------
// Leaning Gnarled Willow Trunk Geometry
// ---------------------------------------------------------------------------
function makeWillowTrunkGeo(height = 4.2, leanDist = 1.6) {
  const segsY = 14, segsR = 10;
  const pos = [], nrm = [], uv = [];
  const idx = [];

  for (let j = 0; j <= segsY; j++) {
    const t = j / segsY;
    const y = t * height;
    const r = (0.24 * (1.0 - t * 0.55)) * (1.0 + 0.1 * Math.sin(t * 12.0));
    // Trunk leans toward +Z (over water)
    const leanZ = t * t * leanDist;
    const leanX = Math.sin(t * Math.PI) * 0.35;

    for (let i = 0; i <= segsR; i++) {
      const a = (i / segsR) * TAU;
      const cosA = Math.cos(a), sinA = Math.sin(a);
      pos.push(leanX + cosA * r, y, leanZ + sinA * r);
      nrm.push(cosA, 0.1, sinA);
      uv.push(i / segsR, t * 3.0);
    }
  }

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
// Willow Materials
// ---------------------------------------------------------------------------
function makeWillowMats(ctx) {
  const foliageMat = ctx.mat.phys({
    color: 0x588828,
    roughness: 0.45,
    metalness: 0.0,
    side: THREE.DoubleSide,
  }, {
    vertexHead: /* glsl */ `varying vec2 vMyUv;`,
    vertexWorld: /* glsl */ `
      vMyUv = uv;
      // Soft, languid weeping willow sway (bottom tips sway furthest)
      float drop = clamp(-transformed.y / 3.5, 0.0, 1.2);
      float sway = drop * drop;
      vec3 wOff = windOffset(wPos4.xyz, sway * 1.5);
      float flutter = sin(uTime * 2.8 + wPos4.x * 3.0 + wPos4.z * 2.0) * 0.03 * drop;
      wPos4.xyz += wOff + vec3(flutter, 0.0, -flutter * 0.8);
    `,
    fragHead: /* glsl */ `varying vec2 vMyUv;`,
    fragColor: /* glsl */ `
      {
        float across = abs(vMyUv.x - 0.5) * 2.0;
        if (across > 0.85) discard;
        vec3 tenderGreen = vec3(0.26, 0.46, 0.14);
        vec3 goldenGreen = vec3(0.38, 0.54, 0.18);
        vec3 col = mix(tenderGreen, goldenGreen, vMyUv.y * 0.4);
        diffuseColor.rgb = col;
      }
    `,
  });

  const trunkMat = ctx.mat.std({
    color: 0x3d3024,
    roughness: 0.85,
    metalness: 0.02,
  }, {
    fragColor: /* glsl */ `
      {
        float n = n_fbm3(vWPos * vec3(4.0, 1.0, 4.0), 3);
        float moss = smoothstep(0.4, 0.8, n_snoise3(vWPos * 1.5) + vWNrm.y * 0.5);
        vec3 bark = vec3(0.18, 0.14, 0.10) * (0.8 + 0.4 * n);
        vec3 mossCol = vec3(0.22, 0.32, 0.12);
        diffuseColor.rgb = mix(bark, mossCol, moss * 0.35);
      }
    `,
  });

  return { foliageMat, trunkMat };
}

// ---------------------------------------------------------------------------
// Build Weeping Willows along Pond Shore
// ---------------------------------------------------------------------------
export function buildWillows(ctx, parent) {
  const { foliageMat, trunkMat } = makeWillowMats(ctx);
  const R = ctx.rng ? ctx.rng('willow') : { range: (a, b) => a + Math.random() * (b - a), float: () => Math.random() };

  // Shoreline tree positions (leaning over water)
  const trees = [
    { x: -16, z: 6.2, yaw: 0.4, scale: 1.15 },
    { x: 34, z: 6.8, yaw: -0.5, scale: 1.1 },
    { x: 42, z: 14.0, yaw: -1.2, scale: 1.05 },
    { x: 38, z: 28.0, yaw: -2.1, scale: 1.12 },
    { x: -22, z: 28.0, yaw: 2.2, scale: 1.08 },
    { x: -2, z: 18.0, yaw: 0.8, scale: 0.95 }, // island willow
  ];

  const trunkMatrices = [];
  const strandMatrices = [];

  const baseTrunkGeo = makeWillowTrunkGeo(4.4, 1.8);
  const baseStrandGeo = makeWillowStrandGeo(2.8, 8, 0.045);

  for (const t of trees) {
    const s = t.scale;
    const tm = new THREE.Matrix4()
      .makeRotationY(t.yaw)
      .scale(new THREE.Vector3(s, s, s))
      .setPosition(t.x, -0.2, t.z);
    trunkMatrices.push(tm);

    // Canopy weeping strands (around crown at y ~ 3.5m to 5m)
    const nStrands = 55;
    for (let k = 0; k < nStrands; k++) {
      const az = R.float() * TAU;
      const rad = R.range(0.8, 2.6) * s;
      const crownY = R.range(3.2, 4.6) * s;
      const leanOffZ = Math.cos(t.yaw) * 1.2 * s;
      const leanOffX = Math.sin(t.yaw) * 1.2 * s;

      const px = t.x + leanOffX + Math.cos(az) * rad;
      const pz = t.z + leanOffZ + Math.sin(az) * rad;
      const py = crownY;
      const strandLen = R.range(0.8, 1.25);

      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(R.range(-0.15, 0.15), R.float() * TAU, R.range(-0.15, 0.15), 'YXZ'));
      const sm = new THREE.Matrix4().compose(
        new THREE.Vector3(px, py, pz),
        q,
        new THREE.Vector3(s * R.range(0.85, 1.2), s * strandLen, s)
      );
      strandMatrices.push(sm);
    }
  }

  const trunkInst = new THREE.InstancedMesh(baseTrunkGeo, trunkMat, trunkMatrices.length);
  for (let i = 0; i < trunkMatrices.length; i++) trunkInst.setMatrixAt(i, trunkMatrices[i]);
  trunkInst.instanceMatrix.needsUpdate = true;
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;
  trunkInst.name = 'willow_trunks';
  parent.add(trunkInst);

  const strandInst = new THREE.InstancedMesh(baseStrandGeo, foliageMat, strandMatrices.length);
  for (let i = 0; i < strandMatrices.length; i++) strandInst.setMatrixAt(i, strandMatrices[i]);
  strandInst.instanceMatrix.needsUpdate = true;
  strandInst.castShadow = true;
  strandInst.receiveShadow = true;
  strandInst.name = 'willow_strands';
  parent.add(strandInst);

  console.log(`[vegetation] willows built: ${trunkMatrices.length} trees, ${strandMatrices.length} weeping strands`);
}
