import * as THREE from 'three';
import { PostPipeline } from './post.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // 1. 初始化 WebGLRenderer (针对交互性能优化)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    
    // 控制像素比 (Retina 屏上限设为 1.5，避免 4K/3K 屏幕带宽过载)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(this.width, this.height);
    
    // 电影级 ACES 胶片色调映射与曝光控制
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // 启用高质量软阴影 (PCFShadowMap)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // 2. 初始化核心场景与相机
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.2, 800);
    this.camera.position.set(8, 2.2, 8);
    this.camera.lookAt(0, 2.8, -2);

    // 3. 电影级后处理管线 (柔和泛光、微冷暖对比度与意境暗角)
    this.post = new PostPipeline(this.renderer, this.scene, this.camera);

    // 4. 性能诊断数据
    this.info = {
      fps: 60,
      drawCalls: 0,
      triangles: 0,
    };
    this._frameCount = 0;
    this._lastFpsTime = performance.now();

    // 5. 监听视口尺寸变更
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    if (this.post) {
      this.post.resize(this.width, this.height);
    }
  }

  render() {
    this.renderer.info.reset();
    
    if (this.post && this.post.enabled) {
      this.post.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    
    // 采样帧率与 Draw Calls
    this._frameCount++;
    const now = performance.now();
    if (now - this._lastFpsTime >= 500) {
      this.info.fps = Math.round((this._frameCount * 1000) / (now - this._lastFpsTime));
      this.info.drawCalls = this.renderer.info.render.calls;
      this.info.triangles = this.renderer.info.render.triangles;
      this._frameCount = 0;
      this._lastFpsTime = now;
    }
  }

  dispose() {
    window.removeEventListener('resize', this._resizeHandler);
    this.renderer.dispose();
  }
}

