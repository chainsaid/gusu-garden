import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 姑苏园林程序化东方 PBR 贴图生成器
// 纯 Canvas 像素绘制，零外部网络请求，零图片文件体积，毫秒级初始化。
// ---------------------------------------------------------------------------

function createPerlinLikeNoise(ctx, width, height, scale, octaves, baseAlpha = 1.0) {
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // 简易快速梯度网格伪噪波
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = p[i + 256] = Math.floor(Math.random() * 256);

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  function noise2d(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A = p[X] + Y, B = p[X + 1] + Y;
    return (
      (1 - v) * ((1 - u) * grad(p[A], x, y) + u * grad(p[B], x - 1, y)) +
      v * ((1 - u) * grad(p[A + 1], x, y - 1) + u * grad(p[B + 1], x - 1, y - 1))
    );
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let val = 0;
      let freq = scale;
      let amp = 1.0;
      let ampSum = 0;
      for (let o = 0; o < octaves; o++) {
        val += noise2d(x * freq, y * freq) * amp;
        ampSum += amp;
        amp *= 0.5;
        freq *= 2.0;
      }
      val = (val / ampSum + 1.0) * 0.5; // 0..1
      const idx = (y * width + x) * 4;
      const b = Math.floor(val * 255);
      data[idx] = b;
      data[idx + 1] = b;
      data[idx + 2] = b;
      data[idx + 3] = Math.floor(baseAlpha * 255);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// 1. 白粉墙贴图 (微凹凸抹灰 + 檐下雨水冲刷浅灰渍痕 + 温暖白垩基底)
export function createPlasterTextures() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');

  // 基底：微暖偏米黄的水磨白垩色
  ctx.fillStyle = '#f4f0e8';
  ctx.fillRect(0, 0, S, S);

  // 抹灰微噪波
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = noiseCanvas.height = S;
  const nctx = noiseCanvas.getContext('2d');
  createPerlinLikeNoise(nctx, S, S, 0.04, 3, 0.08);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(noiseCanvas, 0, 0);

  // 垂直雨水冲刷水痕 (纵向流纹)
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S;
    const w = 4 + Math.random() * 18;
    const grad = ctx.createLinearGradient(x, 0, x, S);
    const alpha = 0.03 + Math.random() * 0.06;
    grad.addColorStop(0, `rgba(100, 105, 110, ${alpha * 1.5})`);
    grad.addColorStop(0.3 + Math.random() * 0.4, `rgba(130, 135, 138, ${alpha})`);
    grad.addColorStop(1, `rgba(160, 160, 155, ${alpha * 0.2})`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, S);
  }

  // 底部微弱青苔潮湿晕染 (y=S 处)
  const mossGrad = ctx.createLinearGradient(0, S - 80, 0, S);
  mossGrad.addColorStop(0, 'rgba(80, 100, 75, 0)');
  mossGrad.addColorStop(1, 'rgba(65, 85, 60, 0.12)');
  ctx.fillStyle = mossGrad;
  ctx.fillRect(0, S - 80, S, 80);

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.repeat.set(4, 2);

  // 粗糙度贴图 (0.8 ~ 0.95)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = rCanvas.height = S;
  const rctx = rCanvas.getContext('2d');
  rctx.fillStyle = '#d8d8d8';
  rctx.fillRect(0, 0, S, S);
  createPerlinLikeNoise(rctx, S, S, 0.05, 2, 0.15);
  const roughness = new THREE.CanvasTexture(rCanvas);
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(4, 2);

  return { map: albedo, roughnessMap: roughness, roughness: 0.88, metalness: 0.01 };
}

// 2. 黛瓦屋面贴图 (细腻筒瓦垄沟起伏 + 釉光微泛 + 瓦缝暗影)
export function createTileTextures() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');

  // 深青灰底色 (苏派小青瓦经典色系)
  ctx.fillStyle = '#282f35';
  ctx.fillRect(0, 0, S, S);

  // 绘制横向/纵向瓦垄 (一条条拱起的筒瓦)
  const nRibs = 16;
  const ribW = S / nRibs;
  for (let i = 0; i < nRibs; i++) {
    const x0 = i * ribW;
    const grad = ctx.createLinearGradient(x0, 0, x0 + ribW, 0);
    grad.addColorStop(0, '#1a1f23');      // 瓦沟阴影
    grad.addColorStop(0.2, '#343c44');    // 瓦身坡面
    grad.addColorStop(0.5, '#4a545e');    // 筒瓦脊顶高光反光带
    grad.addColorStop(0.8, '#343c44');    // 瓦身另一侧
    grad.addColorStop(1, '#1a1f23');      // 瓦沟接缝
    ctx.fillStyle = grad;
    ctx.fillRect(x0, 0, ribW, S);
  }

  // 瓦面横向叠压缝 (小青瓦上下搭接阴影)
  const nLap = 8;
  const lapH = S / nLap;
  ctx.fillStyle = 'rgba(10, 12, 14, 0.35)';
  for (let j = 0; j < nLap; j++) {
    ctx.fillRect(0, j * lapH, S, 3);
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.repeat.set(8, 8);

  // 法线贴图 (提供极其生动真实的瓦垄光照立体感)
  const normCanvas = document.createElement('canvas');
  normCanvas.width = normCanvas.height = S;
  const nctx = normCanvas.getContext('2d');
  nctx.fillStyle = '#8080ff'; // 平整法线基底 (0, 0, 1)
  nctx.fillRect(0, 0, S, S);

  const imgData = nctx.getImageData(0, 0, S, S);
  const d = imgData.data;
  for (let x = 0; x < S; x++) {
    const rx = (x % ribW) / ribW; // 0..1
    // 半圆柱拱起的斜率导数: -cos
    const slope = -Math.sin((rx - 0.5) * Math.PI); // -1..1
    const nx = Math.floor((slope * 0.5 + 0.5) * 255);
    for (let y = 0; y < S; y++) {
      const idx = (y * S + x) * 4;
      d[idx] = nx;
      d[idx + 1] = 128; // ny
      d[idx + 2] = 255; // nz
    }
  }
  nctx.putImageData(imgData, 0, 0);
  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(8, 8);

  return { map: albedo, normalMap, roughness: 0.52, metalness: 0.08 };
}

// 3. 栗壳色木构贴图 (明清江南大木桐油大漆 + 天然细腻纵向木纹)
export function createWoodTextures() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');

  // 深沉温润的栗壳色熟桐油漆底
  ctx.fillStyle = '#452014';
  ctx.fillRect(0, 0, S, S);

  // 纵向木纹细流
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * S;
    const w = 1 + Math.random() * 3;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(50, 20, 10, 0.25)' : 'rgba(95, 45, 25, 0.18)';
    ctx.fillRect(x, 0, w, S);
  }

  // 局部的节疤与微暗油润斑驳
  createPerlinLikeNoise(ctx, S, S, 0.03, 2, 0.06);

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.repeat.set(2, 6);

  return { map: albedo, roughness: 0.48, metalness: 0.04 };
}

// 4. 太湖石奇石与花岗岩青石贴图 (透漏皱瘦孔蚀阴影 + 斑驳杂色 + 湿润沉稳)
export function createStoneTextures() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');

  // 太湖青灰石基色
  ctx.fillStyle = '#5c6468';
  ctx.fillRect(0, 0, S, S);

  // 花岗石白石英细粒与黑云母微粒
  const imgData = ctx.getImageData(0, 0, S, S);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const rnd = Math.random();
    if (rnd > 0.88) {
      data[i] += 40; data[i + 1] += 40; data[i + 2] += 40; // 白晶
    } else if (rnd < 0.12) {
      data[i] -= 35; data[i + 1] -= 35; data[i + 2] -= 35; // 黑斑
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // 溶蚀沟槽与溶洞阴影
  createPerlinLikeNoise(ctx, S, S, 0.02, 3, 0.12);

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.repeat.set(3, 3);

  return { map: albedo, roughness: 0.82, metalness: 0.03 };
}

// 5. 苏州园林经典“花街铺地”庭院地坪贴图 (卵石拼花 + 瓦片间杂 + 青石阶沿)
export function createPavingTextures() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');

  // 深泥灰与古旧石灰砂浆底
  ctx.fillStyle = '#42484a';
  ctx.fillRect(0, 0, S, S);

  // 绘制方形青石大砖拼缝网格 (苏式方砖地)
  const tileSize = 64;
  for (let x = 0; x < S; x += tileSize) {
    for (let y = 0; y < S; y += tileSize) {
      const tone = 0.92 + Math.random() * 0.16;
      ctx.fillStyle = `rgb(${Math.floor(70 * tone)}, ${Math.floor(76 * tone)}, ${Math.floor(78 * tone)})`;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      
      // 砖缝泥灰阴影
      ctx.fillStyle = '#262a2b';
      ctx.fillRect(x, y, tileSize, 2);
      ctx.fillRect(x, y, 2, tileSize);
    }
  }

  // 偶有青苔从石缝渗出
  for (let i = 0; i < 30; i++) {
    const rx = Math.random() * S;
    const ry = Math.random() * S;
    ctx.fillStyle = 'rgba(55, 78, 52, 0.35)';
    ctx.beginPath();
    ctx.arc(rx, ry, 6 + Math.random() * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.repeat.set(16, 16);

  return { map: albedo, roughness: 0.84, metalness: 0.02 };
}
