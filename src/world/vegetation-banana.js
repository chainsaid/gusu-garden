// ---------------------------------------------------------------------------
// vegetation-banana.js — Procedural Jiangnan Plantain / Banana (雨打芭蕉).
// Broad arching emerald-green leaves with prominent midribs, natural splits,
// and glowing subsurface translucency. Classic literati courtyard plant.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Procedural Banana Leaf Geometry (single arched leaf with midrib and blade)
// ---------------------------------------------------------------------------
function makeBananaLeafGeo(len = 2.0, maxW = 0.52, droop = 0.45) {
  const segsL = 16;
  const pos = [], nrm = [], uv = [];
  const idx = [];

  for (let i = 0; i <= segsL; i++) {
    const t = i / segsL;
    const archY = Math.sin(t * Math.PI * 0.85) * 0.35 - t * t * droop;
    const archZ = t * len;
    const w = maxW * Math.sin(t * Math.PI) * (1.0 - 0.2 * t);
    const vAngle = (1.0 - t * 0.5) * 0.22;
    const edgeWave = Math.sin(t * 18.0) * 0.02 * (1.0 - t);

    const pCenter = new THREE.Vector3(0, archY, archZ);
    const pLeft = new THREE.Vector3(-w - edgeWave, archY + w * vAngle, archZ);
    const pRight = new THREE.Vector3(w + edgeWave, archY + w * vAngle, archZ);

    pos.push(pLeft.x, pLeft.y, pLeft.z);
    pos.push(pCenter.x, pCenter.y, pCenter.z);
    pos.push(pRight.x, pRight.y, pRight.z);

    nrm.push(-0.2, 0.95, -0.2);
    nrm.push(0.0, 1.0, -0.1);
    nrm.push(0.2, 0.95, -0.2);

    uv.push(0.0, t);
    uv.push(0.5, t);
    uv.push(1.0, t);
  }

  for (let i = 0; i < segsL; i++) {
    const row0 = i * 3;
    const row1 = (i + 1) * 3;
    idx.push(row0, row1, row0 + 1);
    idx.push(row1, row1 + 1, row0 + 1);
    idx.push(row0 + 1, row1 + 1, row0 + 2);
    idx.push(row1 + 1, row1 + 2, row0 + 2);
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
// Pseudostem / Trunk Geometry (fleshy layered trunk)
// ---------------------------------------------------------------------------
function makeStemGeo(height = 1.0, rBase = 0.14, rTop = 0.09) {
  return new THREE.CylinderGeometry(rTop, rBase, height, 12, 4)
    .translate(0, height / 2, 0);
}

// ---------------------------------------------------------------------------
// Banana Plant Materials
// ---------------------------------------------------------------------------
function makeBananaMats(ctx) {
  const leafMat = ctx.mat.phys({
    color: 0x3d8225,
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
    side: THREE.DoubleSide,
  }, {
    vertexHead: /* glsl */ `varying vec2 vMyUv;`,
    vertexWorld: /* glsl */ `
      vMyUv = uv;
      float sway = clamp(wPos4.y * 0.4, 0.0, 1.0);
      vec3 wOff = windOffset(wPos4.xyz, sway * 0.6);
      float flutter = sin(uTime * 2.2 + wPos4.x * 2.0) * 0.02 * sway;
      wPos4.xyz += wOff + vec3(0.0, flutter, 0.0);
    `,
    fragHead: /* glsl */ `varying vec2 vMyUv;`,
    fragColor: /* glsl */ `
      {
        vec3 green = vec3(0.18, 0.44, 0.12);
        vec3 midrib = vec3(0.30, 0.52, 0.18);
        float isRib = 1.0 - smoothstep(0.0, 0.06, abs(vMyUv.x - 0.5));
        vec3 col = mix(green, midrib, isRib);
        diffuseColor.rgb = col;
      }
    `,
  });

  const stemMat = ctx.mat.std({
    color: 0x486b2e,
    roughness: 0.65,
    metalness: 0.0,
  });

  return { leafMat, stemMat };
}

// ---------------------------------------------------------------------------
// Build Plantain / Banana Clumps
// ---------------------------------------------------------------------------
export function buildBananas(ctx, parent) {
  const { leafMat, stemMat } = makeBananaMats(ctx);
  const R = ctx.rng ? ctx.rng('banana') : { range: (a, b) => a + Math.random() * (b - a), float: () => Math.random() };

  const clumps = (ctx && ctx.L && ctx.L.bananas) || [
    { x: 18, z: -45.5, count: 4, scale: 1.1 },
    { x: -16, z: -45.5, count: 3, scale: 0.95 },
    { x: 44, z: 24.5, count: 5, scale: 1.2 },
    { x: 52, z: 12.0, count: 4, scale: 1.0 },
    { x: 26, z: -10.5, count: 3, scale: 1.05 },
    { x: -6, z: -10.5, count: 3, scale: 1.0 },
    { x: -3.5, z: 19.5, count: 3, scale: 0.9 },
  ];

  const leafMatrices = [];
  const stemMatrices = [];

  const baseLeafGeo = makeBananaLeafGeo(2.1, 0.54, 0.48);
  const baseStemGeo = makeStemGeo(1.1, 0.15, 0.09);

  for (const clump of clumps) {
    for (let c = 0; c < clump.count; c++) {
      const offX = (c === 0 ? 0 : R.range(-1.2, 1.2));
      const offZ = (c === 0 ? 0 : R.range(-1.2, 1.2));
      const px = clump.x + offX;
      const pz = clump.z + offZ;
      const py = 0;
      const pScale = clump.scale * (c === 0 ? 1.0 : R.range(0.65, 0.9));

      const sm = new THREE.Matrix4()
        .makeRotationY(R.float() * TAU)
        .scale(new THREE.Vector3(pScale, pScale, pScale))
        .setPosition(px, py, pz);
      stemMatrices.push(sm);

      const nLeaves = Math.floor(R.range(5, 8));
      for (let i = 0; i < nLeaves; i++) {
        const yaw = (i / nLeaves) * TAU + R.range(-0.25, 0.25);
        const pitch = R.range(0.25, 0.65);
        const lScale = pScale * R.range(0.85, 1.15);

        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, R.range(-0.15, 0.15), 'YXZ'));
        const lm = new THREE.Matrix4().compose(
          new THREE.Vector3(px, py + 0.85 * pScale, pz),
          q,
          new THREE.Vector3(lScale, lScale, lScale)
        );
        leafMatrices.push(lm);
      }
    }
  }

  const stemInst = new THREE.InstancedMesh(baseStemGeo, stemMat, stemMatrices.length);
  for (let i = 0; i < stemMatrices.length; i++) stemInst.setMatrixAt(i, stemMatrices[i]);
  stemInst.instanceMatrix.needsUpdate = true;
  stemInst.castShadow = true;
  stemInst.receiveShadow = true;
  stemInst.name = 'banana_stems';
  parent.add(stemInst);

  const leafInst = new THREE.InstancedMesh(baseLeafGeo, leafMat, leafMatrices.length);
  for (let i = 0; i < leafMatrices.length; i++) leafInst.setMatrixAt(i, leafMatrices[i]);
  leafInst.instanceMatrix.needsUpdate = true;
  leafInst.castShadow = true;
  leafInst.receiveShadow = true;
  leafInst.name = 'banana_leaves';
  parent.add(leafInst);

  console.log(`[vegetation] banana built: ${stemMatrices.length} stems, ${leafMatrices.length} leaves`);
}
