/* map.js — 上下两座基地海岛：沙滩 / 椰子树 / 船坞 */
"use strict";

const Map = {
  t: 0,
  update(dt) { this.t += dt; },

  draw(ctx, game) {
    const W = WORLD.w, H = WORLD.h;

    // 陆地岛群（数据与碰撞同一来源 LAND；基地岛另有绘制）
    for (const l of LAND) {
      if (l.base) continue;
      this._island(ctx, l);
    }

    // 双方基地岛（含船坞与椰子树）
    for (const base of game.bases) {
      this._baseIsland(ctx, game, base);
    }
  },

  // 大中型陆地岛（沙滩 + 椰树 + 草）
  _island(ctx, l) {
    const x = l.x, y = l.y, rx = l.rx, ry = l.ry;
    const big = rx >= 90;

    // 浅滩光晕
    const halo = ctx.createRadialGradient(x, y, Math.min(rx, ry) * 0.4, x, y, Math.max(rx, ry) * 1.25);
    halo.addColorStop(0, 'rgba(140,220,200,0.25)');
    halo.addColorStop(1, 'rgba(140,220,200,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.ellipse(x, y, rx * 1.3, ry * 1.3, 0, 0, TAU); ctx.fill();

    // 沙滩主体
    const sand = ctx.createRadialGradient(x, y, 8, x, y, Math.max(rx, ry));
    sand.addColorStop(0, big ? '#edd58f' : '#efd99f');
    sand.addColorStop(0.75, '#d9b878');
    sand.addColorStop(1, 'rgba(205,170,105,0.55)');
    ctx.fillStyle = sand;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();

    // 岸线泡沫（波动）
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let a = 0; a <= TAU + 0.1; a += 0.1) {
      const wob = Math.sin(a * 5 + this.t * 2) * 3;
      const px = x + Math.cos(a) * (rx + wob);
      const py = y + Math.sin(a) * (ry + wob);
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 内部草甸
    ctx.fillStyle = 'rgba(86,158,96,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y, rx * 0.5, ry * 0.52, 0, 0, TAU); ctx.fill();
    // 草叶
    ctx.strokeStyle = 'rgba(60,120,60,0.7)';
    ctx.lineWidth = 1.2;
    const gn = big ? 10 : 5;
    for (let i = 0; i < gn; i++) {
      const gg = i * 2.39 + l.x;
      const gx = x + (Math.sin(gg) * 0.42) * rx;
      const gy = y + (Math.cos(gg * 1.3) * 0.4) * ry;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + 2, gy - 7, gx + 3, gy - 11 - Math.sin(this.t * 1.6 + i) * 1.5);
      ctx.stroke();
    }

    // 椰子树（大岛上）
    const pn = big ? 4 : 2;
    for (let i = 0; i < pn; i++) {
      const a = (i / pn) * TAU + l.x;
      const px = x + Math.cos(a) * rx * 0.66;
      const py = y + Math.sin(a) * ry * 0.62;
      this._palm(ctx, px, py, 0.85 + (i % 2) * 0.18);
    }
  },

  _baseIsland(ctx, game, base) {
    const team = TEAM[base.team];
    const x = base.x, y = base.y;
    const top = base.team === 1;               // 敌方基地在上方
    const R = 150;                              // 岛屿半径

    // 沙滩椭圆
    const sand = ctx.createRadialGradient(x, y, 20, x, y, R);
    sand.addColorStop(0, '#efd9a0');
    sand.addColorStop(0.8, '#d8b878');
    sand.addColorStop(1, 'rgba(210,175,110,0.0)');
    ctx.fillStyle = sand;
    ctx.beginPath(); ctx.ellipse(x, y, R * 1.18, R * 0.86, 0, 0, TAU); ctx.fill();

    // 沙滩波纹
    ctx.strokeStyle = 'rgba(180,140,80,0.35)';
    ctx.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.ellipse(x, y, R * (0.78 + i * 0.1), R * 0.58 * (0.78 + i * 0.1), 0, 0, TAU); ctx.stroke();
    }

    // 岸线泡沫（环岛）
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let a = 0; a <= TAU + 0.1; a += 0.08) {
      const wob = Math.sin(a * 5 + this.t * 2) * 4;
      const px = x + Math.cos(a) * (R * 1.18 + wob);
      const py = y + Math.sin(a) * (R * 0.86 + wob);
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 椰子树（岛周）
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = top ? Math.PI * (0.15 + 0.7 * i / (n - 1)) : Math.PI * (1.15 + 0.7 * i / (n - 1));
      const px = x + Math.cos(a) * R * 0.72;
      const py = y + Math.sin(a) * R * 0.55;
      this._palm(ctx, px, py, 0.95 + (i % 2) * 0.2);
    }

    // 船坞基地
    this._shipyard(ctx, game, base, team);
  },

  // 椰子树（随 t 摇摆）
  _palm(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const sway = Math.sin(this.t * 1.1 + x * 0.1) * 0.05;

    ctx.strokeStyle = '#7a4b26';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4 + sway * 20, -30, -8 + sway * 40, -58);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(60,35,15,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) {
      const tt = i / 6;
      const bx = (-8 + sway * 40) * tt * tt;
      const by = -58 * tt;
      ctx.beginPath(); ctx.moveTo(bx - 3 - sway * 4, by); ctx.lineTo(bx + 3 + sway * 4, by); ctx.stroke();
    }

    const cx = -8 + sway * 40, cy = -58;
    ctx.save();
    ctx.translate(cx, cy);
    const fronds = 7;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + sway;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#2f8f4e' : '#37a45a';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(24, -2, 40, 6 + Math.sin(this.t * 2 + i) * 3);
      ctx.quadraticCurveTo(24, 2, 0, 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#6b4a22';
    ctx.beginPath(); ctx.arc(-4, 2, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(4, 2, 3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  },

  // 船坞基地（各队配色）
  _shipyard(ctx, game, base, team) {
    const x = base.x, y = base.y;
    const w = 210, h = 70;
    const top = base.team === 1;
    ctx.save();
    ctx.translate(x, y);

    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, top ? '#9a5f3a' : '#8a6336');
    g.addColorStop(1, top ? '#5f3a24' : '#5f4326');
    ctx.fillStyle = g;
    roundRect(ctx, -w / 2, -h * 0.5, w, h, 9); ctx.fill();
    ctx.strokeStyle = '#3f2c17'; ctx.lineWidth = 3; ctx.stroke();

    ctx.strokeStyle = 'rgba(40,26,14,0.6)'; ctx.lineWidth = 1.4;
    for (let i = 1; i < 6; i++) {
      const yy = -h * 0.5 + (h / 6) * i;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 6, yy); ctx.lineTo(w / 2 - 6, yy); ctx.stroke();
    }

    // 吊机（朝向海面一侧）
    const dir = top ? 1 : -1;
    ctx.fillStyle = '#3a2a18';
    roundRect(ctx, -w / 2 - 30, dir > 0 ? -h * 0.5 : -h * 0.5, 20, 66, 3); ctx.fill();
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 20, -h * 0.5 - 6);
    ctx.quadraticCurveTo(w * 0.35, -h * 0.5 - 30, w * 0.25, -h * 0.5 + 8);
    ctx.stroke();

    // 旗帜（队伍色）
    ctx.strokeStyle = '#2a1c0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w / 2 - 12, -h * 0.5); ctx.lineTo(w / 2 - 12, -h * 0.5 - 44); ctx.stroke();
    ctx.fillStyle = team.color;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, -h * 0.5 - 44);
    ctx.lineTo(w / 2 - 40, -h * 0.5 - 37);
    ctx.lineTo(w / 2 - 12, -h * 0.5 - 30);
    ctx.closePath(); ctx.fill();

    // 队伍徽记
    ctx.fillStyle = team.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(base.team === 0 ? '我' : '敌', 0, 1);
    ctx.textBaseline = 'alphabetic';

    // 基地血条（队伍色）
    const bw = w * 0.72, bh = 9;
    const bx = -bw / 2, by = top ? -h * 0.5 - 24 : h * 0.5 + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
    const pct = clamp(base.hp / base.maxHp, 0, 1);
    ctx.fillStyle = team.color;
    roundRect(ctx, bx, by, bw * pct, bh, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, bh, 4); ctx.stroke();

    ctx.restore();
  },

  _vignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,20,30,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  },
};
