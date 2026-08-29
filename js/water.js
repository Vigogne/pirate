/* water.js — 2D 海水：覆盖整张 3 屏海图，动态波浪 + 兵线航路 */
"use strict";

const Water = {
  t: 0,
  update(dt) { this.t += dt; },

  draw(ctx) {
    const W = WORLD.w, H = WORLD.h;
    const t = this.t;

    // 全图渐变：中央略亮，上下略深的远海色
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b4a74');
    g.addColorStop(0.25, '#0e6594');
    g.addColorStop(0.5, '#1179a6');
    g.addColorStop(0.75, '#0e6594');
    g.addColorStop(1, '#0b4a74');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 兵线航路（三条淡淡的浅色水道，给护航舰走）
    ctx.save();
    for (let li = 0; li < LANES.length; li++) {
      const x = LANES[li];
      const lg = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
      lg.addColorStop(0, 'rgba(160,220,230,0)');
      lg.addColorStop(0.5, `rgba(160,220,230,${0.07 + (li === 1 ? 0.03 : 0)})`);
      lg.addColorStop(1, 'rgba(160,220,230,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 60, 0, 120, H);
    }
    ctx.restore();

    // 大尺度明暗带（缓慢起伏）
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = '#0b3f6a';
    for (let band = 0; band < 14; band++) {
      const yBase = (H / 14) * (band + 0.5);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const y = yBase + Math.sin(x * 0.006 + t * 0.6 + band * 1.7) * 14;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // 多层波峰白线
    const layers = [
      { amp: 7,  freq: 0.020, y0: 0.10, speed: 46, alpha: 0.10 },
      { amp: 9,  freq: 0.014, y0: 0.25, speed: -34, alpha: 0.12 },
      { amp: 6,  freq: 0.026, y0: 0.42, speed: 28, alpha: 0.13 },
      { amp: 8,  freq: 0.015, y0: 0.58, speed: -40, alpha: 0.12 },
      { amp: 6,  freq: 0.024, y0: 0.74, speed: 32, alpha: 0.11 },
      { amp: 7,  freq: 0.017, y0: 0.90, speed: -30, alpha: 0.10 },
    ];
    for (const L of layers) {
      const baseY = H * L.y0;
      ctx.strokeStyle = `rgba(255,255,255,${L.alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) {
        const offset = (x * L.freq) + (t * L.speed) * 0.05;
        const y = baseY + Math.sin(offset) * L.amp + Math.sin(offset * 0.5 + 2) * L.amp * 0.4;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 波光粼粼
    ctx.save();
    for (let i = 0; i < 90; i++) {
      const seed = i * 127.13;
      const x = (Math.sin(seed) * 0.5 + 0.5) * W;
      const y = (Math.cos(seed * 1.3) * 0.5 + 0.5) * H;
      const flick = 0.5 + 0.5 * Math.sin(t * 3 + seed);
      const r = 1 + flick * 1.6;
      ctx.globalAlpha = flick * 0.14;
      ctx.fillStyle = '#fff7d0';
      ctx.fillRect(x - r / 2, y, r, r * 0.4);
    }
    ctx.restore();
  },
};
