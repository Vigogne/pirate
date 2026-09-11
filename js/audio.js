/* audio.js — 轻量 WebAudio 合成音效（无外部资源） */
"use strict";

const AudioFX = {
  ctx: null,
  muted: false,
  master: null,
  volume: 1,          // 0..1（设置面板调节）

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35 * this.volume;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  /* 设置音量（0..1）并立即生效 */
  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    this.applyMute();
  },
  applyMute() {
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35 * this.volume;
  },

  _env(dur, gain = 1) {
    const g = this.ctx.createGain();
    g.connect(this.master);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  },

  // 噪声 + 滤波
  _noise(dur, gain, filterFreq, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    const n = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this._env(dur, gain);
    src.connect(f); f.connect(g); src.start();
  },

  _tone(freq, dur, gain, type = 'square', slideTo = null) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
    const g = this._env(dur, gain);
    o.connect(g); o.start();
    o.stop(this.ctx.currentTime + dur + 0.05);
  },

  cannon() { if (this.muted||!this.ctx) return; this._noise(0.18, 0.7, 900); this._tone(140, 0.16, 0.3, 'square', 70); },
  mgun() { if (this.muted||!this.ctx) return; this._noise(0.06, 0.35, 2600, 'highpass'); },
  explosion(big = false) {
    if (this.muted||!this.ctx) return;
    this._noise(big ? 0.7 : 0.4, big ? 0.9 : 0.6, big ? 500 : 750);
    this._tone(90, big ? 0.5 : 0.3, 0.4, 'sine', 40);
  },
  splash() { if (this.muted||!this.ctx) return; this._noise(0.2, 0.25, 1600); },
  torpedo() { if (this.muted||!this.ctx) return; this._tone(220, 0.4, 0.12, 'sine', 120); },
  harpoon() { if (this.muted||!this.ctx) return; this._tone(700, 0.12, 0.22, 'sawtooth', 300); },
  flame() { if (this.muted||!this.ctx) return; this._noise(0.12, 0.16, 1400, 'bandpass'); },
  hit() { if (this.muted||!this.ctx) return; this._tone(420, 0.05, 0.12, 'triangle', 300); },
  thunder() {
    if (this.muted || !this.ctx) return;
    this._noise(1.2, 0.5, 260);
    this._tone(60, 1.0, 0.3, 'sine', 30);
  },
  /* 环境海浪声（低频底噪，按天候强度调用） */
  ambient(strength = 1) {
    if (this.muted || !this.ctx) return;
    this._noise(1.6, 0.06 * strength, 700);
  },
  baseHit() { if (this.muted||!this.ctx) return; this._tone(120, 0.25, 0.35, 'sawtooth', 60); },
  upgrade() { if (this.muted||!this.ctx) return; this._tone(660, 0.1, 0.2, 'square', 990); },
  coin() { if (this.muted||!this.ctx) return; this._tone(880, 0.08, 0.18, 'square', 1180); },
  wave() { if (this.muted||!this.ctx) return; this._tone(330, 0.22, 0.2, 'triangle', 495); },
  lose() { if (this.muted||!this.ctx) return; this._tone(220, 0.9, 0.3, 'sawtooth', 90); },
  win() { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this._tone(f,0.18,0.22,'square'),i*110)); },
};
