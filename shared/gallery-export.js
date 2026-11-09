// ---------------------------------------------------------------------------
// Asset-gallery export: bake the component that is on screen (current params),
// flatten instanced meshes, approximate the procedural palette materials, and
// write a GLB + a human-readable spec through the dev-server endpoint.
//
// Geometry, scale and orientation are exactly what the viewer shows; only the
// procedural shader detail is approximated (noted in the spec).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Palette materials are white-based: the colour comes from GLSL procedures that
// cannot travel in a GLB. These are the flat approximations written to the file.
const APPROX = {
  woodChestnut: { color: 0x44261a, roughness: 0.6, metalness: 0.02, label: '栗木（红漆）' },
  woodChestnutDark: { color: 0x221712, roughness: 0.64, metalness: 0.02, label: '深栗木' },
  lacquerOrange: { color: 0x63371f, roughness: 0.58, metalness: 0.02, label: '赭红漆木' },
  iron: { color: 0x242628, roughness: 0.65, metalness: 0.5, label: '暗铁件' },
  tileCyan: { color: 0x2c3338, roughness: 0.8, metalness: 0.04, label: '小青瓦' },
  granite: { color: 0xa7a49c, roughness: 0.82, metalness: 0.02, label: '花岗石' },
  graniteMossy: { color: 0x8d9184, roughness: 0.85, metalness: 0.02, label: '青苔石' },
  graniteClean: { color: 0xb9b6ae, roughness: 0.76, metalness: 0.02, label: '青石' },
  taihuStone: { color: 0x6e7276, roughness: 0.88, metalness: 0.02, label: '太湖石', vertexColors: true },
  latticeGreen: { color: 0x24402c, roughness: 0.6, metalness: 0.02, label: '绿漆棂条' },
};

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function approxMaterial(src, name) {
  const info = APPROX[name];
  const base = new THREE.MeshStandardMaterial({
    color: info ? info.color : (src.color ? src.color.clone() : 0xcccccc),
    roughness: info ? info.roughness : (src.roughness ?? 0.7),
    metalness: info ? info.metalness : (src.metalness ?? 0.05),
    side: src.side,
    transparent: !!src.transparent,
    opacity: src.opacity ?? 1,
    vertexColors: !!(src.vertexColors || (info && info.vertexColors)),
  });
  base.name = name || src.name || 'material';
  for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap']) {
    if (src[k]) base[k] = src[k];
  }
  if (src.normalScale) base.normalScale.copy(src.normalScale);
  if (src.emissive) base.emissive.copy(src.emissive);
  base.wireframe = false;
  return base;
}

// Hard case: instance colour has to become a vertex colour, because glTF has
// no instancing in this export path.
function flattenInstances(im) {
  const geo = im.geometry.clone();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const index = geo.index ? geo.index.array : null;
  const nv = pos.count;
  const triCount = index ? index.length / 3 : nv / 3;
  const count = im.count;
  const P = new Float32Array(count * nv * 3);
  const N = nor ? new Float32Array(count * nv * 3) : null;
  const U = uv ? new Float32Array(count * nv * 2) : null;
  const C = im.instanceColor ? new Float32Array(count * nv * 3) : null;
  const I = count * triCount > 65535 ? new Uint32Array(count * (index ? index.length : nv)) : new Uint16Array(count * (index ? index.length : nv));
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const col = new THREE.Color();
  let iv = 0;
  let ii = 0;
  for (let k = 0; k < count; k++) {
    im.getMatrixAt(k, m);
    nm.getNormalMatrix(m);
    for (let i = 0; i < nv; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      P[iv * 3] = v.x; P[iv * 3 + 1] = v.y; P[iv * 3 + 2] = v.z;
      if (N) {
        v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        N[iv * 3] = v.x; N[iv * 3 + 1] = v.y; N[iv * 3 + 2] = v.z;
      }
      if (U) {
        const uvAttr = uv;
        U[iv * 2] = uvAttr.getX(i); U[iv * 2 + 1] = uvAttr.getY(i);
      }
      if (C) {
        im.getColorAt(k, col);
        C[iv * 3] = col.r; C[iv * 3 + 1] = col.g; C[iv * 3 + 2] = col.b;
      }
      iv++;
    }
    for (let t = 0; t < triCount; t++) {
      const a = index ? index[t * 3] : t * 3;
      const b = index ? index[t * 3 + 1] : t * 3 + 1;
      const c = index ? index[t * 3 + 2] : t * 3 + 2;
      const off = k * nv;
      I[ii++] = off + a; I[ii++] = off + b; I[ii++] = off + c;
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  if (N) out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  if (U) out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  return out;
}

export function bakeForExport(source) {
  const root = source.clone(true);
  root.updateMatrixWorld(true);

  // replace instanced meshes with baked static meshes
  const instanced = [];
  root.traverse((o) => { if (o.isInstancedMesh) instanced.push(o); });
  for (const im of instanced) {
    const geo = flattenInstances(im);
    const mesh = new THREE.Mesh(geo, im.material);
    mesh.name = im.name || 'instanced';
    mesh.position.copy(im.position);
    mesh.quaternion.copy(im.quaternion);
    mesh.scale.copy(im.scale);
    mesh.userData = { ...im.userData, instancesFlattened: im.count };
    im.parent.add(mesh);
    im.parent.remove(im);
  }
  root.updateMatrixWorld(true);

  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    // Bake the displayed world transform: origin = component base centre on y=0,
    // exactly the frame the viewer (and the spec) describe.
    g.applyMatrix4(o.matrixWorld);
    o.geometry = g;
  });
  // Geometry now already lives in the component's own frame: flatten every node
  // transform so the GLB has a clean, identity origin (no double offsets on load).
  root.traverse((o) => {
    o.position.set(0, 0, 0);
    o.quaternion.set(0, 0, 0, 1);
    o.scale.set(1, 1, 1);
    o.matrixAutoUpdate = false;
    o.matrix.identity();
    o.matrixWorldNeedsUpdate = true;
  });
  root.updateMatrixWorld(true);
  return root;
}

export function applyExportMaterials(root) {
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const src = o.material;
    if (Array.isArray(src)) {
      o.material = src.map((s) => {
        const key = s.uuid;
        if (!cache.has(key)) cache.set(key, approxMaterial(s, s.name));
        return cache.get(key);
      });
      return;
    }
    const key = src.name || src.uuid;
    if (!cache.has(key)) cache.set(key, approxMaterial(src, src.name));
    o.material = cache.get(key);
  });
  return [...cache.values()];
}

export function measure(root) {
  const box = new THREE.Box3().setFromObject(root, true);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min.clone();
  return { size, min, center: box.getCenter(new THREE.Vector3()) };
}

function collectTextures(materials) {
  const seen = new Map();
  for (const mat of materials) {
    for (const [slot, map] of Object.entries(mat)) {
      if (!map || !map.isTexture || seen.has(map.uuid)) continue;
      const img = map.image;
      seen.set(map.uuid, {
        slot,
        name: map.name || `${mat.name}-${slot}`,
        width: img?.width || 0,
        height: img?.height || 0,
        repeat: [map.repeat.x, map.repeat.y],
        colorSpace: map.colorSpace === THREE.SRGBColorSpace ? 'sRGB' : '线性',
        procedural: !!(img && (img instanceof HTMLCanvasElement || img instanceof HTMLImageElement)),
      });
    }
  }
  return [...seen.values()];
}

const fmt = (n, d = 2) => Number(n).toFixed(d);

function paramLines(schema = [], values = {}) {
  if (!schema.length) return ['- 该端没有可调参数；文件即当前显示状态。'];
  return schema.map((p) => {
    const v = values[p.key];
    if (p.kind === 'select') {
      const label = (p.options || []).find(([k]) => k === v)?.[1] ?? v;
      const all = (p.options || []).map(([, l]) => l).join(' / ');
      return `- ${p.label}（${p.key}）= ${label}；可选：${all}`;
    }
    if (p.kind === 'toggle') return `- ${p.label}（${p.key}）= ${v ? '开' : '关'}；开关项`;
    const unit = p.unit ? ` ${p.unit}` : '';
    return `- ${p.label}（${p.key}）= ${v}${unit}；范围 ${p.min}–${p.max}，步长 ${p.step}`;
  });
}

export function buildSpec({ item, side, schema, params, bbox, materials, textures, fileName, degrade }) {
  const sideLabel = side === 'offline' ? '离线生成器' : 'Web GLB 节点';
  const lines = [];
  lines.push(`# ${item.title}（${item.id}）`);
  lines.push('');
  lines.push(`- 导出端：${sideLabel}`);
  lines.push(`- 导出时间：${stamp().replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3 $4:$5:$6')}`);
  lines.push(`- 文件：\`exports/gallery/${fileName}.glb\``);
  lines.push('');
  lines.push('## 单位与坐标系');
  lines.push('');
  lines.push('- 单位：米。1 个文件单位 = 1 米（与成片及展示间一致）。');
  lines.push('- 坐标系：右手系，+Y 向上；构件长轴沿 +X，正面朝 +Z（与展示间默认 3/4 视角一致）。');
  lines.push('- 原点约定：包围盒在 XZ 平面的中心为 (0,0)，底面最低点贴 y = 0，构件站在原点上。');
  lines.push(`- 实测尺寸（X 宽 × Y 高 × Z 深）：${fmt(bbox.size.x)} × ${fmt(bbox.size.y)} × ${fmt(bbox.size.z)} 米；底面 y = ${fmt(bbox.min.y)}。`);
  lines.push('');
  lines.push('## 材质与贴图');
  lines.push('');
  if (materials.length) {
    for (const m of materials) {
      const info = APPROX[m.name];
      const hex = `#${new THREE.Color(m.color).getHexString()}`;
      lines.push(`- ${m.name}${info ? `（${info.label}）` : ''}：基色 ${hex}，粗糙度 ${fmt(m.roughness ?? 0.7)}，金属度 ${fmt(m.metalness ?? 0, 2)}${m.vertexColors ? '，使用顶点色' : ''}`);
    }
  } else {
    lines.push('- 无材质。');
  }
  if (textures.length) {
    lines.push('');
    lines.push('贴图（全部内嵌在 GLB 中）：');
    for (const t of textures) {
      lines.push(`- ${t.name}：${t.width}×${t.height}，${t.colorSpace}，重复 ${t.repeat[0]} × ${t.repeat[1]}${t.procedural ? '，程序化生成后烘焙为 PNG' : ''}`);
    }
  } else {
    lines.push('');
    lines.push('贴图：本件无贴图，颜色由材质基色表达。');
  }
  lines.push('');
  lines.push('## 当前参数（本文件是这一组参数下的快照，不是模板）');
  lines.push('');
  lines.push(...paramLines(schema, params));
  lines.push('');
  lines.push('## 复现与限制');
  lines.push('');
  lines.push('- 文件包含的是调参后的最终几何，可直接当静态资产使用；生成逻辑没有写进文件。');
  lines.push('- 想复现同一件：在展示间把上面的参数调回相同取值即可。');
  lines.push('- 程序化着色器细节（木纹、瓦面做旧、石材质感）无法随 glTF 保存；文件里的材质按上表基色近似，几何、尺寸、朝向与画面一致。');
  if (degrade) lines.push(`- ${degrade}`);
  lines.push('');
  return lines.join('\n');
}

// Reload the written GLB through GLTFLoader to prove the file is usable and
// that its geometry matches what the viewer showed (size, orientation, origin).
export async function measureGlb(url) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene, true);
  const size = box.getSize(new THREE.Vector3());
  let meshes = 0;
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    triangles += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  });
  return { size: size.toArray(), min: box.min.toArray(), max: box.max.toArray(), meshes, triangles };
}

async function postExport(fileName, kind, body) {
  const res = await fetch(`/__gallery/export?name=${encodeURIComponent(fileName)}&kind=${kind}`, {
    method: 'POST',
    headers: { 'content-type': kind === 'spec' ? 'text/markdown; charset=utf-8' : 'model/gltf-binary' },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `导出失败（${res.status}）`);
  return json;
}

export async function exportObject({ object, item, side, schema, params, degrade }) {
  const fileName = `${item.id}-${side}-${stamp()}`;
  const baked = bakeForExport(object);
  const materials = applyExportMaterials(baked);
  const bbox = measure(baked);
  const textures = collectTextures(materials);

  const exporter = new GLTFExporter();
  const glb = await new Promise((resolve, reject) => {
    exporter.parse(baked, resolve, reject, { binary: true, onlyVisible: false, embedImages: true });
  });

  const spec = buildSpec({ item, side, schema, params, bbox, materials, textures, fileName, degrade });
  const model = await postExport(fileName, 'model', glb);
  const doc = await postExport(fileName, 'spec', spec);

  baked.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  for (const m of materials) m.dispose();

  return { fileName, modelPath: model.file, specPath: doc.file, bytes: model.bytes, bbox };
}
