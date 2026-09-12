/* water.js — 海水：渐变海色 + 水纹 + 缓涌 + 波峰 + 浪沫 + 洋流 + 天候
 * 性能要点：所有图层只在"相机可见矩形"内绘制（世界 1920×4500，可见区通常只有 1/8），
 *          渐变对象缓存复用；浪沫/波光用世界锚定的哈希网格 —— 密度恒定且天然剔除屏外。
 */
"use strict";

/* ================= 海况天候 =================
 * 晴 → 雨 → 雾 → 风暴 轮换；影响航速、射击散布、视野与画面
 * ============================================ */
const Weather = {
  type: 'clear',
  dur: 55,
  fx: { speed: 1, spread: 1, dark: 0 },
  target: { speed: 1, spread: 1, dark: 0 },
  flash: 0,
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
    if (type === 'storm' && typeof AudioFX !== 'undefined' && AudioFX.thunder) AudioFX.thunder();
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
    const k = clamp(dt * 0.5, 0, 1);
    this.fx.speed = lerp(this.fx.speed, this.target.speed, k);
    this.fx.spread = lerp(this.fx.spread, this.target.spread, k);
    this.fx.dark = lerp(this.fx.dark, this.target.dark, k);
    if (this.type === 'storm') {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      if (Math.random() < dt * 0.28) this.flash = 1;
    } else this.flash = Math.max(0, this.flash - dt * 3.2);
  },

  info() { return this.INFO[this.type] || this.INFO.clear; },
  windX() { return this.type === 'storm' ? -42 : (this.type === 'rain' ? -16 : 0); },
  windY() { return this.type === 'storm' ? -18 : 0; },
};

const Water = {
  t: 0,
  _grad: null, _gradCtx: null,
  _fogGrad: null, _fogKey: '',
  update(dt) { this.t += dt; Weather.update(dt); },

  /* 世界锚定伪随机（浪沫/波光网格）：密度恒定、位置稳定、天然剔除屏外 */
  _hash(i, j, salt) {
    let h = (i * 374761393 + j * 668265263 + salt * 2246822519) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  /* 当前可见世界矩形（带 margin）：所有图层都在这个范围内绘制 */
  _view() {
    const zoom = (typeof Settings !== 'undefined' && Settings.zoom) || 1;
    const vw = View.w / zoom, vh = View.h / zoom;
    const cam = (typeof Game !== 'undefined' && Game.cam) ? Game.cam : null;
    if (!cam) return { x: 0, y: 0, w: WORLD.w, h: WORLD.h, vw, vh };
    const m = 70;
    const x = Math.max(0, cam.x - m), y = Math.max(0, cam.y - m);
    return {
      x, y,
      w: Math.min(WORLD.w - x, vw + m * 2),
      h: Math.min(WORLD.h - y, vh + m * 2),
      vw, vh,
    };
  },

  /* 洋流可视化：沿流向漂移的箭头虚线与淡色水道（只在可见区内画） */
  drawCurrents(ctx, view) {
    const t = this.t;
    ctx.save();
    for (let ci = 0; ci < CURRENTS.length; ci++) {
      const cu = CURRENTS[ci];
      if (cu.x + cu.rx < view.x || cu.x - cu.rx > view.x + view.w ||
          cu.y + cu.ry < view.y || cu.y - cu.ry > view.y + view.h) continue;
      const ang = Math.atan2(cu.ay, cu.ax);
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#bfe9ff';
      ctx.beginPath();
      ctx.ellipse(cu.x, cu.y, cu.rx, cu.ry, ang, 0, TAU);
      ctx.fill();
      const n = (Settings.quality || 'high') === 'low' ? 5 : 9;
      ctx.globalAlpha = 0.20;
      ctx.strokeStyle = '#dff6ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const seed = ci * 41.7 + i * 13.3;
        const px = cu.x + (Math.sin(seed) * 0.78) * cu.rx;
        const py = cu.y + (Math.cos(seed * 1.3) * 0.78) * cu.ry;
        const drift = ((t * cu.force * 0.9 + i * 90) % 220) - 110;
        const ax2 = px + cu.ax * drift, ay2 = py + cu.ay * drift;
        if (ax2 < view.x - 80 || ax2 > view.x + view.w + 80) continue;
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
      ctx.globalAlpha = dark * 0.55;
      ctx.fillStyle = type === 'fog' ? '#c8d6e0' : '#0a1830';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (type === 'rain' || type === 'storm') {
      const q = Settings.quality || 'high';
      const n = q === 'low' ? 40 : (q === 'mid' ? 90 : 150);
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
      // 雾幕渐变缓存（尺寸变化才重建）
      const key = w + 'x' + h;
      if (!this._fogGrad || this._fogKey !== key) {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.62);
        g.addColorStop(0, 'rgba(226,236,244,0.05)');
        g.addColorStop(0.55, 'rgba(222,232,240,0.30)');
        g.addColorStop(1, 'rgba(214,226,236,0.72)');
        this._fogGrad = g; this._fogKey = key;
      }
      ctx.fillStyle = this._fogGrad;
      ctx.fillRect(0, 0, w, h);
    }
    if (Weather.flash > 0.01) {
      ctx.globalAlpha = clamp(Weather.flash, 0, 1) * 0.34;
      ctx.fillStyle = '#eaf4ff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  },

  draw(ctx) {
    const W = WORLD.w, H = WORLD.h;
    const t = this.t;
    const view = this._view();
    const vx = view.x, vy = view.y, vw = view.w, vh = view.h;
    const q = Settings.quality || 'high';
    const bandN = q === 'low' ? 3 : (q === 'mid' ? 6 : 10);
    const crestN = q === 'low' ? 2 : (q === 'mid' ? 4 : 6);
    const foamStep = q === 'low' ? 420 : (q === 'mid' ? 320 : 240);   // 浪沫网格边长
    const sparkStep = q === 'low' ? 260 : (q === 'mid' ? 200 : 150);  // 波光网格边长
    const poolN = q === 'low' ? 2 : (q === 'mid' ? 3 : 5);
    const storm = Weather.type === 'storm' ? 1 : (Weather.type === 'rain' ? 0.45 : 0);
    const waveAmp = 1 + storm * 0.85;

    // ① 基础海色（渐变缓存 + 只填可见区）
    if (!this._grad || this._gradCtx !== ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a5c8c');
      g.addColorStop(0.22, '#0e79a8');
      g.addColorStop(0.5, '#1288b5');
      g.addColorStop(0.78, '#0e79a8');
      g.addColorStop(1, '#0a5c8c');
      this._grad = g; this._gradCtx = ctx;
    }
    ctx.fillStyle = this._grad;
    ctx.fillRect(vx, vy, vw, vh);

    // ② 水纹纹理（pattern 世界对齐，只填可见区）
    if (Assets.has('water_0')) {
      Assets.tileRect(ctx, 'water_0', vx, vy, vw, vh, (t * 2.5) % 64, (t * 1.2) % 64, 64, 64);
    }

    // ③ 兵线航路（竖条裁到可见高度）
    ctx.save();
    for (let li = 0; li < LANES.length; li++) {
      const x = LANES[li];
      if (x + 120 < vx || x - 120 > vx + vw) continue;
      const lg = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
      lg.addColorStop(0, 'rgba(170,226,235,0)');
      lg.addColorStop(0.5, `rgba(170,226,235,${0.07 + (li === 1 ? 0.02 : 0)})`);
      lg.addColorStop(1, 'rgba(170,226,235,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 120, vy, 240, vh);
    }
    ctx.restore();

    // ④ 大尺度水色漂移（池子与可见区不相交则跳过）
    ctx.save();
    for (let i = 0; i < poolN; i++) {
      const seed = i * 173.9;
      const px = (Math.sin(seed) * 0.5 + 0.5) * W + Math.sin(t * 0.05 + seed) * 70;
      const py = (Math.cos(seed * 1.4) * 0.5 + 0.5) * H + Math.cos(t * 0.04 + seed) * 50;
      const pr = 150 + (i % 3) * 70;
      if (px + pr < vx || px - pr > vx + vw || py + pr < vy || py - pr > vy + vh) continue;
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

    // ⑤ 缓涌波带：改成"定高条带"（原来从波带线一直填到世界底部，面积巨大）
    const stripH = 78;
    ctx.save();
    for (let band = 0; band < bandN; band++) {
      const yBase = (H / bandN) * (band + 0.5);
      if (yBase + stripH < vy - 40 || yBase - stripH > vy + vh + 40) continue;
      const ph = band * 1.37;
      const amp = (7 + (band % 3) * 3) * waveAmp;
      ctx.beginPath();
      for (let x = vx; x <= vx + vw; x += 18) {
        const y = yBase + Math.sin(x * 0.0035 + t * 0.35 + ph) * amp
                        + Math.sin(x * 0.0082 - t * 0.5 + ph * 2) * amp * 0.35;
        if (x === vx) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = vx + vw; x >= vx; x -= 18) {
        const y = yBase + Math.sin(x * 0.0035 + t * 0.35 + ph) * amp
                        + Math.sin(x * 0.0082 - t * 0.5 + ph * 2) * amp * 0.35;
        ctx.lineTo(x, y + stripH);
      }
      ctx.closePath();
      ctx.fillStyle = band % 2 ? 'rgba(8,70,110,0.055)' : 'rgba(150,225,240,0.05)';
      ctx.fill();
    }
    ctx.restore();

    // ⑥ 波峰细浪（只画可见区，相位仍按世界坐标 → 连续不断线）
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
      if (baseY + L.amp * 2 < vy || baseY - L.amp * 2 > vy + vh) continue;
      ctx.strokeStyle = `rgba(235,250,255,${L.alpha})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = vx; x <= vx + vw; x += 12) {
        const y = baseY + Math.sin(x * L.freq + t * L.speed * 0.05) * L.amp * waveAmp
                        + Math.sin(x * L.freq * 2.7 - t * L.speed * 0.08 + 1.4) * L.amp * 0.45 * waveAmp;
        if (x === vx) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // ⑦ 漂浮浪沫（世界锚定网格：只遍历可见网格，密度恒定）
    ctx.save();
    const foamPer = 1 + Math.round(storm * 0.5);
    if (Assets.has('foam')) {
      const i0 = Math.floor((vx - 300) / foamStep), i1 = Math.floor((vx + vw + 300) / foamStep);
      const j0 = Math.floor(vy / foamStep), j1 = Math.floor((vy + vh) / foamStep);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          for (let k = 0; k < foamPer; k++) {
            const r1 = this._hash(i, j, 11 + k * 7);
            const r2 = this._hash(i, j, 23 + k * 7);
            const r3 = this._hash(i, j, 31 + k * 7);
            const dir = r3 > 0.5 ? 1 : -1;
            const span = foamStep + 260;
            const speed = 14 + ((r1 * 40) | 0);
            const x = i * foamStep + (((r1 * span + t * speed * dir) % span + span) % span) - 130;
            const y = j * foamStep + r2 * foamStep + Math.sin(t * 1.4 + i + j) * 5;
            if (x < vx - 80 || x > vx + vw + 80 || y < vy - 40 || y > vy + vh + 40) continue;
            ctx.globalAlpha = 0.08 + (k % 3) * 0.05;
            Assets.drawAt(ctx, 'foam', x, y, 0.5 + r2 * 0.4);
          }
        }
      }
    } else {
      // 回退：手绘碎浪线
      ctx.strokeStyle = 'rgba(240,252,255,0.16)';
      ctx.lineWidth = 1.6;
      const i0 = Math.floor(vx / foamStep), i1 = Math.floor((vx + vw) / foamStep);
      const j0 = Math.floor(vy / foamStep), j1 = Math.floor((vy + vh) / foamStep);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const r1 = this._hash(i, j, 41), r2 = this._hash(i, j, 43);
          const dir = r1 > 0.5 ? 1 : -1;
          const span = foamStep + 260;
          const speed = 14 + ((r2 * 30) | 0);
          const cx0 = i * foamStep + (((r1 * span + t * speed * dir) % span + span) % span) - 130;
          const y = j * foamStep + r2 * foamStep + Math.sin(t * 1.3 + i) * 4;
          const len = 16 + ((r2 * 30) | 0);
          ctx.beginPath();
          for (let k2 = 0; k2 <= 6; k2++) {
            const px = cx0 + (k2 / 6) * len;
            const py = y + Math.sin(k2 * 1.1 + i + j) * 1.6;
            if (k2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // ⑧ 波光粼粼（同样世界锚定网格：视口内密度恒定）
    ctx.save();
    const sI0 = Math.floor(vx / sparkStep), sI1 = Math.floor((vx + vw) / sparkStep);
    const sJ0 = Math.floor(vy / sparkStep), sJ1 = Math.floor((vy + vh) / sparkStep);
    ctx.fillStyle = '#eafcff';
    for (let i = sI0; i <= sI1; i++) {
      for (let j = sJ0; j <= sJ1; j++) {
        const r1 = this._hash(i, j, 53), r2 = this._hash(i, j, 59), r3 = this._hash(i, j, 61);
        const x = i * sparkStep + r1 * sparkStep;
        const y = j * sparkStep + r2 * sparkStep;
        const flick = 0.5 + 0.5 * Math.sin(t * (1.2 + r3 * 2.5) + i + j);
        const r = 1 + flick * (0.8 + r3 * 1.0);
        ctx.globalAlpha = flick * flick * 0.30;
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
    if (Assets.has('sparkle')) {
      const gI0 = Math.floor(vx / 420), gI1 = Math.floor((vx + vw) / 420);
      const gJ0 = Math.floor(vy / 420), gJ1 = Math.floor((vy + vh) / 420);
      for (let i = gI0; i <= gI1; i++) {
        for (let j = gJ0; j <= gJ1; j++) {
          const r1 = this._hash(i, j, 67), r2 = this._hash(i, j, 71);
          const x = i * 420 + r1 * 420, y = j * 420 + r2 * 420;
          const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7 + j);
          ctx.globalAlpha = tw * 0.20;
          Assets.drawAt(ctx, 'sparkle', x - 6, y - 6, 0.8);
        }
      }
    }
    ctx.restore();

    // ⑨ 洋流
    this.drawCurrents(ctx, view);
  },
};
