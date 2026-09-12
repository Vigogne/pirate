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
  /* 画质档位：低画质缩短航迹（航迹是逐段描边，最耗性能） */
  get capMax() {
    const q = Settings.quality || 'high';
    return q === 'low' ? Math.round(this.max * 0.35) : (q === 'mid' ? Math.round(this.max * 0.6) : this.max);
  }
  push(x, y, scale = 1) {
    this.pts.push({ x, y, life: 1, s: scale || 1 });
    const cap = this.capMax;
    if (this.pts.length > cap) this.pts.splice(0, this.pts.length - cap);
  }
  update(dt) {
    for (let i = this.pts.length - 1; i >= 0; i--) {
      this.pts[i].life -= dt * 0.75;
      if (this.pts[i].life <= 0) this.pts.splice(i, 1);
    }
  }
  /* 分桶批量描边（含屏外剔除，桶数与 V 边线随画质降级） */
  draw(ctx) {
    const pts = this.pts, n = pts.length;
    if (n < 2) return;
    const q = Settings.quality || 'high';
    if (q === 'low') {
      // 低画质：单桶、单条主线，最省
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#eefdff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = n - 1; i >= 1; i--) {
        const pN = pts[i], pO = pts[i - 1];
        if (!inView(pN.x, pN.y, 60)) continue;
        ctx.moveTo(pO.x, pO.y); ctx.lineTo(pN.x, pN.y);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    const B = q === 'mid' ? 2 : 3;
    ctx.save();
    ctx.lineCap = 'round';
    for (let b = 0; b < B; b++) {
      const lifeHi = 1 - b / B, lifeLo = 1 - (b + 1) / B;
      const midLife = Math.max(0.001, (lifeHi + lifeLo) * 0.5);
      const age = 1 - midLife;
      const alpha = Math.pow(midLife, 1.7) * 0.42;
      if (alpha < 0.02) continue;
      const w = 2 + age * 6.5;
      let any = false;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#eefdff';
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = n - 1; i >= 1; i--) {
        const pN = pts[i];
        if (pN.life > lifeHi || pN.life <= lifeLo) continue;
        if (!inView(pN.x, pN.y, 60)) continue;
        const pO = pts[i - 1];
        ctx.moveTo(pO.x, pO.y); ctx.lineTo(pN.x, pN.y);
        any = true;
      }
      if (any) ctx.stroke();
      // 两侧 V 形边线（中画质只画一条）
      let anyV = false;
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = Math.max(1, w * 0.45);
      ctx.beginPath();
      for (let i = n - 1; i >= 1; i--) {
        const pN = pts[i];
        if (pN.life > lifeHi || pN.life <= lifeLo) continue;
        if (!inView(pN.x, pN.y, 60)) continue;
        const pO = pts[i - 1];
        const dx = pN.x - pO.x, dy = pN.y - pO.y;
        const L = Math.hypot(dx, dy) || 1;
        const lx = -dy / L, ly = dx / L;
        const s = pN.s;
        const o = age * age * (12 + 18 * s) * s;
        const sides = q === 'mid' ? [1] : [-1, 1];
        for (const side of sides) {
          ctx.moveTo(pO.x + lx * o * side, pO.y + ly * o * side);
          ctx.lineTo(pN.x + lx * o * side, pN.y + ly * o * side);
        }
        anyV = true;
      }
      if (anyV) ctx.stroke();
    }
    ctx.restore();
  }
}

/* 海洋生物点缀（海鸥 / 跃鱼 / 远鲸）：纯装饰，随镜头刷新 */
const Ambient = {
  list: [],
  t: 3,
  update(dt, game) {
    if ((Settings.quality || 'high') === 'low') { this.list.length = 0; return; }
    this.t -= dt;
    if (this.t <= 0) {
      this.t = rand(3.5, 8.5);
      const vw = View.w / Settings.zoom, vh = View.h / Settings.zoom;
      const cx = game.cam.x + vw * Math.random();
      const cy = game.cam.y + vh * Math.random();
      const roll = Math.random();
      if (roll < 0.55) {
        this.list.push({ kind: 'gull', x: cx - vw * 0.4, y: cy, vx: rand(70, 130), vy: rand(-18, 18), t: 0, life: rand(5, 9), s: rand(0.8, 1.3), flap: rand(0, 6) });
      } else if (roll < 0.85) {
        this.list.push({ kind: 'fish', x: cx, y: cy, t: 0, life: 1.5, s: rand(0.8, 1.25), ang: rand(0, TAU) });
      } else {
        this.list.push({ kind: 'whale', x: cx - vw * 0.3, y: cy, vx: rand(18, 36), vy: rand(-8, 8), t: 0, life: rand(8, 12), s: rand(1.6, 2.4) });
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      a.t += dt;
      a.x += (a.vx || 0) * dt;
      a.y += (a.vy || 0) * dt;
      if (a.t >= a.life) {
        if (a.kind === 'fish') Particles.splash(a.x, a.y, 0.8);
        this.list.splice(i, 1);
      }
    }
  },
  draw(ctx, layer = 'low') {
    for (const a of this.list) {
      // 分层：海鸥在高空（画在船舰之上），跃鱼/远鲸贴水面（画在船下）
      const isHigh = a.kind === 'gull';
      if ((layer === 'high') !== isHigh) continue;
      const fade = Math.min(1, a.t / 0.6) * Math.min(1, (a.life - a.t) / 0.8);
      ctx.save();
      ctx.globalAlpha = clamp(fade, 0, 1);
      if (a.kind === 'gull') {
        // 海鸥：水面阴影 + 双翼拍动
        ctx.globalAlpha *= 0.22;
        ctx.fillStyle = '#062b45';
        ctx.beginPath(); ctx.ellipse(a.x + 26, a.y + 12, 11 * a.s, 5 * a.s, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = clamp(fade, 0, 1);
        const flap = Math.sin(a.t * 6 + a.flap) * 6 * a.s;
        ctx.strokeStyle = '#f2f7fa';
        ctx.lineWidth = 2 * a.s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x - 9 * a.s, a.y + flap);
        ctx.lineTo(a.x, a.y);
        ctx.lineTo(a.x + 9 * a.s, a.y - flap);
        ctx.stroke();
      } else if (a.kind === 'fish') {
        // 跃鱼：抛物线 + 水花
        const k = a.t / a.life;
        const hop = Math.sin(k * Math.PI) * 26 * a.s;
        ctx.fillStyle = '#cfe6f2';
        ctx.save();
        ctx.translate(a.x, a.y - hop);
        ctx.rotate(Math.sin(k * Math.PI * 2) * 0.5);
        ctx.beginPath();
        ctx.ellipse(0, 0, 7 * a.s, 3 * a.s, 0, 0, TAU); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7 * a.s, 0); ctx.lineTo(-13 * a.s, -4 * a.s); ctx.lineTo(-13 * a.s, 4 * a.s);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        if (k < 0.12 || k > 0.88) {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = '#eafcff';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(a.x, a.y, 10 * a.s * (k < 0.12 ? k / 0.12 : (1 - k) / 0.12), 5 * a.s, 0, 0, TAU); ctx.stroke();
        }
      } else {
        // 远鲸：水下阴影 + 尾鳍
        ctx.globalAlpha *= 0.35;
        ctx.fillStyle = '#062b45';
        ctx.beginPath(); ctx.ellipse(a.x, a.y, 46 * a.s, 16 * a.s, 0.1, 0, TAU); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(a.x - 44 * a.s, a.y);
        ctx.lineTo(a.x - 62 * a.s, a.y - 12 * a.s);
        ctx.lineTo(a.x - 62 * a.s, a.y + 12 * a.s);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = clamp(fade, 0, 1) * 0.25;
        ctx.fillStyle = '#9adcff';
        ctx.beginPath(); ctx.ellipse(a.x + 10 * a.s, a.y - 4 * a.s, 16 * a.s, 4 * a.s, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  },
};

/* 通用粒子池（对象复用 + 画质上限） */
const Particles = {
  list: [],
  _pool: [],

  _cap() {
    const q = Settings.quality || 'high';
    return q === 'low' ? 240 : (q === 'mid' ? 520 : 900);
  },
  _mul(n) {
    const q = Settings.quality || 'high';
    if (q === 'low') return Math.max(1, Math.round(n * 0.45));
    if (q === 'mid') return Math.max(1, Math.round(n * 0.75));
    return n;
  },
  spawn(p) {
    if (this.list.length >= this._cap()) return;
    const obj = this._pool.pop();
    if (obj) { Object.assign(obj, p); this.list.push(obj); }
    else this.list.push(p);
  },
  _recycle(p) {
    p.grow = 0; p.drag = 0; p.grav = 0; p.ang = undefined; p.lw = undefined;
    if (this._pool.length < 700) this._pool.push(p);
  },

  smoke(x, y, n = 4, speed = 20) {
    n = this._mul(n);
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
    n = this._mul(n);
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
    const n = Math.max(2, this._mul(Math.round(6 * size)));
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
    const n = this._mul(big ? 22 : 12);
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
      if (p.life <= 0) {
        L.splice(i, 1);
        this._recycle(p);
        continue;
      }
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
      if (!inView(p.x, p.y, (p.size || 4) + 40)) continue;   // 屏外粒子不绘制
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

  clear() { this.list = []; this._pool = []; },
};
