// ---------------------------------------------------------------------------
// weather.js — 江南时序光影与细雨霏霏天气系统
// 支持 4 大经典造园天色切换：
//   1. 晴日晨曦 (Morning) — 柔和天青晨光、薄雾如纱
//   2. 江南细雨 (Drizzle) — 丝丝密雨粒子、水墨青灰烟雨
//   3. 夕照晚霞 (Sunset)  — 熔金落日斜照、暖红黛瓦互映
//   4. 月夜清辉 (Night)   — 幽蓝夜色清池、一轮明月高照
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export const WEATHER_PRESETS = {
  morning: {
    name: '晴日晨曦',
    fogColor: new THREE.Color(0xb6a48f),
    fogDensity: 0.0012,
    sunColor: new THREE.Color(0xffb572),
    sunIntensity: 5.8,
    sunPos: new THREE.Vector3(-0.932, 0.118, 0.337).normalize().multiplyScalar(180),
    hemiSky: new THREE.Color(0xc6dbe4),
    hemiGround: new THREE.Color(0x56483c),
    hemiIntensity: 1.25,
    rain: false,
  },
  drizzle: {
    name: '江南细雨',
    fogColor: new THREE.Color(0x829196),
    fogDensity: 0.0035,
    sunColor: new THREE.Color(0xdde5e8),
    sunIntensity: 1.8,
    sunPos: new THREE.Vector3(-20, 60, 20),
    hemiSky: new THREE.Color(0x9cb0b5),
    hemiGround: new THREE.Color(0x3e494a),
    hemiIntensity: 1.15,
    rain: true,
  },
  sunset: {
    name: '夕照晚霞',
    fogColor: new THREE.Color(0xb6a48f),
    fogDensity: 0.0014,
    sunColor: new THREE.Color(0xffb572),
    sunIntensity: 6.2,
    sunPos: new THREE.Vector3(-0.932, 0.118, 0.337).normalize().multiplyScalar(180),
    hemiSky: new THREE.Color(0xc6dbe4),
    hemiGround: new THREE.Color(0x56483c),
    hemiIntensity: 1.25,
    rain: false,
  },
  night: {
    name: '月夜清辉',
    fogColor: new THREE.Color(0x131922),
    fogDensity: 0.0025,
    sunColor: new THREE.Color(0x8cb6d9), // 皎洁月光
    sunIntensity: 0.85,
    sunPos: new THREE.Vector3(-30, 80, -25),
    hemiSky: new THREE.Color(0x233142),
    hemiGround: new THREE.Color(0x0f151c),
    hemiIntensity: 0.55,
    rain: false,
  },
};

export class WeatherSystem {
  constructor(scene, camera, envLights) {
    this.scene = scene;
    this.camera = camera;
    this.envLights = envLights; // { sunLight, hemiLight }
    this.currentPreset = 'morning';

    // 1. 初始化江南细雨粒子系统
    this._initRainParticles();
  }

  _initRainParticles() {
    const RAIN_COUNT = 1800;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(RAIN_COUNT * 6); // 2 顶点一条雨丝
    const velocities = new Float32Array(RAIN_COUNT);

    const extent = 45;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = (Math.random() - 0.5) * extent;
      const y = Math.random() * 25 + 0.5;
      const z = (Math.random() - 0.5) * extent;
      const len = 0.45 + Math.random() * 0.35;

      const idx = i * 6;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      // 雨丝微倾斜飘落
      positions[idx + 3] = x - 0.04;
      positions[idx + 4] = y - len;
      positions[idx + 5] = z - 0.02;

      velocities[i] = 16.0 + Math.random() * 8.0;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocities = velocities;

    const rainMat = new THREE.LineBasicMaterial({
      color: 0xc4dce2,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });

    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.name = 'jiangnan_rain';
    this.rainLines.visible = false;
    this.scene.add(this.rainLines);
  }

  setWeather(presetKey) {
    const p = WEATHER_PRESETS[presetKey];
    if (!p) return;
    this.currentPreset = presetKey;

    // 平滑过渡或即时设置环境
    if (this.scene.fog) {
      this.scene.fog.color.copy(p.fogColor);
      this.scene.fog.density = p.fogDensity;
    }

    if (this.envLights.sunLight) {
      this.envLights.sunLight.color.copy(p.sunColor);
      this.envLights.sunLight.intensity = p.sunIntensity;
      this.envLights.sunLight.position.copy(p.sunPos);
    }

    if (this.envLights.hemiLight) {
      this.envLights.hemiLight.color.copy(p.hemiSky);
      this.envLights.hemiLight.groundColor.copy(p.hemiGround);
      this.envLights.hemiLight.intensity = p.hemiIntensity;
    }

    // 动态同步物理大气与程序化云霞天空
    if (this.envLights.sky && this.envLights.sky.material && this.envLights.sky.material.uniforms) {
      const u = this.envLights.sky.material.uniforms;
      if (u.uSunDir) u.uSunDir.value.copy(p.sunPos).normalize();
      if (u.sunPosition) u.sunPosition.value.copy(p.sunPos).normalize();

      if (u.uSunI) {
        if (presetKey === 'sunset') {
          u.uSunI.value = 24.0;
          if (u.uCloudCover) u.uCloudCover.value = 0.55;
        } else if (presetKey === 'drizzle') {
          u.uSunI.value = 4.0;
          if (u.uCloudCover) u.uCloudCover.value = 0.88;
        } else if (presetKey === 'night') {
          u.uSunI.value = 0.5;
          if (u.uCloudCover) u.uCloudCover.value = 0.25;
        } else {
          u.uSunI.value = 18.0;
          if (u.uCloudCover) u.uCloudCover.value = 0.50;
        }
      } else if (u.turbidity) {
        if (presetKey === 'sunset') {
          u.turbidity.value = 10.0;
          u.rayleigh.value = 3.6;
          u.mieCoefficient.value = 0.012;
        } else if (presetKey === 'drizzle') {
          u.turbidity.value = 14.0;
          u.rayleigh.value = 1.2;
          u.mieCoefficient.value = 0.02;
        } else if (presetKey === 'night') {
          u.turbidity.value = 2.0;
          u.rayleigh.value = 0.3;
          u.mieCoefficient.value = 0.001;
        } else {
          u.turbidity.value = 7.5;
          u.rayleigh.value = 2.2;
          u.mieCoefficient.value = 0.006;
        }
      }
    } else if (this.scene.background) {
      this.scene.background.copy(p.fogColor);
    }

    // 细雨粒子开关
    this.rainLines.visible = p.rain;
  }

  setRainEnabled(enabled) {
    this.rainLines.visible = enabled;
  }

  update(delta) {
    if (!this.rainLines.visible) return;

    // 雨丝沿 Y 轴加速下落，跟随相机水平中心
    const pos = this.rainLines.geometry.attributes.position;
    const count = pos.count / 2;
    const camX = this.camera.position.x;
    const camZ = this.camera.position.z;
    const extent = 45;

    for (let i = 0; i < count; i++) {
      const idx = i * 2;
      const v = this.rainVelocities[i];
      const dropY = v * delta;

      let y0 = pos.getY(idx) - dropY;
      let y1 = pos.getY(idx + 1) - dropY;

      // 若落入水面或地面，重置回高空
      if (y1 < 0.0) {
        y0 = 24.0 + Math.random() * 4.0;
        const len = 0.45 + Math.random() * 0.35;
        y1 = y0 - len;

        const newX = camX + (Math.random() - 0.5) * extent;
        const newZ = camZ + (Math.random() - 0.5) * extent;

        pos.setX(idx, newX);
        pos.setZ(idx, newZ);
        pos.setX(idx + 1, newX - 0.04);
        pos.setZ(idx + 1, newZ - 0.02);
      }

      pos.setY(idx, y0);
      pos.setY(idx + 1, y1);
    }
    pos.needsUpdate = true;
  }
}

