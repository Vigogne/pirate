/* effects.js — 粒子特效 + 航迹泡沫 */
"use strict";

/* 航迹（随船身大小缩放、沿真实路径连续延伸的V形泡沫带）
 * 记录每帧路径中心点；绘制时逐段沿路径方向描"主沫带 + 两条随老化
 * 张开的V边线"——所有偏移都取自路径本身的方向，转向/转弯不断线。 */
class WakeTrail {
  constructor(max = 170) {
    this.pts = [];      // {x,y,life,s}
    this.max = max;
  }
  push(x, y, scale = 1) {
    this.pts.push({ x, y, life: 1, s: scale || 1 });
    if (this.pts.length > this.max) this.pts.splice(0, this.pts.length - this.max);
  }
  update(dt) {
    for (let i = this.pts.length - 1; i >= 0; i--) {
      this.pts[i].life -= dt * 0.75;
      if (this.pts[i].life <= 0) this.pts.splice(i, 1);
    }
  }
  draw(ctx) {
    const n = this.pts.length;
    if (n < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = n - 1; i >= 1; i--) {
      const pN = this.pts[i], pO = this.pts[i - 1];   // pN 靠船更近
      const life = clamp(pN.life, 0, 1);
      const age = 1 - life;
      const alpha = Math.pow(life, 1.7) * 0.42;
      if (alpha < 0.02) continue;
      const dx = pN.x - pO.x, dy = pN.y - pO.y;
      const L = Math.hypot(dx, dy) || 1;
      const lx = -dy / L, ly = dx / L;               // 路径法线（跟随转弯）
      const s = pN.s;
      const w = (2 + age * (2.5 + 4 * s)) * s;       // 主沫带宽
      const o = age * age * (12 + 18 * s) * s;       // V 形张角（向后张开）
      // 主沫带
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#eefdff';
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(pO.x, pO.y); ctx.lineTo(pN.x, pN.y); ctx.stroke();
      // 两侧V边线
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = Math.max(1, w * 0.45);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(pO.x + lx * o * side, pO.y + ly * o * side);
        ctx.lineTo(pN.x + lx * o * side, pN.y + ly * o * side);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* 通用粒子池 */
const Particles = {
  list: [],
  spawn(p) { this.list.push(p); },

  smoke(x, y, n = 4, speed = 20) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        type: 'smoke', layer: 'high',
        x: x + rand(-4, 4), y: y + rand(-4, 4),
        vx: rand(-speed, speed) * 0.5, vy: rand(-speed, speed) * 0.5 - 12,
        life: rand(0.5, 0.9), max: rand(0.5, 0.9),
        size: rand(4, 8), grow: 14, color: '#b8c2cc',
        drag: 0.9,
      });
    }
  },

  spark(x, y, ang, n = 8, color = '#ffd76a') {
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-0.4, 0.4);
      const s = rand(80, 260);
      this.spawn({
        type: 'spark', layer: 'high',
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.2, 0.45), max: 0.45, size: rand(1, 2.4),
        color, drag: 0.86, grav: 160,
      });
    }
  },

  splash(x, y, size = 1) {
    const n = Math.round(6 * size);
    for (let i = 0; i < n; i++) {
      this.spawn({
        type: 'splash', layer: 'low',
        x: x + rand(-6, 6), y: y + rand(-3, 3),
        vx: rand(-70, 70), vy: rand(-120, -30),
        life: rand(0.3, 0.7), max: 0.7, size: rand(2, 4) * size,
        color: '#dbeeff', drag: 0.9, grav: 300,
      });
    }
    // 涟漪
    this.spawn({
      type: 'ring', layer: 'low',
      x, y, vx: 0, vy: 0, life: 0.5, max: 0.5,
      size: 4 * size, grow: 60 * size, color: 'rgba(220,245,255,0.7)',
    });
  },

  explosion(x, y, radius = 40, color = '#ff8b2a', big = false) {
    // 火光
    this.spawn({
      type: 'fireball', layer: 'high',
      x, y, vx: 0, vy: 0, life: 0.35, max: 0.35,
      size: radius * 0.5, grow: radius * 1.2, color,
    });
    // 冲击环
    this.spawn({
      type: 'ring', layer: 'high',
      x, y, vx: 0, vy: 0, life: 0.5, max: 0.5,
      size: 6, grow: radius * 1.6, color: 'rgba(255,230,170,0.9)', lw: 4,
    });
    // 碎片
    const n = big ? 22 : 12;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(120, 320);
      this.spawn({
        type: 'spark', layer: 'high',
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.3, 0.6), max: 0.6, size: rand(1.5, 3),
        color: i % 3 ? '#ffcf70' : '#ff7a2a', drag: 0.88, grav: 140,
      });
    }
    // 浓烟
    this.smoke(x, y, big ? 10 : 6, 40);
    // 水花（整片海图都是海）
    this.splash(x, y, big ? 2 : 1.3);
  },

  muzzle(x, y, ang, color = '#ffd76a') {
    this.spawn({
      type: 'flash', layer: 'high',
      x, y, vx: 0, vy: 0, life: 0.08, max: 0.08,
      size: 10, color, ang,
    });
    this.spark(x, y, ang, 4, color);
    this.smoke(x, y, 2, 26);
  },

  flamePuff(x, y, ang, dist, color) {
    const spread = rand(-0.2, 0.2);
    const a = ang + spread;
    const sp = rand(120, 240);
    this.spawn({
      type: 'flame', layer: 'high',
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.25, 0.5), max: 0.5, size: rand(6, 11),
      color, drag: 0.9,
    });
  },

  ring(x, y, radius, color = 'rgba(255,230,170,0.9)') {
    this.spawn({
      type: 'ring', layer: 'high',
      x, y, vx: 0, vy: 0, life: 0.45, max: 0.45,
      size: 6, grow: radius * 1.3, color, lw: 3,
    });
  },

  foam(x, y, size = 1) {
    this.spawn({
      type: 'splash', layer: 'low',
      x, y, vx: rand(-30, 30), vy: rand(-20, 10),
      life: rand(0.3, 0.5), max: 0.5, size: rand(2, 4) * size,
      color: '#dff2ff', drag: 0.92,
    });
  },

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      if (p.drag) { p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60); }
      if (p.grav) p.vy += p.grav * dt;
      if (p.grow) p.size += p.grow * dt;
    }
  },

  draw(ctx, layer) {
    ctx.save();
    for (const p of this.list) {
      if (p.layer !== layer) continue;
      const a = clamp(p.life / p.max, 0, 1);
      switch (p.type) {
        case 'smoke':
          ctx.globalAlpha = a * 0.4;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'spark':
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'splash':
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.7);
          break;
        case 'fireball':
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          ctx.globalAlpha = a * 0.7;
          ctx.fillStyle = '#fff2c0';
          ctx.fillRect(p.x - p.size * 0.28, p.y - p.size * 0.28, p.size * 0.56, p.size * 0.56);
          break;
        case 'ring':
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.lw || 2.5;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4);
          ctx.strokeRect(-p.size, -p.size, p.size * 2, p.size * 2);
          ctx.restore();
          break;
        case 'flash':
          ctx.globalAlpha = a;
          ctx.fillStyle = '#fff8d0';
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.ang || 0);
          ctx.beginPath();
          ctx.moveTo(p.size, 0);
          ctx.lineTo(-p.size * 0.6, -p.size * 0.4);
          ctx.lineTo(-p.size * 0.6, p.size * 0.4);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        case 'flame':
          ctx.globalAlpha = a * 0.85;
          const g = Math.floor(255 * (0.6 + a * 0.4));
          ctx.fillStyle = `rgb(${255},${Math.floor(120 * a + 40)},${Math.floor(30 * a)})`;
          const fs = p.size * (0.7 + a * 0.4);
          ctx.fillRect(p.x - fs / 2, p.y - fs / 2, fs, fs);
          break;
      }
    }
    ctx.restore();
  },

  clear() { this.list = []; },
};
