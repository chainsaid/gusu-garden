import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ---------------------------------------------------------------------------
// 姑苏园林轻量电影感后处理系统
// 包含：微光柔和泛光 (Atmospheric Bloom) + 暗角聚气 (Vignette) + 胶片对比度
// ---------------------------------------------------------------------------

const FilmicGradeShader = {
  name: 'FilmicGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.20 },
    uContrast: { value: 1.04 },
    uWarmth: { value: 0.02 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uContrast;
    uniform float uWarmth;
    varying vec2 vUv;

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      vec3 rgb = col.rgb;

      // 1. 微妙暖调提升 (温润江南文人色温)
      rgb.r += uWarmth * 0.4;
      rgb.g += uWarmth * 0.15;

      // 2. 经典 S 曲线对比度 (避免灰蒙蒙，让白粉墙与黑黛瓦更分明)
      rgb = clamp((rgb - 0.5) * uContrast + 0.5, 0.0, 1.0);

      // 3. 东方意境边缘暗角 (聚焦庭院视觉中心)
      vec2 d = (vUv - 0.5) * 1.35;
      float vig = clamp(1.0 - dot(d, d) * uVignette, 0.0, 1.0);
      rgb *= vig;

      gl_FragColor = vec4(rgb, col.a);
    }
  `,
};

export class PostPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. 初始化合成器
    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(width, height);

    // 2. 基础渲染通道
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // 3. 柔和大气泛光 (晨暮暖阳、水面反光与飞檐微光，阈值设为 1.25，强度设为 0.05，严格对齐原版电影 0.06 泛光比例)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.05,  // strength
      0.25,  // radius
      1.25   // threshold
    );
    this.composer.addPass(this.bloomPass);

    // 4. 文人胶片调色与暗角通道
    this.gradePass = new ShaderPass(FilmicGradeShader);
    this.composer.addPass(this.gradePass);

    // 5. 颜色空间输出通道 (sRGB / ToneMapping)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  render() {
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setEnabled(val) {
    this.enabled = !!val;
  }
}

