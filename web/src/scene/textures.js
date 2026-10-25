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
  ctx.fillStyle = '#687074';
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

// 4.5 极高保真太湖石/冠云峰 PBR 材质套件 (皱漏瘦透溶蚀沟壑 + 矿物氧化 + 法线凹凸)
export function createTaihuRockTextures() {
  const S = 512;
  const heightData = new Float32Array(S * S);

  // 1. 生成程序化溶蚀高程场 (Heightfield)
  for (let y = 0; y < S; y++) {
    const ny = y / S;
    for (let x = 0; x < S; x++) {
      const nx = x / S;
      // (a) 纵向水蚀沟槽 (Vertical dissolution rills)
      const rillFreq = 16.0;
      const rillWarp = Math.sin(ny * 12.0) * 0.08 + Math.sin(ny * 24.0) * 0.03;
      const rillVal = Math.sin((nx + rillWarp) * rillFreq * Math.PI * 2) * 0.5 + 0.5;
      const rill = Math.pow(rillVal, 2.8) * 0.45;

      // (b) 喀斯特多孔蜂窝溶蚀小穴 (Karst dissolution pits)
      const pitVal1 = Math.sin(nx * 38.0) * Math.cos(ny * 38.0);
      const pitVal2 = Math.sin(nx * 76.0 + 1.2) * Math.cos(ny * 76.0 + 0.8);
      const pits = Math.max(0, pitVal1 * 0.6 + pitVal2 * 0.4 - 0.45) * 0.35;

      // (c) 岩石基底细腻砂质起伏
      const baseGrain = (Math.random() - 0.5) * 0.08;

      const idx = y * S + x;
      heightData[idx] = Math.max(0, Math.min(1, 0.5 + rill + pits + baseGrain));
    }
  }

  // 2. 绘制彩色漫反射 (Albedo)
  const aCanvas = document.createElement('canvas');
  aCanvas.width = aCanvas.height = S;
  const actx = aCanvas.getContext('2d');
  const aImg = actx.createImageData(S, S);
  const aData = aImg.data;

  // 太湖石经典色调：冷银灰、氧化赭黄与青苔初萌
  for (let y = 0; y < S; y++) {
    const ny = y / S;
    for (let x = 0; x < S; x++) {
      const nx = x / S;
      const idx = y * S + x;
      const h = heightData[idx];

      // 银白基色 (苏式太湖石，对齐母本 vec3(0.55, 0.57, 0.58))
      let r = 142 + (h - 0.5) * 45;
      let g = 146 + (h - 0.5) * 45;
      let b = 150 + (h - 0.5) * 42;

      // 溶蚀沟底暗青灰阴影
      if (h < 0.42) {
        r *= 0.78; g *= 0.80; b *= 0.82;
      }

      // 局部氧化暖赭矿物晕染
      const ochreNoise = Math.sin(nx * 8.0 + 3.1) * Math.cos(ny * 8.0 + 1.7);
      if (ochreNoise > 0.3) {
        const ochreMix = (ochreNoise - 0.3) * 0.6;
        r = r * (1 - ochreMix) + 165 * ochreMix;
        g = g * (1 - ochreMix) + 148 * ochreMix;
        b = b * (1 - ochreMix) + 118 * ochreMix;
      }

      // 微孔黑斑点缀
      if (Math.random() < 0.015) {
        r *= 0.6; g *= 0.6; b *= 0.6;
      }

      const p4 = idx * 4;
      aData[p4] = Math.floor(Math.max(0, Math.min(255, r)));
      aData[p4 + 1] = Math.floor(Math.max(0, Math.min(255, g)));
      aData[p4 + 2] = Math.floor(Math.max(0, Math.min(255, b)));
      aData[p4 + 3] = 255;
    }
  }
  actx.putImageData(aImg, 0, 0);

  // 3. 由高程场派生 Sobel 切线空间法线贴图 (Normal Map)
  const nCanvas = document.createElement('canvas');
  nCanvas.width = nCanvas.height = S;
  const nctx = nCanvas.getContext('2d');
  const nImg = nctx.createImageData(S, S);
  const nData = nImg.data;
  const bumpStrength = 4.5;

  for (let y = 0; y < S; y++) {
    const ym1 = (y - 1 + S) % S;
    const yp1 = (y + 1) % S;
    for (let x = 0; x < S; x++) {
      const xm1 = (x - 1 + S) % S;
      const xp1 = (x + 1) % S;

      // 3x3 Sobel 差分滤波
      const h00 = heightData[ym1 * S + xm1];
      const h10 = heightData[ym1 * S + x];
      const h20 = heightData[ym1 * S + xp1];
      const h01 = heightData[y * S + xm1];
      const h21 = heightData[y * S + xp1];
      const h02 = heightData[yp1 * S + xm1];
      const h12 = heightData[yp1 * S + x];
      const h22 = heightData[yp1 * S + xp1];

      const dx = (h20 + 2 * h21 + h22) - (h00 + 2 * h01 + h02);
      const dy = (h02 + 2 * h12 + h22) - (h00 + 2 * h10 + h20);

      let nx = -dx * bumpStrength;
      let ny = -dy * bumpStrength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
      nx /= len; ny /= len; nz /= len;

      const p4 = (y * S + x) * 4;
      nData[p4] = Math.floor((nx * 0.5 + 0.5) * 255);
      nData[p4 + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      nData[p4 + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      nData[p4 + 3] = 255;
    }
  }
  nctx.putImageData(nImg, 0, 0);

  const albedoTex = new THREE.CanvasTexture(aCanvas);
  albedoTex.wrapS = albedoTex.wrapT = THREE.RepeatWrapping;
  albedoTex.colorSpace = THREE.SRGBColorSpace;
  albedoTex.repeat.set(4, 4);

  const normalTex = new THREE.CanvasTexture(nCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(4, 4);

  return {
    map: albedoTex,
    normalMap: normalTex,
    roughness: 0.84,
    metalness: 0.02,
  };
}

// 5. 苏州园林经典“花街铺地”庭院地坪贴图 (暖灰青石方砖 + 砂浆拼缝 + 石英质感)
export function createPavingTextures() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');

  // 古旧石灰砂浆底
  ctx.fillStyle = '#585248';
  ctx.fillRect(0, 0, S, S);

  // 绘制方形青石大砖拼缝网格 (温润暖灰花岗岩方砖)
  const tileSize = 64;
  for (let x = 0; x < S; x += tileSize) {
    for (let y = 0; y < S; y += tileSize) {
      const tone = 0.88 + Math.random() * 0.24;
      ctx.fillStyle = `rgb(${Math.floor(148 * tone)}, ${Math.floor(142 * tone)}, ${Math.floor(132 * tone)})`;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

      // 砖缝泥灰阴影
      ctx.fillStyle = '#3e3830';
      ctx.fillRect(x, y, tileSize, 2);
      ctx.fillRect(x, y, 2, tileSize);
    }
  }

  // 微量古意水渍与青苔
  for (let i = 0; i < 40; i++) {
    const rx = Math.random() * S;
    const ry = Math.random() * S;
    ctx.fillStyle = 'rgba(75, 95, 65, 0.28)';
    ctx.beginPath();
    ctx.arc(rx, ry, 4 + Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.repeat.set(16, 16);

  return { map: albedo, roughness: 0.82, metalness: 0.02 };
}

