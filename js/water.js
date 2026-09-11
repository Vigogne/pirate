/* water.js — 2D 海水：渐变海色 + 水纹 + 缓涌 + 波峰 + 浪沫 + 洋流 + 天候 */
"use strict";

/* ================= 海况天候 =================
 * 晴 → 雨 → 雾 → 风暴 轮换；影响航速、射击散布、视野与画面
 * ============================================ */
const Weather = {
  type: 'clear',
  dur: 55,          // 距下次变化
  fx: { speed: 1, spread: 1, dark: 0 },   // 当前平滑后的系数
  target: { speed: 1, spread: 1, dark: 0 },
  flash: 0,          // 闪电闪白
  _t: 0,
  INFO: {
    clear: { name: '晴朗', icon: '☀️', speed: 1.0, spread: 1.0, dark: 0.0 },
    rain:  { name: '骤雨', icon: '🌧️', speed: 0.96, spread: 1.25, dark: 0.16 },
    fog:   { name: '浓雾', icon: '🌫️', speed: 0.94, spread: 1.15, dark: 0.26 },
    storm: { name: '风暴', icon: '🌩️', speed: 0.88, spread: 1.5, dark: 0.34 },
  },

  set(type, announce) {
    this.type = type;
    const info = this.INFO[type] || this.INFO.clear;
    this.target.speed = info.speed;
    this.target.spread = info.spread;
    this.target.dark = info.dark;
    if (announce && typeof UI !== 'undefined' && UI.toast) {
      UI.toast(`${info.icon} 海况转为「${info.name}」`, 2.0);
    }
    if (type === 'storm' && typeof AudioFX !== 'undefined') AudioFX.thunder && AudioFX.thunder();
  },

  update(dt) {
    this._t += dt;
    this.dur -= dt;
    if (this.dur <= 0) {
      const roll = Math.random();
      const next = roll < 0.42 ? 'clear' : (roll < 0.66 ? 'rain' : (roll < 0.86 ? 'fog' : 'storm'));
      this.set(next === this.type ? 'clear' : next, true);
      this.dur = rand(45, 95);
    }
    const k = clamp(dt * 0.5, 0, 1);   // 缓慢过渡
    this.fx.speed = lerp(this.fx.speed, this.target.speed, k);
    this.fx.spread = lerp(this.fx.spread, this.target.spread, k);
    this.fx.dark = lerp(this.fx.dark, this.target.dark, k);
    // 风暴闪电
    if (this.type === 'storm') {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      if (Math.random() < dt * 0.28) this.flash = 1;
    } else this.flash = Math.max(0, this.flash - dt * 3.2);
  },

  info() { return this.INFO[this.type] || this.INFO.clear; },
  /* 风力（全图统一的侧向推力，随天候变化） */
  windX() { return this.type === 'storm' ? -42 : (this.type === 'rain' ? -16 : 0); },
  windY() { return this.type === 'storm' ? -18 : 0; },
};

const Water = {
  t: 0,
  update(dt) { this.t += dt; Weather.update(dt); },

  /* 洋流可视化：沿流向漂移的箭头虚线与淡色水道 */
  drawCurrents(ctx) {
    const t = this.t;
    ctx.save();
    for (let ci = 0; ci < CURRENTS.length; ci++) {
      const cu = CURRENTS[ci];
      const ang = Math.atan2(cu.ay, cu.ax);
      // 淡色水道
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#bfe9ff';
      ctx.beginPath();
      ctx.ellipse(cu.x, cu.y, cu.rx, cu.ry, ang, 0, TAU);
      ctx.fill();
      // 漂移箭头
      const n = Settings.quality === 'low' ? 5 : 9;
      ctx.globalAlpha = 0.20;
      ctx.strokeStyle = '#dff6ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const seed = ci * 41.7 + i * 13.3;
        const px = cu.x + (Math.sin(seed) * 0.78) * cu.rx;
        const py = cu.y + (Math.cos(seed * 1.3) * 0.78) * cu.ry;
        const drift = ((t * cu.force * 0.9 + i * 90) % 220) - 110;
        const ax2 = px + cu.ax * drift, ay2 = py + cu.ay * drift;
        ctx.beginPath();
        ctx.moveTo(ax2 - cu.ax * 16, ay2 - cu.ay * 16);
        ctx.lineTo(ax2 + cu.ax * 16, ay2 + cu.ay * 16);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax2 + cu.ax * 16, ay2 + cu.ay * 16);
        ctx.lineTo(ax2 + cu.ax * 6 - cu.ay * 6, ay2 + cu.ay * 6 + cu.ax * 6);
        ctx.moveTo(ax2 + cu.ax * 16, ay2 + cu.ay * 16);
        ctx.lineTo(ax2 + cu.ax * 6 + cu.ay * 6, ay2 + cu.ay * 6 - cu.ax * 6);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  /* 天候画面叠加（屏幕空间：雨线 / 雾幕 / 暗色 / 闪电） */
  drawWeatherOverlay(ctx, w, h) {
    const type = Weather.type;
    const dark = Weather.fx.dark;
    if (dark > 0.01) {
      ctx.save();
      ctx.globalAlpha = dark * 0.55;
      ctx.fillStyle = type === 'fog' ? '#c8d6e0' : '#0a1830';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (type === 'rain' || type === 'storm') {
      const n = Settings.quality === 'low' ? 40 : (Settings.quality === 'mid' ? 90 : 150);
      const t = this.t;
      const slant = Weather.windX() * 0.006;
      ctx.save();
      ctx.strokeStyle = type === 'storm' ? 'rgba(210,235,255,0.45)' : 'rgba(200,230,255,0.32)';
      ctx.lineWidth = type === 'storm' ? 1.6 : 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const seed = i * 79.7;
        const speed = type === 'storm' ? 900 : 620;
        const x = ((Math.sin(seed) * 0.5 + 0.5) * (w + 300) + t * speed * slant * 6) % (w + 300) - 150;
        const y = ((Math.cos(seed * 1.7) * 0.5 + 0.5) * (h + 300) + t * speed) % (h + 300) - 150;
        const len = type === 'storm' ? 26 : 18;
        ctx.moveTo(x, y);
        ctx.lineTo(x + slant * len * 6, y + len);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (type === 'fog') {
      // 边缘浓、中心淡的雾幕（视野受限的观感）
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(226,236,244,0.05)');
      g.addColorStop(0.55, 'rgba(222,232,240,0.30)');
      g.addColorStop(1, 'rgba(214,226,236,0.72)');
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (Weather.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = clamp(Weather.flash, 0, 1) * 0.34;
      ctx.fillStyle = '#eaf4ff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },

  draw(ctx) {
    const W = WORLD.w, H = WORLD.h;
    const t = this.t;
    // 画质档位：低画质大幅减少层数（水面是最大绘制开销）
    const q = Settings.quality || 'high';
    const bandN = q === 'low' ? 3 : (q === 'mid' ? 6 : 10);
    const crestN = q === 'low' ? 2 : (q === 'mid' ? 4 : 6);
    const foamN = q === 'low' ? 10 : (q === 'mid' ? 20 : 34);
    const sparkN = q === 'low' ? 16 : (q === 'mid' ? 40 : 70);
    const poolN = q === 'low' ? 2 : (q === 'mid' ? 3 : 5);
    // 风暴：浪更高、浪花更多
    const storm = Weather.type === 'storm' ? 1 : (Weather.type === 'rain' ? 0.45 : 0);
    const waveAmp = 1 + storm * 0.85;

    // 基础海色：上下远海略深的垂直渐变（热带蓝绿）
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a5c8c');
    g.addColorStop(0.22, '#0e79a8');
    g.addColorStop(0.5, '#1288b5');
    g.addColorStop(0.78, '#0e79a8');
    g.addColorStop(1, '#0a5c8c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 水纹纹理（半透明有机斑驳，随水流缓缓漂移 → 无常驻重复感）
    if (Assets.has('water_0')) {
      Assets.tileRect(ctx, 'water_0', 0, 0, W, H, (t * 2.5) % 64, (t * 1.2) % 64, 64, 64);
    }

    // 兵线航路（更淡更宽的水道光）
    ctx.save();
    for (let li = 0; li < LANES.length; li++) {
      const x = LANES[li];
      const lg = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
      lg.addColorStop(0, 'rgba(170,226,235,0)');
      lg.addColorStop(0.5, `rgba(170,226,235,${0.07 + (li === 1 ? 0.02 : 0)})`);
      lg.addColorStop(1, 'rgba(170,226,235,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 120, 0, 240, H);
    }
    ctx.restore();

    // 大尺度水色漂移（柔和明暗光池，缓慢游走，打破纹理重复感）
    ctx.save();
    for (let i = 0; i < poolN; i++) {
      const seed = i * 173.9;
      const px = (Math.sin(seed) * 0.5 + 0.5) * W + Math.sin(t * 0.05 + seed) * 70;
      const py = (Math.cos(seed * 1.4) * 0.5 + 0.5) * H + Math.cos(t * 0.04 + seed) * 50;
      const pr = 150 + (i % 3) * 70;
      const pg = ctx.createRadialGradient(px, py, pr * 0.15, px, py, pr);
      if (i % 2) {
        pg.addColorStop(0, 'rgba(6,56,90,0.14)');
        pg.addColorStop(1, 'rgba(6,56,90,0)');
      } else {
        pg.addColorStop(0, 'rgba(140,225,245,0.11)');
        pg.addColorStop(1, 'rgba(140,225,245,0)');
      }
      ctx.fillStyle = pg;
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
    ctx.restore();

    // 大尺度缓涌（正弦波带，交替明暗，缓慢漂移）
    ctx.save();
    for (let band = 0; band < bandN; band++) {
      const yBase = (H / bandN) * (band + 0.5);
      const ph = band * 1.37;
      const amp = (7 + (band % 3) * 3) * waveAmp;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = yBase + Math.sin(x * 0.0035 + t * 0.35 + ph) * amp
                        + Math.sin(x * 0.0082 - t * 0.5 + ph * 2) * amp * 0.35;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      ctx.fillStyle = band % 2 ? 'rgba(8,70,110,0.05)' : 'rgba(150,225,240,0.045)';
      ctx.fill();
    }
    ctx.restore();

    // 波峰细浪（多层正弦波纹，双向漂移）
    const layers = [
      { amp: 5.5, freq: 0.0075, y0: 0.08, speed: 26, alpha: 0.08 },
      { amp: 7.0, freq: 0.0056, y0: 0.22, speed: -20, alpha: 0.10 },
      { amp: 5.0, freq: 0.0092, y0: 0.38, speed: 16, alpha: 0.11 },
      { amp: 6.5, freq: 0.0060, y0: 0.54, speed: -24, alpha: 0.10 },
      { amp: 5.0, freq: 0.0085, y0: 0.70, speed: 20, alpha: 0.10 },
      { amp: 6.0, freq: 0.0065, y0: 0.86, speed: -18, alpha: 0.09 },
    ];
    ctx.save();
    for (const L of layers.slice(0, crestN)) {
      const baseY = H * L.y0;
      ctx.strokeStyle = `rgba(235,250,255,${L.alpha})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y = baseY + Math.sin(x * L.freq + t * L.speed * 0.05) * L.amp * waveAmp
                        + Math.sin(x * L.freq * 2.7 - t * L.speed * 0.08 + 1.4) * L.amp * 0.45 * waveAmp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 漂浮浪沫（碎沫带随风横漂 + 轻微起伏；风暴时更多）
    ctx.save();
    const foamTotal = foamN + Math.round(storm * 16);
    if (Assets.has('foam')) {
      for (let i = 0; i < foamTotal; i++) {
        const seed = i * 137.7;
        const yBase = ((Math.sin(seed) * 0.5 + 0.5) * H * 0.96) + 40;
        const speed = 16 + (i % 4) * 11;
        const dir = (i % 2) ? 1 : -1;
        const span = W + 240;
        const x = (((seed * 13.3 + t * speed * dir) % span) + span) % span - 120;
        const y = yBase + Math.sin(t * 1.4 + seed) * 5;
        const s = 0.55 + ((i * 11) % 4) * 0.16;
        ctx.globalAlpha = 0.08 + ((i * 5) % 3) * 0.05;
        Assets.drawAt(ctx, 'foam', x, y, s);
      }
    } else {
      // 回退：手绘碎浪线
      ctx.strokeStyle = 'rgba(240,252,255,0.16)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < foamN; i++) {
        const seed = i * 91.7;
        const yBase = (Math.sin(seed) * 0.5 + 0.5) * H * 0.96 + 20;
        const speed = 14 + (i % 4) * 9;
        const dir = (i % 2) ? 1 : -1;
        const span = W + 260;
        const cx0 = (((seed * 17.3 + t * speed * dir) % span) + span) % span - 130;
        const len = 16 + (i % 5) * 9;
        const y = yBase + Math.sin(t * 1.3 + seed) * 4;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const px = cx0 + (k / 6) * len;
          const py = y + Math.sin(k * 1.1 + seed) * 1.6;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();

    // 波光粼粼（细碎闪烁光点 + 少量大颗星光）
    ctx.save();
    for (let i = 0; i < sparkN; i++) {
      const seed = i * 127.13;
      const x = (Math.sin(seed) * 0.5 + 0.5) * W;
      const y = (Math.cos(seed * 1.3) * 0.5 + 0.5) * H;
      const flick = 0.5 + 0.5 * Math.sin(t * (1.2 + (i % 5) * 0.5) + seed);
      const r = 1 + flick * (0.8 + (i % 3) * 0.5);
      ctx.globalAlpha = flick * flick * 0.30;
      ctx.fillStyle = '#eafcff';
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    if (Assets.has('sparkle')) {
      for (let i = 0; i < 8; i++) {
        const seed = i * 311.7;
        const x = (Math.sin(seed) * 0.5 + 0.5) * W;
        const y = (Math.cos(seed * 1.7) * 0.5 + 0.5) * H;
        const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + seed);
        ctx.globalAlpha = tw * 0.20;
        Assets.drawAt(ctx, 'sparkle', x - 6, y - 6, 0.8);
      }
    }
    ctx.restore();

    // 洋流（水道 + 漂移箭头）
    this.drawCurrents(ctx);
  },
};
