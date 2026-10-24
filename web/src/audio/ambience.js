// ---------------------------------------------------------------------------
// ambience.js — 江南水乡姑苏园林沉浸式程序化环境音效 (Web Audio API)
// 包含：荷塘微波水声 (Water Laps) + 檐下竹韵清风 (Breeze) + 偶发幽远琴韵/风铎 (Chime)
// 纯数学合成，体积 0 KB，无需任何外部音频文件网络下载。
// ---------------------------------------------------------------------------

export class JiangnanAmbience {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.masterGain = null;
    this._timer = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
  }

  start() {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isPlaying) return;
    this.isPlaying = true;

    // 1. 荷塘微波水声
    this._startWaterLaps();

    // 2. 庭院竹韵清风
    this._startGentleBreeze();

    // 3. 偶发风铎/古琴清音 (每 6~12 秒随机幽幽轻鸣一声)
    this._scheduleChime();
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this._timer) clearTimeout(this._timer);
    if (this.ctx) {
      this.ctx.suspend();
    }
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  _startWaterLaps() {
    // 生成粉红噪声缓冲
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 3.0;

    // LFO 模拟波浪起伏 (0.25 Hz)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.22;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const waterGain = this.ctx.createGain();
    waterGain.gain.value = 0.28;

    whiteNoise.connect(filter);
    filter.connect(waterGain);
    waterGain.connect(this.masterGain);

    whiteNoise.start();
    lfo.start();
  }

  _startGentleBreeze() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.02;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 450;
    filter.Q.value = 1.2;

    const breezeGain = this.ctx.createGain();
    breezeGain.gain.value = 0.22;

    noise.connect(filter);
    filter.connect(breezeGain);
    breezeGain.connect(this.masterGain);

    noise.start();
  }

  _scheduleChime() {
    if (!this.isPlaying) return;
    const delay = 6000 + Math.random() * 7000;
    this._timer = setTimeout(() => {
      this._playChimeNote();
      this._scheduleChime();
    }, delay);
  }

  _playChimeNote() {
    if (!this.ctx || !this.isPlaying) return;
    // 中国传统五声调式：宫(C)、商(D)、角(E)、徵(G)、羽(A)
    const pentatonicFrequencies = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    const freq = pentatonicFrequencies[Math.floor(Math.random() * pentatonicFrequencies.length)];

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // 泛音清透衰减
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 3.9);
  }
}

