/* water.js — 2D 海水：柔和渐变海色 + 半透明水纹 + 缓涌波带 + 波峰细浪 + 漂浪沫 */
"use strict";

const Water = {
  t: 0,
  update(dt) { this.t += dt; },

  draw(ctx) {
    const W = WORLD.w, H = WORLD.h;
    const t = this.t;

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
    for (let i = 0; i < 5; i++) {
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
    for (let band = 0; band < 10; band++) {
      const yBase = (H / 10) * (band + 0.5);
      const ph = band * 1.37;
      const amp = 7 + (band % 3) * 3;
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
    for (const L of layers) {
      const baseY = H * L.y0;
      ctx.strokeStyle = `rgba(235,250,255,${L.alpha})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y = baseY + Math.sin(x * L.freq + t * L.speed * 0.05) * L.amp
                        + Math.sin(x * L.freq * 2.7 - t * L.speed * 0.08 + 1.4) * L.amp * 0.45;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 漂浮浪沫（碎沫带随风横漂 + 轻微起伏）
    ctx.save();
    if (Assets.has('foam')) {
      for (let i = 0; i < 34; i++) {
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
      for (let i = 0; i < 46; i++) {
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
    for (let i = 0; i < 70; i++) {
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
  },
};
