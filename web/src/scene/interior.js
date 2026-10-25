// ---------------------------------------------------------------------------
// interior.js — 水榭室内明代文人中堂陈设系统 (Ming-Style Literati Scholar Hall)
// 包含：中堂水墨山水长轴 + 金字黑漆对联 + 红木翘头条案 + 八仙桌与官帽椅 + 琴台七弦琴 + 罗汉床博古架
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { L } from '../../../shared/layout.js';

// 1. 程序化宣纸水墨远山立轴贴图
function createZhongtangTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');

  // 古宣纸底色
  ctx.fillStyle = '#eddcc4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 天头与地脚裱绢绫边
  ctx.fillStyle = '#bda588';
  ctx.fillRect(0, 0, canvas.width, 70);
  ctx.fillRect(0, canvas.height - 90, canvas.width, 90);
  ctx.fillRect(0, 0, 45, canvas.height);
  ctx.fillRect(canvas.width - 45, 0, 45, canvas.height);

  // 绫牙金线
  ctx.strokeStyle = '#8a6b46';
  ctx.lineWidth = 2;
  ctx.strokeRect(45, 70, canvas.width - 90, canvas.height - 160);

  // 画心水墨群峰
  const cx0 = 47, cy0 = 72, cw = canvas.width - 94, ch = canvas.height - 164;
  const grad = ctx.createLinearGradient(0, cy0, 0, cy0 + ch);
  grad.addColorStop(0, '#f4eee2');
  grad.addColorStop(1, '#ddd0b8');
  ctx.fillStyle = grad;
  ctx.fillRect(cx0, cy0, cw, ch);

  // 远山
  ctx.fillStyle = 'rgba(100, 108, 115, 0.35)';
  ctx.beginPath();
  ctx.moveTo(cx0, cy0 + ch * 0.45);
  ctx.bezierCurveTo(cx0 + cw * 0.25, cy0 + ch * 0.22, cx0 + cw * 0.5, cy0 + ch * 0.35, cx0 + cw * 0.65, cy0 + ch * 0.18);
  ctx.bezierCurveTo(cx0 + cw * 0.8, cy0 + ch * 0.12, cx0 + cw * 0.9, cy0 + ch * 0.28, cx0 + cw, cy0 + ch * 0.38);
  ctx.lineTo(cx0 + cw, cy0 + ch);
  ctx.lineTo(cx0, cy0 + ch);
  ctx.fill();

  // 近景重峦苍松
  ctx.fillStyle = 'rgba(28, 34, 38, 0.85)';
  ctx.beginPath();
  ctx.moveTo(cx0 + cw * 0.1, cy0 + ch);
  ctx.lineTo(cx0 + cw * 0.2, cy0 + ch * 0.68);
  ctx.bezierCurveTo(cx0 + cw * 0.35, cy0 + ch * 0.62, cx0 + cw * 0.45, cy0 + ch * 0.72, cx0 + cw * 0.55, cy0 + ch * 0.66);
  ctx.lineTo(cx0 + cw * 0.7, cy0 + ch);
  ctx.fill();

  // 朱砂印章
  ctx.fillStyle = '#b72a22';
  ctx.fillRect(cx0 + cw * 0.12, cy0 + ch * 0.82, 18, 22);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 2. 黑漆真金对联贴图
function createCoupletTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#181514'; // 黑大漆
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#8a6428';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  ctx.fillStyle = '#dca646'; // 金字
  ctx.font = 'bold 36px "KaiTi", "STKaiti", "PingFang SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = text.split('');
  const spacing = (canvas.height - 120) / chars.length;
  chars.forEach((c, i) => {
    ctx.fillText(c, canvas.width / 2, 70 + i * spacing);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createJiangnanInterior(scene) {
  const interiorRoot = new THREE.Group();
  interiorRoot.name = 'jiangnan_scholar_interior_lighting';

  // 主厅中心坐标与地面高程 (从 Node 版权威源 shared/layout.js 的 L.hall.center 同步)
  const [cx, , cz] = L.hall.center;
  const yFloor = 2.12;

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1c,
    roughness: 0.45,
    metalness: 0.08,
  });

  // 1. 室内暖色中堂宫灯与烛火照明系统 (温润明堂，柔和漫射文人雅集暖光，杜绝地面镜面光斑白曝)
  const warmAltarLight = new THREE.PointLight(0xffbe78, 4.5, 12, 1.8);
  warmAltarLight.position.set(cx, yFloor + 1.8, cz - 4.5);
  interiorRoot.add(warmAltarLight);

  const floorLightL = new THREE.PointLight(0xff9e4d, 1.8, 5, 2.0);
  floorLightL.position.set(cx - 2.85, yFloor + 0.85, cz - 4.5);
  interiorRoot.add(floorLightL);

  const floorLightR = new THREE.PointLight(0xff9e4d, 1.8, 5, 2.0);
  floorLightR.position.set(cx + 2.85, yFloor + 0.85, cz - 4.5);
  interiorRoot.add(floorLightR);

  const porchLight = new THREE.PointLight(0xffcb88, 6.0, 10, 1.8);
  porchLight.position.set(cx, yFloor + 2.6, cz + 2.0);
  interiorRoot.add(porchLight);

  // 9. 水榭前廊挑檐挂灯 (4 盏江南朱漆古绢六角挑灯，点亮雕花木棂)
  const lanternPaperMat = new THREE.MeshStandardMaterial({
    color: 0xffe8b8,
    emissive: 0xff9438,
    emissiveIntensity: 2.4,
    roughness: 0.75,
  });

  const lanternRoofGeo = new THREE.ConeGeometry(0.32, 0.15, 6);
  const lanternBodyGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.42, 6);
  const lanternBaseGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.08, 6);

  const lanternPositions = [
    [cx - 6.8, yFloor + 2.8, cz + 5.8],
    [cx - 2.4, yFloor + 2.8, cz + 5.8],
    [cx + 2.4, yFloor + 2.8, cz + 5.8],
    [cx + 6.8, yFloor + 2.8, cz + 5.8],
  ];

  lanternPositions.forEach((pos) => {
    const lanternGroup = new THREE.Group();
    const roof = new THREE.Mesh(lanternRoofGeo, blackMat);
    roof.position.y = 0.28;
    const body = new THREE.Mesh(lanternBodyGeo, lanternPaperMat);
    const base = new THREE.Mesh(lanternBaseGeo, blackMat);
    base.position.y = -0.25;

    lanternGroup.add(roof, body, base);
    lanternGroup.position.set(pos[0], pos[1], pos[2]);
    interiorRoot.add(lanternGroup);

    // 挂灯微光
    const lLight = new THREE.PointLight(0xff9838, 14, 8, 2);
    lLight.position.set(pos[0], pos[1] - 0.1, pos[2]);
    interiorRoot.add(lLight);
  });

  scene.add(interiorRoot);

  return {
    group: interiorRoot,
    setVisible: (visible) => {
      interiorRoot.visible = visible;
    }
  };
}

