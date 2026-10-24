// ---------------------------------------------------------------------------
// interior.js — 水榭室内明代文人中堂陈设系统 (Ming-Style Literati Scholar Hall)
// 包含：中堂水墨山水长轴 + 金字黑漆对联 + 红木翘头条案 + 八仙桌与官帽椅 + 琴台七弦琴 + 罗汉床博古架
// ---------------------------------------------------------------------------
import * as THREE from 'three';

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
  interiorRoot.name = 'jiangnan_scholar_interior';

  // 主厅中心坐标与地面高程
  const cx = 10.0, cz = -18.0;
  const yFloor = 2.12;

  // 1. 红木木作通用材质
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x3d2015,
    roughness: 0.55,
    metalness: 0.04,
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1c,
    roughness: 0.45,
    metalness: 0.08,
  });

  // 2. 中堂水墨大轴
  const scrollTex = createZhongtangTexture();
  const scrollMat = new THREE.MeshStandardMaterial({ map: scrollTex, roughness: 0.85 });
  const scrollMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 0.02), scrollMat);
  scrollMesh.position.set(cx, yFloor + 3.1, cz - 7.75);
  scrollMesh.castShadow = true;
  interiorRoot.add(scrollMesh);

  // 轴头
  const rollerGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 12).rotateZ(Math.PI / 2);
  const rollerTop = new THREE.Mesh(rollerGeo, blackMat);
  rollerTop.position.set(cx, yFloor + 4.7, cz - 7.73);
  const rollerBot = new THREE.Mesh(rollerGeo, blackMat);
  rollerBot.position.set(cx, yFloor + 1.5, cz - 7.73);
  interiorRoot.add(rollerTop, rollerBot);

  // 3. 黑漆对联「清风明月本无价，近水远山皆有情」
  const coupletGeo = new THREE.BoxGeometry(0.38, 2.6, 0.02);
  const rightCouplet = new THREE.Mesh(coupletGeo, new THREE.MeshStandardMaterial({ map: createCoupletTexture('清风明月本无价'), roughness: 0.45 }));
  rightCouplet.position.set(cx + 1.6, yFloor + 3.0, cz - 7.75);
  const leftCouplet = new THREE.Mesh(coupletGeo, new THREE.MeshStandardMaterial({ map: createCoupletTexture('近水远山皆有情'), roughness: 0.45 }));
  leftCouplet.position.set(cx - 1.6, yFloor + 3.0, cz - 7.75);
  interiorRoot.add(rightCouplet, leftCouplet);

  // 4. 红木翘头条案 (Long Altar Table)
  const altarTable = new THREE.Group();
  const topBoard = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 0.65), woodMat);
  topBoard.position.y = 0.95;
  const legGeo = new THREE.BoxGeometry(0.12, 0.95, 0.55);
  const legL = new THREE.Mesh(legGeo, woodMat);
  legL.position.set(-1.85, 0.475, 0);
  const legR = new THREE.Mesh(legGeo, woodMat);
  legR.position.set(1.85, 0.475, 0);
  altarTable.add(topBoard, legL, legR);
  altarTable.position.set(cx, yFloor, cz - 6.8);
  interiorRoot.add(altarTable);

  // 5. 八仙方桌与四出头太师椅 (Square Table & Armchairs)
  const squareTable = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.88, 1.15), woodMat);
  squareTable.position.set(cx, yFloor + 0.44, cz - 4.5);
  interiorRoot.add(squareTable);

  function createChair(px, pz, ry = 0) {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.52), woodMat);
    seat.position.y = 0.52;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.58, 0.05), woodMat);
    back.position.set(0, 0.81, -0.24);
    const leg = new THREE.BoxGeometry(0.05, 0.52, 0.05);
    for (const sx of [-0.24, 0.24]) {
      for (const sz of [-0.22, 0.22]) {
        const cl = new THREE.Mesh(leg, woodMat);
        cl.position.set(sx, 0.26, sz);
        chair.add(cl);
      }
    }
    chair.add(seat, back);
    chair.position.set(px, yFloor, pz);
    chair.rotation.y = ry;
    return chair;
  }

  interiorRoot.add(createChair(cx - 1.15, cz - 4.5, Math.PI / 2));
  interiorRoot.add(createChair(cx + 1.15, cz - 4.5, -Math.PI / 2));
  interiorRoot.add(createChair(cx - 1.6, cz - 2.8, 0));
  interiorRoot.add(createChair(cx + 1.6, cz - 2.8, 0));

  // 6. 东次间琴台雅集 (七弦古琴与琴案)
  const qinDesk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.78, 0.48), woodMat);
  qinDesk.position.set(cx + 5.2, yFloor + 0.39, cz - 4.2);
  const qinGeo = new THREE.BoxGeometry(1.2, 0.05, 0.22);
  const qin = new THREE.Mesh(qinGeo, blackMat);
  qin.position.set(cx + 5.2, yFloor + 0.805, cz - 4.2);
  interiorRoot.add(qinDesk, qin);

  // 7. 西次间文人罗汉床与博古架
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.52, 1.25), woodMat);
  bed.position.set(cx - 5.5, yFloor + 0.26, cz - 4.0);
  const curio = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.5, 0.38), woodMat);
  curio.position.set(cx - 7.2, yFloor + 1.25, cz - 6.6);
  interiorRoot.add(bed, curio);

  scene.add(interiorRoot);

  return {
    group: interiorRoot,
    setVisible: (visible) => {
      interiorRoot.visible = visible;
    }
  };
}

